import { z } from "zod";

// Flock chick-in (SRS §3.9). Placement rows are read from the dynamic form.
export const createFlockSchema = z.object({
  strain: z.string().trim().min(1, "Strain is required.").max(120),
  chickInDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date."),
  placementAge: z.coerce
    .number()
    .int("Placement age must be a whole number.")
    .min(0, "Cannot be negative."),
});

export const placementSchema = z.object({
  farmhouseId: z.string().min(1, "choose a kandang"),
  populasiAwal: z.coerce.number().int("whole number").min(1, "must be at least 1"),
});

export const endPlacementSchema = z.object({
  placementId: z.string().min(1),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date."),
});

// Superadmin-only Populasi Awal correction (narrow chick-in-typo escape hatch).
export const correctPopulasiAwalSchema = z.object({
  placementId: z.string().min(1),
  populasiAwal: z.coerce.number().int("whole number").min(1, "must be at least 1"),
});
