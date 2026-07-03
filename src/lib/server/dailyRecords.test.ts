import { beforeEach, describe, expect, it } from "vitest";

import { Role, SizeHealthGrade } from "@/generated/prisma/enums";
import { ConflictError } from "@/lib/errors";
import { createCollection } from "@/lib/server/collections";
import {
  createDailyRecord,
  liveEggBuckets,
  updateDailyRecord,
} from "@/lib/server/dailyRecords";
import { prisma } from "@/lib/server/db";
import { createFarmhouse } from "@/lib/server/farmhouses";
import { createFlock, resolveHidup } from "@/lib/server/flocks";
import { submitGrading } from "@/lib/server/grading";

import { resetDb } from "../../../test/helpers";

beforeEach(resetDb);

const D = (s: string) => new Date(`${s}T00:00:00Z`);
const CHICK_IN = D("2026-07-01");

async function setup() {
  const user = await prisma.user.create({
    data: { name: "Admin", username: "admin", passwordHash: "x", role: Role.ADMIN },
  });
  const wh = await prisma.warehouse.create({ data: { name: "A", code: "WH-A" } });
  const normal = await prisma.gradeType.create({ data: { name: "Normal", sortOrder: 1 } });
  const farmhouse = await createFarmhouse({
    name: "K1",
    code: "K1",
    warehouseId: wh.id,
    maxBatchesPerDay: 2,
    changedById: user.id,
    today: CHICK_IN,
  });
  const flock = await createFlock(
    { strain: "Lohmann", chickInDate: CHICK_IN, placementAge: 100, placements: [{ farmhouseId: farmhouse.id, populasiAwal: 1000 }] },
    { userId: user.id },
  );
  const placement = await prisma.placement.findFirstOrThrow({ where: { flockId: flock.id } });
  return { userId: user.id, farmhouseId: farmhouse.id, placementId: placement.id, normal: normal.id };
}

const input = (over: Partial<Parameters<typeof createDailyRecord>[1]> = {}) => ({
  mati: 0,
  afkir: 0,
  sisaDigunakan: 0,
  sisaDibuang: 0,
  beratTelur: 0,
  ...over,
});

describe("daily record — HIDUP + HD% frozen at creation", () => {
  it("applies MATI/AFKIR to HIDUP and freezes HD% from the collection buckets", async () => {
    const s = await setup();
    // Collection on day 2: total 800+50+30+11 = 891 eggs.
    await createCollection(
      { farmhouseId: s.farmhouseId, date: D("2026-07-02"), batchNumber: 1 },
      { goodEggs: 800, telurRetak: 50, telurLunak: 30, telurKosong: 11, lifts: [] },
      { userId: s.userId },
    );

    const rec = await createDailyRecord(
      { farmhouseId: s.farmhouseId, date: D("2026-07-02") },
      input({ mati: 6, afkir: 4 }), // entering 1000 → HIDUP 990
      { userId: s.userId },
    );

    expect(rec.hidup).toBe(990);
    expect(rec.hdPercent.toNumber()).toBe(90); // 891 / 990 * 100
    // HIDUP snapshot written for the day (running ledger stays in step).
    expect(await resolveHidup(s.placementId, D("2026-07-02"))).toBe(990);
  });
});

describe("daily record — MATI/AFKIR carry HIDUP forward via the snapshot", () => {
  it("each day's HIDUP = previous − MATI − AFKIR across records", async () => {
    const s = await setup();
    const day2 = await createDailyRecord(
      { farmhouseId: s.farmhouseId, date: D("2026-07-02") },
      input({ mati: 10, afkir: 0 }),
      { userId: s.userId },
    );
    expect(day2.hidup).toBe(990);

    const day3 = await createDailyRecord(
      { farmhouseId: s.farmhouseId, date: D("2026-07-03") },
      input({ mati: 5, afkir: 0 }),
      { userId: s.userId },
    );
    expect(day3.hidup).toBe(985);
    expect(await resolveHidup(s.placementId, D("2026-07-03"))).toBe(985);
  });
});

describe("daily record — egg buckets derive from collection, reconcile to grading", () => {
  it("firms only the Pecah sub-split; the daily total is unchanged", async () => {
    const s = await setup();
    await createCollection(
      { farmhouseId: s.farmhouseId, date: D("2026-07-02"), batchNumber: 1 },
      { goodEggs: 900, telurRetak: 120, telurLunak: 30, telurKosong: 10, lifts: [] },
      { userId: s.userId },
    );

    const before = await liveEggBuckets(s.farmhouseId, D("2026-07-02"));
    expect(before).toMatchObject({ utuh: 900, lunak: 30, pecah: 120, kosong: 10, total: 1060 });
    expect(before.reconciledToGrading).toBe(false);

    // Grade the batch: 80 Retak + 40 Plastik (available 900 ≥ graded).
    await submitGrading(
      { farmhouseId: s.farmhouseId, date: D("2026-07-02"), batchNumber: 1 },
      {
        lines: [
          { sizeHealthGrade: SizeHealthGrade.RETAK, typeGradeId: s.normal, quantity: 80 },
          { sizeHealthGrade: SizeHealthGrade.PLASTIK, typeGradeId: s.normal, quantity: 40 },
        ],
      },
      { userId: s.userId },
    );

    const after = await liveEggBuckets(s.farmhouseId, D("2026-07-02"));
    // Totals and the daily total are unchanged; only the sub-split firms.
    expect(after).toMatchObject({ utuh: 900, lunak: 30, pecah: 120, kosong: 10, total: 1060 });
    expect(after.reconciledToGrading).toBe(true);
    expect(after.pecahRetak).toBe(80);
    expect(after.pecahPlastik).toBe(40);
  });
});

describe("daily record — one per kandang/day, chick-in-day & edit rules", () => {
  it("rejects a duplicate record for the same kandang/date (edit instead)", async () => {
    const s = await setup();
    await createDailyRecord({ farmhouseId: s.farmhouseId, date: D("2026-07-02") }, input({ mati: 1 }), { userId: s.userId });
    await expect(
      createDailyRecord({ farmhouseId: s.farmhouseId, date: D("2026-07-02") }, input(), { userId: s.userId }),
    ).rejects.toBeInstanceOf(ConflictError);
  });

  it("does not allow day-0 (chick-in day) mortality (A21), but a 0/0 record is fine", async () => {
    const s = await setup();
    await expect(
      createDailyRecord({ farmhouseId: s.farmhouseId, date: CHICK_IN }, input({ mati: 3 }), { userId: s.userId }),
    ).rejects.toBeInstanceOf(ConflictError);

    const rec = await createDailyRecord({ farmhouseId: s.farmhouseId, date: CHICK_IN }, input(), { userId: s.userId });
    expect(rec.hidup).toBe(1000); // the seed
  });

  it("freezes MATI/AFKIR on edit but lets the other fields change", async () => {
    const s = await setup();
    const rec = await createDailyRecord(
      { farmhouseId: s.farmhouseId, date: D("2026-07-02") },
      input({ mati: 10, afkir: 0, sisaDibuang: 1 }),
      { userId: s.userId },
    );
    // Changing MATI is rejected (needs a supervised correction).
    await expect(
      updateDailyRecord(rec.id, input({ mati: 12, afkir: 0, sisaDibuang: 1 }), { userId: s.userId }),
    ).rejects.toBeInstanceOf(ConflictError);
    // Same MATI/AFKIR, different feed leftovers → allowed.
    const updated = await updateDailyRecord(
      rec.id,
      input({ mati: 10, afkir: 0, sisaDibuang: 2.5 }),
      { userId: s.userId },
    );
    expect(updated.sisaDibuang.toNumber()).toBe(2.5);
    expect(updated.hidup).toBe(990); // HIDUP untouched by the edit
  });
});
