import "server-only";

import { Prisma } from "@/generated/prisma/client";
import { GradingStatus, SizeHealthGrade } from "@/generated/prisma/enums";
import {
  computeEggBuckets,
  computeFcr,
  computeGramPerEkor,
  computeHdPercent,
  computePakanTersedia,
  computeRealisasiIntake,
  type EggBuckets,
} from "@/lib/daily";
import { toBusinessDate } from "@/lib/dates";
import { ConflictError, NotFoundError } from "@/lib/errors";
import { prisma, TX_OPTIONS } from "@/lib/server/db";
import { applyDailyMortalityTx } from "@/lib/server/flocks";

// Daily farmhouse recording (SRS §3.10). One record per kandang per business day for the
// active placement. Admin types the yellow fields; HARI/MINGGU/HIDUP come from the flock
// layer, the egg buckets from collection (reconciled to grading), and HD% from both. The
// stateful derived values (HIDUP, HD%) are frozen write-once at creation (§5.3); the egg
// buckets derive live on read. The PAKAN block is frozen write-once once PAKAN MASUK is
// known (from the Slice 10 mixing event) — see freezeDailyFeedBlockTx.

export interface DailyKey {
  farmhouseId: string;
  date: Date; // business date
}

export interface DailyInput {
  mati: number;
  afkir: number;
  sisaDigunakan: number; // kg
  sisaDibuang: number; // kg
  beratTelur: number; // kg (daily egg mass)
  beratBadan?: number | null; // sampled body weight (optional)
  obatNote?: string | null;
  vitaminNote?: string | null;
  keterangan?: string | null;
}

interface Ctx {
  userId: string;
}

type Tx = Prisma.TransactionClient;

const dec3 = (n: number) => new Prisma.Decimal(n.toFixed(3));
const dec2 = (n: number) => new Prisma.Decimal(n.toFixed(2));

/** The daily-record fields the PAKAN freeze reads (Admin inputs + frozen HIDUP). */
interface FeedFreezeTarget {
  id: string;
  hidup: number;
  pakanMasuk: Prisma.Decimal | null;
  sisaDigunakan: Prisma.Decimal;
  sisaDibuang: Prisma.Decimal;
  beratTelur: Prisma.Decimal;
}

/**
 * Freeze the PAKAN block onto a daily record from a known PAKAN MASUK (§5.3, write-once).
 * TERSEDIA = MASUK + reusable leftover; REALISASI INTAKE = TERSEDIA − (DIGUNAKAN + DIBUANG);
 * GRAM/EKOR = INTAKE / HIDUP × 1000; FCR = INTAKE / BERAT TELUR. No-op if already frozen
 * (pakanMasuk set) — the first write wins, whether it happened at record creation (mix
 * already existed) or when the mix was later confirmed.
 */
export async function freezeDailyFeedBlockTx(
  tx: Tx,
  record: FeedFreezeTarget,
  masuk: number,
  jenis: string,
  reusableLeftoverIn: number,
) {
  if (record.pakanMasuk != null) return; // already frozen — write-once
  const tersedia = computePakanTersedia(masuk, reusableLeftoverIn);
  const intake = computeRealisasiIntake(tersedia, record.sisaDigunakan.toNumber(), record.sisaDibuang.toNumber());
  const gram = computeGramPerEkor(intake, record.hidup);
  const fcr = computeFcr(intake, record.beratTelur.toNumber());
  await tx.dailyRecord.update({
    where: { id: record.id },
    data: {
      pakanMasuk: dec3(masuk),
      reusableLeftoverIn: dec3(reusableLeftoverIn),
      pakanTersedia: dec3(tersedia),
      realisasiIntake: dec3(intake),
      gramPerEkor: dec2(gram),
      fcr: fcr != null ? dec3(fcr) : null,
      jenis,
    },
  });
}

function assertInput(input: DailyInput): void {
  if (!Number.isInteger(input.mati) || input.mati < 0 || !Number.isInteger(input.afkir) || input.afkir < 0) {
    throw new ConflictError("MATI and AFKIR must be non-negative whole numbers.");
  }
  const kg: [string, number][] = [
    ["SISA DIGUNAKAN", input.sisaDigunakan],
    ["SISA DIBUANG", input.sisaDibuang],
    ["BERAT TELUR", input.beratTelur],
  ];
  for (const [label, value] of kg) {
    if (!Number.isFinite(value) || value < 0) {
      throw new ConflictError(`${label} must be a non-negative number (kg).`);
    }
  }
  if (input.beratBadan != null && (!Number.isFinite(input.beratBadan) || input.beratBadan < 0)) {
    throw new ConflictError("BERAT BADAN must be a non-negative number.");
  }
}

/** The placement housing `farmhouseId` on `date` (covers the date; newest wins). */
export async function resolvePlacementForDate(farmhouseId: string, date: Date) {
  return prisma.placement.findFirst({
    where: {
      farmhouseId,
      startDate: { lte: toBusinessDate(date) },
      OR: [{ endDate: null }, { endDate: { gte: toBusinessDate(date) } }],
    },
    orderBy: { startDate: "desc" },
    include: { flock: true },
  });
}

async function resolvePlacementForDateTx(tx: Tx, farmhouseId: string, date: Date) {
  return tx.placement.findFirst({
    where: {
      farmhouseId,
      startDate: { lte: date },
      OR: [{ endDate: null }, { endDate: { gte: date } }],
    },
    orderBy: { startDate: "desc" },
  });
}

/** Sum the day's collection batches into the four-bucket inputs (pcs). */
async function collectionTotals(client: Tx | typeof prisma, farmhouseId: string, date: Date) {
  const rows = await client.collectionRecord.findMany({
    where: { farmhouseId, date },
    select: { goodEggs: true, telurRetak: true, telurLunak: true, telurKosong: true },
  });
  return rows.reduce(
    (a, c) => ({
      goodEggs: a.goodEggs + c.goodEggs,
      telurRetak: a.telurRetak + c.telurRetak,
      telurLunak: a.telurLunak + c.telurLunak,
      telurKosong: a.telurKosong + c.telurKosong,
    }),
    { goodEggs: 0, telurRetak: 0, telurLunak: 0, telurKosong: 0 },
  );
}

/** Retak/Plastik split from the day's SUBMITTED gradings, or null if none yet. */
async function gradingSubSplit(client: Tx | typeof prisma, farmhouseId: string, date: Date) {
  const submitted = await client.gradingRecord.findMany({
    where: { farmhouseId, date, status: GradingStatus.SUBMITTED },
    select: { lineItems: { select: { sizeHealthGrade: true, quantity: true } } },
  });
  if (submitted.length === 0) return null;
  let retak = 0;
  let plastik = 0;
  for (const g of submitted) {
    for (const li of g.lineItems) {
      if (li.sizeHealthGrade === SizeHealthGrade.RETAK) retak += li.quantity;
      else if (li.sizeHealthGrade === SizeHealthGrade.PLASTIK) plastik += li.quantity;
    }
  }
  return { retak, plastik };
}

/** Live egg buckets for a kandang/day (collection totals, reconciled to grading). */
export async function liveEggBuckets(farmhouseId: string, date: Date): Promise<EggBuckets> {
  const on = toBusinessDate(date);
  const [totals, split] = await Promise.all([
    collectionTotals(prisma, farmhouseId, on),
    gradingSubSplit(prisma, farmhouseId, on),
  ]);
  return computeEggBuckets(totals, split);
}

/**
 * Yesterday's reusable leftover (the prior daily record's SISA DIGUNAKAN, kg) for the
 * placement — the carry-in to today's PAKAN TERSEDIA. 0 if there's no earlier record.
 */
export async function previousReusableLeftover(placementId: string, date: Date): Promise<number> {
  const prev = await prisma.dailyRecord.findFirst({
    where: { placementId, date: { lt: toBusinessDate(date) } },
    orderBy: { date: "desc" },
    select: { sisaDigunakan: true },
  });
  return prev ? prev.sisaDigunakan.toNumber() : 0;
}

export function findDailyRecord(farmhouseId: string, date: Date) {
  return prisma.dailyRecord.findUnique({
    where: { farmhouseId_date: { farmhouseId, date: toBusinessDate(date) } },
  });
}

/**
 * Create the day's record. Resolves the active placement, applies MATI/AFKIR to the
 * HIDUP ledger (write-once via the flock helper), freezes HIDUP and HD%, and stores the
 * Admin inputs — all atomically. Duplicate (kandang/date) → edit instead. Day-0
 * (chick-in-day) mortality nets off Populasi Awal (handled by applyDailyMortalityTx).
 */
export async function createDailyRecord(key: DailyKey, input: DailyInput, ctx: Ctx) {
  const date = toBusinessDate(key.date);
  assertInput(input);

  return prisma.$transaction(async (tx) => {
    const dup = await tx.dailyRecord.findUnique({
      where: { farmhouseId_date: { farmhouseId: key.farmhouseId, date } },
    });
    if (dup) {
      throw new ConflictError("A daily record for this kandang and date already exists — edit it.");
    }

    const placement = await resolvePlacementForDateTx(tx, key.farmhouseId, date);
    if (!placement) {
      throw new ConflictError("No placement occupies this kandang on that date — chick-in a flock first.");
    }

    // MATI/AFKIR drive the day's running HIDUP through the write-once snapshot ledger.
    // The chick-in day nets arrival-day deaths off Populasi Awal; later days off the
    // previous HIDUP — both handled by applyDailyMortalityTx.
    const snap = await applyDailyMortalityTx(tx, placement.id, date, input.mati, input.afkir);
    const hidup = snap.hidup;

    // Egg buckets (live) → HD% (frozen), both Type-agnostic.
    const totals = await collectionTotals(tx, key.farmhouseId, date);
    const split = await gradingSubSplit(tx, key.farmhouseId, date);
    const buckets = computeEggBuckets(totals, split);
    const hdPercent = computeHdPercent(buckets.total, hidup);

    const record = await tx.dailyRecord.create({
      data: {
        farmhouseId: key.farmhouseId,
        placementId: placement.id,
        date,
        mati: input.mati,
        afkir: input.afkir,
        sisaDigunakan: dec3(input.sisaDigunakan),
        sisaDibuang: dec3(input.sisaDibuang),
        beratTelur: dec3(input.beratTelur),
        beratBadan: input.beratBadan != null ? dec2(input.beratBadan) : null,
        obatNote: input.obatNote ?? null,
        vitaminNote: input.vitaminNote ?? null,
        keterangan: input.keterangan ?? null,
        hidup,
        hdPercent: dec2(hdPercent),
        enteredById: ctx.userId,
      },
    });

    // If the day was already mixed (mixing is done the night before), freeze the PAKAN
    // block now from that mix's MASUK. Otherwise it stays null until the mix is confirmed.
    const mix = await tx.mixingRecord.findUnique({
      where: { farmhouseId_date: { farmhouseId: key.farmhouseId, date } },
      select: { totalCampur: true, jenis: true, reusableLeftover: true },
    });
    if (mix) {
      await freezeDailyFeedBlockTx(tx, record, mix.totalCampur.toNumber(), mix.jenis, mix.reusableLeftover.toNumber());
      return tx.dailyRecord.findUniqueOrThrow({ where: { id: record.id } });
    }
    return record;
  }, TX_OPTIONS);
}

/**
 * Edit the day's record. MATI/AFKIR are frozen once recorded (the HIDUP snapshot is
 * write-once, §5.3) — changing them needs a supervised correction, not built yet — so a
 * change is rejected. The frozen HIDUP and HD% are left as-is; only the feed leftovers,
 * egg mass, body weight, and notes update.
 */
export async function updateDailyRecord(recordId: string, input: DailyInput, ctx: Ctx) {
  void ctx;
  const existing = await prisma.dailyRecord.findUnique({ where: { id: recordId } });
  if (!existing) {
    throw new NotFoundError("Daily record not found.");
  }
  assertInput(input);
  if (input.mati !== existing.mati || input.afkir !== existing.afkir) {
    throw new ConflictError(
      "MATI/AFKIR are frozen once recorded — correcting them needs a supervised correction (not available yet).",
    );
  }

  return prisma.dailyRecord.update({
    where: { id: recordId },
    data: {
      sisaDigunakan: dec3(input.sisaDigunakan),
      sisaDibuang: dec3(input.sisaDibuang),
      beratTelur: dec3(input.beratTelur),
      beratBadan: input.beratBadan != null ? dec2(input.beratBadan) : null,
      obatNote: input.obatNote ?? null,
      vitaminNote: input.vitaminNote ?? null,
      keterangan: input.keterangan ?? null,
    },
  });
}
