"use client";

import { useActionState } from "react";

import type { ActionResult } from "@/lib/action-result";

import { FormFeedback, useDismissableFeedback } from "../form-feedback";
import { createCollectionAction, updateCollectionAction } from "./actions";

const fieldClass =
  "rounded border border-zinc-300 px-2 py-2 text-sm focus:border-zinc-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900";

type TypeOption = { id: string; name: string };

export type CollectionFormDefaults = {
  goodEggs: number;
  telurRetak: number;
  telurLunak: number;
  telurKosong: number;
  remarks: string;
  /** Angkat Rak default value (in rak) per Grade-by-Type id. */
  liftRakByType: Record<string, number>;
};

export function CollectionForm({
  mode,
  gradeTypes,
  hiddenFields,
  defaults,
  canOverrideLock = false,
}: {
  mode: "create" | "edit";
  gradeTypes: TypeOption[];
  hiddenFields: { name: string; value: string }[];
  defaults: CollectionFormDefaults;
  /** Superadmin-only: show the "override grading lock" opt-in on an edit form. */
  canOverrideLock?: boolean;
}) {
  const action = mode === "create" ? createCollectionAction : updateCollectionAction;
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(action, null);
  const fb = useDismissableFeedback();

  return (
    <form action={formAction} {...fb.formProps} className="flex flex-col gap-3">
      {hiddenFields.map((h) => (
        <input key={h.name} type="hidden" name={h.name} value={h.value} />
      ))}

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <label className="flex flex-col gap-1 text-xs font-medium">
          Bagus (pcs)
          <input type="number" inputMode="numeric" name="goodEggs" min={0} defaultValue={defaults.goodEggs} className={fieldClass} />
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium">
          Retak (pcs)
          <input type="number" inputMode="numeric" name="telurRetak" min={0} defaultValue={defaults.telurRetak} className={fieldClass} />
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium">
          Lunak (pcs)
          <input type="number" inputMode="numeric" name="telurLunak" min={0} defaultValue={defaults.telurLunak} className={fieldClass} />
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium">
          Kosong (pcs)
          <input type="number" inputMode="numeric" name="telurKosong" min={0} defaultValue={defaults.telurKosong} className={fieldClass} />
        </label>
      </div>

      <fieldset className="rounded border border-zinc-200 p-2 dark:border-zinc-800">
        <legend className="px-1 text-xs font-semibold text-zinc-500">Angkat Rak (rak) per Tipe</legend>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {gradeTypes.map((t) => (
            <label key={t.id} className="flex flex-col gap-1 text-xs font-medium">
              {t.name}
              <input
                type="number"
                inputMode="numeric"
                name={`rak_${t.id}`}
                min={0}
                defaultValue={defaults.liftRakByType[t.id] ?? 0}
                className={fieldClass}
              />
            </label>
          ))}
        </div>
      </fieldset>

      <label className="flex flex-col gap-1 text-xs font-medium">
        Keterangan
        <input name="remarks" defaultValue={defaults.remarks} className={fieldClass} />
      </label>

      {mode === "edit" && canOverrideLock && (
        <label className="flex items-center gap-2 text-xs font-medium text-amber-700 dark:text-amber-300">
          <input type="checkbox" name="allowGradedEdit" />
          Override kunci Grading (Superadmin) — edit walaupun batch ini sudah di-Grading
        </label>
      )}

      <div className="flex flex-col gap-2">
        <button
          type="submit"
          disabled={pending}
          className="min-h-11 rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
        >
          {pending ? "Menyimpan…" : mode === "create" ? "Simpan batch" : "Perbarui batch"}
        </button>
        <FormFeedback state={state} dirty={fb.dirty} />
      </div>
    </form>
  );
}
