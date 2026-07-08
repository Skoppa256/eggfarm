"use client";

import { useActionState } from "react";

import type { ActionResult } from "@/lib/action-result";

import { createDailyRecordAction, updateDailyRecordAction } from "./actions";

const fieldClass =
  "rounded border border-zinc-300 px-2 py-1.5 text-sm focus:border-zinc-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900";
const roClass = `${fieldClass} bg-zinc-100 text-zinc-500 dark:bg-zinc-800`;

export type DailyFormDefaults = {
  mati: number;
  afkir: number;
  sisaDigunakan: number;
  sisaDibuang: number;
  beratTelur: number;
  beratBadan: string; // may be blank
  obatNote: string;
  vitaminNote: string;
  keterangan: string;
};

export function DailyForm({
  mode,
  hiddenFields,
  defaults,
  matiAfkirLocked,
  lockNote,
}: {
  mode: "create" | "edit";
  hiddenFields: { name: string; value: string }[];
  defaults: DailyFormDefaults;
  /** MATI/AFKIR are read-only (edit — frozen; or chick-in day — must be 0). */
  matiAfkirLocked: boolean;
  lockNote?: string;
}) {
  const action = mode === "create" ? createDailyRecordAction : updateDailyRecordAction;
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(action, null);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      {hiddenFields.map((h) => (
        <input key={h.name} type="hidden" name={h.name} value={h.value} />
      ))}

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <label className="flex flex-col gap-1 text-xs font-medium">
          MATI (ekor)
          <input
            type="number"
            name="mati"
            min={0}
            step={1}
            defaultValue={defaults.mati}
            readOnly={matiAfkirLocked}
            className={matiAfkirLocked ? roClass : fieldClass}
          />
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium">
          AFKIR (ekor)
          <input
            type="number"
            name="afkir"
            min={0}
            step={1}
            defaultValue={defaults.afkir}
            readOnly={matiAfkirLocked}
            className={matiAfkirLocked ? roClass : fieldClass}
          />
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium">
          SISA DIGUNAKAN (kg)
          <input type="number" name="sisaDigunakan" min={0} step="0.001" defaultValue={defaults.sisaDigunakan} className={fieldClass} />
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium">
          SISA DIBUANG (kg)
          <input type="number" name="sisaDibuang" min={0} step="0.001" defaultValue={defaults.sisaDibuang} className={fieldClass} />
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium">
          BERAT TELUR (kg)
          <input type="number" name="beratTelur" min={0} step="0.001" defaultValue={defaults.beratTelur} className={fieldClass} />
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium">
          BERAT BADAN (opsional)
          <input type="number" name="beratBadan" min={0} step="0.01" defaultValue={defaults.beratBadan} className={fieldClass} />
        </label>
      </div>

      {matiAfkirLocked && lockNote && <p className="text-xs text-amber-600 dark:text-amber-400">{lockNote}</p>}

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <label className="flex flex-col gap-1 text-xs font-medium">
          OBAT (catatan)
          <input name="obatNote" defaultValue={defaults.obatNote} className={fieldClass} />
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium">
          VITAMIN (catatan)
          <input name="vitaminNote" defaultValue={defaults.vitaminNote} className={fieldClass} />
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium">
          KETERANGAN
          <input name="keterangan" defaultValue={defaults.keterangan} className={fieldClass} />
        </label>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded bg-zinc-900 px-3 py-1.5 text-sm font-semibold text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
        >
          {mode === "create" ? "Simpan Catatan Harian" : "Perbarui Catatan"}
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
