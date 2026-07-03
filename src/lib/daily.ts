// Pure derivations for the daily farmhouse record (SRS §3.10, CLAUDE.md §6). No I/O,
// no Prisma — just the formulas, so they are worked-example testable and shared. Egg
// counts are integer pcs; feed quantities are kg and the ratios are rounded to a fixed
// number of places (the service stores them as Decimal to avoid float drift).

const round2 = (x: number): number => Math.round(x * 100) / 100;
const round3 = (x: number): number => Math.round(x * 1000) / 1000;

/** Collection totals for a kandang/day (summed across all of the day's batches), pcs. */
export interface CollectionTotals {
  goodEggs: number; // clean eggs (grade into A++..Mini) plus the Angkat Rak lifted whole
  telurLunak: number;
  telurRetak: number; // the breakage bucket total; sub-split into Retak vs Plastik by grading
  telurKosong: number;
}

/** The Retak-vs-Plastik split that firms up once grading is submitted, pcs. */
export interface PecahSubSplit {
  retak: number;
  plastik: number;
}

export interface EggBuckets {
  utuh: number; // clean grades A++..Mini + Angkat Rak
  lunak: number;
  pecah: number; // Retak + Plastik (stable total from collection)
  kosong: number;
  total: number; // Utuh + Lunak + Pecah + Kosong (all eggs laid)
  /** Firmed sub-split from grading (null until grading for the day is submitted). */
  pecahRetak: number | null;
  pecahPlastik: number | null;
  reconciledToGrading: boolean;
}

/**
 * The four daily egg buckets (FR-70). Derived from collection for a live same-day
 * figure; the daily TOTAL is stable from collection. When grading is submitted, only
 * the Pecah sub-split (Retak vs Plastik) firms up — the bucket totals and the daily
 * total do not change.
 */
export function computeEggBuckets(
  collection: CollectionTotals,
  gradingSplit: PecahSubSplit | null,
): EggBuckets {
  const utuh = collection.goodEggs;
  const lunak = collection.telurLunak;
  const pecah = collection.telurRetak;
  const kosong = collection.telurKosong;
  return {
    utuh,
    lunak,
    pecah,
    kosong,
    total: utuh + lunak + pecah + kosong,
    pecahRetak: gradingSplit ? gradingSplit.retak : null,
    pecahPlastik: gradingSplit ? gradingSplit.plastik : null,
    reconciledToGrading: gradingSplit != null,
  };
}

/**
 * HD% (hen-day percentage), FR-71 = (all eggs laid) / HIDUP × 100. Uses every egg
 * (Utuh + Lunak + Pecah + Kosong) because it tracks hen productivity, not sellable
 * output. Zero when HIDUP is zero (no live hens ⇒ no meaningful rate).
 */
export function computeHdPercent(totalEggs: number, hidup: number): number {
  if (hidup <= 0) return 0;
  return round2((totalEggs / hidup) * 100);
}

/** PAKAN TERSEDIA (FR-72) = PAKAN MASUK + yesterday's reusable leftover (kg). */
export function computePakanTersedia(pakanMasuk: number, reusableLeftoverIn: number): number {
  return round3(pakanMasuk + reusableLeftoverIn);
}

/** REALISASI INTAKE (FR-73) = TERSEDIA − (SISA DIGUNAKAN + SISA DIBUANG), kg. */
export function computeRealisasiIntake(
  tersedia: number,
  sisaDigunakan: number,
  sisaDibuang: number,
): number {
  return round3(tersedia - (sisaDigunakan + sisaDibuang));
}

/** GRAM/EKOR (FR-73) = REALISASI INTAKE / HIDUP × 1000 (grams per bird). */
export function computeGramPerEkor(realisasiIntake: number, hidup: number): number {
  if (hidup <= 0) return 0;
  return round2((realisasiIntake / hidup) * 1000);
}

/** Daily FCR (FR-74) = REALISASI INTAKE / BERAT TELUR. Null when egg mass is zero. */
export function computeFcr(realisasiIntake: number, beratTelur: number): number | null {
  if (beratTelur <= 0) return null;
  return round3(realisasiIntake / beratTelur);
}
