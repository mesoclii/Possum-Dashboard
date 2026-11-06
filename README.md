# Possum Bot Dashboard

The dashboard is a Next.js application that connects to the separate Possum Bot API. Run it as its own PM2 process behind an HTTPS reverse proxy.

## Update the Oracle Cloud VM

The dashboard checkout is `~/negan-dashboard` and its PM2 process is `possum-dashboard`.

```bash
cd ~/negan-dashboard
git pull --ff-only origin fix/dashboard-safe-deploy-2026-11-06
npm run deploy:vm
pm2 status
```

Restart the dashboard only after the build succeeds. The VM has limited memory; if a build reports out-of-memory, do not restart into a failed build. The build script keeps the previous build available for rollback.

To update the bot too, follow the bot's [VM update instructions](../README.md#update-the-oracle-cloud-vm). The bot process is `possum-bot` in `~/Negan-Bot`.

Paid-feature testing is a separate step. Keep paid-plan enforcement off or unset while validating the actual features; do not enable `PAID_BOT_MODE` or `SAAS_PREMIUM_ENFORCEMENT` yet.

## First-time setup

Use Node.js 20.9 or newer. Install dependencies and configure `.env` from `.env.example`:

```bash
npm ci
cp .env.example .env
```

Set the Discord OAuth client ID and secret, and make `DISCORD_REDIRECT_URI` exactly match the redirect URL registered in Discord:

```text
https://<dashboard-domain>/api/auth/discord/callback
```

Also configure:

- A unique `SESSION_SECRET` (for example, generate one with `openssl rand -hex 32`).
- `BOT_API_URL` pointing to the private bot API.
- The same strong `DASHBOARD_API_TOKEN` used by the bot.
- `POSSUM_BOT_ROOT` set to the absolute path of the bot checkout (for this VM, `/home/<user>/Negan-Bot`).
- `DASHBOARD_PUBLIC_URL` and `NEXT_PUBLIC_DASHBOARD_URL` set to the dashboard's HTTPS origin.

Build and start the dashboard:

```bash
npm run lint
npm run build
pm2 start ecosystem.config.cjs --only possum-dashboard
pm2 save
```

## Safety and troubleshooting

- Keep `.env`, `prisma/dashboard.db`, and their backups private. The database contains dashboard sessions.
- Keep the bot API private to the VM/reverse-proxy network; do not expose its port publicly.
- If `npm run build` runs out of memory, leave the current PM2 process alone until a successful build is available.
- A successful build does not verify Discord OAuth, guild permissions, bot connectivity, or live feature behavior; check those after deployment.
