// Date-only helpers for effective-dated config (Slice 3). We normalize to UTC
// midnight so a "day" is unambiguous and next-day / as-of comparisons are pure and
// testable. Effective dates are stored as Prisma `@db.Date` (date-only), which
// round-trips as a UTC-midnight Date. Pure and shared (client + server).

/** The UTC-midnight Date for the calendar day of `d`. */
export function toDateOnly(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

/** `d` shifted by `days` whole days, normalized to UTC midnight. */
export function addDays(d: Date, days: number): Date {
  const base = toDateOnly(d);
  base.setUTCDate(base.getUTCDate() + days);
  return base;
}

/** Today as a UTC-midnight date-only value. */
export function todayDateOnly(): Date {
  return toDateOnly(new Date());
}

/** Render a date-only value as `YYYY-MM-DD` (UTC). */
export function formatDateOnly(d: Date): string {
  return toDateOnly(d).toISOString().slice(0, 10);
}
