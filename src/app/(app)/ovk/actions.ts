"use server";

import { revalidatePath } from "next/cache";

import { RecordStatus } from "@/generated/prisma/enums";
import type { ActionResult } from "@/lib/action-result";
import { AppError } from "@/lib/errors";
import {
  ovkCorrectionSchema,
  ovkDeliverySchema,
  ovkItemSchema,
  ovkStatusSchema,
  ovkTransferSchema,
} from "@/lib/schemas/ovk";
import { requireRole } from "@/lib/server/auth";
import {
  recordOvkCorrection,
  recordOvkDelivery,
  recordOvkTransfer,
} from "@/lib/server/ovkLedger";
import { createOvkItem, type OvkConversionInput, setOvkItemStatus } from "@/lib/server/ovkItems";

const PATH = "/ovk";
const OPERATORS = ["ADMIN", "SUPERADMIN"] as const;

/** Read the dynamic `conv.<i>.unit` / `conv.<i>.factor` rows, skipping blanks. */
function readConversions(formData: FormData): OvkConversionInput[] {
  const count = Number(formData.get("convCount") ?? 0);
  const out: OvkConversionInput[] = [];
  for (let i = 0; i < count; i++) {
    const unitName = formData.get(`conv.${i}.unit`);
    const factor = Number(formData.get(`conv.${i}.factor`));
    if (typeof unitName !== "string" || unitName.trim() === "") continue;
    out.push({ unitName: unitName.trim(), factorToBase: factor });
  }
  return out;
}

export async function createOvkItemAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  // Rule 5.5: the OVK master is Superadmin-only (FR-91).
  await requireRole("SUPERADMIN");

  const parsed = ovkItemSchema.safeParse({
    name: formData.get("name"),
    category: formData.get("category"),
    baseUnit: formData.get("baseUnit"),
    sortOrder: formData.get("sortOrder") ?? undefined,
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }
  try {
    await createOvkItem({ ...parsed.data, conversions: readConversions(formData) });
    revalidatePath(PATH);
    return { ok: true, message: `Item "${parsed.data.name}" added.` };
  } catch (err) {
    if (err instanceof AppError) return { ok: false, error: err.message };
    throw err;
  }
}

export async function setOvkItemStatusAction(formData: FormData): Promise<void> {
  await requireRole("SUPERADMIN");
  const parsed = ovkStatusSchema.safeParse({ id: formData.get("id"), status: formData.get("status") });
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Invalid input.");
  await setOvkItemStatus(parsed.data.id, parsed.data.status as RecordStatus);
  revalidatePath(PATH);
}

export async function deliverOvkAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireRole(...OPERATORS);
  const parsed = ovkDeliverySchema.safeParse({
    ovkItemId: formData.get("ovkItemId"),
    quantity: formData.get("quantity"),
    unitName: formData.get("unitName"),
    date: formData.get("date"),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }
  try {
    await recordOvkDelivery({
      ovkItemId: parsed.data.ovkItemId,
      quantity: parsed.data.quantity,
      unitName: parsed.data.unitName,
      enteredById: user.id,
      date: new Date(`${parsed.data.date}T00:00:00Z`),
    });
    revalidatePath(PATH);
    return { ok: true, message: "Delivery recorded — office stock increased." };
  } catch (err) {
    if (err instanceof AppError) return { ok: false, error: err.message };
    throw err;
  }
}

export async function transferOvkAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireRole(...OPERATORS);
  const parsed = ovkTransferSchema.safeParse({
    ovkItemId: formData.get("ovkItemId"),
    quantity: formData.get("quantity"),
    unitName: formData.get("unitName"),
    farmhouseId: formData.get("farmhouseId"),
    note: formData.get("note") ?? undefined,
    date: formData.get("date"),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }
  try {
    await recordOvkTransfer({
      ovkItemId: parsed.data.ovkItemId,
      quantity: parsed.data.quantity,
      unitName: parsed.data.unitName,
      farmhouseId: parsed.data.farmhouseId,
      note: parsed.data.note ?? null,
      enteredById: user.id,
      date: new Date(`${parsed.data.date}T00:00:00Z`),
    });
    revalidatePath(PATH);
    revalidatePath("/ovk/pemakaian");
    return { ok: true, message: "Transfer recorded — office stock reduced." };
  } catch (err) {
    if (err instanceof AppError) return { ok: false, error: err.message };
    throw err;
  }
}

export async function correctOvkAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireRole(...OPERATORS);
  const parsed = ovkCorrectionSchema.safeParse({
    ovkItemId: formData.get("ovkItemId"),
    newQuantity: formData.get("newQuantity"),
    reason: formData.get("reason"),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }
  try {
    await recordOvkCorrection({
      ovkItemId: parsed.data.ovkItemId,
      newQuantity: parsed.data.newQuantity,
      reason: parsed.data.reason,
      enteredById: user.id,
    });
    revalidatePath(PATH);
    return { ok: true, message: "Office stock corrected." };
  } catch (err) {
    if (err instanceof AppError) return { ok: false, error: err.message };
    throw err;
  }
}
