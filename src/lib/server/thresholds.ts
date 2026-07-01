import "server-only";

import type { SizeHealthGrade } from "@/generated/prisma/enums";
import { ConflictError } from "@/lib/errors";
import { prisma } from "@/lib/server/db";

// Low-stock thresholds (SRS FR-27). Config in a SEPARATE table from WarehouseStock,
// so setting a threshold never writes the balance cache (rule 5.4 stays intact).
// Admin-managed. A SKU is "low" when currentQuantity < minQuantity.

export function listThresholds(warehouseId: string) {
  return prisma.lowStockThreshold.findMany({
    where: { warehouseId },
    include: { gradeType: true },
    orderBy: [{ sizeHealthGrade: "asc" }, { gradeType: { sortOrder: "asc" } }],
  });
}

/**
 * Set (upsert) the minimum for a SKU in a warehouse. `minQuantity = 0` means "no
 * threshold" and removes any existing one.
 */
export async function setThreshold(input: {
  warehouseId: string;
  sizeHealthGrade: SizeHealthGrade;
  typeGradeId: string;
  minQuantity: number;
}) {
  if (!Number.isInteger(input.minQuantity) || input.minQuantity < 0) {
    throw new ConflictError("Minimum must be a non-negative whole number (pcs).");
  }
  const identity = {
    warehouseId: input.warehouseId,
    sizeHealthGrade: input.sizeHealthGrade,
    typeGradeId: input.typeGradeId,
  };
  if (input.minQuantity === 0) {
    await prisma.lowStockThreshold.deleteMany({ where: identity });
    return null;
  }
  return prisma.lowStockThreshold.upsert({
    where: { warehouseId_sizeHealthGrade_typeGradeId: identity },
    create: { ...identity, minQuantity: input.minQuantity },
    update: { minQuantity: input.minQuantity },
  });
}

/** SKUs in a warehouse whose current balance is below their configured minimum. */
export async function getLowStockSkus(warehouseId: string) {
  const [thresholds, stock] = await Promise.all([
    prisma.lowStockThreshold.findMany({ where: { warehouseId }, include: { gradeType: true } }),
    prisma.warehouseStock.findMany({ where: { warehouseId } }),
  ]);
  const key = (grade: SizeHealthGrade, typeId: string) => `${grade}|${typeId}`;
  const currentByKey = new Map(stock.map((s) => [key(s.sizeHealthGrade, s.typeGradeId), s.currentQuantity]));
  return thresholds
    .map((t) => ({
      threshold: t,
      current: currentByKey.get(key(t.sizeHealthGrade, t.typeGradeId)) ?? 0,
    }))
    .filter((row) => row.current < row.threshold.minQuantity);
}
