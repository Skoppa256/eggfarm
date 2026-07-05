import Link from "next/link";
import { redirect } from "next/navigation";

import { getSessionUser } from "@/lib/server/auth";
import { listFlocks } from "@/lib/server/flocks";

export const dynamic = "force-dynamic";

export default async function FlocksPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.role === "OWNER") redirect("/dashboard");

  const flocks = await listFlocks();
  const isSuperadmin = user.role === "SUPERADMIN";

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-5 p-6 sm:p-8">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Flocks</h1>
          <p className="text-sm text-zinc-500">Chick-in deliveries and their placements.</p>
        </div>
        {isSuperadmin && (
          <Link
            href="/flocks/new"
            className="rounded bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900"
          >
            New chick-in
          </Link>
        )}
      </header>

      <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
        <table className="w-full text-left text-sm">
          <thead className="bg-zinc-50 text-xs uppercase tracking-wide text-zinc-500 dark:bg-zinc-900">
            <tr>
              <th className="px-4 py-2">Strain</th>
              <th className="px-4 py-2">Chick-in</th>
              <th className="px-4 py-2 text-right">Age (d)</th>
              <th className="px-4 py-2">Kandang</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2 text-right"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {flocks.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-4 text-zinc-500">
                  No flocks yet.
                </td>
              </tr>
            )}
            {flocks.map((f) => (
              <tr key={f.id}>
                <td className="px-4 py-2 font-medium">{f.strain}</td>
                <td className="px-4 py-2">{f.chickInDate.toISOString().slice(0, 10)}</td>
                <td className="px-4 py-2 text-right tabular-nums">{f.placementAge}</td>
                <td className="px-4 py-2 text-zinc-600 dark:text-zinc-300">
                  {f.placements.map((p) => p.farmhouse.code).join(", ") || "—"}
                </td>
                <td className="px-4 py-2">
                  <span
                    className={`rounded px-2 py-0.5 text-xs font-semibold ${
                      f.status === "ACTIVE"
                        ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200"
                        : "bg-zinc-200 text-zinc-700 dark:bg-zinc-700 dark:text-zinc-200"
                    }`}
                  >
                    {f.status}
                  </span>
                </td>
                <td className="px-4 py-2 text-right">
                  <Link href={`/flocks/${f.id}`} className="text-xs font-medium text-zinc-600 underline dark:text-zinc-300">
                    View
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
