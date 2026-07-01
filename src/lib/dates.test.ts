import { describe, expect, it } from "vitest";

import { addDays, formatDateOnly, toDateOnly } from "@/lib/dates";

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
