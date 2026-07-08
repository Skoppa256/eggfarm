import "server-only";

import { Prisma } from "@/generated/prisma/client";
import { MixLineKind, RecordStatus } from "@/generated/prisma/enums";
import { toBusinessDate } from "@/lib/dates";
import { ConflictError, NotFoundError } from "@/lib/errors";
import {
  computeJenis,
  computeMainWeight,
  computeRequirementKg,
  computeTotalCampur,
  type JenisEntry,
} from "@/lib/pakan";
import { prisma, TX_OPTIONS } from "@/lib/server/db";
import { freezeDailyFeedBlockTx, previousReusableLeftover, resolvePlacementForDate } from "@/lib/server/dailyRecords";
import { resolveHidup } from "@/lib/server/flocks";
import { drawIngredientTx } from "@/lib/server/ingredientLedger";

// Feed mixing (SRS §3.11). One mix per kandang per consumption day (mixed the night
// before, dated to the day eaten). Requirement = HIDUP × projected intake ÷ 1000; the
// fresh mix TOTAL CAMPUR (= PAKAN MASUK) nets yesterday's reusable leftover, floored at
// 0. Mains fill the fresh mix by %, supplements are fixed weights (not scaled). On
// confirmation, every line draws its weight down from central ingredient stock (via
// ingredientLedger.ts — rule 5.4), all atomically, and PAKAN MASUK/JENIS post write-once
// onto that day's DailyRecord (§5.3). The computed values are frozen on the record.

const PERCENT_TOLERANCE = 0.01; // mains must sum to 100% within this

const MIXING_INCLUDE = {
  farmhouse: { select: { name: true, code: true } },
  lines: { include: { ingredient: true }, orderBy: { ingredient: { sortOrder: "asc" as const } } },
};

export interface MixLineInput {
  ingredientId: string;
  kind: MixLineKind;
  percent?: number; // MAIN_PERCENT: % of the fresh mix
  fixedWeight?: number; // FIXED_WEIGHT: kg as entered
}

export interface MixingKey {
  farmhouseId: string;
  date: Date; // consumption day
  projectedIntake: number; // g/bird
}

interface Ctx {
  userId: string;
}

interface NormalizedLine {
  ingredientId: string;
  kind: MixLineKind;
  percent: number | null;
  fixedWeight: number | null;
  weight: number; // computed draw-down weight (kg)
  jenis: JenisEntry;
}

export function findMixing(farmhouseId: string, date: Date) {
  return prisma.mixingRecord.findUnique({
    where: { farmhouseId_date: { farmhouseId, date: toBusinessDate(date) } },
    include: MIXING_INCLUDE,
  });
}

/** The kandang's most recent prior mix, for pre-filling today's recipe (FR-87). */
export function previousMixing(farmhouseId: string, date: Date) {
  return prisma.mixingRecord.findFirst({
    where: { farmhouseId, date: { lt: toBusinessDate(date) } },
    orderBy: { date: "desc" },
    include: MIXING_INCLUDE,
  });
}

/**
 * Read-only history for the "Riwayat" panel: the kandang's last `limit` consumption
 * days strictly before `before`, most recent first. Scalar columns only (no draw-down,
 * no writes). Used to show the Admin yesterday's data and pre-fill today's intake.
 */
export function recentMixings(farmhouseId: string, before: Date, limit = 5) {
  return prisma.mixingRecord.findMany({
    where: { farmhouseId, date: { lt: toBusinessDate(before) } },
    orderBy: { date: "desc" },
    take: limit,
  });
}

/**
 * The planning inputs the mixing screen shows before confirming: the resolved HIDUP,
 * yesterday's reusable leftover, the requirement, and the netted fresh mix (MASUK).
 */
export async function mixingPlan(farmhouseId: string, date: Date, projectedIntake: number) {
  const on = toBusinessDate(date);
  const placement = await resolvePlacementForDate(farmhouseId, on);
  if (!placement) return null;
  const hidup = (await resolveHidup(placement.id, on)) ?? placement.populasiAwal;
  const reusableLeftover = await previousReusableLeftover(placement.id, on);
  const requirement = computeRequirementKg(hidup, projectedIntake);
  const totalCampur = computeTotalCampur(requirement, reusableLeftover);
  return { placementId: placement.id, hidup, reusableLeftover, requirement, totalCampur };
}

async function normalizeLines(lines: MixLineInput[], totalCampur: number): Promise<NormalizedLine[]> {
  if (lines.length === 0) {
    throw new ConflictError("Tambahkan minimal satu pakan utama ke resep.");
  }
  const ids = lines.map((l) => l.ingredientId);
  if (new Set(ids).size !== ids.length) {
    throw new ConflictError("Sebuah bahan muncul lebih dari sekali dalam resep.");
  }
  const ingredients = await prisma.ingredient.findMany({ where: { id: { in: ids } } });
  const byId = new Map(ingredients.map((i) => [i.id, i]));

  let mainCount = 0;
  let percentSum = 0;
  const out: NormalizedLine[] = [];
  for (const line of lines) {
    const ing = byId.get(line.ingredientId);
    if (!ing) throw new NotFoundError("Resep merujuk ke bahan yang tidak dikenal.");
    if (ing.status !== RecordStatus.ACTIVE) {
      throw new ConflictError(`Bahan "${ing.name}" tidak aktif.`);
    }
    const jenis: JenisEntry = { name: ing.name, category: ing.category, sortOrder: ing.sortOrder };

    if (line.kind === MixLineKind.MAIN_PERCENT) {
      const percent = line.percent ?? 0;
      if (!Number.isFinite(percent) || percent <= 0) {
        throw new ConflictError(`Pakan utama "${ing.name}" butuh persentase lebih besar dari 0.`);
      }
      mainCount += 1;
      percentSum += percent;
      // On a no-mix day (totalCampur 0) nothing is drawn; weight is 0.
      out.push({
        ingredientId: ing.id,
        kind: line.kind,
        percent,
        fixedWeight: null,
        weight: totalCampur > 0 ? computeMainWeight(totalCampur, percent) : 0,
        jenis,
      });
    } else {
      const fixed = line.fixedWeight ?? 0;
      if (!Number.isFinite(fixed) || fixed <= 0) {
        throw new ConflictError(`Suplemen "${ing.name}" butuh berat tetap lebih besar dari 0.`);
      }
      out.push({
        ingredientId: ing.id,
        kind: line.kind,
        percent: null,
        fixedWeight: fixed,
        weight: totalCampur > 0 ? fixed : 0,
        jenis,
      });
    }
  }

  if (mainCount === 0) {
    throw new ConflictError("Resep butuh minimal satu pakan utama (dengan %).");
  }
  if (Math.abs(percentSum - 100) > PERCENT_TOLERANCE) {
    throw new ConflictError(`Persentase pakan utama harus berjumlah 100% (saat ini ${percentSum}%).`);
  }
  return out;
}

/**
 * Confirm a kandang's mix for a consumption day: freeze the requirement / MASUK / JENIS,
 * draw each line down from central stock, and post PAKAN MASUK onto the day's DailyRecord
 * if it exists (else the record freezes it at creation). One mix per kandang/day. On a
 * no-mix day (leftover ≥ requirement) MASUK is 0 and nothing is drawn.
 */
export async function createMixing(key: MixingKey, lines: MixLineInput[], ctx: Ctx) {
  const date = toBusinessDate(key.date);
  if (!Number.isFinite(key.projectedIntake) || key.projectedIntake <= 0) {
    throw new ConflictError("Proyeksi intake (g/ekor) harus lebih besar dari 0.");
  }

  const placement = await resolvePlacementForDate(key.farmhouseId, date);
  if (!placement) {
    throw new ConflictError("Belum ada penempatan di kandang ini pada tanggal itu — lakukan chick-in flock dulu.");
  }
  const hidup = (await resolveHidup(placement.id, date)) ?? placement.populasiAwal;
  const reusableLeftover = await previousReusableLeftover(placement.id, date);
  const requirement = computeRequirementKg(hidup, key.projectedIntake);
  const totalCampur = computeTotalCampur(requirement, reusableLeftover);

  const normalized = await normalizeLines(lines, totalCampur);
  const jenis = computeJenis(normalized.map((l) => l.jenis));

  return prisma.$transaction(async (tx) => {
    const dup = await tx.mixingRecord.findUnique({
      where: { farmhouseId_date: { farmhouseId: key.farmhouseId, date } },
    });
    if (dup) {
      throw new ConflictError("Kandang ini sudah punya campuran untuk hari itu.");
    }

    const mix = await tx.mixingRecord.create({
      data: {
        farmhouseId: key.farmhouseId,
        placementId: placement.id,
        date,
        projectedIntake: new Prisma.Decimal(key.projectedIntake.toFixed(3)),
        hidupAtMix: hidup,
        requirement: new Prisma.Decimal(requirement.toFixed(3)),
        reusableLeftover: new Prisma.Decimal(reusableLeftover.toFixed(3)),
        totalCampur: new Prisma.Decimal(totalCampur.toFixed(3)),
        jenis,
        enteredById: ctx.userId,
      },
    });

    for (const line of normalized) {
      await tx.mixingLine.create({
        data: {
          mixingRecordId: mix.id,
          ingredientId: line.ingredientId,
          kind: line.kind,
          percent: line.percent != null ? new Prisma.Decimal(line.percent.toFixed(3)) : null,
          fixedWeight: line.fixedWeight != null ? new Prisma.Decimal(line.fixedWeight.toFixed(3)) : null,
          computedWeight: new Prisma.Decimal(line.weight.toFixed(3)),
        },
      });
      // Draw the line down from central stock (rule 5.4). No-mix day → weight 0 → skip.
      if (line.weight > 0) {
        await drawIngredientTx(tx, {
          ingredientId: line.ingredientId,
          quantity: line.weight,
          enteredById: ctx.userId,
          sourceReferenceId: mix.id,
          date,
        });
      }
    }

    // Post PAKAN MASUK write-once onto an existing daily record (else it freezes at creation).
    const daily = await tx.dailyRecord.findUnique({
      where: { farmhouseId_date: { farmhouseId: key.farmhouseId, date } },
      select: {
        id: true,
        hidup: true,
        pakanMasuk: true,
        sisaDigunakan: true,
        sisaDibuang: true,
        beratTelur: true,
      },
    });
    if (daily) {
      await freezeDailyFeedBlockTx(tx, daily, totalCampur, jenis, reusableLeftover);
    }

    return tx.mixingRecord.findUniqueOrThrow({ where: { id: mix.id }, include: MIXING_INCLUDE });
  }, TX_OPTIONS);
}
