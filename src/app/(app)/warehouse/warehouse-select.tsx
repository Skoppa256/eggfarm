const selectClass =
  "rounded border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900";

type WarehouseOption = { id: string; name: string; code: string; status: "ACTIVE" | "INACTIVE" };

/** GET form: pick a warehouse; submits to the current page as ?warehouseId=…. */
export function WarehouseSelect({
  warehouses,
  selectedId,
}: {
  warehouses: WarehouseOption[];
  selectedId?: string;
}) {
  return (
    <form method="get" className="flex items-end gap-2">
      <label className="flex flex-col gap-1 text-sm font-medium">
        Gudang
        <select name="warehouseId" defaultValue={selectedId ?? ""} className={selectClass}>
          {warehouses.map((w) => (
            <option key={w.id} value={w.id}>
              {w.name} ({w.code}){w.status !== "ACTIVE" ? " — nonaktif" : ""}
            </option>
          ))}
        </select>
      </label>
      <button
        type="submit"
        className="rounded bg-zinc-900 px-3 py-1.5 text-sm font-semibold text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900"
      >
        Buka
      </button>
    </form>
  );
}
