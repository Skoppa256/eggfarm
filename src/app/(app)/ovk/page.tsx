import Link from "next/link";
import { redirect } from "next/navigation";

import { businessToday, formatDateOnly } from "@/lib/dates";
import { OVK_CATEGORY_LABELS } from "@/lib/ovk";
import { getSessionUser } from "@/lib/server/auth";
import { listActiveFarmhouses } from "@/lib/server/catalog";
import { getOvkLedger, getOvkStock } from "@/lib/server/ovkLedger";
import { listActiveOvkItems, listOvkItems } from "@/lib/server/ovkItems";

import { setOvkItemStatusAction } from "./actions";
import { OvkCorrectionForm } from "./ovk-correction-form";
import { OvkEntryForm, type OvkItemOption } from "./ovk-entry-form";
import { OvkItemForm } from "./ovk-item-form";

export const dynamic = "force-dynamic";

const btnClass =
  "rounded border border-zinc-300 px-3 py-1 text-xs font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800";

export default async function OvkPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.role === "OWNER") redirect("/warehouse");

  const isSuperadmin = user.role === "SUPERADMIN";
  const [items, active, stock, movements, kandangs] = await Promise.all([
    listOvkItems(),
    listActiveOvkItems(),
    getOvkStock(),
    getOvkLedger(undefined, 20),
    listActiveFarmhouses(),
  ]);
  const today = formatDateOnly(businessToday());
  const stockByItem = new Map(stock.map((s) => [s.ovkItemId, s.currentQuantity]));
  const options: OvkItemOption[] = active.map((i) => ({
    id: i.id,
    name: i.name,
    units: [i.baseUnit, ...i.unitConversions.map((c) => c.unitName)],
  }));
  const correctionItems = active.map((i) => ({ id: i.id, name: i.name, baseUnit: i.baseUnit }));

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-8 p-6 sm:p-8">
      <header className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">OVK (Obat / Vitamin / Chemical)</h1>
          <p className="text-sm text-zinc-500">
            One central office store. Deliveries increase stock; office→kandang transfers reduce it.
          </p>
        </div>
        <Link href="/ovk/pemakaian" className={btnClass}>
          Pemakaian report →
        </Link>
      </header>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Record a delivery</h2>
        <div className="rounded-lg border border-zinc-200 p-5 dark:border-zinc-800">
          {options.length === 0 ? (
            <p className="text-sm text-zinc-500">Add an item below first.</p>
          ) : (
            <OvkEntryForm mode="delivery" items={options} today={today} />
          )}
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Transfer to a kandang</h2>
        <div className="rounded-lg border border-zinc-200 p-5 dark:border-zinc-800">
          {options.length === 0 ? (
            <p className="text-sm text-zinc-500">Add an item first.</p>
          ) : (
            <OvkEntryForm mode="transfer" items={options} kandangs={kandangs} today={today} />
          )}
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Office stock</h2>
        <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
          <table className="w-full text-left text-sm">
            <thead className="bg-zinc-50 text-xs uppercase tracking-wide text-zinc-500 dark:bg-zinc-900">
              <tr>
                <th className="px-4 py-2">Item</th>
                <th className="px-4 py-2">Category</th>
                <th className="px-4 py-2 text-right">On hand</th>
                <th className="px-4 py-2">Status</th>
                {isSuperadmin && <th className="px-4 py-2 text-right">Action</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {items.length === 0 && (
                <tr>
                  <td colSpan={isSuperadmin ? 5 : 4} className="px-4 py-3 text-zinc-500">
                    No items yet.
                  </td>
                </tr>
              )}
              {items.map((it) => {
                const isActive = it.status === "ACTIVE";
                const qty = stockByItem.get(it.id);
                return (
                  <tr key={it.id}>
                    <td className="px-4 py-2 font-medium">{it.name}</td>
                    <td className="px-4 py-2 text-zinc-500">{OVK_CATEGORY_LABELS[it.category]}</td>
                    <td className="px-4 py-2 text-right tabular-nums">
                      {(qty ? qty.toFixed(3) : "0.000") + " " + it.baseUnit}
                    </td>
                    <td className="px-4 py-2">
                      <span
                        className={`rounded px-2 py-0.5 text-xs font-semibold ${
                          isActive
                            ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200"
                            : "bg-zinc-200 text-zinc-700 dark:bg-zinc-700 dark:text-zinc-200"
                        }`}
                      >
                        {it.status}
                      </span>
                    </td>
                    {isSuperadmin && (
                      <td className="px-4 py-2 text-right">
                        <form action={setOvkItemStatusAction} className="inline">
                          <input type="hidden" name="id" value={it.id} />
                          <input type="hidden" name="status" value={isActive ? "INACTIVE" : "ACTIVE"} />
                          <button type="submit" className={btnClass}>
                            {isActive ? "Deactivate" : "Reactivate"}
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

      {active.length > 0 && (
        <section>
          <h2 className="mb-3 text-lg font-semibold">Correct office stock</h2>
          <div className="rounded-lg border border-zinc-200 p-5 dark:border-zinc-800">
            <OvkCorrectionForm items={correctionItems} />
          </div>
        </section>
      )}

      {isSuperadmin && (
        <section className="rounded-lg border border-zinc-200 p-5 dark:border-zinc-800">
          <h2 className="mb-4 text-lg font-semibold">Add an item (Superadmin)</h2>
          <OvkItemForm />
        </section>
      )}

      <section>
        <h2 className="mb-3 text-lg font-semibold">Recent movements</h2>
        <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
          <table className="w-full text-left text-sm">
            <thead className="bg-zinc-50 text-xs uppercase tracking-wide text-zinc-500 dark:bg-zinc-900">
              <tr>
                <th className="px-4 py-2">Date</th>
                <th className="px-4 py-2">Item</th>
                <th className="px-4 py-2">Type</th>
                <th className="px-4 py-2 text-right">Entered</th>
                <th className="px-4 py-2">Kandang / note</th>
                <th className="px-4 py-2 text-right">Balance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {movements.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-3 text-zinc-500">
                    No movements yet.
                  </td>
                </tr>
              )}
              {movements.map((m) => (
                <tr key={m.id}>
                  <td className="px-4 py-2 tabular-nums">{m.date.toISOString().slice(0, 10)}</td>
                  <td className="px-4 py-2 font-medium">{m.ovkItem.name}</td>
                  <td className="px-4 py-2 text-zinc-500">
                    {m.sourceType === "DELIVERY" ? "Delivery" : m.sourceType === "TRANSFER" ? "Transfer" : "Correction"}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums">
                    {m.enteredQuantity.toFixed(3)} {m.unitUsed}
                  </td>
                  <td className="px-4 py-2 text-zinc-500">
                    {m.farmhouse ? `${m.farmhouse.code}${m.note ? ` · ${m.note}` : ""}` : (m.reason ?? "—")}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums">
                    {m.postQuantity.toFixed(3)} {m.ovkItem.baseUnit}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
