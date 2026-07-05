import { redirect } from "next/navigation";

import { businessToday, formatDateOnly } from "@/lib/dates";
import { isPcsGrade } from "@/lib/grades";
import { getSessionUser } from "@/lib/server/auth";
import {
  listActiveFarmhouses,
  listGradeTypes as listActiveGradeTypes,
} from "@/lib/server/catalog";
import { listCollections } from "@/lib/server/collections";
import { resolveMaxBatches, resolveWarehouseId } from "@/lib/server/farmhouses";
import { availableFromCollection, listGradings } from "@/lib/server/grading";
import { PCS_PER_RAK } from "@/lib/units";

import { GradingForm } from "./grading-form";

export const dynamic = "force-dynamic";

const fieldClass =
  "rounded border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900";

export default async function GradingPage({
  searchParams,
}: {
  searchParams: Promise<{ farmhouseId?: string; date?: string }>;
}) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.role === "OWNER") redirect("/dashboard"); // grading input is Admin-only

  const sp = await searchParams;
  const [farmhouses, gradeTypes] = await Promise.all([
    listActiveFarmhouses(),
    listActiveGradeTypes(),
  ]);

  const dateStr =
    sp.date && /^\d{4}-\d{2}-\d{2}$/.test(sp.date) ? sp.date : formatDateOnly(businessToday());
  const farmhouseId =
    sp.farmhouseId && farmhouses.some((f) => f.id === sp.farmhouseId) ? sp.farmhouseId : undefined;

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-6 p-6 sm:p-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Grading</h1>
        <p className="text-sm text-zinc-500">
          Grade each batch by Type × Size &amp; Health. Sequential: batch N needs N−1 submitted.
          Submitting posts every graded SKU to the warehouse.
        </p>
      </header>

      <form
        method="get"
        className="flex flex-wrap items-end gap-3 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800"
      >
        <label className="flex flex-col gap-1 text-sm font-medium">
          Kandang
          <select name="farmhouseId" defaultValue={farmhouseId ?? ""} className={fieldClass}>
            <option value="">Select…</option>
            {farmhouses.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name} ({f.code})
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          Business date
          <input type="date" name="date" defaultValue={dateStr} className={fieldClass} />
        </label>
        <button
          type="submit"
          className="rounded bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900"
        >
          Load
        </button>
      </form>

      {farmhouseId ? (
        <BatchGrading farmhouseId={farmhouseId} dateStr={dateStr} gradeTypes={gradeTypes} />
      ) : (
        <p className="text-sm text-zinc-500">Choose a kandang and date, then Load.</p>
      )}
    </main>
  );
}

async function BatchGrading({
  farmhouseId,
  dateStr,
  gradeTypes,
}: {
  farmhouseId: string;
  dateStr: string;
  gradeTypes: { id: string; name: string }[];
}) {
  const date = new Date(`${dateStr}T00:00:00Z`);
  const [warehouseId, maxBatches, collections, gradings] = await Promise.all([
    resolveWarehouseId(farmhouseId, date),
    resolveMaxBatches(farmhouseId, date),
    listCollections(farmhouseId, date),
    listGradings(farmhouseId, date),
  ]);

  if (!warehouseId) {
    return (
      <p className="rounded border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
        This kandang has no warehouse mapping for {dateStr}.
      </p>
    );
  }
  if (maxBatches == null) {
    return (
      <p className="rounded border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
        This kandang has no batch configuration for {dateStr}.
      </p>
    );
  }

  const collectionByBatch = new Map(collections.map((c) => [c.batchNumber, c]));
  const gradingByBatch = new Map(gradings.map((g) => [g.batchNumber, g]));

  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold">
        Grading for {dateStr} <span className="text-sm font-normal text-zinc-500">(max {maxBatches})</span>
      </h2>
      {Array.from({ length: maxBatches }, (_, i) => i + 1).map((batch) => {
        const collection = collectionByBatch.get(batch);
        const grading = gradingByBatch.get(batch);
        const prevSubmitted = batch === 1 || gradingByBatch.get(batch - 1)?.status === "SUBMITTED";
        const status = grading?.status ?? "NONE";

        return (
          <div key={batch} className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-semibold">Batch {batch}</h3>
              <span
                className={`rounded px-2 py-0.5 text-xs font-semibold ${
                  status === "SUBMITTED"
                    ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200"
                    : status === "DRAFT"
                      ? "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200"
                      : "bg-zinc-200 text-zinc-600 dark:bg-zinc-700 dark:text-zinc-200"
                }`}
              >
                {status === "NONE" ? "Not started" : status}
              </span>
            </div>

            {!collection ? (
              <p className="text-sm text-amber-700 dark:text-amber-300">
                No collection recorded for this batch — record it first.
              </p>
            ) : !prevSubmitted ? (
              <p className="text-sm text-amber-700 dark:text-amber-300">
                Locked — submit batch {batch - 1} first.
              </p>
            ) : (
              <GradingForm
                hiddenFields={[
                  { name: "farmhouseId", value: farmhouseId },
                  { name: "date", value: dateStr },
                  { name: "batchNumber", value: String(batch) },
                ]}
                gradeTypes={gradeTypes}
                available={availableFromCollection(collection)}
                status={status}
                remarks={grading?.remarks ?? ""}
                defaultsBySku={Object.fromEntries(
                  (grading?.lineItems ?? []).map((li) => [
                    `${li.typeGradeId}:${li.sizeHealthGrade}`,
                    isPcsGrade(li.sizeHealthGrade) ? li.quantity : li.quantity / PCS_PER_RAK,
                  ]),
                )}
              />
            )}
          </div>
        );
      })}
    </section>
  );
}
