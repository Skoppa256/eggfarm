import { prisma } from "@/lib/server/db";

// Per-test isolation: truncate every table (except the migrations bookkeeping)
// before each test, so tests start from an empty database and never leak into one
// another. Discovers tables dynamically so new slices need no maintenance here.
export async function resetDb(): Promise<void> {
  const tables = await prisma.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'
  `;
  if (tables.length === 0) return;
  const list = tables.map((t) => `"${t.tablename}"`).join(", ");
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${list} RESTART IDENTITY CASCADE`);
}

/** Create one warehouse + one grade type and return their ids for ledger tests. */
export async function createSkuFixture(): Promise<{
  warehouseId: string;
  typeGradeId: string;
}> {
  const warehouse = await prisma.warehouse.create({
    data: { name: "Test Warehouse", code: "WH-TEST" },
  });
  const gradeType = await prisma.gradeType.create({
    data: { name: "Normal", sortOrder: 1 },
  });
  return { warehouseId: warehouse.id, typeGradeId: gradeType.id };
}
