import "server-only";

import { randomUUID } from "node:crypto";

import type { Prisma } from "@/generated/prisma/client";
import { MovementType, SourceType, type SizeHealthGrade } from "@/generated/prisma/enums";
import { ConflictError, InsufficientStockError } from "@/lib/errors";
import { prisma, TX_OPTIONS } from "@/lib/server/db";

// THE LEDGER — the ONLY writer of stock in the entire codebase (CLAUDE.md §5.4).
//
// No other file may create a `StockMovement` or write `WarehouseStock`. Every
// feature that moves stock (Angkat Rak, grading, sales, corrections, voids) calls
// a function exported here.
//
// Invariants enforced here (rules 5.1 / 5.2):
//   • The append-only `StockMovement` ledger is the source of truth; the per-SKU
//     `WarehouseStock.currentQuantity` is a cache derived from it.
//   • Each movement and its balance update happen inside ONE interactive
//     transaction — both commit or neither does.
//   • The affected balance row is locked `FOR UPDATE` before read-then-write, so
//     two concurrent writers can never oversell the same SKU.
//   • An OUT that would drive the balance negative is rejected atomically, with no
//     partial write, naming the short SKU.

/** An Egg SKU located in a warehouse: (warehouse, Size&Health grade, Type grade). */
export interface SkuRef {
  warehouseId: string;
  sizeHealthGrade: SizeHealthGrade;
  typeGradeId: string;
}

/** Inputs common to a single stock movement. `quantity` is always pcs and > 0. */
export interface MovementInput extends SkuRef {
  quantity: number;
  sourceType: SourceType;
  /** id of the originating record (collection / grading / sale / ...). */
  sourceReferenceId?: string | null;
  /** How the operator entered the amount (audit only) — "PCS" or "RAK". */
  unitUsed?: string;
  /** Free-text note; required (>= 20 chars) only for CORRECTION, gated elsewhere. */
  reason?: string | null;
  /** Auditing: the authenticated user who entered it (FK to User, required). */
  enteredById: string;
  /** Business date of the movement; defaults to now(). */
  date?: Date;
}

type Direction = "IN" | "OUT";

/** Prisma interactive-transaction client (what `$transaction((tx) => …)` yields). */
type Tx = Prisma.TransactionClient;

function assertPositiveIntPcs(quantity: number): void {
  if (!Number.isInteger(quantity) || quantity <= 0) {
    throw new Error(`quantity must be a positive integer (pcs), got ${quantity}`);
  }
}

/** Human label for a SKU, for error messages (e.g. "A / Omega"). */
async function skuLabel(tx: Tx, grade: SizeHealthGrade, typeGradeId: string): Promise<string> {
  const gradeType = await tx.gradeType.findUnique({
    where: { id: typeGradeId },
    select: { name: true },
  });
  return `${grade} / ${gradeType?.name ?? typeGradeId}`;
}

/** What gets written onto the movement row besides the computed pre/post/quantity. */
interface MovementMeta {
  movementType: MovementType;
  sourceType: SourceType;
  sourceReferenceId?: string | null;
  unitUsed?: string;
  reason?: string | null;
  enteredById: string;
  date?: Date;
}

/**
 * The locked core that EVERY stock write funnels through (rules 5.1 / 5.2 / 5.4):
 * ensure the balance row, lock it FOR UPDATE, read `pre`, let the caller compute the
 * new balance (`computePost`, which may reject — oversell, negative correction, …),
 * then update the balance and append the movement — atomically, both or neither.
 * `quantity` is stored as the magnitude of the change |post − pre|.
 */
async function applyMovementTx(
  tx: Tx,
  sku: SkuRef,
  computePost: (pre: number) => Promise<number>,
  meta: MovementMeta,
) {
  const { warehouseId, sizeHealthGrade, typeGradeId } = sku;

  // Ensure the balance row exists so there is a row to lock. ON CONFLICT DO NOTHING
  // keeps the transaction healthy if two writers first-touch the same SKU at once.
  await tx.$executeRaw`
    INSERT INTO "WarehouseStock"
      ("id", "warehouseId", "sizeHealthGrade", "typeGradeId", "currentQuantity", "createdAt", "updatedAt")
    VALUES
      (${randomUUID()}, ${warehouseId}, ${sizeHealthGrade}::"SizeHealthGrade", ${typeGradeId}, 0, now(), now())
    ON CONFLICT ("warehouseId", "sizeHealthGrade", "typeGradeId") DO NOTHING
  `;

  // Lock the balance row FOR UPDATE (rule 5.2), then read the current balance.
  const locked = await tx.$queryRaw<{ currentQuantity: number }[]>`
    SELECT "currentQuantity"
    FROM "WarehouseStock"
    WHERE "warehouseId" = ${warehouseId}
      AND "sizeHealthGrade" = ${sizeHealthGrade}::"SizeHealthGrade"
      AND "typeGradeId" = ${typeGradeId}
    FOR UPDATE
  `;
  const preQuantity = locked[0].currentQuantity;
  const postQuantity = await computePost(preQuantity); // may throw → tx rolls back
  const quantity = Math.abs(postQuantity - preQuantity);

  // Update the balance projection AND append the ledger row — both or neither.
  await tx.warehouseStock.update({
    where: {
      warehouseId_sizeHealthGrade_typeGradeId: { warehouseId, sizeHealthGrade, typeGradeId },
    },
    data: { currentQuantity: postQuantity },
  });

  return tx.stockMovement.create({
    data: {
      warehouseId,
      sizeHealthGrade,
      typeGradeId,
      movementType: meta.movementType,
      quantity,
      unitUsed: meta.unitUsed ?? "PCS",
      sourceType: meta.sourceType,
      sourceReferenceId: meta.sourceReferenceId ?? null,
      reason: meta.reason ?? null,
      preQuantity,
      postQuantity,
      date: meta.date ?? undefined,
      enteredById: meta.enteredById,
    },
  });
}

/**
 * IN/OUT movement within an EXISTING transaction `tx` (rule 5.4 holds — this is
 * ledger.ts). A caller that must bundle stock with other writes passes its own `tx`
 * for a single atomic commit. OUT rejects an oversell, naming the short SKU.
 */
async function postMovementTx(tx: Tx, input: MovementInput, direction: Direction) {
  assertPositiveIntPcs(input.quantity);
  const { sizeHealthGrade, typeGradeId, quantity } = input;
  return applyMovementTx(
    tx,
    input,
    async (pre) => {
      const post = direction === "IN" ? pre + quantity : pre - quantity;
      if (post < 0) {
        throw new InsufficientStockError(
          await skuLabel(tx, sizeHealthGrade, typeGradeId),
          pre,
          quantity,
        );
      }
      return post;
    },
    {
      movementType: direction === "IN" ? MovementType.IN : MovementType.OUT,
      sourceType: input.sourceType,
      sourceReferenceId: input.sourceReferenceId,
      unitUsed: input.unitUsed,
      reason: input.reason,
      enteredById: input.enteredById,
      date: input.date,
    },
  );
}

/** Standalone: post one movement in its own transaction. */
async function postMovement(input: MovementInput, direction: Direction) {
  return prisma.$transaction((tx) => postMovementTx(tx, input, direction), TX_OPTIONS);
}

/** Record stock coming IN (e.g. Angkat Rak post, grading submit). */
export function recordIn(input: MovementInput) {
  return postMovement(input, "IN");
}

/**
 * Record stock going OUT (e.g. a sale line). Rejects atomically — with no partial
 * write — if the SKU balance would go negative.
 */
export function recordOut(input: MovementInput) {
  return postMovement(input, "OUT");
}

/**
 * Record an IN within the caller's transaction `tx` — for operations that must
 * atomically bundle stock with other writes (e.g. a collection's Angkat Rak lifts).
 */
export function recordInTx(tx: Tx, input: MovementInput) {
  return postMovementTx(tx, input, "IN");
}

/** Record an OUT within the caller's transaction `tx`. Rejects an oversell. */
export function recordOutTx(tx: Tx, input: MovementInput) {
  return postMovementTx(tx, input, "OUT");
}

/**
 * Restore stock for a voided line within the caller's transaction `tx`: appends a
 * compensating VOID movement that ADDS `quantity` back (CLAUDE.md §5.1 — voids never
 * delete the original). Reuses the shared locked core (no second stock path).
 */
export function recordVoidTx(tx: Tx, input: MovementInput) {
  assertPositiveIntPcs(input.quantity);
  return applyMovementTx(tx, input, async (pre) => pre + input.quantity, {
    movementType: MovementType.VOID,
    sourceType: input.sourceType,
    sourceReferenceId: input.sourceReferenceId,
    unitUsed: input.unitUsed,
    reason: input.reason,
    enteredById: input.enteredById,
    date: input.date,
  });
}

/** Minimum reason length for a Stock Correction (SRS FR-26). */
export const CORRECTION_MIN_REASON = 20;

export interface CorrectionInput extends SkuRef {
  /** Exactly one of: the absolute corrected balance (pcs) OR a signed delta (pcs). */
  newQuantity?: number;
  delta?: number;
  reason: string; // >= CORRECTION_MIN_REASON chars
  enteredById: string;
  sourceReferenceId?: string | null; // optional external reference
  date?: Date;
}

/**
 * Supervised Stock Correction (SRS FR-26, CLAUDE.md §5.1). Writes an IMMUTABLE
 * CORRECTION movement carrying pre/post and updates the balance, atomically and
 * row-locked. There is no edit/delete — to fix a wrong correction, submit a SECOND
 * correction. Rejects a reason shorter than 20 chars, and a result below zero or
 * equal to the current balance.
 */
export async function recordCorrection(input: CorrectionInput) {
  const reason = input.reason.trim();
  if (reason.length < CORRECTION_MIN_REASON) {
    throw new ConflictError(
      `A correction needs a reason of at least ${CORRECTION_MIN_REASON} characters.`,
    );
  }
  const hasAbsolute = input.newQuantity != null;
  const hasDelta = input.delta != null;
  if (hasAbsolute === hasDelta) {
    throw new ConflictError("Provide either a corrected quantity or a delta, not both.");
  }
  if (hasAbsolute && (!Number.isInteger(input.newQuantity) || (input.newQuantity ?? 0) < 0)) {
    throw new ConflictError("Corrected quantity must be a non-negative whole number (pcs).");
  }
  if (hasDelta && !Number.isInteger(input.delta)) {
    throw new ConflictError("Delta must be a whole number (pcs).");
  }

  return prisma.$transaction((tx) =>
    applyMovementTx(
      tx,
      input,
      async (pre) => {
        const post = hasAbsolute ? (input.newQuantity as number) : pre + (input.delta as number);
        if (post < 0) {
          throw new ConflictError(
            `Correction would drive ${await skuLabel(tx, input.sizeHealthGrade, input.typeGradeId)} below zero.`,
          );
        }
        if (post === pre) {
          throw new ConflictError("Correction must change the balance.");
        }
        return post;
      },
      {
        movementType: MovementType.CORRECTION,
        sourceType: SourceType.CORRECTION,
        sourceReferenceId: input.sourceReferenceId,
        unitUsed: "PCS",
        reason,
        enteredById: input.enteredById,
        date: input.date,
      },
    ),
    TX_OPTIONS,
  );
}

/** Current balances (one row per touched SKU) for a warehouse, with Type grade. */
export function getStock(warehouseId: string) {
  return prisma.warehouseStock.findMany({
    where: { warehouseId },
    include: { gradeType: true },
    orderBy: [{ sizeHealthGrade: "asc" }, { gradeType: { sortOrder: "asc" } }],
  });
}

/** The movement ledger for a warehouse, newest first. */
export function getLedger(warehouseId: string, limit = 100) {
  return prisma.stockMovement.findMany({
    where: { warehouseId },
    include: { gradeType: true },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    take: limit,
  });
}

export interface LedgerFilter {
  warehouseId: string;
  from?: Date;
  to?: Date;
  sizeHealthGrade?: SizeHealthGrade;
  typeGradeId?: string;
  limit?: number;
}

/** The movement ledger with date-range / SKU filters (read-only view, SRS FR-25). */
export function getFilteredLedger(filter: LedgerFilter) {
  const { warehouseId, from, to, sizeHealthGrade, typeGradeId, limit = 200 } = filter;
  return prisma.stockMovement.findMany({
    where: {
      warehouseId,
      ...(sizeHealthGrade ? { sizeHealthGrade } : {}),
      ...(typeGradeId ? { typeGradeId } : {}),
      ...(from || to
        ? { date: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } }
        : {}),
    },
    include: { gradeType: true },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    take: limit,
  });
}
