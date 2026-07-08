import { z } from "zod";

import { Role } from "@/generated/prisma/enums";

// Validation for Superadmin user management (shared client + server).
export const createUserSchema = z.object({
  name: z.string().min(1, "Nama wajib diisi.").max(120),
  username: z
    .string()
    .min(3, "Username minimal 3 karakter.")
    .max(40)
    .regex(/^[a-zA-Z0-9._-]+$/, "Gunakan huruf, angka, titik, garis bawah, atau tanda hubung saja."),
  password: z.string().min(8, "Password minimal 8 karakter.").max(200),
  role: z.enum(Role),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;

export const setUserStatusSchema = z.object({
  userId: z.string().min(1),
  status: z.enum(["ACTIVE", "INACTIVE"]),
});
