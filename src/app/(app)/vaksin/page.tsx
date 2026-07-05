import { redirect } from "next/navigation";

import { businessToday, formatDateOnly } from "@/lib/dates";
import { getSessionUser } from "@/lib/server/auth";
import { listActiveFarmhouses } from "@/lib/server/catalog";
import { listVaksinLogs } from "@/lib/server/vaksin";
import { listActiveVaksinTypes, listVaksinTypes } from "@/lib/server/vaksinTypes";

import { setVaksinTypeStatusAction } from "./actions";
import { VaksinLogForm } from "./vaksin-log-form";
import { VaksinTypeForm } from "./vaksin-type-form";

export const dynamic = "force-dynamic";

const fieldClass =
  "rounded border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900";
const btnClass =
  "rounded border border-zinc-300 px-3 py-1 text-xs font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800";

const parseDate = (s?: string) =>
  s && /^\d{4}-\d{2}-\d{2}$/.test(s) ? new Date(`${s}T00:00:00Z`) : undefined;

export default async function VaksinPage({
  searchParams,
}: {
  searchParams: Promise<{
    from?: string;
    to?: string;
    farmhouseId?: string;
    vaksinTypeId?: string;
    vaccinator?: string;
  }>;
}) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.role === "OWNER") redirect("/warehouse");

  const isSuperadmin = user.role === "SUPERADMIN";
  const sp = await searchParams;
  const [activeTypes, kandangs, allTypes] = await Promise.all([
    listActiveVaksinTypes(),
    listActiveFarmhouses(),
    listVaksinTypes(),
  ]);
  const logs = await listVaksinLogs({
    from: parseDate(sp.from),
    to: parseDate(sp.to),
    farmhouseId: sp.farmhouseId || undefined,
    vaksinTypeId: sp.vaksinTypeId || undefined,
    vaccinator: sp.vaccinator?.trim() || undefined,
  });
  const today = formatDateOnly(businessToday());

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-8 p-6 sm:p-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">VAKSIN log</h1>
        <p className="text-sm text-zinc-500">
          A vaccination activity log — no inventory. The daily record&apos;s VAKSIN field derives
          from this log.
        </p>
      </header>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Log a vaccination</h2>
        <div className="rounded-lg border border-zinc-200 p-5 dark:border-zinc-800">
          {activeTypes.length === 0 ? (
            <p className="text-sm text-zinc-500">Add a vaksin type below first.</p>
          ) : (
            <VaksinLogForm types={activeTypes} kandangs={kandangs} today={today} />
          )}
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Log</h2>
        <form method="get" className="mb-3 flex flex-wrap items-end gap-3 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
          <label className="flex flex-col gap-1 text-sm font-medium">
            From
            <input type="date" name="from" defaultValue={sp.from ?? ""} className={fieldClass} />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium">
            To
            <input type="date" name="to" defaultValue={sp.to ?? ""} className={fieldClass} />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium">
            Kandang
            <select name="farmhouseId" defaultValue={sp.farmhouseId ?? ""} className={fieldClass}>
              <option value="">All</option>
              {kandangs.map((k) => (
                <option key={k.id} value={k.id}>
                  {k.name} ({k.code})
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium">
            Type
            <select name="vaksinTypeId" defaultValue={sp.vaksinTypeId ?? ""} className={fieldClass}>
              <option value="">All</option>
              {allTypes.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium">
            Vaccinator
            <input name="vaccinator" defaultValue={sp.vaccinator ?? ""} placeholder="name…" className={fieldClass} />
          </label>
          <button
            type="submit"
            className="rounded bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900"
          >
            Filter
          </button>
        </form>

        <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
          <table className="w-full text-left text-sm">
            <thead className="bg-zinc-50 text-xs uppercase tracking-wide text-zinc-500 dark:bg-zinc-900">
              <tr>
                <th className="px-4 py-2">Date</th>
                <th className="px-4 py-2">Vaksin</th>
                <th className="px-4 py-2">Kandang</th>
                <th className="px-4 py-2 text-right">Vials</th>
                <th className="px-4 py-2">Vaccinator</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {logs.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-3 text-zinc-500">
                    No vaccinations match.
                  </td>
                </tr>
              )}
              {logs.map((l) => (
                <tr key={l.id}>
                  <td className="px-4 py-2 tabular-nums">{l.date.toISOString().slice(0, 10)}</td>
                  <td className="px-4 py-2 font-medium">{l.vaksinType.name}</td>
                  <td className="px-4 py-2">{l.farmhouse.code}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{l.vials}</td>
                  <td className="px-4 py-2 text-zinc-500">{l.vaccinator}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Vaksin types</h2>
        <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
          <table className="w-full text-left text-sm">
            <thead className="bg-zinc-50 text-xs uppercase tracking-wide text-zinc-500 dark:bg-zinc-900">
              <tr>
                <th className="px-4 py-2">Name</th>
                <th className="px-4 py-2">Status</th>
                {isSuperadmin && <th className="px-4 py-2 text-right">Action</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {allTypes.length === 0 && (
                <tr>
                  <td colSpan={isSuperadmin ? 3 : 2} className="px-4 py-3 text-zinc-500">
                    No vaksin types yet.
                  </td>
                </tr>
              )}
              {allTypes.map((t) => {
                const active = t.status === "ACTIVE";
                return (
                  <tr key={t.id}>
                    <td className="px-4 py-2 font-medium">{t.name}</td>
                    <td className="px-4 py-2">
                      <span
                        className={`rounded px-2 py-0.5 text-xs font-semibold ${
                          active
                            ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200"
                            : "bg-zinc-200 text-zinc-700 dark:bg-zinc-700 dark:text-zinc-200"
                        }`}
                      >
                        {t.status}
                      </span>
                    </td>
                    {isSuperadmin && (
                      <td className="px-4 py-2 text-right">
                        <form action={setVaksinTypeStatusAction} className="inline">
                          <input type="hidden" name="id" value={t.id} />
                          <input type="hidden" name="status" value={active ? "INACTIVE" : "ACTIVE"} />
                          <button type="submit" className={btnClass}>
                            {active ? "Deactivate" : "Reactivate"}
                          </button>
                        </form>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {isSuperadmin && (
        <section className="rounded-lg border border-zinc-200 p-5 dark:border-zinc-800">
          <h2 className="mb-4 text-lg font-semibold">Add a vaksin type (Superadmin)</h2>
          <VaksinTypeForm />
        </section>
      )}
    </main>
  );
}
