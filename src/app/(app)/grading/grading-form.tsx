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
type Unit = "rak" | "pcs";

/** The unit an input is entered in — read from the row's `u:<grade>` select/hidden field. */
function rowUnit(form: HTMLFormElement, grade: string): Unit {
  const el = form.elements.namedItem(`u:${grade}`);
  const value = el instanceof HTMLSelectElement || el instanceof HTMLInputElement ? el.value : "";
  return value === "pcs" ? "pcs" : "rak";
}

function sumGraded(form: HTMLFormElement): number {
  let total = 0;
  for (const el of Array.from(form.elements)) {
    if (el instanceof HTMLInputElement && el.name.startsWith("q:")) {
      const grade = el.name.split(":")[2];
      const n = Number(el.value) || 0;
      total += rowUnit(form, grade) === "pcs" ? n : n * PCS_PER_RAK;
    }
  }
  return total;
}

export function GradingForm({
  hiddenFields,
  gradeTypes,
  available,
  status,
  storedPcsBySku,
  remarks,
}: {
  hiddenFields: { name: string; value: string }[];
  gradeTypes: TypeOption[];
  available: number;
  status: "NONE" | "DRAFT" | "SUBMITTED";
  /** Stored quantity per `<typeId>:<grade>` SKU, in pcs (as persisted). */
  storedPcsBySku: Record<string, number>;
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

  // Default unit per grade: pcs for the inherently-pcs grades (Plastik/Lunak), or when a
  // stored quantity isn't a whole number of rak (e.g. it was entered in pcs). Otherwise rak.
  const skusOf = (grade: string) => gradeTypes.map((t) => `${t.id}:${grade}`);
  const defaultUnit = (grade: SizeHealthGrade): Unit => {
    if (isPcsGrade(grade)) return "pcs";
    return skusOf(grade).some((sku) => (storedPcsBySku[sku] ?? 0) % PCS_PER_RAK !== 0) ? "pcs" : "rak";
  };
  const cellValue = (grade: SizeHealthGrade, sku: string, unit: Unit) => {
    const pcs = storedPcsBySku[sku] ?? 0;
    return unit === "pcs" ? pcs : pcs / PCS_PER_RAK;
  };

  return (
    <form
      className="flex flex-col gap-3"
      onInput={(e) => setGraded(sumGraded(e.currentTarget))}
      onChange={(e) => setGraded(sumGraded(e.currentTarget))}
    >
      {hiddenFields.map((h) => (
        <input key={h.name} type="hidden" name={h.name} value={h.value} />
      ))}

      <div className="overflow-x-auto">
        <table className="text-sm">
          <thead>
            <tr className="text-xs uppercase tracking-wide text-zinc-500">
              <th className="px-2 py-1 text-left">Grade</th>
              <th className="px-2 py-1 text-left">Satuan</th>
              {gradeTypes.map((t) => (
                <th key={t.id} className="px-2 py-1 text-right">
                  {t.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {GRADEABLE_GRADES.map((grade) => {
              const unit = defaultUnit(grade);
              const pcsOnly = isPcsGrade(grade);
              return (
                <tr key={grade}>
                  <td className="whitespace-nowrap px-2 py-1 font-medium">{gradeLabel(grade)}</td>
                  <td className="px-2 py-1">
                    {pcsOnly ? (
                      <>
                        <span className="text-xs text-zinc-400">pcs</span>
                        <input type="hidden" name={`u:${grade}`} value="pcs" />
                      </>
                    ) : (
                      <select
                        name={`u:${grade}`}
                        defaultValue={unit}
                        className="rounded border border-zinc-300 px-1 py-1 text-xs dark:border-zinc-700 dark:bg-zinc-900"
                      >
                        <option value="rak">rak</option>
                        <option value="pcs">pcs</option>
                      </select>
                    )}
                  </td>
                  {gradeTypes.map((t) => {
                    const sku = `${t.id}:${grade}`;
                    return (
                      <td key={t.id} className="px-1 py-1">
                        <input
                          type="number"
                          min={0}
                          step={1}
                          name={`q:${sku}`}
                          defaultValue={cellValue(grade, sku, unit)}
                          className={cellClass}
                        />
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className={`text-sm font-medium ${over ? "text-rose-600" : "text-zinc-600 dark:text-zinc-300"}`}>
        Di-Grading {formatPcs(graded)} / tersedia {formatPcs(available)}
        {over ? ` — kelebihan ${graded - available} pcs` : ""}
      </div>

      <label className="flex flex-col gap-1 text-xs font-medium">
        Keterangan
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
            Simpan draf
          </button>
        )}
        <button
          type="submit"
          formAction={submitAction}
          disabled={pending}
          className="rounded bg-emerald-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
        >
          {status === "SUBMITTED" ? "Perbarui (kirim ulang)" : "Kirim"}
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
