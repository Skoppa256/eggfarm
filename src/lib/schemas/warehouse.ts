import { z } from "zod";

import { SizeHealthGrade } from "@/generated/prisma/enums";

// Stock Correction (SRS FR-26). `value` is a whole number; the per-mode sign rules
// (absolute ≥ 0; delta any) are enforced in ledger.recordCorrection. Reason ≥ 20.
export const correctionSchema = z.object({
  warehouseId: z.string().min(1, "Pilih gudang."),
  sizeHealthGrade: z.enum(SizeHealthGrade),
  typeGradeId: z.string().min(1, "Pilih Tipe Telur."),
  mode: z.enum(["absolute", "delta"]),
  value: z.coerce.number().int("Harus bilangan bulat (pcs)."),
  reason: z.string().trim().min(20, "Alasan minimal 20 karakter."),
  reference: z.string().max(200).optional(),
});

// Low-stock threshold (SRS FR-27). minQuantity 0 removes the threshold.
export const thresholdSchema = z.object({
  warehouseId: z.string().min(1),
  sizeHealthGrade: z.enum(SizeHealthGrade),
  typeGradeId: z.string().min(1, "Pilih Tipe Telur."),
  minQuantity: z.coerce.number().int("Harus bilangan bulat.").min(0, "Tidak boleh negatif."),
});
