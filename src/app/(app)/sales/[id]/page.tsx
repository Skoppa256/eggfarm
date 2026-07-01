import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { gradeLabel } from "@/lib/grades";
import { getSessionUser } from "@/lib/server/auth";
import { findSale } from "@/lib/server/sales";
import { formatPcs } from "@/lib/units";

import { VoidForm } from "./void-form";

export const dynamic = "force-dynamic";

export default async function SaleDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.role === "OWNER") redirect("/warehouse");

  const { id } = await params;
  const sale = await findSale(id);
  if (!sale) notFound();

  const total = sale.lineItems.reduce((n, l) => n + l.quantity, 0);
  const voided = sale.status === "VOIDED";

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-5 p-6 sm:p-8">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Sale</h1>
        <Link href="/sales" className="text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200">
          ← All sales
        </Link>
      </header>

      <section className="grid grid-cols-2 gap-2 rounded-lg border border-zinc-200 p-4 text-sm dark:border-zinc-800 sm:grid-cols-4">
        <div>
          <div className="text-xs text-zinc-500">Buyer</div>
          <div className="font-medium">{sale.buyer.name}</div>
        </div>
        <div>
          <div className="text-xs text-zinc-500">Warehouse</div>
          <div className="font-medium">{sale.warehouse.code}</div>
        </div>
        <div>
          <div className="text-xs text-zinc-500">Date</div>
          <div className="font-medium">{sale.date.toISOString().slice(0, 10)}</div>
        </div>
        <div>
          <div className="text-xs text-zinc-500">Status</div>
          <div className={`font-semibold ${voided ? "text-zinc-500" : "text-emerald-600"}`}>
            {sale.status}
          </div>
        </div>
        {sale.notes && (
          <div className="col-span-2 sm:col-span-4">
            <div className="text-xs text-zinc-500">Note</div>
            <div>{sale.notes}</div>
          </div>
        )}
      </section>

      <section>
        <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
          <table className="w-full text-left text-sm">
            <thead className="bg-zinc-50 text-xs uppercase tracking-wide text-zinc-500 dark:bg-zinc-900">
              <tr>
                <th className="px-4 py-2">Grade / Type</th>
                <th className="px-4 py-2">Entered as</th>
                <th className="px-4 py-2 text-right">Quantity</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {sale.lineItems.map((l) => (
                <tr key={l.id}>
                  <td className="px-4 py-2">
                    {gradeLabel(l.sizeHealthGrade)} / {l.gradeType.name}
                  </td>
                  <td className="px-4 py-2 text-zinc-500">{l.unitUsed}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{formatPcs(l.quantity)}</td>
                </tr>
              ))}
              <tr className="font-semibold">
                <td className="px-4 py-2" colSpan={2}>
                  Total
                </td>
                <td className="px-4 py-2 text-right tabular-nums">{formatPcs(total)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {voided ? (
        <section className="rounded-lg border border-zinc-300 bg-zinc-50 p-4 text-sm dark:border-zinc-700 dark:bg-zinc-900">
          <div className="font-semibold">Voided</div>
          <div className="text-zinc-600 dark:text-zinc-300">
            {sale.voidReason} — by {sale.voidedBy?.name ?? "—"}
            {sale.voidedAt ? ` on ${sale.voidedAt.toISOString().slice(0, 10)}` : ""}
          </div>
        </section>
      ) : (
        <section className="rounded-lg border border-rose-200 p-4 dark:border-rose-900">
          <h2 className="mb-2 text-sm font-semibold text-rose-700 dark:text-rose-300">Void this sale</h2>
          <VoidForm transactionId={sale.id} />
        </section>
      )}
    </main>
  );
}
