import {
  buildReportText,
  type DailyReport,
  dec2,
  int,
  longDate,
  notesOf,
  num,
} from "@/lib/dailyReport";
import { formatPcs } from "@/lib/units";

import { CopyReportButton } from "./copy-report-button";

export type { DailyReport };

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline gap-1.5">
      <span className="text-xs text-zinc-500">{label}</span>
      <span className="font-semibold tabular-nums text-zinc-900">{value}</span>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-emerald-700">
        {title}
      </div>
      <div className="flex flex-wrap gap-x-6 gap-y-1">{children}</div>
    </div>
  );
}

/** Screenshot-friendly daily summary the admin posts to the WhatsApp group. */
export function DailyReportCard({ report }: { report: DailyReport }) {
  const r = report;
  const notes = notesOf(r);

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-zinc-500">Ringkasan untuk WhatsApp</h2>
        <CopyReportButton text={buildReportText(r)} />
      </div>

      <div className="overflow-hidden rounded-xl border border-emerald-200 bg-white shadow-sm">
        <div className="bg-emerald-600 px-5 py-3 text-white">
          <div className="text-sm font-semibold tracking-wide">📋 Laporan Harian · {r.farmName}</div>
          <div className="text-xs text-emerald-50">
            {r.kandangName} ({r.kandangCode}) — {longDate(r.dateStr)}
          </div>
        </div>

        <div className="flex flex-col gap-3 px-5 py-4 text-sm">
          <div className="flex flex-wrap gap-x-6 gap-y-1 text-zinc-600">
            <span>
              Flock: <b className="text-zinc-900">{r.strain}</b>
            </span>
            <span>
              HARI <b className="text-zinc-900">{r.hari}</b>
            </span>
            <span>
              MINGGU <b className="text-zinc-900">{r.minggu}</b>
            </span>
          </div>

          <Section title="Populasi">
            <Metric label="HIDUP" value={int(r.hidup)} />
            <Metric label="MATI" value={int(r.mati)} />
            <Metric label="AFKIR" value={int(r.afkir)} />
          </Section>

          <Section title={`Telur · HD% ${dec2(r.hdPercent)}`}>
            <Metric label="Utuh" value={formatPcs(r.utuh)} />
            <Metric label="Lunak" value={formatPcs(r.lunak)} />
            <Metric label="Pecah" value={formatPcs(r.pecah)} />
            <Metric label="Kosong" value={formatPcs(r.kosong)} />
          </Section>

          <Section title="Pakan">
            <Metric label="Intake" value={`${num(r.intake)} kg`} />
            <Metric label="g/ekor" value={num(r.gramEkor)} />
            <Metric label="FCR" value={r.fcr == null ? "—" : dec2(r.fcr)} />
          </Section>
          {r.jenis && (
            <div className="text-xs text-zinc-500">
              Jenis pakan: <span className="text-zinc-700">{r.jenis}</span>
            </div>
          )}

          <div className="flex flex-col gap-1 border-t border-zinc-100 pt-2 text-xs text-zinc-600">
            <div>
              💉 <span className="font-medium text-zinc-500">Vaksin:</span>{" "}
              {r.vaksin.length ? r.vaksin.join("; ") : "—"}
            </div>
            {notes.length > 0 && (
              <div>
                📝 <span className="font-medium text-zinc-500">Catatan:</span> {notes.join(" · ")}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
