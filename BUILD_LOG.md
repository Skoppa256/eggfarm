# BUILD_LOG.md — EggFarm IMS

Running log of what was built, slice by slice. Newest summary on top.

---

## CURRENT STATUS (updated after Slice 8)

- **Slices complete & committed:** Slices 1–6 + refactor + WITA fix, Slice 7
  (buyers + sales & dispatch), and **Slice 8 (flock & placement lifecycle)**.
- **Gates:** `tsc --noEmit` clean · `eslint` clean · Vitest **76/76 pass** (against `eggfarm_test`) · `next build` succeeds.
- **Next up:** Slice 9 (daily farmhouse recording) — MATI/AFKIR entry drives HIDUP
  via the write-once `applyDailyMortality` helper built this slice; feed/egg buckets, HD%/FCR.
- **Timezone: CONFIRMED WITA.** Farm is in Makassar → business day is Asia/Makassar
  (WITA, UTC+8, no DST), in `src/lib/dates.ts` (committed `b1b00df`). Settled.
- **Note:** this repo is under `~/Documents` (iCloud-synced), which spawns `"* 2"` conflict copies
  in `.next`; `tsconfig.json` now excludes that pattern so `tsc` stays green. **iCloud has also
  been observed restoring git-deleted files as untracked** (a Slice-6-deleted
  `test/warehouse-action.test.ts` reappeared and broke the test run). Before each commit, check
  `git status -s | grep '^??'` for unexpected untracked files and `rm` any stale resurrected ones.
- **Benign warning:** the pg driver adapter prints a `DeprecationWarning` ("client.query()
  … already executing") during transaction-heavy tests. It's from `@prisma/adapter-pg`/`pg`,
  not our code; tests are green and stable. Revisit at the next pg/Prisma upgrade.

### Migrations (apply in order; `pnpm test` and `pnpm db:deploy` do this for you)
1. `slice1_warehouse_ledger` · 2. `slice2_auth_users` · 3. `enteredby_fk_to_user` ·
4. `slice3_config_master_data` · 5. `slice4_collection_input` · 6. `slice5_grading` ·
7. `slice6_low_stock_thresholds` · 8. `slice7_buyers_sales` · 9. `slice8_flock_placement`.
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
- **Nothing blocking.** No HD%/FCR/feed math yet (those land in Slice 9); flock
  HARI/MINGGU/HIDUP now exist.
- **MINGGU = floor(HARI / 7) (Slice 8).** SRS §3.9 gives `MINGGU = HARI / 7`; I read this as the
  integer week index (`Math.floor`), so HARI 113 → MINGGU 16, HARI 120 → 17. Change `computeMinggu`
  in `src/lib/flock.ts` if a 1-based or rounded week is wanted. (Assumption A19.)
- **No flock editing after chick-in (Slice 8).** A flock's strain / chick-in date / placement age
  and its set of placements are fixed at creation; the only lifecycle mutation is Superadmin
  end-placement. Add an edit path if correcting a mis-entered chick-in is needed. (Assumption A20.)
- **Chick-in-day mortality not supported (Slice 8).** The seed HIDUP snapshot occupies the
  (placement, chick-in date) slot at Populasi Awal, and `applyDailyMortality` requires a prior
  snapshot strictly before the entry date — so the first MATI/AFKIR can be recorded from the day
  after chick-in onward, not on day 0. Flag if day-0 deaths must be recordable. (Assumption A21.)
- **`HidupSnapshot` is a new model, not in SRS §7 (Slice 8).** Added to persist the running HIDUP
  write-once (rule 5.3) as one row per placement-day, per your instruction — seeded at chick-in,
  read latest-≤-date, never recomputed. The SRS §7 data model didn't list it. (Assumption A22.)
- **One active placement per kandang is enforced in the service, not a DB constraint (Slice 8).**
  The check runs inside `createFlock`'s transaction (Prisma can't express a partial unique index
  declaratively). A raw partial index (`… WHERE status = 'ACTIVE'`) could be added later for
  defense-in-depth. (Assumption A23.)
- **Void reason ≥ 10 chars (Slice 7, revised per your A16 review).** The SRS says a void needs a
  "mandatory reason" without a length. Bumped from ≥ 3 to **≥ 10** in `voidSaleSchema`, `voidSale`,
  and the void form (`minLength`), with a test. Corrections remain ≥ 20 by explicit spec. (Assumption A16.)
- **Sales line entry uses growable rows (Slice 7).** The new-sale form starts with 3 rows and an
  "Add line" button; empty rows are ignored on submit. No per-row delete (a UX nicety); duplicate
  SKUs across lines are allowed and validated against the aggregate. (Assumption A17.)
- **Buyer profile (FR-39, "Should Have") deferred.** Buyers have full CRUD + soft-delete; the
  per-buyer aggregate profile (totals by SKU, history) is not built — fits naturally with the
  reports in Slice 13. (Assumption A18.)
- **Removed the Slice 1 demo (Slice 6).** The generic "Stock In/Out" (ADJUSTMENT) form on
  `/warehouse` was a foundation-proof demo, not an SRS feature — real stock moves via
  collection / grading / sales / corrections. I deleted it and rebuilt `/warehouse` as the
  real stock view; its Owner-rejected coverage moved to the correction/threshold tests.
  `SourceType.ADJUSTMENT` remains in the enum (now unused) in case you want a manual-adjust
  tool later. (Assumption A13.)
- **Warehouse selectors include inactive warehouses (Slice 6)** so stock/ledger in a
  deactivated warehouse stays viewable and correctable. (Assumption A14.)
- **Low-stock alerts (FR-27, "Should Have")** are surfaced on the warehouse view (flagged
  cells + a banner); the dashboard surfacing lands with Slice 13. (Assumption A15.)
- **Collection units (Slice 4).** Good/Retak/Lunak/Kosong are entered in **pcs** (FR-07 says
  "all in pcs"); **Angkat Rak is entered in rak** (whole racks) and converted ×30 to pcs.
  Change the collection form if counts should also accept rak. (Assumption A9.)
- **Editing a collection downward** posts a compensating Angkat Rak **OUT**; if that stock was
  already dispatched/sold, the edit is rejected by the ledger (can't go negative). That's the
  safe behavior, but flag if you'd prefer a different policy. (Assumption A10.)
- **Grading edit-after-submit (Slice 5).** Per your spec, a submitted batch can be edited and
  re-submitted; stock reconciles by delta (append IN/OUT). This extends FR-14's "already graded →
  locked" (which forbade re-grading). A downward edit that the warehouse can't cover (stock
  already sold) is rejected by the ledger, same as A10. (Assumption A11.)
- **Grading reconcile is live, not snapshotted (Slice 5).** Graded-total ≤ available (Good Eggs −
  Angkat Rak) is validated against the collection at submit/edit time. If the collection is edited
  *after* grading, grading is not auto-re-validated — that cross-check surfaces in the daily record
  (Slice 9). No extra write-once field was needed on the grading record. (Assumption A12.)
- **A6 — RESOLVED.** The business day is now WITA (Asia/Makassar, UTC+8, no DST):
  `toBusinessDate` / `businessToday` in `src/lib/dates.ts` are the single source of
  truth, and Slice 3's mapping/batch date logic uses them. Timestamps stay UTC;
  only the derived business date is WITA.
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

## Slice 8 — Flock & placement lifecycle ✅

**Goal (BUILD_PLAN / SRS §3.9 / §2 / §7, CLAUDE.md §6 "Flock & placement"):** Superadmin
chick-in of a flock (a chick-in delivery) into one or more kandang, each kandang a
Placement with its own Populasi Awal and its own running HIDUP; end-placement lifecycle
that frees the kandang and ends the flock when its last placement ends; the flock-age
derivations (HARI/MINGGU/HIDUP). Daily MATI/AFKIR *entry* is Slice 9 — this slice builds
the model + the write-once HIDUP helper it will call.

### What was built
- **Schema** → migration #9 `slice8_flock_placement`: `FlockStatus`/`PlacementStatus`
  (ACTIVE/ENDED); `Flock` (strain, `chickInDate` `@db.Date`, `placementAge` = days at
  chick-in, status, `createdById` FK); `Placement` (flock, farmhouse, `populasiAwal`,
  start/end dates, status; `@@index([farmhouseId, status])`); **`HidupSnapshot`** (per
  placement-day: `mati`/`afkir`/`hidup`, `@@unique([placementId, date])`, cascade-deletes
  with its placement) — the write-once running-HIDUP store (rule 5.3). Back-relations
  `User.createdFlocks` and `Farmhouse.placements`.
- **`src/lib/flock.ts`** (pure, shared) — `computeHari(placementAge, chickInDate, asOf)`
  `= placementAge + daysBetween(chickInDate, asOf)` (age shared across the whole flock) and
  `computeMinggu(hari) = Math.floor(hari / 7)`. Added `daysBetween` to `src/lib/dates.ts`.
- **`src/lib/server/flocks.ts`** (service; Superadmin-gated at the action layer):
  - `createFlock(input, ctx)` — validates placement age (int ≥ 0), ≥ 1 placement, each
    Populasi Awal (int > 0), no duplicate kandang, and every kandang exists + is ACTIVE;
    then in ONE `$transaction` (with `TX_OPTIONS`) re-checks **one ACTIVE placement per
    kandang** (occupied → `ConflictError`), creates the flock, and per placement creates the
    `Placement` + seeds a HIDUP snapshot of `hidup = populasiAwal` on the chick-in date.
  - `endPlacement(placementId, endDate)` — validates end ≥ chick-in; in a transaction, an
    atomic ACTIVE-guarded `updateMany` flips the placement to ENDED (idempotent — a repeat
    end throws), then ends the flock iff no ACTIVE placements remain. Frees the kandang for
    re-population; prior placements + their HIDUP snapshots are retained.
  - `resolveHidup(placementId, asOf)` — the running HIDUP at end of `asOf` = the latest
    snapshot with `date ≤ asOf` (read, never recomputed); `null` before chick-in.
  - `applyDailyMortality(placementId, date, mati, afkir)` — the Slice-9 building block:
    new HIDUP = (latest snapshot strictly **before** `date`) − MATI − AFKIR; rejects
    non-integers/negatives, going below zero (names the constraint), a missing prior
    snapshot, and overwriting an existing snapshot (write-once).
  - `listFlocks` / `getFlock` / `listFreeFarmhouses` (active kandang with no ACTIVE placement).
- **Zod schemas** (`schemas/flocks.ts`) + **Superadmin-only actions** (`requireRole("SUPERADMIN")`
  first line, rule 5.5; Owner *and Admin* rejected): `createFlockAction` (reads the dynamic
  `placement.<i>.*` rows, skips blanks, redirects to the new flock on success),
  `endPlacementAction`. **UI:** `/flocks` (list, ACTIVE/ENDED), `/flocks/new` (Superadmin
  chick-in form — header + growable per-kandang placement rows from the free-kandang list),
  `/flocks/[id]` (flock HARI/MINGGU today, per-placement HIDUP-today, Superadmin end form);
  nav link for Admin/Superadmin.
- **Tests (10 new, 76 total):** flock spanning 2 kandang seeds HIDUP = Populasi Awal per
  placement (null before chick-in); occupied-kandang chick-in rejected; HARI/MINGGU worked
  examples (placement age 113, chick-in 2026-07-01 → HARI 113/120/127, MINGGU 16/17/18);
  HIDUP carry-forward 1000→993→990→980 across a gap, write-once + over-cull rejected; ending
  one placement keeps the flock ACTIVE, frees K1 for a new flock, and retains the old HIDUP;
  ending the last placement ends the flock and a double-end is rejected; a non-Superadmin
  (ADMIN) is rejected on both create and end, and a Superadmin chick-in creates
  flock + placement + seed snapshot through the action.

### Key decisions
- **HIDUP as a write-once per-placement-day snapshot (rule 5.3), not a recompute.** A
  dedicated `HidupSnapshot` table seeded at chick-in; `resolveHidup` reads the latest
  snapshot ≤ date and `applyDailyMortality` carries forward from the latest snapshot < date
  and refuses to overwrite — so a formula/data change never silently rewrites flock history.
- **HARI/MINGGU are pure functions of age + business days**, unit-tested against worked
  examples; MINGGU = `floor(HARI/7)` (assumption A19). Age is flock-wide; HIDUP is per placement.
- **One-active-placement-per-kandang enforced inside the create transaction** (assumption
  A23); **end-placement is idempotent** via a status-guarded `updateMany`, mirroring the void
  pattern from Slice 7.

### Test status
`pnpm test` → **76 passed** (20 files), stable across runs. `tsc`, `eslint`, `next build` all clean.

---

## Slice 7 — Buyers + Sales & Dispatch ✅

**Goal (BUILD_PLAN / SRS §3.5–3.6):** buyer CRUD; atomic multi-line sales that deduct
stock all-or-nothing; void that restores stock via compensating movements.

### What was built
- **Schema** → migration #8: `SalesStatus` (ACTIVE/VOIDED); `Buyer` (soft-delete);
  `SalesTransaction` (warehouse, buyer, business date, status, void fields, notes) +
  `SalesLineItem` (Egg SKU, pcs, `unitUsed`).
- **ledger.ts:** `recordVoidTx` — a compensating VOID movement that ADDS stock back,
  reusing the shared `applyMovementTx` core (no second stock path; CLAUDE.md §5.1).
- **sales.ts:**
  - `createSale` — validates the warehouse is ACTIVE (dispatch target) and the buyer is
    ACTIVE, then in ONE transaction writes the header + line items and deducts each line
    via `recordOutTx`, **iterating in a deterministic SKU-sorted order** so two concurrent
    sales lock rows in the same order (deadlock-free). A short line makes `recordOutTx`
    throw naming the SKU → the whole transaction rolls back (no partial deduction). One
    OUT per line (FR-30/31).
  - `voidSale` — restores each line via `recordVoidTx` and flips status with an atomic
    `updateMany where status=ACTIVE` guard, so a concurrent/repeat void can't double-run
    (idempotent). The original OUT rows are never mutated.
  - `findSale` / `listSales` (warehouse/buyer/date/SKU filters; voided excluded by default).
- **buyers.ts** CRUD (list/active/create/rename/setStatus, soft-delete).
- **Zod schemas + role-gated actions** (buyers, sale create + void → Admin/Superadmin;
  Owner rejected, rule 5.5). **UI:** `/buyers` (CRUD), `/sales` (list/search with filters),
  `/sales/new` (multi-line editor + live rak+pcs running total), `/sales/[id]` (detail +
  void); nav links.
- **Tests (8 new, 66 total):** multi-line atomic deduction to the right SKUs; a short line
  rejects the whole transaction naming the SKU with zero partial writes; void restores exact
  stock via compensating movements and can't double-void; inactive warehouse rejected;
  deactivated buyer excluded from new sales with history intact; Owner rejected on sale &
  void; an Admin sale through the action (rak→pcs).

### Key decisions
- **Reused the shared locked core** (`recordOutTx`/`recordVoidTx` → `applyMovementTx`) for
  both the deduction and the void — no parallel stock path (rule 5.4). Atomicity comes from
  the single `$transaction` rolling back on any short line.
- **Deadlock-free by SKU-sorted lock order**; idempotent void via a status-guarded update.

### Test status
`pnpm test` → **66 passed** (17 files), stable. `tsc`, `eslint`, `next build` all clean.

---

## Slice 6 — Warehouse views, Stock Correction, low-stock thresholds ✅

**Goal (BUILD_PLAN / SRS §3.4):** stock view per warehouse, filtered ledger,
supervised immutable Stock Corrections, and configurable low-stock thresholds.

### What was built
- **Schema** → migration #7: `LowStockThreshold` (per warehouse + Egg SKU, `minQuantity`
  pcs). Deliberately a SEPARATE table from `WarehouseStock`, so a threshold write never
  touches the balance cache — rule 5.4 stays intact.
- **ledger.ts — generalized + correction.** Refactored the locked core into
  `applyMovementTx(computePost)`: one FOR-UPDATE-locked, atomic path shared by IN/OUT
  and the new **`recordCorrection`**. A correction writes an IMMUTABLE `CORRECTION`
  movement (`SourceType.CORRECTION`) carrying pre/post, updates the balance, and rejects
  reason < 20 chars, a result < 0, or a no-op. No edit/delete — a second correction is
  the only remedy. Added `getFilteredLedger` (date/SKU filters). The 49 pre-existing
  ledger tests still pass, confirming the refactor preserved IN/OUT/oversell behaviour.
- **corrections.ts** (`listCorrections` + Superadmin-guarded `requireCorrectionAudit`)
  and **thresholds.ts** (`setThreshold`, `listThresholds`, `getLowStockSkus`). Zod
  schemas + role-gated actions (correction & thresholds → Admin/Superadmin; Owner
  rejected, rule 5.5).
- **Warehouse UI rebuilt** with a shared tab bar + selector: `/warehouse` (current stock
  grouped by grade with Type columns, rak+pcs, zero rows hidden, sub-threshold cells
  flagged + a banner), `/warehouse/ledger` (warehouse/date/grade/type filters; CORRECTION
  amber and VOID struck-through), `/warehouse/correction` (form + current-stock
  reference), `/warehouse/audit` (Superadmin), `/warehouse/thresholds`.
- **Removed the Slice 1 demo** IN/OUT form (see "Needs your review" A13).
- **Robustness:** `TX_OPTIONS` (maxWait 10s / timeout 20s) on the interactive stock
  transactions (ledger, collection, grading) — a lock-wait under load no longer spuriously
  times out. Fixed a transient flake; verified stable across 8 consecutive runs.
- **Tests (11 new, 58 total):** correction is immutable with correct pre/post and updates
  the balance; reason < 20 rejected (nothing written); a second correction is the remedy
  (originals preserved); delta correction + below-zero guard; sub-threshold SKU flagged
  and `minQuantity 0` removes; Owner rejected on correction & threshold; correction audit
  is Superadmin-only.

### Key decisions
- **One locked core for every stock write** (`applyMovementTx`) — IN/OUT/CORRECTION differ
  only by a `computePost(pre)` strategy; keeps rules 5.1/5.2/5.4 in exactly one place.
- **Thresholds in their own table** so config never writes the ledger-owned cache.

### Test status
`pnpm test` → **58 passed** (15 files), stable. `tsc`, `eslint`, `next build` all clean.

---

## Slice 5 — Grading input ✅

**Goal (BUILD_PLAN / SRS §3.3):** grade each batch into Egg SKUs (Size&Health × Type);
Draft holds no stock, Submit posts every line; batch-sequential; reconcile vs available.

### What was built
- **Schema** → migration #6: `GradingStatus` (DRAFT/SUBMITTED); `GradingRecord`
  (kandang+date+batch unique, status, `linkedCollectionId`) + `GradingLineItem`
  (Egg SKU = Size&Health × Type, pcs; unique per SKU).
- **grades.ts:** `GRADEABLE_GRADES` (A++ … Lunak — excludes Angkat Rak, which bypasses
  grading; KOSONG isn't in the enum) + `isPcsGrade` (Plastik/Lunak entered in pcs, the
  rest in rak — FR-17).
- **grading.ts:**
  - `saveDraft` — writes line items, posts **no** stock. Blocked by the sequential
    lock / missing collection; refuses to draft an already-submitted batch.
  - `submitGrading` — validates the **reconcile total** (graded ≤ available = Good Eggs
    − total Angkat Rak; over-entry rejected, naming the overage), writes line items, and
    **reconciles stock by delta** per SKU (first submit posts fully from baseline 0; edit
    posts only the differences — append IN/OUT, never rewrite), then sets SUBMITTED. All
    in one `$transaction` via ledger.ts's tx-aware `recordInTx`/`recordOutTx` (rule 5.4).
  - **Batch-sequential lock** (FR-15): batch N requires N−1 submitted; batch N also
    requires its own collection (FR-14). `findGrading` / `listGradings` /
    `availableFromCollection`.
- **Zod schema + role-gated actions** (requireRole first, rule 5.5; Owner rejected);
  grade cells read from dynamic `q:<typeId>:<grade>` fields, converted rak→pcs (pcs
  grades pass through). UI: `/grading` — kandang+date selector → per-batch status/lock,
  a Type × Size&Health grid, a **live reconcile counter** (graded vs available, red when
  over), Save-draft / Submit; nav link.
- **Tests (7 new, 49 total):** sequential lock + collection requirement; draft posts no
  stock while submit posts every line per SKU to the right warehouse; over-entry
  rejected; both-Types → per-SKU movements; post-submit edit reconciles by delta without
  double-posting; Owner rejected on the action.

### Key decisions
- **Baseline for delta = the line items IF already SUBMITTED, else 0.** For a submitted
  record the line items equal posted stock, so re-submit posts only the delta; a
  draft→submit posts everything. Uniform and append-only (rule 5.1).
- **Combined-total reconcile only** (per-Type cross-check is intentionally impossible —
  SRS §2.3). See assumptions A11/A12.

### Test status
`pnpm test` → **49 passed** (13 files). `tsc`, `eslint`, `next build` all clean.

---

## Slice 4 — Collection input ✅

**Goal (BUILD_PLAN / SRS §3.2):** per-batch collection per (kandang, business date,
batch); Angkat Rak split by Type posts to the ledger on save; duplicate → edit.

### What was built
- **Schema** → migration #5: `CollectionRecord` (Good/Retak/Lunak/Kosong pcs,
  Type-agnostic; `@@unique(farmhouseId, date, batchNumber)`; `maxBatchesAtEntry`
  snapshot, write-once §5.3) + `AngkatRakLift` (one row per Type, pcs).
- **ledger.ts made transaction-aware.** Extracted `postMovementTx(tx, …)`; added
  exported `recordInTx` / `recordOutTx`. This lets a caller (the collection save)
  bundle the record + its Angkat Rak postings in ONE `$transaction` — atomic — while
  ledger.ts remains the ONLY writer of stock (rule 5.4) and each movement + balance
  still commit together (rule 5.1). Standalone `recordIn`/`recordOut` unchanged.
- **collections.ts:** `createCollection` resolves the warehouse + max batches for the
  business date (via `resolveWarehouseId`/`resolveMaxBatches`), validates the batch,
  snapshots the max, and posts each lift as SKU (ANGKAT_RAK, Type) IN to the kandang's
  warehouse; the four counts never touch stock. `updateCollection` reconciles lifts by
  **delta** — a positive delta appends an IN, a negative delta an OUT — never rewriting
  the original movements (rule 5.1); it deletes/updates/creates the lift rows to match.
  The identity (kandang/date/batch) and `maxBatchesAtEntry` are immutable on edit.
  Plus `findCollection` / `listCollections`.
- **Zod schema + role-gated actions** (requireRole first, rule 5.5; Owner rejected):
  counts parsed via Zod, Angkat Rak lifts read from dynamic `rak_<typeId>` fields and
  converted rak → pcs.
- **UI:** `/collections` — pick kandang + business date, then batch slots up to the
  effective max (each a create or edit form: counts, Angkat Rak-in-rak per Type,
  remarks), showing the destination warehouse. Nav link for Admin/Superadmin.
- **Tests (7 new, 42 total):** Angkat-Rak-by-Type posts the right per-SKU pcs to the
  right warehouse; a both-Types lift = 2 movements; counts don't stock; duplicate
  prevention (+ findCollection returns the existing); edit reconciles by delta across
  +/−/remove without double-posting; batch max honors the business date's effective
  config (incl. a next-day change); Owner rejected on the action.

### Key decisions
- **Delta reconciliation on edit**, using IN/OUT movements (not CORRECTION — that's the
  supervised, reason-gated path in Slice 6). Keeps the ledger append-only and truthful.
- **rak vs pcs:** counts in pcs (FR-07), Angkat Rak in rak (see A9).

### Test status
`pnpm test` → **42 passed** (11 files). `tsc`, `eslint`, `next build` all clean.

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
