import Link from "next/link";
import { redirect } from "next/navigation";

import { computeKandangDayStatus, type ItemState } from "@/lib/adminTasks";
import { businessToday, formatDateOnly } from "@/lib/dates";
import { getSessionUser } from "@/lib/server/auth";
import { listActiveFarmhouses } from "@/lib/server/catalog";
import { listCollections } from "@/lib/server/collections";
import { findDailyRecord, resolvePlacementForDate } from "@/lib/server/dailyRecords";
import { resolveMaxBatches } from "@/lib/server/farmhouses";
import { listGradings } from "@/lib/server/grading";

export const dynamic = "force-dynamic";

function longDate(dateStr: string): string {
  return new Date(`${dateStr}T00:00:00Z`).toLocaleDateString("id-ID", {
    timeZone: "UTC",
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

/** One task line: a big tap-target link when pending, a quiet ✓ when done, hidden when N/A. */
function TaskRow({ label, state, href }: { label: string; state: ItemState; href: string }) {
  if (state === "na") return null; // e.g. grading before the batch is collected — one action at a time
  if (state === "done") {
    return (
      <div className="flex items-center gap-2 px-1 py-1 text-xs text-emerald-700">
        <span aria-hidden>✓</span>
        <span>{label}</span>
      </div>
    );
  }
  return (
    <Link
      href={href}
      className="flex min-h-11 items-center justify-between gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2.5 text-sm font-semibold text-amber-900 transition-colors hover:bg-amber-100 active:bg-amber-200"
    >
      <span className="flex items-center gap-2">
        <span aria-hidden>⚠</span>
        {label} belum
      </span>
      <span aria-hidden>→</span>
    </Link>
  );
}

export default async function TugasHariIniPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.role === "OWNER") redirect("/dashboard"); // read-only role has no daily tasks

  const dateStr = formatDateOnly(businessToday());
  const today = new Date(`${dateStr}T00:00:00Z`);
  const farmhouses = await listActiveFarmhouses();

  // Per active kandang that has a placement today, derive completion from existing
  // collection / grading / daily records (read-only — no new writes, no completion table).
  const rows = (
    await Promise.all(
      farmhouses.map(async (f) => {
        const placement = await resolvePlacementForDate(f.id, today);
        if (!placement) return null; // no active flock -> no daily tasks for this kandang
        const [maxBatches, collections, gradings, daily] = await Promise.all([
          resolveMaxBatches(f.id, today),
          listCollections(f.id, today),
          listGradings(f.id, today),
          findDailyRecord(f.id, today),
        ]);
        const status = computeKandangDayStatus({
          maxBatches: maxBatches ?? 0,
          collectedBatches: collections.map((c) => c.batchNumber),
          submittedBatches: gradings
            .filter((g) => g.status === "SUBMITTED")
            .map((g) => g.batchNumber),
          hasDailyRecord: daily != null,
        });
        return { farmhouse: f, status };
      }),
    )
  ).filter((r): r is NonNullable<typeof r> => r != null);

  const doneCount = rows.filter((r) => r.status.allDone).length;

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-5 p-4 sm:p-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Tugas Hari Ini</h1>
        <p className="text-sm text-zinc-500">{longDate(dateStr)}</p>
      </header>

      <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
        <div className="text-lg font-semibold">
          {doneCount} dari {rows.length} kandang selesai hari ini.
        </div>
        <p className="mt-0.5 text-sm text-zinc-500">
          Ketuk tugas berwarna kuning untuk mulai. Tanda ✓ berarti sudah selesai.
        </p>
      </div>

      {rows.length === 0 ? (
        <p className="rounded-lg border border-zinc-200 p-4 text-sm text-zinc-500">
          Belum ada kandang aktif hari ini.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {rows.map(({ farmhouse, status }) => {
            const q = `?farmhouseId=${farmhouse.id}&date=${dateStr}`;
            return (
              <div
                key={farmhouse.id}
                className={`flex flex-col gap-2 rounded-xl border p-4 ${
                  status.allDone ? "border-emerald-200 bg-emerald-50/50" : "border-zinc-200 bg-white"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="font-semibold">
                    {farmhouse.name} <span className="font-normal text-zinc-400">({farmhouse.code})</span>
                  </div>
                  {status.allDone ? (
                    <span className="shrink-0 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-800">
                      ✓ Selesai
                    </span>
                  ) : (
                    <span className="shrink-0 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-800">
                      ⚠ {status.pendingCount} tugas
                    </span>
                  )}
                </div>

                <div className="flex flex-col gap-1.5">
                  {status.batches.map((b) => (
                    <div key={b.batch} className="flex flex-col gap-1.5">
                      <TaskRow label={`Koleksi Batch ${b.batch}`} state={b.collection} href={`/collections${q}`} />
                      <TaskRow label={`Grading Batch ${b.batch}`} state={b.grading} href={`/grading${q}`} />
                    </div>
                  ))}
                  <TaskRow label="Catatan Harian" state={status.daily} href={`/daily${q}`} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}
