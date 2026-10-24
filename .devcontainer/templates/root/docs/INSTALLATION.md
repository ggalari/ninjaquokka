# Setup and Daily Workflow

How to set up the generated project, run it day to day, manage environment variables and dependencies, and fix common problems. For how the project was generated (the `.devcontainer/` template), see the template's own README inside `.devcontainer/`. For the auth model and recipes, see [AUTH.md](AUTH.md).

**Contents**

1. [Prerequisites](#1-prerequisites)
2. [First run](#2-first-run)
3. [Daily workflow](#3-daily-workflow)
4. [Environment variables](#4-environment-variables)
5. [Rebuilding the container](#5-rebuilding-the-container)
6. [Updating dependencies](#6-updating-dependencies)
7. [Troubleshooting](#7-troubleshooting)

---

## 1. Prerequisites

- **Docker** with Compose v2.20+ ([Docker Desktop](https://www.docker.com/products/docker-desktop/) on macOS/Windows, Docker Engine on Linux). On Windows, use the WSL 2 backend and open the repository from inside WSL.
- **VS Code** with the [Dev Containers extension](https://marketplace.visualstudio.com/items?itemName=ms-vscode-remote.remote-containers), or [GitHub Codespaces](https://github.com/features/codespaces).

Node.js, pnpm and PostgreSQL are **not** required on your machine — they live in the dev container. GitLab Workspaces is **not** supported by this template (it uses devfiles rather than `.devcontainer/` and cannot run these containers as root); use a local dev container or GitHub Codespaces.

## 2. First run

There are three supported setups. Pick one, then follow the common steps at the end of this section.

### 2.1 Local: app on the host, PostgreSQL in Compose

Use this when you want Node and pnpm on your machine and Docker only for the database. Requires Node 24 (with Corepack) and Docker Compose v2.20+; no VS Code Dev Containers extension is involved.

1. **Start only the database**, with the host override that publishes PostgreSQL on loopback:
   ```bash
   docker compose -f .devcontainer/docker-compose.yml -f .devcontainer/docker-compose.db.yml up -d db
   ```
   The override binds `127.0.0.1:5432`, so the database is not exposed to your network. If port 5432 is already in use, stop the other PostgreSQL instance (or change the published port and `DATABASE_URL` together).
2. **Load the same values Compose uses**, then assemble the URL for the host:
   ```bash
   set -a
   . .devcontainer/.env
   set +a
   export DATABASE_URL="postgres://${POSTGRES_USER}:${POSTGRES_PASSWORD}@localhost:5432/${DB_NAME}"
   ```
   `.devcontainer/.env` is the single source of truth, so changing `POSTGRES_USER`, `POSTGRES_PASSWORD` or `DB_NAME` there updates the container, the host URL and Prisma together. Re-run this block in every new shell. Only if you use an external database instead of the Compose `db` service, copy `.env.example` to `.env` and edit its literal `DATABASE_URL`.
3. **Install dependencies on the host** (the container's `node_modules` may contain Linux binaries if you scaffolded elsewhere):
   ```bash
   pnpm install --frozen-lockfile
   ```
4. Continue with the [common steps](#common-steps).

To go back to the dev container, stop this database first so VS Code can forward 5432:
`docker compose -f .devcontainer/docker-compose.yml -f .devcontainer/docker-compose.db.yml down` (without `-v`, which would delete the data volume).

### 2.2 Local: Dev Containers in VS Code

Requires Docker and the Dev Containers extension. Node, pnpm and PostgreSQL stay inside the container.

1. Open the repository in VS Code and run _Dev Containers: Reopen in Container_.
2. `setup.sh` runs as `onCreateCommand`, installs dependencies and generates the typed client. The first run takes a few minutes; rebuilds use the marker and only restore dependencies.
3. Continue with the [common steps](#common-steps).

### 2.3 Remote: GitHub Codespaces

1. Push the repository to GitHub.
2. Create a Codespace. `setup.sh` runs as `onCreateCommand`; with a prebuild the scaffold, dependencies and client are already cached.
3. Continue with the [common steps](#common-steps).

Codespaces forwards the web app and API; email/password auth needs no extra configuration because the API derives the forwarded origins (see [Environment variables](#4-environment-variables)). Keep forwarded ports private. For SSO, register the forwarded API callback with your identity provider.

Run `pnpm dev` from `/workspace` and keep the terminal open. If the forwarded 5173 URL returns **502** while `ss -ltn | grep 5173` shows a listener, the public tunnel is stale (common after a rebuild): stop/start the Codespace, not rebuild. `gh codespace ports forward 5173:5173` bypasses the public tunnel and confirms the app itself is reachable. The web app only needs 5173; add 3000 in the Ports panel if you want direct API/Swagger access.

### Common steps

1. **Create the first migration** (the template ships the Better Auth tables, `Profile` and `Note`, but no migration):
   ```bash
   pnpm --filter api db:migrate --name init
   ```
   This needs a reachable database and downloads Prisma's schema engine on first use.
2. **Bootstrap an admin (optional).** There is no default admin; sign-up creates a `user`:
   ```bash
   pnpm --filter api auth:create-admin \
     --email admin@example.com \
     --name "Admin" \
     --role admin
   ```
   Use `--role superadmin` only for the break-glass account. See [Admin bootstrap](AUTH.md#8-admin-bootstrap).
3. **Start everything:**

   ```bash
   pnpm dev
   ```

   - <http://localhost:5173> shows the default logo beside "{{PROJECT_TITLE}}" with `API status: ok`.
   - <http://localhost:3000/api/health> returns `{"status":"ok"}`.
   - <http://localhost:3000/docs> shows the interactive API documentation.
   - In Codespaces, use the forwarded 5173 URL from the Ports panel instead of localhost.

4. **Try the flow:** sign up at the web app, edit your profile, and sign in as the admin to see the user-management panel. Domain routes use the cookie session:
   - `GET /api/me` returns the user, profile, roles and permissions.
   - Notes require a signed-in session; managers can request `GET /api/notes?scope=all`.
   - Better Auth routes live under `/api/auth/*`; there is no bearer token to copy.
5. **Run the quality gates once**: `pnpm typecheck` and `pnpm build` should pass.
6. **Commit** all of: `pnpm-lock.yaml`, `apps/api/prisma/migrations/`, `packages/api-client/openapi.json`, `packages/api-client/src/schema.d.ts`, and the rest of the source. (`apps/api/src/generated/` and `.env` are git-ignored on purpose.)

## 3. Daily workflow

```bash
pnpm dev                       # API + web with hot reload
# ... change code ...
pnpm gen:api                   # after ANY change to domain routes or Zod schemas
pnpm typecheck                 # the compiler tells you what the change broke in the UI
pnpm --filter api db:migrate --name add_something   # after editing schema.prisma
pnpm --filter api auth:generate                     # after changing Better Auth config
git add -A && git commit
```

## 4. Environment variables

The API reads them in `apps/api/src/config.ts` (validated with Zod; a missing or malformed value fails fast):

| Variable                      | Purpose                                                    | Dev value (from `.devcontainer/.env`, via `docker-compose.yml`)        |
| ----------------------------- | ---------------------------------------------------------- | ---------------------------------------------------------------------- |
| `DATABASE_URL`                | PostgreSQL connection string                               | assembled from `POSTGRES_USER`/`POSTGRES_PASSWORD`/`DB_NAME` in `.env` |
| `PORT`                        | API listen port                                            | `3000` (a fixed convention — see the note below)                       |
| `BETTER_AUTH_SECRET`          | Signs/encrypts Better Auth sessions and tokens (≥32 chars) | `dev-better-auth-secret-change-me-0123456789` from `.env`              |
| `BETTER_AUTH_URL`             | Public base URL of the API; used for auth callbacks        | `http://localhost:3000` from `.env`; auto-derived in Codespaces         |
| `TRUSTED_ORIGINS`             | Comma-separated browser origins allowed by Better Auth     | `http://localhost:5173` from `.env`; forwarded origin added in Codespaces |
| `AUTH_EMAIL_PASSWORD_ENABLED` | Enables email/password sign-in                             | unset; defaults to `true`                                              |

Optional OIDC/SSO variables (leave them unset to keep SSO disabled):

| Variable                 | Purpose                                      | Default                |
| ------------------------ | -------------------------------------------- | ---------------------- |
| `AUTH_SSO_PROVIDER_ID`   | Stable provider id; used in the callback URL | unset                  |
| `AUTH_SSO_DISCOVERY_URL` | OIDC discovery document                      | unset                  |
| `AUTH_SSO_CLIENT_ID`     | Client id registered in the IdP              | unset                  |
| `AUTH_SSO_CLIENT_SECRET` | Client secret; omit for public/PKCE clients  | unset                  |
| `AUTH_SSO_SCOPES`        | Comma-separated scopes                       | `openid,profile,email` |
| `AUTH_SSO_LABEL`         | Sign-in button label                         | the provider id        |

The SSO values must match the client registered in the IdP. The callback URL is
`${BETTER_AUTH_URL}/api/auth/callback/${AUTH_SSO_PROVIDER_ID}`. Set the provider
id, discovery URL, and client id together; a partial configuration fails at
startup. The IdP origin is added to `TRUSTED_ORIGINS` automatically. The provider
must be reachable when the API starts, or it is skipped. Changing
`BETTER_AUTH_SECRET` invalidates existing sessions. Full recipes:
[AUTH.md §9](AUTH.md#9-identity-providers) and [§10](AUTH.md#10-local-keycloak-recipe).

`POSTGRES_USER`, `POSTGRES_PASSWORD` and `DB_NAME` live only in `.devcontainer/.env`; Compose uses them to build `DATABASE_URL` and to configure the Postgres container, but the app itself only sees the assembled `DATABASE_URL`. `POSTGRES_USER` is the official Postgres image's initialisation variable, so there is no separate `DB_USER`; `DB_HOST` and `DB_PORT` are fixed conventions (`localhost`, `5432`) because the app container shares the database's network namespace. Scenario 2.1 sources `.devcontainer/.env` and exports the assembled URL, so no copy is needed. To use an external or self-managed database, set `DATABASE_URL` directly (or copy `.env.example` and edit its literal URL).

`PORT` is intentionally **not** in `.env` because it is referenced in four places — `docker-compose.yml`, `devcontainer.json` (`forwardPorts`), `apps/web/vite.config.ts` (the `/api` proxy) and `apps/api/src/config.ts`; change it in all four places together if you ever need to.

GitHub Codespaces sets `CODESPACE_NAME` and `GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN`; `devcontainer.json` pins both into the container via `containerEnv`. When both are present, the API adds `https://<name>-5173.<domain>` and `https://<name>-3000.<domain>` to `TRUSTED_ORIGINS`, and uses the forwarded API URL as `BETTER_AUTH_URL` if the configured value is still localhost. An explicit non-localhost value wins. These variables are passed through `globalPassThroughEnv`; leave them unset for local development.

Add a new variable in three places: the Zod schema in `apps/api/src/config.ts`, `.env.example`, and `globalPassThroughEnv` in `turbo.json` (Turborepo hides unknown variables from tasks). For the dev container, set it under the `app` service's `environment` in `.devcontainer/docker-compose.yml` — and if it is project-specific, put it in `.devcontainer/.env` and reference it with `${VAR}` (Compose reads that file automatically).

## 5. Rebuilding the container

_Dev Containers: Rebuild Container_ creates a fresh container. What happens:

| Item                    | Effect of a rebuild                                                       |
| ----------------------- | ------------------------------------------------------------------------- |
| Your source code        | **Untouched.** It lives on your machine and is mounted into the container |
| `node_modules`          | Restored from `pnpm-lock.yaml` if missing                                 |
| Prisma generated client | Regenerated                                                               |
| Database data           | **Preserved**; stored in the `pgdata` Docker volume                       |

Data is lost only if you delete the volume yourself (`docker compose down -v`, or removing it in Docker Desktop).

## 6. Updating dependencies

Versions are fixed by `pnpm-lock.yaml`. To update:

```bash
pnpm up -r --latest            # interactive alternative: pnpm up -r -i --latest
pnpm gen:api && pnpm typecheck && pnpm build
```

Then run your tests and the app. **Respect the pins** ([Architecture 2.6](ARCHITECTURE.md#26-why-some-versions-are-pinned)): after a blanket upgrade, check that `packages/api-client` is still on TypeScript 6 and `@types/node` still matches your Node major.

Upgrade runtime majors deliberately (see [Architecture 2.6](ARCHITECTURE.md#26-why-some-versions-are-pinned) and the release notes): Prisma 8, TypeScript 7.1+, Fastify majors, and the Node/PostgreSQL image tags.

## 7. Troubleshooting

| Symptom                                                                              | Likely cause                                                                               | Fix                                                                                                                                                  |
| ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Invalid environment: … DATABASE_URL` / `… BETTER_AUTH_SECRET` when starting the API | a required variable is missing, or the auth secret is shorter than 32 characters           | in the dev container they are set automatically (change `.devcontainer/.env` / `docker-compose.yml`, then _Rebuild Container_); otherwise `export …` |
| `Invalid environment: … AUTH_SSO_DISCOVERY_URL` after adding SSO variables           | SSO is partially configured                                                                | set `AUTH_SSO_PROVIDER_ID`, `AUTH_SSO_DISCOVERY_URL`, and `AUTH_SSO_CLIENT_ID` together, or unset all `AUTH_SSO_*`                                   |
| `connection refused` to `localhost:5432`                                             | the `db` container is not running, or the app container lost its shared network            | check `docker ps`; _Rebuild Container_ to re-attach                                                                                                  |
| `relation "Note" does not exist`                                                     | the migration has not been applied                                                         | `pnpm --filter api db:migrate --name init`                                                                                                           |
| TypeScript errors in `apps/web` after changing the API                               | the contract is stale or the change broke a call                                           | `pnpm gen:api`, then fix the call sites the compiler lists                                                                                           |
| `Cannot find module '…/generated/prisma/client.js'`                                  | the Prisma client has not been generated                                                   | `pnpm --filter api db:generate` (or run `pnpm typecheck` / `pnpm dev`, which generate it first)                                                      |
| `This project is configured to use … of pnpm. Your current pnpm is …`                | Corepack shims are only in `~/.local/bin`, which pnpm removes from the PATH given to Turbo child scripts | re-run `bash .devcontainer/setup.sh` (shims go into a writable global bin inside containers); verify `pnpm exec sh -c 'pnpm --version'`              |
| `pnpm is running through Node.js because the script that installs its native binary was skipped` | pnpm's optional native binary was not built (install scripts blocked) | benign but slower; ignore, or reinstall pnpm with build scripts allowed                                                                              |
| `openapi-typescript` crashes with `createKeywordTypeNode`                            | `packages/api-client` was upgraded to TypeScript 7                                         | pin `typescript@^6` in that package                                                                                                                  |
| Port 3000/5173 already in use                                                        | another process or a previous dev server                                                   | stop it, or change `PORT` / the Vite port                                                                                                            |
| Swagger UI at `/docs` keeps loading and never renders                                | VS Code's port-forwarding tunnel is stale, or another dev container forwards the same port | check the **Ports** panel (a remapped "Forwarded Address" means a conflict); _Rebuild Container_ or reload the window to re-establish the tunnel     |
| `502`/`503` from the forwarded `5173` URL in Codespaces                              | no process listening (dev server stopped, Vite moved to 5174), or the tunnel is stale after a rebuild | run `pnpm dev` from `/workspace`, keep it open, check the Vite line and `ss -ltn \| grep 5173`; if a listener exists, stop/start the Codespace to refresh the tunnel, or use `gh codespace ports forward 5173:5173` |
| `3000` missing from the Codespaces Ports panel                                        | Codespaces did not register the API port                                                   | add 3000 in the Ports panel; the web app still works through the 5173 `/api` proxy                                                                  |
| `pnpm dev` cannot read `DATABASE_URL` under Turborepo                                | the variable is not forwarded to tasks                                                     | keep it in `globalPassThroughEnv` in `turbo.json`                                                                                                    |
| `401` from `/api/me` or `/api/notes`                                                 | no session cookie, or the browser is calling a different origin                            | sign in again; in development call the Vite origin (`:5173`), not the API directly                                                                   |
| `403 Invalid origin` on sign-in in Codespaces                                        | the forwarded web origin is not trusted                                                    | ensure `CODESPACE_NAME` and `GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN` reach the API (passed through `globalPassThroughEnv`), or add the forwarded 5173 URL to `TRUSTED_ORIGINS` |
| PostgreSQL client cannot reach `localhost:5432` in Codespaces                        | Codespaces forwards HTTP ports in the browser, not raw TCP to your machine                 | forward the port in the Ports panel or run `gh codespace ports forward 5432:5432`; keep it private                                                   |
| `403` from `/api/notes?scope=all`                                                    | the caller lacks `note:manage`                                                             | use a moderator/admin/superadmin, or omit `scope=all`                                                                                                |
| Admin panel is missing                                                               | the signed-in user is not an admin or superadmin                                           | bootstrap an admin with `auth:create-admin`, then sign in again; `canManageUsers` comes from `/api/me`                                               |
| SSO button is missing                                                                | SSO is not enabled, or discovery failed when the API started                               | check `/api/auth/config`; start the IdP first, verify the discovery URL, then restart the API                                                        |
| `POST /api/auth/admin/set-role` returns 404                                          | Raw Better Auth admin mutations are intentionally disabled                                 | use the guarded domain role and ban routes; the raw paths are listed in `DISABLED_ADMIN_PATHS`                                                       |

---

[← Back to README](../README.md) · [Auth](AUTH.md) · [Architecture](ARCHITECTURE.md) · [FAQ](FAQ.md) · [Extending](EXTENDING.md) · [Learning](LEARNING.md)
