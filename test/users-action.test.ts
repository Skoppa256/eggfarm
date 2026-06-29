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
import { createUserAction } from "@/app/(app)/users/actions";
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

function form(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [key, value] of Object.entries(fields)) fd.set(key, value);
  return fd;
}

describe("createUserAction (only Superadmin manages users)", () => {
  it("rejects a non-Superadmin (ADMIN)", async () => {
    await loginAs(Role.ADMIN);

    await expect(
      createUserAction(
        null,
        form({ name: "New", username: "newbie", password: "pw12345678", role: "ADMIN" }),
      ),
    ).rejects.toBeInstanceOf(ForbiddenError);

    expect(await prisma.user.findUnique({ where: { username: "newbie" } })).toBeNull();
  });

  it("lets a SUPERADMIN create a user", async () => {
    await loginAs(Role.SUPERADMIN);

    const result = await createUserAction(
      null,
      form({ name: "New User", username: "newuser", password: "pw12345678", role: "ADMIN" }),
    );

    expect(result.ok).toBe(true);
    const created = await prisma.user.findUnique({ where: { username: "newuser" } });
    expect(created?.role).toBe(Role.ADMIN);
  });
});
