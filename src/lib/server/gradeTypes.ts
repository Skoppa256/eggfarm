import "server-only";

import { RecordStatus } from "@/generated/prisma/enums";
import { ConflictError, NotFoundError } from "@/lib/errors";
import { prisma } from "@/lib/server/db";

// Grade Type catalog (Normal, Omega, ...) — Superadmin-managed master data. The
// model already exists (Slice 1); this adds management. (catalog.ts.listGradeTypes
// returns only ACTIVE rows for entry forms; this returns all for the admin page.)

export function listGradeTypes() {
  return prisma.gradeType.findMany({
    orderBy: [{ status: "asc" }, { sortOrder: "asc" }, { name: "asc" }],
  });
}

export async function createGradeType(input: { name: string; sortOrder?: number }) {
  const existing = await prisma.gradeType.findUnique({ where: { name: input.name } });
  if (existing) {
    throw new ConflictError(`Grade type "${input.name}" already exists.`);
  }
  return prisma.gradeType.create({
    data: { name: input.name, sortOrder: input.sortOrder ?? 0 },
  });
}

/** Soft activate/deactivate (never hard-delete; CLAUDE.md §6). */
export async function setGradeTypeStatus(id: string, status: RecordStatus) {
  const existing = await prisma.gradeType.findUnique({ where: { id } });
  if (!existing) {
    throw new NotFoundError("Grade type not found.");
  }
  return prisma.gradeType.update({ where: { id }, data: { status } });
}
