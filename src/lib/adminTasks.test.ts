import { describe, expect, it } from "vitest";

import { computeKandangDayStatus } from "./adminTasks";

describe("computeKandangDayStatus", () => {
  it("worked example: batch1 collected+graded, batch2 collected-not-graded, no daily record", () => {
    const s = computeKandangDayStatus({
      maxBatches: 2,
      collectedBatches: [1, 2],
      submittedBatches: [1],
      hasDailyRecord: false,
    });

    expect(s.batches).toEqual([
      { batch: 1, collection: "done", grading: "done" },
      { batch: 2, collection: "done", grading: "pending" },
    ]);
    expect(s.daily).toBe("pending");
    expect(s.pendingCount).toBe(2); // batch2 grading + daily
    expect(s.allDone).toBe(false);
  });

  it("grading is na until the batch is collected", () => {
    const s = computeKandangDayStatus({
      maxBatches: 2,
      collectedBatches: [1],
      submittedBatches: [],
      hasDailyRecord: false,
    });
    // batch1: collected but not submitted -> grading pending
    expect(s.batches[0]).toEqual({ batch: 1, collection: "done", grading: "pending" });
    // batch2: not collected -> collection pending, grading na (not counted twice)
    expect(s.batches[1]).toEqual({ batch: 2, collection: "pending", grading: "na" });
    expect(s.pendingCount).toBe(3); // b1 grading + b2 collection + daily
  });

  it("everything done -> allDone with zero pending", () => {
    const s = computeKandangDayStatus({
      maxBatches: 2,
      collectedBatches: [1, 2],
      submittedBatches: [1, 2],
      hasDailyRecord: true,
    });
    expect(s.allDone).toBe(true);
    expect(s.pendingCount).toBe(0);
    expect(s.daily).toBe("done");
  });

  it("nothing done -> all collection pending, grading na, daily pending", () => {
    const s = computeKandangDayStatus({
      maxBatches: 3,
      collectedBatches: [],
      submittedBatches: [],
      hasDailyRecord: false,
    });
    expect(s.batches.every((b) => b.collection === "pending" && b.grading === "na")).toBe(true);
    expect(s.daily).toBe("pending");
    expect(s.pendingCount).toBe(4); // 3 collections + daily (grading na is not pending)
    expect(s.allDone).toBe(false);
  });

  it("no batch config (maxBatches 0) -> only the daily record applies", () => {
    const s = computeKandangDayStatus({
      maxBatches: 0,
      collectedBatches: [],
      submittedBatches: [],
      hasDailyRecord: true,
    });
    expect(s.batches).toEqual([]);
    expect(s.allDone).toBe(true);
    expect(s.pendingCount).toBe(0);
  });
});
