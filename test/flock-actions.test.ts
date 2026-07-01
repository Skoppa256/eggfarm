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
import { createFlockAction, endPlacementAction } from "@/app/(app)/flocks/actions";
import { createSession } from "@/lib/server/auth";
import { prisma } from "@/lib/server/db";
import { hashPassword } from "@/lib/server/password";

import { resetDb } from "./helpers";

beforeEach(async () => {
  cookieJar.clear();
  await resetDb();
});

async function loginAs(role: Role) {
  const user = await prisma.user.create({
    data: { name: role, username: role.toLowerCase(), passwordHash: await hashPassword("pw12345678"), role },
  });
  await createSession(user.id);
  return user;
}

async function freeKandang() {
  const k = await prisma.farmhouse.create({ data: { name: "K1", code: "K1" } });
  return k.id;
}

function form(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [key, value] of Object.entries(fields)) fd.set(key, value);
  return fd;
}

describe("flock actions (rule 5.5 — Superadmin only)", () => {
  it("rejects a non-Superadmin (ADMIN) on createFlock", async () => {
    const k1 = await freeKandang();
    await loginAs(Role.ADMIN);
    await expect(
      createFlockAction(
        null,
        form({
          strain: "A",
          chickInDate: "2026-07-01",
          placementAge: "100",
          placementCount: "1",
          "placement.0.farmhouseId": k1,
          "placement.0.populasiAwal": "500",
        }),
      ),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("rejects a non-Superadmin (ADMIN) on endPlacement", async () => {
    await loginAs(Role.ADMIN);
    await expect(
      endPlacementAction(null, form({ placementId: "anything", endDate: "2026-08-01" })),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("lets a SUPERADMIN chick-in (creates flock + placement + seed HIDUP)", async () => {
    const k1 = await freeKandang();
    await loginAs(Role.SUPERADMIN);
    // On success the action redirects (throws NEXT_REDIRECT) — swallow it, check effects.
    await createFlockAction(
      null,
      form({
        strain: "Lohmann",
        chickInDate: "2026-07-01",
        placementAge: "113",
        placementCount: "1",
        "placement.0.farmhouseId": k1,
        "placement.0.populasiAwal": "1000",
      }),
    ).catch(() => {});

    expect(await prisma.flock.count()).toBe(1);
    expect(await prisma.placement.count()).toBe(1);
    expect(await prisma.hidupSnapshot.count()).toBe(1);
  });
});
