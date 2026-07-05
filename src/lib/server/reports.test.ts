import { beforeEach, describe, expect, it } from "vitest";

import { IngredientCategory, MixLineKind, Role, SalesStatus, SizeHealthGrade } from "@/generated/prisma/enums";
import { prisma } from "@/lib/server/db";
import { createCollection } from "@/lib/server/collections";
import { createDailyRecord } from "@/lib/server/dailyRecords";
import { createFarmhouse } from "@/lib/server/farmhouses";
import { createFlock } from "@/lib/server/flocks";
import { submitGrading } from "@/lib/server/grading";
import { recordDelivery } from "@/lib/server/ingredientLedger";
import { createMixing } from "@/lib/server/mixing";
import { reportToXlsx } from "@/lib/server/reportExport";
import {
  buyerDailySalesReport,
  crackedRateReport,
  dailyCollectionReport,
  getDashboardKpis,
  gradeDistributionReport,
  gradingCompletionReport,
  reportsForRole,
  warehouseStockReport,
} from "@/lib/server/reports";

import { resetDb } from "../../../test/helpers";

beforeEach(resetDb);

const D = (s: string) => new Date(`${s}T00:00:00Z`);
const CHICK_IN = D("2026-06-01");
const TODAY = D("2026-07-06");

// A full one-day world so every §8.2 KPI has real data to aggregate.
async function seedWorld() {
  const user = await prisma.user.create({
    data: { name: "Admin", username: "admin", passwordHash: "x", role: Role.ADMIN },
  });
  const wh = await prisma.warehouse.create({ data: { name: "A", code: "WH-A" } });
  const normal = await prisma.gradeType.create({ data: { name: "Normal", sortOrder: 1 } });
  const farmhouse = await createFarmhouse({
    name: "K1", code: "K1", warehouseId: wh.id, maxBatchesPerDay: 2, changedById: user.id, today: CHICK_IN,
  });
  await createFlock(
    { strain: "Lohmann", chickInDate: CHICK_IN, placementAge: 100, placements: [{ farmhouseId: farmhouse.id, populasiAwal: 1000 }] },
    { userId: user.id },
  );

  // Collection today: total 900+50+30+13 = 993; Angkat Rak 90 (Normal).
  await createCollection(
    { farmhouseId: farmhouse.id, date: TODAY, batchNumber: 1 },
    { goodEggs: 900, telurRetak: 50, telurLunak: 30, telurKosong: 13, lifts: [{ typeGradeId: normal.id, quantity: 90 }] },
    { userId: user.id },
  );
  // Grade batch 1 (available = 900 − 90 = 810 ≥ 360): A 300 + Retak 40 + Plastik 20.
  await submitGrading(
    { farmhouseId: farmhouse.id, date: TODAY, batchNumber: 1 },
    {
      lines: [
        { sizeHealthGrade: SizeHealthGrade.A, typeGradeId: normal.id, quantity: 300 },
        { sizeHealthGrade: SizeHealthGrade.RETAK, typeGradeId: normal.id, quantity: 40 },
        { sizeHealthGrade: SizeHealthGrade.PLASTIK, typeGradeId: normal.id, quantity: 20 },
      ],
    },
    { userId: user.id },
  );

  // Feed: mix 100 kg today (HIDUP 1000 × 100 g / 1000).
  const konsentrat = await prisma.ingredient.create({ data: { name: "Konsentrat", category: IngredientCategory.KONSENTRAT } });
  await recordDelivery({ ingredientId: konsentrat.id, quantity: 500, enteredById: user.id });
  await createMixing(
    { farmhouseId: farmhouse.id, date: TODAY, projectedIntake: 100 },
    [{ ingredientId: konsentrat.id, kind: MixLineKind.MAIN_PERCENT, percent: 100 }],
    { userId: user.id },
  );

  // Daily record today: MATI 5 + AFKIR 2 → HIDUP 993; HD% = 993/993 = 100; FCR = 100/50 = 2.
  await createDailyRecord(
    { farmhouseId: farmhouse.id, date: TODAY },
    { mati: 5, afkir: 2, sisaDigunakan: 0, sisaDibuang: 0, beratTelur: 50 },
    { userId: user.id },
  );

  // A sale today (seeded directly — the KPI just sums line quantities).
  const buyer = await prisma.buyer.create({ data: { name: "Toko Budi" } });
  await prisma.salesTransaction.create({
    data: {
      date: TODAY, warehouseId: wh.id, buyerId: buyer.id, status: SalesStatus.ACTIVE, enteredById: user.id,
      lineItems: { create: [{ sizeHealthGrade: SizeHealthGrade.A, typeGradeId: normal.id, quantity: 100, unitUsed: "PCS" }] },
    },
  });

  return { normalId: normal.id, buyerName: buyer.name };
}

describe("dashboard KPIs (SRS §8.2) — worked examples", () => {
  it("aggregates every KPI card correctly for the day", async () => {
    const w = await seedWorld();
    const k = await getDashboardKpis(TODAY);

    expect(k.eggsCollected).toMatchObject({ today: 993, goodToday: 900 });
    expect(k.angkatRak.today).toBe(90);
    expect(k.angkatRak.byType).toEqual([{ typeGradeId: w.normalId, typeName: "Normal", quantity: 90 }]);
    expect(k.crackedPct.today).toBe(8.06); // (50+30)/993 × 100
    expect(k.kosong.today).toBe(13);
    expect(k.gradingCompletion).toEqual({ batches: 1, graded: 1, pct: 100 });
    expect(k.warehouseStock.totalPcs).toBe(450); // 300 + 40 + 20 + 90 Angkat Rak
    expect(k.batchesPendingCollection).toBe(1); // max 2 − 1 entered
    expect(k.eggsSold.today).toBe(100);
    expect(k.topBuyersThisWeek).toEqual([{ buyerId: expect.any(String), buyerName: "Toko Budi", quantity: 100 }]);
    expect(k.typeBreakdown.productionToday).toEqual([{ typeGradeId: w.normalId, typeName: "Normal", quantity: 360 }]);
    expect(k.typeBreakdown.stock).toEqual([{ typeGradeId: w.normalId, typeName: "Normal", quantity: 450 }]);
    expect(k.mortality).toEqual({ mati: 5, afkir: 2, hidup: 993 });
    expect(k.avgHdPercent).toBe(100);
    expect(k.avgFcr).toBe(2);
    expect(k.feedMixedKg).toBe(100);
  });

  it("is empty/zeroed on a day with no activity (no crashes, no NaN)", async () => {
    const k = await getDashboardKpis(D("2026-07-20"));
    expect(k.eggsCollected.today).toBe(0);
    expect(k.crackedPct.today).toBe(0);
    expect(k.gradingCompletion.pct).toBe(0);
    expect(k.avgHdPercent).toBe(0);
    expect(k.avgFcr).toBeNull();
    expect(k.feedMixedKg).toBe(0);
    expect(k.topBuyersThisWeek).toEqual([]);
  });
});

describe("§8.1 report loaders — worked examples", () => {
  it("daily collection, cracked rate, grade distribution, grading completion, stock, buyer sales", async () => {
    await seedWorld();

    const collection = await dailyCollectionReport({ date: TODAY });
    expect(collection.rows).toEqual([["K1", 1, 900, 50, 30, 13, 90]]);

    const cracked = await crackedRateReport({ from: TODAY, to: TODAY });
    expect(cracked.rows[0]).toEqual(["K1 (K1)", 993, 80, "8.06%"]);

    const dist = await gradeDistributionReport({ from: TODAY, to: TODAY });
    expect(dist.rows[0]).toEqual(["A", "Normal", 300, "10 rak + 0 pcs"]); // sorted by pcs desc

    const completion = await gradingCompletionReport({ date: TODAY });
    expect(completion.rows).toEqual([["K1", 1, "SUBMITTED"]]);

    const stock = await warehouseStockReport({});
    expect(stock.rows.reduce((s, r) => s + Number(r[3]), 0)).toBe(450); // A 300 + Retak 40 + Plastik 20 + Angkat Rak 90

    const buyerSales = await buyerDailySalesReport({ date: TODAY });
    expect(buyerSales.rows).toEqual([["Toko Budi", "A", "Normal", 100, "3 rak + 10 pcs"]]);
  });
});

describe("report access (SRS §8.1 roles)", () => {
  it("gates each report to its access role — correction audit is Superadmin only", () => {
    const slugs = (role: Role) => reportsForRole(role).map((r) => r.slug);
    const owner = slugs(Role.OWNER);
    expect(owner).toEqual(expect.arrayContaining(["daily-collection", "warehouse-stock", "vaksin-log", "grade-distribution"]));
    expect(owner).not.toContain("stock-movement-ledger");
    expect(owner).not.toContain("sales-transaction-log");
    expect(owner).not.toContain("correction-audit");

    const admin = slugs(Role.ADMIN);
    expect(admin).toEqual(expect.arrayContaining(["stock-movement-ledger", "sales-transaction-log", "ovk-pemakaian"]));
    expect(admin).not.toContain("correction-audit"); // Superadmin only

    expect(slugs(Role.SUPERADMIN)).toContain("correction-audit");
  });
});

describe("report export", () => {
  it("produces a well-formed .xlsx (ZIP) file", async () => {
    const buf = await reportToXlsx("Sales", {
      columns: [{ label: "Buyer" }, { label: "Pcs", numeric: true }],
      rows: [["Toko Budi", 100], ["Toko Sari", 250]],
    });
    expect(buf.length).toBeGreaterThan(100);
    expect(buf.subarray(0, 2).toString("latin1")).toBe("PK"); // xlsx is a ZIP container
  });
});
