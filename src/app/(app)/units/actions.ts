"use server";

import { revalidatePath } from "next/cache";

import { RecordStatus } from "@/generated/prisma/enums";
import type { ActionResult } from "@/lib/action-result";
import { AppError } from "@/lib/errors";
import { createUnitSchema, statusToggleSchema } from "@/lib/schemas/config";
import { requireRole } from "@/lib/server/auth";
import {
  createMeasurementUnit,
  setMeasurementUnitStatus,
} from "@/lib/server/measurementUnits";

const PATH = "/units";

// Measurement units are master data — Superadmin only (rule 5.5).

export async function createUnitAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  await requireRole("SUPERADMIN");
  const parsed = createUnitSchema.safeParse({
    name: formData.get("name"),
    pcsEquivalent: formData.get("pcsEquivalent"),
    sortOrder: formData.get("sortOrder") ?? 0,
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }
  try {
    const unit = await createMeasurementUnit(parsed.data);
    revalidatePath(PATH);
    return { ok: true, message: `Created unit ${unit.name} (${unit.pcsEquivalent} pcs).` };
  } catch (err) {
    if (err instanceof AppError) return { ok: false, error: err.message };
    throw err;
  }
}

export async function setUnitStatusAction(formData: FormData): Promise<void> {
  await requireRole("SUPERADMIN");
  const parsed = statusToggleSchema.safeParse({
    id: formData.get("id"),
    status: formData.get("status"),
  });
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Invalid input.");
  }
  await setMeasurementUnitStatus(
    parsed.data.id,
    parsed.data.status === "ACTIVE" ? RecordStatus.ACTIVE : RecordStatus.INACTIVE,
  );
  revalidatePath(PATH);
}
