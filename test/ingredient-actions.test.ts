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
import { createIngredientAction, deliverIngredientAction } from "@/app/(app)/ingredients/actions";
import { createSession } from "@/lib/server/auth";
import { prisma } from "@/lib/server/db";
import { getIngredientStock } from "@/lib/server/ingredientLedger";
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

function form(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [key, value] of Object.entries(fields)) fd.set(key, value);
  return fd;
}

describe("ingredient master + delivery actions (rule 5.5)", () => {
  it("rejects a non-Superadmin (ADMIN) on createIngredient (master is Superadmin-only)", async () => {
    await loginAs(Role.ADMIN);
    await expect(
      createIngredientAction(null, form({ name: "DKLS-36", category: IngredientCategory.KONSENTRAT })),
    ).rejects.toBeInstanceOf(ForbiddenError);
    expect(await prisma.ingredient.count()).toBe(0);
  });

  it("lets a SUPERADMIN add an ingredient", async () => {
    await loginAs(Role.SUPERADMIN);
    const result = await createIngredientAction(
      null,
      form({ name: "DKLS-36", category: IngredientCategory.KONSENTRAT, baseUnit: "kg", sortOrder: "1" }),
    );
    expect(result.ok).toBe(true);
    expect(await prisma.ingredient.count()).toBe(1);
  });

  it("rejects OWNER on a delivery; lets an ADMIN deliver (stock increases)", async () => {
    const ing = await prisma.ingredient.create({
      data: { name: "Jagung", category: IngredientCategory.GRAIN },
    });

    await loginAs(Role.OWNER);
    await expect(
      deliverIngredientAction(null, form({ ingredientId: ing.id, quantity: "100", date: "2026-07-05" })),
    ).rejects.toBeInstanceOf(ForbiddenError);

    await loginAs(Role.ADMIN);
    const result = await deliverIngredientAction(
      null,
      form({ ingredientId: ing.id, quantity: "800.5", date: "2026-07-05" }),
    );
    expect(result.ok).toBe(true);
    const stock = (await getIngredientStock()).find((s) => s.ingredientId === ing.id);
    expect(stock?.currentQuantity.toNumber()).toBe(800.5);
  });
});
