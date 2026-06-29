import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock the request-context boundaries: an in-memory cookie jar (so the REAL
// createSession/getSessionUser flow works end-to-end) and a no-op revalidatePath.
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
import { recordMovementAction } from "@/app/(app)/warehouse/actions";
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

async function makeSku() {
  const warehouse = await prisma.warehouse.create({ data: { name: "WH", code: "WH-1" } });
  const gradeType = await prisma.gradeType.create({ data: { name: "Normal", sortOrder: 1 } });
  return { warehouseId: warehouse.id, typeGradeId: gradeType.id };
}

function form(fields: Record<string, string | number>): FormData {
  const fd = new FormData();
  for (const [key, value] of Object.entries(fields)) fd.set(key, String(value));
  return fd;
}

describe("recordMovementAction (rule 5.5: role enforced inside the action)", () => {
  it("rejects an OWNER session on the OUT write path", async () => {
    await loginAs(Role.OWNER);
    const { warehouseId, typeGradeId } = await makeSku();

    await expect(
      recordMovementAction(
        null,
        form({ direction: "OUT", warehouseId, sizeHealthGrade: "A", typeGradeId, rak: 0, pcs: 5 }),
      ),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("lets an ADMIN record stock", async () => {
    await loginAs(Role.ADMIN);
    const { warehouseId, typeGradeId } = await makeSku();

    const result = await recordMovementAction(
      null,
      form({ direction: "IN", warehouseId, sizeHealthGrade: "A", typeGradeId, rak: 1, pcs: 0 }),
    );
    expect(result.ok).toBe(true);
  });
});
