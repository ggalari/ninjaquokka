# {{PROJECT_TITLE}}

**Fastify · Zod · Prisma · PostgreSQL · React · Vite · Tailwind, wired together by an OpenAPI contract.**

A full-stack TypeScript application: a Fastify REST backend and a React single-page app share one typed API contract generated from Zod schemas, with PostgreSQL as the single database (relational now, document and vector workloads later). Authentication uses Better Auth with httpOnly cookie sessions, global roles, a profile module, and an ownership-checked notes demo.

> **Snapshot date:** versions in these documents are those resolved on **14 October 2026**. `pnpm-lock.yaml` is the source of truth. See [Versions](docs/ARCHITECTURE.md#2-building-blocks).

---

## Documentation map

| Document                                     | Read it to...                                                                                                                                                   |
| -------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **README.md** (this file)                    | Get the big picture, start fast, find the learning path                                                                                                         |
| [docs/AUTH.md](docs/AUTH.md)                 | Understand sessions, roles, permissions, profiles, avatars, SSO and admin bootstrap                                                                             |
| [docs/INSTALLATION.md](docs/INSTALLATION.md) | Set up, run day to day, manage environment variables and dependencies, fix common problems                                                                      |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Understand every building block, the request flow (diagrams), layering rules, practical recipes, dos and don'ts, and the detailed **production-readiness** list |
| [docs/FAQ.md](docs/FAQ.md)                   | Find quick answers and the reasoning behind decisions                                                                                                           |
| [docs/EXTENDING.md](docs/EXTENDING.md)       | See which decisions are resolved for v1 and which architecture/technology options remain open                                                                   |
| [docs/LEARNING.md](docs/LEARNING.md)         | Get the conceptual map: each tool's role in the dev journey, plus lint/format, testing and packaging                                                            |

---

## What is included

- **Email/password auth** with Better Auth and httpOnly cookie sessions.
- **Optional OIDC SSO** through the generic OAuth plugin; the provider is configured by environment, not hard-coded.
- **Global roles** (`user`, `moderator`, `admin`, `superadmin`) with code-defined permissions and route guards.
- **Profile module** with display name, bio, locale, timezone and bounded JSON metadata.
- **Avatar URLs** through `User.image`, a server-side Gravatar fallback and an initials fallback. No uploads in v1.
- **Admin user management**: list users, change roles and ban/unban through guarded domain routes. Self and superadmin protections are enforced on the server.
- **Ownership-checked notes**: authenticated CRUD, own-notes lists by default, and `note:manage` access for moderators/admins.
- **Typed contract**: custom domain routes generate `packages/api-client`; Better Auth routes use the Better Auth client.

See [AUTH.md](docs/AUTH.md) for the full auth model and extension recipes.

---

## The stack at a glance

| Layer           | Technology                                                               | Role                                                                                                |
| --------------- | ------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------- |
| **Front end**   | React 19, Vite 8, Tailwind CSS 4, TanStack Query 5, Better Auth client   | Responsive single-page app; session state, profile and admin panels; server-state caching           |
| **Contract**    | OpenAPI (generated), openapi-typescript, openapi-fetch                   | The only thing front end and back end share for domain routes: a typed API description and client   |
| **Back end**    | Fastify 5, Zod 4, fastify-type-provider-zod, Better Auth, Prisma adapter | REST API; Zod validates, serializes and documents; Better Auth owns credentials and cookie sessions |
| **Data**        | Prisma 7, PostgreSQL 18                                                  | Typed data access; migrations; one database for everything                                          |
| **Tooling**     | Node 24, pnpm 12, Turborepo, TypeScript 7 (6 in `api-client`), tsx       | Monorepo, task orchestration, type checking, fast dev loop                                          |
| **Environment** | Dev Container + Docker Compose                                           | Reproducible workspace with Postgres included                                                       |

Every component, its exact version, role, and link to its official site is listed in [ARCHITECTURE.md → Building blocks](docs/ARCHITECTURE.md#2-building-blocks).

---

## Branding

The home page shows the default logo in `apps/web/public/logo.svg` beside the
project name. `apps/web/src/App.tsx` references it as `/logo.svg`, with alt text
derived from `{{PROJECT_TITLE}}`; `apps/web/index.html` sets the browser title.

To use your own branding:

1. **Before scaffolding** — replace `.devcontainer/templates/apps/web/public/logo.svg`
   (keep the filename) and set `title` in `.devcontainer/project.json`. The title
   is rendered into the heading, alt text, HTML `<title>`, README and OpenAPI.
2. **After scaffolding** — replace `apps/web/public/logo.svg` in the generated
   project. If you also changed the project name, update the heading and alt text
   in `apps/web/src/App.tsx` and `<title>` in `apps/web/index.html`; changing
   `project.json` later does not overwrite existing files.
3. Keep `logo.svg` for an SVG, or use `logo.jpg` / `logo.jpeg` and update the
   `<img src>` in `App.tsx`. Delete the old file.

The Compose project name in `.devcontainer/docker-compose.yml`
(`name: ${COMPOSE_PROJECT_NAME:-fullstack-ts}`) and the Dev Containers label in
`.devcontainer/devcontainer.json` are separate from `project.json`. Set
`COMPOSE_PROJECT_NAME` or change the fallback before the first start if you
want container names such as `my-project-app-1`; changing the Compose name
later creates a new project and database volume, leaving the old data behind.

---

## Quick start

The project supports three setups: host Node with PostgreSQL in Compose, a local dev container, or GitHub Codespaces. [Installation §2](docs/INSTALLATION.md#2-first-run) has the full recipes; the steps below assume the container or a Codespace.

Locally, open the repository with VS Code and run **Dev Containers: Reopen in Container**; on GitHub, create a Codespace. `setup.sh` runs on create, installs dependencies and generates the typed client.

Prerequisites: Docker with Compose v2.20+ and the Dev Containers extension, or a GitHub Codespace. Node, pnpm and PostgreSQL live inside the container and are not required on the host.

1. **Create the database tables** (the template ships the schema but no migration):
   ```bash
   pnpm --filter api db:migrate --name init
   ```
2. **Bootstrap an admin (optional).** There is no default admin and sign-up creates a `user`:
   ```bash
   pnpm --filter api auth:create-admin \
     --email admin@example.com \
     --name "Admin" \
     --role admin
   ```
   The CLI may prompt for a password. Use `--role superadmin` only for the break-glass account; the UI and guarded role route cannot assign it. See [Admin bootstrap](docs/AUTH.md#8-admin-bootstrap).
3. **Run it:**

   ```bash
   pnpm dev
   ```

   - Web app: <http://localhost:5173>
   - API health: <http://localhost:3000/api/health>
   - Interactive API docs: <http://localhost:3000/docs>

4. **Try the flow:** sign up at the web app, edit your profile, then sign in as the admin to see the user-management panel. Notes require a signed-in session; managers can request `?scope=all`.
5. **Commit everything**, including `pnpm-lock.yaml`, `apps/api/prisma/migrations/`, and the generated `packages/api-client/openapi.json` / `src/schema.d.ts`.

---

## Environment

| Variable                      | Required | Typical local value     | Purpose                                                   |
| ----------------------------- | -------- | ----------------------- | --------------------------------------------------------- |
| `DATABASE_URL`                | Yes      | —                       | PostgreSQL connection string                              |
| `PORT`                        | No       | `3000`                  | API port; treated as a fixed convention by the Vite proxy |
| `BETTER_AUTH_SECRET`          | Yes      | —                       | Session signing secret; at least 32 characters            |
| `BETTER_AUTH_URL`             | Yes      | `http://localhost:3000` | Public API origin used for callbacks and cookies          |
| `TRUSTED_ORIGINS`             | Yes      | `http://localhost:5173` | Comma-separated web origins allowed to call the API       |
| `AUTH_EMAIL_PASSWORD_ENABLED` | No       | `true`                  | Enable email/password sign-in                             |
| `AUTH_SSO_PROVIDER_ID`        | With SSO | —                       | Provider ID used in the callback path                     |
| `AUTH_SSO_DISCOVERY_URL`      | With SSO | —                       | OIDC discovery document                                   |
| `AUTH_SSO_CLIENT_ID`          | With SSO | —                       | OAuth client ID                                           |
| `AUTH_SSO_CLIENT_SECRET`      | No       | —                       | Client secret; omit for a public/PKCE client              |
| `AUTH_SSO_SCOPES`             | No       | `openid,profile,email`  | Comma-separated scopes                                    |
| `AUTH_SSO_LABEL`              | No       | provider ID             | Button label returned by `/api/auth/config`               |

Inside the Dev Container the base values live in `.devcontainer/.env` and are passed through Compose. In GitHub Codespaces, when `CODESPACE_NAME` and `GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN` are available, the API derives the forwarded web/API origins, so email/password auth needs no changes; an explicit non-localhost `BETTER_AUTH_URL` still wins. If the variables are missing, set `BETTER_AUTH_URL` and `TRUSTED_ORIGINS` to the forwarded URLs manually. Add optional `AUTH_SSO_*` / `AUTH_EMAIL_PASSWORD_ENABLED` values to the app service environment (or your shell) when you need them. Outside the container, copy `.env.example` to `.env`. Never commit real secrets. The SSO callback is `{BETTER_AUTH_URL}/api/auth/callback/{providerId}`; when using Codespaces, register the forwarded API URL with the identity provider. See [AUTH.md §9](docs/AUTH.md#9-identity-providers) and the [Keycloak recipe](docs/AUTH.md#10-local-keycloak-recipe).

### AI provider config (Kilo)

`kilo.json` is git-ignored; the template ships a keyless `kilo.json.example`. Copy it to `kilo.json` to use the default model and the DeepSeek/OpenRouter provider config. API keys are **never** stored in the file — Kilo reads them from environment variables:

- **Local dev container** — `devcontainer.json` forwards `ANTHROPIC_API_KEY`, `DEEPSEEK_API_KEY` and `OPENROUTER_API_KEY` from the host via `${localEnv:...}`. Set them in a shell file sourced by `~/.zshrc` (or wherever you keep secrets), and launch VS Code from that terminal.
- **GitHub Codespaces** — define the same three names as Codespaces secrets; GitHub injects them as environment variables in the Codespace.

---

## Auth and API endpoints

### Domain API (typed, appears in `packages/api-client`)

| Method   | Path                        | Access                   | Purpose                                         |
| -------- | --------------------------- | ------------------------ | ----------------------------------------------- |
| `GET`    | `/api/auth/config`          | Public                   | Email/password and SSO availability             |
| `GET`    | `/api/me`                   | Authenticated            | User, profile, roles, permissions, avatar       |
| `PATCH`  | `/api/me/profile`           | Authenticated            | Update profile fields and avatar URL            |
| `POST`   | `/api/admin/users/:id/role` | `user:set-role` (admin+) | Change a user's role                            |
| `POST`   | `/api/admin/users/:id/ban`  | `user:ban` (admin+)      | Ban or unban a user; self/superadmin protected  |
| `GET`    | `/api/notes`                | Authenticated            | Own notes by default; `?scope=all` for managers |
| `POST`   | `/api/notes`                | `note:create`            | Create a note owned by the caller               |
| `GET`    | `/api/notes/:id`            | Owner or `note:manage`   | Read a note                                     |
| `PATCH`  | `/api/notes/:id`            | Owner or `note:manage`   | Update a note                                   |
| `DELETE` | `/api/notes/:id`            | Owner or `note:manage`   | Delete a note                                   |

### Better Auth (cookie session, not in the domain OpenAPI spec)

| Method | Path                             | Purpose                       |
| ------ | -------------------------------- | ----------------------------- |
| `POST` | `/api/auth/sign-up/email`        | Create an account and sign in |
| `POST` | `/api/auth/sign-in/email`        | Sign in                       |
| `POST` | `/api/auth/sign-out`             | Sign out                      |
| `GET`  | `/api/auth/get-session`          | Read the current session      |
| `GET`  | `/api/auth/callback/:providerId` | OIDC callback                 |
| `GET`  | `/api/auth/admin/list-users`     | Admin user list (`user:list`) |

Raw Better Auth admin mutations (`set-role`, `ban-user`, `unban-user`, `create-user`, `update-user`, `remove-user`, `set-user-password`, impersonation and session revocation) are disabled. V1 exposes only list/get, role changes and ban/unban; the other capabilities need a guarded domain route before they can be re-enabled. Use the guarded domain routes in the table above.

The browser uses `apps/web/src/auth-client.ts` for the Better Auth routes and `apps/web/src/api.ts` for domain routes. The session cookie is httpOnly and same-origin through the Vite proxy; bearer tokens are not enabled. Role and ban changes deliberately use domain routes, not `authClient.admin.setRole` / `banUser`; those raw mutation endpoints are disabled.

---

## Daily commands

| Command                                      | What it does                                                                                                |
| -------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `pnpm dev`                                   | Runs API (`:3000`) and web (`:5173`) together with hot reload                                               |
| `pnpm gen:api`                               | Re-exports the OpenAPI spec and regenerates the typed client types. **Run after every API contract change** |
| `pnpm typecheck`                             | Type-checks all packages; an API change that breaks the UI shows up here                                    |
| `pnpm test`                                  | Runs the API's Vitest service and route tests through Turborepo                                             |
| `pnpm build`                                 | Production builds of all packages                                                                           |
| `pnpm format`                                | Formats the whole repo with Prettier                                                                        |
| `pnpm format:check`                          | Checks formatting without changing files (use in CI)                                                        |
| `pnpm lint`                                  | Lints all packages with ESLint (flat config)                                                                |
| `pnpm --filter api db:migrate --name <name>` | Create and apply a migration from `schema.prisma` changes (dev)                                             |
| `pnpm --filter api db:deploy`                | Apply pending migrations (CI / production)                                                                  |
| `pnpm --filter api db:studio`                | Browse your data in Prisma Studio                                                                           |
| `pnpm --filter api db:generate`              | Regenerate the Prisma client (usually automatic)                                                            |
| `pnpm --filter api auth:generate`            | Regenerate Better Auth's Prisma schema after auth config changes                                            |
| `pnpm --filter api auth:create-admin`        | Bootstrap an admin or superadmin account                                                                    |

---

## CI and pre-push checks

The same checks that run in CI (`.github/workflows/ci.yml`) are available locally as a single script, so you can verify before pushing instead of discovering failures on GitHub:

```bash
bash ci.sh
```

It runs the pipeline in order: `install --frozen-lockfile` → `typecheck` → `build` → `lint` → `format:check` → `test` → `audit` → `gen:api` → `git diff --exit-code`. It exits on the first failure.

To catch untested pushes, install a pre-push hook that runs the same script:

```bash
cat > .git/hooks/pre-push <<'EOF'
#!/usr/bin/env bash
exec bash ci.sh
EOF
chmod +x .git/hooks/pre-push
```

The most common corrections this catches, in order of frequency:

1. **Uncommitted contract drift** — changed a route but forgot `pnpm gen:api`. `git diff --exit-code` catches it.
2. **Type errors** — an API change that breaks the UI's typed client. `pnpm typecheck` catches it.
3. **Formatting** — `pnpm format:check` catches it before it reaches a reviewer.
4. **Lint rules** — React Hooks violations, unused vars. `pnpm lint` catches it.
5. **Test regressions** — a service or route test that no longer passes. `pnpm test` catches it.
6. **Dependency vulnerabilities** — `pnpm audit` catches it.
7. **Committed secrets** — TruffleHog catches verified live credentials.

---

## Repository layout

```text
.
├── .devcontainer/              # dev container + the template that generated this project (committed)
├── apps/
│   ├── api/                    # Fastify + Zod + Prisma + Better Auth
│   │   ├── prisma/schema.prisma
│   │   ├── prisma.config.ts
│   │   └── src/
│   │       ├── main.ts         # starts the server
│   │       ├── app.ts          # buildApp(): assembles plugins, auth, modules, hooks (no listen)
│   │       ├── config.ts       # validates environment variables with Zod
│   │       ├── db.ts           # creates the Prisma client
│   │       ├── openapi-export.ts
│   │       ├── auth/           # auth.ts, auth.cli.ts, permissions.ts, auth.guard.ts, auth.routes.ts
│   │       ├── shared/schemas.ts
│   │       ├── modules/
│   │       │   ├── health/health.routes.ts
│   │       │   ├── profile/    # /api/me, profile schemas/repository/service/routes
│   │       │   ├── admin/      # guarded role and ban routes plus policy service
│   │       │   └── notes/      # ownership-checked CRUD: schemas, repository, service, routes
│   │       ├── test/           # Vitest service and route tests
│   │       └── generated/prisma # generated Prisma client (git-ignored)
│   └── web/                    # React + Vite + Tailwind + Better Auth client
│       ├── public/logo.svg     # default logo (replace with your own)
│       └── src/                # App, ProfilePanel, AdminPanel, Avatar, auth-client, api, main
├── packages/
│   └── api-client/             # the domain contract
│       ├── openapi.json        # generated, committed
│       └── src/ (index.ts, schema.d.ts)   # schema.d.ts generated, committed
├── docs/                       # AUTH, ARCHITECTURE, FAQ, INSTALLATION, EXTENDING, LEARNING
├── package.json  pnpm-workspace.yaml  turbo.json  .env.example  .gitignore  .prettierrc  .prettierignore  eslint.config.mjs
└── pnpm-lock.yaml
```

---

## Guiding principles

1. **The contract is the boundary for domain routes.** `apps/web` never imports from `apps/api`. They share only `packages/api-client`, generated from the API's own Zod schemas. Better Auth's own routes use the Better Auth client.
2. **One schema, many uses.** A Zod schema validates the request, types the handler, serializes the response and documents the endpoint.
3. **Framework-light core.** Services and repositories are plain functions with no Fastify imports, so the HTTP framework stays replaceable.
4. **Boring, durable foundations.** HTTP, JSON, OpenAPI, SQL and PostgreSQL outlast any framework. Choices at the edges (ORM, framework) are isolated behind thin layers.
5. **Reproducible by default.** The dev container and a committed lockfile rebuild the whole workspace.

---

## Top caveats (full list in [ARCHITECTURE.md](docs/ARCHITECTURE.md#9-dos-and-donts))

- **This is a development scaffold, not a production system.** Email verification, password reset, MFA, rate limiting, security headers, observability, full auth integration tests, CI/CD and a deployment story are still missing. See [Production readiness](docs/ARCHITECTURE.md#10-production-readiness-what-is-missing).
- **V1 is roles-only.** Organisations and groups are deferred; there is no organisation selector, invitation UI or tenant assumption. See [AUTH.md §14](docs/AUTH.md#14-future-organisations-and-groups).
- **No default admin.** Sign-up creates a `user`; bootstrap an admin with the CLI. `superadmin` is CLI-only in the intended flow. Raw Better Auth admin mutations are disabled, so role and ban changes must go through the guarded domain routes.
- **Avatars are URL-only.** No uploads. The Gravatar fallback sends an MD5 hash of the normalized email to `gravatar.com`; disable it or adjust CSP if that is not acceptable.
- **TypeScript 7 is used in `api` and `web`, but `packages/api-client` stays on TypeScript 6** (see [why](docs/ARCHITECTURE.md#26-why-some-versions-are-pinned)).
- **Always run `pnpm gen:api` after changing domain routes or schemas**, then commit the regenerated files.
- **The Vite proxy only exists in development.** In production serve web and API from the same origin (reverse proxy) or configure CORS deliberately.
- **Prisma does not natively support pgvector.** Vector columns use `Unsupported(...)` and raw SQL. See [the vector recipe](docs/ARCHITECTURE.md#78-recipe-adding-vector-search-pgvector).
- **Never run `docker compose down -v` casually**; it deletes the database volume.
- **Choose your PostgreSQL major version before the first run**; changing it later with data requires dump and restore.
- **`GET /api/notes` is unpaginated** and `/docs` is publicly exposed. Both are fine for development and must be addressed before production.

---

## Learning path

For the conceptual map (what each layer does, what each tool does, when it appears), read
[docs/LEARNING.md](docs/LEARNING.md) first. Then work through this ordered list of the
official documentation:

1. **TypeScript:** [Handbook](https://www.typescriptlang.org/docs/handbook/intro.html)
2. **Node.js fundamentals:** [Learn](https://nodejs.org/en/learn)
3. **HTTP and REST basics, OpenAPI:** [OpenAPI Specification](https://spec.openapis.org/oas/latest.html) · [OpenAPI Initiative](https://www.openapis.org/)
4. **Fastify:** [Getting Started](https://fastify.dev/docs/latest/Guides/Getting-Started/) → [Validation and Serialization](https://fastify.dev/docs/latest/Reference/Validation-and-Serialization/) → [Plugins and Encapsulation](https://fastify.dev/docs/latest/Reference/Encapsulation/) → [Hooks and Lifecycle](https://fastify.dev/docs/latest/Reference/Lifecycle/) → [Testing](https://fastify.dev/docs/latest/Guides/Testing/) → [Recommendations (production)](https://fastify.dev/docs/latest/Guides/Recommendations/)
5. **Zod:** [Documentation](https://zod.dev/) (schemas, refinements, transforms, JSON Schema output)
6. **SQL and PostgreSQL:** [PostgreSQL documentation](https://www.postgresql.org/docs/) (start with the tutorial, then indexes and `EXPLAIN`)
7. **Prisma:** [Documentation](https://www.prisma.io/docs) (schema, migrations, relations, raw queries)
8. **Authentication:** [AUTH.md](docs/AUTH.md) · [Better Auth documentation](https://www.better-auth.com/docs)
9. **React:** [react.dev Learn](https://react.dev/learn), especially [Thinking in React](https://react.dev/learn/thinking-in-react) and [You Might Not Need an Effect](https://react.dev/learn/you-might-not-need-an-effect)
10. **TanStack Query:** [Documentation](https://tanstack.com/query/latest) (queries, mutations, invalidation, caching defaults)
11. **Tailwind CSS:** [Documentation](https://tailwindcss.com/docs), especially [Responsive Design](https://tailwindcss.com/docs/responsive-design)
12. **Monorepo tooling:** [pnpm workspaces](https://pnpm.io/workspaces) · [Turborepo](https://turborepo.com/)
13. **Security:** [OWASP API Security Top 10](https://owasp.org/API-Security/)

Practical, copy-paste-able recipes for this exact stack are in [ARCHITECTURE.md → Practical recipes](docs/ARCHITECTURE.md#7-practical-recipes).

---

_Links point to official sites and documentation home pages. Deep links can move; if one breaks, search the site._
