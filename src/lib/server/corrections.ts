import "server-only";

import { MovementType } from "@/generated/prisma/enums";
import { requireRole } from "@/lib/server/auth";
import { prisma } from "@/lib/server/db";

// Correction audit (SRS §7 / FR-26). Corrections are just CORRECTION-type StockMovement
// rows (written by ledger.ts, rule 5.4); this only READS them. The audit list is
// Superadmin-only.

export function listCorrections(warehouseId?: string) {
  return prisma.stockMovement.findMany({
    where: { movementType: MovementType.CORRECTION, ...(warehouseId ? { warehouseId } : {}) },
    include: {
      gradeType: true,
      warehouse: true,
      enteredBy: { select: { name: true, username: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}

/** Superadmin-only correction audit. Throws ForbiddenError for anyone else. */
export async function requireCorrectionAudit(warehouseId?: string) {
  await requireRole("SUPERADMIN");
  return listCorrections(warehouseId);
}
