import type { Role } from "@/generated/prisma/enums";

/**
 * Role-specific landing screen. Admins do three recurring per-kandang tasks, so
 * their home is the "Tugas Hari Ini" to-do board; Owner/Superadmin land on the
 * analytics dashboard (SRS §4.1: the Owner home is the Dashboard). Navigation only.
 */
export function homePathForRole(role: Role): string {
  return role === "ADMIN" ? "/tugas" : "/dashboard";
}
