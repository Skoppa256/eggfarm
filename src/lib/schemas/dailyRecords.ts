import { z } from "zod";

// Daily farmhouse record (SRS §3.10). The key + the required numeric Admin inputs;
// optional body weight and the free-text notes are handled in the action (blank → null).
export const dailyKeySchema = z.object({
  farmhouseId: z.string().min(1, "Choose a kandang."),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date."),
});

export const dailyInputSchema = z.object({
  mati: z.coerce.number().int("MATI must be a whole number.").min(0, "MATI cannot be negative."),
  afkir: z.coerce.number().int("AFKIR must be a whole number.").min(0, "AFKIR cannot be negative."),
  sisaDigunakan: z.coerce.number().min(0, "SISA DIGUNAKAN cannot be negative."),
  sisaDibuang: z.coerce.number().min(0, "SISA DIBUANG cannot be negative."),
  beratTelur: z.coerce.number().min(0, "BERAT TELUR cannot be negative."),
});
