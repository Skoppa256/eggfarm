import { describe, expect, it } from "vitest";

import { buildReportText, type DailyReport } from "./dailyReport";

const base: DailyReport = {
  farmName: "Gudang A",
  kandangName: "Kandang E",
  kandangCode: "KD-E",
  dateStr: "2026-06-17",
  strain: "Lohmann Brown",
  hari: 70,
  minggu: 10,
  hidup: 7296,
  mati: 0,
  afkir: 0,
  utuh: 6800,
  lunak: 12,
  pecah: 8,
  kosong: 3,
  hdPercent: 93.5,
  intake: 583.68,
  gramEkor: 80,
  fcr: 2.1,
  jenis: "DKLS + Jagung + Dedak",
  vaksin: [],
  obat: null,
  vitamin: null,
  keterangan: null,
};

describe("buildReportText (WhatsApp daily report)", () => {
  it("includes the farm, kandang, and Indonesian-formatted figures", () => {
    const text = buildReportText(base);
    expect(text).toContain("📋 *LAPORAN HARIAN* — Gudang A"); // mapped-warehouse name
    expect(text).toContain("🏠 Kandang E (KD-E)");
    expect(text).toContain("🐔 Lohmann Brown · HARI 70 · MINGGU 10");
    expect(text).toContain("HIDUP: 7.296 · MATI: 0 · AFKIR: 0"); // id-ID thousands sep
    expect(text).toContain("Utuh: 226 rak + 20 pcs"); // eggs as rak + pcs (6800 pcs)
    expect(text).toContain("Lunak: 0 rak + 12 pcs");
    expect(text).toContain("HD% 93,50"); // id-ID decimal comma, 2dp
    expect(text).toContain("Intake: 583,68 kg · 80 g/ekor · FCR: 2,10");
    expect(text).toContain("Jenis: DKLS + Jagung + Dedak");
  });

  it("shows a dash for FCR/VAKSIN when absent and omits an empty Catatan line", () => {
    const text = buildReportText({ ...base, fcr: null, vaksin: [] });
    expect(text).toContain("FCR: —");
    expect(text).toContain("*VAKSIN:* —");
    expect(text).not.toContain("*Catatan:*");
  });

  it("lists vaksin entries and merges present notes into one Catatan line", () => {
    const text = buildReportText({
      ...base,
      vaksin: ["ND-IB (2 vials, Budi)"],
      obat: "Amoxy",
      vitamin: "Vitakur",
      keterangan: null,
    });
    expect(text).toContain("*VAKSIN:* ND-IB (2 vials, Budi)");
    expect(text).toContain("*Catatan:* Obat: Amoxy · Vitamin: Vitakur");
    expect(text).not.toContain("Ket.:");
  });

  it("drops the Jenis line when no mix type is set", () => {
    const text = buildReportText({ ...base, jenis: null });
    expect(text).not.toContain("Jenis:");
  });
});
