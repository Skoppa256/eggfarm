import { redirect } from "next/navigation";

import { getSessionUser } from "@/lib/server/auth";
import { listUsers } from "@/lib/server/users";

import { setUserStatusAction } from "./actions";
import { UserCreateForm } from "./user-create-form";

export const dynamic = "force-dynamic";

function formatDate(value: Date | null): string {
  return value ? value.toISOString().slice(0, 10) : "—";
}

export default async function UsersPage() {
  const current = await getSessionUser();
  if (!current) {
    redirect("/login");
  }
  // Defense in depth: the layout shows the link only to Superadmin, but the page
  // enforces it too (a server component is reachable directly).
  if (current.role !== "SUPERADMIN") {
    redirect("/warehouse");
  }

  const users = await listUsers();

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-8 p-6 sm:p-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Pengguna</h1>
        <p className="text-sm text-zinc-500">Superadmin mengelola semua akun.</p>
      </header>

      <section className="rounded-lg border border-zinc-200 p-5 dark:border-zinc-800">
        <h2 className="mb-4 text-lg font-semibold">Tambah Pengguna</h2>
        <UserCreateForm />
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Semua Pengguna</h2>
        <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
          <table className="w-full text-left text-sm">
            <thead className="bg-zinc-50 text-xs uppercase tracking-wide text-zinc-500 dark:bg-zinc-900">
              <tr>
                <th className="px-4 py-2">Nama</th>
                <th className="px-4 py-2">Nama pengguna</th>
                <th className="px-4 py-2">Peran</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2">Login terakhir</th>
                <th className="px-4 py-2 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {users.map((u) => {
                const isSelf = u.id === current.id;
                const active = u.status === "ACTIVE";
                return (
                  <tr key={u.id}>
                    <td className="px-4 py-2 font-medium">{u.name}</td>
                    <td className="px-4 py-2">{u.username}</td>
                    <td className="px-4 py-2">{u.role}</td>
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
                    <td className="px-4 py-2 text-zinc-500">{formatDate(u.lastLoginAt)}</td>
                    <td className="px-4 py-2 text-right">
                      {isSelf ? (
                        <span className="text-xs text-zinc-400">(Anda)</span>
                      ) : (
                        <form action={setUserStatusAction} className="inline">
                          <input type="hidden" name="userId" value={u.id} />
                          <input
                            type="hidden"
                            name="status"
                            value={active ? "INACTIVE" : "ACTIVE"}
                          />
                          <button
                            type="submit"
                            className="rounded border border-zinc-300 px-3 py-1 text-xs font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
                          >
                            {active ? "Nonaktifkan" : "Aktifkan"}
                          </button>
                        </form>
                      )}
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
