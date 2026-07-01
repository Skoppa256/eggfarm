import { redirect } from "next/navigation";

import { gradeLabel } from "@/lib/grades";
import { getSessionUser } from "@/lib/server/auth";
import { listGradeTypes as listActiveGradeTypes } from "@/lib/server/catalog";
import { getStock } from "@/lib/server/ledger";
import { listWarehouses } from "@/lib/server/warehouses";
import { formatPcs } from "@/lib/units";

import { WarehouseSelect } from "../warehouse-select";
import { WarehouseTabs } from "../warehouse-tabs";
import { CorrectionForm } from "./correction-form";

export const dynamic = "force-dynamic";

export default async function CorrectionPage({
  searchParams,
}: {
  searchParams: Promise<{ warehouseId?: string }>;
}) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.role === "OWNER") redirect("/warehouse"); // corrections are a write path

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
  const [stock, gradeTypes] = await Promise.all([getStock(selectedId), listActiveGradeTypes()]);
  const nonZero = stock.filter((s) => s.currentQuantity > 0);

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-5 p-6 sm:p-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Stock correction</h1>
        <p className="text-sm text-zinc-500">
          Supervised adjustment to reconcile a physical count. Logged immutably with a reason.
        </p>
      </header>

      <WarehouseTabs active="correction" warehouseId={selectedId} role={user.role} />
      <WarehouseSelect warehouses={warehouses} selectedId={selectedId} />

      <section className="rounded-lg border border-zinc-200 p-5 dark:border-zinc-800">
        <h2 className="mb-4 text-lg font-semibold">New correction</h2>
        <CorrectionForm warehouseId={selectedId} gradeTypes={gradeTypes} />
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold text-zinc-500">Current stock (reference)</h2>
        {nonZero.length === 0 ? (
          <p className="text-sm text-zinc-500">No stock.</p>
        ) : (
          <ul className="grid grid-cols-1 gap-1 text-sm sm:grid-cols-2">
            {nonZero.map((s) => (
              <li key={s.id} className="flex justify-between rounded border border-zinc-100 px-3 py-1 dark:border-zinc-800">
                <span>
                  {gradeLabel(s.sizeHealthGrade)} / {s.gradeType.name}
                </span>
                <span className="tabular-nums text-zinc-600 dark:text-zinc-300">
                  {formatPcs(s.currentQuantity)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
