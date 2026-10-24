# Learning Guide

A conceptual map of the whole stack: what each layer is for, what each tool actually
does, and when it appears in the day-to-day journey. Read this before (or alongside) the
[README learning path](../README.md#learning-path), which lists the official resources in
order.

**Contents**

1. [The stack at a glance](#1-the-stack-at-a-glance)
2. [The development journey (when each tool appears)](#2-the-development-journey-when-each-tool-appears)
3. [Tooling roles (what each tool does)](#3-tooling-roles-what-each-tool-does)
4. [Lint & format](#4-lint--format)
5. [Testing](#5-testing)
6. [Packaging (CI/CD)](#6-packaging-cicd)
7. [How to approach it](#7-how-to-approach-it)

---

## 1. The stack at a glance

The per-layer technology list (with versions) is the
[README stack table](../README.md#the-stack-at-a-glance); the detailed reference is
[ARCHITECTURE §2](ARCHITECTURE.md#2-building-blocks). What this guide adds is the **flow** —
the mental model to internalize, in one sentence:

> The browser calls `/api`, Vite proxies to Fastify, Zod validates the request, the service
> applies logic, the repository talks to PostgreSQL through Prisma, Zod serializes the
> response, that same Zod schema becomes the OpenAPI spec, and a generated typed client is
> what the front end uses — so the _contract_ is the only bridge between the two halves.

Auth is a second, deliberate surface. Better Auth owns `/api/auth/*`, credentials, cookie
sessions, the admin plugin and optional OIDC. Custom domain routes use `app.authenticate`,
`app.authorize` or `app.requireRole`, and check ownership in the service. The browser uses
`better-auth/react` for auth calls and the generated domain client for everything else. Read
[AUTH.md](AUTH.md) alongside this guide.

---

## 2. The development journey (when each tool appears)

Follow the tool in parentheses the first time it shows up.

1. **You open the project** — the dev container starts Docker Compose: an `app` container
   (Node 24) and a `db` container (PostgreSQL). `setup.sh` runs once to scaffold and
   install. _(Docker Compose, dev container, setup.sh)_
2. **Dependencies install** — `pnpm` reads `pnpm-workspace.yaml` and installs every package
   in `apps/*` and `packages/*`; `corepack` makes sure you're on the pinned pnpm version.
   _(pnpm, Corepack)_
3. **You run `pnpm dev`** — `turbo` looks at `turbo.json`, sees that `dev` depends on
   `db:generate`, runs Prisma first, then starts the API and the web app in parallel.
   _(Turborepo, Prisma generate, tsx, Vite)_
4. **You write a back-end endpoint** — a Zod schema, a route, a service, a repository; add
   auth guards if the route needs a user. _(Fastify, Zod, Prisma, Better Auth guards)_
5. **You regenerate the contract** — `pnpm gen:api` runs Prisma, dumps the OpenAPI spec,
   and `openapi-typescript` turns it into types for the client. _(swagger, openapi-typescript)_
6. **You write front-end code** — import the typed client and call it; React renders, Tailwind
   styles, TanStack Query caches. Auth calls use the Better Auth client. _(openapi-fetch,
   better-auth/react, React, Tailwind, TanStack Query)_
7. **You check your work** — `typecheck`, `lint`, `format:check`. _(tsc, ESLint, Prettier)_
8. **You build for production** — `turbo` runs the `build` tasks in dependency order; the API
   compiles to `dist/`, the web app bundles to `dist/`. _(tsc, Vite build)_
9. **You ship** — CI installs frozen deps, runs the gates, builds images/static assets, then
   runs migrations. _(pnpm frozen-lockfile, db:deploy, Dockerfile)_

---

## 3. Tooling roles (what each tool does)

Every tool in the repo, in one line. "Runs" = the moment in the journey where you meet it.
The detailed reference (exact versions, replaceability, official links) is
[ARCHITECTURE §2](ARCHITECTURE.md#2-building-blocks); this table is the _role_ view for
learning.

### Package & task management

| Tool          | Role                                                                                                                                                                               | Runs                             |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------- |
| **Corepack**  | Pins and activates the exact pnpm version (from `project.json` via `packageManager`)                                                                                               | on container open                |
| **pnpm**      | Package manager + **workspaces**: installs deps, links `{{NPM_SCOPE}}/api-client` to the workspace, runs scripts, blocks build scripts until approved                               | install, every script            |
| **Turborepo** | **Task orchestrator** across the monorepo: knows the task dependency order (`db:generate` → `dev`/`build`/`typecheck`), caches results, forwards env vars (`globalPassThroughEnv`) | `pnpm dev`, `build`, `typecheck` |
| **tsx**       | **Runs TypeScript directly** (no compile step) — powers the API's `dev` hot-reload and the `openapi-export` script                                                                 | API dev, `gen:api`               |

### Back end

| Tool                              | Role                                                                                    | Runs                                 |
| --------------------------------- | --------------------------------------------------------------------------------------- | ------------------------------------ |
| **Fastify**                       | The web framework: routing, lifecycle hooks, plugins, logging                           | every request                        |
| **Zod**                           | Runtime schema validation **and** TypeScript type inference in one                      | request in, response out             |
| **fastify-type-provider-zod**     | Glue that lets Fastify use Zod for validation, serialization **and** OpenAPI generation | app startup                          |
| **@fastify/swagger + swagger-ui** | Turns the Zod schemas into an OpenAPI spec and serves the interactive `/docs` UI        | app startup, `gen:api`               |
| **Better Auth**                   | Owns credentials, sessions, cookie transport, the admin plugin and optional OIDC        | auth routes                          |
| **@better-auth/prisma-adapter**   | Persists Better Auth's users, sessions and accounts through Prisma                      | every auth query                     |
| **Prisma**                        | ORM: `schema.prisma` → migrations + a typed client                                      | `db:generate`, `db:migrate`, queries |
| **@prisma/adapter-pg**            | Lets Prisma talk to PostgreSQL through the `pg` driver (no binary engine)               | every query                          |

### Contract

| Tool                   | Role                                                            | Runs                 |
| ---------------------- | --------------------------------------------------------------- | -------------------- |
| **OpenAPI** (the spec) | The language-neutral description of the API, generated from Zod | `gen:api`            |
| **openapi-typescript** | Generates `schema.d.ts` (TypeScript types) from the spec        | `gen:api`            |
| **openapi-fetch**      | A tiny typed `fetch` client that uses those types               | every front-end call |

### Front end

| Tool                     | Role                                                                                                     | Runs           |
| ------------------------ | -------------------------------------------------------------------------------------------------------- | -------------- |
| **Vite**                 | Dev server (hot reload) **and** production bundler; hosts the React and Tailwind plugins; proxies `/api` | `dev`, `build` |
| **@vitejs/plugin-react** | React fast refresh + JSX transform                                                                       | `dev`, `build` |
| **Tailwind CSS 4**       | Utility-first CSS, imported with a single `@import "tailwindcss"`                                        | `build`        |
| **@tailwindcss/vite**    | Wires Tailwind into Vite (no separate PostCSS config)                                                    | `build`        |
| **React**                | The UI library (components, hooks)                                                                       | always         |
| **TanStack Query**       | Server-state fetching/caching: queries, mutations, invalidation                                          | front-end data |
| **better-auth/react**    | Session state, sign-in/out, SSO and Better Auth admin calls                                              | auth UI        |

### Quality

| Tool                    | Role                                                                 | Runs                     |
| ----------------------- | -------------------------------------------------------------------- | ------------------------ |
| **TypeScript (`tsc`)**  | Static type checking; catches contract breaks between API and UI     | `typecheck`, `build`     |
| **ESLint**              | Correctness linting (unused vars, React Hooks rules, bad patterns)   | `lint`                   |
| **Prettier**            | Formatting only (quotes, commas, wrapping)                           | `format`, `format:check` |
| **Vitest / Playwright** | API service and route tests with Vitest; Playwright is not wired yet | `test`                   |

---

## 4. Lint & format

Two different tools, two different scopes — they never overlap:

|                       | Prettier                            | ESLint                            |
| --------------------- | ----------------------------------- | --------------------------------- |
| Job                   | Formatting only                     | Correctness only                  |
| Catches bugs?         | No                                  | Yes                               |
| Fixes style?          | Yes                                 | No (deliberately)                 |
| Command (write/check) | `pnpm format` / `pnpm format:check` | `pnpm lint`                       |
| Config                | `.prettierrc`, `.prettierignore`    | `eslint.config.mjs` (flat config) |

The repo's ESLint config has **zero** formatting rules on purpose, so the two never fight.
In CI run all three: `typecheck` (types) + `lint` (correctness) + `format:check` (style).
How-to: [ARCHITECTURE §7.9](ARCHITECTURE.md#79-recipe-formatting) (formatting) and
[§7.10](ARCHITECTURE.md#710-recipe-linting) (linting).

To learn them, follow one rule end-to-end in each: _why_ does Prettier force `singleQuote`,
and _why_ does ESLint flag `react-hooks/exhaustive-deps`? One concrete case each is enough
to get the mental model.

---

## 5. Testing

**Back end (Vitest — included for services and routes):**

Run `pnpm --filter api test` (or `pnpm test` for the workspace).

- **Unit (services)** — the payoff of the layering: services are pure functions with no
  Fastify/Prisma imports, so you test them with a hand-written **fake repository** (no DB,
  no network).
- **Route (`app.inject`)** — Fastify calls the app in-process with fake HTTP; test validation
  and status codes (200/400/404/409) without opening a port.
- **Integration (Testcontainers)** — real PostgreSQL in a throwaway container, only when you
  need real SQL.

**Front end:**

- **Component** — Vitest + React Testing Library (render, assert output).
- **E2E** — Playwright driving a real browser against the running app.

Mental model: test logic at the **service** layer, HTTP at the **route** layer, and only reach
for a real DB/browser for what you can't fake. Full recipe: `ARCHITECTURE.md §7.6`.

---

## 6. Packaging (CI/CD)

What "packaging" means in this monorepo:

- **Task graph** — Turborepo orders `db:generate` → `build`/`typecheck`/`dev`; `pnpm build`
  produces a `dist/` per package.
- **Lockfile** — `pnpm-lock.yaml` pins versions; CI installs with
  `pnpm install --frozen-lockfile` (never mutates it).
- **Two artifact kinds:**
  - **API** → a Node runtime + `dist/`, shipped as a **Docker image** (multi-stage: frozen
    install → build → prod files only). TODO item 2.
  - **Web** → a **static** `dist/` (hashed assets), served by a CDN or reverse proxy.
- **Migrations** → `pnpm --filter api db:deploy` runs as a **separate** step before release
  (never baked into app startup).

The CI/CD shape: `install --frozen-lockfile` → `gen:api` → `typecheck` → `lint` →
`format:check` → `build` → `test` → build image / upload static → `db:deploy`.
Full outline: `ARCHITECTURE.md §7.7` + §10.4/§10.10.

---

## 7. How to approach it

The ordered list of official resources lives in the
[README learning path](../README.md#learning-path) — it isn't repeated here. Work through it
in order, and come back to the sections above when you reach their topic: [§4](#4-lint--format)
(lint & format), [§5](#5-testing) (testing) and [§6](#6-packaging-cicd) (packaging).

Keep the [layer map](#1-the-stack-at-a-glance) and the
[journey](#2-the-development-journey-when-each-tool-appears) in front of you: every tool sits
in exactly one row of the map and shows up at exactly one step of the journey.

---

[← Back to README](../README.md) · [Auth](AUTH.md) · [Installation](INSTALLATION.md) · [Architecture](ARCHITECTURE.md) · [FAQ](FAQ.md) · [Extending](EXTENDING.md)
