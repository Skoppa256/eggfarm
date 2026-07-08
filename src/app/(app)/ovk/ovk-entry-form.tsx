"use client";

import { useActionState, useState } from "react";

import type { ActionResult } from "@/lib/action-result";

import { deliverOvkAction, transferOvkAction } from "./actions";

const fieldClass =
  "rounded border border-zinc-300 px-2 py-1.5 text-sm focus:border-zinc-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900";

export type OvkItemOption = { id: string; name: string; units: string[] };

export function OvkEntryForm({
  mode,
  items,
  kandangs,
  today,
}: {
  mode: "delivery" | "transfer";
  items: OvkItemOption[];
  kandangs?: { id: string; name: string; code: string }[];
  today: string;
}) {
  const action = mode === "delivery" ? deliverOvkAction : transferOvkAction;
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(action, null);
  const [itemId, setItemId] = useState("");
  const units = items.find((i) => i.id === itemId)?.units ?? [];

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3">
      <label className="flex flex-col gap-1 text-sm font-medium">
        Item
        <select
          name="ovkItemId"
          required
          value={itemId}
          onChange={(e) => setItemId(e.target.value)}
          className={fieldClass}
        >
          <option value="">Pilih…</option>
          {items.map((i) => (
            <option key={i.id} value={i.id}>
              {i.name}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium">
        Jumlah
        <input type="number" name="quantity" min="0.001" step="0.001" required className={`${fieldClass} w-28`} />
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium">
        Satuan
        <select name="unitName" required className={fieldClass} disabled={units.length === 0}>
          {units.length === 0 && <option value="">—</option>}
          {units.map((u) => (
            <option key={u} value={u}>
              {u}
            </option>
          ))}
        </select>
      </label>

      {mode === "transfer" && (
        <>
          <label className="flex flex-col gap-1 text-sm font-medium">
            Kandang
            <select name="farmhouseId" required className={fieldClass}>
              <option value="">Pilih…</option>
              {(kandangs ?? []).map((k) => (
                <option key={k.id} value={k.id}>
                  {k.name} ({k.code})
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium">
            Catatan
            <input name="note" className={fieldClass} placeholder="opsional" />
          </label>
        </>
      )}

      <label className="flex flex-col gap-1 text-sm font-medium">
        Tanggal
        <input type="date" name="date" defaultValue={today} className={fieldClass} />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="rounded bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
      >
        {mode === "delivery" ? "Catat Penerimaan" : "Catat Transfer"}
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
