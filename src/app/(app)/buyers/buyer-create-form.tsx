"use client";

import { useActionState } from "react";

import type { ActionResult } from "@/lib/action-result";
import { createBuyerAction } from "./actions";

export function BuyerCreateForm() {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(
    createBuyerAction,
    null,
  );

  return (
    <form action={action} className="flex flex-wrap items-end gap-3">
      <label className="flex flex-col gap-1 text-sm font-medium">
        Nama Pembeli
        <input
          name="name"
          required
          className="rounded border border-zinc-300 px-2 py-1.5 text-sm focus:border-zinc-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900"
        />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="rounded bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
      >
        Tambah Pembeli
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
    </form>
  );
}
