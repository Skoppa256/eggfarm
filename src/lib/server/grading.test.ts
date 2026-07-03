import { beforeEach, describe, expect, it } from "vitest";

import { GradingStatus, Role, SizeHealthGrade, SourceType } from "@/generated/prisma/enums";
import { ConflictError } from "@/lib/errors";
import { createCollection, updateCollection } from "@/lib/server/collections";
import { prisma } from "@/lib/server/db";
import { createFarmhouse } from "@/lib/server/farmhouses";
import { findGrading, saveDraft, submitGrading } from "@/lib/server/grading";
import { getLedger, getStock } from "@/lib/server/ledger";

import { resetDb } from "../../../test/helpers";

beforeEach(resetDb);

const D = (s: string) => new Date(`${s}T00:00:00Z`);
const DATE = D("2026-07-01");

async function setup() {
  const user = await prisma.user.create({
    data: { name: "Admin", username: "admin", passwordHash: "x", role: Role.ADMIN },
  });
  const whA = await prisma.warehouse.create({ data: { name: "A", code: "WH-A" } });
  const normal = await prisma.gradeType.create({ data: { name: "Normal", sortOrder: 1 } });
  const omega = await prisma.gradeType.create({ data: { name: "Omega", sortOrder: 2 } });
  const farmhouse = await createFarmhouse({
    name: "K1",
    code: "K1",
    warehouseId: whA.id,
    maxBatchesPerDay: 2,
    changedById: user.id,
    today: DATE,
  });
  return { userId: user.id, whA: whA.id, normal: normal.id, omega: omega.id, farmhouseId: farmhouse.id };
}

async function collect(
  farmhouseId: string,
  userId: string,
  batchNumber: number,
  goodEggs: number,
  angkatRakPcs = 0,
  typeGradeId?: string,
) {
  return createCollection(
    { farmhouseId, date: DATE, batchNumber },
    {
      goodEggs,
      telurRetak: 0,
      telurLunak: 0,
      telurKosong: 0,
      lifts: angkatRakPcs > 0 && typeGradeId ? [{ typeGradeId, quantity: angkatRakPcs }] : [],
    },
    { userId },
  );
}

const gradedMovements = async (warehouseId: string) =>
  (await getLedger(warehouseId)).filter((m) => m.sourceType === SourceType.GRADING);
const skuQty = async (warehouseId: string, grade: SizeHealthGrade, typeId: string) =>
  (await getStock(warehouseId)).find((s) => s.sizeHealthGrade === grade && s.typeGradeId === typeId)
    ?.currentQuantity ?? 0;

describe("grading — sequential lock & collection requirement (FR-14/FR-15)", () => {
  it("blocks a batch with no collection, and blocks batch 2 until batch 1 is submitted", async () => {
    const { userId, farmhouseId, normal } = await setup();
    const key1 = { farmhouseId, date: DATE, batchNumber: 1 };
    const key2 = { farmhouseId, date: DATE, batchNumber: 2 };
    const oneA = { lines: [{ sizeHealthGrade: SizeHealthGrade.A, typeGradeId: normal, quantity: 30 }] };

    // No collection for batch 1 yet → blocked.
    await expect(submitGrading(key1, oneA, { userId })).rejects.toBeInstanceOf(ConflictError);

    await collect(farmhouseId, userId, 1, 3000);
    await collect(farmhouseId, userId, 2, 3000);

    // Batch 2 blocked (draft and submit) until batch 1 is submitted.
    await expect(submitGrading(key2, oneA, { userId })).rejects.toBeInstanceOf(ConflictError);
    await expect(saveDraft(key2, { lines: [] }, { userId })).rejects.toBeInstanceOf(ConflictError);

    await submitGrading(key1, oneA, { userId });
    const g2 = await submitGrading(key2, oneA, { userId });
    expect(g2.status).toBe(GradingStatus.SUBMITTED);
  });
});

describe("grading — draft vs submit is the stock boundary (FR-19)", () => {
  it("a draft posts no stock; submit posts every line per SKU to the warehouse", async () => {
    const { userId, whA, normal, farmhouseId } = await setup();
    await collect(farmhouseId, userId, 1, 3000);
    const key = { farmhouseId, date: DATE, batchNumber: 1 };
    const lines = [
      { sizeHealthGrade: SizeHealthGrade.A, typeGradeId: normal, quantity: 300 },
      { sizeHealthGrade: SizeHealthGrade.B, typeGradeId: normal, quantity: 150 },
    ];

    await saveDraft(key, { lines }, { userId });
    expect(await getStock(whA)).toHaveLength(0); // draft = no stock
    const draft = await findGrading(key);
    expect(draft?.status).toBe(GradingStatus.DRAFT);
    expect(draft?.lineItems).toHaveLength(2);

    await submitGrading(key, { lines }, { userId });
    expect(await skuQty(whA, SizeHealthGrade.A, normal)).toBe(300);
    expect(await skuQty(whA, SizeHealthGrade.B, normal)).toBe(150);
    const graded = await gradedMovements(whA);
    expect(graded).toHaveLength(2);
    expect(graded.every((m) => m.movementType === "IN")).toBe(true);
  });
});

describe("grading — reconcile against available (FR-18)", () => {
  it("rejects a graded total over available; accepts exactly available", async () => {
    const { userId, whA, normal, farmhouseId } = await setup();
    // Good 300, Angkat Rak 90 → available 210.
    await collect(farmhouseId, userId, 1, 300, 90, normal);
    const key = { farmhouseId, date: DATE, batchNumber: 1 };

    await expect(
      submitGrading(key, { lines: [{ sizeHealthGrade: SizeHealthGrade.A, typeGradeId: normal, quantity: 240 }] }, { userId }),
    ).rejects.toBeInstanceOf(ConflictError);
    expect(await gradedMovements(whA)).toHaveLength(0); // nothing graded posted

    await submitGrading(key, { lines: [{ sizeHealthGrade: SizeHealthGrade.A, typeGradeId: normal, quantity: 210 }] }, { userId });
    expect(await skuQty(whA, SizeHealthGrade.A, normal)).toBe(210);
  });
});

describe("grading — both Types", () => {
  it("posts one movement per Egg SKU across Type tabs", async () => {
    const { userId, whA, normal, omega, farmhouseId } = await setup();
    await collect(farmhouseId, userId, 1, 3000);
    const key = { farmhouseId, date: DATE, batchNumber: 1 };

    await submitGrading(
      key,
      {
        lines: [
          { sizeHealthGrade: SizeHealthGrade.A, typeGradeId: normal, quantity: 300 },
          { sizeHealthGrade: SizeHealthGrade.A, typeGradeId: omega, quantity: 90 },
        ],
      },
      { userId },
    );

    expect(await skuQty(whA, SizeHealthGrade.A, normal)).toBe(300);
    expect(await skuQty(whA, SizeHealthGrade.A, omega)).toBe(90);
    expect(await gradedMovements(whA)).toHaveLength(2);
  });
});

describe("grading — post-submit edit reconciles by delta", () => {
  it("adjusts stock by delta on re-submit without double-posting", async () => {
    const { userId, whA, normal, farmhouseId } = await setup();
    await collect(farmhouseId, userId, 1, 3000);
    const key = { farmhouseId, date: DATE, batchNumber: 1 };

    await submitGrading(key, { lines: [{ sizeHealthGrade: SizeHealthGrade.A, typeGradeId: normal, quantity: 300 }] }, { userId });
    expect(await skuQty(whA, SizeHealthGrade.A, normal)).toBe(300);
    expect(await gradedMovements(whA)).toHaveLength(1);

    // A 300 -> 360 (delta +60)
    await submitGrading(key, { lines: [{ sizeHealthGrade: SizeHealthGrade.A, typeGradeId: normal, quantity: 360 }] }, { userId });
    expect(await skuQty(whA, SizeHealthGrade.A, normal)).toBe(360); // not 660
    expect(await gradedMovements(whA)).toHaveLength(2);

    // A 360 -> 100 (OUT 260) and add B 50
    await submitGrading(
      key,
      {
        lines: [
          { sizeHealthGrade: SizeHealthGrade.A, typeGradeId: normal, quantity: 100 },
          { sizeHealthGrade: SizeHealthGrade.B, typeGradeId: normal, quantity: 50 },
        ],
      },
      { userId },
    );
    expect(await skuQty(whA, SizeHealthGrade.A, normal)).toBe(100);
    expect(await skuQty(whA, SizeHealthGrade.B, normal)).toBe(50);
  });
});

describe("collection lock after grading submit (A12)", () => {
  const emptyCounts = { telurRetak: 0, telurLunak: 0, telurKosong: 0 };

  it("locks the collection once graded; a plain edit is rejected, stock unchanged", async () => {
    const { userId, whA, normal, farmhouseId } = await setup();
    const collection = await collect(farmhouseId, userId, 1, 3000);
    const key = { farmhouseId, date: DATE, batchNumber: 1 };
    await submitGrading(key, { lines: [{ sizeHealthGrade: SizeHealthGrade.A, typeGradeId: normal, quantity: 300 }] }, { userId });

    await expect(
      updateCollection(collection.id, { goodEggs: 3300, ...emptyCounts, lifts: [] }, { userId }),
    ).rejects.toBeInstanceOf(ConflictError);
    // Collection counts and stock are untouched by the rejected edit.
    expect((await prisma.collectionRecord.findUnique({ where: { id: collection.id } }))?.goodEggs).toBe(3000);
    expect(await skuQty(whA, SizeHealthGrade.A, normal)).toBe(300);
  });

  it("Superadmin override edits the locked collection and stamps an audit reason", async () => {
    const { userId, whA, normal, farmhouseId } = await setup();
    // Good 3000, Angkat Rak 300 → available 2700.
    const collection = await collect(farmhouseId, userId, 1, 3000, 300, normal);
    const key = { farmhouseId, date: DATE, batchNumber: 1 };
    await submitGrading(key, { lines: [{ sizeHealthGrade: SizeHealthGrade.A, typeGradeId: normal, quantity: 300 }] }, { userId });

    // Override: bump Angkat Rak 300 → 600 (available 2400 ≥ graded 300). Posts a delta IN.
    await updateCollection(
      collection.id,
      { goodEggs: 3000, ...emptyCounts, lifts: [{ typeGradeId: normal, quantity: 600 }] },
      { userId },
      { allowGradedEdit: true },
    );
    expect(await skuQty(whA, SizeHealthGrade.ANGKAT_RAK, normal)).toBe(600);
    const overrideMoves = (await getLedger(whA)).filter((m) =>
      m.reason?.includes("Superadmin override"),
    );
    expect(overrideMoves.length).toBeGreaterThan(0);
  });

  it("rejects an override that would strand grading over available", async () => {
    const { userId, normal, farmhouseId } = await setup();
    const collection = await collect(farmhouseId, userId, 1, 300); // available 300
    const key = { farmhouseId, date: DATE, batchNumber: 1 };
    await submitGrading(key, { lines: [{ sizeHealthGrade: SizeHealthGrade.A, typeGradeId: normal, quantity: 300 }] }, { userId });

    // Lowering Good to 200 → available 200 < graded 300.
    await expect(
      updateCollection(collection.id, { goodEggs: 200, ...emptyCounts, lifts: [] }, { userId }, { allowGradedEdit: true }),
    ).rejects.toBeInstanceOf(ConflictError);
    expect((await prisma.collectionRecord.findUnique({ where: { id: collection.id } }))?.goodEggs).toBe(300);
  });
});
