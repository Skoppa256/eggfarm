"use server";

import { revalidatePath } from "next/cache";

import { RecordStatus } from "@/generated/prisma/enums";
import { AppError } from "@/lib/errors";
import { createUserSchema, setUserStatusSchema } from "@/lib/schemas/users";
import { requireRole } from "@/lib/server/auth";
import { createUser, setUserStatus } from "@/lib/server/users";

export type UserActionResult =
  | { ok: true; message: string }
  | { ok: false; error: string };

export async function createUserAction(
  _prev: UserActionResult | null,
  formData: FormData,
): Promise<UserActionResult> {
  // Rule 5.5: only Superadmin manages users.
  await requireRole("SUPERADMIN");

  const parsed = createUserSchema.safeParse({
    name: formData.get("name"),
    username: formData.get("username"),
    password: formData.get("password"),
    role: formData.get("role"),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  try {
    const user = await createUser(parsed.data);
    revalidatePath("/users");
    return { ok: true, message: `Created ${user.username} (${user.role}).` };
  } catch (err) {
    if (err instanceof AppError) {
      return { ok: false, error: err.message };
    }
    throw err;
  }
}

export async function setUserStatusAction(formData: FormData): Promise<void> {
  await requireRole("SUPERADMIN");

  const parsed = setUserStatusSchema.safeParse({
    userId: formData.get("userId"),
    status: formData.get("status"),
  });
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Invalid input.");
  }

  await setUserStatus(
    parsed.data.userId,
    parsed.data.status === "ACTIVE" ? RecordStatus.ACTIVE : RecordStatus.INACTIVE,
  );
  revalidatePath("/users");
}
