import { describe, expect, it } from "vitest";

import { conversionFactor, convertToBaseUnit, type OvkConversion } from "@/lib/ovk";

// OVK unit conversion (SRS §3.12). The mechanism is reusable for feed karung→kg (A35).

describe("OVK unit conversion", () => {
  const liters: OvkConversion[] = [{ unitName: "botol", factorToBase: 1 }];
  const grams: OvkConversion[] = [{ unitName: "pcs", factorToBase: 100 }];

  it("resolves the factor: base unit = 1, known conversion, unknown = null", () => {
    expect(conversionFactor("liter", "liter", liters)).toBe(1);
    expect(conversionFactor("botol", "liter", liters)).toBe(1);
    expect(conversionFactor("gram", "gram", grams)).toBe(1);
    expect(conversionFactor("pcs", "gram", grams)).toBe(100);
    expect(conversionFactor("karung", "liter", liters)).toBeNull();
  });

  it("converts an entered quantity to the base unit", () => {
    expect(convertToBaseUnit(2, "botol", "liter", liters)).toBe(2); // 2 botol = 2 liter
    expect(convertToBaseUnit(3, "pcs", "gram", grams)).toBe(300); // 3 pcs = 300 gram
    expect(convertToBaseUnit(5, "liter", "liter", liters)).toBe(5); // base passthrough
    expect(convertToBaseUnit(2.5, "botol", "liter", [{ unitName: "botol", factorToBase: 0.6 }])).toBe(1.5);
  });

  it("throws on an unknown unit", () => {
    expect(() => convertToBaseUnit(1, "karung", "liter", liters)).toThrow();
  });
});
