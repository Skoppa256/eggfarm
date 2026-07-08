"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import type { ActionResult } from "@/lib/action-result";
import { AppError } from "@/lib/errors";
import {
  correctPopulasiAwalSchema,
  createFlockSchema,
  endPlacementSchema,
  placementSchema,
} from "@/lib/schemas/flocks";
import { requireRole } from "@/lib/server/auth";
import {
  correctPopulasiAwal,
  createFlock,
  endPlacement,
  type PlacementInput,
} from "@/lib/server/flocks";

/** Read the dynamic `placement.<i>.*` rows, skipping blank ones. */
function readPlacements(formData: FormData): PlacementInput[] | { error: string } {
  const count = Number(formData.get("placementCount") ?? 0);
  const placements: PlacementInput[] = [];
  for (let i = 0; i < count; i++) {
    const farmhouseId = formData.get(`placement.${i}.farmhouseId`);
    const popRaw = formData.get(`placement.${i}.populasiAwal`);
    const blank =
      !farmhouseId ||
      String(farmhouseId).trim() === "" ||
      popRaw == null ||
      String(popRaw).trim() === "" ||
      Number(popRaw) === 0;
    if (blank) continue;
    const parsed = placementSchema.safeParse({ farmhouseId, populasiAwal: popRaw });
    if (!parsed.success) {
      return { error: `Placement ${i + 1}: ${parsed.error.issues[0]?.message ?? "tidak valid"}.` };
    }
    placements.push(parsed.data);
  }
  if (placements.length === 0) {
    return { error: "Tetapkan minimal satu Kandang dengan Populasi Awal." };
  }
  return placements;
}

export async function createFlockAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  // Rule 5.5: flock creation is Superadmin-only.
  const user = await requireRole("SUPERADMIN");

  const header = createFlockSchema.safeParse({
    strain: formData.get("strain"),
    chickInDate: formData.get("chickInDate"),
    placementAge: formData.get("placementAge"),
  });
  if (!header.success) {
    return { ok: false, error: header.error.issues[0]?.message ?? "Input tidak valid." };
  }
  const placements = readPlacements(formData);
  if ("error" in placements) return { ok: false, error: placements.error };

  let flockId: string;
  try {
    const flock = await createFlock(
      {
        strain: header.data.strain,
        chickInDate: new Date(`${header.data.chickInDate}T00:00:00Z`),
        placementAge: header.data.placementAge,
        placements,
      },
      { userId: user.id },
    );
    flockId = flock.id;
  } catch (err) {
    if (err instanceof AppError) return { ok: false, error: err.message };
    throw err;
  }

  revalidatePath("/flocks");
  redirect(`/flocks/${flockId}`); // outside try so redirect's signal isn't swallowed
}

export async function endPlacementAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  await requireRole("SUPERADMIN");

  const parsed = endPlacementSchema.safeParse({
    placementId: formData.get("placementId"),
    endDate: formData.get("endDate"),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Input tidak valid." };
  }
  try {
    const placement = await endPlacement(
      parsed.data.placementId,
      new Date(`${parsed.data.endDate}T00:00:00Z`),
    );
    revalidatePath("/flocks");
    if (placement) revalidatePath(`/flocks/${placement.flockId}`);
    return { ok: true, message: "Placement diakhiri; Kandang dibebaskan." };
  } catch (err) {
    if (err instanceof AppError) return { ok: false, error: err.message };
    throw err;
  }
}

export async function correctPopulasiAwalAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  // Rule 5.5: correcting Populasi Awal is a Superadmin-only escape hatch (A20/A23).
  await requireRole("SUPERADMIN");

  const parsed = correctPopulasiAwalSchema.safeParse({
    placementId: formData.get("placementId"),
    populasiAwal: formData.get("populasiAwal"),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Input tidak valid." };
  }
  try {
    const placement = await correctPopulasiAwal(parsed.data.placementId, parsed.data.populasiAwal);
    revalidatePath("/flocks");
    if (placement) revalidatePath(`/flocks/${placement.flockId}`);
    return { ok: true, message: "Populasi Awal dikoreksi; HIDUP dihitung ulang." };
  } catch (err) {
    if (err instanceof AppError) return { ok: false, error: err.message };
    throw err;
  }
}
