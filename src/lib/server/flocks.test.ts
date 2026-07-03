import { beforeEach, describe, expect, it } from "vitest";

import { FlockStatus, PlacementStatus, Role } from "@/generated/prisma/enums";
import { ConflictError } from "@/lib/errors";
import { prisma } from "@/lib/server/db";
import {
  applyDailyMortality,
  correctPopulasiAwal,
  createFlock,
  endPlacement,
  resolveHidup,
} from "@/lib/server/flocks";

import { resetDb } from "../../../test/helpers";

beforeEach(resetDb);

const D = (s: string) => new Date(`${s}T00:00:00Z`);

async function setup() {
  const user = await prisma.user.create({
    data: { name: "Super", username: "super", passwordHash: "x", role: Role.SUPERADMIN },
  });
  const k1 = await prisma.farmhouse.create({ data: { name: "Kandang 1", code: "K1" } });
  const k2 = await prisma.farmhouse.create({ data: { name: "Kandang 2", code: "K2" } });
  return { userId: user.id, k1: k1.id, k2: k2.id };
}

describe("flock chick-in — spanning multiple kandang", () => {
  it("creates a placement + seeds HIDUP (= Populasi Awal) per kandang", async () => {
    const f = await setup();
    const flock = await createFlock(
      {
        strain: "Lohmann",
        chickInDate: D("2026-07-01"),
        placementAge: 113,
        placements: [
          { farmhouseId: f.k1, populasiAwal: 1000 },
          { farmhouseId: f.k2, populasiAwal: 800 },
        ],
      },
      { userId: f.userId },
    );

    const placements = await prisma.placement.findMany({ where: { flockId: flock.id } });
    expect(placements).toHaveLength(2);
    const p1 = placements.find((p) => p.farmhouseId === f.k1)!;
    const p2 = placements.find((p) => p.farmhouseId === f.k2)!;

    // HIDUP seeded at chick-in = Populasi Awal, per placement.
    expect(await resolveHidup(p1.id, D("2026-07-01"))).toBe(1000);
    expect(await resolveHidup(p2.id, D("2026-07-01"))).toBe(800);
    // Stays at the seed with no mortality; null before chick-in.
    expect(await resolveHidup(p1.id, D("2026-07-10"))).toBe(1000);
    expect(await resolveHidup(p1.id, D("2026-06-30"))).toBeNull();
  });

  it("rejects placing into an occupied kandang", async () => {
    const f = await setup();
    await createFlock(
      { strain: "A", chickInDate: D("2026-07-01"), placementAge: 100, placements: [{ farmhouseId: f.k1, populasiAwal: 500 }] },
      { userId: f.userId },
    );
    await expect(
      createFlock(
        { strain: "B", chickInDate: D("2026-07-02"), placementAge: 100, placements: [{ farmhouseId: f.k1, populasiAwal: 400 }] },
        { userId: f.userId },
      ),
    ).rejects.toBeInstanceOf(ConflictError);
    expect(await prisma.flock.count()).toBe(1);
  });
});

describe("HIDUP carry-forward (MATI/AFKIR)", () => {
  it("running HIDUP = previous − MATI − AFKIR, persisted per day; write-once", async () => {
    const f = await setup();
    const flock = await createFlock(
      { strain: "A", chickInDate: D("2026-07-01"), placementAge: 100, placements: [{ farmhouseId: f.k1, populasiAwal: 1000 }] },
      { userId: f.userId },
    );
    const p = (await prisma.placement.findFirstOrThrow({ where: { flockId: flock.id } })).id;

    await applyDailyMortality(p, D("2026-07-02"), 5, 2); // 1000 - 7 = 993
    expect(await resolveHidup(p, D("2026-07-02"))).toBe(993);

    await applyDailyMortality(p, D("2026-07-03"), 3, 0); // 993 - 3 = 990
    expect(await resolveHidup(p, D("2026-07-03"))).toBe(990);
    expect(await resolveHidup(p, D("2026-07-01"))).toBe(1000); // chick-in day unchanged

    // A gap carries the last HIDUP forward.
    await applyDailyMortality(p, D("2026-07-08"), 10, 0); // 990 - 10 = 980
    expect(await resolveHidup(p, D("2026-07-08"))).toBe(980);
    expect(await resolveHidup(p, D("2026-07-05"))).toBe(990); // between day 3 and day 8

    // Write-once, and can't cull more than are alive.
    await expect(applyDailyMortality(p, D("2026-07-03"), 1, 0)).rejects.toBeInstanceOf(ConflictError);
    await expect(applyDailyMortality(p, D("2026-07-09"), 100000, 0)).rejects.toBeInstanceOf(ConflictError);
  });
});

describe("end placement — frees kandang, ends flock, retains history", () => {
  it("ends the flock only when all placements end; a freed kandang can be re-populated", async () => {
    const f = await setup();
    const flock = await createFlock(
      {
        strain: "A",
        chickInDate: D("2026-07-01"),
        placementAge: 100,
        placements: [
          { farmhouseId: f.k1, populasiAwal: 500 },
          { farmhouseId: f.k2, populasiAwal: 400 },
        ],
      },
      { userId: f.userId },
    );
    const placements = await prisma.placement.findMany({ where: { flockId: flock.id } });
    const p1 = placements.find((p) => p.farmhouseId === f.k1)!;
    const p2 = placements.find((p) => p.farmhouseId === f.k2)!;

    // End K1's placement → flock still ACTIVE (K2 remains).
    await endPlacement(p1.id, D("2026-08-01"));
    expect((await prisma.flock.findUnique({ where: { id: flock.id } }))?.status).toBe(FlockStatus.ACTIVE);

    // K1 is now free → a new flock can be placed there; prior history is intact.
    const flock2 = await createFlock(
      { strain: "B", chickInDate: D("2026-08-02"), placementAge: 90, placements: [{ farmhouseId: f.k1, populasiAwal: 600 }] },
      { userId: f.userId },
    );
    expect(flock2.id).not.toBe(flock.id);
    const p1After = await prisma.placement.findUnique({ where: { id: p1.id } });
    expect(p1After?.status).toBe(PlacementStatus.ENDED);
    expect(p1After?.endDate?.toISOString().slice(0, 10)).toBe("2026-08-01");
    expect(await resolveHidup(p1.id, D("2026-08-01"))).toBe(500); // old placement's HIDUP retained

    // End K2 → flock now ENDS; a second end is rejected.
    await endPlacement(p2.id, D("2026-08-03"));
    expect((await prisma.flock.findUnique({ where: { id: flock.id } }))?.status).toBe(FlockStatus.ENDED);
    await expect(endPlacement(p2.id, D("2026-08-03"))).rejects.toBeInstanceOf(
      ConflictError,
    );
  });
});

describe("correct Populasi Awal — narrow chick-in-typo escape hatch (A20/A23)", () => {
  it("re-bases the whole HIDUP history by the delta, seed and forward", async () => {
    const f = await setup();
    const flock = await createFlock(
      { strain: "A", chickInDate: D("2026-07-01"), placementAge: 100, placements: [{ farmhouseId: f.k1, populasiAwal: 1000 }] },
      { userId: f.userId },
    );
    const p = (await prisma.placement.findFirstOrThrow({ where: { flockId: flock.id } })).id;
    await applyDailyMortality(p, D("2026-07-02"), 5, 2); // 1000 - 7 = 993
    await applyDailyMortality(p, D("2026-07-03"), 3, 0); // 993 - 3 = 990

    // Typo: it was really 1010, not 1000 (+10 to every day).
    await correctPopulasiAwal(p, 1010);
    expect((await prisma.placement.findUnique({ where: { id: p } }))?.populasiAwal).toBe(1010);
    expect(await resolveHidup(p, D("2026-07-01"))).toBe(1010); // seed
    expect(await resolveHidup(p, D("2026-07-02"))).toBe(1003); // 1010 - 7
    expect(await resolveHidup(p, D("2026-07-03"))).toBe(1000); // 1010 - 10

    // MATI/AFKIR are untouched by the re-base.
    const day2 = await prisma.hidupSnapshot.findFirstOrThrow({ where: { placementId: p, date: D("2026-07-02") } });
    expect([day2.mati, day2.afkir]).toEqual([5, 2]);
  });

  it("rejects a correction that would drive a later HIDUP below zero, and a no-op", async () => {
    const f = await setup();
    const flock = await createFlock(
      { strain: "A", chickInDate: D("2026-07-01"), placementAge: 100, placements: [{ farmhouseId: f.k1, populasiAwal: 100 }] },
      { userId: f.userId },
    );
    const p = (await prisma.placement.findFirstOrThrow({ where: { flockId: flock.id } })).id;
    await applyDailyMortality(p, D("2026-07-02"), 90, 0); // 100 - 90 = 10

    // Lowering Populasi Awal to 80 would make day-2 HIDUP = -10.
    await expect(correctPopulasiAwal(p, 80)).rejects.toBeInstanceOf(ConflictError);
    await expect(correctPopulasiAwal(p, 100)).rejects.toBeInstanceOf(ConflictError); // no-op
    expect((await prisma.placement.findUnique({ where: { id: p } }))?.populasiAwal).toBe(100);
    expect(await resolveHidup(p, D("2026-07-02"))).toBe(10); // unchanged
  });
});

describe("one ACTIVE placement per kandang — DB partial unique index (A23)", () => {
  it("rejects a second ACTIVE placement inserted directly for the same kandang", async () => {
    const f = await setup();
    const flock = await createFlock(
      { strain: "A", chickInDate: D("2026-07-01"), placementAge: 100, placements: [{ farmhouseId: f.k1, populasiAwal: 500 }] },
      { userId: f.userId },
    );
    // Bypass the service check — the partial unique index must still stop it.
    await expect(
      prisma.placement.create({
        data: { flockId: flock.id, farmhouseId: f.k1, populasiAwal: 400, startDate: D("2026-07-02") },
      }),
    ).rejects.toThrow();
  });
});
