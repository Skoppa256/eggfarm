import { describe, expect, it } from "vitest";

import { computeHari, computeMinggu } from "@/lib/flock";

const D = (s: string) => new Date(`${s}T00:00:00Z`);

// Worked example: chicks were 113 days old at chick-in on 2026-07-01.
describe("flock age (SRS §3.9)", () => {
  it("HARI = placement age + days since chick-in", () => {
    const chickIn = D("2026-07-01");
    expect(computeHari(113, chickIn, D("2026-07-01"))).toBe(113); // chick-in day
    expect(computeHari(113, chickIn, D("2026-07-08"))).toBe(120); // +7 days
    expect(computeHari(113, chickIn, D("2026-07-15"))).toBe(127); // +14 days
  });

  it("MINGGU = floor(HARI / 7)", () => {
    expect(computeMinggu(113)).toBe(16);
    expect(computeMinggu(120)).toBe(17);
    expect(computeMinggu(127)).toBe(18);
    expect(computeMinggu(0)).toBe(0);
    expect(computeMinggu(6)).toBe(0);
    expect(computeMinggu(7)).toBe(1);
  });
});
