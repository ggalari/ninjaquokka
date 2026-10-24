# Extending the Scaffold — Pending and Resolved Decisions

The scaffold is a **foundation**, not a finished product. This document is the catalogue of
**architecture and technology decisions still to be made** as the site grows, grouped into
areas, each with the options and their trade-offs. Pick one area (or sub-area) at a time,
decide, design, then implement — and come back and mark it resolved.

Resolved decisions are kept here as short summaries with a link to the canonical explanation.
They are not deleted: the rationale and the future extension path stay discoverable.

**Relationship to the other docs**

- [AUTH.md](AUTH.md) — how the v1 auth, profile, roles and ownership model works.
- [ARCHITECTURE.md §8](ARCHITECTURE.md#8-decision-log) — the decisions _already made_ for the scaffold.
- [ARCHITECTURE.md §10](ARCHITECTURE.md#10-production-readiness-what-is-missing) — the _what and why_ of each gap.
- This document — the _remaining options and trade-offs_, plus whether they belong in the template.

**Resolved in v1**

| Decision                  | Chosen                                                 | Canonical explanation                                                                                     |
| ------------------------- | ------------------------------------------------------ | --------------------------------------------------------------------------------------------------------- |
| 1.1 Session / token model | Better Auth cookie sessions; no bearer by default      | [AUTH.md §3](AUTH.md#3-cookie-and-session-flow)                                                           |
| 1.5 Authorization         | Global roles plus code-defined permissions             | [AUTH.md §4](AUTH.md#4-roles-and-permissions) · [§7](AUTH.md#7-roles-permissions-and-assignment)          |
| 3.1 Ownership             | `Note.ownerId` + service checks + `note:manage` bypass | [AUTH.md §5](AUTH.md#5-protecting-routes) · [notes routes](../apps/api/src/modules/notes/notes.routes.ts) |

**Still open**

| Area (this document)                      | Status                                               | Where to look                                                                                                                                                                   |
| ----------------------------------------- | ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1.2 Identity provider                     | Recipe — Better Auth + generic OIDC; IdP per project | [AUTH.md §9](AUTH.md#9-identity-providers) · [§10](AUTH.md#10-local-keycloak-recipe)                                                                                            |
| 1.3 Two-factor / multi-factor             | Pending recipe                                       | [ARCHITECTURE §10.1](ARCHITECTURE.md#101-authentication-and-authorization)                                                                                                      |
| 1.4 Password reset & email verification   | Pending recipe                                       | [ARCHITECTURE §10.1](ARCHITECTURE.md#101-authentication-and-authorization)                                                                                                      |
| 1.6 Organisations / groups                | Deferred to Phase 11                                 | [AUTH.md §14](AUTH.md#14-future-organisations-and-groups)                                                                                                                       |
| 2.1 Background jobs / queue               | Pending                                              | [§10.14](ARCHITECTURE.md#1014-background-jobs-file-storage-caching)                                                                                                             |
| 2.2 Email                                 | Pending                                              | [§10.14](ARCHITECTURE.md#1014-background-jobs-file-storage-caching)                                                                                                             |
| 2.3 Object storage (uploads)              | Pending                                              | [§10.14](ARCHITECTURE.md#1014-background-jobs-file-storage-caching)                                                                                                             |
| 2.4 Redis / caching                       | Pending                                              | [§10.14](ARCHITECTURE.md#1014-background-jobs-file-storage-caching)                                                                                                             |
| 3.2 Search                                | Pending                                              | [§6.2](ARCHITECTURE.md#62-data-layer)                                                                                                                                           |
| 3.3 Audit log / soft delete               | Pending                                              | [§10.17](ARCHITECTURE.md#1017-compliance-and-legal)                                                                                                                             |
| 4.1 Router                                | Pending                                              | — (front-end concern, not a §10 gap)                                                                                                                                            |
| 4.2 Forms                                 | Pending                                              | — (front-end concern, not a §10 gap)                                                                                                                                            |
| 4.3 SSR / SEO                             | Pending                                              | [§10.15](ARCHITECTURE.md#1015-front-end-production-concerns)                                                                                                                    |
| 4.4 Client state                          | Pending                                              | [§10.15](ARCHITECTURE.md#1015-front-end-production-concerns)                                                                                                                    |
| 5.1 Secrets management                    | Pending                                              | [§10.11](ARCHITECTURE.md#1011-secrets-and-configuration)                                                                                                                        |
| 5.2 Observability                         | Pending                                              | [§10.5](ARCHITECTURE.md#105-logging-error-tracking-metrics-tracing)                                                                                                             |
| 5.3 Security headers, rate limiting, CORS | Pending                                              | [§10.2](ARCHITECTURE.md#102-security-headers) · [§10.3](ARCHITECTURE.md#103-rate-limiting-and-abuse-protection) · [§10.4](ARCHITECTURE.md#104-same-origin-serving-cors-and-tls) |
| 5.4 Backups / disaster recovery           | Pending                                              | [§10.12](ARCHITECTURE.md#1012-database-operations)                                                                                                                              |

Some §10 items have no options catalogue here (they are "do this", not "choose between"): §10.6 health/readiness, §10.7 error format, §10.8 pagination/versioning, §10.9 testing, §10.10 CI/CD, §10.13 hardening, §10.16 supply chain.

**Template fit**

Each sub-area ends with a verdict on how it fits the templating approach:

- **Scaffold** — high value, cheap and low-opinion to generate → a candidate to add to `templates/` + `setup.sh`.
- **Recipe** — valuable but too situational to pre-install → document the steps and keep it opt-in (like the shadcn/ui recipe).
- **Out of scope** — too large, heavy, or opinionated for the scaffold → leave to the individual project.

**Contents**

1. [Identity & access](#1-identity--access)
2. [Backend infrastructure](#2-backend-infrastructure)
3. [Data model](#3-data-model)
4. [Frontend architecture](#4-frontend-architecture)
5. [Security & operations](#5-security--operations)

---

## 1. Identity & access

The v1 baseline is Better Auth cookie sessions, email/password, optional OIDC, global roles,
a separate profile, and an ownership-checked notes module. The sections below cover the
remaining identity work and future extensions of that baseline.

### 1.1 Session / token model — resolved for v1

**Chosen:** Better Auth cookie sessions. The browser receives an httpOnly
`better-auth.session_token`, the API stores sessions in PostgreSQL, and the default web client
never handles a bearer token. The Vite proxy keeps development same-origin.

**Why:** the default product is a same-origin React app, so cookies remove token storage from
JavaScript and make revocation a server-side operation. The trade-off is that native or
third-party clients need a different token strategy.

**Future:** if you add mobile, desktop or third-party API clients, decide on bearer access
tokens with refresh rotation, OAuth for third-party clients, or a cookie-to-token exchange.
Do not enable the bearer plugin without that design.

See [AUTH.md §3](AUTH.md#3-cookie-and-session-flow) and [ARCHITECTURE §8](ARCHITECTURE.md#8-decision-log).

### 1.2 Identity provider — recipe

**Decision:** Better Auth is the auth engine. OIDC through the `genericOAuth` plugin is the
supported path; the actual IdP is per project. Email/password can stay enabled alongside SSO.

| IdP option                    | Fit               | Notes                                                         |
| ----------------------------- | ----------------- | ------------------------------------------------------------- |
| **Keycloak** (self-hosted)    | Local/private SSO | OIDC; can broker CAS/SAML; see the recipe in AUTH.md          |
| **Microsoft Entra ID / Okta** | Enterprise SSO    | OIDC discovery; role claims are not trusted by default        |
| **Auth0 / WorkOS / Clerk**    | Hosted SSO        | OIDC; vendor dependency and cost                              |
| **Google / GitHub**           | Social login      | OIDC/social provider; good for consumer apps                  |
| **Email/password only**       | No external IdP   | Full control; you own reset, verification and breach response |

**Template fit:** Recipe. The provider is configured through `AUTH_SSO_*` environment values;
do not bake an IdP into the generated project. See [AUTH.md §9](AUTH.md#9-identity-providers)
and [§10](AUTH.md#10-local-keycloak-recipe).

### 1.3 Two-factor / multi-factor

Decide the second factor and how login becomes two-step (challenge state + recovery codes).

| Option                                             | Pros                                   | Cons                                             |
| -------------------------------------------------- | -------------------------------------- | ------------------------------------------------ |
| **TOTP** (`otplib`)                                | Offline, ubiquitous, cheap             | Needs an authenticator app; recovery-code flow   |
| **Passkeys / WebAuthn** (`@simplewebauthn/server`) | Strong, phishing-resistant, no secrets | More complex ceremony; device-bound UX           |
| **Email OTP**                                      | No app needed                          | Depends on the mailer; weaker than TOTP/passkeys |

**Template fit:** Recipe / out of scope — factor choice is per-project.

### 1.4 Password reset & email verification

Both require two new pieces of _infrastructure_: a **mailer** (see [2.2](#22-email)) and a
**one-time token/ticket model** (random token, hashed at rest, short expiry, single-use).

**Template fit:** Recipe — document the ticket model and the mailer abstraction; the provider
is out of scope.

### 1.5 Authorization (RBAC) — resolved for v1

**Chosen:** a global `role` string on `User`, code-defined permissions in `permissions.ts`,
`authenticate` / `authorize` / `requireRole` guards, and a permission matrix for `user`,
`moderator`, `admin` and `superadmin`. Role changes use the guarded domain route; superadmin is
bootstrap-only.

**Why:** global roles cover the v1 product without a second data model, while permissions keep
route checks expressive and testable. Ownership is a separate concern (see 3.1).

**Future:** if the product becomes multi-tenant or needs attribute-based rules, consider
organisation-scoped roles (1.6), a `Role` join table, a policy engine such as CASL, or Postgres
RLS. Do not add those until the tenancy model is designed.

See [AUTH.md §4](AUTH.md#4-roles-and-permissions) and [§7](AUTH.md#7-roles-permissions-and-assignment).

### 1.6 Organisations and groups (deferred)

V1 is deliberately **roles-only**. There is no organisation plugin, membership table,
invitation flow, tenant selector or tenant assumption in the UI. Phase 11 will design the
membership model and decide how organisation-scoped roles compose with global roles.

**Template fit:** Out of scope for v1. See [AUTH.md §14](AUTH.md#14-future-organisations-and-groups).

---

## 2. Backend infrastructure

New services the scaffold doesn't have. Each is "add an abstraction, plug in a provider".

### 2.1 Background jobs / queue

For email sending, cleanup, and any work that shouldn't block a request.

| Option                          | Pros                               | Cons                                              |
| ------------------------------- | ---------------------------------- | ------------------------------------------------- |
| **BullMQ** (needs Redis)        | Durable, retries, cron, dashboards | Adds Redis + a worker process                     |
| **In-process queue** (simple)   | Zero new services                  | Lost on restart; no retries; single instance only |
| **Managed queue** (QStash, SQS) | No ops                             | External dependency, cost                         |

**Template fit:** Out of scope — document the _pattern_, not a pre-installed queue.

### 2.2 Email

Transactional email behind a mailer interface so the provider can be swapped.

| Option       | Pros                           | Cons              |
| ------------ | ------------------------------ | ----------------- |
| **Resend**   | Great DX, simple API           | Vendor            |
| **Postmark** | Reliable, deliverability focus | Vendor            |
| **AWS SES**  | Cheap at scale, already on AWS | Clunky API, setup |

**Template fit:** Out of scope — but the _mailer abstraction_ (an interface + a dev no-op sink)
is a good recipe.

### 2.3 Object storage (uploads)

Store files outside Postgres; keep a pointer (`url`/`key`) in the row, serve via signed URLs.

| Option                  | Pros                          | Cons        |
| ----------------------- | ----------------------------- | ----------- |
| **Cloudflare R2**       | No egress fees, S3-compatible | Vendor      |
| **AWS S3**              | Ubiquitous                    | Egress cost |
| **MinIO** (self-hosted) | No vendor                     | You run it  |

**Template fit:** Recipe — the pointer-in-DB + signed-URL pattern; provider is out of scope.

### 2.4 Redis / caching

Only needed if you chose cookie sessions, BullMQ, or a distributed rate-limit/cache. Otherwise
stay Redis-free.

**Template fit:** Out of scope — add only when a concrete need appears.

---

## 3. Data model

### 3.1 Ownership (multi-user data) — resolved for v1

**Chosen:** `Note.ownerId` plus ownership checks in the service. Lists default to the caller's
rows; reads, updates and deletes return 404 when the row belongs to another user. Holders of
`note:manage` can list all and bypass the ownership check. `?scope=all` is how a manager asks
for the all-notes view.

**Why:** it demonstrates resource-level authorization without coupling the database to the
application's role model, and it keeps the policy visible in the tested service layer.

**Future:** if you need tenancy, sharing or database-enforced isolation, consider
organisation-scoped ownership, ACL/shared-resource tables, or Postgres RLS. RLS is a good fit
for strict tenant isolation but is harder to test and easy to bypass from a superuser
connection.

See [AUTH.md §5](AUTH.md#5-protecting-routes) and the notes module in
`apps/api/src/modules/notes/`.

### 3.2 Search

Only if the site needs full-text search over content.

| Option                                    | Pros                                    | Cons                                |
| ----------------------------------------- | --------------------------------------- | ----------------------------------- |
| **Postgres full-text** (`tsvector` + GIN) | No new service; SQL-native              | Ranking is basic; no typo tolerance |
| **Meilisearch / Typesense**               | Great relevance, typo tolerance, facets | A new service to run/sync           |

**Template fit:** Recipe for Postgres FTS; a dedicated engine is out of scope.

### 3.3 Audit log / soft delete

History or compliance only. Options: a `deletedAt` column (soft delete) vs an append-only audit
table vs both.

**Template fit:** Out of scope — add when the requirement is real.

---

## 4. Frontend architecture

Technology choices that shape the whole UI, not "build a page" work.

### 4.1 Router

The scaffold has no router (a single `App.tsx`).

| Option              | Pros                                             | Cons                                      |
| ------------------- | ------------------------------------------------ | ----------------------------------------- |
| **react-router**    | The boring default, huge ecosystem               | Framework-less; data fetching left to you |
| **TanStack Router** | Type-safe routes, integrates with TanStack Query | Younger, smaller ecosystem                |

**Template fit:** Scaffold — near-universal and cheap; `react-router` is the safe default.

### 4.2 Forms

Client-side forms + validation, ideally sharing Zod schemas with the API.

| Option                    | Pros                                 | Cons                  |
| ------------------------- | ------------------------------------ | --------------------- |
| **react-hook-form + zod** | The default; reuse API schemas       | Two libraries to wire |
| **TanStack Form**         | Same-family as Query; schema support | Newer                 |

**Template fit:** Recipe — forms are situational; document the schema-sharing pattern.

### 4.3 SSR / SEO strategy

The SPA is client-rendered — fine for a logged-in product, weak for public/SEO pages.

| Option                              | Pros                      | Cons                           |
| ----------------------------------- | ------------------------- | ------------------------------ |
| **Keep SPA**                        | Simplest; one app         | Poor SEO for public pages      |
| **Add Astro/Next for public pages** | SEO + the same API/client | A second front end to maintain |

**Template fit:** Out of scope — an architecture decision, not a scaffold default.

### 4.4 Client state

TanStack Query already covers server state. For the small remainder (UI toggles, drafts), add
**zustand** when needed; it is tiny and unopinionated.

**Template fit:** Recipe / out of scope — don't pre-install state you may not need.

---

## 5. Security & operations

### 5.1 Secrets management

Dev uses harmless defaults in `.devcontainer/.env`. In production, inject real secrets from a
secret manager or the platform's secrets.

**Template fit:** Recipe — document the pattern; keep dev defaults in the scaffold.

### 5.2 Observability

Fastify's Pino logger is already there. Add, as the site goes live: structured logging to a
sink, error tracking (Sentry), and metrics (Prometheus/OpenTelemetry).

**Template fit:** Recipe for the logging wiring; Sentry/Prometheus are out of scope (per-project).

### 5.3 Security headers, rate limiting, CORS

| Option                          | Pros                             | Cons                           |
| ------------------------------- | -------------------------------- | ------------------------------ |
| **`@fastify/helmet`**           | One line; safe defaults          | —                              |
| **`@fastify/rate-limit`**       | Brute-force and abuse protection | Store choice (memory vs Redis) |
| **Same-origin serving vs CORS** | One proxy, no CORS               | OR configure CORS per domain   |

**Template fit:** Scaffold `helmet` + a basic `rate-limit` (cheap, low-opinion, near-universal);
CORS is a recipe (it's environment-specific).

### 5.4 Backups / disaster recovery

Managed Postgres with point-in-time recovery, plus a documented restore runbook.

**Template fit:** Out of scope — an ops runbook, not scaffold code.

---

## Suggested order

The v1 baseline already resolves **1.1** (session model), **1.5** (authorization) and **3.1**
(ownership). The remaining high-impact decisions are **1.2** (which IdP), **1.3** (MFA), **1.4**
(reset/verification) and **1.6** (organisations). Everything else can wait for the feature that
needs it. For each open area, decide → design → implement → mark it resolved here.

---

[← Back to README](../README.md) · [Auth](AUTH.md) · [Installation](INSTALLATION.md) · [Architecture](ARCHITECTURE.md) · [FAQ](FAQ.md) · [Learning](LEARNING.md)
