"use client";

import { useActionState } from "react";

import type { ActionResult } from "@/lib/action-result";
import { endPlacementAction } from "../actions";

export function EndPlacementForm({
  placementId,
  defaultDate,
}: {
  placementId: string;
  defaultDate: string;
}) {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(
    endPlacementAction,
    null,
  );

  return (
    <form action={action} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="placementId" value={placementId} />
      <input
        type="date"
        name="endDate"
        defaultValue={defaultDate}
        className="rounded border border-zinc-300 px-2 py-1 text-xs dark:border-zinc-700 dark:bg-zinc-900"
      />
      <button
        type="submit"
        disabled={pending}
        className="rounded border border-rose-300 px-2 py-1 text-xs font-medium text-rose-700 hover:bg-rose-50 disabled:opacity-50 dark:border-rose-800 dark:text-rose-300 dark:hover:bg-rose-950"
      >
        Akhiri Penempatan
      </button>
      {state && !state.ok && (
        <span role="alert" className="text-xs font-medium text-rose-600">
          {state.error}
        </span>
      )}
    </form>
  );
}
