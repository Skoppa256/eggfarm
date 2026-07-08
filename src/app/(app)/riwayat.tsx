import type { ReactNode } from "react";

/** Compact "Riwayat (hari sebelumnya)" wrapper shared by the mixing + daily panels. */
export function RiwayatShell({ children }: { children: ReactNode }) {
  return (
    <section className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-800">
      <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">
        Riwayat (hari sebelumnya)
      </h2>
      {children}
    </section>
  );
}

/** Graceful empty state — new placement or no prior days. */
export function EmptyRiwayat() {
  return <p className="text-sm text-zinc-500">Belum ada data sebelumnya untuk kandang ini.</p>;
}

/** Short WITA date for a Riwayat row, e.g. "07 Jul". */
export function fmtRiwayatDate(d: Date): string {
  return d.toLocaleDateString("id-ID", { timeZone: "UTC", day: "2-digit", month: "short" });
}
