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
          <p className="text-sm text-zinc-500">Ringkasan KPI untuk {dateStr} (hari kerja WITA).</p>
        </div>
        <form method="get" className="flex items-end gap-2">
          <label className="flex flex-col gap-1 text-sm font-medium">
            Hari
            <input type="date" name="date" defaultValue={dateStr} className={fieldClass} />
          </label>
          <button
            type="submit"
            className="rounded bg-zinc-900 px-3 py-2 text-sm font-semibold text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900"
          >
            Lihat
          </button>
        </form>
      </header>

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Card
          label="Telur diambil hari ini"
          value={formatPcs(k.eggsCollected.today)}
          sub={`Good ${formatPcs(k.eggsCollected.goodToday)} · kmrn ${formatPcs(k.eggsCollected.yesterday)}`}
        />
        <Card label="Angkat Rak hari ini" value={formatPcs(k.angkatRak.today)} sub={typeLine(k.angkatRak.byType)} />
        <Card
          label="% Retak hari ini"
          value={`${k.crackedPct.today.toFixed(2)}%`}
          sub={`${signed(crackedDelta)} poin vs kmrn`}
          tone={crackedDelta > 0 ? "rose" : undefined}
        />
        <Card
          label="Telur Kosong hari ini"
          value={String(k.kosong.today)}
          sub={`${signed(kosongDelta)} vs kmrn`}
          tone={kosongDelta > 0 ? "amber" : undefined}
        />
        <Card
          label="Penyelesaian Grading"
          value={`${k.gradingCompletion.pct.toFixed(0)}%`}
          sub={`${k.gradingCompletion.graded}/${k.gradingCompletion.batches} batch di-grading`}
        />
        <Card label="Batch menunggu pengambilan" value={String(k.batchesPendingCollection)} sub="ekspektasi − masuk hari ini" />
        <Card label="Stok gudang" value={formatPcs(k.warehouseStock.totalPcs)} sub="seluruh gudang" />
        <Card label="Telur terjual hari ini" value={formatPcs(k.eggsSold.today)} sub="penjualan aktif" />
        <Card
          label="Pakan dicampur hari ini"
          value={`${k.feedMixedKg} kg`}
          sub="total PAKAN MASUK"
        />
        <Card
          label="Kematian flock hari ini"
          value={String(k.mortality.mati + k.mortality.afkir)}
          sub={`MATI ${k.mortality.mati} · AFKIR ${k.mortality.afkir} · HIDUP ${k.mortality.hidup}`}
          tone={k.mortality.mati + k.mortality.afkir > 0 ? "amber" : undefined}
        />
        <Card label="Rata-rata HD% hari ini" value={`${k.avgHdPercent.toFixed(2)}%`} sub="seluruh placement aktif" />
        <Card label="Rata-rata FCR harian" value={k.avgFcr != null ? k.avgFcr.toFixed(3) : "—"} sub="intake ÷ berat telur" />
        <Card label="Produksi per Type hari ini" value={typeLine(k.typeBreakdown.productionToday)} sub="di-grading, per Type" />
        <Card label="Stok per Type" value={typeLine(k.typeBreakdown.stock)} sub="stok gudang saat ini" />
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold text-zinc-500">Pembeli teratas minggu ini (7 hari terakhir)</h2>
        <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
          <table className="w-full text-left text-sm">
            <thead className="bg-zinc-50 text-xs uppercase tracking-wide text-zinc-500 dark:bg-zinc-900">
              <tr>
                <th className="px-4 py-2">#</th>
                <th className="px-4 py-2">Pembeli</th>
                <th className="px-4 py-2 text-right">Volume</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {k.topBuyersThisWeek.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-4 py-3 text-zinc-500">
                    Tidak ada penjualan minggu ini.
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
