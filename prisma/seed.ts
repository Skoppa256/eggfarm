// Database seed (CLAUDE.md §8). Standalone CLI script run via `prisma db seed`
// (wired in prisma.config.ts), so it constructs its own Prisma client rather than
// importing the server-only singleton. Idempotent: safe to run repeatedly.
//
// Seeds the minimum Slice 1 needs: two Grade Types (Normal, Omega) and one
// warehouse.
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";

import { PrismaClient } from "../src/generated/prisma/client";
import { Role } from "../src/generated/prisma/enums";

// Initial Superadmin credentials. Change the password after first login.
const SUPERADMIN_USERNAME = "superadmin";
const SUPERADMIN_PASSWORD = "superadmin123";

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

    // Initial Superadmin. `update: {}` so re-running never resets a changed password.
    const passwordHash = await bcrypt.hash(SUPERADMIN_PASSWORD, 10);
    await prisma.user.upsert({
      where: { username: SUPERADMIN_USERNAME },
      update: {},
      create: {
        name: "Super Admin",
        username: SUPERADMIN_USERNAME,
        passwordHash,
        role: Role.SUPERADMIN,
      },
    });

    const [gradeTypes, warehouses, users] = await Promise.all([
      prisma.gradeType.count(),
      prisma.warehouse.count(),
      prisma.user.count(),
    ]);
    console.log(
      `Seed complete: ${gradeTypes} grade types, ${warehouses} warehouse(s), ${users} user(s).`,
    );
    console.log(
      `  Superadmin login: ${SUPERADMIN_USERNAME} / ${SUPERADMIN_PASSWORD}  (change after first login)`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
