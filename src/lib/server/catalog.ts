import "server-only";

import { prisma } from "@/lib/server/db";
import { RecordStatus } from "@/generated/prisma/enums";

// Read-only master-data lookups used by the UI. The full management CRUD for
// warehouses and grade types lands in Slice 3; these are just the queries the
// Slice 1 warehouse page needs (CLAUDE.md §7 "Reads = server components calling
// src/lib/server/* query functions").

export function listWarehouses() {
  return prisma.warehouse.findMany({
    where: { status: RecordStatus.ACTIVE },
    orderBy: { code: "asc" },
  });
}

export function getDefaultWarehouse() {
  return prisma.warehouse.findFirst({
    where: { status: RecordStatus.ACTIVE },
    orderBy: { code: "asc" },
  });
}

export function listGradeTypes() {
  return prisma.gradeType.findMany({
    where: { status: RecordStatus.ACTIVE },
    orderBy: { sortOrder: "asc" },
  });
}

export function listActiveFarmhouses() {
  return prisma.farmhouse.findMany({
    where: { status: RecordStatus.ACTIVE },
    orderBy: { code: "asc" },
  });
}
