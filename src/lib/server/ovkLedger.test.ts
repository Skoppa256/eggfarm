import { beforeEach, describe, expect, it } from "vitest";

import { OvkCategory, Role } from "@/generated/prisma/enums";
import { ConflictError, InsufficientOvkError } from "@/lib/errors";
import { createDailyRecord } from "@/lib/server/dailyRecords";
import { prisma } from "@/lib/server/db";
import { createFarmhouse } from "@/lib/server/farmhouses";
import { createFlock } from "@/lib/server/flocks";
import {
  getOvkStock,
  pemakaianReport,
  recordOvkCorrection,
  recordOvkDelivery,
  recordOvkTransfer,
} from "@/lib/server/ovkLedger";

import { resetDb } from "../../../test/helpers";

beforeEach(resetDb);

const D = (s: string) => new Date(`${s}T00:00:00Z`);

async function setup() {
  const user = await prisma.user.create({
    data: { name: "Admin", username: "admin", passwordHash: "x", role: Role.ADMIN },
  });
  const kandang = await prisma.farmhouse.create({ data: { name: "Kandang 1", code: "K1" } });
  // Vitamin C: base unit gram, with a conversion 1 pcs = 100 gram.
  const item = await prisma.ovkItem.create({
    data: {
      name: "Vitamin C",
      category: OvkCategory.VITAMIN,
      baseUnit: "gram",
      unitConversions: { create: [{ unitName: "pcs", factorToBase: 100 }] },
    },
  });
  return { userId: user.id, kandangId: kandang.id, itemId: item.id };
}

const stockOf = async (itemId: string) =>
  (await getOvkStock()).find((s) => s.ovkItemId === itemId)?.currentQuantity.toNumber() ?? 0;

describe("OVK ledger — the only writer of office stock (rule 5.4 mirror)", () => {
  it("a delivery increases office stock, converting the entered unit to the base unit", async () => {
    const s = await setup();
    await recordOvkDelivery({ ovkItemId: s.itemId, quantity: 3, unitName: "pcs", enteredById: s.userId }); // 300 gram
    expect(await stockOf(s.itemId)).toBe(300);
    await recordOvkDelivery({ ovkItemId: s.itemId, quantity: 50, unitName: "gram", enteredById: s.userId });
    expect(await stockOf(s.itemId)).toBe(350);
    const del = await prisma.ovkMovement.findFirstOrThrow({ where: { sourceType: "DELIVERY" }, orderBy: { createdAt: "asc" } });
    expect([del.enteredQuantity.toNumber(), del.unitUsed, del.quantity.toNumber()]).toEqual([3, "pcs", 300]);
  });

  it("an office→kandang transfer reduces office stock and appears in the pemakaian report", async () => {
    const s = await setup();
    await recordOvkDelivery({ ovkItemId: s.itemId, quantity: 5, unitName: "pcs", enteredById: s.userId }); // 500 gram
    await recordOvkTransfer({
      ovkItemId: s.itemId,
      quantity: 2,
      unitName: "pcs",
      farmhouseId: s.kandangId,
      note: "Morning dose",
      enteredById: s.userId,
      date: D("2026-07-06"),
    });
    expect(await stockOf(s.itemId)).toBe(300); // 500 − 200

    const report = await pemakaianReport(s.kandangId);
    expect(report).toHaveLength(1);
    expect(report[0].ovkItem.name).toBe("Vitamin C");
    expect(report[0].enteredQuantity.toNumber()).toBe(2);
    expect(report[0].unitUsed).toBe("pcs");
    expect(report[0].note).toBe("Morning dose");
  });

  it("refuses a transfer that would drive office stock negative, naming the item", async () => {
    const s = await setup();
    await recordOvkDelivery({ ovkItemId: s.itemId, quantity: 1, unitName: "pcs", enteredById: s.userId }); // 100 gram
    await expect(
      recordOvkTransfer({ ovkItemId: s.itemId, quantity: 2, unitName: "pcs", farmhouseId: s.kandangId, enteredById: s.userId }),
    ).rejects.toBeInstanceOf(InsufficientOvkError);
    expect(await stockOf(s.itemId)).toBe(100); // unchanged
    expect(await prisma.ovkMovement.count({ where: { movementType: "OUT" } })).toBe(0);
  });

  it("supervised correction adjusts the balance immutably; <20-char reason rejected", async () => {
    const s = await setup();
    await recordOvkDelivery({ ovkItemId: s.itemId, quantity: 5, unitName: "pcs", enteredById: s.userId }); // 500 gram
    await expect(
      recordOvkCorrection({ ovkItemId: s.itemId, newQuantity: 480, reason: "too short", enteredById: s.userId }),
    ).rejects.toBeInstanceOf(ConflictError);
    expect(await stockOf(s.itemId)).toBe(500);

    await recordOvkCorrection({ ovkItemId: s.itemId, newQuantity: 480, reason: "Physical stock-take after audit", enteredById: s.userId });
    expect(await stockOf(s.itemId)).toBe(480);
    const corr = await prisma.ovkMovement.findFirstOrThrow({ where: { movementType: "CORRECTION" } });
    expect([corr.preQuantity.toNumber(), corr.postQuantity.toNumber()]).toEqual([500, 480]);
  });
});

describe("OVK is decoupled from daily OBAT/VITAMIN notes (FR-94)", () => {
  it("a daily record's OBAT/VITAMIN note moves no OVK stock", async () => {
    const user = await prisma.user.create({
      data: { name: "A", username: "a", passwordHash: "x", role: Role.ADMIN },
    });
    const wh = await prisma.warehouse.create({ data: { name: "W", code: "W1" } });
    const chickIn = D("2026-07-01");
    const farmhouse = await createFarmhouse({
      name: "K1", code: "K1", warehouseId: wh.id, maxBatchesPerDay: 2, changedById: user.id, today: chickIn,
    });
    await createFlock(
      { strain: "L", chickInDate: chickIn, placementAge: 100, placements: [{ farmhouseId: farmhouse.id, populasiAwal: 1000 }] },
      { userId: user.id },
    );
    const item = await prisma.ovkItem.create({ data: { name: "Vita", category: OvkCategory.VITAMIN, baseUnit: "gram" } });
    await recordOvkDelivery({ ovkItemId: item.id, quantity: 100, unitName: "gram", enteredById: user.id });

    await createDailyRecord(
      { farmhouseId: farmhouse.id, date: D("2026-07-02") },
      { mati: 0, afkir: 0, sisaDigunakan: 0, sisaDibuang: 0, beratTelur: 0, obatNote: "Vitamin C 2 pcs", vitaminNote: "Electrolyte" },
      { userId: user.id },
    );

    // The note is stored on the daily record, but no OVK movement/stock change occurred.
    expect(await prisma.ovkMovement.count({ where: { sourceType: "TRANSFER" } })).toBe(0);
    expect((await getOvkStock()).find((x) => x.ovkItemId === item.id)?.currentQuantity.toNumber()).toBe(100);
  });
});
