# Go-Live Readiness Audit

**Project:** Pacific Golf  
**Date:** 2026-02-16  
**Audit Type:** Structured go-live audit with GIAA parity comparison  
**Scope:** Product readiness, security/tenancy, operational readiness, and test quality

---

## Executive Verdict

**Current status: Not yet go-live ready for external client onboarding.**

The platform has strong SaaS direction and major security hardening already in place, but there are **4 release blockers** to close before onboarding production organizations with confidence.

### What is strong now

- Multi-tenant model and org-scoped architecture are significantly stronger than legacy GIAA.
- ActionCable authentication and tournament-scoped streams are in place.
- Webhook handling is hardened with production fail-closed behavior.
- Focused security test suite passes.
- Frontend production build succeeds.

### What blocks go-live

1. Missing tournament-level authorization guards in raffle/sponsor admin controllers.
2. No API rate limiting for public and sensitive endpoints.
3. Full backend test suite is failing due to legacy test debt and stale model references.
4. Frontend `typecheck` is failing with a large backlog of TypeScript issues.

---

## Evidence-Based Blockers (Must Fix Before Go-Live)

## B1) Cross-org authorization gap on raffle/sponsor admin actions

**Risk:** An authenticated admin can potentially mutate data outside their intended organization by targeting foreign tournament IDs.

**Evidence**

- `api/app/controllers/api/v1/raffle_controller.rb`:
  - Uses `before_action :set_tournament`, but has no `require_tournament_admin!` guard for admin endpoints.
- `api/app/controllers/api/v1/sponsors_controller.rb`:
  - Same pattern: sets tournament/sponsor but no tournament authorization enforcement for create/update/destroy/reorder.

**Required fix**

- Add explicit tournament authorization filters for all admin actions in both controllers.
- Add regression tests proving cross-org requests return `403`.

---

## B2) No rate limiting on public/sensitive API surface

**Risk:** Registration, payment-link, and other public endpoints are vulnerable to abuse and operational saturation.

**Evidence**

- No `rack-attack` initializer exists in `api/config/initializers/`.
- No rate-limiting middleware/config files found.

**Required fix**

- Implement `Rack::Attack` with separate policies for:
  - public registration/payment endpoints,
  - authenticated admin endpoints,
  - webhook endpoint handling.
- Add tests for throttle behavior and logs/metrics for blocked requests.

---

## B3) Production-level auth debug logging includes user details

**Risk:** Potential PII exposure and noisy logs in production operations.

**Evidence**

- `api/app/controllers/concerns/authenticated.rb` logs:
  - Clerk ID,
  - email,
  - full `@current_user.inspect`.

**Required fix**

- Remove or strictly gate these logs to development/debug mode.
- Keep only non-sensitive auth telemetry.

---

## B4) Release quality gates currently fail

**Risk:** Regressions can ship undetected while teams assume readiness.

**Evidence from this audit run**

- `bundle exec rails test` -> **fails** (`88 errors`) due to stale legacy tests (`admins(...)` fixture helper mismatch and removed employee fields).
- `npm run typecheck` -> **fails** with multiple TypeScript errors across pages/components.
- `npm run test` -> passes (`1 file`, `3 tests`) but coverage is minimal.
- `npm run build` -> passes.
- Focused security regression set passes:
  - channels,
  - webhook controller,
  - phase-A access control verification,
  - tournament model constraints.

**Required fix**

- Define passing release gates (at minimum: backend critical suite + frontend typecheck + frontend test suite + build).
- Triage/fix test and TS backlog so CI signal is meaningful.

---

## High Priority (Should Fix Before First Paying Client)

- Add operational visibility baseline (error monitoring and alerting).
- Expand health endpoint to include Redis/ActionCable dependency checks.
- Publish explicit production runbook for incident response and rollback.
- Verify/automate backup + restore process for production database.

---

## GIAA Parity Comparison (Current State)

## Parity summary

- Core tournament workflows are broadly at/above GIAA parity:
  - registration,
  - payments,
  - check-in,
  - groups,
  - scoring,
  - leaderboard,
  - reporting,
  - raffle/sponsors features present.
- Pacific Golf adds major SaaS capabilities absent in GIAA:
  - organization model,
  - org membership roles,
  - scoped endpoints/streams,
  - modernized env-driven config posture.

## Known intentional divergence

- Employee discount/employee-number subsystem from GIAA was removed in Pacific Golf migration history.
- This is acceptable only if first client does not require that workflow.

---

## Command Results (Run During This Audit)

### Backend

- `bundle exec rails test` -> **FAIL**
  - 285 runs, 477 assertions, 88 errors
  - dominant issues: stale `admins(...)` test helper references and removed employee attributes in legacy tests.
- `bundle exec rails test test/channels test/controllers/api/v1/webhooks_controller_test.rb test/integration/phase_a_access_control_verification_test.rb test/models/tournament_test.rb` -> **PASS**
  - 18 runs, 33 assertions, 0 failures

### Frontend

- `npm run typecheck` -> **FAIL**
  - TS errors across multiple files (unused imports, type/interface mismatches, missing declarations, outdated props).
- `npm run test` -> **PASS**
  - 1 file, 3 tests (`api.test.ts`)
- `npm run build` -> **PASS**
  - production build completes; large chunk warning remains.

---

## Proper (No-BandAid) Remediation Sequence

## Phase 1: Release blockers (target 1-2 days)

1. Authorization hardening for raffle/sponsors admin endpoints + tests.
2. Add robust API rate limiting + tests + observability.
3. Remove/gate auth debug logging.
4. Triage and fix failing backend legacy tests required for go-live confidence.
5. Triage and fix frontend typecheck errors until green.

**Exit criteria**

- No known cross-org mutation path.
- `rails` release test suite green.
- frontend `typecheck`, `test`, and `build` green.

## Phase 2: Client launch hardening (target 2-4 days)

1. Monitoring/alerting integration and dashboards.
2. Backup/restore drill documentation and validation.
3. Health-check expansion and operational runbook completion.

**Exit criteria**

- On-call can detect, triage, and rollback within documented SLA.

## Phase 3: Post-launch resilience

1. Increase frontend test coverage on critical flows (registration/payment/scoring).
2. Add browser E2E smoke suite for go/no-go gating.
3. Address bundle size and performance tuning.

---

## Recommended Go-Live Gate Checklist (Minimum)

- [ ] Blocker B1 fixed and validated with cross-org negative tests.
- [ ] Blocker B2 fixed and validated in staging load tests.
- [ ] Blocker B3 fixed and log policy reviewed.
- [ ] Blocker B4 fixed (`rails` release suite + web `typecheck/test/build` all green).
- [ ] Staging checklist completed (`docs/STAGING_GO_NO_GO_CHECKLIST.md`).
- [ ] Release handoff verified (`docs/SECURITY_RELEASE_HANDOFF.md`).

---

## Bottom Line

Pacific Golf is close and materially stronger than GIAA from a SaaS/security perspective, but it is **not yet at “no-worry” onboarding readiness** until the four blockers above are resolved and the release gates are consistently green.
