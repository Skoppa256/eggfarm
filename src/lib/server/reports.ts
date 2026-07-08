import "server-only";

import { GradingStatus, RecordStatus, type Role, SalesStatus, type SizeHealthGrade } from "@/generated/prisma/enums";
import { addDays, businessToday, formatDateOnly, toBusinessDate } from "@/lib/dates";
import { computeHari, computeMinggu } from "@/lib/flock";
import { gradeLabel } from "@/lib/grades";
import { prisma } from "@/lib/server/db";
import { listCorrections } from "@/lib/server/corrections";
import { resolveMaxBatches } from "@/lib/server/farmhouses";
import { getIngredientStock } from "@/lib/server/ingredientLedger";
import { getFilteredLedger } from "@/lib/server/ledger";
import { getOvkStock, pemakaianReport } from "@/lib/server/ovkLedger";
import { listVaksinLogs } from "@/lib/server/vaksin";
import { formatPcs } from "@/lib/units";

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

// ---------------------------------------------------------------------------
// §8.1 Standard reports — read-only. Each loader returns a generic ReportResult
// (columns + rows), rendered by one dynamic /reports/[report] page and exported
// verbatim. Role gating lives in the REPORTS registry below. No writes anywhere.
// ---------------------------------------------------------------------------

export interface ReportColumn {
  label: string;
  numeric?: boolean;
}
export interface ReportResult {
  columns: ReportColumn[];
  rows: (string | number)[][];
}
export interface ReportFilters {
  date?: Date;
  from?: Date;
  to?: Date;
  farmhouseId?: string;
  warehouseId?: string;
  typeGradeId?: string;
  vaksinTypeId?: string;
  buyerId?: string;
  vaccinator?: string;
}

const parseIsoDate = (s?: string): Date | undefined =>
  s && /^\d{4}-\d{2}-\d{2}$/.test(s) ? new Date(`${s}T00:00:00Z`) : undefined;

/** Build ReportFilters from a string getter (used by both the page and the export route). */
export function toReportFilters(get: (k: string) => string | undefined | null): ReportFilters {
  const s = (k: string) => {
    const v = get(k);
    return v && v.length > 0 ? v : undefined;
  };
  return {
    date: parseIsoDate(get("date") ?? undefined),
    from: parseIsoDate(get("from") ?? undefined),
    to: parseIsoDate(get("to") ?? undefined),
    farmhouseId: s("farmhouseId"),
    warehouseId: s("warehouseId"),
    typeGradeId: s("typeGradeId"),
    vaksinTypeId: s("vaksinTypeId"),
    buyerId: s("buyerId"),
    vaccinator: s("vaccinator"),
  };
}

const dec = (v: unknown, dp = 3): string => (v == null ? "0" : Number(v).toFixed(dp));
const iso = (d: Date) => formatDateOnly(d);
const rangeOf = (f: ReportFilters) => ({
  from: f.from ? toBusinessDate(f.from) : addDays(businessToday(), -29),
  to: f.to ? toBusinessDate(f.to) : businessToday(),
});
const dayOf = (f: ReportFilters) => (f.date ? toBusinessDate(f.date) : businessToday());

async function farmhouseNames(): Promise<Map<string, string>> {
  const rows = await prisma.farmhouse.findMany({ select: { id: true, name: true, code: true } });
  return new Map(rows.map((r) => [r.id, `${r.name} (${r.code})`]));
}
async function typeNames(): Promise<Map<string, string>> {
  const rows = await prisma.gradeType.findMany({ select: { id: true, name: true } });
  return new Map(rows.map((r) => [r.id, r.name]));
}

// 1. Daily Collection Summary — eggs per kandang per batch for a date.
export async function dailyCollectionReport(f: ReportFilters): Promise<ReportResult> {
  const date = dayOf(f);
  const rows = await prisma.collectionRecord.findMany({
    where: { date, ...(f.farmhouseId ? { farmhouseId: f.farmhouseId } : {}) },
    include: { farmhouse: { select: { code: true } }, angkatRakLifts: { select: { quantity: true } } },
    orderBy: [{ farmhouse: { code: "asc" } }, { batchNumber: "asc" }],
  });
  return {
    columns: [
      { label: "Kandang" }, { label: "Batch", numeric: true }, { label: "Bagus", numeric: true },
      { label: "Retak", numeric: true }, { label: "Lunak", numeric: true }, { label: "Kosong", numeric: true },
      { label: "Angkat Rak", numeric: true },
    ],
    rows: rows.map((r) => [
      r.farmhouse.code, r.batchNumber, r.goodEggs, r.telurRetak, r.telurLunak, r.telurKosong,
      r.angkatRakLifts.reduce((s, l) => s + l.quantity, 0),
    ]),
  };
}

// 2. Cracked Egg Rate — (Retak+Lunak)/total, per kandang over a period.
export async function crackedRateReport(f: ReportFilters): Promise<ReportResult> {
  const { from, to } = rangeOf(f);
  const grouped = await prisma.collectionRecord.groupBy({
    by: ["farmhouseId"],
    where: { date: { gte: from, lte: to }, ...(f.farmhouseId ? { farmhouseId: f.farmhouseId } : {}) },
    _sum: { goodEggs: true, telurRetak: true, telurLunak: true, telurKosong: true },
  });
  const names = await farmhouseNames();
  return {
    columns: [
      { label: "Kandang" }, { label: "Total terkumpul", numeric: true }, { label: "Retak + Lunak", numeric: true },
      { label: "Retak %", numeric: true },
    ],
    rows: grouped
      .map((g) => {
        const total = num(g._sum.goodEggs) + num(g._sum.telurRetak) + num(g._sum.telurLunak) + num(g._sum.telurKosong);
        const cracked = num(g._sum.telurRetak) + num(g._sum.telurLunak);
        const pct = total > 0 ? Math.round((cracked / total) * 10000) / 100 : 0;
        return [names.get(g.farmhouseId) ?? g.farmhouseId, total, cracked, `${pct.toFixed(2)}%`];
      })
      .sort((a, b) => String(a[0]).localeCompare(String(b[0]))),
  };
}

// 3. Telur Kosong — empty-shell totals per kandang over a period.
export async function telurKosongReport(f: ReportFilters): Promise<ReportResult> {
  const { from, to } = rangeOf(f);
  const grouped = await prisma.collectionRecord.groupBy({
    by: ["farmhouseId"],
    where: { date: { gte: from, lte: to }, ...(f.farmhouseId ? { farmhouseId: f.farmhouseId } : {}) },
    _sum: { telurKosong: true },
  });
  const names = await farmhouseNames();
  return {
    columns: [{ label: "Kandang" }, { label: "Telur Kosong", numeric: true }],
    rows: grouped
      .map((g) => [names.get(g.farmhouseId) ?? g.farmhouseId, num(g._sum.telurKosong)])
      .sort((a, b) => String(a[0]).localeCompare(String(b[0]))),
  };
}

// 4. Grade Distribution — pcs per Size & Health grade × Type over a period.
export async function gradeDistributionReport(f: ReportFilters): Promise<ReportResult> {
  const { from, to } = rangeOf(f);
  const grouped = await prisma.gradingLineItem.groupBy({
    by: ["sizeHealthGrade", "typeGradeId"],
    where: {
      gradingRecord: { date: { gte: from, lte: to }, status: GradingStatus.SUBMITTED },
      ...(f.typeGradeId ? { typeGradeId: f.typeGradeId } : {}),
    },
    _sum: { quantity: true },
  });
  const tn = await typeNames();
  return {
    columns: [{ label: "Grade" }, { label: "Tipe" }, { label: "Pcs", numeric: true }, { label: "Rak + pcs" }],
    rows: grouped
      .map((g) => [
        gradeLabel(g.sizeHealthGrade as SizeHealthGrade), tn.get(g.typeGradeId) ?? g.typeGradeId,
        num(g._sum.quantity), formatPcs(num(g._sum.quantity)),
      ])
      .sort((a, b) => Number(b[2]) - Number(a[2])),
  };
}

// 5. Angkat Rak — pcs per kandang × Type over a period.
export async function angkatRakReport(f: ReportFilters): Promise<ReportResult> {
  const { from, to } = rangeOf(f);
  const lifts = await prisma.angkatRakLift.findMany({
    where: { collectionRecord: { date: { gte: from, lte: to }, ...(f.farmhouseId ? { farmhouseId: f.farmhouseId } : {}) } },
    include: { collectionRecord: { select: { farmhouseId: true } }, gradeType: { select: { name: true } } },
  });
  const names = await farmhouseNames();
  const agg = new Map<string, number>();
  for (const l of lifts) {
    const key = `${l.collectionRecord.farmhouseId}|${l.gradeType.name}`;
    agg.set(key, (agg.get(key) ?? 0) + l.quantity);
  }
  return {
    columns: [{ label: "Kandang" }, { label: "Tipe" }, { label: "Angkat Rak (pcs)", numeric: true }, { label: "Rak + pcs" }],
    rows: [...agg.entries()]
      .map(([key, qty]) => {
        const [fid, type] = key.split("|");
        return [names.get(fid) ?? fid, type, qty, formatPcs(qty)];
      })
      .sort((a, b) => Number(b[2]) - Number(a[2])),
  };
}

// 6. Warehouse Stock — current stock per warehouse × Egg SKU (rak+pcs).
export async function warehouseStockReport(f: ReportFilters): Promise<ReportResult> {
  const rows = await prisma.warehouseStock.findMany({
    where: { currentQuantity: { gt: 0 }, ...(f.warehouseId ? { warehouseId: f.warehouseId } : {}) },
    include: { warehouse: { select: { code: true } }, gradeType: { select: { name: true } } },
    orderBy: [{ warehouse: { code: "asc" } }, { sizeHealthGrade: "asc" }],
  });
  return {
    columns: [
      { label: "Gudang" }, { label: "Grade" }, { label: "Tipe" }, { label: "Pcs", numeric: true }, { label: "Rak + pcs" },
    ],
    rows: rows.map((r) => [
      r.warehouse.code, gradeLabel(r.sizeHealthGrade as SizeHealthGrade), r.gradeType.name,
      r.currentQuantity, formatPcs(r.currentQuantity),
    ]),
  };
}

// 7. Kandang Comparison — production side-by-side over a period.
export async function kandangComparisonReport(f: ReportFilters): Promise<ReportResult> {
  const { from, to } = rangeOf(f);
  const grouped = await prisma.collectionRecord.groupBy({
    by: ["farmhouseId"],
    where: { date: { gte: from, lte: to } },
    _sum: { goodEggs: true, telurRetak: true, telurLunak: true, telurKosong: true },
  });
  const names = await farmhouseNames();
  return {
    columns: [{ label: "Kandang" }, { label: "Telur Bagus", numeric: true }, { label: "Total terkumpul", numeric: true }],
    rows: grouped
      .map((g) => {
        const total = num(g._sum.goodEggs) + num(g._sum.telurRetak) + num(g._sum.telurLunak) + num(g._sum.telurKosong);
        return [names.get(g.farmhouseId) ?? g.farmhouseId, num(g._sum.goodEggs), total];
      })
      .sort((a, b) => Number(b[2]) - Number(a[2])),
  };
}

// 8. Grading Completion — per (kandang, batch) for a date: collected vs graded.
export async function gradingCompletionReport(f: ReportFilters): Promise<ReportResult> {
  const date = dayOf(f);
  const [collections, gradings] = await Promise.all([
    prisma.collectionRecord.findMany({
      where: { date }, include: { farmhouse: { select: { code: true } } },
      orderBy: [{ farmhouse: { code: "asc" } }, { batchNumber: "asc" }],
    }),
    prisma.gradingRecord.findMany({ where: { date }, select: { farmhouseId: true, batchNumber: true, status: true } }),
  ]);
  const gmap = new Map(gradings.map((g) => [`${g.farmhouseId}|${g.batchNumber}`, g.status]));
  return {
    columns: [{ label: "Kandang" }, { label: "Batch", numeric: true }, { label: "Grading" }],
    rows: collections.map((c) => [
      c.farmhouse.code, c.batchNumber, gmap.get(`${c.farmhouseId}|${c.batchNumber}`) ?? "PENDING",
    ]),
  };
}

// 9. Buyer Daily Sales — per buyer × SKU for a date.
export async function buyerDailySalesReport(f: ReportFilters): Promise<ReportResult> {
  const date = dayOf(f);
  const txns = await prisma.salesTransaction.findMany({
    where: { date, status: SalesStatus.ACTIVE, ...(f.buyerId ? { buyerId: f.buyerId } : {}) },
    include: { buyer: { select: { name: true } }, lineItems: { include: { gradeType: { select: { name: true } } } } },
  });
  const rows: (string | number)[][] = [];
  for (const t of txns) {
    for (const l of t.lineItems) {
      rows.push([
        t.buyer.name, gradeLabel(l.sizeHealthGrade as SizeHealthGrade), l.gradeType.name, l.quantity, formatPcs(l.quantity),
      ]);
    }
  }
  return {
    columns: [{ label: "Pembeli" }, { label: "Grade" }, { label: "Tipe" }, { label: "Pcs", numeric: true }, { label: "Rak + pcs" }],
    rows,
  };
}

// 10. Buyer Weekly Sales — per-buyer totals over a period.
export async function buyerWeeklySalesReport(f: ReportFilters): Promise<ReportResult> {
  const from = f.from ? toBusinessDate(f.from) : addDays(businessToday(), -6);
  const to = f.to ? toBusinessDate(f.to) : businessToday();
  const txns = await prisma.salesTransaction.findMany({
    where: { date: { gte: from, lte: to }, status: SalesStatus.ACTIVE },
    include: { buyer: { select: { name: true } }, lineItems: { select: { quantity: true } } },
  });
  const agg = new Map<string, number>();
  for (const t of txns) agg.set(t.buyer.name, (agg.get(t.buyer.name) ?? 0) + t.lineItems.reduce((s, l) => s + l.quantity, 0));
  return {
    columns: [{ label: "Pembeli" }, { label: "Pcs", numeric: true }, { label: "Rak + pcs" }],
    rows: [...agg.entries()].map(([name, q]) => [name, q, formatPcs(q)]).sort((a, b) => Number(b[1]) - Number(a[1])),
  };
}

// 11. Daily Farmhouse Record — per kandang per day over a period.
export async function dailyFarmhouseRecordReport(f: ReportFilters): Promise<ReportResult> {
  const { from, to } = rangeOf(f);
  const rows = await prisma.dailyRecord.findMany({
    where: { date: { gte: from, lte: to }, ...(f.farmhouseId ? { farmhouseId: f.farmhouseId } : {}) },
    include: { farmhouse: { select: { code: true } }, placement: { include: { flock: { select: { placementAge: true, chickInDate: true } } } } },
    orderBy: [{ date: "asc" }, { farmhouse: { code: "asc" } }],
  });
  return {
    columns: [
      { label: "Tanggal" }, { label: "Kandang" }, { label: "HARI", numeric: true }, { label: "MINGGU", numeric: true },
      { label: "HIDUP", numeric: true }, { label: "MATI", numeric: true }, { label: "AFKIR", numeric: true },
      { label: "HD%", numeric: true }, { label: "MASUK kg", numeric: true }, { label: "INTAKE kg", numeric: true },
      { label: "FCR", numeric: true },
    ],
    rows: rows.map((r) => {
      const hari = computeHari(r.placement.flock.placementAge, r.placement.flock.chickInDate, r.date);
      return [
        iso(r.date), r.farmhouse.code, hari, computeMinggu(hari), r.hidup, r.mati, r.afkir,
        dec(r.hdPercent, 2), r.pakanMasuk != null ? dec(r.pakanMasuk) : "—",
        r.realisasiIntake != null ? dec(r.realisasiIntake) : "—", r.fcr != null ? dec(r.fcr) : "—",
      ];
    }),
  };
}

// 12. Flock Production & Health — per kandang over a period, cumulative mortality.
export async function flockProductionHealthReport(f: ReportFilters): Promise<ReportResult> {
  const { from, to } = rangeOf(f);
  const rows = await prisma.dailyRecord.findMany({
    where: { date: { gte: from, lte: to }, ...(f.farmhouseId ? { farmhouseId: f.farmhouseId } : {}) },
    include: { farmhouse: { select: { code: true } } },
    orderBy: [{ placementId: "asc" }, { date: "asc" }],
  });
  const cum = new Map<string, number>();
  return {
    columns: [
      { label: "Tanggal" }, { label: "Kandang" }, { label: "HIDUP", numeric: true }, { label: "HD%", numeric: true },
      { label: "FCR", numeric: true }, { label: "Kumulatif MATI+AFKIR", numeric: true },
    ],
    rows: rows.map((r) => {
      const c = (cum.get(r.placementId) ?? 0) + r.mati + r.afkir;
      cum.set(r.placementId, c);
      return [iso(r.date), r.farmhouse.code, r.hidup, dec(r.hdPercent, 2), r.fcr != null ? dec(r.fcr) : "—", c];
    }),
  };
}

// 13. Feed Consumption — per kandang per day over a period.
export async function feedConsumptionReport(f: ReportFilters): Promise<ReportResult> {
  const { from, to } = rangeOf(f);
  const rows = await prisma.dailyRecord.findMany({
    where: { date: { gte: from, lte: to }, ...(f.farmhouseId ? { farmhouseId: f.farmhouseId } : {}) },
    include: { farmhouse: { select: { code: true } } },
    orderBy: [{ date: "asc" }, { farmhouse: { code: "asc" } }],
  });
  return {
    columns: [
      { label: "Tanggal" }, { label: "Kandang" }, { label: "MASUK kg", numeric: true }, { label: "TERSEDIA kg", numeric: true },
      { label: "SISA dig. kg", numeric: true }, { label: "SISA dib. kg", numeric: true }, { label: "INTAKE kg", numeric: true },
      { label: "GRAM/EKOR", numeric: true },
    ],
    rows: rows.map((r) => [
      iso(r.date), r.farmhouse.code, r.pakanMasuk != null ? dec(r.pakanMasuk) : "—",
      r.pakanTersedia != null ? dec(r.pakanTersedia) : "—", dec(r.sisaDigunakan), dec(r.sisaDibuang),
      r.realisasiIntake != null ? dec(r.realisasiIntake) : "—", r.gramPerEkor != null ? dec(r.gramPerEkor, 2) : "—",
    ]),
  };
}

// 14. Vaksin Log — filterable.
export async function vaksinLogReport(f: ReportFilters): Promise<ReportResult> {
  const logs = await listVaksinLogs({
    from: f.from, to: f.to, farmhouseId: f.farmhouseId, vaksinTypeId: f.vaksinTypeId, vaccinator: f.vaccinator,
  });
  return {
    columns: [{ label: "Tanggal" }, { label: "Vaksin" }, { label: "Kandang" }, { label: "Vial", numeric: true }, { label: "Vaksinator" }],
    rows: logs.map((l) => [iso(l.date), l.vaksinType.name, l.farmhouse.code, l.vials, l.vaccinator]),
  };
}

// 15. Stock Movement Ledger — Admin/SA.
export async function stockMovementLedgerReport(f: ReportFilters): Promise<ReportResult> {
  const first = await prisma.warehouse.findFirst({ orderBy: { code: "asc" }, select: { id: true } });
  const warehouseId = f.warehouseId ?? first?.id;
  if (!warehouseId) return { columns: [{ label: "Gudang" }], rows: [] };
  const moves = await getFilteredLedger({ warehouseId, from: f.from, to: f.to, typeGradeId: f.typeGradeId, limit: 500 });
  return {
    columns: [
      { label: "Tanggal" }, { label: "Grade" }, { label: "Tipe" }, { label: "Mutasi" }, { label: "Jumlah pcs", numeric: true },
      { label: "Sumber" }, { label: "Alasan" },
    ],
    rows: moves.map((m) => [
      iso(m.date), gradeLabel(m.sizeHealthGrade as SizeHealthGrade), m.gradeType.name, m.movementType,
      m.quantity, m.sourceType, m.reason ?? "",
    ]),
  };
}

// 16. Stock Correction Audit — Superadmin only.
export async function correctionAuditReport(f: ReportFilters): Promise<ReportResult> {
  const corr = await listCorrections(f.warehouseId);
  return {
    columns: [
      { label: "Tanggal" }, { label: "Gudang" }, { label: "Grade" }, { label: "Tipe" }, { label: "Sebelum", numeric: true },
      { label: "Sesudah", numeric: true }, { label: "Selisih", numeric: true }, { label: "Alasan" }, { label: "Pengguna" },
    ],
    rows: corr.map((c) => [
      iso(c.date), c.warehouse.code, gradeLabel(c.sizeHealthGrade as SizeHealthGrade), c.gradeType.name,
      c.preQuantity, c.postQuantity, c.postQuantity - c.preQuantity, c.reason ?? "", c.enteredBy.name,
    ]),
  };
}

// 17. Sales Transaction Log — Admin/SA.
export async function salesTransactionLogReport(f: ReportFilters): Promise<ReportResult> {
  const { from, to } = rangeOf(f);
  const txns = await prisma.salesTransaction.findMany({
    where: { date: { gte: from, lte: to }, ...(f.buyerId ? { buyerId: f.buyerId } : {}), ...(f.warehouseId ? { warehouseId: f.warehouseId } : {}) },
    include: { buyer: { select: { name: true } }, warehouse: { select: { code: true } }, lineItems: { select: { quantity: true } } },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
  });
  return {
    columns: [
      { label: "Tanggal" }, { label: "Pembeli" }, { label: "Gudang" }, { label: "Status" }, { label: "Baris", numeric: true },
      { label: "Total pcs", numeric: true },
    ],
    rows: txns.map((t) => [
      iso(t.date), t.buyer.name, t.warehouse.code, t.status, t.lineItems.length, t.lineItems.reduce((s, l) => s + l.quantity, 0),
    ]),
  };
}

// 18. Feed Ingredient Stock — Admin/SA.
export async function feedIngredientStockReport(): Promise<ReportResult> {
  const stock = await getIngredientStock();
  return {
    columns: [{ label: "Bahan Pakan" }, { label: "Kategori" }, { label: "Tersedia kg", numeric: true }],
    rows: stock.map((s) => [s.ingredient.name, s.ingredient.category, dec(s.currentQuantity)]),
  };
}

// 19. OVK Stock — Admin/SA.
export async function ovkStockReport(): Promise<ReportResult> {
  const stock = await getOvkStock();
  return {
    columns: [{ label: "Item" }, { label: "Kategori" }, { label: "Tersedia" }, { label: "Satuan" }],
    rows: stock.map((s) => [s.ovkItem.name, s.ovkItem.category, dec(s.currentQuantity), s.ovkItem.baseUnit]),
  };
}

// 20. OVK Usage (Pemakaian) — Admin/SA. Requires a kandang.
export async function ovkPemakaianReportView(f: ReportFilters): Promise<ReportResult> {
  if (!f.farmhouseId) return { columns: [{ label: "Kandang" }], rows: [] };
  const rows = await pemakaianReport(f.farmhouseId, f.from, f.to);
  return {
    columns: [{ label: "Tanggal" }, { label: "Item" }, { label: "Jumlah keluar", numeric: true }, { label: "Satuan" }, { label: "Catatan" }],
    rows: rows.map((r) => [iso(r.date), r.ovkItem.name, dec(r.enteredQuantity), r.unitUsed, r.note ?? ""]),
  };
}

// The registry: slug → title, roles, filter controls, and loader. One authoritative
// place for §8.1 access roles (rule 5.5 read-side): correction audit is Superadmin only;
// operational ledgers are Admin/Superadmin; the rest are Owner-viewable.
const OWNER: Role[] = ["OWNER", "ADMIN", "SUPERADMIN"];
const OPS: Role[] = ["ADMIN", "SUPERADMIN"];
const SA: Role[] = ["SUPERADMIN"];

export type FilterKey = keyof ReportFilters;

export interface ReportMeta {
  slug: string;
  title: string;
  description: string;
  roles: Role[];
  filters: FilterKey[];
  load: (f: ReportFilters) => Promise<ReportResult>;
}

export const REPORTS: ReportMeta[] = [
  { slug: "daily-collection", title: "Ringkasan Pengambilan Harian", description: "Telur per kandang per batch untuk satu hari.", roles: OWNER, filters: ["date", "farmhouseId"], load: dailyCollectionReport },
  { slug: "cracked-rate", title: "Tingkat Telur Retak", description: "(Retak + Lunak) / total terkumpul, per kandang.", roles: OWNER, filters: ["from", "to", "farmhouseId"], load: crackedRateReport },
  { slug: "telur-kosong", title: "Telur Kosong", description: "Total cangkang kosong per kandang (produktivitas ayam).", roles: OWNER, filters: ["from", "to", "farmhouseId"], load: telurKosongReport },
  { slug: "grade-distribution", title: "Distribusi Grade", description: "Volume per grade Size & Health × Tipe.", roles: OWNER, filters: ["from", "to", "typeGradeId"], load: gradeDistributionReport },
  { slug: "angkat-rak", title: "Angkat Rak", description: "Volume Angkat Rak per kandang × Tipe.", roles: OWNER, filters: ["from", "to", "farmhouseId"], load: angkatRakReport },
  { slug: "warehouse-stock", title: "Stok Gudang", description: "Stok terkini per gudang × SKU Telur (rak + pcs).", roles: OWNER, filters: ["warehouseId"], load: warehouseStockReport },
  { slug: "kandang-comparison", title: "Perbandingan Kandang", description: "Produksi berdampingan antar kandang.", roles: OWNER, filters: ["from", "to"], load: kandangComparisonReport },
  { slug: "grading-completion", title: "Penyelesaian Grading", description: "Batch mana yang sudah di-grading vs tertunda untuk satu hari.", roles: OWNER, filters: ["date"], load: gradingCompletionReport },
  { slug: "buyer-daily-sales", title: "Penjualan Harian Pembeli", description: "Per pembeli × SKU untuk satu hari.", roles: OWNER, filters: ["date", "buyerId"], load: buyerDailySalesReport },
  { slug: "buyer-weekly-sales", title: "Penjualan Mingguan Pembeli", description: "Total per pembeli dalam satu periode.", roles: OWNER, filters: ["from", "to"], load: buyerWeeklySalesReport },
  { slug: "daily-farmhouse-record", title: "Catatan Kandang Harian", description: "Per kandang per hari: HARI/HIDUP/HD%/pakan/FCR.", roles: OWNER, filters: ["from", "to", "farmhouseId"], load: dailyFarmhouseRecordReport },
  { slug: "flock-production-health", title: "Produksi & Kesehatan Flock", description: "HD%/FCR + kematian kumulatif per kandang.", roles: OWNER, filters: ["from", "to", "farmhouseId"], load: flockProductionHealthReport },
  { slug: "feed-consumption", title: "Konsumsi Pakan", description: "PAKAN MASUK/TERSEDIA/SISA/INTAKE/gram-ekor.", roles: OWNER, filters: ["from", "to", "farmhouseId"], load: feedConsumptionReport },
  { slug: "vaksin-log", title: "Log Vaksin", description: "Aktivitas vaksinasi, dapat difilter.", roles: OWNER, filters: ["from", "to", "farmhouseId", "vaksinTypeId", "vaccinator"], load: vaksinLogReport },
  { slug: "stock-movement-ledger", title: "Mutasi Stok", description: "Log masuk/keluar lengkap per gudang; koreksi ditandai.", roles: OPS, filters: ["warehouseId", "from", "to", "typeGradeId"], load: stockMovementLedgerReport },
  { slug: "sales-transaction-log", title: "Log Transaksi Penjualan", description: "Semua transaksi; yang dibatalkan ditandai.", roles: OPS, filters: ["from", "to", "buyerId", "warehouseId"], load: salesTransactionLogReport },
  { slug: "feed-ingredient-stock", title: "Stok Bahan Pakan", description: "Stok bahan pakan pusat yang tersedia.", roles: OPS, filters: [], load: feedIngredientStockReport },
  { slug: "ovk-stock", title: "Stok OVK", description: "Stok kantor terkini per item OVK.", roles: OPS, filters: [], load: ovkStockReport },
  { slug: "ovk-pemakaian", title: "Pemakaian OVK", description: "Transfer kantor→kandang per kandang.", roles: OPS, filters: ["farmhouseId", "from", "to"], load: ovkPemakaianReportView },
  { slug: "correction-audit", title: "Audit Koreksi Stok", description: "Semua koreksi: sebelum/sesudah, selisih, alasan, pengguna.", roles: SA, filters: ["warehouseId"], load: correctionAuditReport },
];

export function findReport(slug: string): ReportMeta | undefined {
  return REPORTS.find((r) => r.slug === slug);
}

/** Reports a role may access (SRS §8.1 access column). */
export function reportsForRole(role: Role): ReportMeta[] {
  return REPORTS.filter((r) => r.roles.includes(role));
}
