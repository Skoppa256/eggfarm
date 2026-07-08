"use client";

import { useActionState } from "react";

import type { ActionResult } from "@/lib/action-result";

import { deliverIngredientAction } from "./actions";

const fieldClass =
  "rounded border border-zinc-300 px-2 py-1.5 text-sm focus:border-zinc-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900";

export function DeliveryForm({
  ingredients,
  today,
}: {
  ingredients: { id: string; name: string }[];
  today: string;
}) {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(
    deliverIngredientAction,
    null,
  );

  return (
    <form action={action} className="flex flex-wrap items-end gap-3">
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
        Jumlah (kg)
        <input type="number" name="quantity" min="0.001" step="0.001" required className={fieldClass} />
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium">
        Tanggal
        <input type="date" name="date" defaultValue={today} className={fieldClass} />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="rounded bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
      >
        Catat Penerimaan
      </button>
      {state && !state.ok && (
        <span role="alert" className="self-center text-sm font-medium text-rose-600">
          {state.error}
        </span>
      )}
      {state && state.ok && (
        <span role="status" className="self-center text-sm font-medium text-emerald-600">
          {state.message}
        </span>
      )}
    </form>
  );
}
