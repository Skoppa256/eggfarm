import { z } from "zod";

// VAKSIN validation (SRS §3.13). Vaksin-type master + a vaccination log entry.

export const vaksinTypeSchema = z.object({
  name: z.string().trim().min(1, "Vaksin type name is required.").max(120),
  sortOrder: z.coerce.number().int().min(0).default(0),
});

export const vaksinTypeStatusSchema = z.object({
  id: z.string().min(1),
  status: z.enum(["ACTIVE", "INACTIVE"]),
});

export const vaksinLogSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date."),
  vaksinTypeId: z.string().min(1, "Choose a vaksin type."),
  farmhouseId: z.string().min(1, "Choose a kandang."),
  vials: z.coerce.number().int("Vials must be a whole number.").min(1, "At least 1 vial."),
  vaccinator: z.string().trim().min(1, "A vaccinator is required.").max(120),
});
