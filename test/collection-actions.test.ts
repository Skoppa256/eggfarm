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
import { createCollectionAction } from "@/app/(app)/collections/actions";
import { createSession } from "@/lib/server/auth";
import { prisma } from "@/lib/server/db";
import { createFarmhouse } from "@/lib/server/farmhouses";
import { getStock } from "@/lib/server/ledger";
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

async function setup() {
  const setupUser = await prisma.user.create({
    data: { name: "setup", username: "setup", passwordHash: "x", role: Role.SUPERADMIN },
  });
  const whA = await prisma.warehouse.create({ data: { name: "A", code: "WH-A" } });
  const normal = await prisma.gradeType.create({ data: { name: "Normal", sortOrder: 1 } });
  const farmhouse = await createFarmhouse({
    name: "K1",
    code: "K1",
    warehouseId: whA.id,
    maxBatchesPerDay: 2,
    changedById: setupUser.id,
    today: new Date("2026-07-01T00:00:00Z"),
  });
  return { whA: whA.id, normal: normal.id, farmhouseId: farmhouse.id };
}

function form(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [key, value] of Object.entries(fields)) fd.set(key, value);
  return fd;
}

describe("createCollectionAction (rule 5.5)", () => {
  it("rejects an OWNER", async () => {
    const { farmhouseId, normal } = await setup();
    await loginAs(Role.OWNER);

    await expect(
      createCollectionAction(
        null,
        form({
          farmhouseId,
          date: "2026-07-01",
          batchNumber: "1",
          goodEggs: "100",
          telurRetak: "0",
          telurLunak: "0",
          telurKosong: "0",
          [`rak_${normal}`]: "5",
        }),
      ),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("lets an ADMIN record a batch, converting rak → pcs and posting Angkat Rak", async () => {
    const { whA, farmhouseId, normal } = await setup();
    await loginAs(Role.ADMIN);

    const result = await createCollectionAction(
      null,
      form({
        farmhouseId,
        date: "2026-07-01",
        batchNumber: "1",
        goodEggs: "3000",
        telurRetak: "0",
        telurLunak: "0",
        telurKosong: "0",
        [`rak_${normal}`]: "5", // 5 rak → 150 pcs
      }),
    );

    expect(result.ok).toBe(true);
    const stock = await getStock(whA);
    expect(stock).toHaveLength(1);
    expect(stock[0].currentQuantity).toBe(150);
  });
});
