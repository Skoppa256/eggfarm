import { redirect } from "next/navigation";

import { businessToday, formatDateOnly } from "@/lib/dates";
import { getSessionUser } from "@/lib/server/auth";
import {
  listActiveFarmhouses,
  listGradeTypes as listActiveGradeTypes,
  listWarehouses as listActiveWarehouses,
} from "@/lib/server/catalog";
import { listCollections } from "@/lib/server/collections";
import { resolveMaxBatches, resolveWarehouseId } from "@/lib/server/farmhouses";
import { formatPcs, pcsToRak } from "@/lib/units";

import { CollectionForm, type CollectionFormDefaults } from "./collection-form";

export const dynamic = "force-dynamic";

const fieldClass =
  "rounded border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900";

const EMPTY_DEFAULTS: CollectionFormDefaults = {
  goodEggs: 0,
  telurRetak: 0,
  telurLunak: 0,
  telurKosong: 0,
  remarks: "",
  liftRakByType: {},
};

export default async function CollectionsPage({
  searchParams,
}: {
  searchParams: Promise<{ farmhouseId?: string; date?: string }>;
}) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.role === "OWNER") redirect("/dashboard"); // collection input is Admin-only

  const sp = await searchParams;
  const [farmhouses, gradeTypes, warehouses] = await Promise.all([
    listActiveFarmhouses(),
    listActiveGradeTypes(),
    listActiveWarehouses(),
  ]);
  const warehouseName = new Map(warehouses.map((w) => [w.id, `${w.name} (${w.code})`]));

  const dateStr =
    sp.date && /^\d{4}-\d{2}-\d{2}$/.test(sp.date) ? sp.date : formatDateOnly(businessToday());
  const farmhouseId =
    sp.farmhouseId && farmhouses.some((f) => f.id === sp.farmhouseId) ? sp.farmhouseId : undefined;

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-6 p-6 sm:p-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Input Pengambilan</h1>
        <p className="text-sm text-zinc-500">
          Satu entri per kandang, tanggal dan batch. Angkat Rak (dimasukkan dalam rak) diposting ke
          Gudang kandang saat disimpan; jumlahnya menjadi masukan untuk Grading.
        </p>
      </header>

      <form
        method="get"
        className="flex flex-wrap items-end gap-3 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800"
      >
        <label className="flex flex-col gap-1 text-sm font-medium">
          Kandang
          <select name="farmhouseId" defaultValue={farmhouseId ?? ""} className={fieldClass}>
            <option value="">Pilih…</option>
            {farmhouses.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name} ({f.code})
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          Tanggal
          <input type="date" name="date" defaultValue={dateStr} className={fieldClass} />
        </label>
        <button
          type="submit"
          className="rounded bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900"
        >
          Muat
        </button>
      </form>

      {farmhouseId ? (
        <BatchSlots
          farmhouseId={farmhouseId}
          dateStr={dateStr}
          gradeTypes={gradeTypes}
          warehouseName={warehouseName}
          canOverrideLock={user.role === "SUPERADMIN"}
        />
      ) : (
        <p className="text-sm text-zinc-500">Pilih kandang dan tanggal, lalu Muat.</p>
      )}
    </main>
  );
}

async function BatchSlots({
  farmhouseId,
  dateStr,
  gradeTypes,
  warehouseName,
  canOverrideLock,
}: {
  farmhouseId: string;
  dateStr: string;
  gradeTypes: { id: string; name: string }[];
  warehouseName: Map<string, string>;
  canOverrideLock: boolean;
}) {
  const date = new Date(`${dateStr}T00:00:00Z`);
  const [warehouseId, maxBatches, existing] = await Promise.all([
    resolveWarehouseId(farmhouseId, date),
    resolveMaxBatches(farmhouseId, date),
    listCollections(farmhouseId, date),
  ]);

  if (!warehouseId) {
    return (
      <p className="rounded border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
        Kandang ini belum memiliki pemetaan Gudang untuk {dateStr}. Petakan dulu di menu Kandang.
      </p>
    );
  }
  if (maxBatches == null) {
    return (
      <p className="rounded border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
        Kandang ini belum memiliki konfigurasi batch untuk {dateStr}.
      </p>
    );
  }

  const byBatch = new Map(existing.map((c) => [c.batchNumber, c]));

  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold">
        Batch untuk {dateStr}{" "}
        <span className="text-sm font-normal text-zinc-500">
          (maks {maxBatches} · Angkat Rak → {warehouseName.get(warehouseId) ?? "Gudang"})
        </span>
      </h2>
      {Array.from({ length: maxBatches }, (_, i) => i + 1).map((batch) => {
        const record = byBatch.get(batch);
        const total = record
          ? record.goodEggs + record.telurRetak + record.telurLunak + record.telurKosong
          : 0;
        const defaults: CollectionFormDefaults = record
          ? {
              goodEggs: record.goodEggs,
              telurRetak: record.telurRetak,
              telurLunak: record.telurLunak,
              telurKosong: record.telurKosong,
              remarks: record.remarks ?? "",
              liftRakByType: Object.fromEntries(
                record.angkatRakLifts.map((l) => [l.typeGradeId, pcsToRak(l.quantity).rak]),
              ),
            }
          : EMPTY_DEFAULTS;
        return (
          <div key={batch} className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-semibold">Batch {batch}</h3>
              <span className="text-xs text-zinc-500">
                {record ? `Tercatat — total ${formatPcs(total)}` : "Belum tercatat"}
              </span>
            </div>
            <CollectionForm
              mode={record ? "edit" : "create"}
              gradeTypes={gradeTypes}
              hiddenFields={
                record
                  ? [{ name: "collectionId", value: record.id }]
                  : [
                      { name: "farmhouseId", value: farmhouseId },
                      { name: "date", value: dateStr },
                      { name: "batchNumber", value: String(batch) },
                    ]
              }
              defaults={defaults}
              canOverrideLock={canOverrideLock}
            />
          </div>
        );
      })}
    </section>
  );
}
