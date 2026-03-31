# Future Improvements

**Project:** Pacific Golf  
**Purpose:** Track planned near-term and long-term improvements after current launch readiness work.

---

## Near-Term (Next 30-60 Days)

## 1) Subdomain support for organizations

- Goal: support URLs like `rotary.pacific-golf.com` and `make-a-wish.pacific-golf.com`.
- Notes:
  - Keep current path-based routing (`/:orgSlug`) as fallback.
  - Add subdomain -> organization resolution in API/web middleware/router.
  - Update CORS and ActionCable origin handling for wildcard subdomains.

## 2) Public root/home experience polish

- Expand neutral root homepage with:
  - organization discovery/onboarding CTA,
  - clearer organizer/golfer entry points,
  - production branding and marketing content.

## 3) Unified signed-in dashboard shortcut across public pages

- Reuse signed-in top bar pattern on relevant org public routes (not just landing).
- Ensure dashboard link resolves correctly for user role:
  - super admin -> `/super-admin`
  - org admin -> `/:orgSlug/admin`

## 4) Production observability baseline

- Add error monitoring integration (Sentry or equivalent).
- Add uptime checks and alert routing.
- Add structured logging and key dashboard metrics.

## 5) Operational hardening completion

- Validate production backup/restore drill.
- Expand health endpoint checks (dependencies).
- Finalize runbook ownership and response SLAs.

---

## Mid-Term (60-120 Days)

## 6) Tenant domain management UI

- Let org admins configure custom domains (CNAME setup).
- Include DNS verification and SSL status in admin settings.

## 7) Advanced onboarding flow for new organizations

- Guided setup:
  - create org
  - set branding
  - create first tournament
  - publish registration link

## 8) Expanded test automation

- Add browser E2E smoke tests for:
  - registration/payment
  - check-in
  - scoring + leaderboard
- Use these as release gates for staging/prod.

## 9) Performance and bundle optimization

- Break large frontend bundle via code-splitting.
- Add cache strategy tuning and performance budgets.

---

## Long-Term (120+ Days)

## 10) Full custom-domain support per organization

- Bring your own domain per org (e.g., `golf.rotaryguam.org`).
- Self-serve domain onboarding workflow with SSL automation.

## 11) White-label theming controls

- Extended org-level theming:
  - typography,
  - component style variants,
  - email template themes.

## 12) Multi-region and scale readiness

- Evaluate regional hosting/data strategy.
- Add load-testing and scaling playbooks for tournament-day spikes.

## 13) Product analytics and business reporting

- Add org-level usage and revenue dashboards.
- Add conversion funnel reporting for registration/payment flows.

---

## Backlog Candidates (Needs Product Decision)

- Employee discount / employee-number workflow reintroduction (if client demand requires it).
- SMS notifications for confirmations/reminders.
- Tournament templates for recurring annual events.
- Expanded sponsor media management (assets, placements, rotation).

---

## Change Management

- Revisit this document after each release milestone.
- Promote completed items into release notes/handoffs.
- Link actionable items to tickets before implementation.

