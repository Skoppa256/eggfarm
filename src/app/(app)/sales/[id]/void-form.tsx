"use client";

import { useActionState } from "react";

import type { ActionResult } from "@/lib/action-result";
import { voidSaleAction } from "../actions";

export function VoidForm({ transactionId }: { transactionId: string }) {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(
    voidSaleAction,
    null,
  );

  return (
    <form action={action} className="flex flex-col gap-2">
      <input type="hidden" name="transactionId" value={transactionId} />
      <label className="flex flex-col gap-1 text-sm font-medium">
        Void reason (required)
        <input
          name="reason"
          required
          minLength={3}
          className="rounded border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        />
      </label>
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-50"
        >
          Void &amp; restore stock
        </button>
        {state && !state.ok && (
          <span role="alert" className="text-sm font-medium text-rose-600">
            {state.error}
          </span>
        )}
      </div>
    </form>
  );
}
