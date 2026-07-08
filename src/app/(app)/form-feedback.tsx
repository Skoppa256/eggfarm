"use client";

import { useState } from "react";

import type { ActionResult } from "@/lib/action-result";

/**
 * Dismissable save feedback. `formProps` clears a stale success/error message the
 * moment the user edits the form again (fixes the nit where an entry error lingered
 * after changing a field or selection); it re-shows on the next submit.
 */
export function useDismissableFeedback() {
  const [dirty, setDirty] = useState(false);
  return {
    dirty,
    markDirty: () => setDirty(true),
    markSubmitted: () => setDirty(false),
    formProps: {
      onInput: () => setDirty(true),
      onSubmit: () => setDirty(false),
    },
  };
}

/** Clear success/error banner shown after a save (hidden while the form is dirty). */
export function FormFeedback({ state, dirty }: { state: ActionResult | null; dirty: boolean }) {
  if (!state || dirty) return null;
  return state.ok ? (
    <p
      role="status"
      className="rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700"
    >
      {state.message}
    </p>
  ) : (
    <p
      role="alert"
      className="rounded-lg border border-rose-300 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700"
    >
      {state.error}
    </p>
  );
}
