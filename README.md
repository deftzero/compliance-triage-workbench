# Compliance Triage Workbench

Compliance case management — report → triage → track → close — with every rule
enforced in the domain layer, a field-level audit trail, and role-based access.

A Turborepo monorepo: a React (Vite) admin SPA, a Node/Express + GraphQL API,
and a shared package whose Zod schemas and pure domain functions are the single
source of truth for both.

```
apps/
  admin/     React + Vite SPA (TanStack Router + Query, graphql-request, shadcn/ui)
  backend/   Node + Express + GraphQL Yoga + Pothos
packages/
  shared/            @repo/shared — domain rules, types, Zod validators
  eslint-config/     shared ESLint flat configs
  typescript-config/ shared tsconfig presets (base, vite, react-library)
```

## Requirements

- Node 22 (`.nvmrc` — run `nvm use`)
- pnpm 10 (`corepack enable` picks up the pinned version)

## Getting started

```bash
pnpm install
cp apps/backend/.env.example apps/backend/.env   # then set JWT_SECRET
pnpm dev                                          # runs admin + backend together
```

Generate a secret for `JWT_SECRET`:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

The backend refuses to boot on invalid config, so a missing or too-short
`JWT_SECRET` fails immediately with a readable message rather than at first use.

| Surface              | URL                                        |
| -------------------- | ------------------------------------------ |
| admin                | <http://localhost:5173>                    |
| GraphQL + GraphiQL   | <http://localhost:3001/api/v1/graphql>     |
| health               | <http://localhost:3001/health>             |

Open the GraphQL URL in a browser to get **GraphiQL**, the query IDE, and run
queries and mutations by hand. It is enabled in development only — in
production the schema is not browsable.

### Seeded accounts

The backend seeds one user per role on first boot, plus five cases spanning
every status and risk level. Password for all three: `password123`.

| Email                  | Role               | Can                                            |
| ---------------------- | ------------------ | ---------------------------------------------- |
| `manager@example.com`  | Compliance Manager | Everything: triage, update, close              |
| `reporter@example.com` | Reporter           | File cases; view and track **only their own**  |
| `auditor@example.com`  | Auditor            | Read-only across every case                    |

## The domain is the source of truth

Risk calculation, closure readiness, immutability, and role checks are pure
functions in `@repo/shared` and `apps/backend/src/api/v1/services/case-domain.ts`.
They import nothing from Express, GraphQL, React, or a database. The API
enforces them; the UI only *reflects* them.

A rejected action fails in the service layer even when called directly, with the
API bypassed entirely — which is exactly how the tests call it.

| Rule | Enforced |
| ---- | -------- |
| R1 | A case must be Triaged before it can close |
| R2 | High/Critical risk needs a review note to close |
| R3 | A required investigation needs an outcome |
| R4 | A required corrective action must itself be Closed |
| R5 | A Closed case rejects every mutation |
| R6 | Only a Compliance Manager may triage, update, or close |
| R7 | Risk is always derived from likelihood × impact, never supplied |
| R8 | `closedAt` is written exactly once |
| R9 | One audit entry per successful action; none for a rejected one |
| R10 | Every mutation logs field-level old → new, with a server-set actor and timestamp |

`calculateRiskLevel` and `getClosureStatus` live in `@repo/shared` and are
imported by **both** apps, so the backend's close guard and the UI's blocker
list can never drift apart. Blocker text is exported as constants for the same
reason.

### Risk matrix (R7)

|                | Impact Low | Impact Medium | Impact High |
| -------------- | ---------- | ------------- | ----------- |
| **Likelihood Low**    | Low     | Low        | Medium   |
| **Likelihood Medium** | Low     | Medium     | High     |
| **Likelihood High**   | Medium  | High       | Critical |

Critical requires *both* inputs to be High. A single High never drops below
Medium, and never reaches Critical on its own.

## API

One GraphQL endpoint, versioned by URL and mirrored by the `src/api/v1/`
directory — adding a v2 is a copy of the folder, not a rewrite. `/health` is
deliberately unversioned, since a liveness probe shouldn't track API versions.

```
POST /api/v1/graphql
GET  /health
```

**Queries:** `me`, `cases(status, riskLevel, q)`, `case(id)` — each `Case`
carries a server-computed `closureStatus { ready, blockers }` and an
append-only `auditTrail`.

**Mutations:** `login`, `register`, `reportCase`, `triageCase`, `updateCase`,
`closeCase`.

Errors carry a machine-readable `code` in `extensions`. A premature close fails
with `CLOSURE_BLOCKED` and the **complete** blocker list in
`extensions.blockers` — never a silent no-op or a generic failure:

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

To exercise the whole lifecycle against a running backend:

```bash
./apps/backend/scripts/smoke.sh
```

### Switching persistence

`PERSISTENCE` in `apps/backend/.env` selects the repository implementation.
Both satisfy the same interfaces, so nothing above the repository layer changes.

```bash
PERSISTENCE=memory     # default — in-process store, no infra required
PERSISTENCE=database   # Postgres via Drizzle; DATABASE_URL becomes required
```

The Drizzle client sits behind a dynamic import, so in memory mode `pg` is never
loaded and no connection pool is opened. In database mode, create the tables
first:

```bash
DATABASE_URL=postgres://user:pass@localhost:5432/db pnpm --filter backend db:push
```

The audit repository is append-only *by construction* — its interface exposes no
update or delete to call, in either implementation.

## Admin

A client-side-only SPA — plain TanStack Router, no SSR and no TanStack Start.
Server state goes through TanStack Query; every screen surfaces loading, error,
and success states.

The sidebar is role-aware, and each screen hides controls the user can't use —
but that is a courtesy, not a control: the backend rejects the action
independently.

- **Dashboard** — counts awaiting triage, open high/critical, and ready-to-close.
- **Cases** — table ⇄ grid toggle, with status, risk, and text filters sent to
  the server (so a Reporter's scoping stays the backend's decision).
- **Case detail** — a persistent summary header plus two sub-pages:
  - **Progress** — the triage form, the workflow fields, and a closure panel
    that lists outstanding blockers and disables Close until there are none. If
    the server still rejects the close, its blocker list wins over the one last
    rendered.
  - **Activity Logs** — the audit trail, newest first, rendered as
    `timestamp — actor (role) — action` with each `field: old → new`.
- **Report a Case** — the Reporter's form. Risk is previewed with the same
  `calculateRiskLevel` the server uses, and can never be typed in by hand.

Closed cases and Auditors get a locked, read-only Progress surface.

Routes are file-based. `src/routeTree.gen.ts` is generated — by the Vite plugin
in dev, and by `tsr generate` at the start of `build` and `check-types` — and is
not committed.

## Repo-wide tasks

```bash
pnpm typecheck   # alias for `turbo run check-types`
pnpm test        # domain + service tests
pnpm build
pnpm lint
```

Tests run against the domain and service layers with no HTTP in sight: the risk
matrix, every closure blocker, role rejections, closed-case immutability, and
the audit diffs.
