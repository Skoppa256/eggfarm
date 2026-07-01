import { beforeEach, describe, expect, it } from "vitest";

import { Role, SizeHealthGrade, SourceType } from "@/generated/prisma/enums";
import { ConflictError } from "@/lib/errors";
import {
  createCollection,
  findCollection,
  updateCollection,
} from "@/lib/server/collections";
import { prisma } from "@/lib/server/db";
import { changeMaxBatches, createFarmhouse } from "@/lib/server/farmhouses";
import { getLedger, getStock } from "@/lib/server/ledger";

import { resetDb } from "../../../test/helpers";

beforeEach(resetDb);

const D = (s: string) => new Date(`${s}T00:00:00Z`);

async function setup() {
  const user = await prisma.user.create({
    data: { name: "Admin", username: "admin", passwordHash: "x", role: Role.ADMIN },
  });
  const whA = await prisma.warehouse.create({ data: { name: "A", code: "WH-A" } });
  const normal = await prisma.gradeType.create({ data: { name: "Normal", sortOrder: 1 } });
  const omega = await prisma.gradeType.create({ data: { name: "Omega", sortOrder: 2 } });
  const farmhouse = await createFarmhouse({
    name: "Kandang 1",
    code: "K1",
    warehouseId: whA.id,
    maxBatchesPerDay: 2,
    changedById: user.id,
    today: D("2026-07-01"),
  });
  return { userId: user.id, whA: whA.id, normal: normal.id, omega: omega.id, farmhouseId: farmhouse.id };
}

const emptyCounts = { goodEggs: 0, telurRetak: 0, telurLunak: 0, telurKosong: 0 };

describe("collection — Angkat Rak posts to stock", () => {
  it("posts Angkat Rak by Type to the kandang's warehouse (pcs); counts don't stock", async () => {
    const { userId, whA, normal, farmhouseId } = await setup();

    const created = await createCollection(
      { farmhouseId, date: D("2026-07-01"), batchNumber: 1 },
      { goodEggs: 3000, telurRetak: 20, telurLunak: 5, telurKosong: 2, lifts: [{ typeGradeId: normal, quantity: 150 }] },
      { userId },
    );
    expect(created.maxBatchesAtEntry).toBe(2); // snapshot frozen at entry

    const stock = await getStock(whA);
    expect(stock).toHaveLength(1); // ONLY the Angkat Rak SKU — counts never stock
    expect(stock[0].sizeHealthGrade).toBe(SizeHealthGrade.ANGKAT_RAK);
    expect(stock[0].typeGradeId).toBe(normal);
    expect(stock[0].currentQuantity).toBe(150);

    const ledger = await getLedger(whA);
    expect(ledger).toHaveLength(1);
    expect(ledger[0].movementType).toBe("IN");
    expect(ledger[0].sourceType).toBe(SourceType.ANGKAT_RAK);
    expect(ledger[0].sourceReferenceId).toBe(created.id);
    expect(ledger[0].quantity).toBe(150);
  });

  it("creates two movements when a lift contains both Types", async () => {
    const { userId, whA, normal, omega, farmhouseId } = await setup();

    await createCollection(
      { farmhouseId, date: D("2026-07-01"), batchNumber: 1 },
      { ...emptyCounts, goodEggs: 3000, lifts: [{ typeGradeId: normal, quantity: 150 }, { typeGradeId: omega, quantity: 90 }] },
      { userId },
    );

    expect(await getLedger(whA)).toHaveLength(2);
    const byType = new Map((await getStock(whA)).map((s) => [s.typeGradeId, s.currentQuantity]));
    expect(byType.get(normal)).toBe(150);
    expect(byType.get(omega)).toBe(90);
  });
});

describe("collection — duplicate prevention (FR-09)", () => {
  it("rejects a duplicate (kandang, date, batch) and findCollection returns the existing", async () => {
    const { userId, normal, farmhouseId } = await setup();
    const key = { farmhouseId, date: D("2026-07-01"), batchNumber: 1 };
    const input = { ...emptyCounts, goodEggs: 100, lifts: [{ typeGradeId: normal, quantity: 30 }] };

    await createCollection(key, input, { userId });
    await expect(createCollection(key, input, { userId })).rejects.toBeInstanceOf(ConflictError);

    const found = await findCollection(key);
    expect(found?.batchNumber).toBe(1);
    expect(found?.angkatRakLifts).toHaveLength(1);
  });
});

describe("collection — edit reconciles the ledger (adjust, don't duplicate)", () => {
  it("adjusts Angkat Rak by delta on each edit without double-posting", async () => {
    const { userId, whA, normal, farmhouseId } = await setup();
    const key = { farmhouseId, date: D("2026-07-01"), batchNumber: 1 };
    const created = await createCollection(
      key,
      { ...emptyCounts, goodEggs: 3000, lifts: [{ typeGradeId: normal, quantity: 150 }] },
      { userId },
    );
    const normalQty = async () =>
      (await getStock(whA)).find((s) => s.typeGradeId === normal)?.currentQuantity ?? 0;

    expect(await normalQty()).toBe(150);

    // 150 -> 210 (delta +60): balance 210 (not 360), a second IN of 60
    await updateCollection(created.id, { ...emptyCounts, goodEggs: 3000, lifts: [{ typeGradeId: normal, quantity: 210 }] }, { userId });
    expect(await normalQty()).toBe(210);
    expect(await getLedger(whA)).toHaveLength(2);
    expect((await findCollection(key))?.angkatRakLifts[0]?.quantity).toBe(210);

    // 210 -> 90 (delta -120): OUT 120
    await updateCollection(created.id, { ...emptyCounts, goodEggs: 3000, lifts: [{ typeGradeId: normal, quantity: 90 }] }, { userId });
    expect(await normalQty()).toBe(90);
    const ledger = await getLedger(whA);
    expect(ledger).toHaveLength(3);
    expect(ledger[0].movementType).toBe("OUT");
    expect(ledger[0].quantity).toBe(120);

    // remove Normal (0): OUT 90, balance 0, lift row deleted
    await updateCollection(created.id, { ...emptyCounts, goodEggs: 3000, lifts: [] }, { userId });
    expect(await normalQty()).toBe(0);
    expect((await findCollection(key))?.angkatRakLifts).toHaveLength(0);
    expect(await getLedger(whA)).toHaveLength(4);
  });
});

describe("collection — batch max respects the effective config for the business date", () => {
  it("rejects an out-of-range batch and honors a next-day max change", async () => {
    const { userId, farmhouseId } = await setup(); // max 2 from 2026-07-01

    await expect(
      createCollection({ farmhouseId, date: D("2026-07-01"), batchNumber: 3 }, { ...emptyCounts, lifts: [] }, { userId }),
    ).rejects.toBeInstanceOf(ConflictError);

    // raise max to 3 — effective the next day (2026-07-02)
    await changeMaxBatches({ farmhouseId, maxBatchesPerDay: 3, changedById: userId, today: D("2026-07-01") });

    // still rejected on 2026-07-01
    await expect(
      createCollection({ farmhouseId, date: D("2026-07-01"), batchNumber: 3 }, { ...emptyCounts, lifts: [] }, { userId }),
    ).rejects.toBeInstanceOf(ConflictError);

    // allowed on 2026-07-02, and the snapshot reflects the new max
    const c = await createCollection(
      { farmhouseId, date: D("2026-07-02"), batchNumber: 3 },
      { ...emptyCounts, lifts: [] },
      { userId },
    );
    expect(c.batchNumber).toBe(3);
    expect(c.maxBatchesAtEntry).toBe(3);
  });
});
