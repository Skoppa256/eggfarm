"use client";

import { useActionState, useState } from "react";

import type { ActionResult } from "@/lib/action-result";

import { createMixingAction } from "./actions";

const fieldClass =
  "rounded border border-zinc-300 px-2 py-1.5 text-sm focus:border-zinc-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900";

type Row = { ingredientId: string; kind: "MAIN_PERCENT" | "FIXED_WEIGHT"; percent: string; fixedWeight: string };

const blankRow = (): Row => ({ ingredientId: "", kind: "MAIN_PERCENT", percent: "", fixedWeight: "" });

export function MixingForm({
  hiddenFields,
  ingredients,
  initialRows,
  totalCampur,
}: {
  hiddenFields: { name: string; value: string }[];
  ingredients: { id: string; name: string }[];
  initialRows: Row[];
  totalCampur: number;
}) {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(createMixingAction, null);
  const [rows, setRows] = useState<Row[]>(initialRows.length > 0 ? initialRows : [blankRow(), blankRow()]);

  const update = (i: number, patch: Partial<Row>) =>
    setRows((rs) => rs.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));

  const mainsPercent = rows
    .filter((r) => r.kind === "MAIN_PERCENT" && r.ingredientId)
    .reduce((s, r) => s + (Number(r.percent) || 0), 0);
  const weightOf = (r: Row) =>
    r.kind === "MAIN_PERCENT"
      ? (totalCampur * (Number(r.percent) || 0)) / 100
      : Number(r.fixedWeight) || 0;

  return (
    <form action={action} className="flex flex-col gap-3">
      {hiddenFields.map((h) => (
        <input key={h.name} type="hidden" name={h.name} value={h.value} />
      ))}
      <input type="hidden" name="lineCount" value={rows.length} />

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="text-xs uppercase tracking-wide text-zinc-500">
            <tr>
              <th className="py-1 pr-2">Bahan</th>
              <th className="py-1 pr-2">Jenis</th>
              <th className="py-1 pr-2">% / kg</th>
              <th className="py-1 pr-2 text-right">Berat (kg)</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i}>
                <td className="py-1 pr-2">
                  <input type="hidden" name={`line.${i}.ingredientId`} value={r.ingredientId} />
                  <select
                    value={r.ingredientId}
                    onChange={(e) => update(i, { ingredientId: e.target.value })}
                    className={fieldClass}
                  >
                    <option value="">Pilih…</option>
                    {ingredients.map((ing) => (
                      <option key={ing.id} value={ing.id}>
                        {ing.name}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="py-1 pr-2">
                  <input type="hidden" name={`line.${i}.kind`} value={r.kind} />
                  <select
                    value={r.kind}
                    onChange={(e) => update(i, { kind: e.target.value as Row["kind"] })}
                    className={fieldClass}
                  >
                    <option value="MAIN_PERCENT">Utama (%)</option>
                    <option value="FIXED_WEIGHT">Tetap (kg)</option>
                  </select>
                </td>
                <td className="py-1 pr-2">
                  {r.kind === "MAIN_PERCENT" ? (
                    <input
                      type="number"
                      inputMode="decimal"
                      name={`line.${i}.percent`}
                      value={r.percent}
                      min="0"
                      step="0.001"
                      onChange={(e) => update(i, { percent: e.target.value })}
                      className={`${fieldClass} w-24`}
                    />
                  ) : (
                    <input
                      type="number"
                      inputMode="decimal"
                      name={`line.${i}.fixedWeight`}
                      value={r.fixedWeight}
                      min="0"
                      step="0.001"
                      onChange={(e) => update(i, { fixedWeight: e.target.value })}
                      className={`${fieldClass} w-24`}
                    />
                  )}
                </td>
                <td className="py-1 pr-2 text-right tabular-nums">{weightOf(r).toFixed(3)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center gap-4 text-xs">
        <button
          type="button"
          onClick={() => setRows((rs) => [...rs, blankRow()])}
          className="rounded border border-zinc-300 px-2 py-1 font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
        >
          + Tambah baris
        </button>
        <span className={Math.abs(mainsPercent - 100) < 0.01 ? "text-emerald-600" : "text-amber-600"}>
          Total utama: {mainsPercent}% {Math.abs(mainsPercent - 100) < 0.01 ? "✓" : "(harus 100%)"}
        </span>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded bg-zinc-900 px-3 py-1.5 text-sm font-semibold text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
        >
          Konfirmasi mix &amp; kurangi stok
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
