"use client";

import { useActionState } from "react";

import type { ActionResult } from "@/lib/action-result";

import { correctIngredientAction } from "./actions";

const fieldClass =
  "rounded border border-zinc-300 px-2 py-1.5 text-sm focus:border-zinc-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900";

export function CorrectionForm({ ingredients }: { ingredients: { id: string; name: string }[] }) {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(
    correctIngredientAction,
    null,
  );

  return (
    <form action={action} className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-sm font-medium">
          Bahan
          <select name="ingredientId" required className={fieldClass}>
            <option value="">Pilih…</option>
            {ingredients.map((i) => (
              <option key={i.id} value={i.id}>
                {i.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          Saldo koreksi (kg)
          <input type="number" name="newQuantity" min="0" step="0.001" required className={fieldClass} />
        </label>
      </div>
      <label className="flex flex-col gap-1 text-sm font-medium">
        Alasan (≥ 20 karakter)
        <input name="reason" minLength={20} required placeholder="Hitung fisik setelah tumpahan pada…" className={fieldClass} />
      </label>
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded bg-zinc-900 px-3 py-1.5 text-sm font-semibold text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
        >
          Koreksi Stok
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
