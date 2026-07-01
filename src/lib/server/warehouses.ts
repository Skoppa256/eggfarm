import "server-only";

import { RecordStatus } from "@/generated/prisma/enums";
import { ConflictError, NotFoundError } from "@/lib/errors";
import { prisma } from "@/lib/server/db";

// Warehouse management — Admin-managed operational structure. (Read-only lookups
// for forms live in catalog.ts; this owns the full list + mutations.)

export function listWarehouses() {
  return prisma.warehouse.findMany({ orderBy: [{ status: "asc" }, { code: "asc" }] });
}

export async function createWarehouse(input: { name: string; code: string }) {
  const existing = await prisma.warehouse.findUnique({ where: { code: input.code } });
  if (existing) {
    throw new ConflictError(`Warehouse code "${input.code}" is already taken.`);
  }
  return prisma.warehouse.create({ data: { name: input.name, code: input.code } });
}

export async function renameWarehouse(id: string, name: string) {
  const existing = await prisma.warehouse.findUnique({ where: { id } });
  if (!existing) {
    throw new NotFoundError("Warehouse not found.");
  }
  return prisma.warehouse.update({ where: { id }, data: { name } });
}

/** Soft activate/deactivate (never hard-delete; CLAUDE.md §6). */
export async function setWarehouseStatus(id: string, status: RecordStatus) {
  const existing = await prisma.warehouse.findUnique({ where: { id } });
  if (!existing) {
    throw new NotFoundError("Warehouse not found.");
  }
  return prisma.warehouse.update({ where: { id }, data: { status } });
}
