import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { businessToday, formatDateOnly } from "@/lib/dates";
import { computeHari, computeMinggu } from "@/lib/flock";
import { getSessionUser } from "@/lib/server/auth";
import { getFlock, resolveHidup } from "@/lib/server/flocks";

import { EndPlacementForm } from "./end-placement-form";

export const dynamic = "force-dynamic";

export default async function FlockDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.role === "OWNER") redirect("/warehouse");

  const { id } = await params;
  const flock = await getFlock(id);
  if (!flock) notFound();

  const today = businessToday();
  const todayStr = formatDateOnly(today);
  // HARI / MINGGU are flock-level — shared across all placements.
  const hari = computeHari(flock.placementAge, flock.chickInDate, today);
  const minggu = computeMinggu(hari);
  const isSuperadmin = user.role === "SUPERADMIN";

  const placements = await Promise.all(
    flock.placements.map(async (p) => ({ ...p, hidupToday: await resolveHidup(p.id, today) })),
  );

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-5 p-6 sm:p-8">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">{flock.strain}</h1>
        <Link href="/flocks" className="text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200">
          ← All flocks
        </Link>
      </header>

      <section className="grid grid-cols-2 gap-2 rounded-lg border border-zinc-200 p-4 text-sm dark:border-zinc-800 sm:grid-cols-5">
        <div>
          <div className="text-xs text-zinc-500">Chick-in</div>
          <div className="font-medium">{flock.chickInDate.toISOString().slice(0, 10)}</div>
        </div>
        <div>
          <div className="text-xs text-zinc-500">Placement age</div>
          <div className="font-medium">{flock.placementAge} d</div>
        </div>
        <div>
          <div className="text-xs text-zinc-500">HARI (today)</div>
          <div className="font-medium tabular-nums">{hari}</div>
        </div>
        <div>
          <div className="text-xs text-zinc-500">MINGGU (today)</div>
          <div className="font-medium tabular-nums">{minggu}</div>
        </div>
        <div>
          <div className="text-xs text-zinc-500">Status</div>
          <div className={`font-semibold ${flock.status === "ACTIVE" ? "text-emerald-600" : "text-zinc-500"}`}>
            {flock.status}
          </div>
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Placements</h2>
        <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
          <table className="w-full text-left text-sm">
            <thead className="bg-zinc-50 text-xs uppercase tracking-wide text-zinc-500 dark:bg-zinc-900">
              <tr>
                <th className="px-4 py-2">Kandang</th>
                <th className="px-4 py-2 text-right">Populasi Awal</th>
                <th className="px-4 py-2 text-right">HIDUP (today)</th>
                <th className="px-4 py-2">Status</th>
                {isSuperadmin && <th className="px-4 py-2">End</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {placements.map((p) => (
                <tr key={p.id} className="align-top">
                  <td className="px-4 py-2 font-medium">
                    {p.farmhouse.name} ({p.farmhouse.code})
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums">{p.populasiAwal}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{p.hidupToday ?? "—"}</td>
                  <td className="px-4 py-2">
                    <span
                      className={`rounded px-2 py-0.5 text-xs font-semibold ${
                        p.status === "ACTIVE"
                          ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200"
                          : "bg-zinc-200 text-zinc-700 dark:bg-zinc-700 dark:text-zinc-200"
                      }`}
                    >
                      {p.status}
                      {p.endDate ? ` · ${p.endDate.toISOString().slice(0, 10)}` : ""}
                    </span>
                  </td>
                  {isSuperadmin && (
                    <td className="px-4 py-2">
                      {p.status === "ACTIVE" ? (
                        <EndPlacementForm placementId={p.id} defaultDate={todayStr} />
                      ) : (
                        <span className="text-xs text-zinc-400">ended</span>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
