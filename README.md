# Compliance Triage Workbench

Compliance case management — report → triage → track → close — with the business
rules enforced in a pure domain layer, a field-level audit trail, and role-based
access.

Turborepo monorepo:

```
apps/
  admin/     React + Vite SPA (TanStack Router + Query, graphql-request, shadcn/ui)
  backend/   Node + Express + GraphQL Yoga + Pothos (in-memory store)
packages/
  shared/    @repo/shared — domain rules, types, Zod validators (used by both apps)
```

## Requirements

- Node 22 (`.nvmrc` — run `nvm use`)
- pnpm 10 (`corepack enable` picks up the pinned version)

## Setup

```bash
pnpm install
pnpm run setup   # writes both .env files, generates a JWT_SECRET
pnpm dev         # admin + backend together
```

`pnpm run setup` copies each `.env.example` to `.env` and fills `JWT_SECRET`
with `openssl rand -hex 32` — the backend refuses to boot without a real one
(16+ chars). It never overwrites an existing `.env`, so it's safe to re-run.

> Use `pnpm run setup`, not `pnpm setup` — the latter is pnpm's own built-in
> command and would shadow this script.

| Surface            | URL                                    |
| ------------------ | -------------------------------------- |
| admin              | <http://localhost:5173>                |
| GraphQL + GraphiQL | <http://localhost:3001/api/v1/graphql> |
| health             | <http://localhost:3001/health>         |

Data lives in memory and is re-seeded on every boot — no database, no migrations.
Seeded users (password `password123` for all three):

| Email                  | Role               | Can                                           |
| ---------------------- | ------------------ | --------------------------------------------- |
| `manager@example.com`  | Compliance Manager | Everything: triage, update, close              |
| `reporter@example.com` | Reporter           | File cases; view and track **only their own**  |
| `auditor@example.com`  | Auditor            | Read-only across every case                    |

## Tests

Two commands, both from the repo root:

```bash
pnpm test        # unit + integration (Vitest) — shared domain, backend services, GraphQL
pnpm test:e2e    # browser end-to-end (Playwright) — full UI flows
```

**`pnpm test`** fans out through Turbo to every package with a `test` script:

- `packages/shared` — the risk matrix and closure rules as pure functions.
- `apps/backend` — auth and case services called directly (no HTTP), plus a
  GraphQL suite that drives the real schema over the wire.

No setup needed: Vitest injects `NODE_ENV=test` and a test `JWT_SECRET`, and the
store is in-memory, so a clean checkout runs green.

**`pnpm test:e2e`** boots its _own_ backend (port 3101) and Vite server (port
5174) via Playwright's `webServer`, so it never disturbs a dev session you
already have open. First run needs the browser installed once:

```bash
pnpm --filter admin exec playwright install chromium
```

Variants:

```bash
pnpm test:e2e:headed   # watch it run — single worker, slowed down
pnpm test:e2e:ui       # Playwright UI mode
```

## Other repo tasks

```bash
pnpm typecheck   # turbo run check-types
pnpm lint
pnpm build
```
