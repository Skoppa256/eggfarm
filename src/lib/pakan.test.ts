import { describe, expect, it } from "vitest";

import { IngredientCategory } from "@/generated/prisma/enums";
import {
  computeJenis,
  computeMainWeight,
  computeRequirementKg,
  computeTotalCampur,
} from "@/lib/pakan";

// Worked examples for PAKAN mixing (SRS §3.11). CLAUDE.md §6 formulas, exactly.

describe("requirement TOTAL = HIDUP × intake ÷ 1000 (FR-82)", () => {
  it("matches the known example 3377 × 118 = 398.486 kg", () => {
    expect(computeRequirementKg(3377, 118)).toBe(398.486);
  });
  it("scales with population and intake", () => {
    expect(computeRequirementKg(5000, 100)).toBe(500);
    expect(computeRequirementKg(1000, 115)).toBe(115);
  });
});

describe("fresh mix TOTAL CAMPUR = requirement − leftover, floored at 0 (FR-83)", () => {
  it("nets the leftover on a normal day", () => {
    expect(computeTotalCampur(398.486, 20)).toBe(378.486); // MASUK
  });
  it("no-mix day: leftover ≥ requirement → MASUK 0 (TERSEDIA still exceeds requirement)", () => {
    expect(computeTotalCampur(398.486, 450)).toBe(0);
    expect(computeTotalCampur(400, 400)).toBe(0);
    // TERSEDIA = MASUK + leftover = 0 + 450 = 450 > requirement 398.486 (checked in the daily block).
  });
});

describe("main-feed weight = % × TOTAL CAMPUR (FR-84)", () => {
  it("splits the fresh mix by percentage; fixed supplements are separate (not scaled)", () => {
    const totalCampur = 378.486;
    // Mains 70% konsentrat + 30% jagung sum to the whole fresh mix.
    const konsentrat = computeMainWeight(totalCampur, 70);
    const jagung = computeMainWeight(totalCampur, 30);
    expect(konsentrat).toBe(264.94);
    expect(jagung).toBe(113.546);
    expect(Math.round((konsentrat + jagung) * 1000) / 1000).toBe(totalCampur);
    // A fixed 2.5 kg premix is taken as entered — computeMainWeight is not involved.
  });
});

describe("JENIS render order (FR-76): konsentrat → premix → jagung → dedak", () => {
  it("renders the documented example order regardless of input order", () => {
    const jenis = computeJenis([
      { name: "Dedak", category: IngredientCategory.BRAN },
      { name: "Jagung", category: IngredientCategory.GRAIN },
      { name: "DKLS-36", category: IngredientCategory.KONSENTRAT },
      { name: "Maximus-Egg", category: IngredientCategory.PREMIX },
    ]);
    expect(jenis).toBe("DKLS-36 + Maximus-Egg + Jagung + Dedak");
  });

  it("finished-feed kandang: single 100% main (+ optional premix)", () => {
    expect(computeJenis([{ name: "SP-1", category: IngredientCategory.KONSENTRAT }])).toBe("SP-1");
    expect(
      computeJenis([
        { name: "SP-1", category: IngredientCategory.KONSENTRAT },
        { name: "Maximus-Egg", category: IngredientCategory.PREMIX },
      ]),
    ).toBe("SP-1 + Maximus-Egg");
  });
});
