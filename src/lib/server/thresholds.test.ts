import { beforeEach, describe, expect, it } from "vitest";

import { Role, SizeHealthGrade, SourceType } from "@/generated/prisma/enums";
import { prisma } from "@/lib/server/db";
import { recordIn } from "@/lib/server/ledger";
import { getLowStockSkus, setThreshold } from "@/lib/server/thresholds";

import { resetDb } from "../../../test/helpers";

beforeEach(resetDb);

async function fixture() {
  const user = await prisma.user.create({
    data: { name: "Admin", username: "admin", passwordHash: "x", role: Role.ADMIN },
  });
  const warehouse = await prisma.warehouse.create({ data: { name: "A", code: "WH-A" } });
  const type = await prisma.gradeType.create({ data: { name: "Normal", sortOrder: 1 } });
  return { userId: user.id, warehouseId: warehouse.id, typeGradeId: type.id };
}

describe("low-stock thresholds (FR-27)", () => {
  it("flags a SKU below its minimum, and not once it is at/above", async () => {
    const f = await fixture();
    const sku = {
      warehouseId: f.warehouseId,
      sizeHealthGrade: SizeHealthGrade.A,
      typeGradeId: f.typeGradeId,
    };
    await recordIn({ ...sku, quantity: 50, sourceType: SourceType.GRADING, enteredById: f.userId });
    await setThreshold({ ...sku, minQuantity: 100 });

    let low = await getLowStockSkus(f.warehouseId);
    expect(low).toHaveLength(1);
    expect(low[0].current).toBe(50);
    expect(low[0].threshold.minQuantity).toBe(100);

    // Bring stock up to 110 (≥ 100) → no longer low.
    await recordIn({ ...sku, quantity: 60, sourceType: SourceType.GRADING, enteredById: f.userId });
    low = await getLowStockSkus(f.warehouseId);
    expect(low).toHaveLength(0);
  });

  it("treats minQuantity 0 as removing the threshold", async () => {
    const f = await fixture();
    const sku = {
      warehouseId: f.warehouseId,
      sizeHealthGrade: SizeHealthGrade.A,
      typeGradeId: f.typeGradeId,
    };
    await setThreshold({ ...sku, minQuantity: 100 });
    expect(await prisma.lowStockThreshold.count()).toBe(1);

    await setThreshold({ ...sku, minQuantity: 0 });
    expect(await prisma.lowStockThreshold.count()).toBe(0);
  });
});
