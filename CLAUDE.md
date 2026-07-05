# CLAUDE.md — EggFarm IMS

Operating manual for AI agents working in this repo. Read this fully before writing code.
For full requirement detail, open `docs/SRS.md` (the v2.0 Software Requirements Specification). This file is the distilled, always-true version; the SRS is the reference.

**Architecture in one line:** Next.js full-stack (App Router) owns the whole app — UI, server logic, and the database — with Prisma + PostgreSQL. There is **no separate backend**. All data rules live in server-only code under `src/lib/server/`.

---

## 1. What we're building

An Inventory Management System for an Indonesian egg farm (CV Piawai Djaya Farm), replacing a set of disconnected spreadsheets. It covers the full daily operation:

- **Egg pipeline:** farmhouse (kandang) collection → grading → warehouse stock → sales/dispatch to buyers.
- **Flock layer:** chick-in, daily flock recording (mortality, feed, body weight, treatments, derived production/health indicators), end-of-flock.
- **Operations modules:** PAKAN (feed mixing + raw-ingredient inventory), OVK (medicine/vitamin/chemical inventory), VAKSIN (vaccination logging).
- **Dashboard & reports** for the owner; **configuration & master data** without code changes.

Single farm, ~20 concurrent users, up to 50 kandang and 10 warehouses. Small, private, login-gated app. No SEO, no public pages, no multi-tenant.

---

## 2. Status

Built **foundation-first, one vertical slice at a time** (see `BUILD_PLAN.md`). **Slices 1–12 are shipped and green** (140 tests): the full egg pipeline (collection → grading → warehouse → sales), auth/roles, config/master data, flock + daily recording, PAKAN (feed) mixing, OVK, and VAKSIN. **Only Slice 13 (dashboard, reports, exports) remains.** `BUILD_LOG.md` is the authoritative as-built record (per-slice behaviour + resolved assumptions A1–A40); §8 below is the original Slice-1 brief, kept for context. When this file and the SRS disagree with `BUILD_LOG.md`, the build log wins.

---

## 3. Tech stack

**Full-stack app (this repo):**
- **Next.js (App Router)** — server components for reads, **server actions** for mutations, **route handlers** (`app/api/.../route.ts`) only where a programmatic REST endpoint is genuinely needed (e.g. the future native app).
- **PostgreSQL 16.**
- **Prisma** ORM. Prisma for everything transactional; raw SQL / DB views for heavy report aggregations.
- **TypeScript**, **pnpm**.
- **Zod** for validation, at every server-action / route-handler boundary. Schemas live in `src/lib/schemas/` and are shared by client and server.
- **Auth:** custom cookie sessions — **bcrypt** password hashing + a server-side `Session` row + a signed httpOnly cookie (`jose`). Superadmin provisions all users; no self-signup, no OAuth. A DB-backed session means a deactivated user is locked out immediately.
- **UI:** Tailwind. React Hook Form + Zod on forms. Charts: ECharts (or Recharts to start).
- **Exports:** ExcelJS (xlsx); print-CSS for the feed pull-list and OVK pemakaian sheet.
- **Scheduled work:** a route handler hit by an external cron (e.g. the host's scheduler) for low-stock alerts / rollups. No queue/Redis until genuinely needed.
- **Tests:** Vitest. Test the `src/lib/server/*` functions directly — they are plain async functions, which is the main reason that's where the logic lives.
- Prisma 7.x note: This project uses Prisma 7 with a prisma.config.ts that loads env via dotenv (import 'dotenv/config'). prisma and @prisma/client are installed as local deps. Env is not auto-loaded — for test runs against eggfarm_test, ensure Prisma/Vitest load .env.test (e.g. dotenv -e .env.test) rather than .env. prisma.config.ts replaces the old package.json#prisma block, so wire the seed via the config file's migrations/seed settings.

PWA later (installable). A future native app, if it happens, consumes route handlers under `app/api/`.

---

## 4. Commands

```bash
pnpm dev                            # run app in dev (:3000)
pnpm build && pnpm start            # production build + serve
pnpm test                           # Vitest
npx prisma migrate dev --name <x>   # create + apply a migration
npx prisma studio                   # inspect data
npx prisma generate                 # regenerate client after schema edits
```

DB connection (local socket auth, no password):
```
DATABASE_URL="postgresql://<macuser>@localhost:5432/eggfarm?schema=public"
```

---

## 5. Architecture — the load-bearing rules

These are the decisions that are expensive to unwind. Everything else is ordinary CRUD and can be changed with a migration. **Do not violate these.** Because Next.js gives less enforced structure than a classic backend, rules 5.4 and 5.5 are how we keep the discipline — treat them as non-negotiable.

### 5.1 The ledger is the source of truth; stock is a projection of it
- `StockMovement` is an **append-only ledger** — every IN/OUT/CORRECTION/VOID, forever. **Never UPDATE or DELETE a ledger row.**
- `WarehouseStock` is a **balance cache** per Egg SKU per warehouse (`currentQuantity` in pcs). It is *derived* from the ledger — never an independent truth.
- **Every ledger write and its balance update happen inside one interactive `prisma.$transaction`** — both commit or neither does.
- Stock must always be reconstructable by folding the ledger. If balance and ledger disagree, the ledger wins.
- **Corrections** are immutable: record `preQuantity` and `postQuantity` and a mandatory reason (≥20 chars). To fix a wrong correction, write a *second* correction — never edit.
- **Voids** reverse by writing compensating `VOID` movements, never by deleting the originals.

### 5.2 Lock rows on every stock write
- Any stock mutation runs in an interactive transaction that **locks the affected `WarehouseStock` rows** (`SELECT … FOR UPDATE`, via `tx.$queryRaw` inside the transaction) before read-then-write. Two concurrent sales must never oversell the same SKU.
- A multi-line sale is **atomic**: lock all affected SKU rows, validate every line, then deduct all. If any line is short, the **entire** transaction fails with an error naming the short SKU. No partial deductions, ever.

### 5.3 Store computed values write-once
- Persist derived values, do not recompute on read: `HD%`, daily `FCR`, the netted feed mix (`TOTAL CAMPUR` / `PAKAN MASUK`), the running `HIDUP` snapshot, `maxBatchesAtEntry`.
- Written at record creation and **frozen**. A later formula change must not silently rewrite history. Keep raw inputs too, so future records use the new formula going forward.

### 5.4 One ledger file is the ONLY writer of stock  ← critical for this stack
- A single server-only module, **`src/lib/server/ledger.ts`**, is the *only* place in the codebase that creates a `StockMovement` or updates `WarehouseStock`.
- Every feature that moves stock (collection's Angkat Rak, grading submit, sales, corrections, voids) calls a function exported from `ledger.ts`. **No other file ever calls `prisma.stockMovement.*` or writes `warehouseStock`.**
- This is what replaces the structure a classic backend would enforce. If stock writes leak into random server actions, the system loses its integrity guarantees. Hold this line.
- **As-built: rule 5.4 is realized as THREE parallel single-writer ledgers**, one per stock domain, each the *sole* writer of its own balance + append-only movement table, each with the same locked-core discipline (FOR UPDATE, movement+balance in one transaction, reject-negative) and each with an immutable supervised **correction** (pre/post + a mandatory reason; fix a wrong one with a second correction, never an edit):
  - `src/lib/server/ledger.ts` → `StockMovement` / `WarehouseStock` (egg stock, pcs; correction reason ≥ 20).
  - `src/lib/server/ingredientLedger.ts` → `IngredientMovement` / `IngredientStock` (feed, kg Decimal; delivery IN, mixing draw-down OUT, correction ≥ 20).
  - `src/lib/server/ovkLedger.ts` → `OvkMovement` / `OvkStock` (OVK office stock, base-unit Decimal; delivery IN, office→kandang transfer OUT, correction ≥ 20).
  - VAKSIN is deliberately NOT a ledger — it has no inventory (§6 VAKSIN).

### 5.5 Every server action and protected route handler guards its role  ← critical for this stack
- A **server action is a public endpoint**, even though it's called like a function. Auth/role checks must run *inside* it, not in the UI.
- The first line of every mutating server action / protected route handler is `await requireRole(...)` (or `requireUser()`), from `src/lib/server/auth.ts`. UI hiding is never sufficient.
- The Owner role is **read-only**: it must be rejected by `requireRole` on every write path. Middleware may redirect unauthenticated users, but real enforcement is in the server function.

---

## 6. Domain rules & invariants

### Units (critical)
- **Store every egg quantity in pcs as an integer. Never store rak.**
- 1 rak = 30 pcs. Display via one shared formatter (`src/lib/units.ts`): pcs → `"X rak + Y pcs"` (e.g. 2617 → `87 rak + 7 pcs`). Apply everywhere.
- Entry accepts rak **or** pcs and converts to pcs on save. Mixed format is display-only.
- Feed (kg) and OVK quantities use Prisma `Decimal`, not float.

### Business day (WITA) — critical
- The farm's business day is **Asia/Makassar (WITA, UTC+8, no DST)** — the calendar day flips at 00:00 WITA (= 16:00 UTC the previous day). **Do not change this.**
- `src/lib/dates.ts` (`toBusinessDate` / `businessToday`, pure + shared) is the single source of truth for "what business day is it". Business dates are stored date-only (Prisma `@db.Date`, the UTC-midnight of the WITA calendar day); audit timestamps stay UTC.

### Grade model → Egg SKU
- **Grade by Size & Health** (enum, stockable): `ANGKAT_RAK, A_PLUS_PLUS, A_PLUS, A, B, C, KECIL, MINI, RETAK, PLASTIK, LUNAK`.
- `KOSONG` (empty shells) is **tracking-only**: counted for HD%/productivity, **never enters grading or stock**.
- **Grade by Type** (table, extensible by Superadmin): Normal, Omega, … referenced by `typeGradeId`.
- **Egg SKU = (sizeHealthGrade, typeGradeId)** composite. Full matrix: every active Size × active Type is valid; no allow-list.
- `PLASTIK` and `LUNAK` are pcs-only; both saleable, both enter stock.

### Type capture (by physical separation)
- Collection is **Type-agnostic** for Good/Retak/Lunak/Kosong (single numbers, for entry speed).
- **Angkat Rak is split by Type per lift** at collection; each Type posts to warehouse immediately as SKU `Angkat Rak / <Type>` on collection save.
- **Grading is Type-aware via tabs**: under each Type tab, the 11 Size & Health grades. The live counter sums across all tabs vs `(Good Eggs − total Angkat Rak)`. Per-Type cross-check is intentionally impossible; integrity rests on physical separation.
- **Same-WITA-day grading + collection lock (as-built).** A grading record is tied to its collection's **production business day** — grading and collection share the same (kandang, date, batch). Once a batch's grading is **SUBMITTED, its collection counts are locked** (a plain edit is rejected) so a submitted reconcile can't be invalidated behind its back. A **Superadmin may override** the lock to correct the collection, but the edit is refused if it would strand the graded total over the new available, and the compensating Angkat Rak movements carry an audit reason. **The override never re-dates grading to a different day or splits a batch's stock across dates** — attribution stays on the production day so stock, the reconcile, and the daily bucket sub-split stay correct. Admins get the hard lock, no override.
- Grading is **edit-after-submit**: re-submitting reconciles stock by delta (append IN/OUT, never rewrite). A downward edit the warehouse can't cover (stock already sold) is rejected by the ledger.

### Roles (3, enforced server-side via §5.5)
- `SUPERADMIN` — users; flock creation/lifecycle; **all master/catalog data** (units, grade types, feed ingredients, OVK items, vaksin types). Can do anything the others can.
- `ADMIN` — all daily operations + **operational config** (farmhouses, warehouses, mapping, buyers). Cannot manage users, create flocks, or edit master data.
- `OWNER` — **read-only**. Every write path rejects Owner. Owner sees only the dashboard/reports.

### Flock & placement
- A **Flock** = one chick-in delivery: strain, chick-in date, placement age (days at chick-in). May span multiple kandang.
- A **Placement** = a flock's portion in one kandang, with its own `Populasi Awal` and its own daily ledger. One **active** placement per kandang at a time — enforced both in-service *and* by a raw-SQL partial unique index (`UNIQUE(farmhouseId) WHERE status='ACTIVE'`).
- `HARI` = placement age + business days since chick-in (flock-wide). **`MINGGU = ceil(HARI / 7)`** (as-built, confirmed: the farm counts by bird age, so day-120 = week 18, day-119 = week 17).
- `HIDUP` is **per placement, running** = prev HIDUP − MATI − AFKIR, seeded at `Populasi Awal` on chick-in — persisted as a write-once **`HidupSnapshot`** per placement-day (§5.3), never recomputed from birth. **Day-0 (chick-in-day) mortality is recordable** and nets off Populasi Awal: `HIDUP(day-0) = Populasi Awal − MATI₀ − AFKIR₀` (updates the seed snapshot, write-once).
- Superadmin-only lifecycle: chick-in, **end placement** (frees the kandang; history retained across re-population), and a narrow **Populasi Awal correction** (a chick-in-typo escape hatch that re-bases every HIDUP snapshot by the delta; blocked once daily records exist). Strain / chick-in date / placement-set are otherwise fixed.

### Daily farmhouse recording
- One record per kandang/day for the active placement. Most fields **derived**; Admin types only: MATI, AFKIR, SISA DIGUNAKAN, SISA DIBUANG, BERAT TELUR (daily egg mass, kg), BERAT BADAN (weekly sample, record-only), OBAT note, VITAMIN note, KETERANGAN.
- Four egg buckets (derived from collection, reconciled to grading): **Utuh** (A++…Mini + Angkat Rak), **Lunak**, **Pecah** (Retak + Plastik), **Kosong**. Daily total stable from collection; only the Pecah sub-split firms after grading.
- `HD% = (Utuh + Lunak + Pecah + Kosong) / HIDUP × 100` (all eggs — a hen-productivity signal).
- `FCR = REALISASI INTAKE / BERAT TELUR` (daily).
- PAKAN block (4 cols): MASUK (fresh netted mix, from mixing), TERSEDIA (MASUK + yesterday's reusable sisa), SISA DIGUNAKAN (input, carries forward), SISA DIBUANG (input, discarded). `REALISASI INTAKE = TERSEDIA − (DIGUNAKAN + DIBUANG)`; `GRAM/EKOR = INTAKE / HIDUP × 1000`.
- **Write-once vs live-derived (as-built, §5.3).** *Frozen* at record creation and never silently recomputed: `HIDUP`, `HD%`, MATI/AFKIR, and — once the day's mix exists — the PAKAN block (`PAKAN MASUK` = TOTAL CAMPUR, TERSEDIA, REALISASI INTAKE, GRAM/EKOR, FCR, JENIS, reusable-leftover-in). PAKAN MASUK is posted write-once from the mixing event: at record creation if the mix already exists (the night-before norm), else when the mix is confirmed (first-write-wins). *Live-derived on read* (always reflect the current source, never stored on the record): the four egg buckets, and the **VAKSIN field** (read from the vaksin log for that kandang/date). OBAT/VITAMIN are notes only (see OVK).

### PAKAN (feed)
- Single central raw-ingredient store. Delivery = Admin input, increases ingredient stock.
- Mixing is **per kandang per consumption day** (mixed the night before, **dated to the consumption day**). Requirement = HIDUP × projected intake (g/bird, Admin input) ÷ 1000.
- Fresh mix `TOTAL CAMPUR = requirement − reusable sisa`, **floored at 0** (leftover can exceed requirement → no-mix day). `PAKAN MASUK = TOTAL CAMPUR`.
- Main feeds by **% of the netted fresh mix** (sum 100%); supplements/premix as **fixed weights** (not auto-scaled). Mixing draws down each ingredient by computed/entered weight.
- Outputs: printable per-kandang ingredient **pull-list**; posts MASUK/TERSEDIA + JENIS into the daily record.

### OVK (Obat / Vitamin / Chemical)
- One master list with a category and per-item base unit + conversions where needed. One central office store; office stock moves through **`ovkLedger.ts` only** (§5.4).
- Delivery → office stock **up**. **Office→kandang transfer is the stock-reduction event** (not hen administration), attributed to a kandang with an optional note; refuses to go negative.
- **Unit-conversion mechanism (as-built).** Stock is held in each item's base unit; entries may use a converted unit (e.g. `1 botol = 1 liter`, `1 pcs = 100 gram`) via per-item `OvkUnitConversion` rows. The pure helper (`src/lib/ovk.ts` `conversionFactor` / `convertToBaseUnit`) is **reusable for feed `karung→kg`**, which isn't wired into PAKAN yet (feed entries are kg; A34).
- Daily-record OBAT/VITAMIN are **notes only** — they never move OVK stock (no double counting). Chemicals have no daily column.
- Pemakaian (usage) report: per kandang, date range — date, item, qty out (as entered), unit, note.

### VAKSIN
- Activity log only (date, vaksin type, vials, kandang, vaccinator). **No inventory** — deliberately NOT a stock ledger (no stock, deliveries, or draw-downs). Type master is Superadmin (soft-delete; a deactivated type is excluded from new logs, history retained).
- The daily record's VAKSIN field is a **live read of the log** for that kandang/date (single source of truth) — derived, not stored, not write-once.

### Data retention
- Production/grading/stock/flock/feed/OVK/vaksin records retained indefinitely. Audit logs ≥3 years.
- **Soft-delete only** (status flags); never hard-delete operational/historical data.

### Data model additions since v2.0 (as-built)
Tables that exist in the shipped schema but weren't (fully) in the original SRS §7 — see `prisma/schema.prisma` and SRS §7.1 for attributes:
- **`HidupSnapshot`** — the running-HIDUP ledger: one write-once row per (placement, business date), seeded at chick-in; resolved latest-≤-date, never recomputed.
- **`IngredientMovement` / `IngredientStock`** — the feed stock ledger + balance cache (delivery IN, mixing draw-down OUT, correction). Feed deliveries are movements, not a separate table.
- **`MixingRecord` / `MixingLine`** — a kandang's consumption-day mix (frozen requirement / TOTAL CAMPUR / JENIS) + its recipe lines (main-% or fixed-weight).
- **`OvkItem` / `OvkUnitConversion` / `OvkStock` / `OvkMovement`** — OVK master + per-item conversions + office balance + one ledger for delivery/transfer/correction (replaces the SRS's separate OVK Delivery / Transfer tables).
- **`VaksinType` / `VaksinLog`** — vaksin master + activity log; **no stock tables**.
- **`FarmhouseWarehouseMapping` / `FarmhouseBatchSetting`** — append-only **effective-dated** logs (the assignment/value in force on a date = greatest `effectiveFrom ≤ date`); a batch-count change is future-dated to +1 day.
- **`LowStockThreshold`** — its own table (per warehouse + Egg SKU minimum), so a threshold write never touches the ledger-owned balance cache.
- **`AngkatRakLift`** — one row per Type lifted within a collection.
- **`Session`** — DB-backed auth session (id-only signed cookie).
- **`DailyRecord`** (as-built) — carries the extra frozen columns (`hdPercent`, `pakanMasuk`/`pakanTersedia`/`realisasiIntake`/`gramPerEkor`/`fcr`, `jenis`, `reusableLeftoverIn`) and has **no** VAKSIN column (derived from the log).
- **`CORRECTION` movement type** on all three ledgers (`StockMovement` / `IngredientMovement` / `OvkMovement`).

---

## 7. Conventions

- **Prisma singleton:** one client via the standard Next global pattern in `src/lib/server/db.ts` (`globalThis.prisma ??= new PrismaClient()`), to survive dev hot-reload without exhausting connections. Never `new PrismaClient()` elsewhere.
- **Server-only code** lives under `src/lib/server/` and starts with `import 'server-only'`. Never import it into a client component.
- **Transactions:** all stock/ledger writes use interactive `prisma.$transaction(async (tx) => …)` inside `ledger.ts`; lock with `tx.$queryRaw\`… FOR UPDATE\``. Use the `tx` client for every query in the block.
- **Mutations = server actions** (`'use server'`), each: (1) `await requireRole(...)`, (2) `schema.parse(input)` with Zod, (3) call the relevant `src/lib/server/*` function, (4) `revalidatePath`/return typed result.
- **Reads** = server components calling `src/lib/server/*` query functions directly (no fetch round-trip).
- **Audit fields:** every operational record carries `enteredById` + timestamps (UTC).
- **Money/quantities:** egg counts integer pcs; feed/OVK `Decimal`. No floats for quantities.
- **Errors:** throw typed errors; Owner/role violation → 403-equivalent; duplicate (e.g. collection for kandang+date+batch) → conflict; oversell error names the short SKU.
- **Migrations:** one Prisma migration per change, descriptive name. Never edit an applied migration; add a new one.
- **Enums** for Size & Health grade, movement type, source type, role, status, OVK category, ingredient category. Grade *Type* is a table (extensible), not an enum.

### Project layout (App Router; add areas only as slices reach them)
```
prisma/                     # schema.prisma + migrations
src/
  app/
    (auth)/login/           # public login
    (app)/                  # protected pages (layout calls requireUser)
      warehouse/            # Slice 1 UI lives here
    api/                    # route handlers — only where a REST endpoint is needed
  lib/
    units.ts                # pcs <-> rak (pure, shared client+server)
    schemas/                # Zod schemas (shared client+server)
    server/                 # server-only ('import server-only')
      db.ts                 # Prisma singleton
      auth.ts               # requireUser / requireRole, session helpers
      ledger.ts             # the ONLY writer of stock (rule 5.4)
      <feature>.ts          # query/command functions per feature
  components/               # shared UI
```

---

## 8. Current target — Slice 1 (foundation proof)

Build **only** the warehouse ledger + projection, to prove rules 5.1, 5.2, and 5.4 end to end before any other feature:

- Prisma schema: `SizeHealthGrade` enum, `MovementType`/`SourceType` enums, `GradeType`, a minimal `Warehouse`, `StockMovement` (append-only ledger), `WarehouseStock` (balance per warehouse+SKU, pcs).
- `src/lib/units.ts`: pcs⇄rak + `formatPcs` → `"X rak + Y pcs"`.
- `src/lib/server/db.ts`: Prisma singleton.
- `src/lib/server/ledger.ts`: the only stock writer — `recordIn(...)` and `recordOut(...)`, each in one `prisma.$transaction` with `FOR UPDATE` locking; `recordOut` **rejects atomically if the balance would go negative**. Plus `getStock(warehouseId)` and `getLedger(warehouseId)` read functions.
- Server actions (`'use server'`) wrapping `recordIn`/`recordOut`, each Zod-validated. (Auth guard is stubbed until Slice 2, but leave the `requireRole` call site in place with a TODO.)
- A minimal page under `app/(app)/warehouse/` showing current stock (rak+pcs) and the movement ledger.
- Seed: two `GradeType` rows (Normal, Omega) and one warehouse.
- Vitest tests calling `ledger.ts` directly: (a) movement + balance stay in lockstep; (b) oversell is rejected with no partial write.

Stop there. No grading, sales, flock, auth UI, or other features in this slice.

---

## 9. Guardrails — do NOT

- Do not add a separate backend server, microservices, or a message bus. Next.js full-stack owns everything.
- Do not write `StockMovement`/`WarehouseStock`, `IngredientMovement`/`IngredientStock`, or `OvkMovement`/`OvkStock` anywhere except their one ledger file — `ledger.ts`, `ingredientLedger.ts`, `ovkLedger.ts` respectively (rule 5.4).
- Do not put a mutation in a server action without `await requireRole(...)` as its first line (rule 5.5).
- Do not store rounded rak. pcs only; convert at display.
- Do not UPDATE or DELETE a ledger row. Append compensating movements instead.
- Do not read-then-write stock without a row lock.
- Do not recompute and overwrite a frozen historical computed value.
- Do not hard-delete operational/historical data. Soft-delete via status.
- Do not make collection Type-aware (except Angkat Rak). Keep it single-number.
- Do not let daily OBAT/VITAMIN notes move OVK stock.
- Do not import `src/lib/server/*` into client components.
- Do not build offline support, multi-farm, accounting, or hardware integration — out of scope for v2 (SRS §10).

When a requirement here is ambiguous, check `docs/SRS.md`; if still unclear, ask before guessing.