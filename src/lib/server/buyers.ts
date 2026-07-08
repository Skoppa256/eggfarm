import "server-only";

import { RecordStatus } from "@/generated/prisma/enums";
import { NotFoundError } from "@/lib/errors";
import { prisma } from "@/lib/server/db";

// Buyer management (SRS §3.6) — Admin-managed operational data. Soft-delete via
// status: a deactivated buyer is excluded from new sales but kept in history.

export function listBuyers() {
  return prisma.buyer.findMany({ orderBy: [{ status: "asc" }, { name: "asc" }] });
}

export function listActiveBuyers() {
  return prisma.buyer.findMany({
    where: { status: RecordStatus.ACTIVE },
    orderBy: { name: "asc" },
  });
}

export function createBuyer(input: { name: string }) {
  return prisma.buyer.create({ data: { name: input.name } });
}

export async function renameBuyer(id: string, name: string) {
  const existing = await prisma.buyer.findUnique({ where: { id } });
  if (!existing) {
    throw new NotFoundError("Pembeli tidak ditemukan.");
  }
  return prisma.buyer.update({ where: { id }, data: { name } });
}

/** Soft activate/deactivate (never hard-delete; CLAUDE.md §6). */
export async function setBuyerStatus(id: string, status: RecordStatus) {
  const existing = await prisma.buyer.findUnique({ where: { id } });
  if (!existing) {
    throw new NotFoundError("Pembeli tidak ditemukan.");
  }
  return prisma.buyer.update({ where: { id }, data: { status } });
}
