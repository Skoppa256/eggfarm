"use client";

import { useActionState, useState } from "react";

import type { SizeHealthGrade } from "@/generated/prisma/enums";
import type { ActionResult } from "@/lib/action-result";
import { GRADEABLE_GRADES, gradeLabel, isPcsGrade } from "@/lib/grades";
import { formatPcs, PCS_PER_RAK } from "@/lib/units";

import { saveDraftAction, submitGradingAction } from "./actions";

const cellClass =
  "w-20 rounded border border-zinc-300 px-2 py-1 text-right text-sm dark:border-zinc-700 dark:bg-zinc-900";

type TypeOption = { id: string; name: string };

function sumGraded(form: HTMLFormElement): number {
  let total = 0;
  for (const el of Array.from(form.elements)) {
    if (el instanceof HTMLInputElement && el.name.startsWith("q:")) {
      const grade = el.name.split(":")[2] as SizeHealthGrade;
      const n = Number(el.value) || 0;
      total += isPcsGrade(grade) ? n : n * PCS_PER_RAK;
    }
  }
  return total;
}

export function GradingForm({
  hiddenFields,
  gradeTypes,
  available,
  status,
  defaultsBySku,
  remarks,
}: {
  hiddenFields: { name: string; value: string }[];
  gradeTypes: TypeOption[];
  available: number;
  status: "NONE" | "DRAFT" | "SUBMITTED";
  defaultsBySku: Record<string, number>;
  remarks: string;
}) {
  const [draftState, draftAction, draftPending] = useActionState<ActionResult | null, FormData>(
    saveDraftAction,
    null,
  );
  const [submitState, submitAction, submitPending] = useActionState<ActionResult | null, FormData>(
    submitGradingAction,
    null,
  );
  const [graded, setGraded] = useState(0);
  const pending = draftPending || submitPending;
  const state = submitState ?? draftState;
  const over = graded > available;

  return (
    <form className="flex flex-col gap-3" onInput={(e) => setGraded(sumGraded(e.currentTarget))}>
      {hiddenFields.map((h) => (
        <input key={h.name} type="hidden" name={h.name} value={h.value} />
      ))}

      <div className="overflow-x-auto">
        <table className="text-sm">
          <thead>
            <tr className="text-xs uppercase tracking-wide text-zinc-500">
              <th className="px-2 py-1 text-left">Grade</th>
              {gradeTypes.map((t) => (
                <th key={t.id} className="px-2 py-1 text-right">
                  {t.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {GRADEABLE_GRADES.map((grade) => (
              <tr key={grade}>
                <td className="whitespace-nowrap px-2 py-1 font-medium">
                  {gradeLabel(grade)}{" "}
                  <span className="text-xs text-zinc-400">({isPcsGrade(grade) ? "pcs" : "rak"})</span>
                </td>
                {gradeTypes.map((t) => (
                  <td key={t.id} className="px-1 py-1">
                    <input
                      type="number"
                      min={0}
                      name={`q:${t.id}:${grade}`}
                      defaultValue={defaultsBySku[`${t.id}:${grade}`] ?? 0}
                      className={cellClass}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className={`text-sm font-medium ${over ? "text-rose-600" : "text-zinc-600 dark:text-zinc-300"}`}>
        Graded {formatPcs(graded)} / available {formatPcs(available)}
        {over ? ` — over by ${graded - available} pcs` : ""}
      </div>

      <label className="flex flex-col gap-1 text-xs font-medium">
        Remarks
        <input
          name="remarks"
          defaultValue={remarks}
          className="rounded border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        />
      </label>

      <div className="flex items-center gap-3">
        {status !== "SUBMITTED" && (
          <button
            type="submit"
            formAction={draftAction}
            disabled={pending}
            className="rounded border border-zinc-300 px-3 py-1.5 text-sm font-medium hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
          >
            Save draft
          </button>
        )}
        <button
          type="submit"
          formAction={submitAction}
          disabled={pending}
          className="rounded bg-emerald-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
        >
          {status === "SUBMITTED" ? "Update (re-submit)" : "Submit"}
        </button>
        {state && !state.ok && (
          <span role="alert" className="text-sm font-medium text-rose-600">
            {state.error}
          </span>
        )}
        {state && state.ok && (
          <span role="status" className="text-sm font-medium text-emerald-600">
            {state.message}
          </span>
        )}
      </div>
    </form>
  );
}
