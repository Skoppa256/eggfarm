import { beforeEach, describe, expect, it } from "vitest";

import { MovementType, Role, SizeHealthGrade, SourceType } from "@/generated/prisma/enums";
import { ConflictError } from "@/lib/errors";
import { prisma } from "@/lib/server/db";
import { getLedger, getStock, recordCorrection, recordIn } from "@/lib/server/ledger";

import { resetDb } from "../../../test/helpers";

beforeEach(resetDb);

async function fixture() {
  const user = await prisma.user.create({
    data: { name: "Admin", username: "admin", passwordHash: "x", role: Role.ADMIN },
  });
  const warehouse = await prisma.warehouse.create({ data: { name: "A", code: "WH-A" } });
  const type = await prisma.gradeType.create({ data: { name: "Normal", sortOrder: 1 } });
  return { userId: user.id, warehouseId: warehouse.id, typeGradeId: type.id };
}

function sku(f: Awaited<ReturnType<typeof fixture>>) {
  return { warehouseId: f.warehouseId, sizeHealthGrade: SizeHealthGrade.A, typeGradeId: f.typeGradeId };
}
const seed = (f: Awaited<ReturnType<typeof fixture>>, quantity: number) =>
  recordIn({ ...sku(f), quantity, sourceType: SourceType.GRADING, enteredById: f.userId });
const corrections = async (warehouseId: string) =>
  (await getLedger(warehouseId)).filter((m) => m.movementType === MovementType.CORRECTION);
const balance = async (warehouseId: string) => (await getStock(warehouseId))[0]?.currentQuantity ?? 0;

describe("stock correction (FR-26)", () => {
  it("writes an immutable CORRECTION with pre/post, updating the balance", async () => {
    const f = await fixture();
    await seed(f, 100);

    const m = await recordCorrection({
      ...sku(f),
      newQuantity: 90,
      reason: "Physical count reconciliation after warehouse audit",
      enteredById: f.userId,
    });

    expect(m.movementType).toBe(MovementType.CORRECTION);
    expect(m.sourceType).toBe(SourceType.CORRECTION);
    expect(m.preQuantity).toBe(100);
    expect(m.postQuantity).toBe(90);
    expect(m.quantity).toBe(10); // magnitude of the change
    expect(await balance(f.warehouseId)).toBe(90);
  });

  it("rejects a reason under 20 characters, writing nothing", async () => {
    const f = await fixture();
    await seed(f, 50);

    await expect(
      recordCorrection({ ...sku(f), newQuantity: 40, reason: "too short", enteredById: f.userId }),
    ).rejects.toBeInstanceOf(ConflictError);

    expect(await balance(f.warehouseId)).toBe(50);
    expect(await corrections(f.warehouseId)).toHaveLength(0);
  });

  it("is immutable — a second correction is the only remedy (originals preserved)", async () => {
    const f = await fixture();
    await seed(f, 100);

    const c1 = await recordCorrection({
      ...sku(f),
      newQuantity: 90,
      reason: "First reconciliation after the physical count",
      enteredById: f.userId,
    });
    const c2 = await recordCorrection({
      ...sku(f),
      newQuantity: 95,
      reason: "Second correction to fix the first mistake",
      enteredById: f.userId,
    });

    const rows = await corrections(f.warehouseId);
    expect(rows).toHaveLength(2);
    const first = rows.find((m) => m.id === c1.id);
    expect(first?.preQuantity).toBe(100);
    expect(first?.postQuantity).toBe(90); // unchanged by the later correction
    const second = rows.find((m) => m.id === c2.id);
    expect(second?.preQuantity).toBe(90);
    expect(second?.postQuantity).toBe(95);
    expect(await balance(f.warehouseId)).toBe(95);
  });

  it("supports a delta correction and refuses to drive the balance below zero", async () => {
    const f = await fixture();
    await seed(f, 30);

    const m = await recordCorrection({
      ...sku(f),
      delta: -10,
      reason: "Adjust down for breakage found while restocking",
      enteredById: f.userId,
    });
    expect(m.postQuantity).toBe(20);

    await expect(
      recordCorrection({
        ...sku(f),
        delta: -100,
        reason: "This should fail because it drives stock negative",
        enteredById: f.userId,
      }),
    ).rejects.toBeInstanceOf(ConflictError);
    expect(await balance(f.warehouseId)).toBe(20);
  });
});
