// Business dates for the farm. The farm operates on Central Indonesia Time
// (WITA / Asia/Makassar = UTC+8, no DST), so its calendar day flips at 00:00 WITA
// (= 16:00 UTC the previous day). `toBusinessDate` / `businessToday` are the single
// source of truth for "what business day is it". Business dates are stored date-only
// (Prisma `@db.Date`) and represented in code as the UTC-midnight Date of that WITA
// calendar day; timestamps stay UTC. Pure and shared (client + server).

// WITA is a fixed UTC+8 offset with no daylight saving, so a constant is exact.
const WITA_OFFSET_MS = 8 * 60 * 60 * 1000;

/** The UTC-midnight Date for the UTC calendar day of `d` (low-level; time stripped). */
export function toDateOnly(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

/** `d` shifted by `days` whole days, normalized to UTC midnight. */
export function addDays(d: Date, days: number): Date {
  const base = toDateOnly(d);
  base.setUTCDate(base.getUTCDate() + days);
  return base;
}

/**
 * The WITA (Asia/Makassar, UTC+8) calendar day that the instant `timestamp` falls
 * on, as a UTC-midnight date-only value. This is what a business date *means*.
 * Idempotent on date-only values (adding 8h to UTC-midnight stays within the day).
 */
export function toBusinessDate(timestamp: Date): Date {
  const shifted = new Date(timestamp.getTime() + WITA_OFFSET_MS);
  return new Date(
    Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate()),
  );
}

/** Today's business date (the current WITA calendar day) as a date-only value. */
export function businessToday(): Date {
  return toBusinessDate(new Date());
}

/** Render a date-only value as `YYYY-MM-DD` (UTC). */
export function formatDateOnly(d: Date): string {
  return toDateOnly(d).toISOString().slice(0, 10);
}
