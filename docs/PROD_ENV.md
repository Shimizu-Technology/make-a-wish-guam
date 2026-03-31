# Pacific Golf Production Environment (Minimal, Required)

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
- `FRONTEND_URL=https://pacific-golf-web.netlify.app`
- `CLERK_JWKS_URL`
- `RESEND_API_KEY`
- `STRIPE_SECRET_KEY`

Recommended also set:
- `STRIPE_WEBHOOK_SECRET`
- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`
- `AWS_REGION`
- `AWS_BUCKET`

## Netlify (Web)
Site ID: `69931fa2-398e-4cd0-8e6a-e34a400c051b`

Required:
- `VITE_API_URL=https://pacific-golf-api.onrender.com`
- `VITE_WS_URL=wss://pacific-golf-api.onrender.com/cable`
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
