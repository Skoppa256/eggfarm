// Egg quantity units (CLAUDE.md §6 "Units").
//
// Rule: store every egg quantity in pcs as an integer — NEVER store rak.
// 1 rak = 30 pcs. This module is the single shared (client + server) place that
// converts between rak and pcs and renders the canonical "X rak + Y pcs" display.

/** Pieces in one rak. */
export const PCS_PER_RAK = 30;

function assertInteger(value: number, label: string): void {
  if (!Number.isInteger(value)) {
    throw new Error(`${label} must be an integer, got ${value}`);
  }
}

/**
 * Convert an entry given as rak (+ optional loose pcs) into a pcs total.
 * Entry accepts rak or pcs; everything is stored in pcs (CLAUDE.md §6).
 */
export function rakToPcs(rak: number, loosePcs = 0): number {
  assertInteger(rak, "rak");
  assertInteger(loosePcs, "loosePcs");
  return rak * PCS_PER_RAK + loosePcs;
}

/** Split a pcs total into whole rak and the leftover loose pcs. */
export function pcsToRak(pcs: number): { rak: number; pcs: number } {
  assertInteger(pcs, "pcs");
  const sign = pcs < 0 ? -1 : 1;
  const abs = Math.abs(pcs);
  return { rak: sign * Math.floor(abs / PCS_PER_RAK), pcs: sign * (abs % PCS_PER_RAK) };
}

/**
 * Render a pcs total as the canonical display string, e.g. 2617 -> "87 rak + 7 pcs".
 * Apply everywhere egg quantities are shown.
 */
export function formatPcs(pcs: number): string {
  assertInteger(pcs, "pcs");
  if (pcs < 0) return `-${formatPcs(-pcs)}`;
  const { rak, pcs: loose } = pcsToRak(pcs);
  return `${rak} rak + ${loose} pcs`;
}
