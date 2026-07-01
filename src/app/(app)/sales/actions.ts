"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import type { ActionResult } from "@/lib/action-result";
import { AppError } from "@/lib/errors";
import { saleHeaderSchema, saleLineSchema, voidSaleSchema } from "@/lib/schemas/sales";
import { requireRole } from "@/lib/server/auth";
import { createSale, type SaleLineInput, voidSale } from "@/lib/server/sales";
import { rakToPcs } from "@/lib/units";

const OPERATORS = ["ADMIN", "SUPERADMIN"] as const;

/** Read the dynamic `line.<i>.*` rows, skipping empty ones, converting rak → pcs. */
function readLines(formData: FormData): SaleLineInput[] | { error: string } {
  const count = Number(formData.get("lineCount") ?? 0);
  const lines: SaleLineInput[] = [];
  for (let i = 0; i < count; i++) {
    const qtyRaw = formData.get(`line.${i}.quantity`);
    if (qtyRaw == null || String(qtyRaw).trim() === "" || Number(qtyRaw) === 0) continue;
    const parsed = saleLineSchema.safeParse({
      sizeHealthGrade: formData.get(`line.${i}.sizeHealthGrade`),
      typeGradeId: formData.get(`line.${i}.typeGradeId`),
      quantity: qtyRaw,
      unit: formData.get(`line.${i}.unit`),
    });
    if (!parsed.success) {
      return { error: `Line ${i + 1}: ${parsed.error.issues[0]?.message ?? "invalid"}.` };
    }
    const { sizeHealthGrade, typeGradeId, quantity, unit } = parsed.data;
    lines.push({
      sizeHealthGrade,
      typeGradeId,
      quantity: unit === "RAK" ? rakToPcs(quantity) : quantity,
      unitUsed: unit,
    });
  }
  if (lines.length === 0) return { error: "Add at least one line with a quantity." };
  return lines;
}

export async function createSaleAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireRole(...OPERATORS);

  const header = saleHeaderSchema.safeParse({
    warehouseId: formData.get("warehouseId"),
    buyerId: formData.get("buyerId"),
    date: formData.get("date"),
    notes: formData.get("notes") ?? undefined,
  });
  if (!header.success) {
    return { ok: false, error: header.error.issues[0]?.message ?? "Invalid input." };
  }
  const lines = readLines(formData);
  if ("error" in lines) return { ok: false, error: lines.error };

  let saleId: string;
  try {
    const sale = await createSale(
      {
        warehouseId: header.data.warehouseId,
        buyerId: header.data.buyerId,
        date: new Date(`${header.data.date}T00:00:00Z`),
        notes: header.data.notes ?? null,
        lines,
      },
      { userId: user.id },
    );
    saleId = sale.id;
  } catch (err) {
    if (err instanceof AppError) return { ok: false, error: err.message };
    throw err;
  }

  revalidatePath("/sales");
  revalidatePath("/warehouse");
  redirect(`/sales/${saleId}`); // outside try so redirect's signal isn't swallowed
}

export async function voidSaleAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireRole(...OPERATORS);
  const parsed = voidSaleSchema.safeParse({
    transactionId: formData.get("transactionId"),
    reason: formData.get("reason"),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }
  try {
    await voidSale(parsed.data.transactionId, parsed.data.reason, { userId: user.id });
    revalidatePath(`/sales/${parsed.data.transactionId}`);
    revalidatePath("/sales");
    revalidatePath("/warehouse");
    return { ok: true, message: "Transaction voided; stock restored." };
  } catch (err) {
    if (err instanceof AppError) return { ok: false, error: err.message };
    throw err;
  }
}
