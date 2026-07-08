import "server-only";

import { RecordStatus } from "@/generated/prisma/enums";
import { ConflictError, NotFoundError } from "@/lib/errors";
import { prisma } from "@/lib/server/db";

// Measurement unit catalog — Superadmin-managed master data.

export function listMeasurementUnits() {
  return prisma.measurementUnit.findMany({
    orderBy: [{ status: "asc" }, { sortOrder: "asc" }, { name: "asc" }],
  });
}

export async function createMeasurementUnit(input: {
  name: string;
  pcsEquivalent: number;
  sortOrder?: number;
}) {
  const existing = await prisma.measurementUnit.findUnique({ where: { name: input.name } });
  if (existing) {
    throw new ConflictError(`Satuan "${input.name}" sudah ada.`);
  }
  return prisma.measurementUnit.create({
    data: {
      name: input.name,
      pcsEquivalent: input.pcsEquivalent,
      sortOrder: input.sortOrder ?? 0,
    },
  });
}

/** Soft activate/deactivate (never hard-delete; CLAUDE.md §6). */
export async function setMeasurementUnitStatus(id: string, status: RecordStatus) {
  const existing = await prisma.measurementUnit.findUnique({ where: { id } });
  if (!existing) {
    throw new NotFoundError("Satuan tidak ditemukan.");
  }
  return prisma.measurementUnit.update({ where: { id }, data: { status } });
}
