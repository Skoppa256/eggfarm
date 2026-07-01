"use server";

import { revalidatePath } from "next/cache";

import type { ActionResult } from "@/lib/action-result";
import { AppError } from "@/lib/errors";
import { correctionSchema } from "@/lib/schemas/warehouse";
import { requireRole } from "@/lib/server/auth";
import { recordCorrection } from "@/lib/server/ledger";

const OPERATORS = ["ADMIN", "SUPERADMIN"] as const;

export async function correctionAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  // Rule 5.5: Admin (+ Superadmin) only; Owner rejected.
  const user = await requireRole(...OPERATORS);

  const parsed = correctionSchema.safeParse({
    warehouseId: formData.get("warehouseId"),
    sizeHealthGrade: formData.get("sizeHealthGrade"),
    typeGradeId: formData.get("typeGradeId"),
    mode: formData.get("mode"),
    value: formData.get("value"),
    reason: formData.get("reason"),
    reference: formData.get("reference") ?? undefined,
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }
  const { warehouseId, sizeHealthGrade, typeGradeId, mode, value, reason, reference } = parsed.data;

  try {
    const movement = await recordCorrection({
      warehouseId,
      sizeHealthGrade,
      typeGradeId,
      ...(mode === "absolute" ? { newQuantity: value } : { delta: value }),
      reason,
      sourceReferenceId: reference && reference.length > 0 ? reference : null,
      enteredById: user.id,
    });
    revalidatePath("/warehouse/correction");
    revalidatePath("/warehouse");
    revalidatePath("/warehouse/audit");
    return {
      ok: true,
      message: `Corrected to ${movement.postQuantity} pcs (was ${movement.preQuantity}).`,
    };
  } catch (err) {
    if (err instanceof AppError) return { ok: false, error: err.message };
    throw err;
  }
}
