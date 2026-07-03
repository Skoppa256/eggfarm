import { beforeEach, describe, expect, it, vi } from "vitest";

const { cookieJar } = vi.hoisted(() => ({ cookieJar: new Map<string, string>() }));

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => {
      const value = cookieJar.get(name);
      return value ? { name, value } : undefined;
    },
    set: (name: string, value: string) => {
      cookieJar.set(name, value);
    },
    delete: (name: string) => {
      cookieJar.delete(name);
    },
  }),
}));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));

import { Role } from "@/generated/prisma/enums";
import { ForbiddenError } from "@/lib/errors";
import { createDailyRecordAction } from "@/app/(app)/daily/actions";
import { createSession } from "@/lib/server/auth";
import { prisma } from "@/lib/server/db";
import { createFarmhouse } from "@/lib/server/farmhouses";
import { createFlock } from "@/lib/server/flocks";
import { hashPassword } from "@/lib/server/password";

import { resetDb } from "./helpers";

beforeEach(async () => {
  cookieJar.clear();
  await resetDb();
});

const CHICK_IN = new Date("2026-07-01T00:00:00Z");

async function loginAs(role: Role) {
  const user = await prisma.user.create({
    data: { name: role, username: role.toLowerCase(), passwordHash: await hashPassword("pw12345678"), role },
  });
  await createSession(user.id);
  return user;
}

async function setupPlacement(userId: string) {
  const wh = await prisma.warehouse.create({ data: { name: "A", code: "WH-A" } });
  const farmhouse = await createFarmhouse({
    name: "K1",
    code: "K1",
    warehouseId: wh.id,
    maxBatchesPerDay: 2,
    changedById: userId,
    today: CHICK_IN,
  });
  await createFlock(
    { strain: "L", chickInDate: CHICK_IN, placementAge: 100, placements: [{ farmhouseId: farmhouse.id, populasiAwal: 1000 }] },
    { userId },
  );
  return farmhouse.id;
}

function form(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [key, value] of Object.entries(fields)) fd.set(key, value);
  return fd;
}

describe("daily record actions (rule 5.5)", () => {
  it("rejects OWNER (read-only) on createDailyRecord", async () => {
    await loginAs(Role.OWNER);
    await expect(
      createDailyRecordAction(
        null,
        form({ farmhouseId: "x", date: "2026-07-02", mati: "0", afkir: "0", sisaDigunakan: "0", sisaDibuang: "0", beratTelur: "0" }),
      ),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("lets an ADMIN record the day (creates one DailyRecord)", async () => {
    const admin = await loginAs(Role.ADMIN);
    const farmhouseId = await setupPlacement(admin.id);

    const result = await createDailyRecordAction(
      null,
      form({
        farmhouseId,
        date: "2026-07-02",
        mati: "5",
        afkir: "0",
        sisaDigunakan: "12.5",
        sisaDibuang: "0",
        beratTelur: "40",
      }),
    );
    expect(result.ok).toBe(true);
    expect(await prisma.dailyRecord.count()).toBe(1);
    const rec = await prisma.dailyRecord.findFirstOrThrow();
    expect(rec.hidup).toBe(995); // 1000 - 5
    expect(rec.sisaDigunakan.toNumber()).toBe(12.5);
  });
});
