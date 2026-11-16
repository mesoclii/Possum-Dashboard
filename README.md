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

## Podcast studio

The podcast engine is disabled by default on the bot and requires private Discord voice testing before enabling it. Set the same `DASHBOARD_API_TOKEN` on both services and configure the dashboard's HTTPS public URL. Hosts can open `/dashboard/podcast`; administrators can select server channels and roles when setting up the access panel. The public listening page and RSS feed are linked there. Live audio is public, but saved episodes are private until a host publishes them. Participants consent and withdraw using the current session's Discord buttons or commands.

Hosts can preview a completed recording, enter up to 32 time ranges in seconds to remove, and render a private edited copy without changing the original or automatically censoring audio. Ranges refer to saved audio time, excluding pauses. Stop all podcast recordings before editing. Preview the copy and confirm review, then publish separately if desired; review is an attestation, not proof of listening. Editing uses the same disk quota and free-space reserve as recording.

The studio shows hosts each voice participant's current consent status and provides private playback and download before publication. A failed recording cannot be published.

## Safety and troubleshooting

- Keep `.env`, `prisma/dashboard.db`, and their backups private. The database contains dashboard sessions.
- Keep the bot API private to the VM/reverse-proxy network; do not expose its port publicly.
- If `npm run build` runs out of memory, leave the current PM2 process alone until a successful build is available.
- A successful build does not verify Discord OAuth, guild permissions, bot connectivity, or live feature behavior; check those after deployment.
