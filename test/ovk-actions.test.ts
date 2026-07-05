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

import { OvkCategory, Role } from "@/generated/prisma/enums";
import { ForbiddenError } from "@/lib/errors";
import { createOvkItemAction, deliverOvkAction, transferOvkAction } from "@/app/(app)/ovk/actions";
import { createSession } from "@/lib/server/auth";
import { prisma } from "@/lib/server/db";
import { getOvkStock, recordOvkDelivery } from "@/lib/server/ovkLedger";
import { hashPassword } from "@/lib/server/password";

import { resetDb } from "./helpers";

beforeEach(async () => {
  cookieJar.clear();
  await resetDb();
});

async function loginAs(role: Role) {
  const user = await prisma.user.upsert({
    where: { username: role.toLowerCase() },
    update: {},
    create: { name: role, username: role.toLowerCase(), passwordHash: await hashPassword("pw12345678"), role },
  });
  await createSession(user.id);
  return user;
}

function form(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [key, value] of Object.entries(fields)) fd.set(key, value);
  return fd;
}

describe("OVK actions (rule 5.5)", () => {
  it("rejects a non-Superadmin (ADMIN) on createOvkItem (master is Superadmin-only)", async () => {
    await loginAs(Role.ADMIN);
    await expect(
      createOvkItemAction(null, form({ name: "Vita", category: OvkCategory.VITAMIN, baseUnit: "gram" })),
    ).rejects.toBeInstanceOf(ForbiddenError);
    expect(await prisma.ovkItem.count()).toBe(0);
  });

  it("lets a SUPERADMIN add an item with a unit conversion", async () => {
    await loginAs(Role.SUPERADMIN);
    const result = await createOvkItemAction(
      null,
      form({
        name: "Antibiotik",
        category: OvkCategory.OBAT,
        baseUnit: "liter",
        convCount: "1",
        "conv.0.unit": "botol",
        "conv.0.factor": "1",
      }),
    );
    expect(result.ok).toBe(true);
    const item = await prisma.ovkItem.findFirstOrThrow({ include: { unitConversions: true } });
    expect(item.unitConversions[0]).toMatchObject({ unitName: "botol" });
  });

  it("rejects OWNER on a delivery and a transfer; lets an ADMIN transfer (office stock drops)", async () => {
    const item = await prisma.ovkItem.create({ data: { name: "Vita", category: OvkCategory.VITAMIN, baseUnit: "gram" } });
    const kandang = await prisma.farmhouse.create({ data: { name: "K1", code: "K1" } });
    const admin = await loginAs(Role.ADMIN);
    await recordOvkDelivery({ ovkItemId: item.id, quantity: 500, unitName: "gram", enteredById: admin.id });

    await loginAs(Role.OWNER);
    await expect(
      deliverOvkAction(null, form({ ovkItemId: item.id, quantity: "10", unitName: "gram", date: "2026-07-06" })),
    ).rejects.toBeInstanceOf(ForbiddenError);
    await expect(
      transferOvkAction(
        null,
        form({ ovkItemId: item.id, quantity: "10", unitName: "gram", farmhouseId: kandang.id, date: "2026-07-06" }),
      ),
    ).rejects.toBeInstanceOf(ForbiddenError);

    await loginAs(Role.ADMIN);
    const result = await transferOvkAction(
      null,
      form({ ovkItemId: item.id, quantity: "200", unitName: "gram", farmhouseId: kandang.id, note: "dose", date: "2026-07-06" }),
    );
    expect(result.ok).toBe(true);
    expect((await getOvkStock()).find((s) => s.ovkItemId === item.id)?.currentQuantity.toNumber()).toBe(300);
  });
});
