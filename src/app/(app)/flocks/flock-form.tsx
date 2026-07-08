"use client";

import { useActionState, useState } from "react";

import type { ActionResult } from "@/lib/action-result";
import { createFlockAction } from "./actions";

const fieldClass =
  "rounded border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900";

type Kandang = { id: string; name: string; code: string };

export function FlockForm({
  farmhouses,
  defaultDate,
}: {
  farmhouses: Kandang[];
  defaultDate: string;
}) {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(
    createFlockAction,
    null,
  );
  const [rows, setRows] = useState(1);
  const canPlace = farmhouses.length > 0;

  return (
    <form action={action} className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <label className="flex flex-col gap-1 text-sm font-medium">
          Strain
          <input name="strain" required className={fieldClass} />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          Tanggal Chick-in
          <input type="date" name="chickInDate" defaultValue={defaultDate} className={fieldClass} />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          Umur penempatan (hari saat Chick-in)
          <input type="number" name="placementAge" min={0} defaultValue={0} required className={fieldClass} />
        </label>
      </div>

      <fieldset className="rounded border border-zinc-200 p-3 dark:border-zinc-800">
        <legend className="px-1 text-xs font-semibold text-zinc-500">
          Penempatan (satu baris per kandang, masing-masing dengan Populasi Awal-nya)
        </legend>
        <input type="hidden" name="placementCount" value={rows} readOnly />
        <div className="flex flex-col gap-2">
          {Array.from({ length: rows }, (_, i) => (
            <div key={i} className="flex items-center gap-2">
              <select name={`placement.${i}.farmhouseId`} defaultValue="" className={fieldClass}>
                <option value="">— Kandang —</option>
                {farmhouses.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name} ({f.code})
                  </option>
                ))}
              </select>
              <input
                type="number"
                name={`placement.${i}.populasiAwal`}
                min={0}
                defaultValue={0}
                placeholder="Populasi Awal"
                className={`${fieldClass} w-40`}
              />
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setRows((r) => r + 1)}
          className="mt-2 rounded border border-zinc-300 px-3 py-1 text-xs font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
        >
          + Tambah kandang
        </button>
      </fieldset>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending || !canPlace}
          className="rounded bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
        >
          Catat Chick-in
        </button>
        {!canPlace && <span className="text-sm text-amber-600">Tidak ada kandang kosong yang tersedia.</span>}
        {state && !state.ok && (
          <span role="alert" className="text-sm font-medium text-rose-600">
            {state.error}
          </span>
        )}
      </div>
    </form>
  );
}
