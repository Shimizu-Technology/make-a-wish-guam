# GIAA To SaaS Migration Diff Checklist

**Project:** Pacific Golf  
**Date:** 2026-02-16  
**Goal:** Safely use the proven GIAA codebase as reference material without reintroducing single-tenant or security regressions.

---

## 1) Scope And Guardrails

This checklist compares:

- Legacy reference: `giaa-tournament/`
  - `giaa-tournament/giaa-tournament-api`
  - `giaa-tournament/giaa-tournament-frontend`
- Target SaaS app:
  - `api/`
  - `web/`

Decision labels used below:

- **Keep**: pattern is strong and can be reused with little/no change.
- **Adapt**: pattern is useful but must be changed for SaaS.
- **Do Not Migrate**: do not copy into SaaS code.

---

## 2) Immediate Safety Steps (Before Any Porting)

- [ ] Keep `giaa-tournament/` ignored in git (`.gitignore` already updated).
- [ ] Remove or rotate any real credentials found in legacy `.env` files.
- [ ] Treat legacy `.env` and comments as compromised if they ever left local machine.
- [ ] Never copy raw secrets from legacy files into `api/.env` or `web/.env`.

---

## 3) Architecture Delta (Non-Negotiable)

These are hard requirements for Pacific Golf SaaS:

- [ ] Multi-tenant data model using `organization_id` across tenant-owned data.
- [ ] Organization-scoped admin authorization by default.
- [ ] Super-admin/engineer override only for platform users.
- [ ] Realtime channel scoping by tenant or tournament access.
- [ ] Stripe webhook verification fail-closed in production.
- [ ] Production TLS/SSL enforcement and env-driven origin config.

If a legacy implementation conflicts with any item above, mark it **Do Not Migrate**.

---

## 4) Backend Migration Matrix (Legacy API -> SaaS API)

### 4.1 Auth And Authorization

- **Legacy:** `giaa-tournament/giaa-tournament-api/app/controllers/concerns/authenticated.rb`
  - Behavior: admin lookup by Clerk/email whitelist, no org membership boundary.
  - Decision: **Do Not Migrate** as-is.
  - SaaS action:
    - [ ] Keep token verification concept only.
    - [ ] Enforce org/tournament authorization checks in every admin controller.
    - [ ] Preserve super-admin override path.

### 4.2 Tenant Scoping

- **Legacy:** `giaa-tournament/giaa-tournament-api/db/schema.rb`, `app/models/tournament.rb`
  - Behavior: no `organization_id` on tenant entities; global `Tournament.current`.
  - Decision: **Do Not Migrate** as-is.
  - SaaS action:
    - [ ] Keep model convenience methods that are tenant-safe.
    - [ ] Require org ownership in model validations + DB constraints.
    - [ ] Ensure "current tournament" resolves within org context.

### 4.3 Realtime (ActionCable)

- **Legacy:** `giaa-tournament/giaa-tournament-api/app/channels/golfers_channel.rb`
  - Behavior: single global stream (`golfers_channel`).
  - Decision: **Do Not Migrate** as-is.
  - SaaS action:
    - [ ] Keep event payload structure pattern.
    - [ ] Use scoped streams (`golfers_channel_<tournament_id>` or org-scoped equivalent).
    - [ ] Reject unauthenticated subscriptions and unauthorized tournament access.

### 4.4 Payments And Webhooks

- **Legacy:** `giaa-tournament/giaa-tournament-api/app/controllers/api/v1/webhooks_controller.rb`
  - Behavior: allows unsigned webhook events when secret missing.
  - Decision: **Do Not Migrate** as-is.
  - SaaS action:
    - [ ] Keep idempotency approach (already-paid short-circuit).
    - [ ] Fail closed in production when webhook secret missing.
    - [ ] Verify tenant context in webhook metadata before mutation.
    - [ ] Broadcast only scoped realtime events.

### 4.5 Registration Concurrency Patterns

- **Legacy:** `giaa-tournament/giaa-tournament-api/app/controllers/api/v1/golfers_controller.rb`
  - Behavior: uses transaction + row lock around registration/capacity checks.
  - Decision: **Keep/Adapt**.
  - SaaS action:
    - [ ] Reuse lock/transaction pattern.
    - [ ] Ensure lock scope remains per tournament within organization.
    - [ ] Keep non-critical operations after commit (email/broadcast best-effort).

### 4.6 CORS And Production Security Config

- **Legacy:** `giaa-tournament/giaa-tournament-api/config/initializers/cors.rb`, `config/environments/production.rb`
  - Behavior: mixed localhost + legacy domains; SSL flags commented.
  - Decision: **Do Not Migrate** as-is.
  - SaaS action:
    - [ ] Keep env-driven origin concept only.
    - [ ] Remove hardcoded domains and localhost from production allowlist.
    - [ ] Keep SSL/TLS enforcement enabled via environment policy.

---

## 5) Frontend Migration Matrix (Legacy Frontend -> SaaS Frontend)

### 5.1 Admin Auth Bootstrap

- **Legacy:** `giaa-tournament/giaa-tournament-frontend/src/components/ProtectedRoute.tsx`, `src/hooks/useApi.ts`
  - Behavior: hardcoded JWT template (`giaa-tournament`).
  - Decision: **Adapt**.
  - SaaS action:
    - [ ] Keep centralized token getter pattern.
    - [ ] Use env-driven template or backend-compatible token strategy.
    - [ ] Remove legacy template hardcoding.

### 5.2 Realtime Client Hook

- **Legacy:** `giaa-tournament/giaa-tournament-frontend/src/hooks/useGolferChannel.ts`
  - Behavior: websocket without auth token in URL/headers.
  - Decision: **Do Not Migrate** as-is.
  - SaaS action:
    - [ ] Keep hook structure and callback pattern.
    - [ ] Require tokenized websocket connection.
    - [ ] Reconnect only when auth context is valid.

### 5.3 Tournament Context State

- **Legacy:** `giaa-tournament/giaa-tournament-frontend/src/contexts/TournamentContext.tsx`
  - Behavior: `currentTournamentId` in global localStorage key.
  - Decision: **Adapt**.
  - SaaS action:
    - [ ] Keep context-provider architecture.
    - [ ] Namespace persisted keys by organization slug/id.
    - [ ] Validate restored tournament belongs to active org.

### 5.4 API Client Pattern

- **Legacy:** `giaa-tournament/giaa-tournament-frontend/src/services/api.ts`
  - Behavior: centralized request utility with token injection and typed methods.
  - Decision: **Keep/Adapt**.
  - SaaS action:
    - [ ] Keep client layering and typed endpoint methods.
    - [ ] Update endpoint surface to org-aware admin/public routes.
    - [ ] Avoid global tournament assumptions.

### 5.5 Branding, Domains, PWA

- **Legacy:** `giaa-tournament/giaa-tournament-frontend/vite.config.ts`, `public/*`, UI pages
  - Behavior: hardcoded GIAA names, contacts, domains, and deployment assumptions.
  - Decision: **Do Not Migrate** as-is.
  - SaaS action:
    - [ ] Keep only generic UX structures/components.
    - [ ] Move all branding/content/domain values to organization settings + env.

### 5.6 Test Mode And Simulation Paths

- **Legacy:** `giaa-tournament/giaa-tournament-frontend/src/pages/RegistrationPage.tsx`
  - Behavior: client-side simulated payment flow for test mode.
  - Decision: **Adapt carefully**.
  - SaaS action:
    - [ ] Keep local-dev ergonomics if needed.
    - [ ] Ensure simulation cannot activate in production.
    - [ ] Gate via strict environment checks and server-side guardrails.

---

## 6) File-Level Porting Playbook

Use this on every candidate file copied from `giaa-tournament/`:

- [ ] Remove hardcoded domains, org names, contacts, tournament labels.
- [ ] Replace legacy endpoint paths with current SaaS API routes.
- [ ] Enforce tenant scope on all reads/writes.
- [ ] Verify authorization checks on collection and member actions.
- [ ] Confirm realtime stream names are scoped.
- [ ] Confirm payment/webhook code cannot run unsigned in production.
- [ ] Add or update tests covering changed behavior.
- [ ] Run lint/typecheck/tests before merge.

---

## 7) Recommended Migration Order

1. **Domain model and authorization first**
   - [ ] Organization and membership boundaries fully enforced.
2. **Realtime and payments second**
   - [ ] Token-authenticated channels, scoped broadcasts, verified webhooks.
3. **Frontend state and routing third**
   - [ ] Org-aware routes/context/localStorage keys.
4. **Branding and deploy config last**
   - [ ] Env-driven domain/SEO/PWA metadata.

---

## 8) Verification Checklist For Each Ported Slice

- [ ] Cross-org access attempt returns `403` for non-platform admin.
- [ ] Super-admin path still functions for operational support.
- [ ] Websocket rejects unauthenticated client.
- [ ] Websocket only delivers events for authorized tournament/org.
- [ ] Forged webhook payload is rejected in production mode.
- [ ] Payment success updates only intended tenant data.
- [ ] Frontend typecheck/lint/tests pass.
- [ ] API tests pass for both happy path and tenant boundary path.

---

## 9) Reuse Candidates (High Confidence)

These patterns from GIAA are worth reusing with SaaS adaptation:

- Transaction + lock approach for registration capacity race conditions.
- Centralized frontend API client abstraction.
- Modular UI component composition patterns.
- Activity logging workflow (with tenant context added).
- Non-critical side effects wrapped separately from core transaction path.

---

## 10) Explicit Do-Not-Copy List

- Legacy `.env` files and any embedded credentials.
- Any global stream name (`golfers_channel`) without tenant scoping.
- Any fallback that bypasses webhook signature checks in production.
- Any hardcoded JWT template, domain, or organization branding values.
- Any global localStorage key that is not organization-aware.

---

## 11) Definition Of Done For Legacy Migration

Migration work from `giaa-tournament/` is complete only when:

- [ ] No production path depends on GIAA-specific constants.
- [ ] No cross-tenant data access exists for org admins.
- [ ] Payments/realtime/auth flows pass security and regression tests.
- [ ] All deploy-critical URLs/secrets/origins are env-driven.
- [ ] New engineer can run this checklist and reproduce results.

