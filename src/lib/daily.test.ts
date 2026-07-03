import { describe, expect, it } from "vitest";

import {
  computeEggBuckets,
  computeFcr,
  computeGramPerEkor,
  computeHdPercent,
  computePakanTersedia,
  computeRealisasiIntake,
} from "@/lib/daily";

// Worked examples for the daily-record derivations (SRS §3.10). CLAUDE.md §6 formulas,
// followed exactly — no simplification.

describe("egg buckets (FR-70)", () => {
  const collection = { goodEggs: 4000, telurLunak: 50, telurRetak: 120, telurKosong: 30 };

  it("derives four buckets from collection; the daily total is stable", () => {
    const b = computeEggBuckets(collection, null);
    expect(b).toMatchObject({ utuh: 4000, lunak: 50, pecah: 120, kosong: 30, total: 4200 });
    expect(b.reconciledToGrading).toBe(false);
    expect(b.pecahRetak).toBeNull();
    expect(b.pecahPlastik).toBeNull();
  });

  it("reconciles to grading by firming only the Pecah sub-split — total unchanged", () => {
    const b = computeEggBuckets(collection, { retak: 80, plastik: 40 });
    // Bucket totals and the daily total are exactly as before reconciliation.
    expect(b).toMatchObject({ utuh: 4000, lunak: 50, pecah: 120, kosong: 30, total: 4200 });
    // Only the sub-split firms up.
    expect(b.reconciledToGrading).toBe(true);
    expect(b.pecahRetak).toBe(80);
    expect(b.pecahPlastik).toBe(40);
  });
});

describe("HD% (FR-71) = (Utuh+Lunak+Pecah+Kosong) / HIDUP × 100", () => {
  it("matches the all-eggs formula on sample data", () => {
    expect(computeHdPercent(4600, 5000)).toBe(92); // 4600/5000*100
    expect(computeHdPercent(4200, 5000)).toBe(84);
    expect(computeHdPercent(1, 3)).toBe(33.33); // rounds to 2 dp
    expect(computeHdPercent(100, 0)).toBe(0); // no live hens
  });
});

describe("PAKAN chain (FR-72 / FR-73) and FCR (FR-74)", () => {
  it("TERSEDIA, REALISASI INTAKE, GRAM/EKOR, FCR on a clean worked example", () => {
    // HIDUP 5000. MASUK 500 kg fresh mix, 20 kg reusable leftover carried in.
    const tersedia = computePakanTersedia(500, 20);
    expect(tersedia).toBe(520);
    // SISA DIGUNAKAN 15, SISA DIBUANG 5 → intake 500.
    const intake = computeRealisasiIntake(tersedia, 15, 5);
    expect(intake).toBe(500);
    // GRAM/EKOR = 500 / 5000 × 1000 = 100 g/bird.
    expect(computeGramPerEkor(intake, 5000)).toBe(100);
    // BERAT TELUR 250 kg → FCR = 500 / 250 = 2.
    expect(computeFcr(intake, 250)).toBe(2);
  });

  it("handles fractional kg without float drift", () => {
    const tersedia = computePakanTersedia(90.25, 10.25); // 100.5
    expect(tersedia).toBe(100.5);
    const intake = computeRealisasiIntake(tersedia, 10.25, 5.25); // 85.0
    expect(intake).toBe(85);
    expect(computeGramPerEkor(intake, 5000)).toBe(17); // 85/5000*1000
    expect(computeFcr(intake, 34)).toBe(2.5); // 85/34
  });

  it("FCR is null when egg mass is zero, and gram/ekor zero without live hens", () => {
    expect(computeFcr(500, 0)).toBeNull();
    expect(computeGramPerEkor(500, 0)).toBe(0);
  });
});
