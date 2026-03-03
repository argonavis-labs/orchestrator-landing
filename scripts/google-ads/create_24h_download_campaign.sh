#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
DEFAULT_PROJECT_ID="$(awk 'NF && $1 !~ /^#/ {print $1; exit}' "$ROOT_DIR/.gcloud-project" 2>/dev/null || true)"

PROJECT_ID="${1:-${GOOGLE_CLOUD_PROJECT:-${CLOUDSDK_CORE_PROJECT:-$DEFAULT_PROJECT_ID}}}"
DAILY_BUDGET_USD="${2:-1000}"

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing required command: $1" >&2
    exit 1
  fi
}

require_command gcloud
require_command python3

if [[ -z "$PROJECT_ID" ]]; then
  echo "Missing project id. Pass it as arg 1 or set GOOGLE_CLOUD_PROJECT/CLOUDSDK_CORE_PROJECT, or add .gcloud-project at repo root." >&2
  exit 1
fi

PYTHON_BIN="$ROOT_DIR/.venv-google-ads/bin/python3"
if [[ ! -x "$PYTHON_BIN" ]]; then
  PYTHON_BIN="python3"
fi

if ! "$PYTHON_BIN" -c "import google.ads.googleads.client" >/dev/null 2>&1; then
  echo "Missing python dependency: google-ads" >&2
  echo "Install with one of:" >&2
  echo "  python3 -m pip install google-ads" >&2
  echo "  python3 -m venv .venv-google-ads && .venv-google-ads/bin/pip install google-ads" >&2
  exit 1
fi

secret_value() {
  local secret_name="$1"
  gcloud secrets versions access latest \
    --secret="$secret_name" \
    --project="$PROJECT_ID" 2>/dev/null | tr -d '\r'
}

DEVELOPER_TOKEN="$(secret_value GOOGLE_ADS_DEVELOPER_TOKEN || true)"
CLIENT_ID="$(secret_value GOOGLE_ADS_CLIENT_ID || true)"
CLIENT_SECRET="$(secret_value GOOGLE_ADS_CLIENT_SECRET || true)"
REFRESH_TOKEN="$(secret_value GOOGLE_ADS_REFRESH_TOKEN || true)"
LOGIN_CUSTOMER_ID="$(secret_value GOOGLE_ADS_LOGIN_CUSTOMER_ID || true)"
CUSTOMER_ID="$(secret_value GOOGLE_ADS_CUSTOMER_ID || true)"

missing=()
[[ -z "$DEVELOPER_TOKEN" ]] && missing+=("GOOGLE_ADS_DEVELOPER_TOKEN")
[[ -z "$CLIENT_ID" ]] && missing+=("GOOGLE_ADS_CLIENT_ID")
[[ -z "$CLIENT_SECRET" ]] && missing+=("GOOGLE_ADS_CLIENT_SECRET")
[[ -z "$REFRESH_TOKEN" ]] && missing+=("GOOGLE_ADS_REFRESH_TOKEN")
[[ -z "$CUSTOMER_ID" ]] && missing+=("GOOGLE_ADS_CUSTOMER_ID")

if (( ${#missing[@]} > 0 )); then
  echo "Missing required secrets (no latest version found): ${missing[*]}" >&2
  echo "Populate secrets first, then rerun this script." >&2
  exit 2
fi

"$PYTHON_BIN" "$ROOT_DIR/scripts/google-ads/create_search_campaign.py" \
  --developer-token "$DEVELOPER_TOKEN" \
  --client-id "$CLIENT_ID" \
  --client-secret "$CLIENT_SECRET" \
  --refresh-token "$REFRESH_TOKEN" \
  --customer-id "$CUSTOMER_ID" \
  --login-customer-id "$LOGIN_CUSTOMER_ID" \
  --daily-budget-usd "$DAILY_BUDGET_USD" \
  --campaign-name "Orchestrator Downloads 24h Search" \
  --ad-group-name "High Intent Downloads" \
  --final-url "https://orchest.org/download/" \
  --geo-target-ids "2840,2124" \
  --language-ids "1000" \
  --end-after-24h
