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

/**
 * Options for interactive stock transactions. Generous vs Prisma's defaults
 * (maxWait 2s / timeout 5s) so a legitimate FOR UPDATE lock-wait under warehouse
 * contention (or a busy CI box) completes instead of spuriously timing out. A true
 * deadlock still surfaces immediately via Postgres's own detector.
 */
export const TX_OPTIONS = { maxWait: 10_000, timeout: 20_000 } as const;
