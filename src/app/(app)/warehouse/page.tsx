import { gradeLabel } from "@/lib/grades";
import { getDefaultWarehouse, listGradeTypes } from "@/lib/server/catalog";
import { getLedger, getStock } from "@/lib/server/ledger";
import { formatPcs } from "@/lib/units";

import { StockEntryForm } from "./stock-entry-form";

export const dynamic = "force-dynamic";

function formatDateTime(value: Date): string {
  // Stable UTC rendering (no locale/timezone drift between renders).
  return value.toISOString().replace("T", " ").slice(0, 16) + " UTC";
}

const MOVEMENT_BADGE: Record<string, string> = {
  IN: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200",
  OUT: "bg-rose-100 text-rose-800 dark:bg-rose-900 dark:text-rose-200",
  CORRECTION: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
  VOID: "bg-zinc-200 text-zinc-700 dark:bg-zinc-700 dark:text-zinc-200",
};

export default async function WarehousePage() {
  const warehouse = await getDefaultWarehouse();

  if (!warehouse) {
    return (
      <main className="mx-auto w-full max-w-5xl p-8">
        <h1 className="text-xl font-semibold">No warehouse found</h1>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          Seed the database first: <code>pnpm db:seed</code>.
        </p>
      </main>
    );
  }

  const [stock, ledger, gradeTypes] = await Promise.all([
    getStock(warehouse.id),
    getLedger(warehouse.id),
    listGradeTypes(),
  ]);

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-8 p-6 sm:p-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">{warehouse.name}</h1>
        <p className="text-sm text-zinc-500">Warehouse {warehouse.code}</p>
      </header>

      <section className="rounded-lg border border-zinc-200 p-5 dark:border-zinc-800">
        <h2 className="mb-4 text-lg font-semibold">Record a movement</h2>
        <StockEntryForm warehouseId={warehouse.id} gradeTypes={gradeTypes} />
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Current stock</h2>
        {stock.length === 0 ? (
          <p className="text-sm text-zinc-500">No stock yet.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
            <table className="w-full text-left text-sm">
              <thead className="bg-zinc-50 text-xs uppercase tracking-wide text-zinc-500 dark:bg-zinc-900">
                <tr>
                  <th className="px-4 py-2">Grade</th>
                  <th className="px-4 py-2">Type</th>
                  <th className="px-4 py-2 text-right">Quantity</th>
                  <th className="px-4 py-2 text-right">pcs</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {stock.map((row) => (
                  <tr key={row.id}>
                    <td className="px-4 py-2 font-medium">{gradeLabel(row.sizeHealthGrade)}</td>
                    <td className="px-4 py-2">{row.gradeType.name}</td>
                    <td className="px-4 py-2 text-right tabular-nums">
                      {formatPcs(row.currentQuantity)}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums text-zinc-500">
                      {row.currentQuantity}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Movement ledger</h2>
        {ledger.length === 0 ? (
          <p className="text-sm text-zinc-500">No movements yet.</p>
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
                  <th className="px-4 py-2">Source</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {ledger.map((m) => (
                  <tr key={m.id}>
                    <td className="whitespace-nowrap px-4 py-2 text-zinc-500">
                      {formatDateTime(m.date)}
                    </td>
                    <td className="px-4 py-2">
                      {gradeLabel(m.sizeHealthGrade)} / {m.gradeType.name}
                    </td>
                    <td className="px-4 py-2">
                      <span
                        className={`rounded px-2 py-0.5 text-xs font-semibold ${
                          MOVEMENT_BADGE[m.movementType] ?? ""
                        }`}
                      >
                        {m.movementType}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums">{formatPcs(m.quantity)}</td>
                    <td className="whitespace-nowrap px-4 py-2 text-right tabular-nums text-zinc-500">
                      {m.preQuantity} → {m.postQuantity}
                    </td>
                    <td className="px-4 py-2 text-zinc-500">{m.sourceType}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
