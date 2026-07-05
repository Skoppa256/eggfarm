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

import { IngredientCategory, Role } from "@/generated/prisma/enums";
import { ForbiddenError } from "@/lib/errors";
import { createMixingAction } from "@/app/(app)/mixing/actions";
import { createSession } from "@/lib/server/auth";
import { prisma } from "@/lib/server/db";
import { createFarmhouse } from "@/lib/server/farmhouses";
import { createFlock } from "@/lib/server/flocks";
import { recordDelivery } from "@/lib/server/ingredientLedger";
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

function form(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [key, value] of Object.entries(fields)) fd.set(key, value);
  return fd;
}

describe("mixing action (rule 5.5)", () => {
  it("rejects OWNER (read-only) on createMixing", async () => {
    await loginAs(Role.OWNER);
    await expect(
      createMixingAction(
        null,
        form({ farmhouseId: "x", date: "2026-07-01", projectedIntake: "118", lineCount: "1" }),
      ),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("lets an ADMIN confirm a mix (draws stock, posts MASUK)", async () => {
    const admin = await loginAs(Role.ADMIN);
    const wh = await prisma.warehouse.create({ data: { name: "A", code: "WH-A" } });
    const farmhouse = await createFarmhouse({
      name: "K1",
      code: "K1",
      warehouseId: wh.id,
      maxBatchesPerDay: 2,
      changedById: admin.id,
      today: CHICK_IN,
    });
    await createFlock(
      { strain: "L", chickInDate: CHICK_IN, placementAge: 100, placements: [{ farmhouseId: farmhouse.id, populasiAwal: 3377 }] },
      { userId: admin.id },
    );
    const konsentrat = await prisma.ingredient.create({
      data: { name: "DKLS-36", category: IngredientCategory.KONSENTRAT },
    });
    await recordDelivery({ ingredientId: konsentrat.id, quantity: 500, enteredById: admin.id });

    const result = await createMixingAction(
      null,
      form({
        farmhouseId: farmhouse.id,
        date: "2026-07-01",
        projectedIntake: "118",
        lineCount: "1",
        "line.0.ingredientId": konsentrat.id,
        "line.0.kind": "MAIN_PERCENT",
        "line.0.percent": "100",
      }),
    );
    expect(result.ok).toBe(true);
    const mix = await prisma.mixingRecord.findFirstOrThrow();
    expect(mix.totalCampur.toNumber()).toBe(398.486);
  });
});
