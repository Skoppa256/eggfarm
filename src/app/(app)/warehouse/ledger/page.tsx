import { redirect } from "next/navigation";

import type { SizeHealthGrade } from "@/generated/prisma/enums";
import { gradeLabel, SIZE_HEALTH_GRADES } from "@/lib/grades";
import { getSessionUser } from "@/lib/server/auth";
import { listGradeTypes as listActiveGradeTypes } from "@/lib/server/catalog";
import { getFilteredLedger } from "@/lib/server/ledger";
import { listWarehouses } from "@/lib/server/warehouses";
import { formatPcs } from "@/lib/units";

import { WarehouseTabs } from "../warehouse-tabs";

export const dynamic = "force-dynamic";

const fieldClass =
  "rounded border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900";

const MOVEMENT_BADGE: Record<string, string> = {
  IN: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200",
  OUT: "bg-rose-100 text-rose-800 dark:bg-rose-900 dark:text-rose-200",
  CORRECTION: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
  VOID: "bg-zinc-300 text-zinc-800 line-through dark:bg-zinc-600 dark:text-zinc-100",
};

function fmt(d: Date): string {
  return d.toISOString().replace("T", " ").slice(0, 16) + " UTC";
}

export default async function LedgerPage({
  searchParams,
}: {
  searchParams: Promise<{
    warehouseId?: string;
    from?: string;
    to?: string;
    sizeHealthGrade?: string;
    typeGradeId?: string;
  }>;
}) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.role === "OWNER") redirect("/dashboard"); // Owner is read-only (stock via /reports)

  const sp = await searchParams;
  const warehouses = await listWarehouses();
  if (warehouses.length === 0) {
    return (
      <main className="mx-auto w-full max-w-5xl p-8">
        <h1 className="text-xl font-semibold">No warehouses</h1>
      </main>
    );
  }
  const selectedId = warehouses.find((w) => w.id === sp.warehouseId)?.id ?? warehouses[0].id;
  const gradeTypes = await listActiveGradeTypes();

  const dateRe = /^\d{4}-\d{2}-\d{2}$/;
  const from = sp.from && dateRe.test(sp.from) ? new Date(`${sp.from}T00:00:00Z`) : undefined;
  const to = sp.to && dateRe.test(sp.to) ? new Date(`${sp.to}T23:59:59.999Z`) : undefined;
  const grade =
    sp.sizeHealthGrade && (SIZE_HEALTH_GRADES as readonly string[]).includes(sp.sizeHealthGrade)
      ? (sp.sizeHealthGrade as SizeHealthGrade)
      : undefined;
  const typeGradeId = gradeTypes.some((t) => t.id === sp.typeGradeId) ? sp.typeGradeId : undefined;

  const ledger = await getFilteredLedger({
    warehouseId: selectedId,
    from,
    to,
    sizeHealthGrade: grade,
    typeGradeId,
  });

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-5 p-6 sm:p-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Movement ledger</h1>
        <p className="text-sm text-zinc-500">Read-only. Corrections and voids are marked.</p>
      </header>

      <WarehouseTabs active="ledger" warehouseId={selectedId} role={user.role} />

      <form method="get" className="flex flex-wrap items-end gap-2 rounded-lg border border-zinc-200 p-3 dark:border-zinc-800">
        <label className="flex flex-col gap-1 text-xs font-medium">
          Warehouse
          <select name="warehouseId" defaultValue={selectedId} className={fieldClass}>
            {warehouses.map((w) => (
              <option key={w.id} value={w.id}>
                {w.code}
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
        <label className="flex flex-col gap-1 text-xs font-medium">
          Type
          <select name="typeGradeId" defaultValue={typeGradeId ?? ""} className={fieldClass}>
            <option value="">All</option>
            {gradeTypes.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </label>
        <button
          type="submit"
          className="rounded bg-zinc-900 px-3 py-1.5 text-sm font-semibold text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900"
        >
          Apply
        </button>
      </form>

      {ledger.length === 0 ? (
        <p className="text-sm text-zinc-500">No movements match.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
          <table className="w-full text-left text-sm">
            <thead className="bg-zinc-50 text-xs uppercase tracking-wide text-zinc-500 dark:bg-zinc-900">
              <tr>
                <th className="px-4 py-2">When</th>
                <th className="px-4 py-2">Grade / Type</th>
                <th className="px-4 py-2">Movement</th>
                <th className="px-4 py-2 text-right">Quantity</th>
                <th className="px-4 py-2 text-right">Balance</th>
                <th className="px-4 py-2">Source / reason</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {ledger.map((m) => (
                <tr key={m.id}>
                  <td className="whitespace-nowrap px-4 py-2 text-zinc-500">{fmt(m.date)}</td>
                  <td className="px-4 py-2">
                    {gradeLabel(m.sizeHealthGrade)} / {m.gradeType.name}
                  </td>
                  <td className="px-4 py-2">
                    <span className={`rounded px-2 py-0.5 text-xs font-semibold ${MOVEMENT_BADGE[m.movementType] ?? ""}`}>
                      {m.movementType}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums">{formatPcs(m.quantity)}</td>
                  <td className="whitespace-nowrap px-4 py-2 text-right tabular-nums text-zinc-500">
                    {m.preQuantity} → {m.postQuantity}
                  </td>
                  <td className="px-4 py-2 text-zinc-500">
                    {m.sourceType}
                    {m.reason ? <span className="block text-xs italic">{m.reason}</span> : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
