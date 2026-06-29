# BUILD_PLAN.md — EggFarm IMS

How we build: **foundation first, then one vertical slice at a time.** Each slice is shippable, proven with a test or manual check, committed, *then* the next starts. Do **not** scaffold all features up front. The always-true rules are in [`/CLAUDE.md`](./CLAUDE.md); full requirements in [`docs/SRS.md`](./docs/SRS.md).

This is a **Next.js full-stack (App Router)** app: reads via server components calling `src/lib/server/*`, mutations via server actions, route handlers only where a REST endpoint is genuinely needed. A "slice" = the Prisma models + the `src/lib/server/*` functions + the server actions + the UI for one capability.

Cross-cutting rules apply to **every** slice: audit fields (`enteredById` + timestamps), soft-delete via status, Zod validation at the action boundary, `requireRole(...)` as the first line of every mutation (rule 5.5), all stock writes through `src/lib/server/ledger.ts` only (rule 5.4), pcs-internal storage with rak+pcs display, and the three load-bearing rules.

---

## Slice 1 — Warehouse ledger + stock projection  ← current
**Adds:** `StockMovement` (append-only ledger), `WarehouseStock` (balance, pcs); `src/lib/units.ts`; `src/lib/server/db.ts` (Prisma singleton); `src/lib/server/ledger.ts` as the **only** stock writer (`recordIn`/`recordOut` in a `$transaction` with `FOR UPDATE`, `recordOut` rejects negative); read funcs `getStock`/`getLedger`; server actions wrapping them; a minimal warehouse page. Seed Normal/Omega + one warehouse.
**Depends on:** nothing (foundation).
**Done when:** a movement and its balance stay in lockstep in one transaction, and an oversell is rejected atomically (Vitest, calling `ledger.ts` directly). See `CLAUDE.md` §8.

## Slice 2 — Auth, users, roles
**Adds:** `User` + `Session` models; bcrypt hashing; signed httpOnly cookie session (`jose`); `src/lib/server/auth.ts` with `requireUser()` / `requireRole()`; login page + logout; middleware redirecting unauthenticated users; Superadmin-only user CRUD. Wire the real `requireRole` into Slice 1's actions (replacing the stub).
**Depends on:** Slice 1.
**Done when:** an Owner session is rejected by every write path (test hits the Slice 1 OUT action → forbidden), only Superadmin manages users, and a deactivated user cannot log in.

## Slice 3 — Config & master data
**Adds:** farmhouses (kandang) with `maxBatchesPerDay`, warehouses, farmhouse→warehouse mapping log (effective-dated), measurement units, grade types (table). Admin manages operational structure; Superadmin manages units + grade types.
**Depends on:** Slice 2.
**Done when:** a kandang is created and mapped to a warehouse; deactivation is soft; a mapping change is date-stamped and logged; batch-count change takes effect next day.

## Slice 4 — Collection input
**Adds:** `CollectionRecord` (Good/Retak/Lunak/Kosong, Type-agnostic) + `AngkatRakLift` (per Type); duplicate prevention (kandang+date+batch); edit-with-audit; **Angkat Rak posts to the ledger immediately** (via `ledger.ts`) as SKU `Angkat Rak / <Type>` on save.
**Depends on:** Slices 1, 3.
**Done when:** a save with an Omega + Normal lift creates two ledger movements and bumps the right SKU balances; a duplicate opens edit mode.

## Slice 5 — Grading
**Adds:** `GradingRecord` + line items (Size & Health × Type); batch-sequential lock (N requires N−1 submitted); live reconcile counter across Type tabs vs `(Good Eggs − total Angkat Rak)`; draft vs submit; **submission posts graded SKUs to the ledger** (via `ledger.ts`).
**Depends on:** Slices 1, 3, 4.
**Done when:** Batch 2 grading is blocked until Batch 1 is submitted; submitting updates stock per Egg SKU; over-entry is rejected.

## Slice 6 — Warehouse views, corrections, thresholds
**Adds:** stock view per SKU (rak+pcs, grouped by grade with Type sub-columns); ledger with date/warehouse filters; **Stock Correction** (immutable, pre/post quantity, reason ≥20 chars, movement type `CORRECTION`, via `ledger.ts`); low-stock thresholds + alerts.
**Depends on:** Slices 1, 5.
**Done when:** a correction writes an immutable ledger row with pre/post and updates the balance; a sub-threshold SKU raises an alert.

## Slice 7 — Buyers + Sales & Dispatch
**Adds:** `Buyer` CRUD (soft-delete); `SalesTransaction` + line items; **atomic multi-line deduction** with row locks (via `ledger.ts`); whole-transaction rejection naming the short SKU; void/reversal via compensating movements; search/filter.
**Depends on:** Slices 1, 6.
**Done when:** a 3-line sale deducts all-or-nothing; a short line blocks the whole transaction; a void restores stock and marks ledger entries voided.

## Slice 8 — Flock & placement lifecycle
**Adds:** `Flock` (strain, chick-in date, placement age) spanning one+ kandang; `Placement` (own Populasi Awal, own ledger); running `HIDUP` per placement; one active placement per kandang; Superadmin chick-in/end; history retained across re-population.
**Depends on:** Slices 2, 3.
**Done when:** a flock across 2 kandang seeds HARI/HIDUP per placement; MATI/AFKIR carry HIDUP forward; ending a placement frees the kandang.

## Slice 9 — Daily farmhouse recording
**Adds:** one record per kandang/day/active placement; Admin inputs (MATI, AFKIR, SISA DIGUNAKAN/DIBUANG, BERAT TELUR, BERAT BADAN, OBAT/VITAMIN notes, KETERANGAN); derived HARI/MINGGU/HIDUP, four egg buckets (from collection, reconciled to grading), HD%, REALISASI INTAKE, GRAM/EKOR, FCR. Persist computed values write-once.
**Depends on:** Slices 4, 5, 8.
**Done when:** buckets populate from collection and reconcile to grading without changing the daily total; HD% and FCR match the spec formulas on sample data.

## Slice 10 — PAKAN (feed) management & mixing
**Adds:** feed-ingredient master (Superadmin) + central stock; deliveries (stock up); mixing per kandang per consumption day (requirement = HIDUP × intake; fresh mix = requirement − reusable sisa, floored 0; mains by % of fresh mix, supplements fixed); ingredient drawdown; printable pull-list; posts PAKAN MASUK/TERSEDIA + JENIS to the daily record.
**Depends on:** Slices 8, 9.
**Done when:** a mix draws down ingredients by computed weight, the pull-list prints per kandang, MASUK appears on the consumption-day record; a no-mix day floors fresh mix at 0.

## Slice 11 — OVK inventory
**Adds:** OVK item master (Obat/Vitamin/Chemical, Superadmin) + central office stock; deliveries (stock up); **office→kandang transfer = stock-down event**; pemakaian report per kandang. Daily OBAT/VITAMIN notes stay decoupled (no stock effect).
**Depends on:** Slices 2, 3.
**Done when:** a transfer reduces office stock and appears in the per-kandang pemakaian report; a daily note moves no stock.

## Slice 12 — VAKSIN logging
**Adds:** vaksin-type master (Superadmin); vaksin log (date, type, vials, kandang, vaccinator); daily VAKSIN field derived from the log.
**Depends on:** Slices 2, 3, 9.
**Done when:** a logged vaccination surfaces on the matching daily record without re-entry.

## Slice 13 — Dashboard, reports, exports
**Adds:** KPI cards, production/grade/flock-health charts, standard reports (SRS §8.1) with role-scoped access, Excel/CSV export. DB views / raw SQL for heavy aggregations.
**Depends on:** all prior slices.
**Done when:** the Owner dashboard renders read-only KPIs within the performance budget and exports produce correct files.

---

### After v2
Pull from SRS §10 (Future Considerations) only when asked: advanced feed distribution/talang, body-weight analytics, accounting/revenue, OVK cost/expiry, scheduled PDF, multi-farm, barcode/QR. None in scope now.