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
import { createFarmhouseAction } from "@/app/(app)/farmhouses/actions";
import { createUnitAction } from "@/app/(app)/units/actions";
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
    data: {
      name: role,
      username: role.toLowerCase(),
      passwordHash: await hashPassword("pw12345678"),
      role,
    },
  });
  await createSession(user.id);
  return user;
}

async function activeWarehouse() {
  const wh = await prisma.warehouse.create({ data: { name: "A", code: "WH-A" } });
  return wh.id;
}

function form(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [key, value] of Object.entries(fields)) fd.set(key, value);
  return fd;
}

// Role split: Admin manages operational structure (farmhouses/warehouses/mapping);
// master data (units, grade types) is Superadmin-only.
describe("config action role split", () => {
  it("OWNER cannot create a farmhouse", async () => {
    await loginAs(Role.OWNER);
    const warehouseId = await activeWarehouse();
    await expect(
      createFarmhouseAction(
        null,
        form({ name: "K", code: "K1", warehouseId, maxBatchesPerDay: "2" }),
      ),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("ADMIN can create a farmhouse (operational structure)", async () => {
    await loginAs(Role.ADMIN);
    const warehouseId = await activeWarehouse();
    const result = await createFarmhouseAction(
      null,
      form({ name: "K", code: "K1", warehouseId, maxBatchesPerDay: "2" }),
    );
    expect(result.ok).toBe(true);
  });

  it("ADMIN cannot create a measurement unit (master data = Superadmin only)", async () => {
    await loginAs(Role.ADMIN);
    await expect(
      createUnitAction(null, form({ name: "Rak", pcsEquivalent: "30", sortOrder: "0" })),
    ).rejects.toBeInstanceOf(ForbiddenError);
    expect(await prisma.measurementUnit.findUnique({ where: { name: "Rak" } })).toBeNull();
  });

  it("SUPERADMIN can create a measurement unit", async () => {
    await loginAs(Role.SUPERADMIN);
    const result = await createUnitAction(
      null,
      form({ name: "Rak", pcsEquivalent: "30", sortOrder: "0" }),
    );
    expect(result.ok).toBe(true);
    const unit = await prisma.measurementUnit.findUnique({ where: { name: "Rak" } });
    expect(unit?.pcsEquivalent).toBe(30);
  });
});
