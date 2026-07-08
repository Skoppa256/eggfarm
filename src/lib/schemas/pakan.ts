import { z } from "zod";

import { IngredientCategory } from "@/generated/prisma/enums";

// PAKAN validation (SRS §3.11). Ingredient master + delivery here; the mixing recipe
// (dynamic recipe lines) is assembled in its action.

export const ingredientSchema = z.object({
  name: z.string().trim().min(1, "Nama bahan wajib diisi.").max(120),
  category: z.enum(IngredientCategory),
  baseUnit: z.string().trim().max(20).optional(),
  sortOrder: z.coerce.number().int().min(0).default(0),
});

export const ingredientStatusSchema = z.object({
  id: z.string().min(1),
  status: z.enum(["ACTIVE", "INACTIVE"]),
});

export const deliverySchema = z.object({
  ingredientId: z.string().min(1, "Pilih bahan."),
  quantity: z.coerce.number().positive("Jumlah harus lebih dari 0."),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Tanggal tidak valid."),
});

export const ingredientCorrectionSchema = z.object({
  ingredientId: z.string().min(1, "Pilih bahan."),
  newQuantity: z.coerce.number().min(0, "Jumlah koreksi tidak boleh negatif."),
  reason: z.string().trim().min(20, "Koreksi memerlukan alasan minimal 20 karakter."),
});

export const mixingKeySchema = z.object({
  farmhouseId: z.string().min(1, "Pilih Kandang."),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Tanggal tidak valid."),
  projectedIntake: z.coerce.number().positive("Proyeksi intake (g/ekor) harus lebih dari 0."),
});
