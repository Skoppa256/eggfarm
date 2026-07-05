import { redirect } from "next/navigation";

import { businessToday, formatDateOnly } from "@/lib/dates";
import { getSessionUser } from "@/lib/server/auth";
import { getDashboardKpis } from "@/lib/server/reports";
import { formatPcs } from "@/lib/units";

export const dynamic = "force-dynamic";

const fieldClass =
  "rounded border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900";

function Card({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: "amber" | "rose";
}) {
  const toneClass =
    tone === "rose" ? "text-rose-600" : tone === "amber" ? "text-amber-600" : "text-zinc-900 dark:text-zinc-100";
  return (
    <div className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
      <div className="text-xs font-medium uppercase tracking-wide text-zinc-500">{label}</div>
      <div className={`mt-1 text-xl font-semibold tabular-nums ${toneClass}`}>{value}</div>
      {sub && <div className="mt-0.5 text-xs text-zinc-500">{sub}</div>}
    </div>
  );
}

const signed = (n: number, unit = "") => `${n >= 0 ? "+" : ""}${n}${unit}`;

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  // Dashboard is viewable by every role (Owner's home). No write paths here.

  const sp = await searchParams;
  const dateStr =
    sp.date && /^\d{4}-\d{2}-\d{2}$/.test(sp.date) ? sp.date : formatDateOnly(businessToday());
  const k = await getDashboardKpis(new Date(`${dateStr}T00:00:00Z`));

  const crackedDelta = Math.round((k.crackedPct.today - k.crackedPct.yesterday) * 100) / 100;
  const kosongDelta = k.kosong.today - k.kosong.yesterday;
  const typeLine = (rows: { typeName: string; quantity: number }[]) =>
    rows.length ? rows.map((r) => `${r.typeName} ${formatPcs(r.quantity)}`).join(" · ") : "—";

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-6 sm:p-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
          <p className="text-sm text-zinc-500">At-a-glance KPIs for {dateStr} (WITA business day).</p>
        </div>
        <form method="get" className="flex items-end gap-2">
          <label className="flex flex-col gap-1 text-sm font-medium">
            Day
            <input type="date" name="date" defaultValue={dateStr} className={fieldClass} />
          </label>
          <button
            type="submit"
            className="rounded bg-zinc-900 px-3 py-2 text-sm font-semibold text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900"
          >
            View
          </button>
        </form>
      </header>

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Card
          label="Eggs collected today"
          value={formatPcs(k.eggsCollected.today)}
          sub={`Good ${formatPcs(k.eggsCollected.goodToday)} · yst ${formatPcs(k.eggsCollected.yesterday)}`}
        />
        <Card label="Angkat Rak today" value={formatPcs(k.angkatRak.today)} sub={typeLine(k.angkatRak.byType)} />
        <Card
          label="Cracked % today"
          value={`${k.crackedPct.today.toFixed(2)}%`}
          sub={`${signed(crackedDelta)} pts vs yst`}
          tone={crackedDelta > 0 ? "rose" : undefined}
        />
        <Card
          label="Telur Kosong today"
          value={String(k.kosong.today)}
          sub={`${signed(kosongDelta)} vs yst`}
          tone={kosongDelta > 0 ? "amber" : undefined}
        />
        <Card
          label="Grading completion"
          value={`${k.gradingCompletion.pct.toFixed(0)}%`}
          sub={`${k.gradingCompletion.graded}/${k.gradingCompletion.batches} batches graded`}
        />
        <Card label="Batches pending collection" value={String(k.batchesPendingCollection)} sub="expected − entered today" />
        <Card label="Warehouse stock" value={formatPcs(k.warehouseStock.totalPcs)} sub="across all warehouses" />
        <Card label="Eggs sold today" value={formatPcs(k.eggsSold.today)} sub="active sales" />
        <Card
          label="Feed mixed today"
          value={`${k.feedMixedKg} kg`}
          sub="total PAKAN MASUK"
        />
        <Card
          label="Flock mortality today"
          value={String(k.mortality.mati + k.mortality.afkir)}
          sub={`MATI ${k.mortality.mati} · AFKIR ${k.mortality.afkir} · HIDUP ${k.mortality.hidup}`}
          tone={k.mortality.mati + k.mortality.afkir > 0 ? "amber" : undefined}
        />
        <Card label="Average HD% today" value={`${k.avgHdPercent.toFixed(2)}%`} sub="across active placements" />
        <Card label="Average daily FCR" value={k.avgFcr != null ? k.avgFcr.toFixed(3) : "—"} sub="intake ÷ egg mass" />
        <Card label="Production by Type today" value={typeLine(k.typeBreakdown.productionToday)} sub="graded, by Type" />
        <Card label="Stock by Type" value={typeLine(k.typeBreakdown.stock)} sub="current warehouse stock" />
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold text-zinc-500">Top buyers this week (last 7 days)</h2>
        <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
          <table className="w-full text-left text-sm">
            <thead className="bg-zinc-50 text-xs uppercase tracking-wide text-zinc-500 dark:bg-zinc-900">
              <tr>
                <th className="px-4 py-2">#</th>
                <th className="px-4 py-2">Buyer</th>
                <th className="px-4 py-2 text-right">Volume</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {k.topBuyersThisWeek.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-4 py-3 text-zinc-500">
                    No sales this week.
                  </td>
                </tr>
              )}
              {k.topBuyersThisWeek.map((b, i) => (
                <tr key={b.buyerId}>
                  <td className="px-4 py-2 tabular-nums">{i + 1}</td>
                  <td className="px-4 py-2 font-medium">{b.buyerName}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{formatPcs(b.quantity)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
