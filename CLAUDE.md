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

Greenfield. PostgreSQL (`eggfarm` DB) and Prisma are set up. Building **foundation-first, one vertical slice at a time** (see `BUILD_PLAN.md`). Do not scaffold all features up front. Current target is **Slice 1** (§8).

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

### Roles (3, enforced server-side via §5.5)
- `SUPERADMIN` — users; flock creation/lifecycle; **all master/catalog data** (units, grade types, feed ingredients, OVK items, vaksin types). Can do anything the others can.
- `ADMIN` — all daily operations + **operational config** (farmhouses, warehouses, mapping, buyers). Cannot manage users, create flocks, or edit master data.
- `OWNER` — **read-only**. Every write path rejects Owner. Owner sees only the dashboard/reports.

### Flock & placement
- A **Flock** = one chick-in delivery: strain, chick-in date, placement age (days at chick-in). May span multiple kandang.
- A **Placement** = a flock's portion in one kandang, with its own `Populasi Awal` and its own daily ledger. One **active** placement per kandang at a time.
- `HARI`/`MINGGU` shared from hatch (age). `HIDUP` is **per placement, running** = prev HIDUP − MATI − AFKIR, seeded at chick-in. Snapshot HIDUP onto each daily record.
- Ending a placement (Superadmin) frees the kandang; history retained across re-population.

### Daily farmhouse recording
- One record per kandang/day for the active placement. Most fields **derived**; Admin types only: MATI, AFKIR, SISA DIGUNAKAN, SISA DIBUANG, BERAT TELUR (daily egg mass, kg), BERAT BADAN (weekly sample, record-only), OBAT note, VITAMIN note, KETERANGAN.
- Four egg buckets (derived from collection, reconciled to grading): **Utuh** (A++…Mini + Angkat Rak), **Lunak**, **Pecah** (Retak + Plastik), **Kosong**. Daily total stable from collection; only the Pecah sub-split firms after grading.
- `HD% = (Utuh + Lunak + Pecah + Kosong) / HIDUP × 100` (all eggs — a hen-productivity signal).
- `FCR = REALISASI INTAKE / BERAT TELUR` (daily).
- PAKAN block (4 cols): MASUK (fresh netted mix, from mixing), TERSEDIA (MASUK + yesterday's reusable sisa), SISA DIGUNAKAN (input, carries forward), SISA DIBUANG (input, discarded). `REALISASI INTAKE = TERSEDIA − (DIGUNAKAN + DIBUANG)`; `GRAM/EKOR = INTAKE / HIDUP × 1000`.

### PAKAN (feed)
- Single central raw-ingredient store. Delivery = Admin input, increases ingredient stock.
- Mixing is **per kandang per consumption day** (mixed the night before, **dated to the consumption day**). Requirement = HIDUP × projected intake (g/bird, Admin input) ÷ 1000.
- Fresh mix `TOTAL CAMPUR = requirement − reusable sisa`, **floored at 0** (leftover can exceed requirement → no-mix day). `PAKAN MASUK = TOTAL CAMPUR`.
- Main feeds by **% of the netted fresh mix** (sum 100%); supplements/premix as **fixed weights** (not auto-scaled). Mixing draws down each ingredient by computed/entered weight.
- Outputs: printable per-kandang ingredient **pull-list**; posts MASUK/TERSEDIA + JENIS into the daily record.

### OVK (Obat / Vitamin / Chemical)
- One master list with a category and per-item base unit + conversions where needed. One central office store.
- Delivery → office stock **up**. **Office→kandang transfer is the stock-reduction event** (not hen administration).
- Daily-record OBAT/VITAMIN are **notes only** — they never move OVK stock (no double counting). Chemicals have no daily column.
- Pemakaian (usage) report: per kandang, date range — date, item, qty out, unit, note.

### VAKSIN
- Activity log only (date, vaksin type, vials, kandang, vaccinator). **No inventory.** Daily VAKSIN field derives from the log.

### Data retention
- Production/grading/stock/flock/feed/OVK/vaksin records retained indefinitely. Audit logs ≥3 years.
- **Soft-delete only** (status flags); never hard-delete operational/historical data.

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
- Do not write `StockMovement` or `WarehouseStock` anywhere except `src/lib/server/ledger.ts` (rule 5.4).
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