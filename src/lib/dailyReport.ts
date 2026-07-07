// WhatsApp daily report — pure text/format logic (tested in dailyReport.test.ts).
// The presentational card lives in src/app/(app)/daily/daily-report.tsx and reuses
// the formatters + type exported here.

import { formatPcs } from "@/lib/units";

export type DailyReport = {
  farmName: string; // the warehouse mapped to this kandang (its "farm"/site name)
  kandangName: string;
  kandangCode: string;
  dateStr: string; // ISO yyyy-mm-dd (business date)
  strain: string;
  hari: number;
  minggu: number;
  hidup: number;
  mati: number;
  afkir: number;
  utuh: number;
  lunak: number;
  pecah: number;
  kosong: number;
  hdPercent: number;
  intake: number;
  gramEkor: number;
  fcr: number | null;
  jenis: string | null;
  vaksin: string[]; // formatted lines; empty when none logged
  obat: string | null;
  vitamin: string | null;
  keterangan: string | null;
};

// Indonesian number/date formatting — this report is read by the farm's WhatsApp group.
export const int = (n: number) => n.toLocaleString("id-ID", { maximumFractionDigits: 0 });
export const num = (n: number) => n.toLocaleString("id-ID", { maximumFractionDigits: 2 });
export const dec2 = (n: number) =>
  n.toLocaleString("id-ID", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function longDate(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  return d.toLocaleDateString("id-ID", {
    timeZone: "UTC",
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function notesOf(r: DailyReport): string[] {
  return [
    r.obat ? `Obat: ${r.obat}` : null,
    r.vitamin ? `Vitamin: ${r.vitamin}` : null,
    r.keterangan ? `Ket.: ${r.keterangan}` : null,
  ].filter((v): v is string => v !== null);
}

/** WhatsApp-formatted plain text (*bold* headers) — the "Salin teks" payload. */
export function buildReportText(r: DailyReport): string {
  const notes = notesOf(r);
  const lines = [
    `📋 *LAPORAN HARIAN* — ${r.farmName}`,
    `🏠 ${r.kandangName} (${r.kandangCode})`,
    `📅 ${longDate(r.dateStr)}`,
    `🐔 ${r.strain} · HARI ${r.hari} · MINGGU ${r.minggu}`,
    "",
    "*POPULASI*",
    `HIDUP: ${int(r.hidup)} · MATI: ${int(r.mati)} · AFKIR: ${int(r.afkir)}`,
    "",
    `*TELUR* (HD% ${dec2(r.hdPercent)})`,
    `Utuh: ${formatPcs(r.utuh)}`,
    `Lunak: ${formatPcs(r.lunak)}`,
    `Pecah: ${formatPcs(r.pecah)}`,
    `Kosong: ${formatPcs(r.kosong)}`,
    "",
    "*PAKAN*",
    `Intake: ${num(r.intake)} kg · ${num(r.gramEkor)} g/ekor · FCR: ${r.fcr == null ? "—" : dec2(r.fcr)}`,
  ];
  if (r.jenis) lines.push(`Jenis: ${r.jenis}`);
  lines.push("", `*VAKSIN:* ${r.vaksin.length ? r.vaksin.join("; ") : "—"}`);
  if (notes.length) lines.push(`*Catatan:* ${notes.join(" · ")}`);
  return lines.join("\n");
}
