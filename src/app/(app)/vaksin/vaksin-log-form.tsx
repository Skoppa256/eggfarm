"use client";

import { useActionState } from "react";

import type { ActionResult } from "@/lib/action-result";

import { createVaksinLogAction } from "./actions";

const fieldClass =
  "rounded border border-zinc-300 px-2 py-1.5 text-sm focus:border-zinc-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900";

export function VaksinLogForm({
  types,
  kandangs,
  today,
}: {
  types: { id: string; name: string }[];
  kandangs: { id: string; name: string; code: string }[];
  today: string;
}) {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(
    createVaksinLogAction,
    null,
  );

  return (
    <form action={action} className="flex flex-wrap items-end gap-3">
      <label className="flex flex-col gap-1 text-sm font-medium">
        Date
        <input type="date" name="date" defaultValue={today} className={fieldClass} />
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium">
        Vaksin type
        <select name="vaksinTypeId" required className={fieldClass}>
          <option value="">Select…</option>
          {types.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium">
        Kandang
        <select name="farmhouseId" required className={fieldClass}>
          <option value="">Select…</option>
          {kandangs.map((k) => (
            <option key={k.id} value={k.id}>
              {k.name} ({k.code})
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium">
        Vials
        <input type="number" name="vials" min={1} step={1} required className={`${fieldClass} w-24`} />
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium">
        Vaccinator
        <input name="vaccinator" required placeholder="Name" className={fieldClass} />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="rounded bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
      >
        Log vaccination
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
