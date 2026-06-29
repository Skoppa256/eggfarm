"use server";

import { revalidatePath } from "next/cache";

import { SourceType } from "@/generated/prisma/enums";
import { AppError } from "@/lib/errors";
import { movementEntrySchema } from "@/lib/schemas/ledger";
import { requireRole } from "@/lib/server/auth";
import { recordIn, recordOut } from "@/lib/server/ledger";
import { rakToPcs } from "@/lib/units";

export type ActionResult =
  | { ok: true; message: string }
  | { ok: false; error: string };

async function handleMovement(
  direction: "IN" | "OUT",
  formData: FormData,
): Promise<ActionResult> {
  // Rule 5.5: the role check is the FIRST line. OWNER is read-only, so it is not
  // among the allowed roles on this write path.
  const user = await requireRole("SUPERADMIN", "ADMIN");

  const parsed = movementEntrySchema.safeParse({
    warehouseId: formData.get("warehouseId"),
    sizeHealthGrade: formData.get("sizeHealthGrade"),
    typeGradeId: formData.get("typeGradeId"),
    rak: formData.get("rak") ?? 0,
    pcs: formData.get("pcs") ?? 0,
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const { warehouseId, sizeHealthGrade, typeGradeId, rak, pcs } = parsed.data;
  const quantity = rakToPcs(rak, pcs);
  const unitUsed = rak > 0 ? "RAK" : "PCS";

  const record = direction === "IN" ? recordIn : recordOut;
  try {
    await record({
      warehouseId,
      sizeHealthGrade,
      typeGradeId,
      quantity,
      sourceType: SourceType.ADJUSTMENT,
      unitUsed,
      enteredById: user.id,
    });
  } catch (err) {
    // Surface known domain errors (e.g. oversell) to the form; rethrow the rest.
    if (err instanceof AppError) {
      return { ok: false, error: err.message };
    }
    throw err;
  }

  revalidatePath("/warehouse");
  const verb = direction === "IN" ? "added to" : "removed from";
  return { ok: true, message: `${quantity} pcs ${verb} stock.` };
}

/**
 * Single entry point for the warehouse form's two buttons. The clicked submit
 * button contributes `direction=IN|OUT` to the form data.
 */
export async function recordMovementAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const direction = formData.get("direction");
  if (direction !== "IN" && direction !== "OUT") {
    return { ok: false, error: "Choose Stock In or Stock Out." };
  }
  return handleMovement(direction, formData);
}
