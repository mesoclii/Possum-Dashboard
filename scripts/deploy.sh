#!/usr/bin/env bash
# One-command dashboard deploy: pull, install only if needed, build only if code changed, restart.
# Usage: bash scripts/deploy.sh          (pull + build if needed + restart)
#        bash scripts/deploy.sh --force  (build even if nothing changed)
#        bash scripts/deploy.sh --env    (only reload .env, no build; for server-side env changes)
set -euo pipefail
cd "$(dirname "$0")/.."

APP="${PM2_APP:-possum-dashboard}"
start=$(date +%s)

if [ "${1:-}" = "--env" ]; then
  pm2 restart "$APP" --update-env
  echo "Restarted $APP with fresh env in $(( $(date +%s) - start ))s (no build)."
  echo "Note: NEXT_PUBLIC_* values are baked in at build time and need a normal deploy."
  exit 0
fi

before=$(git rev-parse HEAD)
git pull --ff-only
after=$(git rev-parse HEAD)

if [ "$before" != "$after" ] && git diff --name-only "$before" "$after" | grep -qE '^(package\.json|package-lock\.json)$'; then
  echo "Dependencies changed, running npm ci..."
  npm ci
fi

if [ "$before" = "$after" ] && [ "${1:-}" != "--force" ] && [ -d .next ]; then
  echo "Already up to date, skipping build. Use --force to rebuild or --env to reload .env only."
else
  npm run build
fi

pm2 restart "$APP"
echo "Deploy finished in $(( $(date +%s) - start ))s."
