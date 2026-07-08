import "server-only";

import {
  RecordStatus,
  SalesStatus,
  type SizeHealthGrade,
  SourceType,
} from "@/generated/prisma/enums";
import { toBusinessDate } from "@/lib/dates";
import { ConflictError, NotFoundError } from "@/lib/errors";
import { prisma, TX_OPTIONS } from "@/lib/server/db";
import { recordOutTx, recordVoidTx } from "@/lib/server/ledger";

// Sales & Dispatch (SRS §3.5). One transaction = one warehouse, one buyer, one
// business date, many Egg-SKU lines. On submit every line deducts stock atomically
// via ledger.ts (rule 5.4). Voiding restores stock via compensating VOID movements.

const SALE_INCLUDE = {
  buyer: true,
  warehouse: true,
  enteredBy: { select: { name: true, username: true } },
  voidedBy: { select: { name: true, username: true } },
  lineItems: {
    include: { gradeType: true },
    orderBy: [{ sizeHealthGrade: "asc" as const }, { gradeType: { sortOrder: "asc" as const } }],
  },
};

export interface SaleLineInput {
  sizeHealthGrade: SizeHealthGrade;
  typeGradeId: string;
  quantity: number; // pcs
  unitUsed: string; // "RAK" | "PCS"
}

export interface SaleInput {
  warehouseId: string;
  buyerId: string;
  date: Date; // business date
  notes?: string | null;
  lines: SaleLineInput[];
}

interface Ctx {
  userId: string;
}

const skuKey = (grade: SizeHealthGrade, typeId: string) => `${grade}|${typeId}`;

export function findSale(id: string) {
  return prisma.salesTransaction.findUnique({ where: { id }, include: SALE_INCLUDE });
}

export interface SalesFilter {
  warehouseId?: string;
  buyerId?: string;
  from?: Date;
  to?: Date;
  sizeHealthGrade?: SizeHealthGrade;
  typeGradeId?: string;
  includeVoided?: boolean;
  limit?: number;
}

export function listSales(filter: SalesFilter = {}) {
  const { warehouseId, buyerId, from, to, sizeHealthGrade, typeGradeId } = filter;
  return prisma.salesTransaction.findMany({
    where: {
      ...(warehouseId ? { warehouseId } : {}),
      ...(buyerId ? { buyerId } : {}),
      // Voided transactions are excluded by default (FR-33).
      ...(filter.includeVoided ? {} : { status: SalesStatus.ACTIVE }),
      ...(from || to
        ? { date: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } }
        : {}),
      ...(sizeHealthGrade || typeGradeId
        ? {
            lineItems: {
              some: {
                ...(sizeHealthGrade ? { sizeHealthGrade } : {}),
                ...(typeGradeId ? { typeGradeId } : {}),
              },
            },
          }
        : {}),
    },
    include: SALE_INCLUDE,
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    take: filter.limit ?? 200,
  });
}

/**
 * Create a sale and deduct every line atomically (FR-28..31). The dispatch warehouse
 * and the buyer must both be ACTIVE. Lines are deducted in a deterministic SKU order
 * so two concurrent sales acquire their row locks in the same order (deadlock-free).
 * If any line is short, `recordOutTx` throws naming the SKU and the whole transaction
 * rolls back — no partial deduction. One OUT movement per line.
 */
export async function createSale(input: SaleInput, ctx: Ctx) {
  const date = toBusinessDate(input.date);

  if (input.lines.length === 0) {
    throw new ConflictError("Penjualan butuh minimal satu baris item.");
  }
  for (const line of input.lines) {
    if (!Number.isInteger(line.quantity) || line.quantity <= 0) {
      throw new ConflictError("Setiap baris butuh jumlah bulat positif (pcs).");
    }
  }

  const warehouse = await prisma.warehouse.findUnique({ where: { id: input.warehouseId } });
  if (!warehouse) {
    throw new NotFoundError("Gudang tidak ditemukan.");
  }
  if (warehouse.status !== RecordStatus.ACTIVE) {
    throw new ConflictError("Gudang tidak aktif — tidak bisa menjadi target pengiriman.");
  }

  const buyer = await prisma.buyer.findUnique({ where: { id: input.buyerId } });
  if (!buyer) {
    throw new NotFoundError("Pembeli tidak ditemukan.");
  }
  if (buyer.status !== RecordStatus.ACTIVE) {
    throw new ConflictError("Pembeli tidak aktif.");
  }

  const orderedLines = [...input.lines].sort((a, b) =>
    skuKey(a.sizeHealthGrade, a.typeGradeId).localeCompare(skuKey(b.sizeHealthGrade, b.typeGradeId)),
  );

  return prisma.$transaction(async (tx) => {
    const sale = await tx.salesTransaction.create({
      data: {
        date,
        warehouseId: input.warehouseId,
        buyerId: input.buyerId,
        status: SalesStatus.ACTIVE,
        notes: input.notes ?? null,
        enteredById: ctx.userId,
      },
    });

    for (const line of orderedLines) {
      await tx.salesLineItem.create({
        data: {
          transactionId: sale.id,
          sizeHealthGrade: line.sizeHealthGrade,
          typeGradeId: line.typeGradeId,
          quantity: line.quantity,
          unitUsed: line.unitUsed,
        },
      });
      await recordOutTx(tx, {
        warehouseId: input.warehouseId,
        sizeHealthGrade: line.sizeHealthGrade,
        typeGradeId: line.typeGradeId,
        quantity: line.quantity,
        sourceType: SourceType.SALES,
        sourceReferenceId: sale.id,
        unitUsed: line.unitUsed,
        enteredById: ctx.userId,
        date,
      });
    }

    return sale;
  }, TX_OPTIONS);
}

/**
 * Void a transaction (FR-33): restore every line's stock via a compensating VOID
 * movement (never delete the original OUT) and flip status to VOIDED. Idempotent —
 * a second void is rejected via an atomic status guard.
 */
export async function voidSale(transactionId: string, reason: string, ctx: Ctx) {
  const trimmed = reason.trim();
  if (trimmed.length < 10) {
    throw new ConflictError("Pembatalan butuh alasan minimal 10 karakter.");
  }

  const sale = await prisma.salesTransaction.findUnique({
    where: { id: transactionId },
    include: { lineItems: true },
  });
  if (!sale) {
    throw new NotFoundError("Transaksi tidak ditemukan.");
  }
  if (sale.status === SalesStatus.VOIDED) {
    throw new ConflictError("Transaksi ini sudah dibatalkan.");
  }

  return prisma.$transaction(async (tx) => {
    // Atomically claim the void: only succeeds if the row is still ACTIVE. Guards
    // against a concurrent double-void.
    const claimed = await tx.salesTransaction.updateMany({
      where: { id: transactionId, status: SalesStatus.ACTIVE },
      data: {
        status: SalesStatus.VOIDED,
        voidReason: trimmed,
        voidedById: ctx.userId,
        voidedAt: new Date(),
      },
    });
    if (claimed.count === 0) {
      throw new ConflictError("Transaksi ini sudah dibatalkan.");
    }

    for (const line of sale.lineItems) {
      await recordVoidTx(tx, {
        warehouseId: sale.warehouseId,
        sizeHealthGrade: line.sizeHealthGrade,
        typeGradeId: line.typeGradeId,
        quantity: line.quantity,
        sourceType: SourceType.SALES,
        sourceReferenceId: sale.id,
        unitUsed: "PCS",
        reason: trimmed,
        enteredById: ctx.userId,
        date: sale.date,
      });
    }

    return tx.salesTransaction.findUnique({ where: { id: transactionId }, include: SALE_INCLUDE });
  }, TX_OPTIONS);
}
