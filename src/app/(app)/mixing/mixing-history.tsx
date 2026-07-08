import { EmptyRiwayat, RiwayatShell } from "../riwayat";

export type MixingRiwayatRow = {
  dateStr: string;
  hidup: number;
  intake: string; // g/ekor entered
  masuk: string; // Total Campur / Pakan Masuk (kg)
  sisa: string; // reusable leftover (kg)
  noMix: boolean; // Pakan Masuk 0
};

const th = "px-2 py-1.5 font-medium";
const td = "px-2 py-1.5 tabular-nums";

// Mobile prioritizes the fields that drive today's entry (Tanggal, Intake, Masuk);
// HIDUP and Sisa reveal at sm+ (no horizontal scroll on a phone).
export function MixingHistory({ rows }: { rows: MixingRiwayatRow[] }) {
  return (
    <RiwayatShell>
      {rows.length === 0 ? (
        <EmptyRiwayat />
      ) : (
        <table className="w-full text-xs sm:text-sm">
          <thead className="text-zinc-500">
            <tr className="border-b border-zinc-200 dark:border-zinc-800">
              <th className={`${th} text-left`}>Tanggal</th>
              <th className={`${th} hidden text-right sm:table-cell`}>HIDUP</th>
              <th className={`${th} text-right`}>
                Intake<span className="hidden sm:inline"> (g/ekor)</span>
              </th>
              <th className={`${th} text-right`}>
                Masuk<span className="hidden sm:inline"> (kg)</span>
              </th>
              <th className={`${th} hidden text-right sm:table-cell`}>Sisa (kg)</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.dateStr} className="border-b border-zinc-100 last:border-0 dark:border-zinc-800">
                <td className={`${td} whitespace-nowrap`}>{r.dateStr}</td>
                <td className={`${td} hidden text-right sm:table-cell`}>{r.hidup}</td>
                <td className={`${td} text-right font-medium`}>{r.intake}</td>
                <td className={`${td} text-right`}>
                  {r.noMix ? (
                    <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[11px] font-medium text-amber-800 dark:bg-amber-900 dark:text-amber-200">
                      0 · tanpa mix
                    </span>
                  ) : (
                    r.masuk
                  )}
                </td>
                <td className={`${td} hidden text-right sm:table-cell`}>{r.sisa}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </RiwayatShell>
  );
}
