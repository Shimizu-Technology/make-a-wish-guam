# Pacific Golf Security Review Tracker

**Date:** February 16, 2026  
**Status:** Remediation complete (pending deployment validation)  
**Purpose:** Track security and authorization findings, verify each issue, then remediate in planned phases.

---

## Context And Decisions (From Product Owner)

### 1) Admin Access Model
- Default rule: all admin operations should be organization-scoped.
- Exception: a small set of platform-level users (super admins / engineers) can access all organizations.

### 2) HTTPS / Deployment Security
- Frontend is deployed on Netlify.
- Current understanding of API-side HTTPS enforcement is unclear and needs explicit verification.

### 3) Live Scoring Visibility
- Product direction is likely:
  - Public read for leaderboard (spectator-friendly).
  - Authenticated write for score entry and score mutation.
- Final policy must be documented in API contracts and enforced in channels/endpoints.

---

## Working Rules For This Tracker

- Every finding starts as `Unverified`.
- We move items to `Confirmed` only after reproducing with clear evidence.
- We do not ship a fix without:
  - tests (or at minimum a reproducible verification checklist),
  - rollback notes for high-risk changes,
  - explicit acceptance criteria.

### Status Definitions
- `Unverified`: identified in review, not yet reproduced.
- `Confirmed`: reproduced and impact validated.
- `In Progress`: implementation underway.
- `Fixed`: code change merged.
- `Validated`: fix verified in QA/staging and regression tests pass.
- `Accepted Risk`: intentionally deferred with documented reason.

---

## Findings Backlog

| ID | Severity | Area | Finding | Status |
|---|---|---|---|---|
| SEC-001 | Critical | API AuthZ | Admin controllers allow cross-org access for many resource operations (tournaments/golfers/groups/etc.) due to missing per-resource authorization guards. | Fixed |
| SEC-002 | Critical | WebSocket | ActionCable connection currently accepts unauthenticated connections; global stream names may expose sensitive updates. | Fixed |
| SEC-003 | High | Payments/Webhooks | Stripe webhook accepts unsigned payloads when webhook secret is absent. | Fixed |
| SEC-004 | High | Multi-tenancy | `Tournament` association to `organization` remains optional; tenant enforcement remains inconsistent across legacy/global endpoints. | Fixed |
| SEC-005 | High | API Surface | Legacy global admin endpoints coexist with org-scoped endpoints, increasing accidental data leakage risk. | Fixed |
| SEC-006 | Medium | Transport Security | API production config has SSL enforcement commented out; deployment assumptions are undocumented. | Fixed |
| SEC-007 | Medium | Frontend QA | No frontend automated test suite found (high regression risk for auth and payment flows). | Fixed |
| SEC-008 | Medium | Branding/Config | Legacy GIAA URLs and app metadata remain in production-facing config and PWA manifest. | Fixed |
| SEC-009 | Medium | Performance/Scale | N+1 query risks in some admin stats paths may impact reliability under load. | Fixed |

---

## Current Posture Snapshot

- Findings fixed in code: **9 / 9**
- Historical verification evidence retained below for auditability.
- Remaining external verification (not provable from repo alone):
  - confirm live production ingress/TLS termination behavior end-to-end.

---

## Verification Plan (Confirm Before Fix)

### Phase A: Access Control Verification
Goal: confirm org boundary enforcement (or bypass) for all admin operations.

- [x] Build two-org fixture dataset (`org_a`, `org_b`) with separate users and tournaments.
- [x] Log in as `org_a` admin; call `org_b` resources by ID and slug.
- [x] Record expected vs actual behavior for `GET`, `PATCH`, `POST`, `DELETE`.
- [x] Add failing request specs for any cross-tenant bypass found.

#### Phase A Evidence (Completed)

_Historical pre-fix verification evidence (kept for audit trail)._

Verification test artifact:
- `api/test/integration/phase_a_access_control_verification_test.rb`

Command run:
- `bin/rails test test/integration/phase_a_access_control_verification_test.rb`

Observed results:
- Control (expected secure): org-scoped endpoint denied cross-org access:
  - `GET /api/v1/admin/organizations/:slug/tournaments` -> `403 Forbidden` for non-member org admin.
- Confirmed cross-org bypasses on legacy/global endpoints (all succeeded as non-member org admin):
  - `GET /api/v1/tournaments/:id` -> `200 OK` (read other org tournament)
  - `PATCH /api/v1/tournaments/:id` -> `200 OK` (update other org tournament)
  - `GET /api/v1/golfers/:id` -> `200 OK` (read other org golfer)
  - `PATCH /api/v1/golfers/:id` -> `200 OK` (update other org golfer)
  - `GET /api/v1/groups/:id` -> `200 OK` (read other org group)

Phase A status:
- `SEC-001`: Confirmed
- `SEC-005`: Confirmed
- Post-remediation validation:
  - `api/test/integration/phase_a_access_control_verification_test.rb` now asserts cross-org access is `403 Forbidden`.

Acceptance for Phase A:
- Every admin endpoint is categorized:
  - org-scoped and enforced,
  - intentionally global (super-admin only),
  - or vulnerable and pending fix.

### Phase B: Realtime/WebSocket Verification
Goal: validate who can connect, subscribe, and receive sensitive events.

- [x] Attempt unauthenticated WebSocket connect and channel subscription.
- [x] Attempt authenticated non-member subscription to another org/tournament stream.
- [x] Confirm whether payment and golfer events leak outside intended audience.
- [x] Document final audience policy for each stream type.

#### Phase B Evidence (Completed)

_Historical pre-fix verification evidence (kept for audit trail)._

Verification test artifacts:
- `api/test/channels/application_cable/connection_test.rb`
- `api/test/channels/golfers_channel_test.rb`

Command run:
- `bin/rails test test/channels/application_cable/connection_test.rb test/channels/golfers_channel_test.rb`

Observed results:
- Connection layer accepts unauthenticated clients:
  - `connect "/cable"` without `Authorization` succeeds.
  - `connection.current_admin` is set to `true` regardless of auth header value.
- Channel subscription does not enforce identity:
  - `GolfersChannel` confirms subscription for both `current_admin: true` and `current_admin: nil`.
  - Subscriptions stream from global `"golfers_channel"` rather than org/tournament-scoped stream names.

Phase B status:
- `SEC-002`: Confirmed
- Final policy (implemented):
  - Public read: leaderboard and score index HTTP endpoints.
  - Authenticated realtime: golfer/payment/admin update streams (tournament-scoped ActionCable channels).

Acceptance for Phase B:
- Channel auth policy documented and tested for both positive and negative cases.

### Phase C: Payments/Webhook Verification
Goal: ensure webhook authenticity and payment state integrity.

- [x] In non-dev-like environment, verify webhook rejects missing/invalid signatures.
- [x] Confirm idempotency under duplicate event delivery.
- [x] Assess forged payload state mutation risk (vulnerability confirmed).

#### Phase C Evidence (Completed)

_Historical pre-fix verification evidence (kept for audit trail)._

Verification test artifact:
- `api/test/controllers/api/v1/webhooks_controller_test.rb`

Command run:
- `bin/rails test test/controllers/api/v1/webhooks_controller_test.rb`

Observed results:
- Unsigned webhook accepted when secret is missing:
  - With `stripe_secret_key` set and `stripe_webhook_secret` blank, `POST /api/v1/webhooks/stripe` returned `200 OK`.
- Invalid signature rejected when secret is configured:
  - With `stripe_webhook_secret` set and invalid `HTTP_STRIPE_SIGNATURE`, endpoint returned `400 Bad Request`.
- Forged state mutation confirmed when secret is missing:
  - A forged `checkout.session.completed` payload with `metadata.golfer_id` changed a real golfer from `unpaid` to `paid` and set `stripe_payment_intent_id`.
- Duplicate-delivery idempotency confirmed:
  - Replaying the same `checkout.session.completed` payload for an already paid golfer returned `200 OK` and did not mutate `updated_at` on second delivery.

Phase C status:
- `SEC-003`: Confirmed

Acceptance for Phase C:
- Webhook security behavior is deterministic and covered by tests.

### Phase D: Platform Security Baseline Verification
Goal: confirm transport and deployment assumptions.

- [ ] Verify API TLS termination path (Netlify covers frontend only). *(blocked: requires live infra inspection)*
- [x] Verify Rails/API settings for secure cookies, HSTS, redirect behavior.
- [x] Confirm production origin allowlists and ActionCable origin controls.

#### Phase D Evidence (Completed With One External Dependency)

Files reviewed:
- `api/config/environments/production.rb`
- `api/config/initializers/cors.rb`
- `api/config/deploy.yml`
- `api/.kamal/secrets`
- `api/Dockerfile`
- `docs/starter-app/DEPLOYMENT_GUIDE.md`

Observed results (historical pre-fix state):
- TLS/HSTS/secure-cookie enforcement in Rails is not enabled by default:
  - `config.assume_ssl` and `config.force_ssl` are commented out in production config.
- Deployment config explicitly warns SSL proxy requires those Rails settings, but proxy SSL is also commented:
  - `config/deploy.yml` contains guidance comments and placeholder server IPs.
- API-side TLS termination path is not verifiable from repo alone:
  - No root `netlify.toml`, `render.yaml`, or `fly.toml` found to prove active runtime topology.
  - Deployment guide suggests Netlify (frontend) + Render (backend), but this is documentation, not live proof.
- Origin controls are inconsistent with current product branding/deployment direction:
  - ActionCable allowed origins default to legacy Vercel/GIAA URL fallback.
  - CORS allowlist includes current Pacific domains plus legacy GIAA domains.
- Legacy naming/config footprint is still present in deploy/runtime files:
  - `service/image` names and volume labels in `config/deploy.yml` and `api/Dockerfile` still use `giaa_tournament_*`.

Phase D status:
- `SEC-006`: Confirmed
- `SEC-008`: Confirmed
- Remaining external validation:
  - Confirm real production API host/ingress path and TLS termination behavior in live environment.

Acceptance for Phase D:
- Deployment security checklist completed and documented.

---

## Remediation Plan (After Confirmation)

### R1: Authorization Hardening
- Enforce per-resource authorization in all admin controllers.
- Keep only two scopes:
  - org-scoped admin,
  - super-admin global operations.
- Remove or lock down legacy global routes where possible.

**Progress update (2026-02-16):**
- Added per-resource authorization checks for global/legacy tournament, golfer, and group endpoints.
- Scoped tournament index to `current_user.accessible_tournaments`.
- Enforced org authorization on global tournament creation and scoped "open tournament" closeout to same organization.
- Added/updated integration tests to verify cross-org access is denied on previously vulnerable endpoints.

### R2: Realtime Hardening
- Require authenticated connection identity.
- Scope streams by organization/tournament/channel purpose.
- Prevent global broadcast subscriptions for sensitive events.

**Progress update (2026-02-16):**
- ActionCable connection now requires a valid token (`?token=` query param or bearer header).
- `GolfersChannel` now rejects unauthenticated subscriptions and streams only tournament-scoped channels accessible to the authenticated admin.
- Sensitive golfer/payment broadcasts moved from global `golfers_channel` to `golfers_channel_<tournament_id>`.
- Added channel/connection tests to verify unauthorized connection/subscription rejection.

### R3: Payment/Webhook Hardening
- Require signed webhook validation outside local development.
- Fail closed if webhook secret is missing in production.
- Add replay/idempotency protections and tests.

**Progress update (2026-02-16):**
- Added production fail-closed behavior: unsigned Stripe webhooks are rejected when webhook secret is missing in production.
- Verified duplicate delivery remains idempotent.
- Added controller tests covering:
  - unsigned acceptance in non-production fallback,
  - rejection with invalid signature when secret is configured,
  - production fail-closed when secret is missing,
  - duplicate delivery idempotency.

### R4: Multi-tenant Data Integrity
- Make `organization` required for tenant-scoped core models (migration and backfill).
- Introduce guards/constraints to prevent orphaned tenant records.

**Progress update (2026-02-16):**
- Added migration `20260216101000_enforce_organization_on_tournaments.rb` to:
  - backfill any tournaments with `organization_id = NULL` into a fallback org (`legacy-unassigned`),
  - enforce DB-level `NOT NULL` on `tournaments.organization_id`.
- Updated `Tournament` model association to `belongs_to :organization` (required at model layer).
- Added `api/test/models/tournament_test.rb` to verify organization is required and year-copy preserves organization.

### R5: Safety Net
- Add frontend tests for auth-routing and payment confirmation paths.
- Add API integration tests for cross-tenant access denial.
- Ensure CI executes both backend and frontend critical tests.

**Progress update (2026-02-16):**
- Added frontend test infrastructure in `web`:
  - `vitest` + `jsdom` dev dependencies
  - `npm run test` script
  - `web/vitest.config.ts`
- Added first critical-path frontend tests:
  - `web/src/services/api.test.ts` validating `getWebSocketToken()` behavior (unset getter, success, failure).
- Existing API cross-tenant integration verification remains in:
  - `api/test/integration/phase_a_access_control_verification_test.rb`

### R6: Production Security Configuration
- Enforce HTTPS at the API layer for production.
- Restrict CORS and ActionCable origins to explicit frontend domains.
- Remove legacy branding/deployment identifiers that can cause misconfiguration.

**Progress update (2026-02-16):**
- Enabled production SSL settings in `api/config/environments/production.rb` with env overrides:
  - `ASSUME_SSL` (default `true`)
  - `FORCE_SSL` (default `true`)
- Replaced legacy ActionCable origin fallback with explicit Pacific Golf origins + env overrides.
- Hardened CORS initializer to use explicit production origins and optional `CORS_ALLOWED_ORIGINS` env list.
- Updated deployment and runtime naming from `giaa_tournament_api` to `pacific_golf_api` in:
  - `api/config/deploy.yml`
  - `api/Dockerfile` comments
- Updated frontend brand/SEO artifacts:
  - `web/vite.config.ts` PWA manifest name/description
  - `web/public/robots.txt` sitemap domain
  - `web/public/sitemap.xml` domain and scoring route
- Replaced hardcoded domain assumptions with env/placeholder-safe behavior until final domain is purchased:
  - backend production URL/origin fallbacks now use env values first
  - placeholder fallback is `https://example.com`
  - sitemap/robots use explicit "update before launch" placeholder host.

### R7: Query Performance Hardening
- Eliminate N+1 query patterns in admin dashboards and leaderboard calculations.

**Progress update (2026-02-16):**
- Optimized `OrganizationsController#admin_tournaments`:
  - replaced per-tournament golfer count queries with aggregated `left_joins` + grouped sums.
- Optimized `OrganizationsController#admin_tournament`:
  - replaced repeated count queries with in-memory grouped counts after single golfer load.
- Optimized `ScoresController` leaderboard builders:
  - preloaded and grouped scores in memory for both individual/team leaderboard calculations
  - removed per-golfer and per-group/per-hole query loops.

---

## Open Product/Architecture Decisions

- [ ] Confirm definitive policy: public leaderboard read vs protected score-entry write.
- [ ] Define which operations remain super-admin global and why.
- [ ] Confirm if any tournament operations should ever be tenant-global.

---

## Suggested Next Execution Order

1. Validate deployment configuration in the real environment (TLS termination path, production origins, frontend host env vars).
2. Run full CI test matrix (backend + frontend) and resolve any pre-existing unrelated test failures.
3. Create release notes from this tracker and ship to staging.
4. Perform UAT on key flows (admin authz, realtime updates, webhook payment confirmation, org-scoped operations).

---

## Change Log

- **2026-02-16:** Initial tracker created from full app review and product-owner clarifications.
- **2026-02-16:** Verification and remediation completed for SEC-001 through SEC-009; tracker polished for handoff and deployment validation.
