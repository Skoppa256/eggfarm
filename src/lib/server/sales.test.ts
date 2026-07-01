import { beforeEach, describe, expect, it } from "vitest";

import { RecordStatus, Role, SizeHealthGrade, SourceType } from "@/generated/prisma/enums";
import { ConflictError, InsufficientStockError } from "@/lib/errors";
import { listActiveBuyers } from "@/lib/server/buyers";
import { prisma } from "@/lib/server/db";
import { getLedger, getStock, recordIn } from "@/lib/server/ledger";
import { createSale, findSale, voidSale } from "@/lib/server/sales";

import { resetDb } from "../../../test/helpers";

beforeEach(resetDb);

const DATE = new Date("2026-07-01T00:00:00Z");

async function setup() {
  const user = await prisma.user.create({
    data: { name: "Admin", username: "admin", passwordHash: "x", role: Role.ADMIN },
  });
  const warehouse = await prisma.warehouse.create({ data: { name: "A", code: "WH-A" } });
  const buyer = await prisma.buyer.create({ data: { name: "Buyer 1" } });
  const normal = await prisma.gradeType.create({ data: { name: "Normal", sortOrder: 1 } });
  const omega = await prisma.gradeType.create({ data: { name: "Omega", sortOrder: 2 } });
  return {
    userId: user.id,
    warehouseId: warehouse.id,
    buyerId: buyer.id,
    normal: normal.id,
    omega: omega.id,
  };
}

type F = Awaited<ReturnType<typeof setup>>;
const seed = (f: F, grade: SizeHealthGrade, typeGradeId: string, quantity: number) =>
  recordIn({
    warehouseId: f.warehouseId,
    sizeHealthGrade: grade,
    typeGradeId,
    quantity,
    sourceType: SourceType.GRADING,
    enteredById: f.userId,
  });
const qty = async (f: F, grade: SizeHealthGrade, typeGradeId: string) =>
  (await getStock(f.warehouseId)).find(
    (s) => s.sizeHealthGrade === grade && s.typeGradeId === typeGradeId,
  )?.currentQuantity ?? 0;
const line = (grade: SizeHealthGrade, typeGradeId: string, quantity: number) => ({
  sizeHealthGrade: grade,
  typeGradeId,
  quantity,
  unitUsed: "PCS",
});

describe("sales — atomic multi-line deduction (FR-30/FR-31)", () => {
  it("deducts every line atomically to the right SKUs, one OUT per line", async () => {
    const f = await setup();
    await seed(f, SizeHealthGrade.A, f.normal, 300);
    await seed(f, SizeHealthGrade.B, f.normal, 150);
    await seed(f, SizeHealthGrade.A, f.omega, 90);

    const sale = await createSale(
      {
        warehouseId: f.warehouseId,
        buyerId: f.buyerId,
        date: DATE,
        lines: [
          line(SizeHealthGrade.A, f.normal, 100),
          line(SizeHealthGrade.B, f.normal, 60),
          line(SizeHealthGrade.A, f.omega, 30),
        ],
      },
      { userId: f.userId },
    );

    expect(sale.status).toBe("ACTIVE");
    expect(await qty(f, SizeHealthGrade.A, f.normal)).toBe(200);
    expect(await qty(f, SizeHealthGrade.B, f.normal)).toBe(90);
    expect(await qty(f, SizeHealthGrade.A, f.omega)).toBe(60);

    const outs = (await getLedger(f.warehouseId)).filter(
      (m) => m.sourceType === SourceType.SALES && m.movementType === "OUT",
    );
    expect(outs).toHaveLength(3);
    expect(outs.every((m) => m.sourceReferenceId === sale.id)).toBe(true);
    expect((await findSale(sale.id))?.lineItems).toHaveLength(3);
  });

  it("rejects the whole transaction if any line is short — naming the SKU, no partial write", async () => {
    const f = await setup();
    await seed(f, SizeHealthGrade.A, f.normal, 100);
    await seed(f, SizeHealthGrade.B, f.normal, 20);

    const err = await createSale(
      {
        warehouseId: f.warehouseId,
        buyerId: f.buyerId,
        date: DATE,
        lines: [line(SizeHealthGrade.A, f.normal, 50), line(SizeHealthGrade.B, f.normal, 60)],
      },
      { userId: f.userId },
    ).catch((e) => e);

    expect(err).toBeInstanceOf(InsufficientStockError);
    expect(err.sku).toContain("B"); // names the short SKU

    // No partial deduction and no sale row.
    expect(await qty(f, SizeHealthGrade.A, f.normal)).toBe(100);
    expect(await qty(f, SizeHealthGrade.B, f.normal)).toBe(20);
    expect(await prisma.salesTransaction.count()).toBe(0);
    expect((await getLedger(f.warehouseId)).filter((m) => m.sourceType === SourceType.SALES)).toHaveLength(0);
  });
});

describe("sales — void (FR-33)", () => {
  it("restores exact stock via a compensating VOID and cannot double-void", async () => {
    const f = await setup();
    await seed(f, SizeHealthGrade.A, f.normal, 100);
    const sale = await createSale(
      { warehouseId: f.warehouseId, buyerId: f.buyerId, date: DATE, lines: [line(SizeHealthGrade.A, f.normal, 30)] },
      { userId: f.userId },
    );
    expect(await qty(f, SizeHealthGrade.A, f.normal)).toBe(70);

    const voided = await voidSale(sale.id, "Customer returned the order", { userId: f.userId });
    expect(voided?.status).toBe("VOIDED");
    expect(await qty(f, SizeHealthGrade.A, f.normal)).toBe(100); // restored exactly

    const movements = (await getLedger(f.warehouseId)).filter((m) => m.sourceReferenceId === sale.id);
    expect(movements.filter((m) => m.movementType === "OUT")).toHaveLength(1); // original preserved
    expect(movements.filter((m) => m.movementType === "VOID")).toHaveLength(1);

    await expect(voidSale(sale.id, "Trying to void again", { userId: f.userId })).rejects.toBeInstanceOf(
      ConflictError,
    );
    expect(await qty(f, SizeHealthGrade.A, f.normal)).toBe(100); // unchanged by the failed double-void
  });
});

describe("sales — dispatch target & buyer validation", () => {
  it("rejects a sale from an inactive warehouse", async () => {
    const f = await setup();
    await seed(f, SizeHealthGrade.A, f.normal, 100);
    await prisma.warehouse.update({ where: { id: f.warehouseId }, data: { status: RecordStatus.INACTIVE } });

    await expect(
      createSale(
        { warehouseId: f.warehouseId, buyerId: f.buyerId, date: DATE, lines: [line(SizeHealthGrade.A, f.normal, 10)] },
        { userId: f.userId },
      ),
    ).rejects.toBeInstanceOf(ConflictError);
    expect(await prisma.salesTransaction.count()).toBe(0);
  });

  it("excludes a deactivated buyer from new sales but keeps history intact", async () => {
    const f = await setup();
    await seed(f, SizeHealthGrade.A, f.normal, 100);
    const sale = await createSale(
      { warehouseId: f.warehouseId, buyerId: f.buyerId, date: DATE, lines: [line(SizeHealthGrade.A, f.normal, 30)] },
      { userId: f.userId },
    );

    await prisma.buyer.update({ where: { id: f.buyerId }, data: { status: RecordStatus.INACTIVE } });

    await expect(
      createSale(
        { warehouseId: f.warehouseId, buyerId: f.buyerId, date: DATE, lines: [line(SizeHealthGrade.A, f.normal, 10)] },
        { userId: f.userId },
      ),
    ).rejects.toBeInstanceOf(ConflictError);

    // History intact.
    expect((await findSale(sale.id))?.buyer.name).toBe("Buyer 1");
    // Excluded from the active-buyer dropdown.
    expect((await listActiveBuyers()).some((b) => b.id === f.buyerId)).toBe(false);
  });
});
