import "server-only";

import { RecordStatus } from "@/generated/prisma/enums";
import { addDays, toDateOnly } from "@/lib/dates";
import { ConflictError, NotFoundError } from "@/lib/errors";
import { prisma } from "@/lib/server/db";

// Farmhouse (kandang) management — Admin-managed operational structure. The
// warehouse assignment and max-batches-per-day are effective-dated logs, not
// mutable columns, so history is preserved and changes land on a specific date
// (SRS FR-41). All date inputs are passed in explicitly so the resolution logic is
// pure and unit-testable.

export const MIN_BATCHES_PER_DAY = 1;
// SRS: "max configurable". Kept as a code constant here (no global-settings table
// in scope); revisit if a runtime-configurable ceiling is needed.
export const MAX_BATCHES_PER_DAY = 10;

function assertBatchRange(n: number): void {
  if (!Number.isInteger(n) || n < MIN_BATCHES_PER_DAY || n > MAX_BATCHES_PER_DAY) {
    throw new ConflictError(
      `Max batches per day must be an integer between ${MIN_BATCHES_PER_DAY} and ${MAX_BATCHES_PER_DAY}.`,
    );
  }
}

async function assertWarehouseActive(warehouseId: string): Promise<void> {
  const warehouse = await prisma.warehouse.findUnique({ where: { id: warehouseId } });
  if (!warehouse || warehouse.status !== RecordStatus.ACTIVE) {
    // Deactivated warehouses are excluded from new mappings (SRS FR).
    throw new ConflictError("Warehouse is not active.");
  }
}

/**
 * The warehouse assigned to a farmhouse as of `asOf`: the mapping row with the
 * greatest effectiveFrom <= asOf (ties broken by createdAt). null if none yet.
 */
export async function resolveWarehouseId(farmhouseId: string, asOf: Date): Promise<string | null> {
  const mapping = await prisma.farmhouseWarehouseMapping.findFirst({
    where: { farmhouseId, effectiveFrom: { lte: toDateOnly(asOf) } },
    orderBy: [{ effectiveFrom: "desc" }, { createdAt: "desc" }],
  });
  return mapping?.warehouseId ?? null;
}

/**
 * The max-batches-per-day in force for a farmhouse as of `asOf`: the setting with
 * the greatest effectiveFrom <= asOf (ties broken by createdAt). null if none yet.
 */
export async function resolveMaxBatches(farmhouseId: string, asOf: Date): Promise<number | null> {
  const setting = await prisma.farmhouseBatchSetting.findFirst({
    where: { farmhouseId, effectiveFrom: { lte: toDateOnly(asOf) } },
    orderBy: [{ effectiveFrom: "desc" }, { createdAt: "desc" }],
  });
  return setting?.maxBatchesPerDay ?? null;
}

/** Farmhouses with their current (as of `asOf`) warehouse and max-batches, for lists. */
export function listFarmhousesWithCurrent(asOf: Date) {
  const on = toDateOnly(asOf);
  return prisma.farmhouse.findMany({
    orderBy: [{ status: "asc" }, { code: "asc" }],
    include: {
      warehouseMappings: {
        where: { effectiveFrom: { lte: on } },
        orderBy: [{ effectiveFrom: "desc" }, { createdAt: "desc" }],
        take: 1,
        include: { warehouse: true },
      },
      batchSettings: {
        where: { effectiveFrom: { lte: on } },
        orderBy: [{ effectiveFrom: "desc" }, { createdAt: "desc" }],
        take: 1,
      },
    },
  });
}

/**
 * Create a farmhouse plus its initial mapping and batch setting, both effective
 * from `today` (so a new kandang is usable immediately). Atomic.
 */
export async function createFarmhouse(input: {
  name: string;
  code: string;
  warehouseId: string;
  maxBatchesPerDay: number;
  changedById: string;
  today: Date;
}) {
  assertBatchRange(input.maxBatchesPerDay);
  await assertWarehouseActive(input.warehouseId);

  const existing = await prisma.farmhouse.findUnique({ where: { code: input.code } });
  if (existing) {
    throw new ConflictError(`Farmhouse code "${input.code}" is already taken.`);
  }

  const effectiveFrom = toDateOnly(input.today);
  return prisma.$transaction(async (tx) => {
    const farmhouse = await tx.farmhouse.create({
      data: { name: input.name, code: input.code },
    });
    await tx.farmhouseWarehouseMapping.create({
      data: {
        farmhouseId: farmhouse.id,
        warehouseId: input.warehouseId,
        effectiveFrom,
        changedById: input.changedById,
      },
    });
    await tx.farmhouseBatchSetting.create({
      data: {
        farmhouseId: farmhouse.id,
        maxBatchesPerDay: input.maxBatchesPerDay,
        effectiveFrom,
        changedById: input.changedById,
      },
    });
    return farmhouse;
  });
}

/**
 * Re-map a farmhouse to a (different) warehouse, effective from `effectiveFrom`
 * (default = today at the caller). Appends a mapping row; history is retained so
 * past entries stay linked to the old warehouse.
 */
export async function changeWarehouseMapping(input: {
  farmhouseId: string;
  warehouseId: string;
  changedById: string;
  effectiveFrom: Date;
}) {
  const farmhouse = await prisma.farmhouse.findUnique({ where: { id: input.farmhouseId } });
  if (!farmhouse) {
    throw new NotFoundError("Farmhouse not found.");
  }
  await assertWarehouseActive(input.warehouseId);

  return prisma.farmhouseWarehouseMapping.create({
    data: {
      farmhouseId: input.farmhouseId,
      warehouseId: input.warehouseId,
      effectiveFrom: toDateOnly(input.effectiveFrom),
      changedById: input.changedById,
    },
  });
}

/**
 * Change a farmhouse's max-batches-per-day. Per SRS FR-41 the change takes effect
 * the NEXT day, so the new setting's effectiveFrom is `today + 1`.
 */
export async function changeMaxBatches(input: {
  farmhouseId: string;
  maxBatchesPerDay: number;
  changedById: string;
  today: Date;
}) {
  assertBatchRange(input.maxBatchesPerDay);
  const farmhouse = await prisma.farmhouse.findUnique({ where: { id: input.farmhouseId } });
  if (!farmhouse) {
    throw new NotFoundError("Farmhouse not found.");
  }

  return prisma.farmhouseBatchSetting.create({
    data: {
      farmhouseId: input.farmhouseId,
      maxBatchesPerDay: input.maxBatchesPerDay,
      effectiveFrom: addDays(input.today, 1), // takes effect the next day
      changedById: input.changedById,
    },
  });
}

/** Soft activate/deactivate a farmhouse (never hard-delete; CLAUDE.md §6). */
export async function setFarmhouseStatus(farmhouseId: string, status: RecordStatus) {
  const farmhouse = await prisma.farmhouse.findUnique({ where: { id: farmhouseId } });
  if (!farmhouse) {
    throw new NotFoundError("Farmhouse not found.");
  }
  return prisma.farmhouse.update({ where: { id: farmhouseId }, data: { status } });
}
