# Discord OAuth production configuration

The dashboard uses the Discord OAuth2 authorization-code flow at:

`/api/auth/discord/login` → Discord → `/api/auth/discord/callback`

Bot invites that require an OAuth2 code grant use the same callback. The invite endpoint stores and validates OAuth state, and the callback exchanges Discord's code before returning to `/guilds`. Set `DISCORD_INVITE_CODE_GRANT=true` when the Discord application requires a code grant. `DISCORD_INVITE_REDIRECT_URI` is deprecated; remove it and use `DISCORD_REDIRECT_URI` for both login and bot installation.

## Required dashboard environment

Set these values in the dashboard process environment. Do not commit real secrets.

- `DISCORD_CLIENT_ID`: the Discord application's Application ID.
- `DISCORD_CLIENT_SECRET`: the OAuth2 client secret for that same application.
- `DISCORD_REDIRECT_URI`: the exact public callback URL:
  `https://YOUR-DASHBOARD-HOST/api/auth/discord/callback`
- `DASHBOARD_PUBLIC_URL`: the public dashboard origin, without a path.
- `SESSION_SECRET`: a long, random secret used to sign dashboard sessions.

`DISCORD_REDIRECT_URI` must match the Redirect URI registered in the Discord Developer Portal character-for-character, including scheme, hostname, port (if any), path, and trailing-slash choice. Use the same client ID and client secret belonging to the application where that redirect URI is registered.

## Discord Developer Portal

In the same Discord application identified by `DISCORD_CLIENT_ID`:

1. Open OAuth2 → General.
2. Add the exact `DISCORD_REDIRECT_URI` value to Redirects.
3. Save the change.
4. Confirm the OAuth2 client secret belongs to this same application.
5. Dashboard login requests `identify` and `guilds`. Code-grant bot invites additionally request `bot` and `applications.commands`.

Do not register a callback on a different host, use the bot invite redirect as the dashboard callback, or mix credentials from separate Discord applications.

## Safe validation

The login endpoint now rejects malformed callback URLs before redirecting to Discord. In production it requires HTTPS, the exact callback path, no query or fragment, and matching origins between `DISCORD_REDIRECT_URI` and `DASHBOARD_PUBLIC_URL` (when the latter is set).

If Discord rejects the token exchange, the server log and callback response include Discord's OAuth error code and description without logging the client secret or authorization code. Common causes:

- `invalid_client`: wrong client ID/secret pair, or credentials from a different Discord application.
- `invalid_grant`: expired/reused authorization code or redirect URI mismatch between authorization and token exchange.
- Redirect URI error on the authorize screen: the exact URI is missing from the Developer Portal Redirects list.

After changing environment variables, restart the dashboard process so the running Node process receives the new values. Clear the browser's old dashboard OAuth cookies and retry from the public dashboard URL.

## Operations Center integration

The Operations Center API uses the existing Pages Router endpoints under `/api/ops/*`. Do not add duplicate App Router endpoints at the same paths. The API verifies the signed dashboard session and creator identity server-side, then calls the loopback operations agent using `OPS_AGENT_TOKEN`. The token is never returned to the browser.

The dashboard liveness probe is `/api/healthz`; the operations agent should use:

`OPS_DASHBOARD_HEALTH_URL=http://127.0.0.1:3000/api/healthz`
