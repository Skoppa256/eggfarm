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
import { createVaksinLogAction, createVaksinTypeAction } from "@/app/(app)/vaksin/actions";
import { createSession } from "@/lib/server/auth";
import { prisma } from "@/lib/server/db";
import { hashPassword } from "@/lib/server/password";
import { vaksinForDailyRecord } from "@/lib/server/vaksin";

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

describe("vaksin actions (rule 5.5)", () => {
  it("rejects a non-Superadmin (ADMIN) on the vaksin-type master (Superadmin-only)", async () => {
    await loginAs(Role.ADMIN);
    await expect(createVaksinTypeAction(null, form({ name: "ND-IB" }))).rejects.toBeInstanceOf(ForbiddenError);
    expect(await prisma.vaksinType.count()).toBe(0);
  });

  it("lets a SUPERADMIN add a vaksin type", async () => {
    await loginAs(Role.SUPERADMIN);
    const result = await createVaksinTypeAction(null, form({ name: "Gumboro", sortOrder: "1" }));
    expect(result.ok).toBe(true);
    expect(await prisma.vaksinType.count()).toBe(1);
  });

  it("rejects OWNER on a log entry; lets an ADMIN log (surfaces on the daily record)", async () => {
    const kandang = await prisma.farmhouse.create({ data: { name: "K1", code: "K1" } });
    const type = await prisma.vaksinType.create({ data: { name: "ND-IB" } });

    await loginAs(Role.OWNER);
    await expect(
      createVaksinLogAction(
        null,
        form({ date: "2026-07-06", vaksinTypeId: type.id, farmhouseId: kandang.id, vials: "2", vaccinator: "Budi" }),
      ),
    ).rejects.toBeInstanceOf(ForbiddenError);

    await loginAs(Role.ADMIN);
    const result = await createVaksinLogAction(
      null,
      form({ date: "2026-07-06", vaksinTypeId: type.id, farmhouseId: kandang.id, vials: "2", vaccinator: "Budi" }),
    );
    expect(result.ok).toBe(true);
    const derived = await vaksinForDailyRecord(kandang.id, new Date("2026-07-06T00:00:00Z"));
    expect(derived).toHaveLength(1);
    expect(derived[0].vials).toBe(2);
  });
});
