import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    // Resolve the `@/*` paths from tsconfig.json natively (Vite built-in).
    tsconfigPaths: true,
    alias: {
      // `server-only` throws under plain Node; swap it for a no-op in tests.
      "server-only": fileURLToPath(new URL("./test/empty-module.ts", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    globals: true,
    setupFiles: ["./test/setup.ts"],
    // Integration tests share one Postgres test DB and truncate between tests, so
    // test files must not run in parallel.
    fileParallelism: false,
  },
});
