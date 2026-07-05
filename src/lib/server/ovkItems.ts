import "server-only";

import { OvkCategory, RecordStatus } from "@/generated/prisma/enums";
import { ConflictError, NotFoundError } from "@/lib/errors";
import { prisma } from "@/lib/server/db";

// OVK item master (SRS FR-91) — Superadmin-managed catalog with optional per-item unit
// conversions. Office stock moves via ovkLedger.ts only (rule 5.4 mirror); this file
// manages the master rows + the read queries the UI needs.

export interface OvkConversionInput {
  unitName: string;
  factorToBase: number;
}

export interface OvkItemInput {
  name: string;
  category: OvkCategory;
  baseUnit: string;
  sortOrder?: number;
  conversions?: OvkConversionInput[];
}

const ITEM_INCLUDE = { stock: true, unitConversions: { orderBy: { unitName: "asc" as const } } };

/** All items (incl. inactive) for the master admin page. */
export function listOvkItems() {
  return prisma.ovkItem.findMany({
    orderBy: [{ status: "asc" }, { category: "asc" }, { sortOrder: "asc" }, { name: "asc" }],
    include: ITEM_INCLUDE,
  });
}

/** Active items (with their conversions) — for delivery/transfer entry forms. */
export function listActiveOvkItems() {
  return prisma.ovkItem.findMany({
    where: { status: RecordStatus.ACTIVE },
    orderBy: [{ category: "asc" }, { sortOrder: "asc" }, { name: "asc" }],
    include: { unitConversions: { orderBy: { unitName: "asc" } } },
  });
}

export async function createOvkItem(input: OvkItemInput) {
  const name = input.name.trim();
  const baseUnit = input.baseUnit.trim();
  if (name.length === 0) throw new ConflictError("Item name is required.");
  if (baseUnit.length === 0) throw new ConflictError("Base unit is required.");

  const existing = await prisma.ovkItem.findUnique({ where: { name } });
  if (existing) throw new ConflictError(`OVK item "${name}" already exists.`);

  const conversions = input.conversions ?? [];
  const seen = new Set<string>([baseUnit]);
  for (const c of conversions) {
    const unitName = c.unitName.trim();
    if (unitName.length === 0) continue;
    if (seen.has(unitName)) {
      throw new ConflictError(`Unit "${unitName}" is repeated (or equals the base unit).`);
    }
    if (!Number.isFinite(c.factorToBase) || c.factorToBase <= 0) {
      throw new ConflictError(`Conversion for "${unitName}" needs a factor greater than 0.`);
    }
    seen.add(unitName);
  }

  return prisma.ovkItem.create({
    data: {
      name,
      category: input.category,
      baseUnit,
      sortOrder: input.sortOrder ?? 0,
      unitConversions: {
        create: conversions
          .filter((c) => c.unitName.trim().length > 0)
          .map((c) => ({ unitName: c.unitName.trim(), factorToBase: c.factorToBase })),
      },
    },
    include: ITEM_INCLUDE,
  });
}

/** Soft activate/deactivate (never hard-delete; CLAUDE.md §6, FR-98). */
export async function setOvkItemStatus(id: string, status: RecordStatus) {
  const existing = await prisma.ovkItem.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError("OVK item not found.");
  return prisma.ovkItem.update({ where: { id }, data: { status } });
}
