# Staging Go/No-Go Checklist

**Project:** Pacific Golf  
**Purpose:** Day-of-staging verification for security remediations and release safety  
**Owner:** Assigned engineer  
**Secondary reviewer:** Leon / project lead  
**Related docs:** `docs/SECURITY_RELEASE_HANDOFF.md`, `docs/SECURITY_REVIEW_TRACKER.md`

---

## How To Use This Checklist

- Mark each item as `PASS`, `FAIL`, or `N/A`.
- Capture evidence (screenshots, logs, command output, links) for all critical sections.
- A single `FAIL` in any **Critical Gate** section is an automatic **NO-GO** until resolved.

Status legend:
- `[ ]` Not run
- `[x]` Passed
- `[!]` Failed / blocked

---

## 0) Release Metadata

- **Branch/commit under test:** ______________________
- **Staging API URL:** ______________________
- **Staging frontend URL:** ______________________
- **Date/time tested:** ______________________
- **Engineer running checklist:** ______________________

---

## 1) Critical Gate: Environment + Config

### 1.1 Required production-like env vars (staging)

- [ ] `FRONTEND_URL` set correctly to staging frontend host
- [ ] `STRIPE_WEBHOOK_SECRET` set
- [ ] `ASSUME_SSL=true` (or intentional documented override)
- [ ] `FORCE_SSL=true` (or intentional documented override)
- [ ] Optional origins (`FRONTEND_URL_ALT`, `CORS_ALLOWED_ORIGINS`) reviewed and intentional

Evidence:
- Env source screenshot/link: ______________________

### 1.2 Migration gate

Run:

```bash
cd api
bin/rails db:migrate
```

- [ ] Migration runs successfully in staging
- [ ] No pending migrations remain

Evidence:
- Command output snippet: ______________________

---

## 2) Critical Gate: Automated Regression Suite

Run backend targeted suite:

```bash
cd api
bin/rails test test/integration/phase_a_access_control_verification_test.rb
bin/rails test test/channels/application_cable/connection_test.rb test/channels/golfers_channel_test.rb
bin/rails test test/controllers/api/v1/webhooks_controller_test.rb
bin/rails test test/models/tournament_test.rb
bin/rails test test/controllers/api/v1/scores_controller_golfer_auth_test.rb
```

Run frontend tests:

```bash
cd web
npm run test
```

- [ ] All backend targeted security tests pass
- [ ] Frontend Vitest suite passes

Evidence:
- Test logs artifact/link: ______________________

---

## 3) Critical Gate: Tenant Isolation (Manual)

Use two org admins (Org A + Org B) in staging.

### 3.1 Cross-org read/write denial

- [ ] Org A admin cannot read Org B tournament by direct ID route
- [ ] Org A admin cannot update Org B tournament
- [ ] Org A admin cannot read/update Org B golfer
- [ ] Org A admin cannot read Org B group
- [ ] Expected behavior = `403` or denied UI flow

Evidence:
- API response screenshots/logs: ______________________

### 3.2 Positive controls

- [ ] Org A admin can still manage Org A resources
- [ ] Super admin can access cross-org resources where intended

Evidence:
- Screen/API proof: ______________________

---

## 4) Critical Gate: WebSocket Security + Functionality

### 4.1 Connection/auth controls

- [ ] Unauthenticated WS connection is rejected
- [ ] Invalid token WS connection is rejected
- [ ] Authenticated admin WS connection succeeds

### 4.2 Scope controls

- [ ] Admin only receives updates for accessible tournament channels
- [ ] No evidence of cross-org realtime leakage

### 4.3 Functional sanity

- [ ] Check-in/payment/golfer update events still update UI in real-time for authorized users

Evidence:
- Browser network logs + console evidence: ______________________

---

## 5) Critical Gate: Webhook Security

Use Stripe test-mode webhooks in staging.

### 5.1 Signature enforcement

- [ ] Invalid signature webhook is rejected
- [ ] Valid signature webhook is accepted

### 5.2 Fail-closed behavior

- [ ] If secret is intentionally removed in staging test, webhook requests fail closed
- [ ] Restore secret immediately after test

### 5.3 Business behavior

- [ ] Legit completed checkout webhook marks golfer paid correctly
- [ ] Duplicate delivery does not double-apply state changes

Evidence:
- Stripe dashboard event IDs + API logs: ______________________

---

## 6) Medium Gate: Performance Smoke (SEC-009)

Target endpoints:
- org admin tournament summary
- tournament admin detail stats
- leaderboard endpoints (individual + team)

- [ ] No obvious timeout/spike/regression at realistic dataset size
- [ ] Response times acceptable for staging baseline

Evidence:
- Endpoint timing snapshots: ______________________

---

## 7) Medium Gate: Domain/SEO Placeholder Safety

- [ ] `FRONTEND_URL` points to active staging host (Netlify or equivalent)
- [ ] `robots.txt` / `sitemap.xml` placeholders are acknowledged and acceptable pre-domain
- [ ] Plan exists to replace placeholders at domain cutover

Evidence:
- URL checks/screenshots: ______________________

---

## 8) Known Pre-Existing Issues (Do Not Misclassify)

- Some older backend tests outside the security-targeted suite may still fail due to legacy fixture/model naming mismatch.
- Frontend has known unrelated parser/typecheck issues in `web/src/pages/OrganizationLandingPage.tsx`.

These are not regressions from the security remediation work, but they should be tracked separately.

---

## 9) Go / No-Go Decision

### Critical gates summary

- [ ] Section 1 passed
- [ ] Section 2 passed
- [ ] Section 3 passed
- [ ] Section 4 passed
- [ ] Section 5 passed

If any unchecked -> **NO-GO**

### Final decision

- [ ] **GO** to staging acceptance / pre-prod
- [ ] **NO-GO** (blockers listed below)

Blockers:
1. ______________________
2. ______________________
3. ______________________

---

## 10) Sign-Off

- Engineer signature/name: ______________________
- Reviewer signature/name: ______________________
- Date/time: ______________________

