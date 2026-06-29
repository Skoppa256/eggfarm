import "server-only";

import { randomUUID } from "node:crypto";

import { prisma } from "@/lib/server/db";
import { MovementType, SourceType, type SizeHealthGrade } from "@/generated/prisma/enums";
import { InsufficientStockError } from "@/lib/errors";

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
  /** Auditing: who entered it. Wired to the real user once auth lands (Slice 2). */
  enteredById?: string | null;
  /** Business date of the movement; defaults to now(). */
  date?: Date;
}

type Direction = "IN" | "OUT";

function assertPositiveIntPcs(quantity: number): void {
  if (!Number.isInteger(quantity) || quantity <= 0) {
    throw new Error(`quantity must be a positive integer (pcs), got ${quantity}`);
  }
}

/**
 * Post one movement and update its balance, atomically and with a row lock.
 * Shared by `recordIn` / `recordOut`; `direction` sets the sign and movement type.
 */
async function postMovement(input: MovementInput, direction: Direction) {
  const { warehouseId, sizeHealthGrade, typeGradeId, quantity } = input;
  assertPositiveIntPcs(quantity);

  return prisma.$transaction(async (tx) => {
    // 1) Ensure the balance row exists so there is a row to lock. ON CONFLICT DO
    //    NOTHING keeps the transaction healthy if two writers first-touch the same
    //    SKU concurrently (the loser simply finds the row already present).
    await tx.$executeRaw`
      INSERT INTO "WarehouseStock"
        ("id", "warehouseId", "sizeHealthGrade", "typeGradeId", "currentQuantity", "createdAt", "updatedAt")
      VALUES
        (${randomUUID()}, ${warehouseId}, ${sizeHealthGrade}::"SizeHealthGrade", ${typeGradeId}, 0, now(), now())
      ON CONFLICT ("warehouseId", "sizeHealthGrade", "typeGradeId") DO NOTHING
    `;

    // 2) Lock the balance row FOR UPDATE (rule 5.2), then read the current balance.
    const locked = await tx.$queryRaw<{ currentQuantity: number }[]>`
      SELECT "currentQuantity"
      FROM "WarehouseStock"
      WHERE "warehouseId" = ${warehouseId}
        AND "sizeHealthGrade" = ${sizeHealthGrade}::"SizeHealthGrade"
        AND "typeGradeId" = ${typeGradeId}
      FOR UPDATE
    `;
    const preQuantity = locked[0].currentQuantity;
    const delta = direction === "IN" ? quantity : -quantity;
    const postQuantity = preQuantity + delta;

    // 3) Reject an oversell atomically — nothing written, error names the SKU.
    if (postQuantity < 0) {
      const gradeType = await tx.gradeType.findUnique({
        where: { id: typeGradeId },
        select: { name: true },
      });
      const sku = `${sizeHealthGrade} / ${gradeType?.name ?? typeGradeId}`;
      throw new InsufficientStockError(sku, preQuantity, quantity);
    }

    // 4) Update the balance projection AND append the ledger row — both or neither.
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
        movementType: direction === "IN" ? MovementType.IN : MovementType.OUT,
        quantity,
        unitUsed: input.unitUsed ?? "PCS",
        sourceType: input.sourceType,
        sourceReferenceId: input.sourceReferenceId ?? null,
        reason: input.reason ?? null,
        preQuantity,
        postQuantity,
        date: input.date ?? undefined,
        enteredById: input.enteredById ?? null,
      },
    });
  });
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
