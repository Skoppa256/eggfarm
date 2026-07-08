"use server";

import { revalidatePath } from "next/cache";

import type { ActionResult } from "@/lib/action-result";
import { AppError } from "@/lib/errors";
import { dailyInputSchema, dailyKeySchema } from "@/lib/schemas/dailyRecords";
import { requireRole } from "@/lib/server/auth";
import { createDailyRecord, type DailyInput, updateDailyRecord } from "@/lib/server/dailyRecords";

const PATH = "/daily";
const OPERATORS = ["ADMIN", "SUPERADMIN"] as const;

function optionalText(v: FormDataEntryValue | null): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t.length > 0 ? t : null;
}

/** Assemble the full DailyInput (numeric core via Zod; optional body weight + notes). */
function parseInput(formData: FormData): DailyInput | { error: string } {
  const core = dailyInputSchema.safeParse({
    mati: formData.get("mati"),
    afkir: formData.get("afkir"),
    sisaDigunakan: formData.get("sisaDigunakan"),
    sisaDibuang: formData.get("sisaDibuang"),
    beratTelur: formData.get("beratTelur"),
  });
  if (!core.success) return { error: core.error.issues[0]?.message ?? "Input tidak valid." };

  let beratBadan: number | null = null;
  const bbRaw = formData.get("beratBadan");
  if (typeof bbRaw === "string" && bbRaw.trim() !== "") {
    const n = Number(bbRaw);
    if (!Number.isFinite(n) || n < 0) return { error: "BERAT BADAN harus bilangan yang tidak boleh negatif." };
    beratBadan = n;
  }

  return {
    ...core.data,
    beratBadan,
    obatNote: optionalText(formData.get("obatNote")),
    vitaminNote: optionalText(formData.get("vitaminNote")),
    keterangan: optionalText(formData.get("keterangan")),
  };
}

export async function createDailyRecordAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireRole(...OPERATORS);

  const key = dailyKeySchema.safeParse({
    farmhouseId: formData.get("farmhouseId"),
    date: formData.get("date"),
  });
  if (!key.success) {
    return { ok: false, error: key.error.issues[0]?.message ?? "Input tidak valid." };
  }
  const input = parseInput(formData);
  if ("error" in input) return { ok: false, error: input.error };

  try {
    await createDailyRecord(
      { farmhouseId: key.data.farmhouseId, date: new Date(`${key.data.date}T00:00:00Z`) },
      input,
      { userId: user.id },
    );
    revalidatePath(PATH);
    return { ok: true, message: "Daily record disimpan." };
  } catch (err) {
    if (err instanceof AppError) return { ok: false, error: err.message };
    throw err;
  }
}

export async function updateDailyRecordAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireRole(...OPERATORS);

  const recordId = formData.get("recordId");
  if (typeof recordId !== "string" || recordId.length === 0) {
    return { ok: false, error: "Referensi record tidak ada." };
  }
  const input = parseInput(formData);
  if ("error" in input) return { ok: false, error: input.error };

  try {
    await updateDailyRecord(recordId, input, { userId: user.id });
    revalidatePath(PATH);
    return { ok: true, message: "Tersimpan." };
  } catch (err) {
    if (err instanceof AppError) return { ok: false, error: err.message };
    throw err;
  }
}
