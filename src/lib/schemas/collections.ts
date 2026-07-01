import { z } from "zod";

// Validation for collection input (SRS §3.2). Counts are Type-agnostic pcs; Angkat
// Rak lifts (rak per Type) are read dynamically from the form in the action.

const count = z.coerce
  .number()
  .int("Must be a whole number.")
  .min(0, "Cannot be negative.")
  .default(0);

export const collectionCountsSchema = z.object({
  goodEggs: count,
  telurRetak: count,
  telurLunak: count,
  telurKosong: count,
  remarks: z.string().max(500).optional(),
});

export const collectionKeySchema = z.object({
  farmhouseId: z.string().min(1, "Choose a kandang."),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date."),
  batchNumber: z.coerce.number().int().min(1),
});

export type CollectionCountsInput = z.infer<typeof collectionCountsSchema>;
