import "server-only";

import { randomUUID } from "node:crypto";

import { Prisma } from "@/generated/prisma/client";
import { MovementType, OvkSourceType } from "@/generated/prisma/enums";
import { ConflictError, InsufficientOvkError, NotFoundError } from "@/lib/errors";
import { conversionFactor } from "@/lib/ovk";
import { prisma, TX_OPTIONS } from "@/lib/server/db";

// THE OVK LEDGER — the ONLY writer of central office OVK stock (CLAUDE.md §5.4 mirror).
// No other file may create an `OvkMovement` or write `OvkStock`. Deliveries (IN),
// office→kandang transfers (OUT), and supervised corrections all funnel through here.
// Same discipline as the egg/ingredient ledgers: append-only movements are the source of
// truth; the balance is a cache; movement + balance commit together with the balance row
// locked FOR UPDATE; a transfer that would go negative is rejected atomically, naming the
// short item. Stock is held in each item's base unit (Decimal); entries may use a
// converted unit and are converted here.

type Tx = Prisma.TransactionClient;

const round3 = (x: number): number => Math.round(x * 1000) / 1000;
const toDec = (n: number): Prisma.Decimal => new Prisma.Decimal(n.toString());

export const OVK_CORRECTION_MIN_REASON = 20;

interface MovementMeta {
  movementType: MovementType;
  sourceType: OvkSourceType;
  enteredQuantity: number;
  unitUsed: string;
  farmhouseId?: string | null;
  note?: string | null;
  reason?: string | null;
  enteredById: string;
  date?: Date;
}

async function applyOvkMovementTx(
  tx: Tx,
  ovkItemId: string,
  computePost: (pre: Prisma.Decimal) => Promise<Prisma.Decimal>,
  meta: MovementMeta,
) {
  await tx.$executeRaw`
    INSERT INTO "OvkStock" ("id", "ovkItemId", "currentQuantity", "createdAt", "updatedAt")
    VALUES (${randomUUID()}, ${ovkItemId}, 0, now(), now())
    ON CONFLICT ("ovkItemId") DO NOTHING
  `;
  const locked = await tx.$queryRaw<{ currentQuantity: string }[]>`
    SELECT "currentQuantity" FROM "OvkStock" WHERE "ovkItemId" = ${ovkItemId} FOR UPDATE
  `;
  const pre = new Prisma.Decimal(locked[0].currentQuantity);
  const post = await computePost(pre); // may throw → tx rolls back
  const quantity = post.minus(pre).abs();

  await tx.ovkStock.update({ where: { ovkItemId }, data: { currentQuantity: post } });

  return tx.ovkMovement.create({
    data: {
      ovkItemId,
      movementType: meta.movementType,
      sourceType: meta.sourceType,
      quantity,
      enteredQuantity: toDec(meta.enteredQuantity),
      unitUsed: meta.unitUsed,
      farmhouseId: meta.farmhouseId ?? null,
      note: meta.note ?? null,
      reason: meta.reason ?? null,
      preQuantity: pre,
      postQuantity: post,
      date: meta.date ?? undefined,
      enteredById: meta.enteredById,
    },
  });
}

async function loadItem(ovkItemId: string) {
  const item = await prisma.ovkItem.findUnique({
    where: { id: ovkItemId },
    include: { unitConversions: true },
  });
  if (!item) throw new NotFoundError("Item OVK tidak ditemukan.");
  return item;
}

/** Convert an entered (quantity, unit) to the item's base unit, or reject an unknown unit. */
function toBase(
  item: { name: string; baseUnit: string; unitConversions: { unitName: string; factorToBase: Prisma.Decimal }[] },
  quantity: number,
  unitName: string,
): number {
  const factor = conversionFactor(
    unitName,
    item.baseUnit,
    item.unitConversions.map((c) => ({ unitName: c.unitName, factorToBase: c.factorToBase.toNumber() })),
  );
  if (factor == null) {
    throw new ConflictError(`Satuan "${unitName}" tidak terdefinisi untuk ${item.name}.`);
  }
  return round3(quantity * factor);
}

export interface OvkEntry {
  ovkItemId: string;
  quantity: number; // in unitName
  unitName: string;
  enteredById: string;
  date?: Date;
}

/** Record an OVK delivery to the office (stock IN) — Admin (FR-92). */
export async function recordOvkDelivery(input: OvkEntry) {
  if (!Number.isFinite(input.quantity) || input.quantity <= 0) {
    throw new ConflictError("Jumlah penerimaan harus lebih dari 0.");
  }
  const item = await loadItem(input.ovkItemId);
  const base = toBase(item, input.quantity, input.unitName);
  return prisma.$transaction(
    (tx) =>
      applyOvkMovementTx(tx, input.ovkItemId, async (pre) => pre.plus(toDec(base)), {
        movementType: MovementType.IN,
        sourceType: OvkSourceType.DELIVERY,
        enteredQuantity: input.quantity,
        unitUsed: input.unitName,
        enteredById: input.enteredById,
        date: input.date,
      }),
    TX_OPTIONS,
  );
}

/**
 * Record an office→kandang transfer (stock OUT) — the stock-reduction event (FR-93).
 * Rejects an over-transfer, naming the short item (FR-97). Attributed to the kandang, with
 * an optional note; surfaces in that kandang's pemakaian report.
 */
export async function recordOvkTransfer(input: OvkEntry & { farmhouseId: string; note?: string | null }) {
  if (!Number.isFinite(input.quantity) || input.quantity <= 0) {
    throw new ConflictError("Jumlah transfer harus lebih dari 0.");
  }
  const item = await loadItem(input.ovkItemId);
  const base = toBase(item, input.quantity, input.unitName);
  const qty = toDec(base);
  return prisma.$transaction(
    (tx) =>
      applyOvkMovementTx(
        tx,
        input.ovkItemId,
        async (pre) => {
          const post = pre.minus(qty);
          if (post.isNegative()) {
            throw new InsufficientOvkError(item.name, pre.toString(), qty.toString(), item.baseUnit);
          }
          return post;
        },
        {
          movementType: MovementType.OUT,
          sourceType: OvkSourceType.TRANSFER,
          enteredQuantity: input.quantity,
          unitUsed: input.unitName,
          farmhouseId: input.farmhouseId,
          note: input.note ?? null,
          enteredById: input.enteredById,
          date: input.date,
        },
      ),
    TX_OPTIONS,
  );
}

export interface OvkCorrectionInput {
  ovkItemId: string;
  newQuantity: number; // absolute corrected balance in base unit
  reason: string; // >= OVK_CORRECTION_MIN_REASON chars
  enteredById: string;
  date?: Date;
}

/** Supervised office-stock correction — immutable CORRECTION with pre/post + reason. */
export async function recordOvkCorrection(input: OvkCorrectionInput) {
  const reason = input.reason.trim();
  if (reason.length < OVK_CORRECTION_MIN_REASON) {
    throw new ConflictError(
      `Koreksi memerlukan alasan minimal ${OVK_CORRECTION_MIN_REASON} karakter.`,
    );
  }
  if (!Number.isFinite(input.newQuantity) || input.newQuantity < 0) {
    throw new ConflictError("Jumlah terkoreksi harus bilangan non-negatif.");
  }
  const item = await loadItem(input.ovkItemId);
  const target = toDec(round3(input.newQuantity));
  return prisma.$transaction(
    (tx) =>
      applyOvkMovementTx(
        tx,
        input.ovkItemId,
        async (pre) => {
          if (target.equals(pre)) throw new ConflictError("Koreksi harus mengubah saldo.");
          return target;
        },
        {
          movementType: MovementType.CORRECTION,
          sourceType: OvkSourceType.CORRECTION,
          enteredQuantity: round3(input.newQuantity),
          unitUsed: item.baseUnit,
          reason,
          enteredById: input.enteredById,
          date: input.date,
        },
      ),
    TX_OPTIONS,
  );
}

/** Current office balances (one row per item touched), with the item. */
export function getOvkStock() {
  return prisma.ovkStock.findMany({
    include: { ovkItem: true },
    orderBy: [{ ovkItem: { category: "asc" } }, { ovkItem: { sortOrder: "asc" } }],
  });
}

/** The OVK movement ledger (optionally for one item), newest first. */
export function getOvkLedger(ovkItemId?: string, limit = 50) {
  return prisma.ovkMovement.findMany({
    where: ovkItemId ? { ovkItemId } : undefined,
    include: { ovkItem: true, farmhouse: { select: { name: true, code: true } } },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    take: limit,
  });
}

/**
 * OVK Usage (Pemakaian) report for a kandang over a date range (FR-95): every transfer
 * OUT to that kandang, newest first — date, item, quantity out (as entered), unit, note.
 */
export function pemakaianReport(farmhouseId: string, from?: Date, to?: Date) {
  return prisma.ovkMovement.findMany({
    where: {
      farmhouseId,
      sourceType: OvkSourceType.TRANSFER,
      ...(from || to ? { date: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } } : {}),
    },
    include: { ovkItem: { select: { name: true, category: true } } },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
  });
}
