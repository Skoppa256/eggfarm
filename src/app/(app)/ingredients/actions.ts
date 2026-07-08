"use server";

import { revalidatePath } from "next/cache";

import { RecordStatus } from "@/generated/prisma/enums";
import type { ActionResult } from "@/lib/action-result";
import { AppError } from "@/lib/errors";
import {
  deliverySchema,
  ingredientCorrectionSchema,
  ingredientSchema,
  ingredientStatusSchema,
} from "@/lib/schemas/pakan";
import { requireRole } from "@/lib/server/auth";
import { createIngredient, setIngredientStatus } from "@/lib/server/ingredients";
import { recordDelivery, recordIngredientCorrection } from "@/lib/server/ingredientLedger";

const PATH = "/ingredients";
const OPERATORS = ["ADMIN", "SUPERADMIN"] as const;

export async function createIngredientAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  // Rule 5.5: the ingredient master is Superadmin-only (FR-80).
  await requireRole("SUPERADMIN");

  const parsed = ingredientSchema.safeParse({
    name: formData.get("name"),
    category: formData.get("category"),
    baseUnit: formData.get("baseUnit") ?? undefined,
    sortOrder: formData.get("sortOrder") ?? undefined,
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Input tidak valid." };
  }
  try {
    await createIngredient(parsed.data);
    revalidatePath(PATH);
    return { ok: true, message: `Bahan "${parsed.data.name}" ditambahkan.` };
  } catch (err) {
    if (err instanceof AppError) return { ok: false, error: err.message };
    throw err;
  }
}

export async function setIngredientStatusAction(formData: FormData): Promise<void> {
  await requireRole("SUPERADMIN");

  const parsed = ingredientStatusSchema.safeParse({
    id: formData.get("id"),
    status: formData.get("status"),
  });
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Input tidak valid.");
  }
  await setIngredientStatus(parsed.data.id, parsed.data.status as RecordStatus);
  revalidatePath(PATH);
}

export async function deliverIngredientAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  // Rule 5.5: deliveries are Admin/Superadmin (FR-81); Owner rejected.
  const user = await requireRole(...OPERATORS);

  const parsed = deliverySchema.safeParse({
    ingredientId: formData.get("ingredientId"),
    quantity: formData.get("quantity"),
    date: formData.get("date"),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Input tidak valid." };
  }
  try {
    await recordDelivery({
      ingredientId: parsed.data.ingredientId,
      quantity: parsed.data.quantity,
      enteredById: user.id,
      date: new Date(`${parsed.data.date}T00:00:00Z`),
    });
    revalidatePath(PATH);
    return { ok: true, message: "Penerimaan dicatat — stok bahan bertambah." };
  } catch (err) {
    if (err instanceof AppError) return { ok: false, error: err.message };
    throw err;
  }
}

export async function correctIngredientAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  // Rule 5.5: an ingredient stock correction is Superadmin only.
  const user = await requireRole("SUPERADMIN");

  const parsed = ingredientCorrectionSchema.safeParse({
    ingredientId: formData.get("ingredientId"),
    newQuantity: formData.get("newQuantity"),
    reason: formData.get("reason"),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Input tidak valid." };
  }
  try {
    await recordIngredientCorrection({
      ingredientId: parsed.data.ingredientId,
      newQuantity: parsed.data.newQuantity,
      reason: parsed.data.reason,
      enteredById: user.id,
    });
    revalidatePath(PATH);
    return { ok: true, message: "Stok bahan dikoreksi." };
  } catch (err) {
    if (err instanceof AppError) return { ok: false, error: err.message };
    throw err;
  }
}
