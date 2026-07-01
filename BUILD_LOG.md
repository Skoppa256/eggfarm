# BUILD_LOG.md — EggFarm IMS

Running log of what was built, slice by slice. Newest summary on top.

---

## CURRENT STATUS (updated after Slice 3)

- **Slices complete & committed:** Slice 1 (warehouse ledger), Slice 2 (auth, users, roles), a
  refactor (`enteredById` FK to User), Slice 3 (config & master data).
- **Gates:** `tsc --noEmit` clean · `eslint` clean · Vitest **31/31 pass** (against `eggfarm_test`) · `next build` succeeds.
- **Next up:** Slice 4 (collection input) — depends on Slices 1 & 3.

### Migrations (apply in order; `pnpm test` and `pnpm db:deploy` do this for you)
1. `slice1_warehouse_ledger` · 2. `slice2_auth_users` · 3. `enteredby_fk_to_user` · 4. `slice3_config_master_data`.
If a migration ever fails mid-way on the **test** DB (e.g. a made-required column with old NULLs),
resolve with `DATABASE_URL=<test-url> pnpm exec prisma migrate resolve --rolled-back <name>` then re-run.

### ⚠️ Running the app locally — Postgres.app permission
On first `pnpm dev` / `pnpm start`, **Postgres.app shows a macOS permission dialog** ("trust authentication" / app permissions) for the long-running server process. You must click **Allow**, or pages that hit the DB return 500 with
`Postgres.app failed to verify "trust" authentication … You did not confirm the permission dialog`.
This is an OS/Postgres.app prompt, **not** an app bug: short-lived connections (Vitest, `prisma`, seed) are already approved, which is why all gates and tests pass. Middleware redirects (no DB) and the login→/warehouse bounce were smoke-verified live; the authenticated page render couldn't be smoke-tested headless because the dialog can't be clicked unattended — but `getSessionUser`'s full logic is covered by the action tests.

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
pnpm db:seed                 # seeds grade types + warehouse + initial Superadmin
pnpm dev                     # http://localhost:3000  (redirects to /login)
```
Initial login (created by the seed; change the password after first login):
**`superadmin` / `superadmin123`**.

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
- **Nothing blocking.** No flock/HD%/FCR/feed math yet.
- **Business dates are UTC date-only (Slice 3).** Effective dates use `@db.Date`
  normalized to UTC midnight; "today"/"next day"/"as-of" arithmetic is thus
  timezone-agnostic, but *what counts as "today"* is the UTC calendar day. For a
  WIB (UTC+7) farm, entries between 00:00–07:00 WIB fall on the previous UTC day.
  Revisit with a farm-timezone helper if that boundary matters. (Assumption A6.)
- **`MAX_BATCHES_PER_DAY = 10`** is a code constant (SRS says "max configurable"; no
  global-settings table in scope). Change the constant in `farmhouses.ts` +
  `schemas/config.ts` if a different ceiling is needed. (Assumption A7.)
- **MeasurementUnit is a managed catalog** seeded with Rak=30/Pcs=1, but the actual
  pcs⇄rak conversion still lives in `src/lib/units.ts` (code, not DB-driven). Wire
  entry to the DB units only if/when runtime-configurable units are required.
  (Assumption A8.)
- **bcrypt → bcryptjs (Slice 2).** Pure-JS, same `$2` hash format; avoids a node-gyp
  build pnpm skips. (Assumption A5.)
- **`SourceType.ADJUSTMENT`** added for Slice 1's generic foundation actions
  (Assumption A1). `enteredById` is now a **required FK to User** (refactor).
- **Initial Superadmin password** is the seed default `superadmin123` — change it.

---

## Slice 3 — Config & master data ✅

**Goal (BUILD_PLAN):** Admin-managed farmhouses/warehouses/mapping and
Superadmin-managed units/grade types, with effective-dated config and soft-delete.

### What was built
- **Schema** → migration #4: `Farmhouse`; `FarmhouseWarehouseMapping` and
  `FarmhouseBatchSetting` as **append-only, effective-dated logs** (`effectiveFrom`
  `@db.Date`, `changedBy` FK); `MeasurementUnit`. Neither the warehouse assignment
  nor the batch count is a mutable column — both are resolved from their log as of a
  date, so history is preserved (SRS §7 / FR-41).
- **`src/lib/dates.ts`** — UTC date-only helpers (`toDateOnly`, `addDays`, …), pure
  and unit-tested; the date logic is passed dates explicitly so it's testable.
- **`src/lib/server/farmhouses.ts`** —
  - `resolveWarehouseId(id, asOf)` / `resolveMaxBatches(id, asOf)` = the row with the
    greatest `effectiveFrom <= asOf` (ties by `createdAt`).
  - `createFarmhouse` (initial mapping + batch setting effective *today*, atomic),
    `changeWarehouseMapping` (date-effective; deactivated warehouses refused),
    `changeMaxBatches` (**effectiveFrom = today + 1**, so it takes effect the next
    day), `setFarmhouseStatus` (soft delete), `listFarmhousesWithCurrent`.
- **`warehouses.ts` / `measurementUnits.ts` / `gradeTypes.ts`** — CRUD services
  (soft-delete via status).
- **Zod schemas** (`schemas/config.ts`) + **role-split actions** (requireRole first,
  rule 5.5): Admin (+Superadmin) create/change farmhouses, warehouses, mapping,
  batch; **Superadmin-only** units & grade types. OWNER rejected everywhere.
- **UI**: `/farmhouses` (create, re-map, next-day batch change, activate/deactivate),
  `/warehouses`, `/units`, `/grade-types`; role-gated nav; seed adds Rak/Pcs units.
- **Tests (10 new, 31 total):** as-of-date mapping resolution and next-day batch
  effectiveness against worked examples; out-of-range batch rejected; mapping to a
  deactivated warehouse refused; role split (OWNER/Admin/Superadmin); date helpers.

### Key decisions
- **Effective-dated logs, not mutable columns.** Both `Farmhouse` config fields are
  versioned; the "current" value is derived, so a change never rewrites history and
  the batch change can be future-dated to satisfy FR-41's "next day".
- **Explicit dates into services.** Every resolver/mutator takes the reference date
  as a parameter (the action passes `todayDateOnly()`), keeping the risky date logic
  pure and unit-testable without mocking the clock.

### Test status
`pnpm test` → **31 passed** (9 files). `tsc`, `eslint`, `next build` all clean.

---

## refactor — enteredById FK to User ✅

Made `StockMovement.enteredById` a **required FK to User** (was a nullable `String`),
so every movement is attributed with referential integrity. Migration #3; ledger
input now requires `enteredById`; test fixture creates a user. Existing dev movements
already referenced the superadmin (no backfill needed). Note: reverses earlier
assumption A2. Gates green (21/21 at the time).

---

## Slice 2 — Auth, users, roles ✅

**Goal (BUILD_PLAN):** real `requireRole`/`requireUser`, login/logout, middleware,
Superadmin-only user CRUD; wire the real guard into Slice 1's action.

### What was built
- **Schema** → migration #2 `…_slice2_auth_users`: `Role` enum (SUPERADMIN/ADMIN/
  OWNER), `User` (unique username, bcrypt `passwordHash`, role, status, lastLoginAt),
  `Session` (id, userId, expiresAt; cascade-deletes with the user).
- **`src/lib/server/password.ts`** — `hashPassword`/`verifyPassword` via **bcryptjs**.
- **`src/lib/server/auth.ts`** (replaces the stub):
  - `authenticate(username, password)` — DB + bcrypt; rejects unknown/inactive/wrong
    with one opaque error (no username enumeration). A deactivated user can't log in.
  - `createSession` / `getSessionUser` / `destroySession` — a signed httpOnly cookie
    (**jose** HS256) carries only the session id; the `Session` row is the source of
    truth, so logout/deactivation invalidate immediately.
  - `requireUser` / `requireRole` + a **pure `assertRole`** (unit-testable). OWNER is
    rejected on every write path.
- **`src/lib/server/users.ts`** — `listUsers` / `createUser` (hashes password, unique
  username) / `setUserStatus` (soft activate/deactivate; deactivation also deletes the
  user's sessions for instant lockout).
- **Actions** (role-checked first, rule 5.5): `loginAction`, `logoutAction`,
  `createUserAction` + `setUserStatusAction` (both `requireRole("SUPERADMIN")`).
  Slice 1's `recordMovementAction` is unchanged but its `requireRole` is now real.
- **UI**: `/login` (public) + form; `(app)/layout.tsx` re-checks the DB session and
  redirects to `/login`, shows nav + logout; `/users` Superadmin admin (list, create,
  activate/deactivate, can't deactivate yourself).
- **`src/middleware.ts`** — Edge first-pass gate: verifies the cookie JWT and redirects
  unauthenticated users to `/login` (and logged-in users away from `/login`). Real
  enforcement stays in `getSessionUser` (DB).
- **Seed** extended with an idempotent initial Superadmin.
- **Tests (12 new, 21 total):** password round-trip; `authenticate` (correct / wrong /
  **deactivated** / unknown); `assertRole` (OWNER rejected, listed roles allowed);
  end-to-end action tests with a real session (cookie jar mocked, real JWT + DB):
  **OWNER rejected on the Slice 1 OUT path**, ADMIN allowed; **only SUPERADMIN creates
  users**, ADMIN forbidden.

### Key decisions
- **DB-backed sessions, id-only cookie.** The cookie holds just the signed session id;
  every request reloads the `Session` + `User`, so a deactivated user or a logout is
  enforced on the very next request (CLAUDE.md §3).
- **Defense in depth.** Middleware redirects (no DB on the edge); the protected layout
  re-checks the real DB session; each mutating action re-checks the role. UI hiding is
  never the gate.
- **Testing the write path without a request scope.** Action tests mock only the
  cookie transport (`next/headers`) and `revalidatePath`; everything else — JWT sign/
  verify, session load, role check — runs for real, so the "OWNER forbidden" guarantee
  is proven through the actual action.

### Assumptions
- **A5 — bcryptjs over native bcrypt** (see "Needs your review").
- **A2 (carried) — `enteredById` stays a plain string** (no FK to `User`).

### Test status
`pnpm test` → **21 passed** (6 files). `tsc`, `eslint`, `next build` all clean.

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
