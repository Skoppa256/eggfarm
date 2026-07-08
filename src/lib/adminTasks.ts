// Derives a kandang's per-day task completion from ALREADY-FETCHED records.
// Pure (no DB, no server imports) so it is unit-tested directly; the Tugas Hari Ini
// board fetches collections/gradings/daily-record and passes the derived shape in.
// This reads existing data only — it never writes and adds no completion table.

/** done = finished · pending = needs action · na = not applicable yet (blocked upstream). */
export type ItemState = "done" | "pending" | "na";

export type BatchStatus = {
  batch: number;
  /** done once a collection exists for the batch; otherwise pending. */
  collection: ItemState;
  /** done once grading is SUBMITTED; pending once collected-but-not-submitted; na before collection. */
  grading: ItemState;
};

export type KandangDayStatus = {
  batches: BatchStatus[];
  /** done once a daily record exists for the kandang/day; otherwise pending. */
  daily: ItemState;
  /** every applicable item (collection + grading + daily) is done. */
  allDone: boolean;
  /** number of items still needing action — drives the card badge. */
  pendingCount: number;
};

export type KandangDayInput = {
  /** Effective max batches for the day (0 when the kandang has no batch config). */
  maxBatches: number;
  /** Batch numbers that already have a collection record. */
  collectedBatches: Iterable<number>;
  /** Batch numbers whose grading is SUBMITTED (a DRAFT still counts as pending). */
  submittedBatches: Iterable<number>;
  /** Whether the kandang has a daily record for the day. */
  hasDailyRecord: boolean;
};

/**
 * Per-item, per-batch completion for one kandang on one business day.
 * Grading is `na` until the batch is collected (so each batch surfaces exactly one
 * next action — collect, then grade — keeping the checklist low-decision).
 */
export function computeKandangDayStatus(input: KandangDayInput): KandangDayStatus {
  const collected = new Set(input.collectedBatches);
  const submitted = new Set(input.submittedBatches);

  const batches: BatchStatus[] = [];
  let pendingCount = 0;

  const max = Math.max(0, Math.floor(input.maxBatches));
  for (let batch = 1; batch <= max; batch++) {
    const isCollected = collected.has(batch);
    const collection: ItemState = isCollected ? "done" : "pending";
    const grading: ItemState = !isCollected ? "na" : submitted.has(batch) ? "done" : "pending";
    if (collection === "pending") pendingCount++;
    if (grading === "pending") pendingCount++;
    batches.push({ batch, collection, grading });
  }

  const daily: ItemState = input.hasDailyRecord ? "done" : "pending";
  if (daily === "pending") pendingCount++;

  return { batches, daily, allDone: pendingCount === 0, pendingCount };
}
