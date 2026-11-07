export type DiscordGuild = {
  id: string;
  name: string;
  icon: string | null;
  owner?: boolean;
  permissions?: string;
  permissions_new?: string;
};

export type DiscordUser = {
  id: string;
  username: string;
  global_name?: string | null;
  avatar?: string | null;
};

const DISCORD_API_BASE = "https://discord.com/api";
const DISCORD_AUTH_BASE = "https://discord.com/oauth2/authorize";
const DEFAULT_DISCORD_CLIENT_ID = "1472526506201841695";
const DISCORD_PERMISSION_ADMINISTRATOR = BigInt("8");
const DISCORD_PERMISSION_MANAGE_GUILD = BigInt("32");

function getRequiredEnv(name: string) {
  const value = String(process.env[name] || "").trim();
  if (!value) {
    throw new Error(`${name} is not configured.`);
  }
  return value;
}

function getOptionalEnv(name: string) {
  return String(process.env[name] || "").trim();
}

function normalizeScopes(scopes: string) {
  return scopes
    .split(/[\s,]+/g)
    .map((scope) => scope.trim())
    .filter(Boolean);
}

function ensureScopes(scopes: string[], required: string[]) {
  const set = new Set(scopes);
  for (const scope of required) {
    if (!set.has(scope)) set.add(scope);
  }
  return Array.from(set);
}

async function readDiscordJson<T>(response: Response): Promise<T> {
  const text = await response.text();
  let parsed: any = {};

  try {
    parsed = text ? JSON.parse(text) : {};
  } catch {
    throw new Error(text || "Discord returned an invalid response.");
  }

  if (!response.ok) {
    const code = String(parsed?.error || "").trim();
    const description = String(parsed?.error_description || parsed?.message || "").trim();
    throw new Error(
      [code ? `Discord OAuth error: ${code}` : `Discord request failed (${response.status})`, description]
        .filter(Boolean)
        .join(" | ")
    );
  }

  return parsed as T;
}

export function getDiscordOauthConfigurationIssue() {
  const clientId = String(process.env.DISCORD_CLIENT_ID || "").trim();
  const clientSecret = String(process.env.DISCORD_CLIENT_SECRET || "").trim();
  const redirectValue = String(process.env.DISCORD_REDIRECT_URI || "").trim();
  if (!clientId) return "DISCORD_CLIENT_ID is missing from the dashboard environment.";
  if (!clientSecret) return "DISCORD_CLIENT_SECRET is missing from the dashboard environment.";
  if (!redirectValue) return "DISCORD_REDIRECT_URI is missing from the dashboard environment.";

  let redirect: URL;
  try {
    redirect = new URL(redirectValue);
  } catch {
    return "DISCORD_REDIRECT_URI must be an absolute URL.";
  }
  if (redirect.username || redirect.password || redirect.search || redirect.hash) {
    return "DISCORD_REDIRECT_URI must not contain credentials, a query string, or a fragment.";
  }
  if (redirect.pathname !== "/api/auth/discord/callback") {
    return "DISCORD_REDIRECT_URI must use the exact callback path /api/auth/discord/callback.";
  }
  if (process.env.NODE_ENV === "production" && redirect.protocol !== "https:") {
    return "Production DISCORD_REDIRECT_URI must use HTTPS.";
  }

  const publicUrl = String(process.env.DASHBOARD_PUBLIC_URL || process.env.NEXT_PUBLIC_DASHBOARD_URL || "").trim();
  if (publicUrl) {
    try {
      if (new URL(publicUrl).origin !== redirect.origin) {
        return "DISCORD_REDIRECT_URI and DASHBOARD_PUBLIC_URL must use the same public origin.";
      }
    } catch {
      return "DASHBOARD_PUBLIC_URL must be an absolute URL.";
    }
  }
  return null;
}

export function isDiscordOauthConfigured() {
  return getDiscordOauthConfigurationIssue() === null;
}

export function buildDiscordOauthUrl(state: string) {
  const params = new URLSearchParams({
    client_id: getRequiredEnv("DISCORD_CLIENT_ID"),
    response_type: "code",
    redirect_uri: getRequiredEnv("DISCORD_REDIRECT_URI"),
    scope: "identify guilds",
    state,
  });

  return `${DISCORD_AUTH_BASE}?${params.toString()}`;
}

export function buildDiscordInviteUrl(options: { guildId?: string; state?: string } = {}) {
  const clientId = getOptionalEnv("DISCORD_CLIENT_ID") || DEFAULT_DISCORD_CLIENT_ID;
  const permissions = getOptionalEnv("DISCORD_INVITE_PERMISSIONS") || "8";
  const inviteCodeGrantFlag = getOptionalEnv("DISCORD_INVITE_CODE_GRANT");
  const callbackRedirect = getOptionalEnv("DISCORD_REDIRECT_URI");
  const state = String(options.state || "").trim();
  const requireCodeGrant =
    inviteCodeGrantFlag.length > 0
      ? ["true", "1", "yes"].includes(inviteCodeGrantFlag.toLowerCase())
      : Boolean(getOptionalEnv("DISCORD_INVITE_REDIRECT_URI"));
  let scopes = normalizeScopes(getOptionalEnv("DISCORD_INVITE_SCOPES") || "bot applications.commands");

  if (requireCodeGrant) {
    if (!callbackRedirect) {
      throw new Error("DISCORD_REDIRECT_URI is not configured for the invite code-grant callback.");
    }
    if (!state) {
      throw new Error("OAuth state is required for the invite code-grant flow.");
    }
    scopes = ensureScopes(scopes, ["bot", "applications.commands", "identify", "guilds"]);
  }

  const params = new URLSearchParams({
    client_id: clientId,
    scope: scopes.join(" "),
    permissions,
  });

  if (options.guildId) {
    params.set("guild_id", options.guildId);
    params.set("disable_guild_select", "true");
  }

  if (requireCodeGrant) {
    params.set("response_type", "code");
    params.set("redirect_uri", callbackRedirect);
    params.set("state", state);
  }

  return `${DISCORD_AUTH_BASE}?${params.toString()}`;
}

export async function exchangeDiscordCode(code: string) {
  const body = new URLSearchParams({
    client_id: getRequiredEnv("DISCORD_CLIENT_ID"),
    client_secret: getRequiredEnv("DISCORD_CLIENT_SECRET"),
    grant_type: "authorization_code",
    code,
    redirect_uri: getRequiredEnv("DISCORD_REDIRECT_URI"),
  });

  const response = await fetch(`${DISCORD_API_BASE}/oauth2/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
    cache: "no-store",
  });

  return readDiscordJson<{
    access_token: string;
    token_type: string;
    expires_in: number;
    refresh_token?: string;
    scope?: string;
  }>(response);
}

export async function fetchDiscordUser(accessToken: string) {
  const response = await fetch(`${DISCORD_API_BASE}/users/@me`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    cache: "no-store",
  });

  return readDiscordJson<DiscordUser>(response);
}

export async function fetchDiscordGuilds(accessToken: string) {
  const response = await fetch(`${DISCORD_API_BASE}/users/@me/guilds`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    cache: "no-store",
  });

  return readDiscordJson<DiscordGuild[]>(response);
}

export function getDiscordGuildIconUrl(guildId: string, icon: string | null | undefined) {
  if (!icon) return null;
  return `https://cdn.discordapp.com/icons/${guildId}/${icon}.png?size=256`;
}

export function hasGuildManageAccess(guild: DiscordGuild) {
  const raw = String(guild.permissions_new || guild.permissions || "0").trim();
  try {
    const permissions = BigInt(raw);
    return (
      guild.owner === true ||
      (permissions & DISCORD_PERMISSION_ADMINISTRATOR) === DISCORD_PERMISSION_ADMINISTRATOR ||
      (permissions & DISCORD_PERMISSION_MANAGE_GUILD) === DISCORD_PERMISSION_MANAGE_GUILD
    );
  } catch {
    return guild.owner === true;
  }
}
