import "server-only";

import { RecordStatus } from "@/generated/prisma/enums";
import { ConflictError, NotFoundError } from "@/lib/errors";
import { prisma } from "@/lib/server/db";

// Vaksin-type master (SRS FR-99) — Superadmin-managed catalog. Soft-delete only: a
// deactivated type is excluded from new logs but retained in history (FR-98-style).

export function listVaksinTypes() {
  return prisma.vaksinType.findMany({
    orderBy: [{ status: "asc" }, { sortOrder: "asc" }, { name: "asc" }],
  });
}

/** Active types only — for the log entry form. */
export function listActiveVaksinTypes() {
  return prisma.vaksinType.findMany({
    where: { status: RecordStatus.ACTIVE },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });
}

export async function createVaksinType(input: { name: string; sortOrder?: number }) {
  const name = input.name.trim();
  if (name.length === 0) throw new ConflictError("Vaksin type name is required.");
  const existing = await prisma.vaksinType.findUnique({ where: { name } });
  if (existing) throw new ConflictError(`Vaksin type "${name}" already exists.`);
  return prisma.vaksinType.create({ data: { name, sortOrder: input.sortOrder ?? 0 } });
}

export async function setVaksinTypeStatus(id: string, status: RecordStatus) {
  const existing = await prisma.vaksinType.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError("Vaksin type not found.");
  return prisma.vaksinType.update({ where: { id }, data: { status } });
}
