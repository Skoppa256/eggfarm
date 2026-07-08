"use server";

import { revalidatePath } from "next/cache";

import { RecordStatus } from "@/generated/prisma/enums";
import type { ActionResult } from "@/lib/action-result";
import { businessToday } from "@/lib/dates";
import { AppError } from "@/lib/errors";
import {
  changeBatchSchema,
  changeMappingSchema,
  createFarmhouseSchema,
  statusToggleSchema,
} from "@/lib/schemas/config";
import { requireRole } from "@/lib/server/auth";
import {
  changeMaxBatches,
  changeWarehouseMapping,
  createFarmhouse,
  setFarmhouseStatus,
} from "@/lib/server/farmhouses";

const PATH = "/farmhouses";

// Farmhouses are Superadmin-managed operational structure (rule 5.5); Admin and
// Owner are both excluded from every farmhouse write path.

export async function createFarmhouseAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireRole("SUPERADMIN");
  const parsed = createFarmhouseSchema.safeParse({
    name: formData.get("name"),
    code: formData.get("code"),
    warehouseId: formData.get("warehouseId"),
    maxBatchesPerDay: formData.get("maxBatchesPerDay"),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Input tidak valid." };
  }
  try {
    const farmhouse = await createFarmhouse({
      ...parsed.data,
      changedById: user.id,
      today: businessToday(),
    });
    revalidatePath(PATH);
    return { ok: true, message: `Kandang ${farmhouse.code} dibuat.` };
  } catch (err) {
    if (err instanceof AppError) return { ok: false, error: err.message };
    throw err;
  }
}

export async function changeMappingAction(formData: FormData): Promise<void> {
  const user = await requireRole("SUPERADMIN");
  const parsed = changeMappingSchema.safeParse({
    farmhouseId: formData.get("farmhouseId"),
    warehouseId: formData.get("warehouseId"),
  });
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Input tidak valid.");
  }
  // Mapping change is date-effective from today; history is retained.
  await changeWarehouseMapping({
    farmhouseId: parsed.data.farmhouseId,
    warehouseId: parsed.data.warehouseId,
    changedById: user.id,
    effectiveFrom: businessToday(),
  });
  revalidatePath(PATH);
}

export async function changeBatchAction(formData: FormData): Promise<void> {
  const user = await requireRole("SUPERADMIN");
  const parsed = changeBatchSchema.safeParse({
    farmhouseId: formData.get("farmhouseId"),
    maxBatchesPerDay: formData.get("maxBatchesPerDay"),
  });
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Input tidak valid.");
  }
  // Per SRS FR-41 the new batch count takes effect the next day.
  await changeMaxBatches({
    farmhouseId: parsed.data.farmhouseId,
    maxBatchesPerDay: parsed.data.maxBatchesPerDay,
    changedById: user.id,
    today: businessToday(),
  });
  revalidatePath(PATH);
}

export async function setFarmhouseStatusAction(formData: FormData): Promise<void> {
  await requireRole("SUPERADMIN");
  const parsed = statusToggleSchema.safeParse({
    id: formData.get("id"),
    status: formData.get("status"),
  });
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Input tidak valid.");
  }
  await setFarmhouseStatus(
    parsed.data.id,
    parsed.data.status === "ACTIVE" ? RecordStatus.ACTIVE : RecordStatus.INACTIVE,
  );
  revalidatePath(PATH);
}
