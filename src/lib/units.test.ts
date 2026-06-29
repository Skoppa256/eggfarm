import { describe, expect, it } from "vitest";

import { PCS_PER_RAK, formatPcs, pcsToRak, rakToPcs } from "@/lib/units";

describe("units", () => {
  it("formats the worked example from CLAUDE.md §6 (2617 -> '87 rak + 7 pcs')", () => {
    expect(formatPcs(2617)).toBe("87 rak + 7 pcs");
  });

  it("round-trips between rak and pcs", () => {
    expect(PCS_PER_RAK).toBe(30);
    expect(rakToPcs(87, 7)).toBe(2617);
    expect(rakToPcs(87)).toBe(2610);
    expect(pcsToRak(2617)).toEqual({ rak: 87, pcs: 7 });
  });

  it("handles zero, exact rak, and sub-rak amounts", () => {
    expect(formatPcs(0)).toBe("0 rak + 0 pcs");
    expect(formatPcs(30)).toBe("1 rak + 0 pcs");
    expect(formatPcs(29)).toBe("0 rak + 29 pcs");
  });

  it("rejects non-integer pcs", () => {
    expect(() => formatPcs(1.5)).toThrow();
    expect(() => rakToPcs(1.2)).toThrow();
  });
});
