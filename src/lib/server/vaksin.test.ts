import { beforeEach, describe, expect, it } from "vitest";

import { RecordStatus, Role } from "@/generated/prisma/enums";
import { ConflictError } from "@/lib/errors";
import { prisma } from "@/lib/server/db";
import { createVaksinLog, listVaksinLogs, vaksinForDailyRecord } from "@/lib/server/vaksin";
import { setVaksinTypeStatus } from "@/lib/server/vaksinTypes";

import { resetDb } from "../../../test/helpers";

beforeEach(resetDb);

const D = (s: string) => new Date(`${s}T00:00:00Z`);

async function setup() {
  const user = await prisma.user.create({
    data: { name: "Admin", username: "admin", passwordHash: "x", role: Role.ADMIN },
  });
  const k1 = await prisma.farmhouse.create({ data: { name: "K1", code: "K1" } });
  const k2 = await prisma.farmhouse.create({ data: { name: "K2", code: "K2" } });
  const nd = await prisma.vaksinType.create({ data: { name: "ND-IB", sortOrder: 1 } });
  const gumboro = await prisma.vaksinType.create({ data: { name: "Gumboro", sortOrder: 2 } });
  return { userId: user.id, k1: k1.id, k2: k2.id, nd: nd.id, gumboro: gumboro.id };
}

const log = (s: Awaited<ReturnType<typeof setup>>, over: Partial<Parameters<typeof createVaksinLog>[0]> = {}) =>
  createVaksinLog(
    { date: D("2026-07-06"), vaksinTypeId: s.nd, farmhouseId: s.k1, vials: 2, vaccinator: "Budi", ...over },
    { userId: s.userId },
  );

describe("vaksin — daily VAKSIN field derives from the log (FR-101)", () => {
  it("a logged vaccination surfaces on the matching kandang/date, not others (no re-entry)", async () => {
    const s = await setup();
    await log(s);

    const onK1 = await vaksinForDailyRecord(s.k1, D("2026-07-06"));
    expect(onK1).toHaveLength(1);
    expect(onK1[0]).toMatchObject({ vials: 2, vaccinator: "Budi" });
    expect(onK1[0].vaksinType.name).toBe("ND-IB");

    // Pure derivation: a different kandang or date shows nothing.
    expect(await vaksinForDailyRecord(s.k2, D("2026-07-06"))).toHaveLength(0);
    expect(await vaksinForDailyRecord(s.k1, D("2026-07-07"))).toHaveLength(0);
  });
});

describe("vaksin type deactivation (soft-delete)", () => {
  it("excludes a deactivated type from new logs but keeps its history intact", async () => {
    const s = await setup();
    await log(s); // 2026-07-06 with ND-IB

    await setVaksinTypeStatus(s.nd, RecordStatus.INACTIVE);
    // A new log with the now-inactive type is rejected.
    await expect(log(s, { date: D("2026-07-07") })).rejects.toBeInstanceOf(ConflictError);
    // The earlier log is retained and still surfaces on its daily record.
    expect(await vaksinForDailyRecord(s.k1, D("2026-07-06"))).toHaveLength(1);
    expect(await listVaksinLogs()).toHaveLength(1);
  });
});

describe("vaksin log filters (FR-102) + validation", () => {
  it("filters by kandang, type, vaccinator (case-insensitive), and date range", async () => {
    const s = await setup();
    await log(s, { date: D("2026-07-05"), vials: 1 });
    await log(s, { date: D("2026-07-06"), vaksinTypeId: s.gumboro, farmhouseId: s.k2, vials: 3, vaccinator: "Sari" });
    await log(s, { date: D("2026-07-10") });

    expect(await listVaksinLogs()).toHaveLength(3);
    expect(await listVaksinLogs({ farmhouseId: s.k2 })).toHaveLength(1);
    expect(await listVaksinLogs({ vaksinTypeId: s.nd })).toHaveLength(2);
    expect(await listVaksinLogs({ vaccinator: "sari" })).toHaveLength(1);
    expect(await listVaksinLogs({ from: D("2026-07-06"), to: D("2026-07-08") })).toHaveLength(1);
  });

  it("rejects fewer than 1 vial and an empty vaccinator", async () => {
    const s = await setup();
    await expect(log(s, { vials: 0 })).rejects.toBeInstanceOf(ConflictError);
    await expect(log(s, { vaccinator: "  " })).rejects.toBeInstanceOf(ConflictError);
  });
});
