import { z } from "zod";

import { SizeHealthGrade } from "@/generated/prisma/enums";

// Stock Correction (SRS FR-26). `value` is a whole number; the per-mode sign rules
// (absolute ≥ 0; delta any) are enforced in ledger.recordCorrection. Reason ≥ 20.
export const correctionSchema = z.object({
  warehouseId: z.string().min(1, "Choose a warehouse."),
  sizeHealthGrade: z.enum(SizeHealthGrade),
  typeGradeId: z.string().min(1, "Choose an egg type."),
  mode: z.enum(["absolute", "delta"]),
  value: z.coerce.number().int("Must be a whole number (pcs)."),
  reason: z.string().trim().min(20, "Reason must be at least 20 characters."),
  reference: z.string().max(200).optional(),
});

// Low-stock threshold (SRS FR-27). minQuantity 0 removes the threshold.
export const thresholdSchema = z.object({
  warehouseId: z.string().min(1),
  sizeHealthGrade: z.enum(SizeHealthGrade),
  typeGradeId: z.string().min(1, "Choose an egg type."),
  minQuantity: z.coerce.number().int("Must be a whole number.").min(0, "Cannot be negative."),
});
