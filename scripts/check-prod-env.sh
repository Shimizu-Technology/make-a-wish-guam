#!/usr/bin/env bash
set -euo pipefail

RENDER_SERVICE_ID="${RENDER_SERVICE_ID:-srv-d6gk5jrh46gs73dlf4h0}"
NETLIFY_SITE_ID="${NETLIFY_SITE_ID:-69931fa2-398e-4cd0-8e6a-e34a400c051b}"

if [[ -z "${RENDER_API_KEY:-}" ]]; then
  echo "❌ Missing RENDER_API_KEY"
  exit 1
fi

if [[ -z "${NETLIFY_AUTH_TOKEN:-}" ]]; then
  echo "❌ Missing NETLIFY_AUTH_TOKEN"
  exit 1
fi

if ! command -v python3 >/dev/null 2>&1; then
  echo "❌ Missing python3 (required)"
  exit 1
fi

if ! command -v netlify >/dev/null 2>&1; then
  echo "❌ Missing netlify CLI (required for Netlify env checks)"
  exit 1
fi

WEB_DIR="$(dirname "$0")/../web"
if [[ ! -d "$WEB_DIR" ]]; then
  echo "❌ Missing web directory at $WEB_DIR"
  exit 1
fi

echo "🔎 Checking Render env vars..."
render_required=(
  DATABASE_URL
  RAILS_MASTER_KEY
  SECRET_KEY_BASE
  FRONTEND_URL
  CLERK_JWKS_URL
  RESEND_API_KEY
  STRIPE_SECRET_KEY
)

render_env_url="https://api.render.com/v1/services/$RENDER_SERVICE_ID/env-vars"
render_http_code=$(curl -sS -o /tmp/pg_render_env.json -w '%{http_code}'   -H "Authorization: Bearer $RENDER_API_KEY"   "$render_env_url")

if [[ "$render_http_code" != "200" ]]; then
  echo "❌ Render env API failed: HTTP $render_http_code ($render_env_url)"
  exit 1
fi

if ! python3 - <<'PYJSON' >/tmp/pg_render_keys.txt
import json
from pathlib import Path
raw = Path('/tmp/pg_render_env.json').read_text()
arr = json.loads(raw)
keys = sorted({(x.get('key') or (x.get('envVar') or {}).get('key')) for x in arr if isinstance(x, dict)})
for k in keys:
    if k:
        print(k)
PYJSON
then
  echo "❌ Render env API returned invalid JSON"
  exit 1
fi

for key in "${render_required[@]}"; do
  if ! grep -qx "$key" /tmp/pg_render_keys.txt; then
    echo "❌ Render missing: $key"
    exit 1
  fi
  echo "✅ Render: $key"
done

echo "🔎 Checking Netlify env vars..."
netlify_required=(
  VITE_API_URL
  VITE_WS_URL
  VITE_CLERK_PUBLISHABLE_KEY
  VITE_CLERK_JWT_TEMPLATE
  VITE_STRIPE_PUBLISHABLE_KEY
)

for key in "${netlify_required[@]}"; do
  val=$(cd "$WEB_DIR" && NETLIFY_AUTH_TOKEN="$NETLIFY_AUTH_TOKEN" netlify env:get "$key" 2>/dev/null || true)
  if [[ -z "$val" || "$val" == *"No value set"* ]]; then
    echo "❌ Netlify missing: $key"
    exit 1
  fi
  echo "✅ Netlify: $key"
done

echo ""
echo "✅ Production env check passed"
