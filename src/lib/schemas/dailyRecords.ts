import { z } from "zod";

// Daily farmhouse record (SRS §3.10). The key + the required numeric Admin inputs;
// optional body weight and the free-text notes are handled in the action (blank → null).
export const dailyKeySchema = z.object({
  farmhouseId: z.string().min(1, "Pilih Kandang."),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Tanggal tidak valid."),
});

export const dailyInputSchema = z.object({
  mati: z.coerce.number().int("MATI harus bilangan bulat.").min(0, "MATI tidak boleh negatif."),
  afkir: z.coerce.number().int("AFKIR harus bilangan bulat.").min(0, "AFKIR tidak boleh negatif."),
  sisaDigunakan: z.coerce.number().min(0, "SISA DIGUNAKAN tidak boleh negatif."),
  sisaDibuang: z.coerce.number().min(0, "SISA DIBUANG tidak boleh negatif."),
  beratTelur: z.coerce.number().min(0, "BERAT TELUR tidak boleh negatif."),
});
