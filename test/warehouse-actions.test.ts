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
import { correctionAction } from "@/app/(app)/warehouse/correction/actions";
import { setThresholdAction } from "@/app/(app)/warehouse/thresholds/actions";
import { createSession } from "@/lib/server/auth";
import { requireCorrectionAudit } from "@/lib/server/corrections";
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

async function setup() {
  const warehouse = await prisma.warehouse.create({ data: { name: "A", code: "WH-A" } });
  const type = await prisma.gradeType.create({ data: { name: "Normal", sortOrder: 1 } });
  return { warehouseId: warehouse.id, typeGradeId: type.id };
}

function form(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [key, value] of Object.entries(fields)) fd.set(key, value);
  return fd;
}

describe("warehouse write actions (rule 5.5)", () => {
  it("rejects an OWNER on a stock correction", async () => {
    const { warehouseId, typeGradeId } = await setup();
    await loginAs(Role.OWNER);
    await expect(
      correctionAction(
        null,
        form({
          warehouseId,
          sizeHealthGrade: "A",
          typeGradeId,
          mode: "absolute",
          value: "10",
          reason: "Owner must not be able to correct warehouse stock",
        }),
      ),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("rejects an OWNER on a threshold write", async () => {
    const { warehouseId, typeGradeId } = await setup();
    await loginAs(Role.OWNER);
    await expect(
      setThresholdAction(
        null,
        form({ warehouseId, sizeHealthGrade: "A", typeGradeId, minQuantity: "100" }),
      ),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("lets an ADMIN submit a correction", async () => {
    const { warehouseId, typeGradeId } = await setup();
    await loginAs(Role.ADMIN);
    const result = await correctionAction(
      null,
      form({
        warehouseId,
        sizeHealthGrade: "A",
        typeGradeId,
        mode: "delta",
        value: "25",
        reason: "Initial count established during warehouse setup",
      }),
    );
    expect(result.ok).toBe(true);
  });
});

describe("correction audit visibility", () => {
  it("rejects a non-Superadmin (ADMIN)", async () => {
    await loginAs(Role.ADMIN);
    await expect(requireCorrectionAudit()).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("returns the audit list for a SUPERADMIN", async () => {
    await loginAs(Role.SUPERADMIN);
    const list = await requireCorrectionAudit();
    expect(Array.isArray(list)).toBe(true);
  });
});
