import { redirect } from "next/navigation";

import { getSessionUser } from "@/lib/server/auth";
import { listWarehouses } from "@/lib/server/warehouses";

import { setWarehouseStatusAction } from "./actions";
import { WarehouseCreateForm } from "./warehouse-create-form";

export const dynamic = "force-dynamic";

const btnClass =
  "rounded border border-zinc-300 px-3 py-1 text-xs font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800";

export default async function WarehousesPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.role !== "SUPERADMIN") redirect("/dashboard"); // warehouse master data is Superadmin-managed

  const warehouses = await listWarehouses();

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-8 p-6 sm:p-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Data Gudang</h1>
        <p className="text-sm text-zinc-500">Struktur operasional — dikelola Superadmin.</p>
      </header>

      <section className="rounded-lg border border-zinc-200 p-5 dark:border-zinc-800">
        <h2 className="mb-4 text-lg font-semibold">Tambah Gudang</h2>
        <WarehouseCreateForm />
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Semua Gudang</h2>
        <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
          <table className="w-full text-left text-sm">
            <thead className="bg-zinc-50 text-xs uppercase tracking-wide text-zinc-500 dark:bg-zinc-900">
              <tr>
                <th className="px-4 py-2">Kode</th>
                <th className="px-4 py-2">Nama</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {warehouses.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-4 text-zinc-500">
                    Belum ada Gudang.
                  </td>
                </tr>
              )}
              {warehouses.map((w) => {
                const active = w.status === "ACTIVE";
                return (
                  <tr key={w.id}>
                    <td className="px-4 py-2 font-medium">{w.code}</td>
                    <td className="px-4 py-2">{w.name}</td>
                    <td className="px-4 py-2">
                      <span
                        className={`rounded px-2 py-0.5 text-xs font-semibold ${
                          active
                            ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200"
                            : "bg-zinc-200 text-zinc-700 dark:bg-zinc-700 dark:text-zinc-200"
                        }`}
                      >
                        {w.status}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-right">
                      <form action={setWarehouseStatusAction} className="inline">
                        <input type="hidden" name="id" value={w.id} />
                        <input type="hidden" name="status" value={active ? "INACTIVE" : "ACTIVE"} />
                        <button type="submit" className={btnClass}>
                          {active ? "Nonaktifkan" : "Aktifkan"}
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
