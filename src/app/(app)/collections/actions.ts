"use server";

import { revalidatePath } from "next/cache";

import type { ActionResult } from "@/lib/action-result";
import { AppError } from "@/lib/errors";
import { collectionCountsSchema, collectionKeySchema } from "@/lib/schemas/collections";
import { requireRole } from "@/lib/server/auth";
import {
  type AngkatRakLiftInput,
  type CollectionCounts,
  createCollection,
  updateCollection,
} from "@/lib/server/collections";
import { rakToPcs } from "@/lib/units";

const PATH = "/collections";
const OPERATORS = ["ADMIN", "SUPERADMIN"] as const;

/** Read the dynamic `rak_<typeGradeId>` fields and convert rak → pcs. */
function readLifts(formData: FormData): AngkatRakLiftInput[] | { error: string } {
  const lifts: AngkatRakLiftInput[] = [];
  for (const [key, value] of formData.entries()) {
    if (!key.startsWith("rak_")) continue;
    const rak = Number(value);
    if (!Number.isInteger(rak) || rak < 0) {
      return { error: "Angkat Rak harus bilangan bulat rak dan tidak boleh negatif." };
    }
    lifts.push({ typeGradeId: key.slice(4), quantity: rakToPcs(rak) });
  }
  return lifts;
}

function parseCounts(formData: FormData): CollectionCounts | { error: string } {
  const parsed = collectionCountsSchema.safeParse({
    goodEggs: formData.get("goodEggs"),
    telurRetak: formData.get("telurRetak"),
    telurLunak: formData.get("telurLunak"),
    telurKosong: formData.get("telurKosong"),
    remarks: formData.get("remarks") ?? undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Input tidak valid." };
  }
  const lifts = readLifts(formData);
  if ("error" in lifts) return { error: lifts.error };
  return { ...parsed.data, lifts };
}

export async function createCollectionAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireRole(...OPERATORS);

  const key = collectionKeySchema.safeParse({
    farmhouseId: formData.get("farmhouseId"),
    date: formData.get("date"),
    batchNumber: formData.get("batchNumber"),
  });
  if (!key.success) {
    return { ok: false, error: key.error.issues[0]?.message ?? "Input tidak valid." };
  }
  const counts = parseCounts(formData);
  if ("error" in counts) return { ok: false, error: counts.error };

  try {
    await createCollection(
      {
        farmhouseId: key.data.farmhouseId,
        date: new Date(`${key.data.date}T00:00:00Z`),
        batchNumber: key.data.batchNumber,
      },
      counts,
      { userId: user.id },
    );
    revalidatePath(PATH);
    return { ok: true, message: `Batch ${key.data.batchNumber} disimpan.` };
  } catch (err) {
    if (err instanceof AppError) return { ok: false, error: err.message };
    throw err;
  }
}

export async function updateCollectionAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireRole(...OPERATORS);

  const collectionId = formData.get("collectionId");
  if (typeof collectionId !== "string" || collectionId.length === 0) {
    return { ok: false, error: "Referensi collection tidak ada." };
  }
  const counts = parseCounts(formData);
  if ("error" in counts) return { ok: false, error: counts.error };

  // Editing a graded-and-locked collection requires a Superadmin who explicitly opts in
  // (the override checkbox). Admins never get the override — the lock is hard for them.
  const allowGradedEdit =
    user.role === "SUPERADMIN" && formData.get("allowGradedEdit") === "on";

  try {
    await updateCollection(collectionId, counts, { userId: user.id }, { allowGradedEdit });
    revalidatePath(PATH);
    return { ok: true, message: "Tersimpan." };
  } catch (err) {
    if (err instanceof AppError) return { ok: false, error: err.message };
    throw err;
  }
}
