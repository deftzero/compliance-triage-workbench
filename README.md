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
cp apps/backend/.env.example apps/backend/.env   # then set JWT_SECRET
pnpm dev                                         # admin + backend together
```

Generate a `JWT_SECRET` (16+ chars, or the backend refuses to boot):

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

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

## How the rules are enforced

Risk calculation, closure readiness, immutability, and role checks are pure
functions in `@repo/shared` and `apps/backend/src/api/v1/services/case-domain.ts`
— no Express, GraphQL, React, or DB imports. The API enforces them; the UI only
reflects them.

- Risk is always derived from likelihood × impact, never supplied by a client.
- A case must be Triaged before it can close; High/Critical risk needs a review
  note; a required investigation needs an outcome; a required corrective action
  must itself be Closed.
- A Closed case rejects every mutation.
- Every successful mutation appends one audit entry with field-level old → new,
  a server-set actor and timestamp. Rejected actions append nothing.

A blocked close returns `CLOSURE_BLOCKED` with the **complete** blocker list in
`extensions.blockers` — never a silent no-op:

```json
{
  "message": "Case is not ready to be closed",
  "code": "CLOSURE_BLOCKED",
  "blockers": [
    "Review note is required for High/Critical risk cases.",
    "Investigation outcome is missing.",
    "Corrective action is still open."
  ]
}
```
