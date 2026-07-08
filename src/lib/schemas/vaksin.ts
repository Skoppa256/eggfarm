import { z } from "zod";

// VAKSIN validation (SRS §3.13). Vaksin-type master + a vaccination log entry.

export const vaksinTypeSchema = z.object({
  name: z.string().trim().min(1, "Nama tipe vaksin wajib diisi.").max(120),
  sortOrder: z.coerce.number().int().min(0).default(0),
});

export const vaksinTypeStatusSchema = z.object({
  id: z.string().min(1),
  status: z.enum(["ACTIVE", "INACTIVE"]),
});

export const vaksinLogSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Tanggal tidak valid."),
  vaksinTypeId: z.string().min(1, "Pilih tipe vaksin."),
  farmhouseId: z.string().min(1, "Pilih Kandang."),
  vials: z.coerce.number().int("Vial harus bilangan bulat.").min(1, "Minimal 1 vial."),
  vaccinator: z.string().trim().min(1, "Vaksinator wajib diisi.").max(120),
});
