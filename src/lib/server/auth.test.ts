import { beforeEach, describe, expect, it } from "vitest";

import { RecordStatus, Role } from "@/generated/prisma/enums";
import { ForbiddenError, UnauthorizedError } from "@/lib/errors";
import { assertRole, authenticate } from "@/lib/server/auth";
import { prisma } from "@/lib/server/db";
import { hashPassword } from "@/lib/server/password";

import { resetDb } from "../../../test/helpers";

beforeEach(resetDb);

async function makeUser(opts: {
  username: string;
  password: string;
  role: Role;
  status?: RecordStatus;
}) {
  return prisma.user.create({
    data: {
      name: opts.username,
      username: opts.username,
      passwordHash: await hashPassword(opts.password),
      role: opts.role,
      status: opts.status ?? RecordStatus.ACTIVE,
    },
  });
}

describe("authenticate", () => {
  it("returns the user for correct credentials", async () => {
    await makeUser({ username: "alice", password: "secret123", role: Role.ADMIN });
    const user = await authenticate("alice", "secret123");
    expect(user.username).toBe("alice");
    expect(user.role).toBe(Role.ADMIN);
  });

  it("rejects a wrong password", async () => {
    await makeUser({ username: "bob", password: "secret123", role: Role.ADMIN });
    await expect(authenticate("bob", "nope")).rejects.toBeInstanceOf(UnauthorizedError);
  });

  it("rejects a deactivated user — a deactivated user cannot log in", async () => {
    await makeUser({
      username: "carol",
      password: "secret123",
      role: Role.ADMIN,
      status: RecordStatus.INACTIVE,
    });
    await expect(authenticate("carol", "secret123")).rejects.toBeInstanceOf(
      UnauthorizedError,
    );
  });

  it("rejects an unknown user", async () => {
    await expect(authenticate("ghost", "whatever")).rejects.toBeInstanceOf(
      UnauthorizedError,
    );
  });
});

describe("assertRole", () => {
  it("rejects OWNER on a write path (OWNER is read-only)", () => {
    expect(() => assertRole({ role: Role.OWNER }, [Role.SUPERADMIN, Role.ADMIN])).toThrow(
      ForbiddenError,
    );
  });

  it("allows a role that is in the allow-list", () => {
    expect(() => assertRole({ role: Role.ADMIN }, [Role.SUPERADMIN, Role.ADMIN])).not.toThrow();
    expect(() => assertRole({ role: Role.SUPERADMIN }, [Role.SUPERADMIN])).not.toThrow();
  });
});
