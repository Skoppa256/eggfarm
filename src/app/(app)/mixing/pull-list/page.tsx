import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { getSessionUser } from "@/lib/server/auth";
import { findMixing } from "@/lib/server/mixing";

import { PrintButton } from "./print-button";

export const dynamic = "force-dynamic";

// Printable per-kandang ingredient pull-list for the feed warehouse (FR-86): the recipe
// lines with weights and units, suitable for hand-off. Print CSS hides the chrome.
export default async function PullListPage({
  searchParams,
}: {
  searchParams: Promise<{ farmhouseId?: string; date?: string }>;
}) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.role === "OWNER") redirect("/dashboard");

  const sp = await searchParams;
  if (!sp.farmhouseId || !sp.date || !/^\d{4}-\d{2}-\d{2}$/.test(sp.date)) notFound();

  const mix = await findMixing(sp.farmhouseId, new Date(`${sp.date}T00:00:00Z`));
  if (!mix) notFound();
  const farmhouse = mix.farmhouse;

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-5 p-6 sm:p-8">
      <div className="flex items-center justify-between print:hidden">
        <Link
          href={`/mixing?farmhouseId=${sp.farmhouseId}&date=${sp.date}&intake=${mix.projectedIntake.toString()}`}
          className="text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200"
        >
          ← Kembali ke mixing
        </Link>
        <PrintButton />
      </div>

      <header className="border-b border-zinc-300 pb-3">
        <h1 className="text-xl font-bold">Pull-list Pakan</h1>
        <div className="mt-1 text-sm">
          <div>
            <span className="text-zinc-500">Kandang:</span>{" "}
            <span className="font-medium">
              {farmhouse ? `${farmhouse.name} (${farmhouse.code})` : sp.farmhouseId}
            </span>
          </div>
          <div>
            <span className="text-zinc-500">Hari konsumsi:</span>{" "}
            <span className="font-medium tabular-nums">{sp.date}</span>
          </div>
          <div>
            <span className="text-zinc-500">JENIS:</span>{" "}
            <span className="font-medium">{mix.jenis || "— (tidak ada campuran segar)"}</span>
          </div>
          <div>
            <span className="text-zinc-500">PAKAN MASUK:</span>{" "}
            <span className="font-medium tabular-nums">{mix.totalCampur.toFixed(3)} kg</span>
          </div>
        </div>
      </header>

      <table className="w-full text-left text-sm">
        <thead className="border-b border-zinc-300 text-xs uppercase tracking-wide text-zinc-500">
          <tr>
            <th className="py-2">Bahan</th>
            <th className="py-2 text-right">Berat</th>
            <th className="py-2 pl-3">Satuan</th>
          </tr>
        </thead>
        <tbody>
          {mix.lines.map((l) => (
            <tr key={l.id} className="border-b border-zinc-100">
              <td className="py-2 font-medium">{l.ingredient.name}</td>
              <td className="py-2 text-right tabular-nums">{l.computedWeight.toFixed(3)}</td>
              <td className="py-2 pl-3">{l.ingredient.baseUnit}</td>
            </tr>
          ))}
          <tr className="font-semibold">
            <td className="py-2">Total campuran segar</td>
            <td className="py-2 text-right tabular-nums">{mix.totalCampur.toFixed(3)}</td>
            <td className="py-2 pl-3">kg</td>
          </tr>
        </tbody>
      </table>
    </main>
  );
}
