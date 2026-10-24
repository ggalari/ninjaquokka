# Template TODO

Open improvements to this `.devcontainer/` template, in suggested order. These are
**template-level** tasks (not part of any single generated project). Detailed guidance
for each lives in the project docs at `templates/root/docs/ARCHITECTURE.md` and
`templates/root/docs/AUTH.md` (the section is noted per item). This file is _not_ rendered
into generated projects.

## 1. Tests + CI

- [x] **Add Vitest to the API.** `test` script (`vitest run`) in `apps/api/package.json`,
      `test` task in `turbo.json`, service tests with fake repositories, and route tests
      using `app.inject` (validation + status codes, no network). See ARCHITECTURE §7.6.
- [x] **Add a GitHub Actions workflow.** `pnpm install --frozen-lockfile` → `typecheck` →
      `build` → `lint` → `format:check` → `test` → `audit`, then `pnpm gen:api` +
      `git diff --exit-code` to fail when the regenerated contract was not committed, and a
      TruffleHog secrets scan. A `ci.sh` runs the same checks locally (pre-push hook documented).
      See ARCHITECTURE §7.7.
- [x] **Add auth/ownership tests.** Route tests cover role changes, self/superadmin
      protections and ban/unban; service tests cover cross-user note denial, profile
      creation and avatar resolution. See AUTH.md and ARCHITECTURE §7.6.

## 2. Auth model (partially done)

- [x] Better Auth email/password, httpOnly cookie sessions and optional generic OIDC.
- [x] Local email/password and Keycloak 26.0.8 OIDC SSO smoke-tested against live PostgreSQL.
- [x] Global roles (`user`, `moderator`, `admin`, `superadmin`) with code-defined
      permissions, route guards and the guarded admin role-change route.
- [x] Separate `Profile` table, `/api/me`, profile editing and avatar URL resolution
      (explicit image, server-side Gravatar fallback, initials in the UI).
- [x] Ownership-checked notes (`Note.ownerId`, service checks, `note:manage` bypass).
- [x] Admin panel: user list, role changes and ban/unban.
- [ ] **Organisations/groups — deferred.** Decide membership, invitations and org-scoped
      roles before adding Better Auth's organisation plugin, tables or UI. See Phase 11 and
      AUTH.md §14.
- [ ] **MFA/2FA — open.** Needs an authenticator/recovery-code design and UI.
- [ ] **Email verification and password reset — open.** Needs a mailer and a one-time
      token/ticket model.
- [x] **Harden superadmin assignment.** Raw Better Auth admin mutations are disabled;
      role and ban changes use guarded domain routes.
- [ ] **Admin capability routes — deferred.** Create/update/remove user, set
      password/email, impersonation and session revocation are intentionally not exposed in
      v1. Add a guarded domain route, policy and tests before re-enabling each capability.
- [x] **Auth/ownership tests.** See §1.

## 3. Production story

- [ ] **API Dockerfile.** Multi-stage image: install with `--frozen-lockfile`, run `pnpm build`
      (which generates the Prisma client first), ship only production artefacts.
- [ ] **Reverse-proxy example.** Caddy (or Nginx) serving `apps/web/dist` and forwarding
      `/api` to Fastify on the same origin (so no CORS). See ARCHITECTURE §10.4 and §10.10.
- [ ] **Deployment notes.** Run `db:deploy` as a separate pre-release step, managed PostgreSQL
      with backups, per-environment secrets from a secret manager.

## 4. Automate the first migration

- [ ] The first `pnpm --filter api db:migrate --name init` is currently manual. Consider
      running it automatically in `setup.sh` (requires the `db` container to be up at scaffold
      time) or adding a clearer post-scaffold prompt. Trade-off: the template currently never
      touches the database automatically, which keeps `setup.sh` idempotent and safe.

## 5. Version-pin review

- [ ] Re-check the deliberate pins (ARCHITECTURE §2.6) against current releases: - TypeScript **6** in `packages/api-client` — drop once `openapi-typescript` supports
      TypeScript 7 (the compiler API is expected back in 7.1). - `@types/node@^24` — bump only when the Node runtime moves to 26. - Prisma **7.x** — bump to 8 when stable.
- [ ] Update the "snapshot date" line in the docs when versions change.

## 6. Cross-platform notes

- [x] Enforce LF for shell scripts with `.gitattributes` (`* text=auto`, `*.sh eol=lf`).
- [x] macOS host (Docker Desktop / Dev Containers CLI).
- [ ] Test on Windows (WSL 2), and document any host-specific caveats (file watching,
      `host.docker.internal` availability). The dev container itself is Linux, so inside it
      everything is identical; the uncertainty is only the host-side Docker/Dev Containers
      integration.

## 7. Remote development

- [x] GitHub Codespaces: `onCreateCommand` (prebuild-friendly), explicit `remoteUser`, host
      requirements, automatic forwarded origins, documented auth/SSO behaviour.
- [x] Verify a real Codespace without a prebuild: clean create, `onCreate`, container env,
      forwarded 5173, migration, sign-up/session calls.
- [x] Install Corepack shims into a writable global bin inside containers, so Turbo child
      scripts resolve the pinned pnpm instead of the image's older global version.
- [ ] Verify a Codespaces prebuild (scaffold + dependencies cached).
- [ ] Verify the SSO callback from a Codespace (requires a reachable IdP).
- [ ] **GitLab Workspaces — deferred.** It consumes `.devfile.yaml`, not `devcontainer.json`,
      and its containers cannot run as root or use `sudo` by default. Supporting it requires a
      separate devfile, a workspace-compatible image (arbitrary UID, Node 24, Corepack), port
      endpoints and runtime origin handling. Revisit only if remote GitLab is a hard requirement.

## 8. Kilo API keys (no secrets in the repo)

- [x] Move provider API keys out of `kilo.json` and into a sourced shell file
      (`~/bin/ai-keys.sh`, sourced from `~/.zshrc`), then forward them into the container via
      `devcontainer.json`:
      `"containerEnv": { "ANTHROPIC_API_KEY": "${localEnv:ANTHROPIC_API_KEY}", ... }`.
- [x] Keep a keyless `kilo.json` (only `model` and non-secret `baseURL`s) so the provider
      config travels with the project without exposing secrets.
- [x] Caveats to verify: VS Code must be launched from a terminal (so `localEnv` is present),
      and the container's `~/.config/kilo` is ephemeral here — hence env vars, not a global
      config file.
