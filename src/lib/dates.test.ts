import { describe, expect, it } from "vitest";

import {
  addDays,
  businessToday,
  formatDateOnly,
  toBusinessDate,
  toDateOnly,
} from "@/lib/dates";

describe("dates", () => {
  it("toDateOnly strips the time to UTC midnight", () => {
    expect(toDateOnly(new Date("2026-07-01T15:30:00Z")).toISOString()).toBe(
      "2026-07-01T00:00:00.000Z",
    );
  });

  it("addDays adds whole days and rolls over months", () => {
    expect(formatDateOnly(addDays(new Date("2026-07-01"), 1))).toBe("2026-07-02");
    expect(formatDateOnly(addDays(new Date("2026-07-31"), 1))).toBe("2026-08-01");
    expect(formatDateOnly(addDays(new Date("2026-01-01"), -1))).toBe("2025-12-31");
  });
});

describe("business day (WITA / Asia/Makassar, UTC+8, no DST)", () => {
  it("maps a UTC instant to the WITA calendar day it falls on", () => {
    // 2026-07-01T22:00:00Z is 06:00 WITA on 2026-07-02 → business date 2026-07-02.
    expect(formatDateOnly(toBusinessDate(new Date("2026-07-01T22:00:00Z")))).toBe("2026-07-02");
  });

  it("flips the business day at 00:00 WITA (16:00 UTC), not at 00:00 UTC", () => {
    // 15:59:59 UTC is 23:59:59 WITA on 2026-07-01 — still the same business day.
    expect(formatDateOnly(toBusinessDate(new Date("2026-07-01T15:59:59Z")))).toBe("2026-07-01");
    // 16:00:00 UTC is 00:00 WITA on 2026-07-02 — the next business day begins.
    expect(formatDateOnly(toBusinessDate(new Date("2026-07-01T16:00:00Z")))).toBe("2026-07-02");
  });

  it("is idempotent on a date-only value", () => {
    const d = toBusinessDate(new Date("2026-07-02T00:00:00Z"));
    expect(toBusinessDate(d).toISOString()).toBe(d.toISOString());
  });

  it("businessToday returns a UTC-midnight date-only value", () => {
    const today = businessToday();
    expect(today.getUTCHours()).toBe(0);
    expect(today.getUTCMinutes()).toBe(0);
    expect(today.getUTCSeconds()).toBe(0);
  });
});
