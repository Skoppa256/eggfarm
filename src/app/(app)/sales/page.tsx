import Link from "next/link";
import { redirect } from "next/navigation";

import type { SizeHealthGrade } from "@/generated/prisma/enums";
import { gradeLabel, SIZE_HEALTH_GRADES } from "@/lib/grades";
import { getSessionUser } from "@/lib/server/auth";
import { listBuyers } from "@/lib/server/buyers";
import { listGradeTypes as listActiveGradeTypes } from "@/lib/server/catalog";
import { listSales } from "@/lib/server/sales";
import { listWarehouses } from "@/lib/server/warehouses";
import { formatPcs } from "@/lib/units";

export const dynamic = "force-dynamic";

const fieldClass =
  "rounded border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900";

export default async function SalesPage({
  searchParams,
}: {
  searchParams: Promise<{
    warehouseId?: string;
    buyerId?: string;
    from?: string;
    to?: string;
    sizeHealthGrade?: string;
    typeGradeId?: string;
    includeVoided?: string;
  }>;
}) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.role === "OWNER") redirect("/warehouse");

  const sp = await searchParams;
  const [warehouses, buyers, gradeTypes] = await Promise.all([
    listWarehouses(),
    listBuyers(),
    listActiveGradeTypes(),
  ]);

  const dateRe = /^\d{4}-\d{2}-\d{2}$/;
  const from = sp.from && dateRe.test(sp.from) ? new Date(`${sp.from}T00:00:00Z`) : undefined;
  const to = sp.to && dateRe.test(sp.to) ? new Date(`${sp.to}T23:59:59.999Z`) : undefined;
  const grade =
    sp.sizeHealthGrade && (SIZE_HEALTH_GRADES as readonly string[]).includes(sp.sizeHealthGrade)
      ? (sp.sizeHealthGrade as SizeHealthGrade)
      : undefined;
  const includeVoided = sp.includeVoided === "1";

  const sales = await listSales({
    warehouseId: warehouses.some((w) => w.id === sp.warehouseId) ? sp.warehouseId : undefined,
    buyerId: buyers.some((b) => b.id === sp.buyerId) ? sp.buyerId : undefined,
    from,
    to,
    sizeHealthGrade: grade,
    typeGradeId: gradeTypes.some((t) => t.id === sp.typeGradeId) ? sp.typeGradeId : undefined,
    includeVoided,
  });

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-5 p-6 sm:p-8">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Sales</h1>
          <p className="text-sm text-zinc-500">Voided transactions are hidden unless included.</p>
        </div>
        <Link
          href="/sales/new"
          className="rounded bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
        >
          New sale
        </Link>
      </header>

      <form method="get" className="flex flex-wrap items-end gap-2 rounded-lg border border-zinc-200 p-3 dark:border-zinc-800">
        <label className="flex flex-col gap-1 text-xs font-medium">
          Warehouse
          <select name="warehouseId" defaultValue={sp.warehouseId ?? ""} className={fieldClass}>
            <option value="">All</option>
            {warehouses.map((w) => (
              <option key={w.id} value={w.id}>
                {w.code}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium">
          Buyer
          <select name="buyerId" defaultValue={sp.buyerId ?? ""} className={fieldClass}>
            <option value="">All</option>
            {buyers.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium">
          From
          <input type="date" name="from" defaultValue={sp.from ?? ""} className={fieldClass} />
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium">
          To
          <input type="date" name="to" defaultValue={sp.to ?? ""} className={fieldClass} />
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium">
          Grade
          <select name="sizeHealthGrade" defaultValue={grade ?? ""} className={fieldClass}>
            <option value="">All</option>
            {SIZE_HEALTH_GRADES.map((g) => (
              <option key={g} value={g}>
                {gradeLabel(g)}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-1 text-xs font-medium">
          <input type="checkbox" name="includeVoided" value="1" defaultChecked={includeVoided} />
          Include voided
        </label>
        <button
          type="submit"
          className="rounded bg-zinc-900 px-3 py-1.5 text-sm font-semibold text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900"
        >
          Apply
        </button>
      </form>

      {sales.length === 0 ? (
        <p className="text-sm text-zinc-500">No transactions match.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
          <table className="w-full text-left text-sm">
            <thead className="bg-zinc-50 text-xs uppercase tracking-wide text-zinc-500 dark:bg-zinc-900">
              <tr>
                <th className="px-4 py-2">Date</th>
                <th className="px-4 py-2">Buyer</th>
                <th className="px-4 py-2">Warehouse</th>
                <th className="px-4 py-2 text-right">Total</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2 text-right"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {sales.map((s) => {
                const total = s.lineItems.reduce((n, l) => n + l.quantity, 0);
                const voided = s.status === "VOIDED";
                return (
                  <tr key={s.id} className={voided ? "text-zinc-400" : ""}>
                    <td className="px-4 py-2">{s.date.toISOString().slice(0, 10)}</td>
                    <td className="px-4 py-2">{s.buyer.name}</td>
                    <td className="px-4 py-2">{s.warehouse.code}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{formatPcs(total)}</td>
                    <td className="px-4 py-2">
                      <span
                        className={`rounded px-2 py-0.5 text-xs font-semibold ${
                          voided
                            ? "bg-zinc-300 text-zinc-700 dark:bg-zinc-600 dark:text-zinc-100"
                            : "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200"
                        }`}
                      >
                        {s.status}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-right">
                      <Link href={`/sales/${s.id}`} className="text-xs font-medium text-zinc-600 underline dark:text-zinc-300">
                        View
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
