"use server";

import { revalidatePath } from "next/cache";

import { MixLineKind } from "@/generated/prisma/enums";
import type { ActionResult } from "@/lib/action-result";
import { AppError } from "@/lib/errors";
import { mixingKeySchema } from "@/lib/schemas/pakan";
import { requireRole } from "@/lib/server/auth";
import { createMixing, type MixLineInput } from "@/lib/server/mixing";

const OPERATORS = ["ADMIN", "SUPERADMIN"] as const;

/** Read the dynamic `line.<i>.*` recipe rows, skipping blank ones. */
function readLines(formData: FormData): MixLineInput[] | { error: string } {
  const count = Number(formData.get("lineCount") ?? 0);
  const lines: MixLineInput[] = [];
  for (let i = 0; i < count; i++) {
    const ingredientId = formData.get(`line.${i}.ingredientId`);
    if (typeof ingredientId !== "string" || ingredientId.trim() === "") continue;
    const kind = formData.get(`line.${i}.kind`) === "FIXED_WEIGHT" ? MixLineKind.FIXED_WEIGHT : MixLineKind.MAIN_PERCENT;
    if (kind === MixLineKind.MAIN_PERCENT) {
      const percent = Number(formData.get(`line.${i}.percent`));
      if (!Number.isFinite(percent) || percent <= 0) continue; // blank main row
      lines.push({ ingredientId, kind, percent });
    } else {
      const fixedWeight = Number(formData.get(`line.${i}.fixedWeight`));
      if (!Number.isFinite(fixedWeight) || fixedWeight <= 0) continue; // blank supplement row
      lines.push({ ingredientId, kind, fixedWeight });
    }
  }
  if (lines.length === 0) {
    return { error: "Tambahkan minimal satu PAKAN utama ke resep." };
  }
  return lines;
}

export async function createMixingAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  // Rule 5.5: mixing is Admin/Superadmin; Owner rejected.
  const user = await requireRole(...OPERATORS);

  const key = mixingKeySchema.safeParse({
    farmhouseId: formData.get("farmhouseId"),
    date: formData.get("date"),
    projectedIntake: formData.get("projectedIntake"),
  });
  if (!key.success) {
    return { ok: false, error: key.error.issues[0]?.message ?? "Input tidak valid." };
  }
  const lines = readLines(formData);
  if ("error" in lines) return { ok: false, error: lines.error };

  try {
    const mix = await createMixing(
      {
        farmhouseId: key.data.farmhouseId,
        date: new Date(`${key.data.date}T00:00:00Z`),
        projectedIntake: key.data.projectedIntake,
      },
      lines,
      { userId: user.id },
    );
    revalidatePath("/mixing");
    revalidatePath("/daily");
    revalidatePath("/ingredients");
    return {
      ok: true,
      message: `Mixing selesai: PAKAN MASUK ${mix.totalCampur.toFixed(3)} kg — ${mix.jenis || "tidak ada campuran baru"}.`,
    };
  } catch (err) {
    if (err instanceof AppError) return { ok: false, error: err.message };
    throw err;
  }
}
