import { redirect } from "next/navigation";

import { gradeLabel } from "@/lib/grades";
import { getSessionUser } from "@/lib/server/auth";
import { listGradeTypes as listActiveGradeTypes } from "@/lib/server/catalog";
import { listThresholds } from "@/lib/server/thresholds";
import { listWarehouses } from "@/lib/server/warehouses";
import { formatPcs } from "@/lib/units";

import { WarehouseSelect } from "../warehouse-select";
import { WarehouseTabs } from "../warehouse-tabs";
import { ThresholdForm } from "./threshold-form";

export const dynamic = "force-dynamic";

export default async function ThresholdsPage({
  searchParams,
}: {
  searchParams: Promise<{ warehouseId?: string }>;
}) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.role === "OWNER") redirect("/dashboard"); // Owner is read-only

  const sp = await searchParams;
  const warehouses = await listWarehouses();
  if (warehouses.length === 0) {
    return (
      <main className="mx-auto w-full max-w-5xl p-8">
        <h1 className="text-xl font-semibold">Belum ada Gudang</h1>
      </main>
    );
  }
  const selectedId = warehouses.find((w) => w.id === sp.warehouseId)?.id ?? warehouses[0].id;
  const [thresholds, gradeTypes] = await Promise.all([
    listThresholds(selectedId),
    listActiveGradeTypes(),
  ]);

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-5 p-6 sm:p-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Batas Minimum Stok</h1>
        <p className="text-sm text-zinc-500">
          Saldo minimum per SKU Telur per Gudang. SKU di bawah minimumnya akan ditandai.
        </p>
      </header>

      <WarehouseTabs active="thresholds" warehouseId={selectedId} role={user.role} />
      <WarehouseSelect warehouses={warehouses} selectedId={selectedId} />

      <section className="rounded-lg border border-zinc-200 p-5 dark:border-zinc-800">
        <h2 className="mb-4 text-lg font-semibold">Atur Batas Minimum</h2>
        <ThresholdForm warehouseId={selectedId} gradeTypes={gradeTypes} />
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Batas Minimum terkonfigurasi</h2>
        {thresholds.length === 0 ? (
          <p className="text-sm text-zinc-500">Belum ada.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
            <table className="w-full text-left text-sm">
              <thead className="bg-zinc-50 text-xs uppercase tracking-wide text-zinc-500 dark:bg-zinc-900">
                <tr>
                  <th className="px-4 py-2">Grade</th>
                  <th className="px-4 py-2">Tipe</th>
                  <th className="px-4 py-2 text-right">Minimum</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {thresholds.map((t) => (
                  <tr key={t.id}>
                    <td className="px-4 py-2 font-medium">{gradeLabel(t.sizeHealthGrade)}</td>
                    <td className="px-4 py-2">{t.gradeType.name}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{formatPcs(t.minQuantity)}</td>
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
