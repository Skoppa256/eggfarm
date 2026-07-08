import { z } from "zod";

import { SizeHealthGrade } from "@/generated/prisma/enums";

// Validation for the Slice 1 warehouse movement actions. Lives in src/lib/schemas
// so it is shared by the client form and the server action (CLAUDE.md §3). Entry
// accepts rak and/or loose pcs and converts to a pcs total on the server (§6).

export const movementEntrySchema = z
  .object({
    warehouseId: z.string().min(1, "Gudang wajib diisi."),
    sizeHealthGrade: z.enum(SizeHealthGrade),
    typeGradeId: z.string().min(1, "Tipe Telur wajib diisi."),
    rak: z.coerce.number().int("Rak harus bilangan bulat.").min(0, "Rak tidak boleh negatif.").default(0),
    pcs: z.coerce.number().int("Pcs harus bilangan bulat.").min(0, "Pcs tidak boleh negatif.").default(0),
  })
  .refine((v) => v.rak + v.pcs > 0, {
    message: "Masukkan jumlah lebih dari nol.",
    path: ["pcs"],
  });

export type MovementEntry = z.infer<typeof movementEntrySchema>;
