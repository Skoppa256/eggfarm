import { beforeEach, describe, expect, it } from "vitest";

import { IngredientCategory, Role } from "@/generated/prisma/enums";
import { InsufficientIngredientError } from "@/lib/errors";
import { prisma, TX_OPTIONS } from "@/lib/server/db";
import {
  drawIngredientTx,
  getIngredientStock,
  recordDelivery,
} from "@/lib/server/ingredientLedger";

import { resetDb } from "../../../test/helpers";

beforeEach(resetDb);

async function setup() {
  const user = await prisma.user.create({
    data: { name: "Admin", username: "admin", passwordHash: "x", role: Role.ADMIN },
  });
  const ing = await prisma.ingredient.create({
    data: { name: "DKLS-36", category: IngredientCategory.KONSENTRAT },
  });
  return { userId: user.id, ingredientId: ing.id };
}

const stockOf = async (ingredientId: string) =>
  (await getIngredientStock()).find((s) => s.ingredientId === ingredientId)?.currentQuantity.toNumber() ?? 0;

describe("ingredient ledger — the only writer of ingredient stock (rule 5.4 mirror)", () => {
  it("a delivery increases central stock and appends an IN movement in lockstep", async () => {
    const { userId, ingredientId } = await setup();

    await recordDelivery({ ingredientId, quantity: 500.5, enteredById: userId });
    expect(await stockOf(ingredientId)).toBe(500.5);

    await recordDelivery({ ingredientId, quantity: 250.25, enteredById: userId });
    expect(await stockOf(ingredientId)).toBe(750.75);

    const moves = await prisma.ingredientMovement.findMany({ where: { ingredientId }, orderBy: { createdAt: "asc" } });
    expect(moves).toHaveLength(2);
    expect(moves.every((m) => m.movementType === "IN" && m.sourceType === "DELIVERY")).toBe(true);
    expect(moves[1].postQuantity.toNumber()).toBe(750.75);
  });

  it("a mixing draw-down reduces stock; an over-draw is rejected atomically, naming the ingredient", async () => {
    const { userId, ingredientId } = await setup();
    await recordDelivery({ ingredientId, quantity: 100, enteredById: userId });

    // Draw 264.94 kg but only 100 on hand → whole transaction rejected, nothing written.
    await expect(
      prisma.$transaction(
        (tx) => drawIngredientTx(tx, { ingredientId, quantity: 264.94, enteredById: userId }),
        TX_OPTIONS,
      ),
    ).rejects.toBeInstanceOf(InsufficientIngredientError);
    expect(await stockOf(ingredientId)).toBe(100); // unchanged
    expect(await prisma.ingredientMovement.count({ where: { movementType: "OUT" } })).toBe(0);

    // A draw within stock succeeds and appends an OUT.
    await prisma.$transaction(
      (tx) => drawIngredientTx(tx, { ingredientId, quantity: 70.5, enteredById: userId }),
      TX_OPTIONS,
    );
    expect(await stockOf(ingredientId)).toBe(29.5);
    const out = await prisma.ingredientMovement.findFirstOrThrow({ where: { movementType: "OUT" } });
    expect([out.sourceType, out.quantity.toNumber(), out.postQuantity.toNumber()]).toEqual(["MIXING", 70.5, 29.5]);
  });
});
