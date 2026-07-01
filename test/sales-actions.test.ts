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

import { Role, SizeHealthGrade, SourceType } from "@/generated/prisma/enums";
import { ForbiddenError } from "@/lib/errors";
import { createSaleAction, voidSaleAction } from "@/app/(app)/sales/actions";
import { createSession } from "@/lib/server/auth";
import { prisma } from "@/lib/server/db";
import { getStock, recordIn } from "@/lib/server/ledger";
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
  const seedUser = await prisma.user.create({
    data: { name: "seed", username: "seed", passwordHash: "x", role: Role.SUPERADMIN },
  });
  const warehouse = await prisma.warehouse.create({ data: { name: "A", code: "WH-A" } });
  const buyer = await prisma.buyer.create({ data: { name: "Buyer 1" } });
  const normal = await prisma.gradeType.create({ data: { name: "Normal", sortOrder: 1 } });
  await recordIn({
    warehouseId: warehouse.id,
    sizeHealthGrade: SizeHealthGrade.A,
    typeGradeId: normal.id,
    quantity: 300,
    sourceType: SourceType.GRADING,
    enteredById: seedUser.id,
  });
  return { warehouseId: warehouse.id, buyerId: buyer.id, normal: normal.id };
}

function form(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [key, value] of Object.entries(fields)) fd.set(key, value);
  return fd;
}

describe("sales actions (rule 5.5)", () => {
  it("rejects an OWNER on createSaleAction", async () => {
    const { warehouseId, buyerId, normal } = await setup();
    await loginAs(Role.OWNER);
    await expect(
      createSaleAction(
        null,
        form({
          warehouseId,
          buyerId,
          date: "2026-07-01",
          lineCount: "1",
          "line.0.sizeHealthGrade": "A",
          "line.0.typeGradeId": normal,
          "line.0.quantity": "5",
          "line.0.unit": "RAK",
        }),
      ),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("rejects an OWNER on voidSaleAction", async () => {
    await loginAs(Role.OWNER);
    await expect(
      voidSaleAction(null, form({ transactionId: "anything", reason: "Owner may not void a transaction" })),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("lets an ADMIN record a sale (rak → pcs, atomic deduction)", async () => {
    const { warehouseId, buyerId, normal } = await setup();
    await loginAs(Role.ADMIN);
    // On success the action redirects (throws NEXT_REDIRECT) — swallow it and check effects.
    await createSaleAction(
      null,
      form({
        warehouseId,
        buyerId,
        date: "2026-07-01",
        lineCount: "1",
        "line.0.sizeHealthGrade": "A",
        "line.0.typeGradeId": normal,
        "line.0.quantity": "5", // 5 rak → 150 pcs
        "line.0.unit": "RAK",
      }),
    ).catch(() => {});

    expect(await prisma.salesTransaction.count()).toBe(1);
    const stock = await getStock(warehouseId);
    expect(stock.find((s) => s.sizeHealthGrade === "A" && s.typeGradeId === normal)?.currentQuantity).toBe(150);
  });
});
