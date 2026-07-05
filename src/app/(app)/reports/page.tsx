import Link from "next/link";
import { redirect } from "next/navigation";

import { getSessionUser } from "@/lib/server/auth";
import { reportsForRole } from "@/lib/server/reports";

export const dynamic = "force-dynamic";

export default async function ReportsHubPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const reports = reportsForRole(user.role);
  const isOps = user.role === "ADMIN" || user.role === "SUPERADMIN";

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-6 p-6 sm:p-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Reports</h1>
        <p className="text-sm text-zinc-500">
          Read-only standard reports (SRS §8.1). Each is filterable and exports to Excel.
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
            <div className="font-medium">Feed Mixing Pull-List</div>
            <div className="mt-0.5 text-xs text-zinc-500">
              Printable per-kandang ingredient list — pick a kandang &amp; day in Mixing, then Pull-list.
            </div>
          </Link>
        )}
      </div>
    </main>
  );
}
