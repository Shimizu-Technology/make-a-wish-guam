# Make-A-Wish Guam Production Environment (Minimal, Required)

Keep this simple. If these are set correctly, deploys are stable.

## Prerequisites
- `python3`
- `netlify` CLI
- `curl`
- `RENDER_API_KEY` and `NETLIFY_AUTH_TOKEN` exported in your shell

## Render (API)
Service ID: `srv-d6gk5jrh46gs73dlf4h0`

Required:
- `DATABASE_URL` (Render Postgres internal connection string)
- `RAILS_MASTER_KEY`
- `SECRET_KEY_BASE`
- `FRONTEND_URL=https://make-a-wish-web.netlify.app`
- `CLERK_JWKS_URL`
- `RESEND_API_KEY`
- `MAILER_FROM_EMAIL`
- `DELIVERY_WEBHOOK_TOKEN`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`
- `AWS_REGION`
- `AWS_BUCKET` or `AWS_S3_BUCKET`

Active Storage is intentionally hardcoded to use S3 in production. Do not use local disk for production uploads on Render; uploaded prize images, sponsor logos, and branding images need durable object storage across deploys and restarts.

Delivery status webhooks:
- Resend endpoint: `https://make-a-wish-api.onrender.com/api/v1/webhooks/resend?token=$DELIVERY_WEBHOOK_TOKEN`
- ClickSend endpoint: `https://make-a-wish-api.onrender.com/api/v1/webhooks/clicksend?token=$DELIVERY_WEBHOOK_TOKEN`

Configure Resend for `email.sent`, `email.delivered`, `email.bounced`, `email.delivery_delayed`, `email.complained`, and failure events. Configure ClickSend SMS delivery reports to forward to the ClickSend endpoint, or use the same token in `X-Webhook-Token`.

## Netlify (Web)
Site ID: `69931fa2-398e-4cd0-8e6a-e34a400c051b`

Required:
- `VITE_API_URL=https://make-a-wish-api.onrender.com`
- `VITE_WS_URL=wss://make-a-wish-api.onrender.com/cable`
- `VITE_CLERK_PUBLISHABLE_KEY`
- `VITE_CLERK_JWT_TEMPLATE`
- `VITE_STRIPE_PUBLISHABLE_KEY`

## One-command checks
From repo root:

```bash
export RENDER_API_KEY=...
export NETLIFY_AUTH_TOKEN=...
./scripts/check-prod-env.sh
./scripts/smoke-prod.sh
```
