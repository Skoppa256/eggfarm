"use server";

import { revalidatePath } from "next/cache";

import { RecordStatus } from "@/generated/prisma/enums";
import type { ActionResult } from "@/lib/action-result";
import { AppError } from "@/lib/errors";
import { vaksinLogSchema, vaksinTypeSchema, vaksinTypeStatusSchema } from "@/lib/schemas/vaksin";
import { requireRole } from "@/lib/server/auth";
import { createVaksinLog } from "@/lib/server/vaksin";
import { createVaksinType, setVaksinTypeStatus } from "@/lib/server/vaksinTypes";

const PATH = "/vaksin";
const OPERATORS = ["ADMIN", "SUPERADMIN"] as const;

export async function createVaksinTypeAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  // Rule 5.5: the vaksin-type master is Superadmin-only (FR-99).
  await requireRole("SUPERADMIN");

  const parsed = vaksinTypeSchema.safeParse({
    name: formData.get("name"),
    sortOrder: formData.get("sortOrder") ?? undefined,
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }
  try {
    await createVaksinType(parsed.data);
    revalidatePath(PATH);
    return { ok: true, message: `Vaksin type "${parsed.data.name}" added.` };
  } catch (err) {
    if (err instanceof AppError) return { ok: false, error: err.message };
    throw err;
  }
}

export async function setVaksinTypeStatusAction(formData: FormData): Promise<void> {
  await requireRole("SUPERADMIN");
  const parsed = vaksinTypeStatusSchema.safeParse({
    id: formData.get("id"),
    status: formData.get("status"),
  });
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Invalid input.");
  await setVaksinTypeStatus(parsed.data.id, parsed.data.status as RecordStatus);
  revalidatePath(PATH);
}

export async function createVaksinLogAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  // Rule 5.5: logging a vaccination is Admin/Superadmin; Owner rejected.
  const user = await requireRole(...OPERATORS);

  const parsed = vaksinLogSchema.safeParse({
    date: formData.get("date"),
    vaksinTypeId: formData.get("vaksinTypeId"),
    farmhouseId: formData.get("farmhouseId"),
    vials: formData.get("vials"),
    vaccinator: formData.get("vaccinator"),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }
  try {
    await createVaksinLog(
      {
        date: new Date(`${parsed.data.date}T00:00:00Z`),
        vaksinTypeId: parsed.data.vaksinTypeId,
        farmhouseId: parsed.data.farmhouseId,
        vials: parsed.data.vials,
        vaccinator: parsed.data.vaccinator,
      },
      { userId: user.id },
    );
    revalidatePath(PATH);
    revalidatePath("/daily");
    return { ok: true, message: "Vaccination logged." };
  } catch (err) {
    if (err instanceof AppError) return { ok: false, error: err.message };
    throw err;
  }
}
