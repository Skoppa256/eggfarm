import Link from "next/link";
import { redirect } from "next/navigation";

import { OVK_CATEGORY_LABELS } from "@/lib/ovk";
import { getSessionUser } from "@/lib/server/auth";
import { listActiveFarmhouses } from "@/lib/server/catalog";
import { pemakaianReport } from "@/lib/server/ovkLedger";

export const dynamic = "force-dynamic";

const fieldClass =
  "rounded border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900";

const parseDate = (s?: string) =>
  s && /^\d{4}-\d{2}-\d{2}$/.test(s) ? new Date(`${s}T00:00:00Z`) : undefined;

export default async function PemakaianPage({
  searchParams,
}: {
  searchParams: Promise<{ farmhouseId?: string; from?: string; to?: string }>;
}) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.role === "OWNER") redirect("/dashboard");

  const sp = await searchParams;
  const farmhouses = await listActiveFarmhouses();
  const farmhouseId =
    sp.farmhouseId && farmhouses.some((f) => f.id === sp.farmhouseId) ? sp.farmhouseId : undefined;

  const rows = farmhouseId
    ? await pemakaianReport(farmhouseId, parseDate(sp.from), parseDate(sp.to))
    : [];

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-6 sm:p-8">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">OVK usage (Pemakaian)</h1>
          <p className="text-sm text-zinc-500">Office→kandang transfers per kandang over a date range.</p>
        </div>
        <Link href="/ovk" className="text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200">
          ← OVK
        </Link>
      </header>

      <form method="get" className="flex flex-wrap items-end gap-3 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
        <label className="flex flex-col gap-1 text-sm font-medium">
          Kandang
          <select name="farmhouseId" defaultValue={farmhouseId ?? ""} className={fieldClass}>
            <option value="">Select…</option>
            {farmhouses.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name} ({f.code})
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          From
          <input type="date" name="from" defaultValue={sp.from ?? ""} className={fieldClass} />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          To
          <input type="date" name="to" defaultValue={sp.to ?? ""} className={fieldClass} />
        </label>
        <button
          type="submit"
          className="rounded bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900"
        >
          Load
        </button>
      </form>

      {!farmhouseId ? (
        <p className="text-sm text-zinc-500">Choose a kandang, then Load.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
          <table className="w-full text-left text-sm">
            <thead className="bg-zinc-50 text-xs uppercase tracking-wide text-zinc-500 dark:bg-zinc-900">
              <tr>
                <th className="px-4 py-2">Date</th>
                <th className="px-4 py-2">Item</th>
                <th className="px-4 py-2">Category</th>
                <th className="px-4 py-2 text-right">Qty out</th>
                <th className="px-4 py-2">Unit</th>
                <th className="px-4 py-2">Note</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {rows.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-3 text-zinc-500">
                    No transfers to this kandang in the range.
                  </td>
                </tr>
              )}
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="px-4 py-2 tabular-nums">{r.date.toISOString().slice(0, 10)}</td>
                  <td className="px-4 py-2 font-medium">{r.ovkItem.name}</td>
                  <td className="px-4 py-2 text-zinc-500">{OVK_CATEGORY_LABELS[r.ovkItem.category]}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{r.enteredQuantity.toFixed(3)}</td>
                  <td className="px-4 py-2">{r.unitUsed}</td>
                  <td className="px-4 py-2 text-zinc-500">{r.note ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
