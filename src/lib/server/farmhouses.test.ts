import { beforeEach, describe, expect, it } from "vitest";

import { RecordStatus, Role } from "@/generated/prisma/enums";
import { ConflictError } from "@/lib/errors";
import { prisma } from "@/lib/server/db";
import {
  changeMaxBatches,
  changeWarehouseMapping,
  createFarmhouse,
  resolveMaxBatches,
  resolveWarehouseId,
} from "@/lib/server/farmhouses";

import { resetDb } from "../../../test/helpers";

beforeEach(resetDb);

/** A UTC date-only for a `YYYY-MM-DD` string. */
const D = (s: string) => new Date(`${s}T00:00:00Z`);

async function baseFixtures() {
  const user = await prisma.user.create({
    data: { name: "Admin", username: "admin", passwordHash: "x", role: Role.ADMIN },
  });
  const whA = await prisma.warehouse.create({ data: { name: "A", code: "WH-A" } });
  const whB = await prisma.warehouse.create({ data: { name: "B", code: "WH-B" } });
  return { userId: user.id, whA: whA.id, whB: whB.id };
}

// Worked example: kandang K1 is mapped to warehouse A from 2026-07-01, then re-mapped
// to warehouse B effective 2026-07-05.
describe("farmhouse warehouse mapping — as-of-date resolution", () => {
  it("resolves the mapping in force as of a given date", async () => {
    const { userId, whA, whB } = await baseFixtures();
    const f = await createFarmhouse({
      name: "Kandang 1",
      code: "K1",
      warehouseId: whA,
      maxBatchesPerDay: 2,
      changedById: userId,
      today: D("2026-07-01"),
    });
    await changeWarehouseMapping({
      farmhouseId: f.id,
      warehouseId: whB,
      changedById: userId,
      effectiveFrom: D("2026-07-05"),
    });

    expect(await resolveWarehouseId(f.id, D("2026-06-30"))).toBeNull(); // before it existed
    expect(await resolveWarehouseId(f.id, D("2026-07-01"))).toBe(whA);
    expect(await resolveWarehouseId(f.id, D("2026-07-04"))).toBe(whA); // day before the change
    expect(await resolveWarehouseId(f.id, D("2026-07-05"))).toBe(whB); // on the effective date
    expect(await resolveWarehouseId(f.id, D("2026-07-10"))).toBe(whB); // after
  });
});

// Worked example: K1 starts at 2 batches/day on 2026-07-10; a change to 3 made that
// same day must take effect on 2026-07-11, not 2026-07-10 (SRS FR-41).
describe("farmhouse batch count — takes effect the next day", () => {
  it("a change on day D applies from D+1, leaving D unchanged", async () => {
    const { userId, whA } = await baseFixtures();
    const f = await createFarmhouse({
      name: "Kandang 1",
      code: "K1",
      warehouseId: whA,
      maxBatchesPerDay: 2,
      changedById: userId,
      today: D("2026-07-10"),
    });
    expect(await resolveMaxBatches(f.id, D("2026-07-10"))).toBe(2);

    await changeMaxBatches({
      farmhouseId: f.id,
      maxBatchesPerDay: 3,
      changedById: userId,
      today: D("2026-07-10"),
    });

    expect(await resolveMaxBatches(f.id, D("2026-07-10"))).toBe(2); // same day: unchanged
    expect(await resolveMaxBatches(f.id, D("2026-07-11"))).toBe(3); // next day: new value
  });

  it("rejects an out-of-range batch count", async () => {
    const { userId, whA } = await baseFixtures();
    const f = await createFarmhouse({
      name: "Kandang 1",
      code: "K1",
      warehouseId: whA,
      maxBatchesPerDay: 2,
      changedById: userId,
      today: D("2026-07-10"),
    });
    await expect(
      changeMaxBatches({ farmhouseId: f.id, maxBatchesPerDay: 0, changedById: userId, today: D("2026-07-10") }),
    ).rejects.toBeInstanceOf(ConflictError);
  });
});

describe("soft-delete exclusion", () => {
  it("refuses to map a farmhouse to a deactivated warehouse", async () => {
    const { userId, whA, whB } = await baseFixtures();
    const f = await createFarmhouse({
      name: "Kandang 1",
      code: "K1",
      warehouseId: whA,
      maxBatchesPerDay: 2,
      changedById: userId,
      today: D("2026-07-10"),
    });
    await prisma.warehouse.update({ where: { id: whB }, data: { status: RecordStatus.INACTIVE } });

    await expect(
      changeWarehouseMapping({
        farmhouseId: f.id,
        warehouseId: whB,
        changedById: userId,
        effectiveFrom: D("2026-07-11"),
      }),
    ).rejects.toBeInstanceOf(ConflictError);
  });
});
