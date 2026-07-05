import { daysBetween } from "@/lib/dates";

// Flock-age derivations (SRS §3.9 / CLAUDE.md §6). Pure and shared (client + server).
// HARI and MINGGU are flock-level (shared across all of a flock's placements); HIDUP
// is per-placement and lives in the HIDUP snapshot ledger (see flocks.ts).

/**
 * Flock age in days on a business date: the placement age at chick-in plus the days
 * elapsed since the chick-in date. Both dates are business dates (WITA, date-only).
 */
export function computeHari(placementAge: number, chickInDate: Date, asOf: Date): number {
  return placementAge + daysBetween(chickInDate, asOf);
}

/**
 * Flock age in weeks = ceil(HARI / 7). The farm counts by bird age, so day-120 falls in
 * week 18 and day-119 (an exact multiple of 7) is week 17 (SRS §3.9, confirmed).
 */
export function computeMinggu(hari: number): number {
  return Math.ceil(hari / 7);
}
