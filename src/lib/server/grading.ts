import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import { GradingStatus, SizeHealthGrade, SourceType } from "@/generated/prisma/enums";
import { toBusinessDate } from "@/lib/dates";
import { ConflictError } from "@/lib/errors";
import { GRADEABLE_GRADES, isPcsGrade } from "@/lib/grades";
import { prisma, TX_OPTIONS } from "@/lib/server/db";
import { resolveWarehouseId } from "@/lib/server/farmhouses";
import { recordInTx, recordOutTx } from "@/lib/server/ledger";

// Grading (SRS §3.3). A batch is graded into Egg SKUs (Size&Health × Type), in pcs.
// Batch-sequential: batch N requires N-1 submitted (and its own collection to exist).
// DRAFT holds line items but posts NO stock; SUBMIT posts every line to the ledger
// (via ledger.ts only, rule 5.4) as its SKU IN to the kandang's warehouse, all in one
// atomic transaction, then locks the batch. Editing a submitted batch reconciles by
// delta (append compensating movements; never rewrite — rule 5.1). The reconcile
// total (graded ≤ Good Eggs − total Angkat Rak) is validated server-side on submit.

const GRADING_INCLUDE = {
  lineItems: {
    include: { gradeType: true },
    orderBy: { gradeType: { sortOrder: "asc" as const } },
  },
};

export interface GradingKey {
  farmhouseId: string;
  date: Date; // business date
  batchNumber: number;
}

export interface GradingLineInput {
  sizeHealthGrade: SizeHealthGrade;
  typeGradeId: string;
  quantity: number; // pcs
}

export interface GradingInput {
  remarks?: string | null;
  lines: GradingLineInput[];
}

interface Ctx {
  userId: string;
}

type NormalizedLine = { grade: SizeHealthGrade; typeId: string; qty: number };

const skuKey = (grade: SizeHealthGrade, typeId: string) => `${grade}|${typeId}`;
const gradeableSet = new Set<SizeHealthGrade>(GRADEABLE_GRADES);

function whereKey(farmhouseId: string, date: Date, batchNumber: number) {
  return { farmhouseId_date_batchNumber: { farmhouseId, date, batchNumber } };
}

/** The pcs available to grade for a batch: Good Eggs − total Angkat Rak (all Types). */
export function availableFromCollection(collection: {
  goodEggs: number;
  angkatRakLifts: { quantity: number }[];
}): number {
  const angkatRak = collection.angkatRakLifts.reduce((s, l) => s + l.quantity, 0);
  return collection.goodEggs - angkatRak;
}

/** Validate, dedupe, drop zeros. Rejects non-gradeable grades (e.g. Angkat Rak). */
function normalizeLines(lines: GradingLineInput[]): Map<string, NormalizedLine> {
  const out = new Map<string, NormalizedLine>();
  for (const line of lines) {
    if (!gradeableSet.has(line.sizeHealthGrade)) {
      throw new ConflictError(`${line.sizeHealthGrade} is not a gradeable Size & Health grade.`);
    }
    if (!Number.isInteger(line.quantity) || line.quantity < 0) {
      throw new ConflictError("Grade quantity must be a non-negative whole number (pcs).");
    }
    if (line.quantity === 0) continue;
    const key = skuKey(line.sizeHealthGrade, line.typeGradeId);
    if (out.has(key)) throw new ConflictError("Duplicate Egg SKU in one grading.");
    out.set(key, { grade: line.sizeHealthGrade, typeId: line.typeGradeId, qty: line.quantity });
  }
  return out;
}

type Tx = Prisma.TransactionClient;

/**
 * The batch's collection must exist and, for batch N>1, batch N-1 must be submitted
 * (FR-14/FR-15). Returns the collection (with Angkat Rak quantities) for reconcile.
 */
async function requireCollectionAndSequential(
  tx: Tx,
  farmhouseId: string,
  date: Date,
  batchNumber: number,
) {
  const collection = await tx.collectionRecord.findUnique({
    where: whereKey(farmhouseId, date, batchNumber),
    include: { angkatRakLifts: { select: { quantity: true } } },
  });
  if (!collection) {
    throw new ConflictError(`No collection for batch ${batchNumber} — record the collection first.`);
  }
  // Same-WITA-day invariant: a grading is tied to its collection's production day, so
  // its business date must equal the collection's. The lookup above keys on `date`, so
  // this holds by construction; the explicit check documents and hard-enforces it.
  if (toBusinessDate(collection.date).getTime() !== date.getTime()) {
    throw new ConflictError("Grading must be recorded on the same business day as its collection.");
  }
  if (batchNumber > 1) {
    const prev = await tx.gradingRecord.findUnique({
      where: whereKey(farmhouseId, date, batchNumber - 1),
      select: { status: true },
    });
    if (!prev || prev.status !== GradingStatus.SUBMITTED) {
      throw new ConflictError(`Grade batch ${batchNumber - 1} first — it must be submitted.`);
    }
  }
  return collection;
}

export function findGrading(key: GradingKey) {
  return prisma.gradingRecord.findUnique({
    where: whereKey(key.farmhouseId, toBusinessDate(key.date), key.batchNumber),
    include: GRADING_INCLUDE,
  });
}

export function listGradings(farmhouseId: string, date: Date) {
  return prisma.gradingRecord.findMany({
    where: { farmhouseId, date: toBusinessDate(date) },
    include: GRADING_INCLUDE,
    orderBy: { batchNumber: "asc" },
  });
}

/**
 * Save (create/update) a DRAFT — line items only, no stock. Blocked by the
 * sequential lock and missing collection. Refuses to draft an already-submitted
 * batch (edit + re-submit instead, so stock stays reconciled).
 */
export async function saveDraft(key: GradingKey, input: GradingInput, ctx: Ctx) {
  const date = toBusinessDate(key.date);
  const desired = normalizeLines(input.lines);

  return prisma.$transaction(async (tx) => {
    const collection = await requireCollectionAndSequential(tx, key.farmhouseId, date, key.batchNumber);

    const existing = await tx.gradingRecord.findUnique({
      where: whereKey(key.farmhouseId, date, key.batchNumber),
      select: { status: true },
    });
    if (existing?.status === GradingStatus.SUBMITTED) {
      throw new ConflictError("This batch is already submitted — edit and re-submit instead.");
    }

    const record = await tx.gradingRecord.upsert({
      where: whereKey(key.farmhouseId, date, key.batchNumber),
      create: {
        farmhouseId: key.farmhouseId,
        date,
        batchNumber: key.batchNumber,
        status: GradingStatus.DRAFT,
        linkedCollectionId: collection.id,
        remarks: input.remarks ?? null,
        enteredById: ctx.userId,
      },
      update: {
        status: GradingStatus.DRAFT,
        linkedCollectionId: collection.id,
        remarks: input.remarks ?? null,
      },
    });

    await tx.gradingLineItem.deleteMany({ where: { gradingRecordId: record.id } });
    if (desired.size > 0) {
      await tx.gradingLineItem.createMany({
        data: [...desired.values()].map((l) => ({
          gradingRecordId: record.id,
          sizeHealthGrade: l.grade,
          typeGradeId: l.typeId,
          quantity: l.qty,
        })),
      });
    }
    return record;
  }, TX_OPTIONS);
}

/**
 * Submit a batch (or edit an already-submitted one). Validates the reconcile total,
 * writes the line items, and reconciles stock by delta — posting each line's SKU as
 * IN/OUT to the kandang's warehouse — all atomically. Sets status SUBMITTED (locks it).
 */
export async function submitGrading(key: GradingKey, input: GradingInput, ctx: Ctx) {
  const date = toBusinessDate(key.date);
  const warehouseId = await resolveWarehouseId(key.farmhouseId, date);
  if (!warehouseId) {
    throw new ConflictError("This kandang has no warehouse mapping for that date.");
  }
  const desired = normalizeLines(input.lines);

  return prisma.$transaction(async (tx) => {
    const collection = await requireCollectionAndSequential(tx, key.farmhouseId, date, key.batchNumber);

    // Reconcile: graded total ≤ available (Good Eggs − total Angkat Rak).
    const available = availableFromCollection(collection);
    const gradedTotal = [...desired.values()].reduce((s, l) => s + l.qty, 0);
    if (gradedTotal > available) {
      throw new ConflictError(
        `Graded total ${gradedTotal} pcs exceeds available ${available} pcs (over by ${gradedTotal - available} pcs).`,
      );
    }

    // Baseline = what is already posted for this batch: the line items IF it was
    // already SUBMITTED (they equal posted stock), else nothing.
    const existing = await tx.gradingRecord.findUnique({
      where: whereKey(key.farmhouseId, date, key.batchNumber),
      include: { lineItems: true },
    });
    const baseline = new Map<string, NormalizedLine>();
    if (existing?.status === GradingStatus.SUBMITTED) {
      for (const li of existing.lineItems) {
        baseline.set(skuKey(li.sizeHealthGrade, li.typeGradeId), {
          grade: li.sizeHealthGrade,
          typeId: li.typeGradeId,
          qty: li.quantity,
        });
      }
    }

    const record = await tx.gradingRecord.upsert({
      where: whereKey(key.farmhouseId, date, key.batchNumber),
      create: {
        farmhouseId: key.farmhouseId,
        date,
        batchNumber: key.batchNumber,
        status: GradingStatus.SUBMITTED,
        linkedCollectionId: collection.id,
        remarks: input.remarks ?? null,
        enteredById: ctx.userId,
      },
      update: {
        status: GradingStatus.SUBMITTED,
        linkedCollectionId: collection.id,
        remarks: input.remarks ?? null,
      },
    });

    // Replace line items with the submitted set.
    await tx.gradingLineItem.deleteMany({ where: { gradingRecordId: record.id } });
    if (desired.size > 0) {
      await tx.gradingLineItem.createMany({
        data: [...desired.values()].map((l) => ({
          gradingRecordId: record.id,
          sizeHealthGrade: l.grade,
          typeGradeId: l.typeId,
          quantity: l.qty,
        })),
      });
    }

    // Reconcile stock by delta (new − posted) per SKU. First submit: baseline is
    // empty so every line posts fully. Edit: only the differences move.
    for (const k of new Set([...baseline.keys(), ...desired.keys()])) {
      const desiredLine = desired.get(k);
      const baseLine = baseline.get(k);
      const meta = desiredLine ?? baseLine!;
      const delta = (desiredLine?.qty ?? 0) - (baseLine?.qty ?? 0);
      if (delta === 0) continue;
      const movement = {
        warehouseId,
        sizeHealthGrade: meta.grade,
        typeGradeId: meta.typeId,
        sourceType: SourceType.GRADING,
        sourceReferenceId: record.id,
        unitUsed: isPcsGrade(meta.grade) ? "PCS" : "RAK",
        enteredById: ctx.userId,
        date,
      };
      if (delta > 0) await recordInTx(tx, { ...movement, quantity: delta });
      else await recordOutTx(tx, { ...movement, quantity: -delta });
    }

    return record;
  }, TX_OPTIONS);
}
