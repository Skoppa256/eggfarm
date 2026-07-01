"use server";

import { revalidatePath } from "next/cache";

import { RecordStatus } from "@/generated/prisma/enums";
import type { ActionResult } from "@/lib/action-result";
import { todayDateOnly } from "@/lib/dates";
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

// Farmhouses are Admin-managed operational structure (Superadmin can do anything
// Admin can). OWNER is read-only and excluded (rule 5.5).
const OPERATORS = ["ADMIN", "SUPERADMIN"] as const;

export async function createFarmhouseAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireRole(...OPERATORS);
  const parsed = createFarmhouseSchema.safeParse({
    name: formData.get("name"),
    code: formData.get("code"),
    warehouseId: formData.get("warehouseId"),
    maxBatchesPerDay: formData.get("maxBatchesPerDay"),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }
  try {
    const farmhouse = await createFarmhouse({
      ...parsed.data,
      changedById: user.id,
      today: todayDateOnly(),
    });
    revalidatePath(PATH);
    return { ok: true, message: `Created farmhouse ${farmhouse.code}.` };
  } catch (err) {
    if (err instanceof AppError) return { ok: false, error: err.message };
    throw err;
  }
}

export async function changeMappingAction(formData: FormData): Promise<void> {
  const user = await requireRole(...OPERATORS);
  const parsed = changeMappingSchema.safeParse({
    farmhouseId: formData.get("farmhouseId"),
    warehouseId: formData.get("warehouseId"),
  });
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Invalid input.");
  }
  // Mapping change is date-effective from today; history is retained.
  await changeWarehouseMapping({
    farmhouseId: parsed.data.farmhouseId,
    warehouseId: parsed.data.warehouseId,
    changedById: user.id,
    effectiveFrom: todayDateOnly(),
  });
  revalidatePath(PATH);
}

export async function changeBatchAction(formData: FormData): Promise<void> {
  const user = await requireRole(...OPERATORS);
  const parsed = changeBatchSchema.safeParse({
    farmhouseId: formData.get("farmhouseId"),
    maxBatchesPerDay: formData.get("maxBatchesPerDay"),
  });
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Invalid input.");
  }
  // Per SRS FR-41 the new batch count takes effect the next day.
  await changeMaxBatches({
    farmhouseId: parsed.data.farmhouseId,
    maxBatchesPerDay: parsed.data.maxBatchesPerDay,
    changedById: user.id,
    today: todayDateOnly(),
  });
  revalidatePath(PATH);
}

export async function setFarmhouseStatusAction(formData: FormData): Promise<void> {
  await requireRole(...OPERATORS);
  const parsed = statusToggleSchema.safeParse({
    id: formData.get("id"),
    status: formData.get("status"),
  });
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Invalid input.");
  }
  await setFarmhouseStatus(
    parsed.data.id,
    parsed.data.status === "ACTIVE" ? RecordStatus.ACTIVE : RecordStatus.INACTIVE,
  );
  revalidatePath(PATH);
}
