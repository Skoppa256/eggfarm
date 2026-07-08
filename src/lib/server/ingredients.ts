import "server-only";

import { IngredientCategory, RecordStatus } from "@/generated/prisma/enums";
import { ConflictError, NotFoundError } from "@/lib/errors";
import { prisma } from "@/lib/server/db";

// Feed-ingredient master (SRS FR-80) — Superadmin-managed catalog. Deliveries and mixing
// draw-downs move stock via ingredientLedger.ts only (rule 5.4 mirror); this file just
// manages the master rows and the read queries the UI needs.

export interface IngredientInput {
  name: string;
  category: IngredientCategory;
  baseUnit?: string;
  sortOrder?: number;
}

/** All ingredients (incl. inactive) for the master admin page. */
export function listIngredients() {
  return prisma.ingredient.findMany({
    orderBy: [{ status: "asc" }, { category: "asc" }, { sortOrder: "asc" }, { name: "asc" }],
    include: { stock: true },
  });
}

/** Active ingredients only — for delivery + mixing entry forms. */
export function listActiveIngredients() {
  return prisma.ingredient.findMany({
    where: { status: RecordStatus.ACTIVE },
    orderBy: [{ category: "asc" }, { sortOrder: "asc" }, { name: "asc" }],
  });
}

export async function createIngredient(input: IngredientInput) {
  const name = input.name.trim();
  if (name.length === 0) {
    throw new ConflictError("Nama bahan wajib diisi.");
  }
  const existing = await prisma.ingredient.findUnique({ where: { name } });
  if (existing) {
    throw new ConflictError(`Bahan "${name}" sudah ada.`);
  }
  return prisma.ingredient.create({
    data: {
      name,
      category: input.category,
      baseUnit: input.baseUnit?.trim() || "kg",
      sortOrder: input.sortOrder ?? 0,
    },
  });
}

/** Soft activate/deactivate (never hard-delete; CLAUDE.md §6). */
export async function setIngredientStatus(id: string, status: RecordStatus) {
  const existing = await prisma.ingredient.findUnique({ where: { id } });
  if (!existing) {
    throw new NotFoundError("Bahan tidak ditemukan.");
  }
  return prisma.ingredient.update({ where: { id }, data: { status } });
}
