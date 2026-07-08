"use server";

import { revalidatePath } from "next/cache";

import { SizeHealthGrade } from "@/generated/prisma/enums";
import type { ActionResult } from "@/lib/action-result";
import { AppError } from "@/lib/errors";
import { GRADEABLE_GRADES, isPcsGrade } from "@/lib/grades";
import { gradingKeySchema } from "@/lib/schemas/grading";
import { requireRole } from "@/lib/server/auth";
import { type GradingKey, type GradingLineInput, saveDraft, submitGrading } from "@/lib/server/grading";
import { rakToPcs } from "@/lib/units";

const PATH = "/grading";
const OPERATORS = ["ADMIN", "SUPERADMIN"] as const;
const gradeableSet = new Set<string>(GRADEABLE_GRADES);

/**
 * Read `q:<typeGradeId>:<grade>` fields and convert to pcs. Each grade's entry unit comes
 * from its `u:<grade>` field ("rak" → ×30, "pcs" → as-is); the pcs-only grades default to
 * pcs. This lets the operator grade any grade in rak OR pcs.
 */
function readLines(formData: FormData): GradingLineInput[] | { error: string } {
  const units = new Map<string, "rak" | "pcs">();
  for (const [field, value] of formData.entries()) {
    if (field.startsWith("u:")) units.set(field.slice(2), value === "pcs" ? "pcs" : "rak");
  }

  const lines: GradingLineInput[] = [];
  for (const [field, value] of formData.entries()) {
    if (!field.startsWith("q:")) continue;
    const parts = field.split(":");
    if (parts.length !== 3) continue;
    const [, typeGradeId, gradeStr] = parts;
    if (!gradeableSet.has(gradeStr)) {
      return { error: `Grade "${gradeStr}" tidak dikenal.` };
    }
    const grade = gradeStr as SizeHealthGrade;
    const n = Number(value);
    if (!Number.isInteger(n) || n < 0) {
      return { error: "Jumlah grade harus bilangan bulat dan tidak boleh negatif." };
    }
    if (n === 0) continue;
    const unit = units.get(gradeStr) ?? (isPcsGrade(grade) ? "pcs" : "rak");
    lines.push({
      sizeHealthGrade: grade,
      typeGradeId,
      quantity: unit === "pcs" ? n : rakToPcs(n),
    });
  }
  return lines;
}

function parse(formData: FormData): { key: GradingKey; input: { remarks?: string | null; lines: GradingLineInput[] } } | { error: string } {
  const key = gradingKeySchema.safeParse({
    farmhouseId: formData.get("farmhouseId"),
    date: formData.get("date"),
    batchNumber: formData.get("batchNumber"),
  });
  if (!key.success) {
    return { error: key.error.issues[0]?.message ?? "Input tidak valid." };
  }
  const lines = readLines(formData);
  if ("error" in lines) return { error: lines.error };
  const remarks = formData.get("remarks");
  return {
    key: {
      farmhouseId: key.data.farmhouseId,
      date: new Date(`${key.data.date}T00:00:00Z`),
      batchNumber: key.data.batchNumber,
    },
    input: { remarks: typeof remarks === "string" ? remarks : null, lines },
  };
}

export async function saveDraftAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireRole(...OPERATORS);
  const parsed = parse(formData);
  if ("error" in parsed) return { ok: false, error: parsed.error };

  try {
    await saveDraft(parsed.key, parsed.input, { userId: user.id });
    revalidatePath(PATH);
    return { ok: true, message: `Batch ${parsed.key.batchNumber} disimpan sebagai draft.` };
  } catch (err) {
    if (err instanceof AppError) return { ok: false, error: err.message };
    throw err;
  }
}

export async function submitGradingAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireRole(...OPERATORS);
  const parsed = parse(formData);
  if ("error" in parsed) return { ok: false, error: parsed.error };

  try {
    await submitGrading(parsed.key, parsed.input, { userId: user.id });
    revalidatePath(PATH);
    return { ok: true, message: `Batch ${parsed.key.batchNumber} disubmit.` };
  } catch (err) {
    if (err instanceof AppError) return { ok: false, error: err.message };
    throw err;
  }
}
