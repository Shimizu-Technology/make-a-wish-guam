# Security Remediation Release Handoff

**Project:** Pacific Golf  
**Date:** 2026-02-16  
**Prepared for:** Engineering handoff / deployment verification  
**Primary reference:** `docs/SECURITY_REVIEW_TRACKER.md`

---

## 1) Executive Context

This release bundles the security hardening and multi-tenant integrity work tracked in the security review.  
The codebase moved from "verified vulnerabilities present" to "remediated in code with targeted test coverage."

### What was fixed

- `SEC-001` API authz cross-tenant access: **fixed**
- `SEC-002` WebSocket unauthenticated/global stream exposure: **fixed**
- `SEC-003` Webhook unsigned acceptance risk: **fixed**
- `SEC-004` Tournament tenant integrity (`organization` optional): **fixed**
- `SEC-005` Legacy global API surface risk: **fixed**
- `SEC-006` Production SSL/security config gaps: **fixed**
- `SEC-007` No frontend test harness: **fixed (baseline harness added)**
- `SEC-008` Legacy branding/domain config risk: **fixed**
- `SEC-009` N+1/performance hotspots in admin/leaderboard paths: **fixed**

### What still requires live validation

- Real production ingress/TLS termination behavior (outside repo-level proof)
- Production env var correctness for frontend host/origin values

---

## 2) High-Impact Architectural Changes

## 2.1 API Authorization and Tenant Scope

### Why
Previously, authenticated admins could call several global endpoints using foreign IDs and access/modify data across organizations.

### What changed

- `api/app/controllers/api/v1/tournaments_controller.rb`
  - `index` now scopes to `current_user.accessible_tournaments`
  - member actions (`show/update/destroy/archive/copy/open/close`) now enforce tournament-level authorization
  - global `create` now requires an organization and org-admin authorization
  - `open` no longer closes tournaments globally across all orgs; now scoped to same `organization_id`

- `api/app/controllers/api/v1/golfers_controller.rb`
  - added authorization guards for collection + member actions by tournament ownership

- `api/app/controllers/api/v1/groups_controller.rb`
  - added authorization guards for collection + member actions
  - protected update-position flow by tournament authorization
  - blocked cross-tournament golfer-to-group assignment

### Expected behavior after deploy

- Non-member org admin receives `403` on cross-org resources even if IDs are known.
- Super admins retain global visibility via existing role logic.

---

## 2.2 Realtime (ActionCable) Security

### Why
ActionCable previously accepted unauthenticated connections and streamed from one global channel name.

### What changed

- `api/app/channels/application_cable/connection.rb`
  - requires valid token (query `token` or `Authorization` bearer header)
  - resolves authenticated `User` or rejects connection

- `api/app/channels/golfers_channel.rb`
  - rejects if no authenticated admin
  - streams only tournament-scoped channels the user can access:
    - `golfers_channel_<tournament_id>`

- Broadcast sources updated from global to scoped streams:
  - `api/app/controllers/api/v1/golfers_controller.rb`
  - `api/app/controllers/api/v1/checkout_controller.rb`
  - `api/app/controllers/api/v1/webhooks_controller.rb`

- Frontend WS hookup:
  - `web/src/services/api.ts` adds `getWebSocketToken()`
  - `web/src/hooks/useGolferChannel.ts` appends token to `/cable` URL and skips WS connection when token unavailable

### Expected behavior after deploy

- Unauthenticated WS connect attempts are rejected.
- Admin receives only events for tournaments they can access.

---

## 2.3 Webhook Security

### Why
Webhook handler could accept unsigned Stripe events when webhook secret was unset.

### What changed

- `api/app/controllers/api/v1/webhooks_controller.rb`
  - in production, missing webhook secret now fails closed (`400`)
  - signature verification still enforced when secret is present
  - test/dev fallback behavior remains available outside production

### Expected behavior after deploy

- Production without webhook secret: webhook requests are rejected.
- Invalid signature: rejected.
- Valid signature: processed.

---

## 2.4 Multi-Tenant Data Integrity at Model/DB Layer

### Why
`Tournament` was allowed without organization, risking orphan tenant data.

### What changed

- Migration: `api/db/migrate/20260216101000_enforce_organization_on_tournaments.rb`
  - backfills orphan tournaments to fallback org `legacy-unassigned`
  - enforces `NOT NULL` on `tournaments.organization_id`

- Model: `api/app/models/tournament.rb`
  - `belongs_to :organization` now required

- Schema updated:
  - `api/db/schema.rb`

### Expected behavior after deploy

- Cannot create/save tournament without organization.
- Existing orphan records are backfilled by migration.

---

## 2.5 Production Security Configuration and Domain Safety

### Why
Production SSL and origin settings were permissive/legacy-branded.

### What changed

- `api/config/environments/production.rb`
  - SSL enabled with env overrides:
    - `ASSUME_SSL` default `true`
    - `FORCE_SSL` default `true`
  - mailer host derived from `FRONTEND_URL` (safe fallback: `example.com`)
  - ActionCable origins are env-driven (safe fallback if unset)

- `api/config/initializers/cors.rb`
  - production origins now env-driven
  - optional comma-separated `CORS_ALLOWED_ORIGINS`
  - no hard dependency on unowned future domain

- Deployment/branding cleanup:
  - `api/config/deploy.yml` -> `pacific_golf_api` naming
  - `api/Dockerfile` comments updated
  - `web/vite.config.ts` manifest updated to Pacific Golf branding
  - `web/public/robots.txt` + `web/public/sitemap.xml` now placeholder-safe for Netlify host until domain purchase

---

## 2.6 Query Performance Hardening

### Why
Admin and leaderboard paths had N+1 query patterns likely to degrade under load.

### What changed

- `api/app/controllers/api/v1/organizations_controller.rb`
  - `admin_tournaments`: grouped aggregate query replaces per-tournament count queries
  - `admin_tournament`: grouped in-memory stats replaces repeated DB counts

- `api/app/controllers/api/v1/scores_controller.rb`
  - `individual_leaderboard` and `team_leaderboard` now use pre-grouped score maps in-memory instead of nested query loops

---

## 3) Frontend Test Infrastructure Introduced

### Why
There was no frontend test runner, creating high regression risk.

### What changed

- Added dev deps in `web`:
  - `vitest`, `jsdom`
- Added script:
  - `npm run test`
- Added config:
  - `web/vitest.config.ts`
- Added initial critical-path test:
  - `web/src/services/api.test.ts` for websocket token retrieval behavior

### Note
This is a baseline harness, not full coverage. It should be expanded in subsequent iterations.

---

## 4) Environment Variables Required / Recommended

Set these in production runtime (backend):

- `FRONTEND_URL` = current live frontend host (Netlify URL now, custom domain later)
- `FRONTEND_URL_ALT` = optional second allowed frontend origin
- `CORS_ALLOWED_ORIGINS` = optional comma-separated extra origins
- `STRIPE_WEBHOOK_SECRET` or app-level setting equivalent (must be configured in production)
- `ASSUME_SSL=true` (recommended default)
- `FORCE_SSL=true` (recommended default)

Operational reminder:
- Netlify secures frontend hosting, but API TLS enforcement/termination must still be correct at API ingress/proxy layer.

---

## 5) Automated Test Plan (Commands)

Run from repo root as indicated.

### Backend targeted security suite

```bash
cd api
bin/rails test test/integration/phase_a_access_control_verification_test.rb
bin/rails test test/channels/application_cable/connection_test.rb test/channels/golfers_channel_test.rb
bin/rails test test/controllers/api/v1/webhooks_controller_test.rb
bin/rails test test/models/tournament_test.rb
bin/rails test test/controllers/api/v1/scores_controller_golfer_auth_test.rb
```

### Frontend tests

```bash
cd web
npm run test
```

### Migration verification

```bash
cd api
bin/rails db:migrate
```

---

## 6) Manual QA / UAT Checklist

## 6.1 AuthZ and Tenant Isolation

- Login as org admin for Org A.
- Attempt to access/update Org B tournament/golfer/group by ID.
- Expected: `403` or denied UI path.

## 6.2 Websocket Access Control

- Open admin UI authenticated: verify realtime updates still appear for allowed tournaments.
- Attempt WS connection with invalid/absent token (devtools/manual script).
- Expected: connection rejected or no subscription confirmation.

## 6.3 Payments and Webhooks

- In staging/prod-like environment with webhook secret configured:
  - send invalid signature -> reject
  - send valid Stripe test event -> accepted
- In production without secret (if misconfigured):
  - webhook should fail closed (not silently process)

## 6.4 Domain/Origin Behavior

- Confirm `FRONTEND_URL` matches deployed Netlify host.
- Verify CORS preflight and authenticated requests succeed from frontend host.
- Confirm emails and redirect links point to expected live host.

## 6.5 Performance smoke test

- Hit org admin tournament summary and leaderboard endpoints with realistic dataset.
- Confirm no obvious latency spikes/regression compared to previous baseline.

---

## 7) Known Issues / Non-Blocking Notes

- Some legacy backend tests outside this scope still rely on outdated fixture patterns (example: `admins(...)` helper usage in older controller tests).
  - These are pre-existing and not introduced by this remediation.
- Frontend `typecheck` currently reports unrelated parse errors in `web/src/pages/OrganizationLandingPage.tsx` (pre-existing).
  - Vitest-based tests introduced here pass.

---

## 8) Rollback Guidance

If emergency rollback is needed:

1. Revert app code changes in controllers/channels/webhooks.
2. Keep migration caution in mind:
   - DB null constraint on `tournaments.organization_id` is a structural change.
   - Rolling back code without considering migration can create mismatch.
3. If strict rollback required, evaluate:
   - migration rollback for `20260216101000_enforce_organization_on_tournaments.rb`
   - impact on backfilled `legacy-unassigned` org references.
4. After rollback, rerun smoke tests for registration/admin/score flows.

---

## 9) Recommended Next Iteration

- Expand frontend tests from baseline into:
  - auth route guards,
  - websocket hook behavior under token refresh/failure,
  - payment confirmation UI flows.
- Add CI job for frontend tests and typecheck once pre-existing parser issues are cleaned.
- Document final domain cutover runbook:
  - replace placeholder sitemap/robots host,
  - update `FRONTEND_URL` and origin env vars,
  - verify redirects and webhook endpoints.

