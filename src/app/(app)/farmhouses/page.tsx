import { redirect } from "next/navigation";

import { businessToday } from "@/lib/dates";
import { getSessionUser } from "@/lib/server/auth";
import { listWarehouses as listActiveWarehouses } from "@/lib/server/catalog";
import { listFarmhousesWithCurrent } from "@/lib/server/farmhouses";

import { changeBatchAction, changeMappingAction, setFarmhouseStatusAction } from "./actions";
import { FarmhouseCreateForm } from "./farmhouse-create-form";

export const dynamic = "force-dynamic";

const inputClass =
  "rounded border border-zinc-300 px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-900";
const btnClass =
  "rounded border border-zinc-300 px-2 py-1 text-xs font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800";

export default async function FarmhousesPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.role === "OWNER") redirect("/warehouse"); // read-only role

  const [farmhouses, warehouses] = await Promise.all([
    listFarmhousesWithCurrent(businessToday()),
    listActiveWarehouses(),
  ]);

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-8 p-6 sm:p-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Farmhouses (Kandang)</h1>
        <p className="text-sm text-zinc-500">
          Warehouse mapping and batch count are effective-dated; batch changes take effect the next
          day.
        </p>
      </header>

      <section className="rounded-lg border border-zinc-200 p-5 dark:border-zinc-800">
        <h2 className="mb-4 text-lg font-semibold">Add a farmhouse</h2>
        <FarmhouseCreateForm warehouses={warehouses} />
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">All farmhouses</h2>
        <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
          <table className="w-full text-left text-sm">
            <thead className="bg-zinc-50 text-xs uppercase tracking-wide text-zinc-500 dark:bg-zinc-900">
              <tr>
                <th className="px-4 py-2">Code</th>
                <th className="px-4 py-2">Name</th>
                <th className="px-4 py-2">Warehouse (today)</th>
                <th className="px-4 py-2">Max batches (today)</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {farmhouses.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-4 text-zinc-500">
                    No farmhouses yet.
                  </td>
                </tr>
              )}
              {farmhouses.map((f) => {
                const currentWarehouse = f.warehouseMappings[0]?.warehouse;
                const currentBatches = f.batchSettings[0]?.maxBatchesPerDay;
                const active = f.status === "ACTIVE";
                return (
                  <tr key={f.id} className="align-top">
                    <td className="px-4 py-3 font-medium">{f.code}</td>
                    <td className="px-4 py-3">{f.name}</td>
                    <td className="px-4 py-3">
                      <div className="mb-1 text-zinc-700 dark:text-zinc-300">
                        {currentWarehouse ? `${currentWarehouse.name} (${currentWarehouse.code})` : "—"}
                      </div>
                      <form action={changeMappingAction} className="flex items-center gap-1">
                        <input type="hidden" name="farmhouseId" value={f.id} />
                        <select name="warehouseId" defaultValue={currentWarehouse?.id} className={inputClass}>
                          {warehouses.map((w) => (
                            <option key={w.id} value={w.id}>
                              {w.code}
                            </option>
                          ))}
                        </select>
                        <button type="submit" className={btnClass}>
                          Re-map
                        </button>
                      </form>
                    </td>
                    <td className="px-4 py-3">
                      <div className="mb-1 tabular-nums text-zinc-700 dark:text-zinc-300">
                        {currentBatches ?? "—"}
                      </div>
                      <form action={changeBatchAction} className="flex items-center gap-1">
                        <input type="hidden" name="farmhouseId" value={f.id} />
                        <input
                          type="number"
                          name="maxBatchesPerDay"
                          min={1}
                          max={10}
                          defaultValue={currentBatches ?? 2}
                          className={`${inputClass} w-16`}
                        />
                        <button type="submit" className={btnClass} title="Takes effect tomorrow">
                          Set (next day)
                        </button>
                      </form>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded px-2 py-0.5 text-xs font-semibold ${
                          active
                            ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200"
                            : "bg-zinc-200 text-zinc-700 dark:bg-zinc-700 dark:text-zinc-200"
                        }`}
                      >
                        {f.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <form action={setFarmhouseStatusAction} className="inline">
                        <input type="hidden" name="id" value={f.id} />
                        <input type="hidden" name="status" value={active ? "INACTIVE" : "ACTIVE"} />
                        <button type="submit" className={btnClass}>
                          {active ? "Deactivate" : "Reactivate"}
                        </button>
                      </form>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
