import { z } from "zod";

import { OvkCategory } from "@/generated/prisma/enums";

// OVK validation (SRS §3.12). The item's optional unit conversions are read from dynamic
// form rows in the create action; everything else is a fixed shape here.

export const ovkItemSchema = z.object({
  name: z.string().trim().min(1, "Nama item wajib diisi.").max(120),
  category: z.enum(OvkCategory),
  baseUnit: z.string().trim().min(1, "Satuan dasar wajib diisi.").max(30),
  sortOrder: z.coerce.number().int().min(0).default(0),
});

export const ovkStatusSchema = z.object({
  id: z.string().min(1),
  status: z.enum(["ACTIVE", "INACTIVE"]),
});

export const ovkDeliverySchema = z.object({
  ovkItemId: z.string().min(1, "Pilih item."),
  quantity: z.coerce.number().positive("Jumlah harus lebih dari 0."),
  unitName: z.string().min(1, "Pilih satuan."),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Tanggal tidak valid."),
});

export const ovkTransferSchema = z.object({
  ovkItemId: z.string().min(1, "Pilih item."),
  quantity: z.coerce.number().positive("Jumlah harus lebih dari 0."),
  unitName: z.string().min(1, "Pilih satuan."),
  farmhouseId: z.string().min(1, "Pilih Kandang."),
  note: z.string().trim().max(300).optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Tanggal tidak valid."),
});

export const ovkCorrectionSchema = z.object({
  ovkItemId: z.string().min(1, "Pilih item."),
  newQuantity: z.coerce.number().min(0, "Jumlah koreksi tidak boleh negatif."),
  reason: z.string().trim().min(20, "Koreksi memerlukan alasan minimal 20 karakter."),
});
