"use client";

import { useActionState } from "react";

import type { ActionResult } from "@/lib/action-result";
import { createUnitAction } from "./actions";

const fieldClass =
  "rounded border border-zinc-300 px-2 py-1.5 text-sm focus:border-zinc-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900";

export function UnitCreateForm() {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(
    createUnitAction,
    null,
  );

  return (
    <form action={action} className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <label className="flex flex-col gap-1 text-sm font-medium">
          Nama
          <input name="name" required placeholder="Rak" className={fieldClass} />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          Setara pcs
          <input type="number" name="pcsEquivalent" min={1} required placeholder="30" className={fieldClass} />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          Urutan
          <input type="number" name="sortOrder" min={0} defaultValue={0} className={fieldClass} />
        </label>
      </div>
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
        >
          Tambah Satuan
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
