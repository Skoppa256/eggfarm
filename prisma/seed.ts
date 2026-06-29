// Database seed (CLAUDE.md §8). Standalone CLI script run via `prisma db seed`
// (wired in prisma.config.ts), so it constructs its own Prisma client rather than
// importing the server-only singleton. Idempotent: safe to run repeatedly.
//
// Seeds the minimum Slice 1 needs: two Grade Types (Normal, Omega) and one
// warehouse.
import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../src/generated/prisma/client";

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set — cannot seed.");
  }

  const adapter = new PrismaPg({ connectionString });
  const prisma = new PrismaClient({ adapter });

  try {
    await prisma.gradeType.upsert({
      where: { name: "Normal" },
      update: {},
      create: { name: "Normal", sortOrder: 1 },
    });
    await prisma.gradeType.upsert({
      where: { name: "Omega" },
      update: {},
      create: { name: "Omega", sortOrder: 2 },
    });

    await prisma.warehouse.upsert({
      where: { code: "WH-01" },
      update: {},
      create: { name: "Gudang Utama", code: "WH-01" },
    });

    const [gradeTypes, warehouses] = await Promise.all([
      prisma.gradeType.count(),
      prisma.warehouse.count(),
    ]);
    console.log(`Seed complete: ${gradeTypes} grade types, ${warehouses} warehouse(s).`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
