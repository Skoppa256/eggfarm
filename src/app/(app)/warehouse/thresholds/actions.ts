"use server";

import { revalidatePath } from "next/cache";

import type { ActionResult } from "@/lib/action-result";
import { AppError } from "@/lib/errors";
import { thresholdSchema } from "@/lib/schemas/warehouse";
import { requireRole } from "@/lib/server/auth";
import { setThreshold } from "@/lib/server/thresholds";

const OPERATORS = ["ADMIN", "SUPERADMIN"] as const;

export async function setThresholdAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  await requireRole(...OPERATORS);

  const parsed = thresholdSchema.safeParse({
    warehouseId: formData.get("warehouseId"),
    sizeHealthGrade: formData.get("sizeHealthGrade"),
    typeGradeId: formData.get("typeGradeId"),
    minQuantity: formData.get("minQuantity"),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Input tidak valid." };
  }

  try {
    await setThreshold(parsed.data);
    revalidatePath("/warehouse/thresholds");
    revalidatePath("/warehouse");
    return {
      ok: true,
      message: parsed.data.minQuantity === 0 ? "Ambang batas dihapus." : "Ambang batas disimpan.",
    };
  } catch (err) {
    if (err instanceof AppError) return { ok: false, error: err.message };
    throw err;
  }
}
