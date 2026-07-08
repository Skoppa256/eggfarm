import { redirect } from "next/navigation";

import { gradeLabel, SIZE_HEALTH_GRADES } from "@/lib/grades";
import { getSessionUser } from "@/lib/server/auth";
import { listGradeTypes as listActiveGradeTypes } from "@/lib/server/catalog";
import { getStock } from "@/lib/server/ledger";
import { listThresholds } from "@/lib/server/thresholds";
import { listWarehouses } from "@/lib/server/warehouses";
import { formatPcs } from "@/lib/units";

import { WarehouseSelect } from "./warehouse-select";
import { WarehouseTabs } from "./warehouse-tabs";

export const dynamic = "force-dynamic";

export default async function WarehouseStockPage({
  searchParams,
}: {
  searchParams: Promise<{ warehouseId?: string }>;
}) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.role === "OWNER") redirect("/dashboard"); // Owner sees stock via /reports/warehouse-stock

  const sp = await searchParams;
  const warehouses = await listWarehouses();
  if (warehouses.length === 0) {
    return (
      <main className="mx-auto w-full max-w-5xl p-8">
        <h1 className="text-xl font-semibold">Belum ada Gudang</h1>
        <p className="mt-2 text-sm text-zinc-500">Buat dulu di menu Data Gudang.</p>
      </main>
    );
  }
  const selectedId = warehouses.find((w) => w.id === sp.warehouseId)?.id ?? warehouses[0].id;

  const [stock, thresholds, gradeTypes] = await Promise.all([
    getStock(selectedId),
    listThresholds(selectedId),
    listActiveGradeTypes(),
  ]);

  const stockMap = new Map(stock.map((s) => [`${s.sizeHealthGrade}|${s.typeGradeId}`, s.currentQuantity]));
  const minMap = new Map(thresholds.map((t) => [`${t.sizeHealthGrade}|${t.typeGradeId}`, t.minQuantity]));

  const rows = SIZE_HEALTH_GRADES.map((grade) => {
    const cells = gradeTypes.map((t) => {
      const qty = stockMap.get(`${grade}|${t.id}`) ?? 0;
      const min = minMap.get(`${grade}|${t.id}`);
      return { typeId: t.id, qty, min, low: min != null && qty < min };
    });
    return { grade, cells, hasContent: cells.some((c) => c.qty > 0 || c.low) };
  }).filter((r) => r.hasContent);

  const lowCount = rows.reduce((n, r) => n + r.cells.filter((c) => c.low).length, 0);

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-5 p-6 sm:p-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Gudang</h1>
        <p className="text-sm text-zinc-500">Stok saat ini per SKU Telur, dalam rak + pcs.</p>
      </header>

      <WarehouseTabs active="stock" warehouseId={selectedId} role={user.role} />
      <WarehouseSelect warehouses={warehouses} selectedId={selectedId} />

      {lowCount > 0 && (
        <p className="rounded border border-rose-300 bg-rose-50 p-3 text-sm font-medium text-rose-800 dark:border-rose-800 dark:bg-rose-950 dark:text-rose-200">
          {lowCount} SKU di bawah Batas Minimum stok.
        </p>
      )}

      {rows.length === 0 ? (
        <p className="text-sm text-zinc-500">Belum ada stok di Gudang ini.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
          <table className="w-full text-left text-sm">
            <thead className="bg-zinc-50 text-xs uppercase tracking-wide text-zinc-500 dark:bg-zinc-900">
              <tr>
                <th className="px-4 py-2">Grade</th>
                {gradeTypes.map((t) => (
                  <th key={t.id} className="px-4 py-2 text-right">
                    {t.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {rows.map((row) => (
                <tr key={row.grade}>
                  <td className="px-4 py-2 font-medium">{gradeLabel(row.grade)}</td>
                  {row.cells.map((c) => (
                    <td
                      key={c.typeId}
                      className={`px-4 py-2 text-right tabular-nums ${
                        c.low ? "font-semibold text-rose-600" : c.qty === 0 ? "text-zinc-300 dark:text-zinc-600" : ""
                      }`}
                    >
                      {formatPcs(c.qty)}
                      {c.low ? <span className="ml-1 text-xs">▼ min {c.min}</span> : null}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
