import { redirect } from "next/navigation";

import { businessToday, formatDateOnly } from "@/lib/dates";
import { CATEGORY_LABELS } from "@/lib/pakan";
import { getSessionUser } from "@/lib/server/auth";
import { getIngredientLedger, getIngredientStock } from "@/lib/server/ingredientLedger";
import { listActiveIngredients, listIngredients } from "@/lib/server/ingredients";

import { setIngredientStatusAction } from "./actions";
import { CorrectionForm } from "./correction-form";
import { DeliveryForm } from "./delivery-form";
import { IngredientForm } from "./ingredient-form";

export const dynamic = "force-dynamic";

const btnClass =
  "rounded border border-zinc-300 px-3 py-1 text-xs font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800";

export default async function IngredientsPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.role === "OWNER") redirect("/dashboard"); // read-only role has no feed ops

  const isSuperadmin = user.role === "SUPERADMIN";
  const [ingredients, stock, active, movements] = await Promise.all([
    listIngredients(),
    getIngredientStock(),
    listActiveIngredients(),
    getIngredientLedger(undefined, 20),
  ]);
  const today = formatDateOnly(businessToday());
  const stockByIngredient = new Map(stock.map((s) => [s.ingredientId, s.currentQuantity]));

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-8 p-6 sm:p-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Bahan Pakan (PAKAN)</h1>
        <p className="text-sm text-zinc-500">
          Satu gudang bahan mentah terpusat. Penerimaan menambah stok; mixing menguranginya.
        </p>
      </header>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Catat Penerimaan</h2>
        <div className="rounded-lg border border-zinc-200 p-5 dark:border-zinc-800">
          {active.length === 0 ? (
            <p className="text-sm text-zinc-500">Tambah bahan di bawah terlebih dahulu.</p>
          ) : (
            <DeliveryForm ingredients={active} today={today} />
          )}
        </div>
      </section>

      {isSuperadmin && active.length > 0 && (
        <section>
          <h2 className="mb-3 text-lg font-semibold">Koreksi Stok (Superadmin)</h2>
          <div className="rounded-lg border border-zinc-200 p-5 dark:border-zinc-800">
            <p className="mb-3 text-xs text-zinc-500">
              Koreksi terawasi yang tidak dapat diubah (pergerakan kompensasi dengan nilai
              sebelum/sesudah dan alasan). Untuk memperbaiki koreksi yang salah, kirim koreksi lagi.
            </p>
            <CorrectionForm ingredients={active} />
          </div>
        </section>
      )}

      <section>
        <h2 className="mb-3 text-lg font-semibold">Stok Bahan Terpusat</h2>
        <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
          <table className="w-full text-left text-sm">
            <thead className="bg-zinc-50 text-xs uppercase tracking-wide text-zinc-500 dark:bg-zinc-900">
              <tr>
                <th className="px-4 py-2">Bahan</th>
                <th className="px-4 py-2">Kategori</th>
                <th className="px-4 py-2 text-right">Tersedia</th>
                <th className="px-4 py-2">Status</th>
                {isSuperadmin && <th className="px-4 py-2 text-right">Aksi</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {ingredients.length === 0 && (
                <tr>
                  <td colSpan={isSuperadmin ? 5 : 4} className="px-4 py-3 text-zinc-500">
                    Belum ada bahan.
                  </td>
                </tr>
              )}
              {ingredients.map((ing) => {
                const active = ing.status === "ACTIVE";
                const qty = stockByIngredient.get(ing.id);
                return (
                  <tr key={ing.id}>
                    <td className="px-4 py-2 font-medium">{ing.name}</td>
                    <td className="px-4 py-2 text-zinc-500">{CATEGORY_LABELS[ing.category]}</td>
                    <td className="px-4 py-2 text-right tabular-nums">
                      {qty ? `${qty.toFixed(3)} ${ing.baseUnit}` : `0.000 ${ing.baseUnit}`}
                    </td>
                    <td className="px-4 py-2">
                      <span
                        className={`rounded px-2 py-0.5 text-xs font-semibold ${
                          active
                            ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200"
                            : "bg-zinc-200 text-zinc-700 dark:bg-zinc-700 dark:text-zinc-200"
                        }`}
                      >
                        {ing.status}
                      </span>
                    </td>
                    {isSuperadmin && (
                      <td className="px-4 py-2 text-right">
                        <form action={setIngredientStatusAction} className="inline">
                          <input type="hidden" name="id" value={ing.id} />
                          <input type="hidden" name="status" value={active ? "INACTIVE" : "ACTIVE"} />
                          <button type="submit" className={btnClass}>
                            {active ? "Nonaktifkan" : "Aktifkan"}
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

      {isSuperadmin && (
        <section className="rounded-lg border border-zinc-200 p-5 dark:border-zinc-800">
          <h2 className="mb-4 text-lg font-semibold">Tambah Bahan (Superadmin)</h2>
          <IngredientForm />
        </section>
      )}

      <section>
        <h2 className="mb-3 text-lg font-semibold">Pergerakan Stok Terkini</h2>
        <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
          <table className="w-full text-left text-sm">
            <thead className="bg-zinc-50 text-xs uppercase tracking-wide text-zinc-500 dark:bg-zinc-900">
              <tr>
                <th className="px-4 py-2">Tanggal</th>
                <th className="px-4 py-2">Bahan</th>
                <th className="px-4 py-2">Tipe</th>
                <th className="px-4 py-2 text-right">Jumlah (kg)</th>
                <th className="px-4 py-2 text-right">Saldo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {movements.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-3 text-zinc-500">
                    Belum ada pergerakan.
                  </td>
                </tr>
              )}
              {movements.map((m) => (
                <tr key={m.id}>
                  <td className="px-4 py-2 tabular-nums">{m.date.toISOString().slice(0, 10)}</td>
                  <td className="px-4 py-2 font-medium">{m.ingredient.name}</td>
                  <td className="px-4 py-2 text-zinc-500">
                    {m.sourceType === "DELIVERY"
                      ? "Penerimaan"
                      : m.sourceType === "MIXING"
                        ? "Mixing"
                        : "Koreksi"}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums">
                    {m.postQuantity.greaterThanOrEqualTo(m.preQuantity) ? "+" : "−"}
                    {m.quantity.toFixed(3)}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums">{m.postQuantity.toFixed(3)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
