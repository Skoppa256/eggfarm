import "server-only";

import { randomUUID } from "node:crypto";

import { Prisma } from "@/generated/prisma/client";
import { IngredientSourceType, MovementType } from "@/generated/prisma/enums";
import { InsufficientIngredientError } from "@/lib/errors";
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
