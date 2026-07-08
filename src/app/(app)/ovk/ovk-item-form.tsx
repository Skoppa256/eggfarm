"use client";

import { useActionState, useState } from "react";

import { OvkCategory } from "@/generated/prisma/enums";
import type { ActionResult } from "@/lib/action-result";
import { OVK_CATEGORY_LABELS, OVK_CATEGORY_ORDER } from "@/lib/ovk";

import { createOvkItemAction } from "./actions";

const fieldClass =
  "rounded border border-zinc-300 px-2 py-1.5 text-sm focus:border-zinc-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900";

type Conv = { unit: string; factor: string };

export function OvkItemForm() {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(createOvkItemAction, null);
  const [convs, setConvs] = useState<Conv[]>([]);

  const update = (i: number, patch: Partial<Conv>) =>
    setConvs((cs) => cs.map((c, idx) => (idx === i ? { ...c, ...patch } : c)));

  return (
    <form action={action} className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        <label className="flex flex-col gap-1 text-sm font-medium">
          Nama
          <input name="name" required placeholder="Antibiotik X" className={fieldClass} />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          Kategori
          <select name="category" defaultValue={OvkCategory.OBAT} className={fieldClass}>
            {OVK_CATEGORY_ORDER.map((c) => (
              <option key={c} value={c}>
                {OVK_CATEGORY_LABELS[c]}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          Satuan dasar
          <input name="baseUnit" required placeholder="liter" className={fieldClass} />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          Urutan
          <input type="number" name="sortOrder" min={0} defaultValue={0} className={fieldClass} />
        </label>
      </div>

      <fieldset className="rounded border border-zinc-200 p-3 dark:border-zinc-800">
        <legend className="px-1 text-xs font-semibold text-zinc-500">Konversi satuan (opsional)</legend>
        <input type="hidden" name="convCount" value={convs.length} />
        <div className="flex flex-col gap-2">
          {convs.map((c, i) => (
            <div key={i} className="flex items-center gap-2 text-sm">
              <span className="text-zinc-500">1</span>
              <input
                name={`conv.${i}.unit`}
                value={c.unit}
                onChange={(e) => update(i, { unit: e.target.value })}
                placeholder="botol"
                className={`${fieldClass} w-32`}
              />
              <span className="text-zinc-500">=</span>
              <input
                type="number"
                name={`conv.${i}.factor`}
                value={c.factor}
                onChange={(e) => update(i, { factor: e.target.value })}
                min="0"
                step="0.0001"
                placeholder="1"
                className={`${fieldClass} w-28`}
              />
              <span className="text-zinc-500">satuan dasar</span>
            </div>
          ))}
          <button
            type="button"
            onClick={() => setConvs((cs) => [...cs, { unit: "", factor: "" }])}
            className="self-start rounded border border-zinc-300 px-2 py-1 text-xs font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
          >
            + Tambah konversi
          </button>
        </div>
      </fieldset>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
        >
          Tambah Item
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
