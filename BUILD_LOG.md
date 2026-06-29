# BUILD_LOG.md — EggFarm IMS

Running log of what was built, slice by slice. Newest summary on top.

---

## CURRENT STATUS (updated after Slice 1)

- **Slices complete & committed:** Slice 1 (warehouse ledger + stock projection).
- **Gates:** `tsc --noEmit` clean · `eslint` clean · Vitest **9/9 pass** (against `eggfarm_test`) · `next build` succeeds.
- **Next up:** Slice 2 (auth, users, roles) — wires the real `requireRole` into Slice 1's action, replacing the stub.

### ⚠️ Read this first — Node version (environment)
The Prisma 7 CLI **does not run on the shell's default Node** (`/usr/local/bin/node` = **v20.11.1**): `@prisma/dev` does `require()` on an ESM-only module, which needs `require(esm)` (Node ≥ 20.17 / 22). Every `prisma`, `next`, `pnpm`, and test command must run under **Node 22**.

- Pinned via **`.nvmrc` (22)** and `package.json` `engines.node >= 22`.
- nvm has `v22.23.1` installed. Activate before anything:
  ```bash
  cd "<repo>" && nvm use      # picks up .nvmrc -> Node 22
  # (or: export PATH="$HOME/.nvm/versions/node/v22.23.1/bin:$PATH")
  ```
  Confirm with `node -v` → `v22.x` before running pnpm/prisma.

### Run the app
```bash
nvm use
pnpm install                 # node_modules already present; safe to re-run
pnpm exec prisma generate    # generated client is gitignored — run on a fresh clone
pnpm db:seed                 # seeds Normal/Omega grade types + warehouse WH-01 into eggfarm
pnpm dev                     # http://localhost:3000  (/ redirects to /warehouse)
```

### Run the tests (always against eggfarm_test, never the dev DB)
```bash
nvm use
pnpm test                    # applies migrations to eggfarm_test, then runs Vitest
```
`pnpm test` = `dotenv -e .env.test -- prisma migrate deploy && dotenv -e .env.test -- vitest run`.
A guard in `test/setup.ts` aborts the run if `DATABASE_URL` is not `eggfarm_test`.

### Other commands
```bash
pnpm typecheck               # tsc --noEmit
pnpm lint                    # eslint
pnpm build                   # next build
pnpm db:migrate              # prisma migrate dev (new migration)
pnpm db:studio               # prisma studio
```

### Needs your review
- **Nothing blocking.** No flock/HD%/FCR/feed math in this slice.
- **`SourceType.ADJUSTMENT`** was added to the movement source enum so Slice 1's
  generic foundation actions have a sensible source. The SRS lists Grading / Angkat
  Rak / Sales / Correction; later slices use those explicitly. (Assumption A1.)
- **`StockMovement.enteredById`** is a nullable `String` (no FK yet); the Slice 1
  stub writes `"system"`. Slice 2 adds the `User` model + FK and the real user id.
  (Assumption A2.)

---

## Slice 1 — Warehouse ledger + stock projection ✅

**Goal (CLAUDE.md §8):** prove rules 5.1 (ledger is truth, stock is a projection),
5.2 (row-lock every stock write), and 5.4 (one file writes stock) end to end,
before any other feature.

### What was built
- **Prisma schema** (`prisma/schema.prisma`) → migration #1
  `20260629172344_slice1_warehouse_ledger`:
  - Enums: `SizeHealthGrade` (the 11 stockable grades; `KOSONG` intentionally
    excluded — tracking-only), `MovementType` (IN/OUT/CORRECTION/VOID),
    `SourceType` (ANGKAT_RAK/GRADING/SALES/CORRECTION/**ADJUSTMENT**), `RecordStatus`.
  - Models: `GradeType` (Normal/Omega, extensible), `Warehouse` (minimal),
    `WarehouseStock` (balance cache, pcs; unique on
    `[warehouseId, sizeHealthGrade, typeGradeId]`), `StockMovement`
    (append-only ledger; `preQuantity`/`postQuantity` snapshots; `quantity` is the
    positive magnitude, direction implied by `movementType`).
- **`src/lib/units.ts`** — `PCS_PER_RAK=30`, `rakToPcs`, `pcsToRak`, `formatPcs`
  (`2617 → "87 rak + 7 pcs"`). Pure, shared.
- **`src/lib/server/db.ts`** — Prisma singleton via the **PrismaPg driver adapter**
  (Prisma 7's `prisma-client` generator requires a driver adapter; the connection
  string comes from `process.env.DATABASE_URL` at runtime, not the schema).
- **`src/lib/server/ledger.ts`** — **the only stock writer (rule 5.4).**
  `recordIn` / `recordOut` each run in one interactive `$transaction`:
  ensure the balance row exists (`INSERT … ON CONFLICT DO NOTHING`), lock it
  (`SELECT … FOR UPDATE`, rule 5.2), read pre, validate, then update the balance
  **and** append the movement (both or neither). `recordOut` rejects atomically if
  the balance would go negative, throwing `InsufficientStockError` naming the SKU
  (e.g. `"A / Omega"`). Plus read helpers `getStock` / `getLedger`.
- **`src/lib/server/auth.ts`** — Slice 1 **stub** of `requireUser` / `requireRole`
  (real call sites + role logic; the *current-user source* is stubbed to a
  SUPERADMIN `"system"` user, with `// TODO: Slice 2`).
- **`src/lib/errors.ts`** — typed `AppError` family (`ForbiddenError`,
  `InsufficientStockError`, …).
- **`src/lib/schemas/ledger.ts`** — Zod schema for the movement form (accepts rak
  and/or pcs, converts to pcs).
- **Server action** `src/app/(app)/warehouse/actions.ts` — `requireRole(...)` first
  (rule 5.5; OWNER excluded), Zod-validates, calls the ledger, `revalidatePath`.
- **UI** — `src/app/(app)/warehouse/page.tsx` (current stock + ledger tables) and a
  client `stock-entry-form.tsx` (Stock In / Stock Out). `(app)/layout.tsx`
  establishes the protected-shell pattern (`requireUser`). `/` redirects to
  `/warehouse`. Read helpers in `src/lib/server/catalog.ts`.
- **Seed** (`prisma/seed.ts`, wired via `prisma.config.ts` `migrations.seed`) —
  idempotent upserts of Normal/Omega + warehouse `WH-01`.
- **Tests** (`src/lib/units.test.ts`, `src/lib/server/ledger.test.ts`) calling
  `ledger.ts` directly: (a) ledger ↔ balance lockstep + pre/post chain;
  (b) oversell rejected with no partial write; plus drain-to-zero, fresh-SKU
  oversell leaves no stray row, and a concurrent-OUT race (FOR UPDATE serializes,
  exactly one wins). Isolation: truncate-all before each test; `.env.test` only.

### Key decisions
- **Driver adapter (`@prisma/adapter-pg` + `pg`).** Prisma 7's new client doesn't
  take a datasource URL in the constructor; it needs a driver adapter. Keeping the
  URL out of the schema (supplied at runtime) is what lets tests target
  `eggfarm_test` without ever touching `eggfarm`.
- **`preQuantity`/`postQuantity` on every movement** make the ledger
  self-describing and let tests assert the fold matches the cache.
- **Ensure-row-then-lock** via `INSERT … ON CONFLICT DO NOTHING` keeps the
  transaction healthy under concurrent first-touch of a new SKU.
- **Test DB safety:** `dotenv -e .env.test` sets `DATABASE_URL` first; the prisma
  CLI's `import 'dotenv/config'` (loads `.env`) does **not** override an already-set
  var, so migrations/tests stay on `eggfarm_test`. A `test/setup.ts` guard hard-aborts
  if the URL isn't the test DB.
- **`server-only`** is aliased to a no-op in `vitest.config.ts` (it throws under
  plain Node); tests legitimately exercise server modules.
- Native Vite `resolve.tsconfigPaths` (dropped the `vite-tsconfig-paths` plugin).

### Assumptions (resolved conservatively; none touch stock/role correctness adversely)
- **A1 — `SourceType.ADJUSTMENT`.** Added a generic source for the foundation's
  manual IN/OUT actions. SRS source list isn't closed; later slices pass the
  specific source. No effect on ledger correctness.
- **A2 — `enteredById` nullable now, FK in Slice 2.** Audit column present; stub
  writes `"system"`. Avoids inventing a `User` table early.
- **A3 — `unitUsed` is a free `String` ("PCS"/"RAK")**, not yet the Measurement Unit
  table (Slice 3). Audit-only; quantities are always stored in pcs.
- **A4 — minimal `(app)/layout.tsx` calls `requireUser`** (stub) to set the pattern;
  real middleware/redirect is Slice 2.

### Test status
`pnpm test` → **9 passed** (2 files). `tsc`, `eslint`, `next build` all clean.
