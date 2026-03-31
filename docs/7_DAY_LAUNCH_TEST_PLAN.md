# 7-Day Launch Test Plan (Simple Checklist)

**Project:** Pacific Golf  
**Purpose:** Validate production readiness one step at a time and document findings clearly.  
**How to use:** Complete each day in order. Do not move to next day until all must-pass checks are done.

---

## Quick Rules

- Test in a staging environment that matches production as closely as possible.
- Record every issue immediately in the "Findings Log" section.
- If a **must-pass** item fails, stop and fix before continuing.
- Keep screenshots and short notes as evidence.

---

## Day 1 - Environment and Access Setup

### Goal
Confirm deployments, auth, and core configuration are correct.

### Checklist

- [ ] Web app loads from staging URL.
- [ ] API health endpoint returns healthy response (`/health`).
- [ ] Admin login works.
- [ ] Super admin can access all orgs.
- [ ] Org admin can only access their org.
- [ ] Stripe keys are set in staging env.
- [ ] Webhook secret is set in staging env.
- [ ] CORS works for web -> API.
- [ ] HTTPS is active on web and API.

### Must-pass

- [ ] Auth works for super admin and org admin.
- [ ] No cross-org access for org admin.
- [ ] Health endpoint is stable.

### Evidence to save

- Screenshot: successful admin login
- Screenshot: forbidden cross-org attempt (expected 403)
- Note: env vars verified (yes/no and who verified)

---

## Day 2 - Registration and Payment Flow

### Goal
Prove the public registration and payment flow works end to end.

### Checklist

- [ ] Open public registration page for an org tournament.
- [ ] Submit valid golfer registration.
- [ ] Confirm golfer appears in admin dashboard.
- [ ] Test "Pay on Day" flow.
- [ ] Test Stripe payment flow (test card).
- [ ] Confirm payment status updates correctly.
- [ ] Confirm success page loads correctly.
- [ ] Confirm payment link email can be sent.
- [ ] Open payment link and complete payment.

### Must-pass

- [ ] Registration succeeds with no errors.
- [ ] Stripe payment completes and golfer marked paid.
- [ ] Payment link flow works.

### Evidence to save

- Screenshot: successful registration
- Screenshot: successful payment
- Screenshot: admin sees paid status

---

## Day 3 - Admin Operations (Tournament Ops)

### Goal
Verify daily operator workflows.

### Checklist

- [ ] Create/edit tournament settings.
- [ ] Add golfer manually from admin.
- [ ] Check in golfer.
- [ ] Update payment details.
- [ ] Cancel golfer.
- [ ] Refund golfer (if paid).
- [ ] Send payment link from admin.
- [ ] Verify activity logs show important actions.

### Must-pass

- [ ] Check-in, payment update, cancel, and refund all function.
- [ ] Activity log captures key actions.

### Evidence to save

- Screenshot: check-in success
- Screenshot: refund success
- Screenshot: activity log entries

---

## Day 4 - Grouping, Scoring, and Leaderboard

### Goal
Validate tournament-day functionality.

### Checklist

- [ ] Create groups.
- [ ] Assign golfers to groups.
- [ ] Enter scores from scorecard flow.
- [ ] Edit scores.
- [ ] Verify leaderboard updates.
- [ ] Verify websocket/live updates appear for admin screens.
- [ ] Validate tie behavior and ranking display.

### Must-pass

- [ ] Scores save correctly.
- [ ] Leaderboard reflects score changes.
- [ ] Real-time updates are visible.

### Evidence to save

- Screenshot: score entry success
- Screenshot: leaderboard updated
- Note: websocket behavior OK (yes/no)

---

## Day 5 - Raffle and Sponsors

### Goal
Verify optional event modules and access controls.

### Checklist

- [ ] Add sponsor(s), edit sponsor, reorder sponsor list.
- [ ] Verify sponsor display on public page.
- [ ] Create raffle prize.
- [ ] Sell/create raffle tickets.
- [ ] Draw winner and claim prize.
- [ ] Confirm org admin cannot mutate another org raffle/sponsors.

### Must-pass

- [ ] Sponsor and raffle admin actions work for correct org.
- [ ] Cross-org sponsor/raffle mutation is blocked.

### Evidence to save

- Screenshot: sponsor displayed
- Screenshot: raffle winner draw
- Screenshot: forbidden cross-org attempt

---

## Day 6 - Reliability, Security, and Guardrails

### Goal
Confirm operational protections are active.

### Checklist

- [ ] Trigger repeated public requests and confirm rate limiting (429).
- [ ] Confirm webhook with bad signature is rejected.
- [ ] Confirm logs do not expose sensitive token/secret data.
- [ ] Confirm backup procedure is documented and scheduled.
- [ ] Confirm production runbook is reviewed.

### Must-pass

- [ ] Rate limiting works.
- [ ] Invalid webhook rejected.
- [ ] No sensitive logging leaks.

### Evidence to save

- Screenshot/log snippet: 429 response
- Screenshot/log snippet: webhook rejection
- Note: backup owner and schedule

---

## Day 7 - Full Dress Rehearsal and Go/No-Go

### Goal
Run one complete simulated tournament workflow from start to finish.

### Full flow checklist

- [ ] Create org + tournament
- [ ] Public registration
- [ ] Payment (online and pay-on-day)
- [ ] Admin check-in
- [ ] Group assignment
- [ ] Score entry
- [ ] Leaderboard updates
- [ ] Raffle/sponsor touchpoints
- [ ] End-of-day admin checks

### Go/No-Go decision

- [ ] **GO** if all must-pass checks from Days 1-7 are complete and no open critical issues.
- [ ] **NO-GO** if any security, payment, data integrity, or access-control issue remains unresolved.

### Sign-off

- Product Owner: ____________________ Date: __________
- Engineering: ______________________ Date: __________

---

## Findings Log (Simple Template)

Use one line per issue.

| ID | Day | Area | What happened | Expected | Severity (Low/Med/High/Critical) | Screenshot/Link | Status |
|---|---|---|---|---|---|---|---|
| 001 | Day 2 | Payment | Example: Stripe payment stuck | Should redirect to success | High | link | Open |

---

## Final Summary Template (Fill after Day 7)

### What worked well

- 
- 
- 

### Issues found

- 
- 
- 

### Remaining risks before production

- 
- 
- 

### Launch recommendation

- [ ] Ready for pilot org onboarding
- [ ] Needs another fix pass before onboarding

