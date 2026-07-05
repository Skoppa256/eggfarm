import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { getSessionUser } from "@/lib/server/auth";
import { listActiveBuyers } from "@/lib/server/buyers";
import { listActiveFarmhouses, listGradeTypes } from "@/lib/server/catalog";
import { findReport, type FilterKey, toReportFilters } from "@/lib/server/reports";
import { listActiveVaksinTypes } from "@/lib/server/vaksinTypes";
import { listWarehouses } from "@/lib/server/warehouses";

export const dynamic = "force-dynamic";

const fieldClass =
  "rounded border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900";

type Sp = Record<string, string | string[] | undefined>;
const one = (sp: Sp, k: string): string | undefined => {
  const v = sp[k];
  return Array.isArray(v) ? v[0] : v;
};

export default async function ReportPage({
  params,
  searchParams,
}: {
  params: Promise<{ report: string }>;
  searchParams: Promise<Sp>;
}) {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const { report: slug } = await params;
  const report = findReport(slug);
  if (!report) notFound();
  // §8.1 access role (rule 5.5 read-side): Owner can't reach an Admin/Superadmin report.
  if (!report.roles.includes(user.role)) redirect("/reports");

  const sp = await searchParams;
  const filters = toReportFilters((k) => one(sp, k));
  const has = (k: FilterKey) => report.filters.includes(k);

  const [result, farmhouses, warehouses, gradeTypes, buyers, vaksinTypes] = await Promise.all([
    report.load(filters),
    has("farmhouseId") ? listActiveFarmhouses() : Promise.resolve([]),
    has("warehouseId") ? listWarehouses() : Promise.resolve([]),
    has("typeGradeId") ? listGradeTypes() : Promise.resolve([]),
    has("buyerId") ? listActiveBuyers() : Promise.resolve([]),
    has("vaksinTypeId") ? listActiveVaksinTypes() : Promise.resolve([]),
  ]);

  const exportQs = new URLSearchParams();
  for (const k of report.filters) {
    const v = one(sp, k);
    if (v) exportQs.set(k, v);
  }
  const exportHref = `/reports/${slug}/export${exportQs.toString() ? `?${exportQs}` : ""}`;

  const dateInput = (name: string, label: string) => (
    <label className="flex flex-col gap-1 text-sm font-medium">
      {label}
      <input type="date" name={name} defaultValue={one(sp, name) ?? ""} className={fieldClass} />
    </label>
  );
  const select = (name: string, label: string, options: { id: string; label: string }[]) => (
    <label className="flex flex-col gap-1 text-sm font-medium">
      {label}
      <select name={name} defaultValue={one(sp, name) ?? ""} className={fieldClass}>
        <option value="">All</option>
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-5 p-6 sm:p-8">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{report.title}</h1>
          <p className="text-sm text-zinc-500">{report.description}</p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/reports" className="text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200">
            ← Reports
          </Link>
          <a href={exportHref} className="rounded border border-zinc-300 px-3 py-1.5 text-sm font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800">
            Export .xlsx
          </a>
        </div>
      </header>

      {report.filters.length > 0 && (
        <form method="get" className="flex flex-wrap items-end gap-3 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
          {has("date") && dateInput("date", "Date")}
          {has("from") && dateInput("from", "From")}
          {has("to") && dateInput("to", "To")}
          {has("farmhouseId") && select("farmhouseId", "Kandang", farmhouses.map((f) => ({ id: f.id, label: `${f.name} (${f.code})` })))}
          {has("warehouseId") && select("warehouseId", "Warehouse", warehouses.map((w) => ({ id: w.id, label: `${w.name} (${w.code})` })))}
          {has("typeGradeId") && select("typeGradeId", "Type", gradeTypes.map((t) => ({ id: t.id, label: t.name })))}
          {has("vaksinTypeId") && select("vaksinTypeId", "Vaksin type", vaksinTypes.map((t) => ({ id: t.id, label: t.name })))}
          {has("buyerId") && select("buyerId", "Buyer", buyers.map((b) => ({ id: b.id, label: b.name })))}
          {has("vaccinator") && (
            <label className="flex flex-col gap-1 text-sm font-medium">
              Vaccinator
              <input name="vaccinator" defaultValue={one(sp, "vaccinator") ?? ""} placeholder="name…" className={fieldClass} />
            </label>
          )}
          <button
            type="submit"
            className="rounded bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900"
          >
            Apply
          </button>
        </form>
      )}

      <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
        <table className="w-full text-left text-sm">
          <thead className="bg-zinc-50 text-xs uppercase tracking-wide text-zinc-500 dark:bg-zinc-900">
            <tr>
              {result.columns.map((c, i) => (
                <th key={i} className={`px-4 py-2 ${c.numeric ? "text-right" : ""}`}>
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {result.rows.length === 0 && (
              <tr>
                <td colSpan={result.columns.length} className="px-4 py-3 text-zinc-500">
                  No data for this selection.
                </td>
              </tr>
            )}
            {result.rows.map((row, ri) => (
              <tr key={ri}>
                {row.map((cell, ci) => (
                  <td key={ci} className={`px-4 py-2 ${result.columns[ci]?.numeric ? "text-right tabular-nums" : ""}`}>
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-zinc-500">{result.rows.length} row(s).</p>
    </main>
  );
}
