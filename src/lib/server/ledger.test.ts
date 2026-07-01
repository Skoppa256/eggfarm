import { beforeEach, describe, expect, it } from "vitest";

import { MovementType, SizeHealthGrade, SourceType } from "@/generated/prisma/enums";
import { InsufficientStockError } from "@/lib/errors";
import { getLedger, getStock, recordIn, recordOut } from "@/lib/server/ledger";

import { createSkuFixture, resetDb } from "../../../test/helpers";

beforeEach(resetDb);

describe("ledger", () => {
  // CLAUDE.md §8 (a): a movement and its balance stay in lockstep.
  it("keeps the append-only ledger and the balance projection in lockstep", async () => {
    const { warehouseId, typeGradeId, userId } = await createSkuFixture();
    const sku = {
      warehouseId,
      sizeHealthGrade: SizeHealthGrade.A,
      typeGradeId,
      sourceType: SourceType.ADJUSTMENT,
      enteredById: userId,
    } as const;

    await recordIn({ ...sku, quantity: 100 });
    await recordIn({ ...sku, quantity: 50 });
    await recordOut({ ...sku, quantity: 30 });

    // The balance cache reflects the net (100 + 50 - 30 = 120).
    const stock = await getStock(warehouseId);
    expect(stock).toHaveLength(1);
    expect(stock[0].currentQuantity).toBe(120);

    // Folding the ledger reproduces the same balance, and every row's pre/post
    // snapshot chains correctly from 0.
    const ledger = await getLedger(warehouseId);
    expect(ledger).toHaveLength(3);
    const chronological = [...ledger].reverse(); // getLedger returns newest-first
    let running = 0;
    for (const m of chronological) {
      expect(m.preQuantity).toBe(running);
      running += m.movementType === MovementType.IN ? m.quantity : -m.quantity;
      expect(m.postQuantity).toBe(running);
    }
    expect(running).toBe(120);
    // The newest movement's postQuantity equals the cached balance.
    expect(ledger[0].postQuantity).toBe(stock[0].currentQuantity);
  });

  // CLAUDE.md §8 (b): an oversell is rejected atomically with no partial write.
  it("rejects an oversell atomically, leaving balance and ledger untouched", async () => {
    const { warehouseId, typeGradeId, userId } = await createSkuFixture();
    const sku = {
      warehouseId,
      sizeHealthGrade: SizeHealthGrade.B,
      typeGradeId,
      sourceType: SourceType.ADJUSTMENT,
      enteredById: userId,
    } as const;

    await recordIn({ ...sku, quantity: 40 });

    await expect(recordOut({ ...sku, quantity: 41 })).rejects.toBeInstanceOf(
      InsufficientStockError,
    );

    // Balance unchanged; no OUT movement was written.
    const stock = await getStock(warehouseId);
    expect(stock).toHaveLength(1);
    expect(stock[0].currentQuantity).toBe(40);

    const ledger = await getLedger(warehouseId);
    expect(ledger).toHaveLength(1);
    expect(ledger[0].movementType).toBe(MovementType.IN);
  });

  it("allows draining a balance to exactly zero", async () => {
    const { warehouseId, typeGradeId, userId } = await createSkuFixture();
    const sku = {
      warehouseId,
      sizeHealthGrade: SizeHealthGrade.A,
      typeGradeId,
      sourceType: SourceType.ADJUSTMENT,
      enteredById: userId,
    } as const;

    await recordIn({ ...sku, quantity: 30 });
    await recordOut({ ...sku, quantity: 30 });

    const stock = await getStock(warehouseId);
    expect(stock[0].currentQuantity).toBe(0);
  });

  it("rejects an oversell on a brand-new SKU without creating a stray balance row", async () => {
    const { warehouseId, typeGradeId, userId } = await createSkuFixture();

    await expect(
      recordOut({
        warehouseId,
        sizeHealthGrade: SizeHealthGrade.MINI,
        typeGradeId,
        sourceType: SourceType.ADJUSTMENT,
        enteredById: userId,
        quantity: 1,
      }),
    ).rejects.toBeInstanceOf(InsufficientStockError);

    // The transaction rolled back: no WarehouseStock row, no movement.
    expect(await getStock(warehouseId)).toHaveLength(0);
    expect(await getLedger(warehouseId)).toHaveLength(0);
  });

  // Rule 5.2: the FOR UPDATE row lock prevents two concurrent OUTs from overselling.
  it("serializes concurrent OUTs so the same stock can't be sold twice", async () => {
    const { warehouseId, typeGradeId, userId } = await createSkuFixture();
    const sku = {
      warehouseId,
      sizeHealthGrade: SizeHealthGrade.C,
      typeGradeId,
      sourceType: SourceType.ADJUSTMENT,
      enteredById: userId,
    } as const;

    await recordIn({ ...sku, quantity: 50 });

    // Two 30-pcs OUTs race against a 50 balance: exactly one must win.
    const results = await Promise.allSettled([
      recordOut({ ...sku, quantity: 30 }),
      recordOut({ ...sku, quantity: 30 }),
    ]);
    const fulfilled = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter((r) => r.status === "rejected");
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect((rejected[0] as PromiseRejectedResult).reason).toBeInstanceOf(
      InsufficientStockError,
    );

    // Final balance is 20, and only one OUT made it into the ledger.
    const stock = await getStock(warehouseId);
    expect(stock[0].currentQuantity).toBe(20);
    const outs = (await getLedger(warehouseId)).filter(
      (m) => m.movementType === MovementType.OUT,
    );
    expect(outs).toHaveLength(1);
  });
});
