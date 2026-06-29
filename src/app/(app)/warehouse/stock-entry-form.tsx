"use client";

import { useActionState } from "react";

import { SIZE_HEALTH_GRADES, gradeLabel } from "@/lib/grades";
import { recordMovementAction, type ActionResult } from "./actions";

type GradeTypeOption = { id: string; name: string };

const fieldClass =
  "rounded border border-zinc-300 px-2 py-1.5 text-sm focus:border-zinc-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900";

// Slice 1 foundation form: post an IN or OUT movement for one Egg SKU. This is a
// thin demonstration of the ledger; richer entry (collection, grading, sales)
// arrives in later slices. Both buttons share one form and submit a `direction`.
export function StockEntryForm({
  warehouseId,
  gradeTypes,
}: {
  warehouseId: string;
  gradeTypes: GradeTypeOption[];
}) {
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(
    recordMovementAction,
    null,
  );

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="warehouseId" value={warehouseId} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm font-medium">
          Size &amp; Health grade
          <select name="sizeHealthGrade" defaultValue={SIZE_HEALTH_GRADES[0]} className={fieldClass}>
            {SIZE_HEALTH_GRADES.map((g) => (
              <option key={g} value={g}>
                {gradeLabel(g)}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm font-medium">
          Egg type
          <select name="typeGradeId" defaultValue={gradeTypes[0]?.id} className={fieldClass}>
            {gradeTypes.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm font-medium">
          Rak
          <input type="number" name="rak" min={0} step={1} defaultValue={0} className={fieldClass} />
        </label>

        <label className="flex flex-col gap-1 text-sm font-medium">
          Loose pcs
          <input type="number" name="pcs" min={0} step={1} defaultValue={0} className={fieldClass} />
        </label>
      </div>

      <div className="flex gap-3">
        <button
          type="submit"
          name="direction"
          value="IN"
          disabled={pending}
          className="rounded bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
        >
          Stock In
        </button>
        <button
          type="submit"
          name="direction"
          value="OUT"
          disabled={pending}
          className="rounded bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-50"
        >
          Stock Out
        </button>
      </div>

      {state && !state.ok && (
        <p role="alert" className="text-sm font-medium text-rose-600">
          {state.error}
        </p>
      )}
      {state && state.ok && (
        <p role="status" className="text-sm font-medium text-emerald-600">
          {state.message}
        </p>
      )}
    </form>
  );
}
