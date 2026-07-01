import { redirect } from "next/navigation";

import { ForbiddenError, UnauthorizedError } from "@/lib/errors";
import { gradeLabel } from "@/lib/grades";
import { getSessionUser } from "@/lib/server/auth";
import { requireCorrectionAudit } from "@/lib/server/corrections";

import { WarehouseTabs } from "../warehouse-tabs";

export const dynamic = "force-dynamic";

function fmt(d: Date): string {
  return d.toISOString().replace("T", " ").slice(0, 16) + " UTC";
}

export default async function CorrectionAuditPage({
  searchParams,
}: {
  searchParams: Promise<{ warehouseId?: string }>;
}) {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  let corrections;
  try {
    // Superadmin-only (guarded server-side, not just the redirect below).
    corrections = await requireCorrectionAudit();
  } catch (err) {
    if (err instanceof UnauthorizedError) redirect("/login");
    if (err instanceof ForbiddenError) redirect("/warehouse");
    throw err;
  }

  const sp = await searchParams;

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-5 p-6 sm:p-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Correction audit</h1>
        <p className="text-sm text-zinc-500">All stock corrections, immutable — Superadmin only.</p>
      </header>

      <WarehouseTabs active="audit" warehouseId={sp.warehouseId} role={user.role} />

      {corrections.length === 0 ? (
        <p className="text-sm text-zinc-500">No corrections recorded.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
          <table className="w-full text-left text-sm">
            <thead className="bg-zinc-50 text-xs uppercase tracking-wide text-zinc-500 dark:bg-zinc-900">
              <tr>
                <th className="px-4 py-2">When</th>
                <th className="px-4 py-2">Warehouse</th>
                <th className="px-4 py-2">Grade / Type</th>
                <th className="px-4 py-2 text-right">Pre → Post</th>
                <th className="px-4 py-2 text-right">Delta</th>
                <th className="px-4 py-2">Reason</th>
                <th className="px-4 py-2">By</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {corrections.map((c) => {
                const delta = c.postQuantity - c.preQuantity;
                return (
                  <tr key={c.id}>
                    <td className="whitespace-nowrap px-4 py-2 text-zinc-500">{fmt(c.createdAt)}</td>
                    <td className="px-4 py-2">{c.warehouse.code}</td>
                    <td className="px-4 py-2">
                      {gradeLabel(c.sizeHealthGrade)} / {c.gradeType.name}
                    </td>
                    <td className="whitespace-nowrap px-4 py-2 text-right tabular-nums">
                      {c.preQuantity} → {c.postQuantity}
                    </td>
                    <td
                      className={`px-4 py-2 text-right tabular-nums ${
                        delta < 0 ? "text-rose-600" : "text-emerald-600"
                      }`}
                    >
                      {delta > 0 ? "+" : ""}
                      {delta}
                    </td>
                    <td className="px-4 py-2 text-zinc-600 dark:text-zinc-300">{c.reason}</td>
                    <td className="whitespace-nowrap px-4 py-2 text-zinc-500">
                      {c.enteredBy.name}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
