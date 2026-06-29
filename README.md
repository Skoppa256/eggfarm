# EggFarm IMS

Inventory Management System for an Indonesian egg farm (CV Piawai Djaya Farm), replacing disconnected spreadsheets with one integrated system covering the egg pipeline (collection → grading → warehouse → sales), the flock layer (chick-in, daily recording, end), and operations (PAKAN feed, OVK medicine/vitamin, VAKSIN). Single farm, ~20 users.

**Next.js full-stack (App Router)** — UI, server logic, and database in one app. No separate backend.

## Docs (read in this order)
- **[`CLAUDE.md`](./CLAUDE.md)** — engineering operating manual: stack, the load-bearing architecture rules, domain invariants, conventions, guardrails. Read first.
- **[`BUILD_PLAN.md`](./BUILD_PLAN.md)** — the ordered vertical slices we build in.
- **[`docs/SRS.md`](./docs/SRS.md)** — full Software Requirements Specification v2.0 (FR detail, data model, use cases, ripple analysis).

`CLAUDE.md` is the source of truth for *how to build*; `docs/SRS.md` for *what to build*. If they conflict, fix the conflict — don't pick silently.

## Stack
Next.js (App Router) · PostgreSQL 16 · Prisma · TypeScript · pnpm · Zod · Tailwind · bcrypt + `jose` cookie sessions · Vitest.

## Prerequisites
- Node 22 (see `.nvmrc`; run `nvm use`). The Prisma 7 CLI fails on Node 20.11.
- pnpm
- PostgreSQL 16 running locally with databases `eggfarm` and `eggfarm_test`

## Setup
```bash
pnpm install
cp .env.example .env          # set DATABASE_URL + SESSION_SECRET
npx prisma migrate dev        # apply migrations
pnpm dev                      # http://localhost:3000
```

## Common commands
```bash
pnpm dev                             # dev server
pnpm build && pnpm start             # production
pnpm test                            # Vitest
npx prisma migrate dev --name <x>    # new migration
npx prisma studio                    # inspect data
npx prisma generate                  # regenerate client after schema edits
```

## How we build
Foundation first, then one slice at a time (see `BUILD_PLAN.md`), each proven with a test or manual check and committed before the next. Current target: **Slice 1 — warehouse ledger + stock projection.**

## Two non-negotiables for this stack
1. **All stock writes go through `src/lib/server/ledger.ts` — nothing else touches `StockMovement`/`WarehouseStock`.**
2. **Every mutating server action starts with `await requireRole(...)`** — a server action is a public endpoint.

## Repo layout
```
CLAUDE.md          # engineering operating manual
BUILD_PLAN.md      # slice roadmap
docs/SRS.md        # full requirements
prisma/            # schema + migrations
src/
  app/             # App Router (pages, server actions, route handlers)
  lib/             # units + zod schemas (shared)
  lib/server/      # server-only: db, auth, ledger, feature functions
  components/      # shared UI
```