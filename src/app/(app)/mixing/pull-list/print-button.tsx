"use client";

export function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="rounded border border-zinc-300 px-3 py-1 text-sm font-medium hover:bg-zinc-100 print:hidden dark:border-zinc-700 dark:hover:bg-zinc-800"
    >
      Print
    </button>
  );
}
