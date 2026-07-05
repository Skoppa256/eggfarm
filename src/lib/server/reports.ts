import "server-only";

import { GradingStatus, RecordStatus, SalesStatus } from "@/generated/prisma/enums";
import { addDays, businessToday, toBusinessDate } from "@/lib/dates";
import { prisma } from "@/lib/server/db";
import { resolveMaxBatches } from "@/lib/server/farmhouses";

// Reporting & analytics (SRS §8) — STRICTLY READ-ONLY. Nothing here writes to any table
// (rule 5.4 holds): every function reads the ledgers/records and aggregates. Prefer
// Prisma `aggregate`/`groupBy` (no N+1). Egg quantities are returned in pcs; the UI
// formats rak+pcs. Feed is kg. Dashboard "today" defaults to the current WITA business day.

// ---------------------------------------------------------------------------
// §8.2 Dashboard KPI cards
// ---------------------------------------------------------------------------

const num = (v: unknown): number => (v == null ? 0 : Number(v));

export interface TypeBreakdownRow {
  typeGradeId: string;
  typeName: string;
  quantity: number; // pcs
}

export interface DashboardKpis {
  date: Date; // the business day these KPIs are for
  /** 1. Total eggs collected today (all buckets), + yesterday for context. */
  eggsCollected: { today: number; yesterday: number; goodToday: number };
  /** 2. Angkat Rak today (pcs), split by Type. */
  angkatRak: { today: number; byType: TypeBreakdownRow[] };
  /** 3. Cracked egg % = (Retak+Lunak)/total collected × 100, today vs yesterday. */
  crackedPct: { today: number; yesterday: number };
  /** 4. Telur Kosong count today vs yesterday. */
  kosong: { today: number; yesterday: number };
  /** 5. Grading completion = submitted gradings / collection batches, today. */
  gradingCompletion: { batches: number; graded: number; pct: number };
  /** 6. Total warehouse stock across warehouses (pcs). */
  warehouseStock: { totalPcs: number };
  /** 7. Batches expected today but not yet collected (across active kandang). */
  batchesPendingCollection: number;
  /** 8. Total eggs sold today (pcs), active sales only. */
  eggsSold: { today: number };
  /** 9. Top buyers this week (last 7 business days incl. today), by pcs. */
  topBuyersThisWeek: { buyerId: string; buyerName: string; quantity: number }[];
  /** 10. Type grade breakdown — today's production (graded) and current stock, by Type. */
  typeBreakdown: { productionToday: TypeBreakdownRow[]; stock: TypeBreakdownRow[] };
  /** 11. Flock mortality today: MATI+AFKIR, and summed HIDUP across today's records. */
  mortality: { mati: number; afkir: number; hidup: number };
  /** 12. Average HD% today across today's daily records. */
  avgHdPercent: number;
  /** 13. Average daily FCR today across today's records (non-null egg-mass). */
  avgFcr: number | null;
  /** 14. Feed mixed today: total PAKAN MASUK (kg). */
  feedMixedKg: number;
}

/** Sum of all four collection buckets over a business date. */
async function collectedTotals(date: Date) {
  const agg = await prisma.collectionRecord.aggregate({
    where: { date },
    _sum: { goodEggs: true, telurRetak: true, telurLunak: true, telurKosong: true },
  });
  const good = num(agg._sum.goodEggs);
  const retak = num(agg._sum.telurRetak);
  const lunak = num(agg._sum.telurLunak);
  const kosong = num(agg._sum.telurKosong);
  return { good, retak, lunak, kosong, total: good + retak + lunak + kosong };
}

/** Every dashboard KPI (SRS §8.2) for one business day. Read-only. */
export async function getDashboardKpis(asOf: Date = businessToday()): Promise<DashboardKpis> {
  const today = toBusinessDate(asOf);
  const yesterday = addDays(today, -1);
  const weekStart = addDays(today, -6); // "this week" = the last 7 business days incl. today

  const [
    collectedToday,
    collectedYesterday,
    angkatRakByType,
    gradedBatches,
    collectionBatches,
    stockAgg,
    salesTodayAgg,
    productionByType,
    stockByType,
    mortalityAgg,
    hdAvg,
    fcrAvg,
    feedAgg,
    activeFarmhouses,
    collectionCountsByFarmhouse,
    weekSales,
  ] = await Promise.all([
    collectedTotals(today),
    collectedTotals(yesterday),
    prisma.angkatRakLift.groupBy({
      by: ["typeGradeId"],
      where: { collectionRecord: { date: today } },
      _sum: { quantity: true },
    }),
    prisma.gradingRecord.count({ where: { date: today, status: GradingStatus.SUBMITTED } }),
    prisma.collectionRecord.count({ where: { date: today } }),
    prisma.warehouseStock.aggregate({ _sum: { currentQuantity: true } }),
    prisma.salesLineItem.aggregate({
      where: { transaction: { date: today, status: SalesStatus.ACTIVE } },
      _sum: { quantity: true },
    }),
    prisma.gradingLineItem.groupBy({
      by: ["typeGradeId"],
      where: { gradingRecord: { date: today, status: GradingStatus.SUBMITTED } },
      _sum: { quantity: true },
    }),
    prisma.warehouseStock.groupBy({ by: ["typeGradeId"], _sum: { currentQuantity: true } }),
    prisma.dailyRecord.aggregate({ where: { date: today }, _sum: { mati: true, afkir: true, hidup: true } }),
    prisma.dailyRecord.aggregate({ where: { date: today }, _avg: { hdPercent: true } }),
    prisma.dailyRecord.aggregate({ where: { date: today, fcr: { not: null } }, _avg: { fcr: true } }),
    prisma.mixingRecord.aggregate({ where: { date: today }, _sum: { totalCampur: true } }),
    prisma.farmhouse.findMany({ where: { status: RecordStatus.ACTIVE }, select: { id: true } }),
    prisma.collectionRecord.groupBy({ by: ["farmhouseId"], where: { date: today }, _count: { _all: true } }),
    prisma.salesTransaction.findMany({
      where: { date: { gte: weekStart, lte: today }, status: SalesStatus.ACTIVE },
      select: { buyerId: true, buyer: { select: { name: true } }, lineItems: { select: { quantity: true } } },
    }),
  ]);

  // Type names for breakdowns.
  const typeIds = new Set<string>([
    ...angkatRakByType.map((r) => r.typeGradeId),
    ...productionByType.map((r) => r.typeGradeId),
    ...stockByType.map((r) => r.typeGradeId),
  ]);
  const typeNames = new Map(
    (await prisma.gradeType.findMany({ where: { id: { in: [...typeIds] } }, select: { id: true, name: true } })).map(
      (t) => [t.id, t.name],
    ),
  );
  const toRows = (rows: { typeGradeId: string; _sum: { quantity?: number | null; currentQuantity?: number | null } }[]) =>
    rows
      .map((r) => ({
        typeGradeId: r.typeGradeId,
        typeName: typeNames.get(r.typeGradeId) ?? r.typeGradeId,
        quantity: num(r._sum.quantity ?? r._sum.currentQuantity),
      }))
      .filter((r) => r.quantity > 0)
      .sort((a, b) => b.quantity - a.quantity);

  // Batches pending collection: expected (maxBatches today) − entered, per active kandang.
  const enteredByFarmhouse = new Map(collectionCountsByFarmhouse.map((r) => [r.farmhouseId, r._count._all]));
  let batchesPendingCollection = 0;
  for (const f of activeFarmhouses) {
    const max = (await resolveMaxBatches(f.id, today)) ?? 0;
    batchesPendingCollection += Math.max(0, max - (enteredByFarmhouse.get(f.id) ?? 0));
  }

  // Top buyers this week.
  const buyerTotals = new Map<string, { buyerName: string; quantity: number }>();
  for (const t of weekSales) {
    const q = t.lineItems.reduce((s, l) => s + l.quantity, 0);
    const prev = buyerTotals.get(t.buyerId);
    buyerTotals.set(t.buyerId, { buyerName: t.buyer.name, quantity: (prev?.quantity ?? 0) + q });
  }
  const topBuyersThisWeek = [...buyerTotals.entries()]
    .map(([buyerId, v]) => ({ buyerId, buyerName: v.buyerName, quantity: v.quantity }))
    .sort((a, b) => b.quantity - a.quantity)
    .slice(0, 5);

  const crackedPct = (c: { retak: number; lunak: number; total: number }) =>
    c.total > 0 ? Math.round(((c.retak + c.lunak) / c.total) * 10000) / 100 : 0;

  return {
    date: today,
    eggsCollected: { today: collectedToday.total, yesterday: collectedYesterday.total, goodToday: collectedToday.good },
    angkatRak: {
      today: angkatRakByType.reduce((s, r) => s + num(r._sum.quantity), 0),
      byType: toRows(angkatRakByType),
    },
    crackedPct: { today: crackedPct(collectedToday), yesterday: crackedPct(collectedYesterday) },
    kosong: { today: collectedToday.kosong, yesterday: collectedYesterday.kosong },
    gradingCompletion: {
      batches: collectionBatches,
      graded: gradedBatches,
      pct: collectionBatches > 0 ? Math.round((gradedBatches / collectionBatches) * 10000) / 100 : 0,
    },
    warehouseStock: { totalPcs: num(stockAgg._sum.currentQuantity) },
    batchesPendingCollection,
    eggsSold: { today: num(salesTodayAgg._sum.quantity) },
    topBuyersThisWeek,
    typeBreakdown: { productionToday: toRows(productionByType), stock: toRows(stockByType) },
    mortality: {
      mati: num(mortalityAgg._sum.mati),
      afkir: num(mortalityAgg._sum.afkir),
      hidup: num(mortalityAgg._sum.hidup),
    },
    avgHdPercent: hdAvg._avg.hdPercent ? Math.round(num(hdAvg._avg.hdPercent) * 100) / 100 : 0,
    avgFcr: fcrAvg._avg.fcr != null ? Math.round(num(fcrAvg._avg.fcr) * 1000) / 1000 : null,
    feedMixedKg: feedAgg._sum.totalCampur ? Math.round(num(feedAgg._sum.totalCampur) * 1000) / 1000 : 0,
  };
}
