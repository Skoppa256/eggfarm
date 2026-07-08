import { IngredientCategory } from "@/generated/prisma/enums";

// Pure PAKAN (feed) math and the JENIS render order (SRS §3.11, CLAUDE.md §6). No I/O —
// worked-example testable and shared. Feed quantities are kg; results are rounded to
// 3 dp (the service stores them as Decimal to avoid float drift).

const round3 = (x: number): number => Math.round(x * 1000) / 1000;

/**
 * Requirement TOTAL (kg) = HIDUP × projected intake (g/bird) ÷ 1000 (FR-82).
 * Worked example: 3377 birds × 118 g ÷ 1000 = 398.486 kg.
 */
export function computeRequirementKg(hidup: number, projectedIntakeGram: number): number {
  return round3((hidup * projectedIntakeGram) / 1000);
}

/**
 * Fresh mix TOTAL CAMPUR (kg) = requirement − reusable leftover, floored at 0 (FR-83).
 * On a no-mix day (leftover ≥ requirement) this is 0, so PAKAN MASUK = 0 while PAKAN
 * TERSEDIA (= MASUK + leftover) still exceeds the requirement.
 */
export function computeTotalCampur(requirementKg: number, reusableLeftoverKg: number): number {
  return Math.max(0, round3(requirementKg - reusableLeftoverKg));
}

/** A main feed's weight (kg) = percent × TOTAL CAMPUR ÷ 100 (FR-84). */
export function computeMainWeight(totalCampur: number, percent: number): number {
  return round3((totalCampur * percent) / 100);
}

/** JENIS render order (FR-76): konsentrat/finished, then premix, then jagung, then dedak. */
export const CATEGORY_ORDER: readonly IngredientCategory[] = [
  IngredientCategory.KONSENTRAT,
  IngredientCategory.PREMIX,
  IngredientCategory.GRAIN,
  IngredientCategory.BRAN,
];

const CATEGORY_RANK = new Map<IngredientCategory, number>(
  CATEGORY_ORDER.map((c, i) => [c, i]),
);

/** Human labels for the ingredient categories (shared client + server). */
export const CATEGORY_LABELS: Record<IngredientCategory, string> = {
  KONSENTRAT: "Konsentrat / Pakan jadi",
  PREMIX: "Premix / Suplemen",
  GRAIN: "Biji-bijian / Jagung",
  BRAN: "Dedak",
};

export interface JenisEntry {
  name: string;
  category: IngredientCategory;
  sortOrder?: number;
}

/**
 * Derive the JENIS string from a recipe's ingredients (FR-76), ordered by category
 * (konsentrat → premix → jagung → dedak), then by ingredient sortOrder then name,
 * joined with " + " — e.g. "DKLS-36 + Maximus-Egg + Jagung + Dedak". A finished-feed
 * kandang (single 100% main + optional premix) renders as that feed (+ premix).
 */
export function computeJenis(entries: JenisEntry[]): string {
  return [...entries]
    .sort(
      (a, b) =>
        (CATEGORY_RANK.get(a.category) ?? 99) - (CATEGORY_RANK.get(b.category) ?? 99) ||
        (a.sortOrder ?? 0) - (b.sortOrder ?? 0) ||
        a.name.localeCompare(b.name),
    )
    .map((e) => e.name)
    .join(" + ");
}
