#!/usr/bin/env bash
# Fixes the dashboard .env for Discord login on the live domain, then rebuilds and restarts.
# Usage: bash scripts/setup-login.sh [https://yourdomain.com]
set -euo pipefail
cd "$(dirname "$0")/.."

DOMAIN_URL="${1:-https://possumbot.com}"
DOMAIN_URL="${DOMAIN_URL%/}"
ENV_FILE=".env"

[ -f "$ENV_FILE" ] || touch "$ENV_FILE"
cp "$ENV_FILE" ".env.bak.$(date +%s)"

# Repair lines that were glued together by bad pastes, e.g. "...comDISCORD_CLIENT_ID=123"
sed -i -E 's/(https?:\/\/[^ ]*)(DISCORD_[A-Z_]+=)/\1\n\2/g' "$ENV_FILE"

set_kv() {
  local key="$1" value="$2"
  grep -vE "^${key}=" "$ENV_FILE" > "$ENV_FILE.tmp" || true
  printf '%s=%s\n' "$key" "$value" >> "$ENV_FILE.tmp"
  mv "$ENV_FILE.tmp" "$ENV_FILE"
}

set_kv DISCORD_REDIRECT_URI "$DOMAIN_URL/api/auth/discord/callback"
set_kv NEXT_PUBLIC_DISCORD_REDIRECT_URI "$DOMAIN_URL/api/auth/discord/callback"
set_kv DISCORD_INVITE_REDIRECT_URI "$DOMAIN_URL/guilds"
set_kv NEXT_PUBLIC_DISCORD_INVITE_REDIRECT_URI "$DOMAIN_URL/guilds"
set_kv DASHBOARD_PUBLIC_URL "$DOMAIN_URL"
set_kv NEXT_PUBLIC_DASHBOARD_URL "$DOMAIN_URL"
set_kv DASHBOARD_URL "$DOMAIN_URL"

if ! grep -qE '^DISCORD_CLIENT_ID=.+' "$ENV_FILE"; then
  set_kv DISCORD_CLIENT_ID "1472526506201841695"
fi

if ! grep -qE '^SESSION_SECRET=.{16,}' "$ENV_FILE"; then
  set_kv SESSION_SECRET "$(openssl rand -hex 32)"
  echo "Generated a new SESSION_SECRET."
fi

echo
echo "Paste the Discord client secret (Developer Portal > OAuth2). Input is hidden."
echo "Press Enter on an empty line to keep the current one."
read -rs -p "DISCORD_CLIENT_SECRET: " secret
echo
secret="$(printf '%s' "$secret" | tr -d '[:space:]\r"'"'")"
if [ -n "$secret" ]; then
  set_kv DISCORD_CLIENT_SECRET "$secret"
fi

echo
for k in DISCORD_CLIENT_ID DISCORD_CLIENT_SECRET DISCORD_REDIRECT_URI SESSION_SECRET DASHBOARD_PUBLIC_URL; do
  if grep -qE "^${k}=.+" "$ENV_FILE"; then echo "$k: set"; else echo "$k: MISSING"; fi
done
echo "Glued lines left: $(grep -cE 'https?://[^ ]*(DISCORD|DASHBOARD)_' "$ENV_FILE" || true)"
echo

bash scripts/deploy.sh --force
