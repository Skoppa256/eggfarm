import "server-only";

import { GradingStatus, SizeHealthGrade, SourceType } from "@/generated/prisma/enums";
import { toBusinessDate } from "@/lib/dates";
import { ConflictError, NotFoundError } from "@/lib/errors";
import { prisma, TX_OPTIONS } from "@/lib/server/db";
import { resolveMaxBatches, resolveWarehouseId } from "@/lib/server/farmhouses";
import { recordInTx, recordOutTx } from "@/lib/server/ledger";

// Collection input (SRS §3.2). One batch per (kandang, business date, batch number).
// Counts are Type-agnostic pcs; only Angkat Rak posts to stock — split by Type, each
// lift becoming SKU (ANGKAT_RAK, typeGrade) IN to the kandang's warehouse, via
// ledger.ts only (rule 5.4). Editing reconciles those movements by delta (append a
// compensating movement; never touch the originals — rule 5.1).

const LIFTS_INCLUDE = {
  angkatRakLifts: {
    include: { gradeType: true },
    orderBy: { gradeType: { sortOrder: "asc" as const } },
  },
};

export interface AngkatRakLiftInput {
  typeGradeId: string;
  quantity: number; // pcs
}

export interface CollectionCounts {
  goodEggs: number;
  telurRetak: number;
  telurLunak: number;
  telurKosong: number;
  remarks?: string | null;
  lifts: AngkatRakLiftInput[]; // pcs per Type; only quantity > 0 is stored/posted
}

export interface CollectionKey {
  farmhouseId: string;
  date: Date; // business date
  batchNumber: number;
}

interface Ctx {
  userId: string;
}

function assertCounts(input: CollectionCounts): void {
  const fields: [string, number][] = [
    ["Telur bagus", input.goodEggs],
    ["Telur retak", input.telurRetak],
    ["Telur lunak", input.telurLunak],
    ["Telur kosong", input.telurKosong],
  ];
  for (const [label, value] of fields) {
    if (!Number.isInteger(value) || value < 0) {
      throw new ConflictError(`${label} harus bilangan bulat non-negatif (pcs).`);
    }
  }
}

/** Validate lifts, drop zeros, reject duplicate Types. Returns only positive lifts. */
function normalizeLifts(lifts: AngkatRakLiftInput[]): AngkatRakLiftInput[] {
  const seen = new Set<string>();
  const out: AngkatRakLiftInput[] = [];
  for (const lift of lifts) {
    if (!Number.isInteger(lift.quantity) || lift.quantity < 0) {
      throw new ConflictError("Jumlah Angkat Rak harus bilangan bulat non-negatif.");
    }
    if (lift.quantity === 0) continue;
    if (seen.has(lift.typeGradeId)) {
      throw new ConflictError("Tipe Angkat Rak duplikat dalam satu batch.");
    }
    seen.add(lift.typeGradeId);
    out.push(lift);
  }
  return out;
}

export function findCollection(key: CollectionKey) {
  return prisma.collectionRecord.findUnique({
    where: {
      farmhouseId_date_batchNumber: {
        farmhouseId: key.farmhouseId,
        date: toBusinessDate(key.date),
        batchNumber: key.batchNumber,
      },
    },
    include: LIFTS_INCLUDE,
  });
}

export function listCollections(farmhouseId: string, date: Date) {
  return prisma.collectionRecord.findMany({
    where: { farmhouseId, date: toBusinessDate(date) },
    include: LIFTS_INCLUDE,
    orderBy: { batchNumber: "asc" },
  });
}

/**
 * Create a new collection for (kandang, business date, batch) and post its Angkat
 * Rak lifts to stock — all atomic. Throws ConflictError on a duplicate key (the UI
 * then opens the existing record to edit) or an out-of-range batch number.
 */
export async function createCollection(key: CollectionKey, input: CollectionCounts, ctx: Ctx) {
  const date = toBusinessDate(key.date);

  const warehouseId = await resolveWarehouseId(key.farmhouseId, date);
  if (!warehouseId) {
    throw new ConflictError("Kandang ini belum punya pemetaan gudang untuk tanggal itu.");
  }
  const maxBatches = await resolveMaxBatches(key.farmhouseId, date);
  if (maxBatches == null) {
    throw new ConflictError("Kandang ini belum punya konfigurasi batch untuk tanggal itu.");
  }
  if (!Number.isInteger(key.batchNumber) || key.batchNumber < 1 || key.batchNumber > maxBatches) {
    throw new ConflictError(`Nomor batch harus antara 1 dan ${maxBatches}.`);
  }

  const existing = await prisma.collectionRecord.findUnique({
    where: {
      farmhouseId_date_batchNumber: { farmhouseId: key.farmhouseId, date, batchNumber: key.batchNumber },
    },
    select: { id: true },
  });
  if (existing) {
    throw new ConflictError(
      "Pengambilan untuk kandang, tanggal, dan batch ini sudah ada — buka untuk mengubahnya.",
    );
  }

  assertCounts(input);
  const lifts = normalizeLifts(input.lifts);

  return prisma.$transaction(async (tx) => {
    const collection = await tx.collectionRecord.create({
      data: {
        farmhouseId: key.farmhouseId,
        date,
        batchNumber: key.batchNumber,
        goodEggs: input.goodEggs,
        telurRetak: input.telurRetak,
        telurLunak: input.telurLunak,
        telurKosong: input.telurKosong,
        remarks: input.remarks ?? null,
        maxBatchesAtEntry: maxBatches, // frozen snapshot (write-once, §5.3)
        enteredById: ctx.userId,
      },
    });

    for (const lift of lifts) {
      await tx.angkatRakLift.create({
        data: {
          collectionRecordId: collection.id,
          typeGradeId: lift.typeGradeId,
          quantity: lift.quantity,
        },
      });
      await recordInTx(tx, {
        warehouseId,
        sizeHealthGrade: SizeHealthGrade.ANGKAT_RAK,
        typeGradeId: lift.typeGradeId,
        quantity: lift.quantity,
        sourceType: SourceType.ANGKAT_RAK,
        sourceReferenceId: collection.id,
        unitUsed: "RAK",
        enteredById: ctx.userId,
        date,
      });
    }

    return collection;
  }, TX_OPTIONS);
}

/**
 * Edit an existing collection's counts and Angkat Rak lifts. The identity
 * (kandang/date/batch) and maxBatchesAtEntry are immutable. Angkat Rak stock is
 * reconciled per Type by the delta (new − old): a positive delta posts an IN, a
 * negative delta an OUT — appended, never overwriting the original movements.
 *
 * Once this batch's grading is SUBMITTED the collection is LOCKED (closes A12): a plain
 * edit is rejected so a submitted grading's reconcile can't be invalidated behind its
 * back. `opts.allowGradedEdit` is a Superadmin-only override that permits the edit but
 * still refuses to leave the submitted grading over-allocated (graded ≤ available), and
 * stamps the compensating Angkat Rak movements with an audit reason.
 */
export async function updateCollection(
  collectionId: string,
  input: CollectionCounts,
  ctx: Ctx,
  opts?: { allowGradedEdit?: boolean },
) {
  const existing = await prisma.collectionRecord.findUnique({
    where: { id: collectionId },
    include: { angkatRakLifts: true },
  });
  if (!existing) {
    throw new NotFoundError("Pengambilan tidak ditemukan.");
  }

  const date = existing.date; // key is immutable on edit
  const warehouseId = await resolveWarehouseId(existing.farmhouseId, date);
  if (!warehouseId) {
    throw new ConflictError("Kandang ini belum punya pemetaan gudang untuk tanggal itu.");
  }

  assertCounts(input);
  const desired = new Map<string, number>();
  for (const lift of normalizeLifts(input.lifts)) desired.set(lift.typeGradeId, lift.quantity);
  const current = new Map<string, { liftId: string; qty: number }>();
  for (const lift of existing.angkatRakLifts) {
    current.set(lift.typeGradeId, { liftId: lift.id, qty: lift.quantity });
  }
  const typeIds = new Set<string>([...desired.keys(), ...current.keys()]);

  // Collection lock: if this batch is already graded (SUBMITTED), the collection is
  // frozen unless a Superadmin overrides — and even then it must not strand grading.
  const submittedGrading = await prisma.gradingRecord.findFirst({
    where: {
      farmhouseId: existing.farmhouseId,
      date,
      batchNumber: existing.batchNumber,
      status: GradingStatus.SUBMITTED,
    },
    include: { lineItems: { select: { quantity: true } } },
  });
  let auditReason: string | null = null;
  if (submittedGrading) {
    if (!opts?.allowGradedEdit) {
      throw new ConflictError(
        "Batch ini sudah di-grading — pengambilannya terkunci. Superadmin bisa menimpa untuk mengoreksinya.",
      );
    }
    const newAngkatRak = [...desired.values()].reduce((s, q) => s + q, 0);
    const newAvailable = input.goodEggs - newAngkatRak;
    const gradedTotal = submittedGrading.lineItems.reduce((s, li) => s + li.quantity, 0);
    if (gradedTotal > newAvailable) {
      throw new ConflictError(
        `Perubahan ini akan membuat grading kelebihan alokasi: ter-grading ${gradedTotal} pcs > tersedia ${newAvailable} pcs. Sesuaikan grading dulu.`,
      );
    }
    auditReason = "Collection edited after grading (Superadmin override).";
  }

  return prisma.$transaction(async (tx) => {
    await tx.collectionRecord.update({
      where: { id: collectionId },
      data: {
        goodEggs: input.goodEggs,
        telurRetak: input.telurRetak,
        telurLunak: input.telurLunak,
        telurKosong: input.telurKosong,
        remarks: input.remarks ?? null,
      },
    });

    for (const typeGradeId of typeIds) {
      const newQty = desired.get(typeGradeId) ?? 0;
      const cur = current.get(typeGradeId);
      const oldQty = cur?.qty ?? 0;

      // Reconcile the lift row to reflect the new quantity.
      if (newQty === 0 && cur) {
        await tx.angkatRakLift.delete({ where: { id: cur.liftId } });
      } else if (cur && newQty !== oldQty) {
        await tx.angkatRakLift.update({ where: { id: cur.liftId }, data: { quantity: newQty } });
      } else if (!cur && newQty > 0) {
        await tx.angkatRakLift.create({
          data: { collectionRecordId: collectionId, typeGradeId, quantity: newQty },
        });
      }

      // Reconcile stock by the delta (append a compensating movement; rule 5.1).
      const delta = newQty - oldQty;
      if (delta === 0) continue;
      const movement = {
        warehouseId,
        sizeHealthGrade: SizeHealthGrade.ANGKAT_RAK,
        typeGradeId,
        sourceType: SourceType.ANGKAT_RAK,
        sourceReferenceId: collectionId,
        unitUsed: "RAK",
        enteredById: ctx.userId,
        date,
        reason: auditReason,
      };
      if (delta > 0) await recordInTx(tx, { ...movement, quantity: delta });
      else await recordOutTx(tx, { ...movement, quantity: -delta });
    }

    return tx.collectionRecord.findUnique({ where: { id: collectionId }, include: LIFTS_INCLUDE });
  }, TX_OPTIONS);
}
