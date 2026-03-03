#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
DEFAULT_PROJECT_ID="$(awk 'NF && $1 !~ /^#/ {print $1; exit}' "$ROOT_DIR/.gcloud-project" 2>/dev/null || true)"
PROJECT_ID="${1:-${GOOGLE_CLOUD_PROJECT:-${CLOUDSDK_CORE_PROJECT:-$DEFAULT_PROJECT_ID}}}"

if [[ -z "$PROJECT_ID" ]]; then
  echo "Usage: $0 [PROJECT_ID]"
  echo "Or set GOOGLE_CLOUD_PROJECT/CLOUDSDK_CORE_PROJECT, or add .gcloud-project at repo root."
  exit 1
fi

required_cmds=(gcloud)
for cmd in "${required_cmds[@]}"; do
  if ! command -v "$cmd" >/dev/null 2>&1; then
    echo "Missing required command: $cmd"
    exit 1
  fi
done

echo "Using project: ${PROJECT_ID}"

gcloud services enable \
  googleads.googleapis.com \
  secretmanager.googleapis.com \
  --project="${PROJECT_ID}"

ensure_secret() {
  local secret_name="$1"

  if gcloud secrets describe "${secret_name}" --project="${PROJECT_ID}" >/dev/null 2>&1; then
    echo "Secret exists: ${secret_name}"
    return
  fi

  gcloud secrets create "${secret_name}" \
    --project="${PROJECT_ID}" \
    --replication-policy="automatic"

  echo "Created secret: ${secret_name}"
}

ensure_secret "GOOGLE_ADS_DEVELOPER_TOKEN"
ensure_secret "GOOGLE_ADS_CLIENT_ID"
ensure_secret "GOOGLE_ADS_CLIENT_SECRET"
ensure_secret "GOOGLE_ADS_REFRESH_TOKEN"
ensure_secret "GOOGLE_ADS_LOGIN_CUSTOMER_ID"
ensure_secret "GOOGLE_ADS_CUSTOMER_ID"

echo
cat <<'INSTRUCTIONS'
Bootstrap complete.

Next steps:
1) Add each secret value:
   printf '%s' '<VALUE>' | gcloud secrets versions add <SECRET_NAME> --data-file=- --project=<PROJECT_ID>
2) Use those values in your Google Ads API worker/service.
3) In Google Ads UI, create conversion actions and copy send_to values into assets/analytics-config.js.
INSTRUCTIONS
