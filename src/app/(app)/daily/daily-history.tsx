import { EmptyRiwayat, RiwayatShell } from "../riwayat";

export type DailyRiwayatRow = {
  dateStr: string;
  hari: number;
  mati: number;
  afkir: number;
  hidup: number;
  hdPercent: string; // e.g. "80.00"
  beratTelur: string; // kg
  intake: string; // Realisasi Intake (kg) or "—"
};

const th = "px-2 py-1.5 font-medium";
const td = "px-2 py-1.5 tabular-nums";

// Mobile prioritizes the mortality + population trend (Tanggal, MATI, AFKIR, HIDUP);
// HARI, HD%, Berat Telur and Realisasi Intake reveal at sm+ (no horizontal scroll).
export function DailyHistory({ rows }: { rows: DailyRiwayatRow[] }) {
  return (
    <RiwayatShell>
      {rows.length === 0 ? (
        <EmptyRiwayat />
      ) : (
        <table className="w-full text-xs sm:text-sm">
          <thead className="text-zinc-500">
            <tr className="border-b border-zinc-200 dark:border-zinc-800">
              <th className={`${th} text-left`}>Tanggal</th>
              <th className={`${th} hidden text-right sm:table-cell`}>HARI</th>
              <th className={`${th} text-right`}>MATI</th>
              <th className={`${th} text-right`}>AFKIR</th>
              <th className={`${th} text-right`}>HIDUP</th>
              <th className={`${th} hidden text-right sm:table-cell`}>HD%</th>
              <th className={`${th} hidden text-right sm:table-cell`}>Berat Telur</th>
              <th className={`${th} hidden text-right sm:table-cell`}>Intake</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.dateStr} className="border-b border-zinc-100 last:border-0 dark:border-zinc-800">
                <td className={`${td} whitespace-nowrap`}>{r.dateStr}</td>
                <td className={`${td} hidden text-right sm:table-cell`}>{r.hari}</td>
                <td className={`${td} text-right ${r.mati > 0 ? "font-semibold text-rose-600" : ""}`}>{r.mati}</td>
                <td className={`${td} text-right`}>{r.afkir}</td>
                <td className={`${td} text-right font-medium`}>{r.hidup}</td>
                <td className={`${td} hidden text-right sm:table-cell`}>{r.hdPercent}</td>
                <td className={`${td} hidden text-right sm:table-cell`}>{r.beratTelur}</td>
                <td className={`${td} hidden text-right sm:table-cell`}>{r.intake}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </RiwayatShell>
  );
}
