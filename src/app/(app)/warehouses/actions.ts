"use server";

import { revalidatePath } from "next/cache";

import { RecordStatus } from "@/generated/prisma/enums";
import type { ActionResult } from "@/lib/action-result";
import { AppError } from "@/lib/errors";
import { createWarehouseSchema, statusToggleSchema } from "@/lib/schemas/config";
import { requireRole } from "@/lib/server/auth";
import { createWarehouse, setWarehouseStatus } from "@/lib/server/warehouses";

const PATH = "/warehouses";
const OPERATORS = ["ADMIN", "SUPERADMIN"] as const;

export async function createWarehouseAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  await requireRole(...OPERATORS);
  const parsed = createWarehouseSchema.safeParse({
    name: formData.get("name"),
    code: formData.get("code"),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }
  try {
    const warehouse = await createWarehouse(parsed.data);
    revalidatePath(PATH);
    return { ok: true, message: `Created warehouse ${warehouse.code}.` };
  } catch (err) {
    if (err instanceof AppError) return { ok: false, error: err.message };
    throw err;
  }
}

export async function setWarehouseStatusAction(formData: FormData): Promise<void> {
  await requireRole(...OPERATORS);
  const parsed = statusToggleSchema.safeParse({
    id: formData.get("id"),
    status: formData.get("status"),
  });
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Invalid input.");
  }
  await setWarehouseStatus(
    parsed.data.id,
    parsed.data.status === "ACTIVE" ? RecordStatus.ACTIVE : RecordStatus.INACTIVE,
  );
  revalidatePath(PATH);
}
