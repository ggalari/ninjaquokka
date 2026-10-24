# Dev Container Template — Full-Stack TypeScript Starter

**A reusable `.devcontainer/` recipe** that scaffolds a Fastify + Zod + Prisma + PostgreSQL backend and a React + Vite + Tailwind front end, wired together by an OpenAPI contract and Better Auth cookie sessions, global roles, a profile module, and an ownership-checked notes demo.

This document is the **template manual**: it explains what the `.devcontainer/` directory is, how it generates a project, and how to adapt it. The documentation of the **generated project** (architecture, modules, database, testing, libraries, authentication, …) lives in `templates/root/README.md` and `templates/root/docs/`, and is copied into the project when you scaffold it. Keep the two concerns separate: change _how the project is generated_ here, change _what the project is_ in `templates/`.

---

## What is this?

Drop the `.devcontainer/` directory into an **empty Git repository** (or use this repository as a GitHub template), open it locally with VS Code + Docker or remotely in GitHub Codespaces, and one idempotent script (`setup.sh`) produces a working, typed, documented application:

- `apps/api` — Fastify REST API (Zod schemas → OpenAPI, Prisma + PostgreSQL, Better Auth cookie sessions, global roles, profile and ownership checks)
- `apps/web` — React + Vite + Tailwind + TanStack Query single-page app with auth, profile and admin panels
- `packages/api-client` — a typed client generated from the API's domain OpenAPI spec

Every file that gets generated lives in `templates/`. Project identity lives in `project.json`. `setup.sh` only orchestrates.

## Layout of `.devcontainer/`

```text
.devcontainer/
├── .env                 # development env: DB name, user, password, Better Auth secret — read by Compose
├── devcontainer.json    # VS Code/Codespaces container definition; runs setup.sh on create
├── docker-compose.yml   # app container (Node 24) + PostgreSQL 18; assembles env from .env
├── docker-compose.db.yml # host-only override: publishes PostgreSQL on 127.0.0.1:5432
├── project.json         # project identity: name, title, pnpmVersion (+ optional npmScope)
├── setup.sh             # orchestrator: pnpm → render templates → install → gen:api
├── scaffold.mjs         # renders templates/ into the workspace, substituting placeholders
├── templates/           # every generated file lives here (edit these, not setup.sh)
│   ├── root/            # → workspace root (README.md, docs/, package.json, turbo.json, …)
│   ├── apps/api/        # → apps/api
│   ├── apps/web/        # → apps/web
│   └── packages/api-client/  # → packages/api-client
└── .scaffolded          # marker written after the first successful run (commit it)
```

`templates/root/` maps to the workspace root; `templates/apps/…` and `templates/packages/…` map to themselves. The generated project's own documentation is `templates/root/README.md` and `templates/root/docs/`.

## Development environment (`.env`)

`.env` is the single place for the values that vary per project or environment:

| Variable                      | Used for                                                           | Dev default                                   |
| ----------------------------- | ------------------------------------------------------------------ | --------------------------------------------- |
| `DB_NAME`                     | the database the container creates, and the name in `DATABASE_URL` | `app`                                         |
| `POSTGRES_USER`               | the Postgres role the app connects as (and `DATABASE_URL`)         | `postgres`                                    |
| `POSTGRES_PASSWORD`           | the role's password (and `DATABASE_URL`)                           | `postgres`                                    |
| `BETTER_AUTH_SECRET`          | signs/encrypts Better Auth sessions (must be ≥ 32 chars)           | `dev-better-auth-secret-change-me-0123456789` |
| `BETTER_AUTH_URL`             | public base URL of the API; used for auth callbacks                | `http://localhost:3000`                       |
| `TRUSTED_ORIGINS`             | comma-separated browser origins allowed by Better Auth             | `http://localhost:5173`                       |
| `AUTH_EMAIL_PASSWORD_ENABLED` | enables email/password sign-in                                     | unset (defaults to `true`)                    |

Optional OIDC/SSO variables (leave them unset to keep SSO disabled):

| Variable                 | Used for                                     | Default                |
| ------------------------ | -------------------------------------------- | ---------------------- |
| `AUTH_SSO_PROVIDER_ID`   | stable provider id; used in the callback URL | unset                  |
| `AUTH_SSO_DISCOVERY_URL` | OIDC discovery document                      | unset                  |
| `AUTH_SSO_CLIENT_ID`     | client id registered in the IdP              | unset                  |
| `AUTH_SSO_CLIENT_SECRET` | client secret; omit for public/PKCE clients  | unset                  |
| `AUTH_SSO_SCOPES`        | comma-separated scopes                       | `openid,profile,email` |
| `AUTH_SSO_LABEL`         | sign-in button label                         | the provider id        |

The SSO values must match the client registered in the IdP. The callback URL is
`${BETTER_AUTH_URL}/api/auth/callback/${AUTH_SSO_PROVIDER_ID}`. Set the provider
id, discovery URL, and client id together; a partial configuration fails at
startup. The IdP origin is added to `TRUSTED_ORIGINS` automatically. Changing
`BETTER_AUTH_SECRET` invalidates existing sessions.

`docker-compose.yml` reads these automatically (Compose interpolation) and assembles `DATABASE_URL` from `POSTGRES_USER`, `POSTGRES_PASSWORD` and `DB_NAME`. The `db` service uses the same values for `POSTGRES_USER`/`POSTGRES_PASSWORD`/`POSTGRES_DB`, so the container and the app agree.

`DATABASE_URL` is deliberately not a key in `.devcontainer/.env` for container runs: Compose builds it, and the host is always `localhost:5432` because the app container shares the database's network namespace. `POSTGRES_USER` is the official Postgres image's initialisation variable, so there is no separate `DB_USER`; `DB_HOST` and `DB_PORT` are fixed conventions. Scenario 1 sources `.devcontainer/.env` and exports the assembled URL, so it needs no manual copy. The rendered `.env.example` is only for an external/self-managed database and contains a literal URL; edit that one if you use it. If you point at an external database from the container instead, set `DATABASE_URL` directly and ignore the assembled value.

**`PORT` is deliberately _not_ in `.env`.** It is referenced in four places — `docker-compose.yml`, `devcontainer.json` (`forwardPorts`/`portsAttributes`), `apps/web/vite.config.ts` (the `/api` proxy) and `apps/api/src/config.ts`. Putting it in `.env` would suggest you can change it, while three of those four sites stay hardcoded. Treat `3000` as a fixed convention (and parameterize all four sites together if you ever need to change it).

The rendered `.env.example` and the Prisma fallback in `prisma.config.ts` still show `app`/`postgres`. `.env.example` only matters for an external database; the Prisma fallback applies only when `DATABASE_URL` is unset (for example running a Prisma CLI command without the environment loaded). Scenario 1 and the container both set `DATABASE_URL`, so they do not depend on either literal.

## Quick start

1. Create a **new, empty Git repository** and clone it, or push this repository to GitHub and use it as a template.
2. Copy this `.devcontainer/` directory into it (skip when using the repository as a template).
3. Set **project identity and branding** — `project.json`, the Compose/dev-container names, and the logo (see [Project configuration and identity](#project-configuration-and-identity)).
4. Open the project in its container: locally run **Dev Containers: Reopen in Container**, or create a GitHub Codespace (see [Remote development](#remote-development)). `setup.sh` scaffolds everything, installs dependencies and generates the typed API client. The first run takes a few minutes; a Codespaces prebuild removes that wait.
5. Create the first migration, optionally bootstrap an admin, and run the app:

   ```bash
   pnpm --filter api db:migrate --name init

   # Optional: there is no default admin; sign-up creates a `user`.
   pnpm --filter api auth:create-admin \
     --email admin@example.com \
     --name "Admin" \
     --role admin

   pnpm dev
   ```

   Web app: <http://localhost:5173> · API: <http://localhost:3000/api/health> · API docs: <http://localhost:3000/docs>

6. **Commit everything**, including `pnpm-lock.yaml`, `.devcontainer/.scaffolded`, `apps/api/prisma/migrations/` and the generated `openapi.json` / `schema.d.ts`.

If `setup.sh` fails part-way, fix the cause and re-run `bash .devcontainer/setup.sh` — it resumes safely (see [Idempotency](#idempotency-and-the-marker)).

### Host notes

- **Compose:** v2.20+ is required for the top-level `name:` used to namespace containers and volumes.
- **Windows:** clone and open the repository inside **WSL 2** (Docker Desktop with the WSL 2 backend). `.gitattributes` enforces LF for scripts, so Git's `core.autocrlf` cannot break `setup.sh`.
- **macOS/Linux:** Docker Desktop or Docker Engine with Compose v2; no host Node, pnpm or PostgreSQL is needed.

## Development scenarios

All three setups run the same application; only the process and database locations differ. The generated project documents each recipe in full in `docs/INSTALLATION.md` §2.

| # | Scenario | Database | App processes | Start |
| - | -------- | -------- | ------------- | ----- |
| 1 | Local, host Node + Compose DB | Compose `db` with `.devcontainer/docker-compose.db.yml` (publishes loopback 5432) | Host (Node 24 + pnpm) | `docker compose -f .devcontainer/docker-compose.yml -f .devcontainer/docker-compose.db.yml up -d db`, then source `.devcontainer/.env`, assemble `DATABASE_URL` for the host, `pnpm install`, `pnpm dev` |
| 2 | Local dev container | Compose `db` | Inside the dev container | _Dev Containers: Reopen in Container_, then `pnpm dev` |
| 3 | GitHub Codespaces | Compose `db` | Inside the Codespace | Create the Codespace, then `pnpm dev` |

Scenario 1 is the only one that needs Node/pnpm on the host, and the only one that uses `docker-compose.db.yml`. Source `.devcontainer/.env` in the shell (`set -a; . .devcontainer/.env; set +a`) and export `DATABASE_URL="postgres://${POSTGRES_USER}:${POSTGRES_PASSWORD}@localhost:5432/${DB_NAME}"`; the same file configures Compose, so the credentials cannot drift. Stop the DB-only Compose project before switching back to the dev container, so port 5432 is free for forwarding.

## Remote development

The template supports two environments:

| Target | Status | Notes |
| ------ | ------ | ----- |
| Local VS Code Dev Containers | Supported | Docker Desktop / Docker Engine with Compose v2.20+ |
| GitHub Codespaces | Supported | Uses the same `.devcontainer/` definition; setup runs from `onCreateCommand`, so prebuilds cache the scaffold and dependencies |
| GitLab Workspaces | Not supported (v1) | GitLab consumes `.devfile.yaml`, not `devcontainer.json`, and its containers cannot run as root or use `sudo` by default. Supporting it needs a separate devfile, a workspace-compatible image and dynamic origin handling |

### GitHub Codespaces

1. Push the repository to GitHub (the scaffolded project, or this template followed by a first scaffold).
2. Create a Codespace. `setup.sh` runs as `onCreateCommand`; a prebuild includes the scaffold, dependencies and generated client. Without a prebuild the first open takes a few minutes.
3. Create the first migration, optionally bootstrap an admin, and run `pnpm dev` as in the quick start. The forwarded **5173** URL serves the web app; **3000** serves the API and docs.

Nothing needs to be configured for email/password auth when the Codespaces environment variables reach the API (normal sessions). `devcontainer.json` pins `CODESPACE_NAME` and `GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN` into the container via `containerEnv`, so they are present even when `pnpm dev` is launched from SSH or a background process. The API automatically:

- adds the forwarded web and API origins to `TRUSTED_ORIGINS`;
- uses the forwarded API URL as `BETTER_AUTH_URL` when the configured value is still `localhost`.

An explicitly configured non-localhost `BETTER_AUTH_URL` (a tunnel or custom domain) is left alone. If the variables are unavailable, add the forwarded `5173` origin to `TRUSTED_ORIGINS` and the forwarded `3000` URL to `BETTER_AUTH_URL` in `.devcontainer/.env`. For SSO, register the forwarded callback
`https://<codespace-name>-3000.<forwarding-domain>/api/auth/callback/<providerId>` with the identity provider.

Keep forwarded port visibility **private**. Port 5432 is forwarded quietly; use it from a local client only through VS Code port forwarding or `gh codespace ports forward 5432:5432`, never by making it public.

The web app only needs the **5173** origin: browser calls go to `/api` and Vite proxies them. **3000** is for direct API/Swagger access; if Codespaces does not list it (it sometimes registers only ports that were listening at creation), add it in the Ports panel or use `gh codespace ports forward 3000:3000`.

After a Codespace rebuild, the public port mapping can stay attached to the old container and return **502** even though the app is listening. Confirm the listener with `ss -ltn | grep 5173` or bypass the public tunnel with `gh codespace ports forward 5173:5173`; if that returns the app, stop/start the Codespace to recreate the tunnel (a rebuild is not required).

### Scaffolding without a container

You can scaffold on the host and open the result in Codespaces later — useful when the source repository lives on another platform (for example GitLab) and the project itself is published to GitHub:

1. Clone this repository (or copy `.devcontainer/` into an empty repository).
2. Set `project.json` and branding, as in the quick start.
3. With Node 24 available on the host, run `bash .devcontainer/setup.sh`. No Docker or PostgreSQL is required: `setup.sh` writes files, installs dependencies and generates the OpenAPI client; nothing connects to the database.
4. Commit the result, including `.devcontainer/.scaffolded`, `pnpm-lock.yaml`, `openapi.json` and `schema.d.ts`. There is no initial migration yet; create it after opening a Codespace (or a local container) where PostgreSQL is available.
5. Push to GitHub and create a Codespace.

`setup.sh` installs the pinned pnpm through Corepack into a writable directory that child processes keep on `PATH` — the global Node/npm bin inside a container, or `~/.local/bin` on a host. Inside a container this matters because pnpm removes `~/.local/bin` from the `PATH` it gives to scripts, and Turbo invokes `pnpm` again. It does not require `sudo`. Some newer Node releases no longer bundle Corepack, so use Node 24 or install the pinned pnpm manually if you scaffold on a newer host runtime.

## `project.json`

The single source of truth for the generated project's identity and toolchain:

| Field         | Used for                                                                                     | Example                  |
| ------------- | -------------------------------------------------------------------------------------------- | ------------------------ |
| `name`        | npm-safe package name; the workspace root package name                                       | `"fullstack"`            |
| `title`       | Human-readable name; App heading/alt, HTML `<title>`, README and API title                   | `"Fullstack"`            |
| `npmScope`    | _Optional_ npm scope for the client package; defaults to `@` + `name`                        | `"@fullstack"` (default) |
| `pnpmVersion` | pnpm version activated via Corepack and written to `packageManager`; pins toolchain behavior | `"12.11.2"`              |

`project.json` drives generated **content** only. It does not rename the Compose
project, the VS Code dev container, or the logo file.

**Set these values before the first scaffold.** `scaffold.mjs` renders templates
once and never overwrites existing files, and once `.devcontainer/.scaffolded`
exists `setup.sh` skips rendering entirely — so edits made afterwards do not
propagate to the generated project.

`npmScope` follows the project name by default: `name: "fullstack"` yields
`@fullstack`, giving `@fullstack/api-client` as the private client package. Set
it explicitly only when you want a different scope (for example a company scope
like `@acme`). It also appears in the import in `apps/web/src/api.ts` and the
filter in the root `gen:api` script. Any valid npm scope works (`@` prefix,
lowercase, no spaces); it only has to match a registry org if you ever publish
the client. Renaming it later means editing those generated files by hand.

`pnpmVersion` is a **toolchain pin**, not project branding, and you normally
leave it at the template default. `setup.sh` activates it through Corepack, and
`scaffold.mjs` writes it to the generated root `package.json` as
`packageManager`, which is what `pnpm/action-setup` reads in CI. It also fixes
the lockfile format and pnpm's default treatment of dependency build scripts —
the `allowBuilds` approvals in `pnpm-workspace.yaml` assume this major version.
Keeping the dev container and CI on the same pnpm is what makes
`pnpm install --frozen-lockfile` reliable. Bump it only when you intend to
upgrade pnpm, and regenerate `pnpm-lock.yaml` in the same change. Both scripts
fall back to `12.11.2` if the field is omitted.

## Project configuration and identity

Set these before the first container start where possible:

| What                        | File                               | Effect                                                                                                |
| --------------------------- | ---------------------------------- | ----------------------------------------------------------------------------------------------------- |
| Project name, title, scope  | `.devcontainer/project.json`       | Renders `{{PROJECT_NAME}}`, `{{PROJECT_TITLE}}` and `{{NPM_SCOPE}}` into the generated project        |
| Compose project name        | `COMPOSE_PROJECT_NAME` env or `.devcontainer/docker-compose.yml` | `name: ${COMPOSE_PROJECT_NAME:-fullstack-ts}` prefixes container names (`fullstack-ts-app-1`, `fullstack-ts-db-1`) and volumes |
| VS Code container label     | `.devcontainer/devcontainer.json`  | `"name": "fullstack-ts"` is the label shown in the Dev Containers UI                                  |
| Browser title and page name | Generated `apps/web/index.html`    | `<title>` comes from `{{PROJECT_TITLE}}`                                                              |
| Logo                        | `apps/web/public/logo.svg`         | Copied from `templates/apps/web/public/logo.svg`; referenced as `/logo.svg` in `apps/web/src/App.tsx` |
| Logo alt text               | `apps/web/src/App.tsx`             | Uses `{{PROJECT_TITLE}} logo` during rendering, so it follows the configured title                    |

### Rename the container / Compose project

The template starts Compose with the project name in `docker-compose.yml`
(`name: ${COMPOSE_PROJECT_NAME:-fullstack-ts}`). Change the fallback to a short
project slug, or set `COMPOSE_PROJECT_NAME` in the environment. The variable is
useful when you keep several checkouts or worktrees of the same project: each
name gets its own containers and `pgdata` volume instead of sharing one database.

Optionally update `"name"` in `devcontainer.json` to the same human-readable
label. Do this **before the first start**: Compose uses the project name to
namespace containers and the `pgdata` volume. Renaming it later creates a new
Compose project and a new database volume; the old containers and data remain
under the old name. If you already have data, keep the old name or dump/restore
the database deliberately. Do not add `container_name:` unless you need fixed
names; it bypasses Compose's project-name prefixing.

### Logo and branding

The default logo lives in `templates/apps/web/public/logo.svg` and is copied to
`apps/web/public/logo.svg`. The home page references it in
`templates/apps/web/src/App.tsx`:

```tsx
<img src="/logo.svg" alt="{{PROJECT_TITLE}} logo" />
<h1>{{PROJECT_TITLE}}</h1>
```

Replace the branding in either place:

- **Before scaffolding** — replace `templates/apps/web/public/logo.svg` (keep
  the filename), and set `title` in `project.json`. Every generated project then
  gets the new logo and title, including the alt text.
- **After scaffolding** — replace `apps/web/public/logo.svg` in the generated
  project. The `App.tsx` placeholder has already been rendered, so also update
  the heading/alt text there and in `apps/web/index.html` if the brand name
  changed.

For a JPEG, update the `src` in `apps/web/src/App.tsx` to `/logo.jpg` (or
`/logo.jpeg`) and remove the old SVG. The title is baked into generated files at
scaffold time: changing `project.json` later does not rewrite existing
`App.tsx`, `index.html`, `README.md` or OpenAPI metadata. Edit those generated
files directly, or delete the specific files you want re-rendered and re-run
`setup.sh` (existing files are otherwise skipped).

## How templating works

`scaffold.mjs` reads `project.json`, walks `templates/`, and writes each file into the workspace, substituting `{{PLACEHOLDER}}` tokens:

| Placeholder         | From                              |
| ------------------- | --------------------------------- |
| `{{PROJECT_NAME}}`  | `name`                            |
| `{{PROJECT_TITLE}}` | `title`                           |
| `{{NPM_SCOPE}}`     | `npmScope`, defaulting to `@name` |
| `{{PNPM_VERSION}}`  | `pnpmVersion`                     |

- Files are created **only if they do not already exist** (each prints `create` or `skip`). Existing files are never overwritten, which is what makes re-runs safe.
- Known text files are rendered; everything else (for example `logo.jpg`) is copied byte-for-byte, so binary assets stay intact.
- Markdown files are templated too — for example the generated project's `README.md` title uses `{{PROJECT_TITLE}}` and its docs refer to `{{NPM_SCOPE}}/api-client`.
- To add a generated file, drop it into `templates/` at the path it should have in the workspace. To change a generated file, edit the copy in `templates/`, not `setup.sh`.

## `setup.sh` phases

`setup.sh` runs `set -euo pipefail` and moves to the repository root, then:

1. **Enable pnpm** — activates the `pnpmVersion` from `project.json` via Corepack into a writable PATH directory (the global Node/npm bin in containers, `~/.local/bin` on a host), then verifies the active version.
2. **Write from templates** — runs `node .devcontainer/scaffold.mjs`.
3. **Install dependencies** — `pnpm add` for each package created in this run, including Better Auth and its Prisma adapter, then `pnpm install`. Versions resolve to latest at that moment, except the deliberate pins (see below).
4. **Generate the contract** — `pnpm gen:api` (Prisma client → `openapi.json` → typed client).
5. **Format the rendered workspace** — `pnpm format` (Prettier). Templates contain `{{PLACEHOLDER}}` tokens whose rendered values differ in width, so a hand-aligned markdown table or JSX line cannot be Prettier-clean in the template. Formatting happens after rendering, so the generated project is clean before the first commit — `format:check` in CI then passes.
6. **Finish** — `git init` if needed, writes `.devcontainer/.scaffolded`, prints next steps.

## Idempotency and the marker

- The marker `.devcontainer/.scaffolded` is written **only after a fully successful run**. If a run fails, there is no marker, and re-running resumes: existing files are skipped, only missing pieces are created.
- While the marker exists, a **container rebuild** runs only `pnpm install --frozen-lockfile` (or plain install) and `prisma generate`, then exits — nothing is recreated or overwritten.
- To **force a full re-scaffold** (rare): delete `.devcontainer/.scaffolded` and the specific files you want regenerated, then run `bash .devcontainer/setup.sh`. Existing files are still never overwritten.

## Customizing the template

- **Project identity** — edit `project.json` (`name`, `title`, `npmScope`, `pnpmVersion`); see [Project configuration and identity](#project-configuration-and-identity).
- **Container identity** — change `name:` in `docker-compose.yml` (and optionally `name` in `devcontainer.json`) before the first start.
- **Branding** — replace `templates/apps/web/public/logo.svg` before scaffolding or `apps/web/public/logo.svg` afterwards; the title/alt text come from `{{PROJECT_TITLE}}`.
- **Generated files** — edit the files under `templates/`. The layout mirrors the workspace.
- **Dependencies** — the `pnpm add` calls live in `setup.sh` (§3 of the phases). Pin versions there when needed.
- **Deliberate version pins** (kept in `setup.sh`):
  | Pin                                                       | Why                                                                 | Revisit when                                       |
  | --------------------------------------------------------- | ------------------------------------------------------------------- | -------------------------------------------------- |
  | `typescript@^6` in `packages/api-client`                  | `openapi-typescript` needs the TS compiler API that TS 7 removed    | TS 7.1 restores it                                 |
  | `@types/node@^24`                                         | must match the Node 24 runtime                                      | you move to Node 26                                |
  | `prisma@^7`, `@prisma/client@^7`, `@prisma/adapter-pg@^7` | npm `latest` pointed at an 8.0.0-rc at scaffold time                | Prisma 8 is stable                                 |
  | `better-auth@^1`, `@better-auth/prisma-adapter@^1`        | Better Auth and its Prisma adapter must stay on the same major line | a coordinated Better Auth 2.x upgrade is available |
- The generated API installs `better-auth`, `@better-auth/prisma-adapter` and Vitest; the web app installs `better-auth` for `better-auth/react`. The Better Auth CLI is invoked as `auth@latest` in the API's `auth:generate` / `auth:create-admin` scripts; it is intentionally not pinned.
- **Runtime majors** (images, Node, PostgreSQL) live in `docker-compose.yml`. Changing the PostgreSQL major over an existing volume requires dump/restore.

## Running without a dev container

The script is plain Bash and runs in a normal Linux shell on Node 24:

1. Install **Node 24** (Corepack is bundled).
2. Run **PostgreSQL 18** yourself (any install, or `docker compose -f .devcontainer/docker-compose.yml up db`).
3. Export the environment (the database name must match `DB_NAME` in `.env`):

   ```bash
   export DATABASE_URL=postgres://postgres:postgres@localhost:5432/app
   export PORT=3000
   export BETTER_AUTH_SECRET=dev-better-auth-secret-change-me-0123456789
   export BETTER_AUTH_URL=http://localhost:3000
   export TRUSTED_ORIGINS=http://localhost:5173

   # Optional: enable OIDC sign-in.
   # export AUTH_SSO_PROVIDER_ID=keycloak
   # export AUTH_SSO_DISCOVERY_URL=http://localhost:8080/realms/dev/.well-known/openid-configuration
   # export AUTH_SSO_CLIENT_ID=fullstack
   # export AUTH_SSO_CLIENT_SECRET=change-me
   # export AUTH_SSO_SCOPES=openid,profile,email
   # export AUTH_SSO_LABEL="Company SSO"
   ```

4. From the repository root: `bash .devcontainer/setup.sh`.

macOS was tested with Docker and the Dev Containers CLI. Windows/WSL 2 is **not tested**; the container is Linux, so inside the container everything is the same. On Windows, use WSL 2 and keep the repository inside the WSL file system.

## Troubleshooting (template)

| Symptom                                                              | Likely cause                                                                              | Fix                                                                                                                                                                            |
| -------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `ERR_PNPM_IGNORED_BUILDS` during install                             | pnpm 12 blocks dependency install scripts until approved                                  | `pnpm approve-builds`, or add it under `allowBuilds` in `pnpm-workspace.yaml`                                                                                                  |
| `This project is configured to use … of pnpm. Your current pnpm is …` | Corepack shims were only in `~/.local/bin`; pnpm strips that from the PATH used by Turbo children, which then find an older global pnpm | re-run `bash .devcontainer/setup.sh` (current versions install shims into a writable global bin in containers); verify with `pnpm exec sh -c 'pnpm --version'`                 |
| `pnpm is running through Node.js because the script that installs its native binary was skipped` | pnpm's optional native binary was not built (install scripts blocked)                     | benign but slower; ignore, or reinstall pnpm with build scripts allowed                                                                                                        |
| Prisma error: `binaries.prisma.sh` failed / `ENOTFOUND`              | firewall or proxy blocks Prisma's engine download                                         | allow `binaries.prisma.sh` (and npm/Corepack hosts)                                                                                                                            |
| Image tag not found (`typescript-node:1-24-bookworm`, `postgres:18`) | tag naming differs (these were not pulled during template testing)                        | check [devcontainers images](https://github.com/devcontainers/images/tree/main/src/typescript-node) / Docker Hub and adjust `docker-compose.yml`                               |
| Postgres container exits about `/var/lib/postgresql/data`            | Postgres 18 image expects the volume at `/var/lib/postgresql`                             | keep the compose mount as shipped                                                                                                                                              |
| Slow installs / file watching on Windows                             | repository on the Windows file system                                                     | move it into WSL 2                                                                                                                                                             |
| `pnpm dev` cannot read `DATABASE_URL` under Turborepo                | variable not forwarded                                                                    | keep it in `globalPassThroughEnv` in `turbo.json`                                                                                                                              |
| `Invalid environment: … AUTH_SSO_DISCOVERY_URL`                      | SSO is partially configured                                                               | set `AUTH_SSO_PROVIDER_ID`, `AUTH_SSO_DISCOVERY_URL` and `AUTH_SSO_CLIENT_ID` together, or unset all `AUTH_SSO_*`                                                              |
| SSO button never appears                                             | SSO disabled, discovery failed at API startup, or the API was not restarted               | check `/api/auth/config`; start the IdP first, verify the discovery URL, then restart the API                                                                                  |
| `401` from `/api/me` or `/api/notes`                                 | no session cookie, or the browser is calling the API origin directly                      | sign in through the web app; in development call the Vite origin (`:5173`), not `:3000`                                                                                        |
| `502`/`503` from the forwarded `5173` URL in Codespaces              | no listener, Vite moved to 5174, or the public tunnel is stale after a rebuild            | check `ss -ltn \| grep 5173`; if it listens, verify with `gh codespace ports forward 5173:5173`; then stop/start the Codespace to refresh the tunnel                            |
| `3000` missing from the Codespaces Ports panel                       | Codespaces did not register the API port                                                  | add it manually, or use `/api` and `/docs` through the 5173 proxy                                                                                                              |
| `/docs` (Swagger UI) keeps loading; some forwarded requests hang     | VS Code port-forwarding tunnel is stale, or a second dev container forwards the same port | check the **Ports** panel (a remapped address means a conflict); _Rebuild Container_ or reload the window. The server itself is fine — verify with `curl` inside the container |

For application-level troubleshooting (contract drift, missing migrations, port conflicts), see the generated project's `docs/INSTALLATION.md`.

## Verification status (honest summary)

| Verified                                                                                                                  | Not verified                                           |
| ------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| Full scaffold from scratch on macOS (Node 24, pnpm 12.11.2) and inside the dev container                                   | GitHub Codespaces prebuild                             |
| Dev Containers CLI lifecycle: Compose, `onCreate`, `remoteUser`, healthcheck, marker rebuild                               | Windows / WSL 2 host                                   |
| GitHub Codespaces: clean create, `onCreate`, `containerEnv` origins, forwarded 5173, sign-up + session, first migration    | SSO callback from a Codespace                          |
| Scenario 1 (host app + Compose DB): migration, API health, forwarded-origin auth                                           | Production IdP hardening and SAML/CAS brokers          |
| Typecheck, tests, build, typed client generation; local email/password and Keycloak 26.0.8 OIDC SSO against live PostgreSQL | The full `shadcn init` (interactive) and `add` flow    |
| `shadcn/ui` `@/*` alias + ESM `vite.config.ts` typechecks and builds                                                       |                                                        |

Treat the first real run in your environment as the final test, and watch for: image tags, Prisma engine download, and the first `db:migrate`.

---

This README describes the **template**. Once a project is generated, read its own `README.md` (at the workspace root) and `docs/` for the architecture, modules, database, testing, libraries and authentication.
