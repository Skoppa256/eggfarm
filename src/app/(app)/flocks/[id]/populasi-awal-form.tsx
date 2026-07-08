"use client";

import { useActionState } from "react";

import type { ActionResult } from "@/lib/action-result";

import { correctPopulasiAwalAction } from "../actions";

// Superadmin-only inline correction for a chick-in Populasi Awal typo (A20/A23). Shifts
// the placement's whole HIDUP history by the delta (server-side, write-once re-base).
export function PopulasiAwalForm({
  placementId,
  current,
}: {
  placementId: string;
  current: number;
}) {
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(
    correctPopulasiAwalAction,
    null,
  );

  return (
    <form action={formAction} className="flex flex-col gap-1">
      <input type="hidden" name="placementId" value={placementId} />
      <div className="flex items-center gap-1">
        <input
          type="number"
          name="populasiAwal"
          min={1}
          defaultValue={current}
          className="w-24 rounded border border-zinc-300 px-2 py-1 text-sm tabular-nums dark:border-zinc-700 dark:bg-zinc-900"
        />
        <button
          type="submit"
          disabled={pending}
          className="rounded border border-zinc-300 px-2 py-1 text-xs font-medium hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
        >
          Perbaiki
        </button>
      </div>
      {state && !state.ok && (
        <span role="alert" className="text-xs font-medium text-rose-600">
          {state.error}
        </span>
      )}
      {state && state.ok && (
        <span role="status" className="text-xs font-medium text-emerald-600">
          {state.message}
        </span>
      )}
    </form>
  );
}
