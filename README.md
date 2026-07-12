# Compliance Triage Workbench

A Turborepo monorepo: a React (Vite) admin SPA, a Node/Express API, and a
shared package of types, Zod validators, and utilities used by both.

```
apps/
  admin/     React + Vite SPA (TanStack Router + Query, shadcn/ui)
  backend/   Node + Express + TypeScript API
packages/
  shared/            @repo/shared — types, utils, Zod validators
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

| App     | URL                     |
| ------- | ----------------------- |
| admin   | <http://localhost:5173> |
| backend | <http://localhost:3001> |

Run one app at a time with `pnpm --filter admin dev` / `pnpm --filter backend dev`.

## Repo-wide tasks

```bash
pnpm typecheck   # alias for `turbo run check-types`
pnpm build
pnpm lint
pnpm format
```

## Backend

All endpoints live under `/api/v1`, mirrored by the directory layout in
`src/api/v1/` — so adding a `v2` is a copy of the folder, not a rewrite.
`/health` is deliberately unversioned.

| Method | Endpoint                | Auth   |
| ------ | ----------------------- | ------ |
| GET    | `/health`               | —      |
| POST   | `/api/v1/auth/register` | —      |
| POST   | `/api/v1/auth/login`    | —      |
| GET    | `/api/v1/auth/me`       | Bearer |
| GET    | `/api/v1/users`         | Bearer |
| GET    | `/api/v1/users/:id`     | Bearer |
| DELETE | `/api/v1/users/:id`     | Bearer |
| GET    | `/api/v1/public`        | —      |
| GET    | `/api/v1/protected`     | Bearer |

Requests are validated with the Zod schemas from `@repo/shared`, and every
failure comes back in one shape:

```json
{ "error": { "code": "VALIDATION_ERROR", "message": "...", "issues": [] } }
```

Example register → login → protected flow:

```bash
curl -X POST http://localhost:3001/api/v1/auth/register \
  -H 'content-type: application/json' \
  -d '{"email":"admin@example.com","name":"Admin","password":"supersecret123","role":"admin"}'

TOKEN=$(curl -s -X POST http://localhost:3001/api/v1/auth/login \
  -H 'content-type: application/json' \
  -d '{"email":"admin@example.com","password":"supersecret123"}' | jq -r .token)

curl http://localhost:3001/api/v1/protected -H "authorization: Bearer $TOKEN"
```

### Switching persistence

`PERSISTENCE` in `apps/backend/.env` selects the repository implementation.
Both satisfy the same `UserRepository` interface, so nothing above the
repository layer changes.

```bash
PERSISTENCE=memory     # default — in-process store, no infra required
PERSISTENCE=database   # Postgres via Drizzle; DATABASE_URL becomes required
```

The Drizzle client sits behind a dynamic import, so in memory mode `pg` is
never loaded and no connection pool is opened. In database mode, create the
table first:

```bash
DATABASE_URL=postgres://user:pass@localhost:5432/db pnpm --filter backend db:push
```

## Admin

A client-side-only SPA — plain TanStack Router, no SSR and no TanStack Start.

The dashboard (`src/routes/index.tsx`) exercises the loading, error, and
success states of TanStack Query against a dummy API that adds a 1.2–3s delay
and fails ~30% of the time, so all three states are reachable by reloading.
Query retries are disabled so simulated failures are actually visible. Swap
`fetchUsers` in `src/lib/dummy-api.ts` for the `api` client in `src/lib/api.ts`
to hit the real backend; its base URL comes from `VITE_API_URL`.

Routes are file-based. `src/routeTree.gen.ts` is generated — by the Vite plugin
in dev, and by `tsr generate` at the start of `build` and `check-types` — and is
not committed.

Add shadcn components from within `apps/admin`:

```bash
pnpm dlx shadcn@latest add <component>
```

## @repo/shared

A source-only internal package: it exports `./src/*.ts` directly and consumers
transpile it (`tsx` on the backend, Vite in admin), so there is no build step to
keep in sync.

Every exported type is inferred from a Zod schema rather than declared alongside
one, so the schema stays the single source of truth:

- **validators** — `userSchema`, `publicUserSchema`, `createUserSchema`,
  `loginSchema`, `authResponseSchema`, `jwtPayloadSchema`, `envSchema`,
  `apiErrorSchema`, `healthSchema`
- **types** — `User`, `PublicUser`, `CreateUserInput`, `LoginInput`,
  `AuthResponse`, `JwtPayload`, `Env`, `ApiError`, `Health`
- **utils** — `sleep`, `randomDelay`, `Result` (`ok` / `err` / `isOk` / `unwrap`)
