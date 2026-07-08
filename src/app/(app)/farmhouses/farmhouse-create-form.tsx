"use client";

import { useActionState } from "react";

import type { ActionResult } from "@/lib/action-result";
import { createFarmhouseAction } from "./actions";

const fieldClass =
  "rounded border border-zinc-300 px-2 py-1.5 text-sm focus:border-zinc-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900";

type WarehouseOption = { id: string; name: string; code: string };

export function FarmhouseCreateForm({ warehouses }: { warehouses: WarehouseOption[] }) {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(
    createFarmhouseAction,
    null,
  );

  return (
    <form action={action} className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm font-medium">
          Nama
          <input name="name" required className={fieldClass} />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          Kode
          <input name="code" required className={fieldClass} />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          Gudang yang ditugaskan
          <select name="warehouseId" defaultValue={warehouses[0]?.id} className={fieldClass}>
            {warehouses.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name} ({w.code})
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          Maks batch per hari
          <input
            type="number"
            name="maxBatchesPerDay"
            min={1}
            max={10}
            defaultValue={2}
            required
            className={fieldClass}
          />
        </label>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending || warehouses.length === 0}
          className="rounded bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
        >
          Tambah Kandang
        </button>
        {warehouses.length === 0 && (
          <span className="text-sm text-amber-600">Tambah Gudang aktif terlebih dahulu.</span>
        )}
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
