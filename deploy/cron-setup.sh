#!/bin/bash
# Cron setup for FinPilot subscription renewals
# Run daily at 05:00. Add to crontab: crontab -e
#   0 5 * * * /path/to/FinPilot/deploy/cron-setup.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
ENV_FILE="${PROJECT_DIR}/.env"

if [ ! -f "$ENV_FILE" ]; then
  echo "Error: .env not found at $ENV_FILE" >&2
  exit 1
fi

# Load CRON_SECRET and NEXT_PUBLIC_APP_URL from .env
set -a
source "$ENV_FILE" 2>/dev/null || true
set +a

if [ -z "$CRON_SECRET" ]; then
  echo "Error: CRON_SECRET not set in .env" >&2
  exit 1
fi

APP_URL="${NEXT_PUBLIC_APP_URL:-https://ffinplaner.ru}"
curl -s -H "Authorization: Bearer $CRON_SECRET" "${APP_URL}/api/cron/renew-subscriptions"
