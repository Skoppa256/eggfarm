import { beforeEach, describe, expect, it } from "vitest";

import { IngredientCategory, MixLineKind, Role } from "@/generated/prisma/enums";
import { ConflictError, InsufficientIngredientError } from "@/lib/errors";
import { createDailyRecord } from "@/lib/server/dailyRecords";
import { prisma } from "@/lib/server/db";
import { createFarmhouse } from "@/lib/server/farmhouses";
import { createFlock } from "@/lib/server/flocks";
import { getIngredientStock, recordDelivery } from "@/lib/server/ingredientLedger";
import { createMixing, findMixing } from "@/lib/server/mixing";

import { resetDb } from "../../../test/helpers";

beforeEach(resetDb);

const D = (s: string) => new Date(`${s}T00:00:00Z`);
const CHICK_IN = D("2026-07-01");

async function setup(populasiAwal = 3377) {
  const user = await prisma.user.create({
    data: { name: "Admin", username: "admin", passwordHash: "x", role: Role.ADMIN },
  });
  const wh = await prisma.warehouse.create({ data: { name: "A", code: "WH-A" } });
  const farmhouse = await createFarmhouse({
    name: "K1",
    code: "K1",
    warehouseId: wh.id,
    maxBatchesPerDay: 2,
    changedById: user.id,
    today: CHICK_IN,
  });
  const flock = await createFlock(
    { strain: "Lohmann", chickInDate: CHICK_IN, placementAge: 100, placements: [{ farmhouseId: farmhouse.id, populasiAwal }] },
    { userId: user.id },
  );
  const placement = await prisma.placement.findFirstOrThrow({ where: { flockId: flock.id } });
  const konsentrat = await prisma.ingredient.create({ data: { name: "DKLS-36", category: IngredientCategory.KONSENTRAT, sortOrder: 1 } });
  const jagung = await prisma.ingredient.create({ data: { name: "Jagung", category: IngredientCategory.GRAIN, sortOrder: 3 } });
  const premix = await prisma.ingredient.create({ data: { name: "Maximus-Egg", category: IngredientCategory.PREMIX, sortOrder: 2 } });
  return { userId: user.id, farmhouseId: farmhouse.id, placementId: placement.id, konsentrat: konsentrat.id, jagung: jagung.id, premix: premix.id };
}

const deliver = (ingredientId: string, quantity: number, userId: string) =>
  recordDelivery({ ingredientId, quantity, enteredById: userId });
const stockOf = async (ingredientId: string) =>
  (await getIngredientStock()).find((s) => s.ingredientId === ingredientId)?.currentQuantity.toNumber() ?? 0;

describe("mixing — requirement, netting, mains-by-% vs fixed supplement, draw-down (FR-82..85)", () => {
  it("computes the 398.486 kg requirement and draws each line down from central stock", async () => {
    const s = await setup(3377);
    await deliver(s.konsentrat, 500, s.userId);
    await deliver(s.jagung, 200, s.userId);
    await deliver(s.premix, 10, s.userId);

    // Chick-in day → HIDUP = seed 3377; no prior leftover. Requirement 3377×118/1000 = 398.486.
    const mix = await createMixing(
      { farmhouseId: s.farmhouseId, date: CHICK_IN, projectedIntake: 118 },
      [
        { ingredientId: s.konsentrat, kind: MixLineKind.MAIN_PERCENT, percent: 70 },
        { ingredientId: s.jagung, kind: MixLineKind.MAIN_PERCENT, percent: 30 },
        { ingredientId: s.premix, kind: MixLineKind.FIXED_WEIGHT, fixedWeight: 2.5 },
      ],
      { userId: s.userId },
    );

    expect(mix.requirement.toNumber()).toBe(398.486);
    expect(mix.totalCampur.toNumber()).toBe(398.486); // PAKAN MASUK
    expect(mix.jenis).toBe("DKLS-36 + Maximus-Egg + Jagung"); // konsentrat → premix → jagung

    const line = (id: string) => mix.lines.find((l) => l.ingredientId === id)!;
    expect(line(s.konsentrat).computedWeight.toNumber()).toBe(278.94); // 70% × 398.486
    expect(line(s.jagung).computedWeight.toNumber()).toBe(119.546); // 30% × 398.486
    expect(line(s.premix).computedWeight.toNumber()).toBe(2.5); // fixed, not scaled

    // Central stock drawn down by each computed weight.
    expect(await stockOf(s.konsentrat)).toBe(221.06);
    expect(await stockOf(s.jagung)).toBe(80.454);
    expect(await stockOf(s.premix)).toBe(7.5);
  });

  it("no-mix day: leftover ≥ requirement → MASUK 0, nothing drawn, TERSEDIA > requirement", async () => {
    const s = await setup(1000);
    await deliver(s.konsentrat, 100, s.userId);
    // Day 2 leaves 500 kg reusable leftover (SISA DIGUNAKAN).
    await createDailyRecord(
      { farmhouseId: s.farmhouseId, date: D("2026-07-02") },
      { mati: 0, afkir: 0, sisaDigunakan: 500, sisaDibuang: 0, beratTelur: 0 },
      { userId: s.userId },
    );

    // Day 3: requirement 1000×100/1000 = 100; leftover 500 ≥ 100 → TOTAL CAMPUR 0.
    const mix = await createMixing(
      { farmhouseId: s.farmhouseId, date: D("2026-07-03"), projectedIntake: 100 },
      [{ ingredientId: s.konsentrat, kind: MixLineKind.MAIN_PERCENT, percent: 100 }],
      { userId: s.userId },
    );
    expect(mix.requirement.toNumber()).toBe(100);
    expect(mix.reusableLeftover.toNumber()).toBe(500);
    expect(mix.totalCampur.toNumber()).toBe(0); // MASUK 0
    expect(mix.lines[0].computedWeight.toNumber()).toBe(0);
    expect(await stockOf(s.konsentrat)).toBe(100); // nothing drawn

    // The day-3 record's TERSEDIA = MASUK 0 + leftover 500 = 500 > requirement 100.
    const rec = await createDailyRecord(
      { farmhouseId: s.farmhouseId, date: D("2026-07-03") },
      { mati: 0, afkir: 0, sisaDigunakan: 0, sisaDibuang: 0, beratTelur: 0 },
      { userId: s.userId },
    );
    expect(rec.pakanMasuk?.toNumber()).toBe(0);
    expect(rec.pakanTersedia?.toNumber()).toBe(500);
  });
});

describe("mixing — PAKAN MASUK posts write-once to the DailyRecord (§5.3)", () => {
  it("pull: a record created after the mix freezes MASUK/JENIS/FCR from it", async () => {
    const s = await setup(3377);
    await deliver(s.konsentrat, 500, s.userId);
    await createMixing(
      { farmhouseId: s.farmhouseId, date: CHICK_IN, projectedIntake: 118 },
      [{ ingredientId: s.konsentrat, kind: MixLineKind.MAIN_PERCENT, percent: 100 }],
      { userId: s.userId },
    );
    // Chick-in-day record (mati 0). BERAT TELUR 200 → FCR = 398.486 / 200 = 1.992.
    const rec = await createDailyRecord(
      { farmhouseId: s.farmhouseId, date: CHICK_IN },
      { mati: 0, afkir: 0, sisaDigunakan: 0, sisaDibuang: 0, beratTelur: 200 },
      { userId: s.userId },
    );
    expect(rec.pakanMasuk?.toNumber()).toBe(398.486);
    expect(rec.jenis).toBe("DKLS-36");
    expect(rec.realisasiIntake?.toNumber()).toBe(398.486);
    expect(rec.gramPerEkor?.toNumber()).toBe(118); // 398.486 / 3377 × 1000
    expect(rec.fcr?.toNumber()).toBe(1.992);
  });

  it("push: confirming the mix after the record freezes its PAKAN block (write-once)", async () => {
    const s = await setup(1000);
    await deliver(s.konsentrat, 500, s.userId);
    // Record day 2 first (mati 5 → HIDUP 995), no mix yet → PAKAN null.
    const before = await createDailyRecord(
      { farmhouseId: s.farmhouseId, date: D("2026-07-02") },
      { mati: 5, afkir: 0, sisaDigunakan: 0, sisaDibuang: 0, beratTelur: 100 },
      { userId: s.userId },
    );
    expect(before.pakanMasuk).toBeNull();

    // Confirm the mix for day 2: HIDUP 995 × 100 / 1000 = 99.5 kg MASUK.
    await createMixing(
      { farmhouseId: s.farmhouseId, date: D("2026-07-02"), projectedIntake: 100 },
      [{ ingredientId: s.konsentrat, kind: MixLineKind.MAIN_PERCENT, percent: 100 }],
      { userId: s.userId },
    );
    const after = await prisma.dailyRecord.findUniqueOrThrow({ where: { id: before.id } });
    expect(after.pakanMasuk?.toNumber()).toBe(99.5);
    expect(after.pakanTersedia?.toNumber()).toBe(99.5);
    expect(after.jenis).toBe("DKLS-36");
  });
});

describe("mixing — validation & atomicity", () => {
  it("rejects a draw-down that would go negative, rolling the whole mix back", async () => {
    const s = await setup(3377);
    await deliver(s.konsentrat, 100, s.userId); // need 398.486, only 100 on hand
    await expect(
      createMixing(
        { farmhouseId: s.farmhouseId, date: CHICK_IN, projectedIntake: 118 },
        [{ ingredientId: s.konsentrat, kind: MixLineKind.MAIN_PERCENT, percent: 100 }],
        { userId: s.userId },
      ),
    ).rejects.toBeInstanceOf(InsufficientIngredientError);
    expect(await findMixing(s.farmhouseId, CHICK_IN)).toBeNull(); // nothing written
    expect(await stockOf(s.konsentrat)).toBe(100); // unchanged
  });

  it("rejects mains that don't sum to 100%, and a second mix for the same day", async () => {
    const s = await setup(3377);
    await deliver(s.konsentrat, 500, s.userId);
    await deliver(s.jagung, 500, s.userId);
    await expect(
      createMixing(
        { farmhouseId: s.farmhouseId, date: CHICK_IN, projectedIntake: 118 },
        [{ ingredientId: s.konsentrat, kind: MixLineKind.MAIN_PERCENT, percent: 60 }],
        { userId: s.userId },
      ),
    ).rejects.toBeInstanceOf(ConflictError);

    await createMixing(
      { farmhouseId: s.farmhouseId, date: CHICK_IN, projectedIntake: 118 },
      [{ ingredientId: s.konsentrat, kind: MixLineKind.MAIN_PERCENT, percent: 100 }],
      { userId: s.userId },
    );
    await expect(
      createMixing(
        { farmhouseId: s.farmhouseId, date: CHICK_IN, projectedIntake: 118 },
        [{ ingredientId: s.jagung, kind: MixLineKind.MAIN_PERCENT, percent: 100 }],
        { userId: s.userId },
      ),
    ).rejects.toBeInstanceOf(ConflictError);
  });
});
