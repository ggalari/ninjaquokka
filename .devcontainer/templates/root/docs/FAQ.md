# FAQ

Quick answers and the reasoning behind decisions. For depth, follow the links into [AUTH.md](AUTH.md), [ARCHITECTURE.md](ARCHITECTURE.md) and [INSTALLATION.md](INSTALLATION.md).

**Jump to:** [Design decisions](#design-decisions) · [Everyday work](#everyday-work) · [Data and growth](#data-and-growth) · [Front end](#front-end) · [Operations and production](#operations-and-production) · [Tooling](#tooling)

---

## Design decisions

### Why not Next.js?

The back end is an independent REST service and the front end a plain React app, so either can change without the other. Next.js is a React framework (not a general-purpose back end) that has changed fast, which works against that separation. See the [Decision log](ARCHITECTURE.md#8-decision-log).

### Why separate the front end and back end for a solo developer?

**Benefits:** a clean contract; the ability to add a mobile app, third-party clients or a different front end later; each side can be deployed and scaled independently; business logic stays out of UI code.

**Costs:** two runtimes to run, an API contract to keep in sync (automated here by `pnpm gen:api`), and CORS or a reverse proxy in production. If you will only ever have one web client and mostly CRUD, a single Next.js app is genuinely simpler. This scaffold assumes you value the separation.

### Why Fastify instead of NestJS, Express or Hono?

Fastify is mature, schema-first (a natural fit for Zod and OpenAPI), minimal in opinions, and an OpenJS Foundation project. The full comparison against NestJS, Express and Hono — and why each was dropped — is in the [Decision log](ARCHITECTURE.md#8-decision-log).

### Why Zod, and is `fastify-type-provider-zod` a risk?

One Zod schema drives runtime validation, TypeScript types and the OpenAPI JSON Schema. The one watch-item is `fastify-type-provider-zod`: a **community** package (thin, replaceable). If abandoned, Fastify's official TypeBox provider or a small custom compiler on Zod's `toJSONSchema` are the fallbacks. See the [Decision log](ARCHITECTURE.md#8-decision-log).

### Why Prisma, and what about Drizzle?

Prisma for maturity and ecosystem size. Drizzle stays closer to SQL and has built-in pgvector column types, but is pre-1.0. All database code sits in repositories, so switching later affects only that layer. See the [Decision log](ARCHITECTURE.md#8-decision-log).

### Why Better Auth and cookie sessions instead of JWTs?

The default product is a same-origin browser app. Better Auth owns credentials, sessions and account linking; an httpOnly cookie keeps the session token out of JavaScript, and revocation is server-side. The trade-off is that native and third-party clients need a separate token strategy later. See [AUTH.md §3](AUTH.md#3-cookie-and-session-flow) and the [Decision log](ARCHITECTURE.md#8-decision-log).

### Why OpenAPI instead of tRPC or GraphQL?

OpenAPI is language-neutral: the same `openapi.json` generates clients for mobile apps, other languages, or Postman. tRPC is TypeScript-only and couples client and server; GraphQL changes the query model. See the [Decision log](ARCHITECTURE.md#8-decision-log).

### Why is `packages/api-client` on TypeScript 6 while the rest uses 7?

`openapi-typescript` needs the TypeScript compiler API, which TypeScript 7 does not expose (on 7 it crashes with `Cannot read properties of undefined (reading 'createKeywordTypeNode')`). The API is expected back in 7.1; then remove the pin. See [Architecture 2.6](ARCHITECTURE.md#26-why-some-versions-are-pinned).

### Why do the routes contain the full `/api/...` path instead of a prefix?

It keeps OpenAPI paths identical to real URLs, makes routes easy to grep, and avoids Fastify's behaviour of registering both `/x` and `/x/` when a `/` route sits under a prefix.

### Why are `openapi.json` and `schema.d.ts` committed if they are generated?

So contract changes are visible in review, the front end can build without running the API, and CI can catch a forgotten regeneration. See [Architecture §3](ARCHITECTURE.md#3-the-contract-from-zod-schema-to-typed-ui-call).

---

## Everyday work

### How do I add a new endpoint or module?

Follow [Recipe 7.1](ARCHITECTURE.md#71-recipe-add-a-new-module-end-to-end): model and migration → Zod schemas → repository → service → routes → register in `app.ts` → `pnpm gen:api` → use in the UI. The `notes` module is the template. If the route needs a user, add `app.authenticate` and a permission guard; see [AUTH.md §5](AUTH.md#5-protecting-routes).

### I changed an endpoint and the front end no longer compiles. Is that a bug?

No, that is the architecture working. Run `pnpm gen:api` to refresh the contract; `pnpm typecheck` then lists every UI call that no longer matches.

### How do I add an environment variable?

Follow [Installation → Environment variables](INSTALLATION.md#4-environment-variables). In short: add it to the Zod schema in `apps/api/src/config.ts`, to `.env.example`, and to `globalPassThroughEnv` in `turbo.json`, then wire the dev container in `.devcontainer/docker-compose.yml`.

### How do I change the database schema?

Edit `schema.prisma`, run `pnpm --filter api db:migrate --name <name>`, update repository/schemas/service, run `pnpm gen:api`, commit the migration. See [Recipe 7.5](ARCHITECTURE.md#75-recipe-change-the-database-safely).

### How do I see the data in the database?

`pnpm --filter api db:studio` opens Prisma Studio. Port 5432 is also forwarded, so any PostgreSQL client (psql, DBeaver, the VS Code PostgreSQL extension) can connect with `postgres://postgres:postgres@localhost:5432/app`. In GitHub Codespaces, forward it explicitly in the Ports panel or with `gh codespace ports forward 5432:5432`, and keep its visibility private.

### How do I add tests?

API service and route tests are included with Vitest. Run `pnpm --filter api test`. See [Recipe 7.6](ARCHITECTURE.md#76-recipe-testing) for fake repositories and `app.inject`; Testcontainers for integration tests and Playwright for end to end remain future work.

### How do I create the first admin?

There is no default admin; sign-up creates a `user`. Bootstrap one with:

```bash
pnpm --filter api auth:create-admin \
  --email admin@example.com \
  --name "Admin" \
  --role admin
```

Use `--role superadmin` only for the break-glass account. The UI and guarded role route cannot assign superadmin. See [AUTH.md §8](AUTH.md#8-admin-bootstrap).

### How do I add a role or permission?

Add the resource and actions to `statement` in `apps/api/src/auth/permissions.ts`, grant them to the relevant roles, and add the role to `ASSIGNABLE_ROLES` if the admin API/UI may assign it. Then update the role select and the permission matrix. See [AUTH.md §7](AUTH.md#7-roles-permissions-and-assignment).

### Where do secrets go?

Never in the repository. Locally, the development defaults are harmless (`postgres/postgres`, a dev-only `BETTER_AUTH_SECRET`). In staging and production, inject real secrets through your platform's secret manager or environment settings. Rotating `BETTER_AUTH_SECRET` invalidates existing sessions. See [Architecture 10.11](ARCHITECTURE.md#1011-secrets-and-configuration).

---

## Data and growth

### Can one database handle relational, unstructured and vector (RAG) data?

Yes, with PostgreSQL: tables for relational data, `JSONB` columns (with GIN indexes) for schemaless documents, built-in full-text search, and the **pgvector** extension for embeddings, with hybrid queries combining all three in one SQL statement. Large binary files belong in object storage (with a pointer in Postgres), which is true for any database.

**Limits:** pgvector HNSW indexes are memory-hungry; at tens of millions of vectors or very high query rates, a dedicated vector database becomes worthwhile. Postgres is also not a horizontally sharded document store, which most solo projects never need. Details: [Architecture 6.2](ARCHITECTURE.md#62-data-layer).

### How do I add pgvector?

See [Recipe 7.8](ARCHITECTURE.md#78-recipe-adding-vector-search-pgvector). In short: use a pgvector-enabled PostgreSQL image, `CREATE EXTENSION vector` in a migration, declare the column as `Unsupported("vector(N)")`, and do inserts and similarity queries with raw SQL inside one repository. Prisma has no native vector type, `prisma migrate dev` does not manage pgvector indexes, and Prisma Studio cannot display vector columns, so create indexes in hand-written SQL migrations. It is a planned extension and has not been tested in this scaffold.

### Can I change the PostgreSQL version later?

Not over an existing volume: the on-disk format differs between majors. Dump and restore, or use `pg_upgrade`. This is why the major version should be chosen **before** the first run.

### Does a container rebuild delete my data?

No. Data lives in the `pgdata` Docker volume, which survives rebuilds. It is lost only if you delete the volume (`docker compose down -v` or removing it in Docker Desktop).

---

## Front end

### How do I add shadcn/ui?

shadcn/ui copies accessible components (Radix UI / Base UI primitives + Tailwind) into your repository — no runtime component library — so it fits cleanly as a purely `apps/web/` concern. The setup is verified on this stack (Tailwind 4, Vite 8, React 19, TypeScript 7). Full steps: [Recipe 7.11](ARCHITECTURE.md#711-recipe-add-shadcnui).

### What about SEO and server-side rendering?

The web app is a client-rendered single-page app, so it is not ideal for public, search-engine-indexed pages. Because the API is independent, you can later add a separate SSR or static front end (Next.js, Astro, Remix) that consumes the **same** API and the same typed client, for example for a marketing site, while keeping this app for the logged-in product.

### Can I build a mobile app on the same API?

Yes. `openapi.json` can generate clients for Swift, Kotlin, Dart and others (see [OpenAPI Generator](https://openapi-generator.tech/)). The default auth is cookie-based and browser-oriented, so plan a token strategy for native clients early: bearer access/refresh tokens or an OAuth flow. See [AUTH.md §3](AUTH.md#3-cookie-and-session-flow) and [Architecture 10.1](ARCHITECTURE.md#101-authentication-and-authorization).

### How do I make the UI responsive?

Tailwind is mobile-first: write the base classes for small screens, then add `sm:`, `md:`, `lg:` variants for larger ones (for example `flex-col sm:flex-row`). See [Tailwind's responsive design guide](https://tailwindcss.com/docs/responsive-design) and the example in [Recipe 7.3](ARCHITECTURE.md#73-recipe-list-and-create-from-the-ui).

---

## Operations and production

### Is this production-ready?

No, and it does not claim to be. It is a solid development foundation. Missing pieces include email verification, password reset, MFA, rate limiting, a bearer-token strategy for non-browser clients, organisation-scoped authorization, security headers, a production serving and CORS story, observability, full integration/E2E tests, CI/CD, deployment packaging, backups and more. Each is described in [Architecture → Production readiness](ARCHITECTURE.md#10-production-readiness-what-is-missing).

### How do I deploy it?

No deployment config is included. In outline: build the web app (`apps/web/dist`) and serve it from a CDN or reverse proxy that also forwards `/api` to the API (same origin avoids CORS); package the API in a container image built from `pnpm build`; run `pnpm --filter api db:deploy` as a separate migration step before releasing; use managed PostgreSQL with backups. See [Architecture 10.4 and 10.10](ARCHITECTURE.md#104-same-origin-serving-cors-and-tls).

### How do I add authentication?

Authentication is included. Better Auth owns the `/api/auth/*` routes, email/password, httpOnly cookie sessions, the admin plugin and optional generic OIDC. The domain API adds `/api/me`, `/api/me/profile`, the guarded admin role route and ownership-checked notes.

To protect a domain route, add the guard and the OpenAPI cookie security declaration:

```ts
app.patch(
  '/api/notes/:id',
  {
    preHandler: [app.authenticate, app.authorize('note', ['update'])],
    schema: { security: [{ cookieAuth: [] }] },
  },
  handler,
);
```

Ownership belongs in the service; a non-owner should receive 404. The notes module demonstrates both checks. The web app uses `better-auth/react` for auth routes and the generated `packages/api-client` for domain routes. See [AUTH.md](AUTH.md) for roles, profiles, SSO, bootstrap and recipes.

### Can I swap Fastify for something else later?

Yes, with bounded effort. Services, repositories, Zod schemas, Prisma, the contract and the whole front end stay as they are; only `app.ts` and the `*.routes.ts` files (the HTTP layer) are rewritten. That is the purpose of the layering rules in [Architecture 5.1](ARCHITECTURE.md#51-layers-and-what-each-may-know).

---

## Tooling

### Do I need Turborepo?

No. It runs tasks in dependency order and caches results; the `db:generate` → `typecheck`/`build`/`dev` ordering depends on it. Without it you could use `pnpm -r` and call `db:generate` explicitly first.

### Which versions should I upgrade, and when?

Patch and minor updates: regularly, with `pnpm gen:api && pnpm typecheck && pnpm build`. Majors: deliberately, reading release notes. Keep the documented pins (TypeScript 6 in `api-client`, `@types/node`, Prisma 7.x) until their conditions in [Architecture 2.6](ARCHITECTURE.md#26-why-some-versions-are-pinned) are met. Node 26 enters LTS in late October 2026; PostgreSQL 19 was still in beta when this was written.

---

[← Back to README](../README.md) · [Auth](AUTH.md) · [Architecture](ARCHITECTURE.md) · [Installation](INSTALLATION.md) · [Extending](EXTENDING.md) · [Learning](LEARNING.md)
