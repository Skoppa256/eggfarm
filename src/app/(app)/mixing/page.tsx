import Link from "next/link";
import { redirect } from "next/navigation";

import { businessToday, formatDateOnly } from "@/lib/dates";
import { getSessionUser } from "@/lib/server/auth";
import { listActiveFarmhouses } from "@/lib/server/catalog";
import { listActiveIngredients } from "@/lib/server/ingredients";
import { findMixing, mixingPlan, previousMixing } from "@/lib/server/mixing";

import { MixingForm } from "./mixing-form";

export const dynamic = "force-dynamic";

const fieldClass =
  "rounded border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900";

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <div className="text-xs text-zinc-500">{label}</div>
      <div className="font-medium tabular-nums">{value}</div>
    </div>
  );
}

export default async function MixingPage({
  searchParams,
}: {
  searchParams: Promise<{ farmhouseId?: string; date?: string; intake?: string }>;
}) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.role === "OWNER") redirect("/dashboard"); // read-only role has no feed ops

  const sp = await searchParams;
  const farmhouses = await listActiveFarmhouses();
  const dateStr =
    sp.date && /^\d{4}-\d{2}-\d{2}$/.test(sp.date) ? sp.date : formatDateOnly(businessToday());
  const farmhouseId =
    sp.farmhouseId && farmhouses.some((f) => f.id === sp.farmhouseId) ? sp.farmhouseId : undefined;
  const intake = sp.intake && Number.isFinite(Number(sp.intake)) ? Number(sp.intake) : undefined;

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-6 p-6 sm:p-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Mixing Pakan (PAKAN)</h1>
        <p className="text-sm text-zinc-500">
          Per kandang, per hari konsumsi. Kebutuhan = HIDUP × intake ÷ 1000; campuran segar
          memperhitungkan sisa kemarin. Konfirmasi mengurangi bahan dan mencatat PAKAN
          MASUK ke catatan harian.
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
          Hari konsumsi
          <input type="date" name="date" defaultValue={dateStr} className={fieldClass} />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          Proyeksi intake (g/ekor)
          <input type="number" name="intake" min="0" step="0.001" defaultValue={sp.intake ?? ""} className={fieldClass} />
        </label>
        <button
          type="submit"
          className="rounded bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900"
        >
          Muat
        </button>
      </form>

      {farmhouseId && intake ? (
        <MixEditor farmhouseId={farmhouseId} dateStr={dateStr} intake={intake} />
      ) : (
        <p className="text-sm text-zinc-500">Pilih kandang, hari, dan proyeksi intake, lalu Muat.</p>
      )}
    </main>
  );
}

async function MixEditor({
  farmhouseId,
  dateStr,
  intake,
}: {
  farmhouseId: string;
  dateStr: string;
  intake: number;
}) {
  const date = new Date(`${dateStr}T00:00:00Z`);
  const [plan, existing, ingredients, prev] = await Promise.all([
    mixingPlan(farmhouseId, date, intake),
    findMixing(farmhouseId, date),
    listActiveIngredients(),
    previousMixing(farmhouseId, date),
  ]);

  if (!plan) {
    return (
      <p className="rounded border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
        Tidak ada penempatan yang menempati kandang ini pada {dateStr}. Lakukan chick-in Flock terlebih dahulu (Flocks).
      </p>
    );
  }

  const planBlock = (
    <div className="grid grid-cols-2 gap-3 rounded-lg border border-zinc-200 p-4 text-sm dark:border-zinc-800 sm:grid-cols-4">
      <Stat label="HIDUP" value={plan.hidup} />
      <Stat label="Kebutuhan (kg)" value={plan.requirement.toFixed(3)} />
      <Stat label="Sisa dapat dipakai (kg)" value={plan.reusableLeftover.toFixed(3)} />
      <Stat label="TOTAL CAMPUR / MASUK (kg)" value={plan.totalCampur.toFixed(3)} />
    </div>
  );

  if (existing) {
    return (
      <section className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Dicampur untuk {dateStr}</h2>
          <Link
            href={`/mixing/pull-list?farmhouseId=${farmhouseId}&date=${dateStr}`}
            className="rounded border border-zinc-300 px-3 py-1 text-sm font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
          >
            Pull-list →
          </Link>
        </div>
        <div className="grid grid-cols-2 gap-3 rounded-lg border border-zinc-200 p-4 text-sm dark:border-zinc-800 sm:grid-cols-4">
          <Stat label="HIDUP saat mix" value={existing.hidupAtMix} />
          <Stat label="Kebutuhan (kg)" value={existing.requirement.toFixed(3)} />
          <Stat label="Sisa (kg)" value={existing.reusableLeftover.toFixed(3)} />
          <Stat label="PAKAN MASUK (kg)" value={existing.totalCampur.toFixed(3)} />
        </div>
        <div className="text-sm">
          <span className="text-zinc-500">JENIS: </span>
          <span className="font-medium">{existing.jenis || "— (tidak ada campuran segar)"}</span>
        </div>
        <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
          <table className="w-full text-left text-sm">
            <thead className="bg-zinc-50 text-xs uppercase tracking-wide text-zinc-500 dark:bg-zinc-900">
              <tr>
                <th className="px-4 py-2">Bahan</th>
                <th className="px-4 py-2">Jenis</th>
                <th className="px-4 py-2 text-right">Berat (kg)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {existing.lines.map((l) => (
                <tr key={l.id}>
                  <td className="px-4 py-2 font-medium">{l.ingredient.name}</td>
                  <td className="px-4 py-2 text-zinc-500">
                    {l.kind === "MAIN_PERCENT" ? `${l.percent?.toString() ?? "0"}% utama` : "tetap"}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums">{l.computedWeight.toFixed(3)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    );
  }

  const initialRows = prev
    ? prev.lines.map((l) => ({
        ingredientId: l.ingredientId,
        kind: l.kind as "MAIN_PERCENT" | "FIXED_WEIGHT",
        percent: l.percent ? l.percent.toString() : "",
        fixedWeight: l.fixedWeight ? l.fixedWeight.toString() : "",
      }))
    : [];

  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold">Rencana untuk {dateStr}</h2>
      {planBlock}
      {plan.totalCampur === 0 && (
        <p className="rounded border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
          Hari tanpa mixing: sisa kemarin sudah menutupi kebutuhan, jadi PAKAN MASUK adalah 0
          dan tidak ada yang dikurangi. Anda tetap bisa mengonfirmasi untuk mencatat resep.
        </p>
      )}
      <div className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
        <h3 className="mb-3 font-semibold">Resep {prev ? "(terisi otomatis dari mix terakhir)" : ""}</h3>
        {ingredients.length === 0 ? (
          <p className="text-sm text-zinc-500">Tambah Bahan Pakan terlebih dahulu (Bahan Pakan).</p>
        ) : (
          <MixingForm
            hiddenFields={[
              { name: "farmhouseId", value: farmhouseId },
              { name: "date", value: dateStr },
              { name: "projectedIntake", value: String(intake) },
            ]}
            ingredients={ingredients}
            initialRows={initialRows}
            totalCampur={plan.totalCampur}
          />
        )}
      </div>
    </section>
  );
}
