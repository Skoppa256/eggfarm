"use server";

import { revalidatePath } from "next/cache";

import { RecordStatus } from "@/generated/prisma/enums";
import type { ActionResult } from "@/lib/action-result";
import { AppError } from "@/lib/errors";
import { createGradeTypeSchema, statusToggleSchema } from "@/lib/schemas/config";
import { requireRole } from "@/lib/server/auth";
import { createGradeType, setGradeTypeStatus } from "@/lib/server/gradeTypes";

const PATH = "/grade-types";

// Grade Types are master data — Superadmin only (rule 5.5).

export async function createGradeTypeAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  await requireRole("SUPERADMIN");
  const parsed = createGradeTypeSchema.safeParse({
    name: formData.get("name"),
    sortOrder: formData.get("sortOrder") ?? 0,
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Input tidak valid." };
  }
  try {
    const gradeType = await createGradeType(parsed.data);
    revalidatePath(PATH);
    return { ok: true, message: `Tipe grade ${gradeType.name} dibuat.` };
  } catch (err) {
    if (err instanceof AppError) return { ok: false, error: err.message };
    throw err;
  }
}

export async function setGradeTypeStatusAction(formData: FormData): Promise<void> {
  await requireRole("SUPERADMIN");
  const parsed = statusToggleSchema.safeParse({
    id: formData.get("id"),
    status: formData.get("status"),
  });
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Input tidak valid.");
  }
  await setGradeTypeStatus(
    parsed.data.id,
    parsed.data.status === "ACTIVE" ? RecordStatus.ACTIVE : RecordStatus.INACTIVE,
  );
  revalidatePath(PATH);
}
