import { redirect } from "next/navigation";

import {
  computeFcr,
  computeGramPerEkor,
  computeHdPercent,
  computePakanTersedia,
  computeRealisasiIntake,
} from "@/lib/daily";
import { businessToday, formatDateOnly } from "@/lib/dates";
import { computeHari, computeMinggu } from "@/lib/flock";
import { getSessionUser } from "@/lib/server/auth";
import { listActiveFarmhouses } from "@/lib/server/catalog";
import {
  findDailyRecord,
  liveEggBuckets,
  previousReusableLeftover,
  resolvePlacementForDate,
} from "@/lib/server/dailyRecords";
import { resolveWarehouse } from "@/lib/server/farmhouses";
import { resolveHidup } from "@/lib/server/flocks";
import { findMixing } from "@/lib/server/mixing";
import { vaksinForDailyRecord } from "@/lib/server/vaksin";

import { DailyForm, type DailyFormDefaults } from "./daily-form";
import { DailyReportCard, type DailyReport } from "./daily-report";

export const dynamic = "force-dynamic";

const fieldClass =
  "rounded border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900";

const EMPTY_DEFAULTS: DailyFormDefaults = {
  mati: 0,
  afkir: 0,
  sisaDigunakan: 0,
  sisaDibuang: 0,
  beratTelur: 0,
  beratBadan: "",
  obatNote: "",
  vitaminNote: "",
  keterangan: "",
};

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <div className="text-xs text-zinc-500">{label}</div>
      <div className="font-medium tabular-nums">{value}</div>
    </div>
  );
}

export default async function DailyPage({
  searchParams,
}: {
  searchParams: Promise<{ farmhouseId?: string; date?: string }>;
}) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.role === "OWNER") redirect("/dashboard"); // daily recording is Admin-only

  const sp = await searchParams;
  const farmhouses = await listActiveFarmhouses();
  const dateStr =
    sp.date && /^\d{4}-\d{2}-\d{2}$/.test(sp.date) ? sp.date : formatDateOnly(businessToday());
  const farmhouseId =
    sp.farmhouseId && farmhouses.some((f) => f.id === sp.farmhouseId) ? sp.farmhouseId : undefined;

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-6 p-6 sm:p-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Pencatatan Harian Kandang</h1>
        <p className="text-sm text-zinc-500">
          Satu catatan per kandang per hari untuk penempatan aktif. Umur, HIDUP, Kelompok
          Telur, HD% dan indikator pakan dihitung otomatis.
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
        <DailyEditor
          farmhouseId={farmhouseId}
          dateStr={dateStr}
          kandang={farmhouses.find((f) => f.id === farmhouseId)!}
        />
      ) : (
        <p className="text-sm text-zinc-500">Pilih kandang dan tanggal, lalu Muat.</p>
      )}
    </main>
  );
}

async function DailyEditor({
  farmhouseId,
  dateStr,
  kandang,
}: {
  farmhouseId: string;
  dateStr: string;
  kandang: { name: string; code: string };
}) {
  const date = new Date(`${dateStr}T00:00:00Z`);
  const placement = await resolvePlacementForDate(farmhouseId, date);

  if (!placement) {
    return (
      <p className="rounded border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
        Belum ada penempatan di kandang ini pada {dateStr}. Lakukan Chick-in flock dulu (Flock).
      </p>
    );
  }

  const [existing, buckets, reusableLeftoverIn, hidupAsOf, mix, vaksinLogs, warehouse] =
    await Promise.all([
      findDailyRecord(farmhouseId, date),
      liveEggBuckets(farmhouseId, date),
      previousReusableLeftover(placement.id, date),
      resolveHidup(placement.id, date),
      findMixing(farmhouseId, date),
      vaksinForDailyRecord(farmhouseId, date),
      resolveWarehouse(farmhouseId, date),
    ]);

  const hari = computeHari(placement.flock.placementAge, placement.flock.chickInDate, date);
  const minggu = computeMinggu(hari);
  const hidup = existing ? existing.hidup : (hidupAsOf ?? placement.populasiAwal);
  const isChickInDay = date.getTime() === placement.startDate.getTime();

  // PAKAN block. If the record has frozen it (mixing done), show the frozen values (§5.3);
  // else reflect the mix live (MASUK from mixing, or 0 if no mix yet).
  const sisaDigunakan = existing ? existing.sisaDigunakan.toNumber() : 0;
  const sisaDibuang = existing ? existing.sisaDibuang.toNumber() : 0;
  const beratTelur = existing ? existing.beratTelur.toNumber() : 0;
  const frozen = existing?.pakanMasuk != null;
  const pakanMasuk = frozen ? existing!.pakanMasuk!.toNumber() : mix ? mix.totalCampur.toNumber() : 0;
  const tersedia = frozen
    ? existing!.pakanTersedia!.toNumber()
    : computePakanTersedia(pakanMasuk, reusableLeftoverIn);
  const intake = frozen
    ? existing!.realisasiIntake!.toNumber()
    : computeRealisasiIntake(tersedia, sisaDigunakan, sisaDibuang);
  const gramEkor = frozen ? existing!.gramPerEkor!.toNumber() : computeGramPerEkor(intake, hidup);
  const fcr = frozen ? (existing!.fcr ? existing!.fcr.toNumber() : null) : computeFcr(intake, beratTelur);
  const jenis = frozen ? existing!.jenis : (mix?.jenis ?? null);

  const defaults: DailyFormDefaults = existing
    ? {
        mati: existing.mati,
        afkir: existing.afkir,
        sisaDigunakan,
        sisaDibuang,
        beratTelur,
        beratBadan: existing.beratBadan ? existing.beratBadan.toString() : "",
        obatNote: existing.obatNote ?? "",
        vitaminNote: existing.vitaminNote ?? "",
        keterangan: existing.keterangan ?? "",
      }
    : EMPTY_DEFAULTS;

  // Screenshot-able WhatsApp summary — only once the day has a saved record.
  const report: DailyReport | null = existing
    ? {
        farmName: warehouse?.name ?? "CV Piawai Djaya Farm", // the kandang's mapped warehouse
        kandangName: kandang.name,
        kandangCode: kandang.code,
        dateStr,
        strain: placement.flock.strain,
        hari,
        minggu,
        hidup,
        mati: existing.mati,
        afkir: existing.afkir,
        utuh: buckets.utuh,
        lunak: buckets.lunak,
        pecah: buckets.pecah,
        kosong: buckets.kosong,
        hdPercent: existing.hdPercent.toNumber(),
        intake,
        gramEkor,
        fcr,
        jenis,
        vaksin: vaksinLogs.map(
          (v) => `${v.vaksinType.name} (${v.vials} vial${v.vials > 1 ? "s" : ""}, ${v.vaccinator})`,
        ),
        obat: existing.obatNote ?? null,
        vitamin: existing.vitaminNote ?? null,
        keterangan: existing.keterangan ?? null,
      }
    : null;

  return (
    <section className="flex flex-col gap-5">
      <div className="grid grid-cols-2 gap-3 rounded-lg border border-zinc-200 p-4 text-sm dark:border-zinc-800 sm:grid-cols-4">
        <Stat label="Flock / Kandang" value={`${placement.flock.strain}`} />
        <Stat label="HARI" value={hari} />
        <Stat label="MINGGU" value={minggu} />
        <Stat label={existing ? "HIDUP (tercatat)" : "HIDUP (masuk)"} value={hidup} />
      </div>

      <div>
        <h2 className="mb-2 text-sm font-semibold text-zinc-500">VAKSIN (dari log)</h2>
        <div className="rounded-lg border border-zinc-200 p-4 text-sm dark:border-zinc-800">
          {vaksinLogs.length === 0 ? (
            <span className="text-zinc-500">— belum ada vaksinasi tercatat untuk kandang/tanggal ini</span>
          ) : (
            <ul className="flex flex-wrap gap-x-6 gap-y-1">
              {vaksinLogs.map((v) => (
                <li key={v.id} className="font-medium">
                  {v.vaksinType.name}{" "}
                  <span className="font-normal text-zinc-500">
                    · {v.vials} vial · {v.vaccinator}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div>
        <h2 className="mb-2 text-sm font-semibold text-zinc-500">
          Kelompok Telur {buckets.reconciledToGrading ? "(dicocokkan ke grading)" : "(dari pengambilan)"}
        </h2>
        <div className="grid grid-cols-2 gap-3 rounded-lg border border-zinc-200 p-4 text-sm dark:border-zinc-800 sm:grid-cols-5">
          <Stat
            label="Utuh"
            value={buckets.utuh}
          />
          <Stat label="Lunak" value={buckets.lunak} />
          <Stat
            label="Pecah"
            value={
              buckets.reconciledToGrading
                ? `${buckets.pecah} (R${buckets.pecahRetak}/P${buckets.pecahPlastik})`
                : buckets.pecah
            }
          />
          <Stat label="Kosong" value={buckets.kosong} />
          <Stat
            label={existing ? "HD% (tercatat)" : "HD% (live)"}
            value={(existing ? existing.hdPercent.toNumber() : computeHdPercent(buckets.total, hidup)).toFixed(2)}
          />
        </div>
      </div>

      <div>
        <h2 className="mb-2 text-sm font-semibold text-zinc-500">
          PAKAN & FCR{" "}
          <span
            className={`font-normal ${frozen ? "text-zinc-400" : "text-amber-600 dark:text-amber-400"}`}
          >
            {frozen
              ? "· tercatat (dibekukan saat simpan)"
              : mix
                ? "· dari mixing — dibekukan saat catatan harian disimpan"
                : "· belum ada mixing untuk hari ini (MASUK 0)"}
          </span>
        </h2>
        <div className="grid grid-cols-2 gap-3 rounded-lg border border-zinc-200 p-4 text-sm dark:border-zinc-800 sm:grid-cols-6">
          <Stat label="MASUK (kg)" value={pakanMasuk} />
          <Stat label="TERSEDIA (kg)" value={tersedia} />
          <Stat label="INTAKE (kg)" value={intake} />
          <Stat label="GRAM/EKOR" value={gramEkor} />
          <Stat label="FCR" value={fcr ?? "—"} />
          <Stat label="JENIS" value={jenis || "—"} />
        </div>
      </div>

      <div className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-semibold">{existing ? "Ubah Catatan Harian" : "Catatan Harian Baru"}</h2>
          <span className="text-xs text-zinc-500">{dateStr}</span>
        </div>
        <DailyForm
          mode={existing ? "edit" : "create"}
          hiddenFields={
            existing
              ? [{ name: "recordId", value: existing.id }]
              : [
                  { name: "farmhouseId", value: farmhouseId },
                  { name: "date", value: dateStr },
                ]
          }
          defaults={defaults}
          matiAfkirLocked={Boolean(existing)}
          lockNote={
            existing
              ? "MATI/AFKIR dikunci setelah tercatat (HIDUP sekali tulis)."
              : isChickInDay
                ? "Hari Chick-in: MATI/AFKIR hari kedatangan mengurangi Populasi Awal."
                : undefined
          }
        />
      </div>

      {report && <DailyReportCard report={report} />}
    </section>
  );
}
