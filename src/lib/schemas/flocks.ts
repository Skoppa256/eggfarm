import { z } from "zod";

// Flock chick-in (SRS §3.9). Placement rows are read from the dynamic form.
export const createFlockSchema = z.object({
  strain: z.string().trim().min(1, "Strain wajib diisi.").max(120),
  chickInDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Tanggal tidak valid."),
  placementAge: z.coerce
    .number()
    .int("Umur penempatan harus bilangan bulat.")
    .min(0, "Tidak boleh negatif."),
});

export const placementSchema = z.object({
  farmhouseId: z.string().min(1, "pilih Kandang"),
  populasiAwal: z.coerce.number().int("bilangan bulat").min(1, "minimal 1"),
});

export const endPlacementSchema = z.object({
  placementId: z.string().min(1),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Tanggal tidak valid."),
});

// Superadmin-only Populasi Awal correction (narrow chick-in-typo escape hatch).
export const correctPopulasiAwalSchema = z.object({
  placementId: z.string().min(1),
  populasiAwal: z.coerce.number().int("bilangan bulat").min(1, "minimal 1"),
});
