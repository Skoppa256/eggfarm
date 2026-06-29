import { z } from "zod";

import { Role } from "@/generated/prisma/enums";

// Validation for Superadmin user management (shared client + server).
export const createUserSchema = z.object({
  name: z.string().min(1, "Name is required.").max(120),
  username: z
    .string()
    .min(3, "Username must be at least 3 characters.")
    .max(40)
    .regex(/^[a-zA-Z0-9._-]+$/, "Use letters, numbers, dot, underscore or hyphen only."),
  password: z.string().min(8, "Password must be at least 8 characters.").max(200),
  role: z.enum(Role),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;

export const setUserStatusSchema = z.object({
  userId: z.string().min(1),
  status: z.enum(["ACTIVE", "INACTIVE"]),
});
