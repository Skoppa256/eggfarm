"use server";

import { revalidatePath } from "next/cache";

import { RecordStatus } from "@/generated/prisma/enums";
import type { ActionResult } from "@/lib/action-result";
import { AppError } from "@/lib/errors";
import { buyerStatusSchema, createBuyerSchema, renameBuyerSchema } from "@/lib/schemas/sales";
import { requireRole } from "@/lib/server/auth";
import { createBuyer, renameBuyer, setBuyerStatus } from "@/lib/server/buyers";

const PATH = "/buyers";
const OPERATORS = ["ADMIN", "SUPERADMIN"] as const;

export async function createBuyerAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  await requireRole(...OPERATORS);
  const parsed = createBuyerSchema.safeParse({ name: formData.get("name") });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Input tidak valid." };
  }
  try {
    const buyer = await createBuyer(parsed.data);
    revalidatePath(PATH);
    return { ok: true, message: `Pembeli ${buyer.name} ditambahkan.` };
  } catch (err) {
    if (err instanceof AppError) return { ok: false, error: err.message };
    throw err;
  }
}

export async function renameBuyerAction(formData: FormData): Promise<void> {
  await requireRole(...OPERATORS);
  const parsed = renameBuyerSchema.safeParse({
    id: formData.get("id"),
    name: formData.get("name"),
  });
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Input tidak valid.");
  }
  await renameBuyer(parsed.data.id, parsed.data.name);
  revalidatePath(PATH);
}

export async function setBuyerStatusAction(formData: FormData): Promise<void> {
  await requireRole(...OPERATORS);
  const parsed = buyerStatusSchema.safeParse({
    id: formData.get("id"),
    status: formData.get("status"),
  });
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Input tidak valid.");
  }
  await setBuyerStatus(
    parsed.data.id,
    parsed.data.status === "ACTIVE" ? RecordStatus.ACTIVE : RecordStatus.INACTIVE,
  );
  revalidatePath(PATH);
}
