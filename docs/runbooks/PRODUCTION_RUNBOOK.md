# Production Runbook

## Scope

Operational guide for Pacific Golf production incidents and day-to-day checks.

## Daily Health Checks

- API health endpoint: `GET /health` returns `status: ok`.
- Verify webhook processing log entries for Stripe events.
- Verify ActionCable traffic is present for active scoring windows.
- Confirm outbound email delivery has no spike in failures.

## Incident Severity

- **SEV-1:** Client-facing outage, payment failures, or data integrity risk.
- **SEV-2:** Degraded behavior with workaround available.
- **SEV-3:** Non-critical bug or cosmetic issue.

## Immediate Triage (First 10 Minutes)

1. Confirm impact scope (single org vs platform-wide).
2. Check API health and recent deploy time.
3. Check error logs around impacted endpoint/controller.
4. If payments are affected, verify Stripe dashboard event delivery.
5. If realtime is affected, validate websocket auth and channel subscription logs.

## Common Recovery Steps

### API instability

- Roll back to previous deploy in Render.
- Re-run health checks after rollback.
- Re-validate login, registration, and payment-link endpoints.

### Stripe webhook failures

- Verify `STRIPE_WEBHOOK_SECRET` is present in env.
- Verify signature failures in logs.
- Replay failed events from Stripe dashboard once secret/config is corrected.

### Cross-tenant access concern

- Immediately disable affected endpoint route if needed.
- Capture request IDs and affected resource IDs.
- Verify authorization filters for tournament/org scope.
- Ship hotfix and re-run access-control integration tests.

## Rollback Checklist

1. Roll back API service to last known good deploy.
2. Smoke test:
   - admin login
   - org tournament page
   - registration submit
   - payment link access
   - scorecard load
3. Confirm no new migration was partially applied; if needed, run forward fix migration.
4. Post incident summary and action items.

## Required Environment Variables (Production)

- `RAILS_ENV=production`
- `RAILS_MASTER_KEY`
- `DATABASE_URL`
- `CLERK_JWKS_URL`
- `FRONTEND_URL`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `RESEND_API_KEY`
- `ASSUME_SSL=true`
- `FORCE_SSL=true`
- `ENABLE_RATE_LIMITING=true`

## Release Gate Commands

Run before production deploy:

- API: `bundle exec rails test`
- Web: `npm run typecheck`
- Web: `npm run test`
- Web: `npm run build`

