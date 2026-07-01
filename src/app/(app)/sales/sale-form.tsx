"use client";

import { useActionState, useState } from "react";

import type { ActionResult } from "@/lib/action-result";
import { gradeLabel, SIZE_HEALTH_GRADES } from "@/lib/grades";
import { formatPcs, PCS_PER_RAK } from "@/lib/units";

import { createSaleAction } from "./actions";

const fieldClass =
  "rounded border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900";

type Option = { id: string; name: string; code?: string };

function sumPcs(form: HTMLFormElement): number {
  const count = Number((form.elements.namedItem("lineCount") as HTMLInputElement)?.value ?? 0);
  let total = 0;
  for (let i = 0; i < count; i++) {
    const qty = Number((form.elements.namedItem(`line.${i}.quantity`) as HTMLInputElement)?.value) || 0;
    const unit = (form.elements.namedItem(`line.${i}.unit`) as HTMLSelectElement)?.value;
    total += unit === "RAK" ? qty * PCS_PER_RAK : qty;
  }
  return total;
}

export function SaleForm({
  warehouses,
  buyers,
  gradeTypes,
  defaultDate,
}: {
  warehouses: Option[];
  buyers: Option[];
  gradeTypes: Option[];
  defaultDate: string;
}) {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(
    createSaleAction,
    null,
  );
  const [rows, setRows] = useState(3);
  const [total, setTotal] = useState(0);
  const canSell = warehouses.length > 0 && buyers.length > 0;

  return (
    <form action={action} onInput={(e) => setTotal(sumPcs(e.currentTarget))} className="flex flex-col gap-4">
      <input type="hidden" name="lineCount" value={rows} readOnly />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <label className="flex flex-col gap-1 text-sm font-medium">
          Warehouse
          <select name="warehouseId" defaultValue={warehouses[0]?.id} className={fieldClass}>
            {warehouses.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name} ({w.code})
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          Buyer
          <select name="buyerId" defaultValue={buyers[0]?.id} className={fieldClass}>
            {buyers.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          Business date
          <input type="date" name="date" defaultValue={defaultDate} className={fieldClass} />
        </label>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs uppercase tracking-wide text-zinc-500">
              <th className="px-1 py-1 text-left">Grade</th>
              <th className="px-1 py-1 text-left">Type</th>
              <th className="px-1 py-1 text-left">Qty</th>
              <th className="px-1 py-1 text-left">Unit</th>
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: rows }, (_, i) => (
              <tr key={i}>
                <td className="px-1 py-1">
                  <select name={`line.${i}.sizeHealthGrade`} defaultValue={SIZE_HEALTH_GRADES[0]} className={fieldClass}>
                    {SIZE_HEALTH_GRADES.map((g) => (
                      <option key={g} value={g}>
                        {gradeLabel(g)}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-1 py-1">
                  <select name={`line.${i}.typeGradeId`} defaultValue={gradeTypes[0]?.id} className={fieldClass}>
                    {gradeTypes.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-1 py-1">
                  <input type="number" name={`line.${i}.quantity`} min={0} defaultValue={0} className={`${fieldClass} w-24`} />
                </td>
                <td className="px-1 py-1">
                  <select name={`line.${i}.unit`} defaultValue="RAK" className={fieldClass}>
                    <option value="RAK">rak</option>
                    <option value="PCS">pcs</option>
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={() => setRows((r) => r + 1)}
          className="rounded border border-zinc-300 px-3 py-1 text-xs font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
        >
          + Add line
        </button>
        <span className="text-sm font-medium">Total: {formatPcs(total)}</span>
      </div>

      <label className="flex flex-col gap-1 text-sm font-medium">
        Note (optional)
        <input name="notes" className={fieldClass} />
      </label>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending || !canSell}
          className="rounded bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
        >
          Record sale
        </button>
        {!canSell && (
          <span className="text-sm text-amber-600">Need an active warehouse and buyer first.</span>
        )}
        {state && !state.ok && (
          <span role="alert" className="text-sm font-medium text-rose-600">
            {state.error}
          </span>
        )}
      </div>
    </form>
  );
}
