import "server-only";

import { randomUUID } from "node:crypto";

import { Prisma } from "@/generated/prisma/client";
import { IngredientSourceType, MovementType } from "@/generated/prisma/enums";
import { ConflictError, InsufficientIngredientError } from "@/lib/errors";
import { prisma, TX_OPTIONS } from "@/lib/server/db";

// THE INGREDIENT LEDGER — the ONLY writer of central feed-ingredient stock (CLAUDE.md
// §5.4 mirror for PAKAN). No other file may create an `IngredientMovement` or write
// `IngredientStock`. Deliveries (IN) and mixing draw-downs (OUT) both funnel through
// here. Same discipline as the egg ledger: the append-only movement ledger is the
// source of truth; the balance is a cache; each movement + balance update commit in one
// transaction with the balance row locked FOR UPDATE; an OUT that would go negative is
// rejected atomically, naming the short ingredient. All quantities are kg (Decimal).

type Tx = Prisma.TransactionClient;
type Direction = "IN" | "OUT";

export interface IngredientMovementInput {
  ingredientId: string;
  quantity: number; // kg, > 0
  sourceType: IngredientSourceType;
  sourceReferenceId?: string | null;
  reason?: string | null;
  enteredById: string;
  date?: Date;
}

function toDecimal(quantity: number): Prisma.Decimal {
  // Construct from the number's shortest string so no float noise reaches the DB.
  return new Prisma.Decimal(quantity.toString());
}

function assertPositiveKg(quantity: number): void {
  if (!Number.isFinite(quantity) || quantity <= 0) {
    throw new Error(`ingredient quantity must be a positive number (kg), got ${quantity}`);
  }
}

async function ingredientLabel(tx: Tx, ingredientId: string): Promise<string> {
  const ing = await tx.ingredient.findUnique({ where: { id: ingredientId }, select: { name: true } });
  return ing?.name ?? ingredientId;
}

/**
 * The locked core every ingredient-stock write funnels through: ensure the balance
 * row, lock it FOR UPDATE, read `pre`, let the caller compute the new balance
 * (`computePost`, which may reject), then update the balance and append the movement —
 * atomically. `quantity` on the row is the magnitude |post − pre|.
 */
async function applyIngredientMovementTx(
  tx: Tx,
  ingredientId: string,
  computePost: (pre: Prisma.Decimal) => Promise<Prisma.Decimal>,
  meta: {
    movementType: MovementType;
    sourceType: IngredientSourceType;
    sourceReferenceId?: string | null;
    reason?: string | null;
    enteredById: string;
    date?: Date;
  },
) {
  await tx.$executeRaw`
    INSERT INTO "IngredientStock" ("id", "ingredientId", "currentQuantity", "createdAt", "updatedAt")
    VALUES (${randomUUID()}, ${ingredientId}, 0, now(), now())
    ON CONFLICT ("ingredientId") DO NOTHING
  `;

  const locked = await tx.$queryRaw<{ currentQuantity: string }[]>`
    SELECT "currentQuantity" FROM "IngredientStock" WHERE "ingredientId" = ${ingredientId} FOR UPDATE
  `;
  const pre = new Prisma.Decimal(locked[0].currentQuantity);
  const post = await computePost(pre); // may throw → tx rolls back
  const quantity = post.minus(pre).abs();

  await tx.ingredientStock.update({
    where: { ingredientId },
    data: { currentQuantity: post },
  });

  return tx.ingredientMovement.create({
    data: {
      ingredientId,
      movementType: meta.movementType,
      quantity,
      sourceType: meta.sourceType,
      sourceReferenceId: meta.sourceReferenceId ?? null,
      reason: meta.reason ?? null,
      preQuantity: pre,
      postQuantity: post,
      date: meta.date ?? undefined,
      enteredById: meta.enteredById,
    },
  });
}

async function postIngredientTx(tx: Tx, input: IngredientMovementInput, direction: Direction) {
  assertPositiveKg(input.quantity);
  const qty = toDecimal(input.quantity);
  return applyIngredientMovementTx(
    tx,
    input.ingredientId,
    async (pre) => {
      const post = direction === "IN" ? pre.plus(qty) : pre.minus(qty);
      if (post.isNegative()) {
        throw new InsufficientIngredientError(
          await ingredientLabel(tx, input.ingredientId),
          pre.toString(),
          qty.toString(),
        );
      }
      return post;
    },
    {
      movementType: direction === "IN" ? MovementType.IN : MovementType.OUT,
      sourceType: input.sourceType,
      sourceReferenceId: input.sourceReferenceId,
      reason: input.reason,
      enteredById: input.enteredById,
      date: input.date,
    },
  );
}

/** A movement input whose source is fixed by the entry point (delivery vs mixing). */
type SourcedInput = Omit<IngredientMovementInput, "sourceType">;

/** Record a feed delivery (stock IN) in its own transaction (Admin, FR-81). */
export function recordDelivery(input: SourcedInput) {
  return prisma.$transaction(
    (tx) => postIngredientTx(tx, { ...input, sourceType: IngredientSourceType.DELIVERY }, "IN"),
    TX_OPTIONS,
  );
}

/**
 * Draw an ingredient down (stock OUT) within the caller's transaction `tx` — for a
 * mixing confirmation to bundle every line's draw-down atomically. Rejects an
 * over-draw, naming the short ingredient (FR-85 / FR-88).
 */
export function drawIngredientTx(tx: Tx, input: SourcedInput) {
  return postIngredientTx(tx, { ...input, sourceType: IngredientSourceType.MIXING }, "OUT");
}

/** Minimum reason length for a supervised ingredient Stock Correction (mirrors egg §5.1). */
export const INGREDIENT_CORRECTION_MIN_REASON = 20;

export interface IngredientCorrectionInput {
  ingredientId: string;
  /** Exactly one of: the absolute corrected balance (kg) OR a signed delta (kg). */
  newQuantity?: number;
  delta?: number;
  reason: string; // >= INGREDIENT_CORRECTION_MIN_REASON chars
  enteredById: string;
  date?: Date;
}

/**
 * Supervised ingredient Stock Correction — the feed mirror of the egg `recordCorrection`
 * (closes A31). Writes an IMMUTABLE CORRECTION `IngredientMovement` carrying pre/post and
 * updates the balance, atomically and row-locked, via `ingredientLedger.ts` only (rule
 * 5.4). No edit/delete — to fix a wrong correction, submit a SECOND correction. Rejects a
 * reason shorter than 20 chars, and a result below zero or equal to the current balance.
 */
export async function recordIngredientCorrection(input: IngredientCorrectionInput) {
  const reason = input.reason.trim();
  if (reason.length < INGREDIENT_CORRECTION_MIN_REASON) {
    throw new ConflictError(
      `Koreksi memerlukan alasan minimal ${INGREDIENT_CORRECTION_MIN_REASON} karakter.`,
    );
  }
  const hasAbsolute = input.newQuantity != null;
  const hasDelta = input.delta != null;
  if (hasAbsolute === hasDelta) {
    throw new ConflictError("Isi salah satu: jumlah terkoreksi atau selisih, tidak keduanya.");
  }
  if (hasAbsolute && (!Number.isFinite(input.newQuantity) || (input.newQuantity as number) < 0)) {
    throw new ConflictError("Jumlah terkoreksi harus bilangan non-negatif (kg).");
  }
  if (hasDelta && !Number.isFinite(input.delta)) {
    throw new ConflictError("Selisih harus berupa bilangan (kg).");
  }

  return prisma.$transaction(
    (tx) =>
      applyIngredientMovementTx(
        tx,
        input.ingredientId,
        async (pre) => {
          const post = hasAbsolute
            ? toDecimal(input.newQuantity as number)
            : pre.plus(toDecimal(input.delta as number));
          if (post.isNegative()) {
            throw new ConflictError(
              `Koreksi akan membuat ${await ingredientLabel(tx, input.ingredientId)} di bawah nol.`,
            );
          }
          if (post.equals(pre)) {
            throw new ConflictError("Koreksi harus mengubah saldo.");
          }
          return post;
        },
        {
          movementType: MovementType.CORRECTION,
          sourceType: IngredientSourceType.CORRECTION,
          reason,
          enteredById: input.enteredById,
          date: input.date,
        },
      ),
    TX_OPTIONS,
  );
}

/** Current central balances (one row per ingredient touched), with the ingredient. */
export function getIngredientStock() {
  return prisma.ingredientStock.findMany({
    include: { ingredient: true },
    orderBy: [{ ingredient: { category: "asc" } }, { ingredient: { sortOrder: "asc" } }],
  });
}

/** The ingredient-movement ledger (optionally for one ingredient), newest first. */
export function getIngredientLedger(ingredientId?: string, limit = 100) {
  return prisma.ingredientMovement.findMany({
    where: ingredientId ? { ingredientId } : undefined,
    include: { ingredient: true },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    take: limit,
  });
}
