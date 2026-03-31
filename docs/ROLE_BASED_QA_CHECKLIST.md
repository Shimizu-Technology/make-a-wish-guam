# Pacific Golf — Role-Based QA Checklist (Production)

Use this to validate end-to-end without guessing. Focus on **read + test flows**, then run write/mutation checks intentionally.

## 0) Preflight (2 min)
- [ ] `./scripts/check-prod-env.sh` passes
- [ ] `./scripts/smoke-prod.sh` passes
- [ ] Open site in a **fresh/private tab** (avoid stale cache)
- [ ] Confirm tournament/org under test (slug, date, fee)

---

## 1) Public Visitor / Registrant
**Goal:** can discover event and register cleanly.

### Discovery
- [ ] Org landing loads: `/:orgSlug`
- [ ] Tournament card shows correct date/location/fee/capacity
- [ ] Tournament detail page loads sponsors + contact info
- [ ] Leaderboard page loads
- [ ] Raffle page loads

### Registration flow (create one real test registrant)
- [ ] Open register page
- [ ] Required field validation works (name/email/phone)
- [ ] Waiver step appears and blocks when unchecked
- [ ] Payment step starts Stripe checkout
- [ ] Success page shows after payment
- [ ] Registrant appears in admin list
- [ ] Confirmation email received

### Edge checks
- [ ] Duplicate email handling behavior is expected
- [ ] Capacity behavior near limit is correct
- [ ] Mobile layout works at 375px width

---

## 2) Golfer (Scoring Role)
**Goal:** golfer can access scorecard and submit scores safely.

- [ ] `/score` loads
- [ ] Magic link request works for a registered golfer email
- [ ] Magic link verify page works
- [ ] Golfer dashboard loads tournament + group
- [ ] Scorecard loads with correct holes/par
- [ ] Enter score for one hole
- [ ] Leaderboard reflects update (with auto-refresh)
- [ ] Unauthorized golfer cannot access other scorecards

---

## 3) Org Admin (Tournament Ops)
**Goal:** operations team can run event day.

### Auth + scope
- [ ] `/admin/login` works
- [ ] Org admin only sees own org/tournaments
- [ ] Unauthorized routes are blocked

### Operations
- [ ] Dashboard metrics load
- [ ] Check-in flow works
- [ ] Group assignments visible and editable
- [ ] Manual score adjustments (if allowed) are logged
- [ ] Raffle board/admin views load
- [ ] Sponsor list/order displays correctly

### Payments + comms
- [ ] Payment status can be viewed/updated correctly
- [ ] Payment link flow works (if used)
- [ ] Resend email actions work from admin

### Refund handling (client-critical)
- [ ] Stripe-paid golfer refund works end-to-end (status -> refunded, registration -> cancelled)
- [ ] Manual refund flow (cash/check/pay-on-day) records refund metadata correctly
- [ ] Refunded golfer is removed from assigned group/scorecard occupancy
- [ ] Refund confirmation email behavior verified
- [ ] Refund appears correctly in admin reporting views

---

## 4) Super Admin (Platform Role)
**Goal:** can manage multiple organizations safely.

- [ ] `/super-admin` loads
- [ ] Create org flow works
- [ ] Edit org flow works
- [ ] Org branding fields persist
- [ ] New org routes resolve properly (`/:orgSlug`)
- [ ] Org member admin assignment works

---

## 5) Webhooks / Background reliability
- [ ] Stripe webhook endpoint receives test event
- [ ] No 5xx errors in Render logs during normal use
- [ ] ActionCable connects from frontend without origin errors
- [ ] `/up` remains 200 during testing

---

## 6) Branding & Customization QA (critical for "feels like their own site")
For each client org, verify:
- [ ] Logo appears in header/footer
- [ ] Banner/hero image appears and crops correctly desktop/mobile
- [ ] Primary color applied to key accents/buttons
- [ ] Event-specific copy (title/subtitle/tagline) is unique
- [ ] Custom sections (history, honoree, sponsor tiers, event rules) are present
- [ ] Contact details are org-specific (phone/email/links)
- [ ] Sponsor logos + ordering reflect that org, not defaults

## Customization targets to implement/keep (recommended)
- [ ] **Theme tokens per org**: primary, secondary, neutral, button styles
- [ ] **Hero module per org**: title, subtitle, badge/logo overlays
- [ ] **Story blocks per org**: e.g., airport 50th anniversary, honoree silhouette
- [ ] **Layout presets**: Classic / Modern / Event Showcase (same engine, different feel)
- [ ] **Section toggles**: show/hide leaderboard, raffle, sponsor wall, honoree section
- [ ] **Custom domain/subdomain** support when ready

---

## 7) Release sign-off
- [ ] No P0/P1 bugs open
- [ ] Payment + registration + scoring validated
- [ ] Admin/super-admin role checks validated
- [ ] Branding checklist validated for target org
- [ ] Screenshot evidence captured for each role
- [ ] Go-live approved

