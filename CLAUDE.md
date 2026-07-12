# Compliance Triage Workbench

Turborepo monorepo: `apps/admin` (Vite SPA), `apps/backend` (Express + GraphQL
Yoga/Pothos), `packages/shared` (domain rules, Zod schemas, types).

## Non-negotiables

- **Domain first.** Business rules (risk, closure, immutability, roles) live in
  pure functions — `packages/shared/src/domain/` and
  `apps/backend/src/api/v1/services/case-domain.ts` — with no Express, GraphQL,
  React, or DB imports. The API enforces them; the UI only reflects them. A new
  rule gets unit tests before any endpoint or screen touches it.
- **Zod is the single source of truth.** Every shared type is `z.infer` of a
  schema in `@repo/shared` — never hand-write a duplicate. GraphQL enums are
  built from `schema.options`, not re-listed.
- **Server-authoritative fields.** `riskLevel`, `closureStatus`, audit
  `actor`/`timestamp` are computed server-side. Never accept them from a client.
- **Audit trail is append-only by construction.** Audit repositories expose
  `append`/`listByCase` only — never add an update or delete method.
- **Dependencies via CLI only.** `pnpm --filter <pkg> add …`; shadcn components
  via `pnpm dlx shadcn@latest add …` run inside `apps/admin`. Never hand-edit
  dependency entries in package.json.

## Backend

- GraphQL only, at `POST /api/v1/graphql` — versioned by URL *and* by the
  `src/api/v1/` directory (a v2 is a copy of the folder). `/health` stays
  unversioned REST. GraphiQL serves from the same path in dev only.
- Errors carry a machine-readable `extensions.code`. A blocked close returns
  `CLOSURE_BLOCKED` with the **complete** list in `extensions.blockers` — never
  a silent no-op or generic error.
- Persistence sits behind repository interfaces; `PERSISTENCE=memory|database`.
  Drizzle implementations are lazy-imported so memory mode never loads `pg`.
- `@repo/shared` is source-only (exports `./src/*.ts`) and must stay
  browser-safe — no Node-only APIs in any exported path.

## Admin

- CSR only — plain TanStack Router; no SSR, no TanStack Start.
- Server state via TanStack Query + graphql-request, through `src/lib/api.ts`
  and the `request()` wrapper (normalizes errors to `ApiError`, keeps
  `blockers`). Every screen shows loading / error / success states.
- Role checks in the UI are cosmetic; the backend rejects independently.
- Auth is not a route: the root layout renders `LoginScreen` when there is no
  session. Never call `navigate()` during render.
- shadcn here is **Base UI**, not Radix: use `render={<Link/>}` (no `asChild`);
  `ToggleGroup` is array-valued; `Select` `onValueChange` can pass `null`.
  tsconfig sets `erasableSyntaxOnly` — no constructor parameter properties.
- Dense, full-width layouts: no centered `max-w-*` page columns, page padding
  `px-4/6 py-4`, vertical rhythm `space-y-4`, compact cards via `size="sm"`.
  Key details belong on the first screenful, not behind scrolling.

## Verify before committing

```bash
pnpm turbo run check-types lint test build   # must be green repo-wide
./apps/backend/scripts/smoke.sh              # API lifecycle, needs dev server running
```

Commits: conventional style (`feat(scope): …`), imperative subject, body
explains the why.
