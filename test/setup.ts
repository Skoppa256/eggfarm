import { afterAll } from "vitest";

import { prisma } from "@/lib/server/db";

// Hard safety guard: tests truncate tables, so they must NEVER touch the dev DB.
// `pnpm test` loads .env.test (eggfarm_test) via dotenv-cli; if for any reason
// DATABASE_URL is not the test database, abort the whole run immediately.
if (!process.env.DATABASE_URL?.includes("eggfarm_test")) {
  throw new Error(
    `Refusing to run tests: DATABASE_URL must point at eggfarm_test, got ${
      process.env.DATABASE_URL ?? "(unset)"
    }`,
  );
}

afterAll(async () => {
  await prisma.$disconnect();
});
