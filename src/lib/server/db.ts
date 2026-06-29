import "server-only";

import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "@/generated/prisma/client";

// Prisma singleton (CLAUDE.md §7). One client for the whole app so dev hot-reload
// doesn't exhaust the connection pool. Never `new PrismaClient()` anywhere else.
//
// Prisma 7's `prisma-client` generator connects through a driver adapter, so the
// connection string is supplied here at runtime rather than baked into the schema:
// the app reads DATABASE_URL from .env via Next, tests from .env.test via
// dotenv-cli. That separation is what keeps tests off the dev database.

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createPrismaClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set — cannot create the Prisma client.");
  }
  const adapter = new PrismaPg({ connectionString });
  return new PrismaClient({ adapter });
}

export const prisma: PrismaClient = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
