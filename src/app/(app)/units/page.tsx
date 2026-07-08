import { redirect } from "next/navigation";

import { getSessionUser } from "@/lib/server/auth";
import { listMeasurementUnits } from "@/lib/server/measurementUnits";

import { setUnitStatusAction } from "./actions";
import { UnitCreateForm } from "./unit-create-form";

export const dynamic = "force-dynamic";

const btnClass =
  "rounded border border-zinc-300 px-3 py-1 text-xs font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800";

export default async function UnitsPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  // Master data — Superadmin only.
  if (user.role !== "SUPERADMIN") redirect("/warehouse");

  const units = await listMeasurementUnits();

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-8 p-6 sm:p-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Satuan</h1>
        <p className="text-sm text-zinc-500">Data master — dikelola Superadmin.</p>
      </header>

      <section className="rounded-lg border border-zinc-200 p-5 dark:border-zinc-800">
        <h2 className="mb-4 text-lg font-semibold">Tambah Satuan</h2>
        <UnitCreateForm />
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Semua Satuan</h2>
        <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
          <table className="w-full text-left text-sm">
            <thead className="bg-zinc-50 text-xs uppercase tracking-wide text-zinc-500 dark:bg-zinc-900">
              <tr>
                <th className="px-4 py-2">Nama</th>
                <th className="px-4 py-2 text-right">Setara pcs</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {units.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-4 text-zinc-500">
                    Belum ada Satuan.
                  </td>
                </tr>
              )}
              {units.map((u) => {
                const active = u.status === "ACTIVE";
                return (
                  <tr key={u.id}>
                    <td className="px-4 py-2 font-medium">{u.name}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{u.pcsEquivalent}</td>
                    <td className="px-4 py-2">
                      <span
                        className={`rounded px-2 py-0.5 text-xs font-semibold ${
                          active
                            ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200"
                            : "bg-zinc-200 text-zinc-700 dark:bg-zinc-700 dark:text-zinc-200"
                        }`}
                      >
                        {u.status}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-right">
                      <form action={setUnitStatusAction} className="inline">
                        <input type="hidden" name="id" value={u.id} />
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
