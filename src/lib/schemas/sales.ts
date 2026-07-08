import { z } from "zod";

import { SizeHealthGrade } from "@/generated/prisma/enums";

// Buyers (SRS §3.6)
export const createBuyerSchema = z.object({
  name: z.string().trim().min(1, "Nama wajib diisi.").max(120),
});
export const renameBuyerSchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(1, "Nama wajib diisi.").max(120),
});
export const buyerStatusSchema = z.object({
  id: z.string().min(1),
  status: z.enum(["ACTIVE", "INACTIVE"]),
});

// Sales (SRS §3.5). The sale header; line items are read from the dynamic form rows.
export const saleHeaderSchema = z.object({
  warehouseId: z.string().min(1, "Pilih gudang."),
  buyerId: z.string().min(1, "Pilih pembeli."),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Tanggal tidak valid."),
  notes: z.string().max(500).optional(),
});

export const saleLineSchema = z.object({
  sizeHealthGrade: z.enum(SizeHealthGrade),
  typeGradeId: z.string().min(1, "tipe wajib diisi"),
  quantity: z.coerce.number().int("bilangan bulat").min(1, "minimal 1"),
  unit: z.enum(["RAK", "PCS"]),
});

export const voidSaleSchema = z.object({
  transactionId: z.string().min(1),
  reason: z.string().trim().min(10, "Alasan (minimal 10 karakter) wajib diisi."),
});
