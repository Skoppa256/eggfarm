"use client";

import { useActionState } from "react";

import type { ActionResult } from "@/lib/action-result";
import { gradeLabel, SIZE_HEALTH_GRADES } from "@/lib/grades";

import { correctionAction } from "./actions";

const fieldClass =
  "rounded border border-zinc-300 px-2 py-1.5 text-sm focus:border-zinc-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900";

export function CorrectionForm({
  warehouseId,
  gradeTypes,
}: {
  warehouseId: string;
  gradeTypes: { id: string; name: string }[];
}) {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(
    correctionAction,
    null,
  );

  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="warehouseId" value={warehouseId} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm font-medium">
          Grade Ukuran &amp; Kesehatan
          <select name="sizeHealthGrade" defaultValue={SIZE_HEALTH_GRADES[0]} className={fieldClass}>
            {SIZE_HEALTH_GRADES.map((g) => (
              <option key={g} value={g}>
                {gradeLabel(g)}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          Tipe Telur
          <select name="typeGradeId" defaultValue={gradeTypes[0]?.id} className={fieldClass}>
            {gradeTypes.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          Mode
          <select name="mode" defaultValue="absolute" className={fieldClass}>
            <option value="absolute">Set jumlah terkoreksi (pcs)</option>
            <option value="delta">Sesuaikan dengan delta (pcs, +/−)</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          Nilai (pcs)
          <input type="number" name="value" step={1} required className={fieldClass} />
        </label>
      </div>

      <label className="flex flex-col gap-1 text-sm font-medium">
        Alasan (≥ 20 karakter — wajib)
        <textarea name="reason" required minLength={20} rows={2} className={fieldClass} />
      </label>

      <label className="flex flex-col gap-1 text-sm font-medium">
        Referensi (opsional)
        <input name="reference" className={fieldClass} />
      </label>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-50"
        >
          Kirim koreksi
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
      <p className="text-xs text-zinc-500">
        Koreksi bersifat permanen — untuk memperbaiki kesalahan, kirim koreksi lain.
      </p>
    </form>
  );
}
