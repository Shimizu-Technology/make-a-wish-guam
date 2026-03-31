#!/usr/bin/env bash
set -euo pipefail

API_URL="${API_URL:-https://pacific-golf-api.onrender.com}"
WEB_URL="${WEB_URL:-https://pacific-golf-web.netlify.app}"
ORG_SLUG="${ORG_SLUG:-make-a-wish-guam}"
TOURNAMENT_SLUG="${TOURNAMENT_SLUG:-golf-for-wishes-2026}"

check_code() {
  local url="$1"
  local expect="$2"
  local code
  code=$(curl -s -o /tmp/pg_smoke_body -w '%{http_code}' "$url")
  if [[ "$code" != "$expect" ]]; then
    echo "❌ $url -> $code (expected $expect)"
    exit 1
  fi
  echo "✅ $url -> $code"
}

echo "🚦 Running read-only production smoke test..."

check_code "$API_URL/up" 200
check_code "$WEB_URL" 200
check_code "$WEB_URL/legacy" 200
check_code "$WEB_URL/admin/login" 200
check_code "$API_URL/api/v1/organizations/$ORG_SLUG" 200
check_code "$API_URL/api/v1/organizations/$ORG_SLUG/tournaments" 200
check_code "$API_URL/api/v1/organizations/$ORG_SLUG/tournaments/$TOURNAMENT_SLUG" 200

TOURNAMENT_ID=$(curl -s "$API_URL/api/v1/organizations/$ORG_SLUG/tournaments/$TOURNAMENT_SLUG" | python3 -c "import sys,json; data=json.load(sys.stdin); print(data.get('id', ''))" 2>/dev/null)
if [[ -z "$TOURNAMENT_ID" ]]; then
  echo "❌ Failed to resolve tournament ID from $API_URL/api/v1/organizations/$ORG_SLUG/tournaments/$TOURNAMENT_SLUG"
  exit 1
fi
echo "✅ Tournament ID resolved: $TOURNAMENT_ID"

check_code "$API_URL/api/v1/tournaments/$TOURNAMENT_ID/scores/leaderboard" 200
check_code "$API_URL/api/v1/tournaments/$TOURNAMENT_ID/raffle/board" 200
check_code "$WEB_URL/$ORG_SLUG" 200
check_code "$WEB_URL/$ORG_SLUG/tournaments/$TOURNAMENT_SLUG" 200
check_code "$WEB_URL/$ORG_SLUG/tournaments/$TOURNAMENT_SLUG/register" 200
check_code "$WEB_URL/$ORG_SLUG/tournaments/$TOURNAMENT_SLUG/leaderboard" 200
check_code "$WEB_URL/$ORG_SLUG/tournaments/$TOURNAMENT_SLUG/raffle" 200
check_code "$WEB_URL/score" 200

echo ""
echo "✅ Smoke test passed (read-only)"
