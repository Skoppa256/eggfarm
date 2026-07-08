import { redirect } from "next/navigation";

import { getSessionUser } from "@/lib/server/auth";
import { listBuyers } from "@/lib/server/buyers";

import { renameBuyerAction, setBuyerStatusAction } from "./actions";
import { BuyerCreateForm } from "./buyer-create-form";

export const dynamic = "force-dynamic";

const inputClass =
  "rounded border border-zinc-300 px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-900";
const btnClass =
  "rounded border border-zinc-300 px-2 py-1 text-xs font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800";

export default async function BuyersPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.role === "OWNER") redirect("/dashboard");

  const buyers = await listBuyers();

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-6 p-6 sm:p-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Pembeli</h1>
        <p className="text-sm text-zinc-500">
          Pembeli yang dinonaktifkan tetap ada di riwayat tetapi tidak dapat digunakan untuk Penjualan baru.
        </p>
      </header>

      <section className="rounded-lg border border-zinc-200 p-5 dark:border-zinc-800">
        <h2 className="mb-4 text-lg font-semibold">Tambah Pembeli</h2>
        <BuyerCreateForm />
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Semua Pembeli</h2>
        <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
          <table className="w-full text-left text-sm">
            <thead className="bg-zinc-50 text-xs uppercase tracking-wide text-zinc-500 dark:bg-zinc-900">
              <tr>
                <th className="px-4 py-2">Nama</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {buyers.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-4 py-4 text-zinc-500">
                    Belum ada Pembeli.
                  </td>
                </tr>
              )}
              {buyers.map((b) => {
                const active = b.status === "ACTIVE";
                return (
                  <tr key={b.id}>
                    <td className="px-4 py-2">
                      <form action={renameBuyerAction} className="flex items-center gap-2">
                        <input type="hidden" name="id" value={b.id} />
                        <input name="name" defaultValue={b.name} className={inputClass} />
                        <button type="submit" className={btnClass}>
                          Simpan
                        </button>
                      </form>
                    </td>
                    <td className="px-4 py-2">
                      <span
                        className={`rounded px-2 py-0.5 text-xs font-semibold ${
                          active
                            ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200"
                            : "bg-zinc-200 text-zinc-700 dark:bg-zinc-700 dark:text-zinc-200"
                        }`}
                      >
                        {b.status}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-right">
                      <form action={setBuyerStatusAction} className="inline">
                        <input type="hidden" name="id" value={b.id} />
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
