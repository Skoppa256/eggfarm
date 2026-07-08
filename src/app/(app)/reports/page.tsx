import Link from "next/link";
import { redirect } from "next/navigation";

import { getSessionUser } from "@/lib/server/auth";
import { reportsForRole } from "@/lib/server/reports";

export const dynamic = "force-dynamic";

export default async function ReportsHubPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.role === "ADMIN") redirect("/dashboard"); // reports are Owner/Superadmin only

  const reports = reportsForRole(user.role);
  const isOps = user.role === "SUPERADMIN";

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-6 p-6 sm:p-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Laporan</h1>
        <p className="text-sm text-zinc-500">
          Laporan standar (hanya-baca, SRS §8.1). Masing-masing dapat difilter dan diekspor ke Excel.
        </p>
      </header>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {reports.map((r) => (
          <Link
            key={r.slug}
            href={`/reports/${r.slug}`}
            className="rounded-lg border border-zinc-200 p-4 hover:border-zinc-400 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:border-zinc-600 dark:hover:bg-zinc-900"
          >
            <div className="font-medium">{r.title}</div>
            <div className="mt-0.5 text-xs text-zinc-500">{r.description}</div>
          </Link>
        ))}
        {isOps && (
          <Link
            href="/mixing"
            className="rounded-lg border border-zinc-200 p-4 hover:border-zinc-400 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:border-zinc-600 dark:hover:bg-zinc-900"
          >
            <div className="font-medium">Pull-List Mixing Pakan</div>
            <div className="mt-0.5 text-xs text-zinc-500">
              Daftar bahan pakan per kandang yang dapat dicetak — pilih kandang &amp; hari di Mixing, lalu Pull-list.
            </div>
          </Link>
        )}
      </div>
    </main>
  );
}
