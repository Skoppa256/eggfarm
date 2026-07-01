import "server-only";

import { FlockStatus, PlacementStatus, RecordStatus } from "@/generated/prisma/enums";
import { toBusinessDate } from "@/lib/dates";
import { ConflictError, NotFoundError } from "@/lib/errors";
import { prisma, TX_OPTIONS } from "@/lib/server/db";

// Flock & placement lifecycle (SRS §3.9). Flock create/end are Superadmin-gated at
// the action layer. HIDUP is a per-placement running value, persisted as a write-once
// snapshot per placement-day (CLAUDE.md §5.3), seeded at chick-in.

export interface PlacementInput {
  farmhouseId: string;
  populasiAwal: number;
}

export interface FlockInput {
  strain: string;
  chickInDate: Date; // business date
  placementAge: number; // days at chick-in
  placements: PlacementInput[];
}

interface Ctx {
  userId: string;
}

export function listFlocks() {
  return prisma.flock.findMany({
    orderBy: [{ status: "asc" }, { chickInDate: "desc" }],
    include: { placements: { include: { farmhouse: true }, orderBy: { createdAt: "asc" } } },
  });
}

/** Active kandang with no ACTIVE placement — the only valid chick-in targets. */
export async function listFreeFarmhouses() {
  const [farmhouses, activePlacements] = await Promise.all([
    prisma.farmhouse.findMany({ where: { status: RecordStatus.ACTIVE }, orderBy: { code: "asc" } }),
    prisma.placement.findMany({ where: { status: PlacementStatus.ACTIVE }, select: { farmhouseId: true } }),
  ]);
  const occupied = new Set(activePlacements.map((p) => p.farmhouseId));
  return farmhouses.filter((f) => !occupied.has(f.id));
}

export function getFlock(id: string) {
  return prisma.flock.findUnique({
    where: { id },
    include: {
      placements: { include: { farmhouse: true }, orderBy: { createdAt: "asc" } },
      createdBy: { select: { name: true } },
    },
  });
}

/**
 * Create a flock and its placements — one per kandang, each with its own Populasi
 * Awal — seeding a HIDUP snapshot of Populasi Awal on the chick-in date. Rejects an
 * occupied kandang (one ACTIVE placement per kandang) and an inactive/unknown one.
 */
export async function createFlock(input: FlockInput, ctx: Ctx) {
  const chickInDate = toBusinessDate(input.chickInDate);

  if (!Number.isInteger(input.placementAge) || input.placementAge < 0) {
    throw new ConflictError("Placement age must be a non-negative whole number of days.");
  }
  if (input.placements.length === 0) {
    throw new ConflictError("Assign the flock to at least one kandang.");
  }
  const seen = new Set<string>();
  for (const p of input.placements) {
    if (!Number.isInteger(p.populasiAwal) || p.populasiAwal <= 0) {
      throw new ConflictError("Each placement needs a positive Populasi Awal.");
    }
    if (seen.has(p.farmhouseId)) {
      throw new ConflictError("A kandang appears more than once in this chick-in.");
    }
    seen.add(p.farmhouseId);
  }

  for (const p of input.placements) {
    const farmhouse = await prisma.farmhouse.findUnique({ where: { id: p.farmhouseId } });
    if (!farmhouse) {
      throw new NotFoundError("Kandang not found.");
    }
    if (farmhouse.status !== RecordStatus.ACTIVE) {
      throw new ConflictError(`Kandang ${farmhouse.code} is not active.`);
    }
  }

  return prisma.$transaction(async (tx) => {
    // One ACTIVE placement per kandang (SRS FR). Checked inside the transaction.
    for (const p of input.placements) {
      const occupied = await tx.placement.findFirst({
        where: { farmhouseId: p.farmhouseId, status: PlacementStatus.ACTIVE },
        select: { id: true, farmhouse: { select: { code: true } } },
      });
      if (occupied) {
        throw new ConflictError(
          `Kandang ${occupied.farmhouse.code} already has an active placement.`,
        );
      }
    }

    const flock = await tx.flock.create({
      data: {
        strain: input.strain,
        chickInDate,
        placementAge: input.placementAge,
        status: FlockStatus.ACTIVE,
        createdById: ctx.userId,
      },
    });

    for (const p of input.placements) {
      const placement = await tx.placement.create({
        data: {
          flockId: flock.id,
          farmhouseId: p.farmhouseId,
          populasiAwal: p.populasiAwal,
          startDate: chickInDate,
          status: PlacementStatus.ACTIVE,
        },
      });
      // Seed HIDUP = Populasi Awal on the chick-in date (write-once).
      await tx.hidupSnapshot.create({
        data: { placementId: placement.id, date: chickInDate, mati: 0, afkir: 0, hidup: p.populasiAwal },
      });
    }

    return flock;
  }, TX_OPTIONS);
}

/**
 * End a placement (fully culled/sold), setting its end date and freeing the kandang.
 * When a flock's last active placement ends, the flock ends too. Idempotent via an
 * atomic ACTIVE-guarded update.
 */
export async function endPlacement(placementId: string, endDate: Date) {
  const placement = await prisma.placement.findUnique({ where: { id: placementId } });
  if (!placement) {
    throw new NotFoundError("Placement not found.");
  }
  if (placement.status === PlacementStatus.ENDED) {
    throw new ConflictError("This placement has already ended.");
  }
  const end = toBusinessDate(endDate);
  if (end.getTime() < toBusinessDate(placement.startDate).getTime()) {
    throw new ConflictError("End date cannot be before the chick-in date.");
  }

  return prisma.$transaction(async (tx) => {
    const claimed = await tx.placement.updateMany({
      where: { id: placementId, status: PlacementStatus.ACTIVE },
      data: { status: PlacementStatus.ENDED, endDate: end },
    });
    if (claimed.count === 0) {
      throw new ConflictError("This placement has already ended.");
    }
    const stillActive = await tx.placement.count({
      where: { flockId: placement.flockId, status: PlacementStatus.ACTIVE },
    });
    if (stillActive === 0) {
      await tx.flock.update({ where: { id: placement.flockId }, data: { status: FlockStatus.ENDED } });
    }
    return tx.placement.findUnique({
      where: { id: placementId },
      include: { flock: true, farmhouse: true },
    });
  }, TX_OPTIONS);
}

/**
 * The running HIDUP for a placement at the end of `asOf`: the latest snapshot with
 * date ≤ asOf. Reads a persisted snapshot — never recomputed from birth. null if the
 * placement had not been chicked-in by then.
 */
export async function resolveHidup(placementId: string, asOf: Date): Promise<number | null> {
  const snapshot = await prisma.hidupSnapshot.findFirst({
    where: { placementId, date: { lte: toBusinessDate(asOf) } },
    orderBy: { date: "desc" },
    select: { hidup: true },
  });
  return snapshot?.hidup ?? null;
}

/**
 * Apply a day's MATI/AFKIR and persist the resulting HIDUP snapshot (write-once).
 * new HIDUP = the HIDUP entering the day (latest snapshot strictly BEFORE `date`) −
 * MATI − AFKIR. Rejects going below zero or overwriting an existing snapshot. Daily
 * MATI/AFKIR entry (the daily record) is Slice 9; this is the helper it builds on.
 */
export async function applyDailyMortality(
  placementId: string,
  date: Date,
  mati: number,
  afkir: number,
) {
  if (!Number.isInteger(mati) || mati < 0 || !Number.isInteger(afkir) || afkir < 0) {
    throw new ConflictError("MATI and AFKIR must be non-negative whole numbers.");
  }
  const on = toBusinessDate(date);

  const entering = await prisma.hidupSnapshot.findFirst({
    where: { placementId, date: { lt: on } },
    orderBy: { date: "desc" },
    select: { hidup: true },
  });
  if (!entering) {
    throw new ConflictError("No prior HIDUP — the placement has no chick-in before this date.");
  }
  const hidup = entering.hidup - mati - afkir;
  if (hidup < 0) {
    throw new ConflictError("MATI + AFKIR exceed the live-hen count.");
  }

  const existing = await prisma.hidupSnapshot.findUnique({
    where: { placementId_date: { placementId, date: on } },
  });
  if (existing) {
    throw new ConflictError("A HIDUP snapshot for this placement-day already exists (write-once).");
  }

  return prisma.hidupSnapshot.create({ data: { placementId, date: on, mati, afkir, hidup } });
}
