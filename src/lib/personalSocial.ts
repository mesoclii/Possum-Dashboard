import crypto from "node:crypto";
import type { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import type { DiscordGuild } from "@/lib/discordOAuth";

export const SOCIAL_PROVIDERS = ["facebook", "x", "youtube", "twitch", "instagram", "tiktok", "reddit"] as const;
export type OAuthProvider = "twitch" | "youtube" | "reddit" | "x" | "tiktok";
export function isSocialOAuthProvider(value: string): value is OAuthProvider {
  return ["twitch", "youtube", "reddit", "x", "tiktok"].includes(value);
}
export function socialStateCookie(provider: OAuthProvider) { return `possum_social_${provider}_state`; }

export function socialOrigin() {
  try {
    const url = new URL(String(process.env.DISCORD_REDIRECT_URI || ""));
    if (url.pathname !== "/api/auth/discord/callback" || url.username || url.password || url.search || url.hash ||
      (url.protocol !== "https:" && !(process.env.NODE_ENV !== "production" && url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname)))) return null;
    return url.origin;
  } catch { return null; }
}

export function twitchConfigured() {
  return Boolean(socialOrigin() && process.env.SOCIAL_TWITCH_CLIENT_ID?.trim() && process.env.SOCIAL_TWITCH_CLIENT_SECRET?.trim());
}

export function youtubeConfigured() {
  return Boolean(socialOrigin() && process.env.SOCIAL_YOUTUBE_CLIENT_ID?.trim() && process.env.SOCIAL_YOUTUBE_CLIENT_SECRET?.trim());
}

export function socialProviderStatus(provider: OAuthProvider) {
  if (provider === "twitch") return twitchConfigured() ? "available" : "unconfigured";
  if (provider === "youtube") return youtubeConfigured() ? "available" : "unconfigured";
  const prefix = `SOCIAL_${provider.toUpperCase()}`;
  const id = process.env[`${prefix}_CLIENT_ID`]?.trim();
  const secret = process.env[`${prefix}_CLIENT_SECRET`]?.trim();
  const userAgent = String(process.env.SOCIAL_REDDIT_USER_AGENT || "").trim();
  if (!socialOrigin() || !id || !secret || (provider === "tiktok" && !socialOrigin()!.startsWith("https:")) ||
    (provider === "reddit" && (!userAgent || userAgent.length > 200 || /[^\x20-\x7e]/.test(userAgent)))) return "unconfigured";
  return process.env[`${prefix}_ENABLED`] === "true" ? "available" : "approval-required";
}

export function sameOrigin(request: Request) {
  const origin = socialOrigin();
  return !!origin && request.headers.get("origin") === origin;
}

export function hash(value: string) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

export async function beginSocial(provider: OAuthProvider, userId: string, sessionCookie: string) {
  if (socialProviderStatus(provider) !== "available") throw new Error("Provider is not configured or enabled.");
  const state = crypto.randomBytes(32).toString("base64url");
  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`DELETE FROM "PersonalSocialOAuthAttempt" WHERE "expiresAt" < ${Date.now()} OR ("userId" = ${userId} AND "provider" = ${provider})`;
    await tx.$executeRaw`DELETE FROM "PersonalSocialOAuthState" WHERE "expiresAt" < ${Date.now()}`;
    await tx.$executeRaw`INSERT INTO "PersonalSocialOAuthAttempt" ("stateHash", "sessionHash", "userId", "provider", "expiresAt") VALUES (${hash(`${provider}:${state}`)}, ${hash(sessionCookie)}, ${userId}, ${provider}, ${Date.now() + 600000})`;
  });
  const urls: Record<OAuthProvider, string> = {
    twitch: "https://id.twitch.tv/oauth2/authorize", youtube: "https://accounts.google.com/o/oauth2/v2/auth",
    reddit: "https://www.reddit.com/api/v1/authorize", x: "https://x.com/i/oauth2/authorize", tiktok: "https://www.tiktok.com/v2/auth/authorize/",
  };
  const url = new URL(urls[provider]);
  const clientId = process.env[`SOCIAL_${provider.toUpperCase()}_CLIENT_ID`]!.trim();
  const params = new URLSearchParams({
    redirect_uri: `${socialOrigin()}/api/personal-social/${provider}/callback`,
    response_type: "code", state,
  });
  params.set(provider === "tiktok" ? "client_key" : "client_id", clientId);
  if (provider === "youtube") params.set("scope", "https://www.googleapis.com/auth/youtube.readonly");
  if (provider === "x") params.set("scope", "tweet.read users.read");
  if (provider === "reddit") { params.set("scope", "identity"); params.set("duration", "temporary"); }
  if (provider === "tiktok") params.set("scope", "user.info.basic,user.info.profile");
  const verifier = provider === "youtube" || provider === "x" ? crypto.randomBytes(32).toString("base64url") : "";
  if (verifier) {
    params.set("code_challenge", crypto.createHash("sha256").update(verifier).digest("base64url"));
    params.set("code_challenge_method", "S256");
  }
  url.search = params.toString();
  return { state, verifier, url: url.toString() };
}

export async function consumeState(provider: OAuthProvider, state: string, cookieState: string, userId: string, sessionCookie: string) {
  if (!/^[A-Za-z0-9_-]{43}$/.test(state) || state !== cookieState) return false;
  const count = await prisma.$executeRaw`UPDATE "PersonalSocialOAuthAttempt" SET "claimed" = 1 WHERE "stateHash" = ${hash(`${provider}:${state}`)} AND "sessionHash" = ${hash(sessionCookie)} AND "userId" = ${userId} AND "provider" = ${provider} AND "claimed" = 0 AND "expiresAt" > ${Date.now()}`;
  return count === 1;
}

export async function exchangeTwitch(code: string) {
  const clientId = process.env.SOCIAL_TWITCH_CLIENT_ID!.trim();
  const body = new URLSearchParams({
    client_id: clientId, client_secret: process.env.SOCIAL_TWITCH_CLIENT_SECRET!.trim(),
    code, grant_type: "authorization_code", redirect_uri: `${socialOrigin()}/api/personal-social/twitch/callback`,
  });
  const tokenResponse = await fetch("https://id.twitch.tv/oauth2/token", { method: "POST", body, cache: "no-store", redirect: "error", signal: AbortSignal.timeout(10000) });
  if (!tokenResponse.ok) throw new Error("Twitch token exchange failed.");
  const token = await tokenResponse.json();
  if (typeof token.access_token !== "string" || !token.access_token) throw new Error("Twitch token missing.");
  try {
    const response = await fetch("https://api.twitch.tv/helix/users", {
      headers: { Authorization: `Bearer ${token.access_token}`, "Client-Id": clientId },
      cache: "no-store", redirect: "error", signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) throw new Error("Twitch profile request failed.");
    const result = await response.json();
    const user = result?.data?.[0];
    if (!/^[0-9]+$/.test(String(user?.id || "")) || !/^[a-zA-Z0-9_]{1,25}$/.test(String(user?.login || ""))) throw new Error("Invalid Twitch profile.");
    return { id: String(user.id), label: String(user.login), url: `https://www.twitch.tv/${user.login}` };
  } finally {
    // Tokens are never persisted; best-effort revoke the authorization after identity lookup.
    await fetch("https://id.twitch.tv/oauth2/revoke", {
      method: "POST", body: new URLSearchParams({ client_id: clientId, token: token.access_token }),
      cache: "no-store", redirect: "error", signal: AbortSignal.timeout(5000),
    }).catch(() => undefined);
  }
}

export async function exchangeYouTube(code: string, verifier: string) {
  if (!/^[A-Za-z0-9_-]{43}$/.test(verifier)) throw new Error("Missing code verifier.");
  const body = new URLSearchParams({
    client_id: process.env.SOCIAL_YOUTUBE_CLIENT_ID!.trim(), client_secret: process.env.SOCIAL_YOUTUBE_CLIENT_SECRET!.trim(),
    code, code_verifier: verifier, grant_type: "authorization_code", redirect_uri: `${socialOrigin()}/api/personal-social/youtube/callback`,
  });
  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", { method: "POST", body, cache: "no-store", redirect: "error", signal: AbortSignal.timeout(10000) });
  if (!tokenResponse.ok) throw new Error("YouTube token exchange failed.");
  const token = await tokenResponse.json();
  if (typeof token.access_token !== "string" || !token.access_token) throw new Error("YouTube token missing.");
  try {
    const response = await fetch("https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true&maxResults=50", {
      headers: { Authorization: `Bearer ${token.access_token}` }, cache: "no-store", redirect: "error", signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) throw new Error("YouTube profile request failed.");
    const result = await response.json();
    if (!Array.isArray(result?.items) || result.items.length !== 1 || result.nextPageToken) throw new Error("Exactly one YouTube channel is required.");
    const channel = result.items[0];
    if (!/^UC[A-Za-z0-9_-]{22}$/.test(String(channel?.id || "")) || typeof channel?.snippet?.title !== "string" || !channel.snippet.title.trim()) throw new Error("Invalid YouTube channel.");
    return { id: String(channel.id), label: channel.snippet.title.trim().slice(0, 100), url: `https://www.youtube.com/channel/${channel.id}` };
  } finally {
    await fetch("https://oauth2.googleapis.com/revoke", {
      method: "POST", body: new URLSearchParams({ token: token.refresh_token || token.access_token }),
      cache: "no-store", redirect: "error", signal: AbortSignal.timeout(5000),
    }).catch(() => undefined);
  }
}

function basicAuth(clientId: string, secret: string) {
  return `Basic ${Buffer.from(`${clientId}:${secret}`).toString("base64")}`;
}

export async function exchangeX(code: string, verifier: string) {
  if (!/^[A-Za-z0-9_-]{43}$/.test(verifier)) throw new Error("Missing code verifier.");
  const clientId = process.env.SOCIAL_X_CLIENT_ID!.trim();
  const auth = basicAuth(clientId, process.env.SOCIAL_X_CLIENT_SECRET!.trim());
  const body = new URLSearchParams({ code, code_verifier: verifier, grant_type: "authorization_code", redirect_uri: `${socialOrigin()}/api/personal-social/x/callback` });
  const response = await fetch("https://api.x.com/2/oauth2/token", { method: "POST", headers: { Authorization: auth }, body, cache: "no-store", redirect: "error", signal: AbortSignal.timeout(10000) });
  if (!response.ok) throw new Error("X token exchange failed.");
  const token = await response.json();
  if (typeof token.access_token !== "string" || !token.access_token) throw new Error("X token missing.");
  try {
    const userResponse = await fetch("https://api.x.com/2/users/me", {
      headers: { Authorization: `Bearer ${token.access_token}` }, cache: "no-store", redirect: "error", signal: AbortSignal.timeout(10000),
    });
    if (!userResponse.ok) throw new Error("X profile request failed.");
    const result = await userResponse.json();
    const user = result?.data;
    if (!/^\d{1,20}$/.test(String(user?.id || "")) || !/^[A-Za-z0-9_]{1,15}$/.test(String(user?.username || ""))) throw new Error("Invalid X profile.");
    return { id: String(user.id), label: String(user.username), url: `https://x.com/${user.username}` };
  } finally {
    await fetch("https://api.x.com/2/oauth2/revoke", {
      method: "POST", headers: { Authorization: auth }, body: new URLSearchParams({ token: token.access_token }),
      cache: "no-store", redirect: "error", signal: AbortSignal.timeout(5000),
    }).catch(() => undefined);
  }
}

export async function exchangeReddit(code: string) {
  const auth = basicAuth(process.env.SOCIAL_REDDIT_CLIENT_ID!.trim(), process.env.SOCIAL_REDDIT_CLIENT_SECRET!.trim());
  const userAgent = process.env.SOCIAL_REDDIT_USER_AGENT!.trim();
  const headers = { Authorization: auth, "User-Agent": userAgent };
  const body = new URLSearchParams({ code, grant_type: "authorization_code", redirect_uri: `${socialOrigin()}/api/personal-social/reddit/callback` });
  const response = await fetch("https://www.reddit.com/api/v1/access_token", { method: "POST", headers, body, cache: "no-store", redirect: "error", signal: AbortSignal.timeout(10000) });
  if (!response.ok) throw new Error("Reddit token exchange failed.");
  const token = await response.json();
  if (typeof token.access_token !== "string" || !token.access_token) throw new Error("Reddit token missing.");
  try {
    const userResponse = await fetch("https://oauth.reddit.com/api/v1/me", {
      headers: { Authorization: `Bearer ${token.access_token}`, "User-Agent": userAgent }, cache: "no-store", redirect: "error", signal: AbortSignal.timeout(10000),
    });
    if (!userResponse.ok) throw new Error("Reddit profile request failed.");
    const user = await userResponse.json();
    if (!/^[A-Za-z0-9]{1,20}$/.test(String(user?.id || "")) || !/^[A-Za-z0-9_-]{1,20}$/.test(String(user?.name || ""))) throw new Error("Invalid Reddit profile.");
    return { id: String(user.id), label: String(user.name), url: `https://www.reddit.com/user/${user.name}` };
  } finally {
    await fetch("https://www.reddit.com/api/v1/revoke_token", {
      method: "POST", headers, body: new URLSearchParams({ token: token.access_token, token_type_hint: "access_token" }),
      cache: "no-store", redirect: "error", signal: AbortSignal.timeout(5000),
    }).catch(() => undefined);
  }
}

export async function exchangeTikTok(code: string) {
  const clientKey = process.env.SOCIAL_TIKTOK_CLIENT_ID!.trim();
  const clientSecret = process.env.SOCIAL_TIKTOK_CLIENT_SECRET!.trim();
  const body = new URLSearchParams({ client_key: clientKey, client_secret: clientSecret, code, grant_type: "authorization_code", redirect_uri: `${socialOrigin()}/api/personal-social/tiktok/callback` });
  const response = await fetch("https://open.tiktokapis.com/v2/oauth/token/", { method: "POST", body, cache: "no-store", redirect: "error", signal: AbortSignal.timeout(10000) });
  if (!response.ok) throw new Error("TikTok token exchange failed.");
  const token = await response.json();
  if (typeof token.access_token !== "string" || !token.access_token) throw new Error("TikTok token missing.");
  try {
    const scopes = typeof token.scope === "string" ? token.scope.split(",").map((scope: string) => scope.trim()) : [];
    if (!scopes.includes("user.info.basic") || !scopes.includes("user.info.profile")) throw new Error("TikTok profile permission not granted.");
    const userResponse = await fetch("https://open.tiktokapis.com/v2/user/info/?fields=open_id,display_name,profile_deep_link", {
      headers: { Authorization: `Bearer ${token.access_token}` }, cache: "no-store", redirect: "error", signal: AbortSignal.timeout(10000),
    });
    if (!userResponse.ok) throw new Error("TikTok profile request failed.");
    const result = await userResponse.json();
    const user = result?.data?.user;
    if (result?.error?.code !== "ok" || typeof user?.open_id !== "string" || !user.open_id || user.open_id.length > 128 ||
      user.open_id !== token.open_id || typeof user?.display_name !== "string" || !user.display_name.trim() || typeof user?.profile_deep_link !== "string") throw new Error("Invalid TikTok profile.");
    const url = new URL(user.profile_deep_link);
    if (url.protocol !== "https:" || !["www.tiktok.com", "tiktok.com"].includes(url.hostname) || url.port || url.username || url.password ||
      !/^\/@[A-Za-z0-9._]{1,24}\/?$/.test(url.pathname)) throw new Error("Invalid TikTok profile URL.");
    return { id: user.open_id, label: user.display_name.trim().slice(0, 100), url: `${url.origin}${url.pathname}` };
  } finally {
    await fetch("https://open.tiktokapis.com/v2/oauth/revoke/", {
      method: "POST", body: new URLSearchParams({ client_key: clientKey, client_secret: clientSecret, token: token.access_token }),
      cache: "no-store", redirect: "error", signal: AbortSignal.timeout(5000),
    }).catch(() => undefined);
  }
}

type SocialAccount = { id: string; label: string; url: string };
type SocialTransaction = Prisma.TransactionClient;

async function rotateSocialRevision(tx: SocialTransaction, provider: OAuthProvider, userId: string) {
  const revision = crypto.randomBytes(16).toString("hex");
  await tx.$executeRaw`INSERT INTO "PersonalSocialRevision" ("userId", "provider", "revision") VALUES (${userId}, ${provider}, ${revision}) ON CONFLICT ("userId", "provider") DO UPDATE SET "revision" = excluded."revision"`;
}

async function saveSocialInTransaction(tx: SocialTransaction, provider: OAuthProvider, userId: string, account: SocialAccount) {
    await rotateSocialRevision(tx, provider, userId);
    const existing = await tx.$queryRaw<{ providerId: string }[]>`SELECT "providerId" FROM "PersonalSocialAccount" WHERE "userId" = ${userId} AND "provider" = ${provider}`;
    if (existing[0]?.providerId !== account.id) {
      await tx.$executeRaw`DELETE FROM "PersonalSocialVisibility" WHERE "userId" = ${userId} AND "provider" = ${provider}`;
    }
    await tx.$executeRaw`INSERT INTO "PersonalSocialAccount" ("userId", "provider", "providerId", "label", "url") VALUES (${userId}, ${provider}, ${account.id}, ${account.label}, ${account.url}) ON CONFLICT ("userId", "provider") DO UPDATE SET "providerId" = excluded."providerId", "label" = excluded."label", "url" = excluded."url"`;
}

export async function saveSocial(provider: OAuthProvider, userId: string, account: SocialAccount) {
  await prisma.$transaction(async (tx) => {
    await saveSocialInTransaction(tx, provider, userId, account);
  });
}

export async function completeSocial(provider: OAuthProvider, state: string, userId: string, sessionCookie: string, account: SocialAccount) {
  return prisma.$transaction(async (tx) => {
    const claimed = await tx.$executeRaw`DELETE FROM "PersonalSocialOAuthAttempt" WHERE "stateHash" = ${hash(`${provider}:${state}`)} AND "sessionHash" = ${hash(sessionCookie)} AND "userId" = ${userId} AND "provider" = ${provider} AND "claimed" = 1 AND "expiresAt" > ${Date.now()}`;
    if (claimed !== 1) return false;
    await saveSocialInTransaction(tx, provider, userId, account);
    return true;
  });
}

export async function disconnectSocial(provider: OAuthProvider, userId: string) {
  await prisma.$transaction(async (tx) => {
    await rotateSocialRevision(tx, provider, userId);
    await tx.$executeRaw`DELETE FROM "PersonalSocialOAuthAttempt" WHERE "userId" = ${userId} AND "provider" = ${provider}`;
    await tx.$executeRaw`DELETE FROM "PersonalSocialVisibility" WHERE "userId" = ${userId} AND "provider" = ${provider}`;
    await tx.$executeRaw`DELETE FROM "PersonalSocialAccount" WHERE "userId" = ${userId} AND "provider" = ${provider}`;
  });
}

export async function setSocialVisibility(
  provider: OAuthProvider, userId: string, guildId: string, visible: boolean,
  expectedProviderId?: string, expectedRevision?: string,
) {
  return prisma.$transaction(async (tx) => {
    if (!visible) {
      await rotateSocialRevision(tx, provider, userId);
      await tx.$executeRaw`DELETE FROM "PersonalSocialVisibility" WHERE "userId" = ${userId} AND "provider" = ${provider} AND "guildId" = ${guildId}`;
      return true;
    }
    const newRevision = crypto.randomBytes(16).toString("hex");
    const updated = await tx.$executeRaw`UPDATE "PersonalSocialRevision" SET "revision" = ${newRevision} WHERE "userId" = ${userId} AND "provider" = ${provider} AND "revision" = ${expectedRevision} AND EXISTS (SELECT 1 FROM "PersonalSocialAccount" WHERE "userId" = ${userId} AND "provider" = ${provider} AND "providerId" = ${expectedProviderId})`;
    if (updated !== 1) return false;
    const inserted = await tx.$executeRaw`INSERT INTO "PersonalSocialVisibility" ("userId", "provider", "guildId") SELECT "userId", "provider", ${guildId} FROM "PersonalSocialAccount" WHERE "userId" = ${userId} AND "provider" = ${provider} AND "providerId" = ${expectedProviderId} ON CONFLICT ("userId", "provider", "guildId") DO UPDATE SET "guildId" = excluded."guildId"`;
    if (inserted !== 1) throw new Error("Social account changed during sharing.");
    return true;
  });
}

export async function memberGuilds(token: string) {
  const response = await fetch("https://discord.com/api/users/@me/guilds?limit=200", {
    headers: { Authorization: `Bearer ${token}` }, cache: "no-store", redirect: "error", signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) throw new Error("Discord membership unavailable.");
  const guilds: DiscordGuild[] = await response.json();
  if (!Array.isArray(guilds)) throw new Error("Discord membership unavailable.");
  return guilds;
}

function directoryCursorKey() {
  const secret = String(process.env.SESSION_SECRET || "").trim();
  if (!secret) throw new Error("Dashboard sessions are not configured.");
  return crypto.createHash("sha256").update(`personal-social-directory:${secret}`).digest();
}

function directoryCursorScope(guildId: string, filter?: OAuthProvider) {
  return filter ? `${guildId}:${filter}` : guildId;
}

function encodeDirectoryCursor(userId: string, provider: string, guildId: string, filter?: OAuthProvider) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", directoryCursorKey(), iv);
  cipher.setAAD(Buffer.from(directoryCursorScope(guildId, filter)));
  const encrypted = Buffer.concat([cipher.update(JSON.stringify([userId, provider]), "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString("base64url");
}

export function decodeDirectoryCursor(cursor: string, guildId: string, filter?: OAuthProvider) {
  if (!cursor || cursor.length > 300 || !/^[A-Za-z0-9_-]+$/.test(cursor)) return null;
  try {
    const bytes = Buffer.from(cursor, "base64url");
    if (bytes.length < 29) return null;
    const decipher = crypto.createDecipheriv("aes-256-gcm", directoryCursorKey(), bytes.subarray(0, 12));
    decipher.setAAD(Buffer.from(directoryCursorScope(guildId, filter)));
    decipher.setAuthTag(bytes.subarray(12, 28));
    const parsed: unknown = JSON.parse(Buffer.concat([decipher.update(bytes.subarray(28)), decipher.final()]).toString("utf8"));
    if (!Array.isArray(parsed) || parsed.length !== 2 ||
      typeof parsed[0] !== "string" || !/^\d{1,20}$/.test(parsed[0]) ||
      !SOCIAL_PROVIDERS.includes(parsed[1])) return null;
    return { userId: parsed[0] as string, provider: parsed[1] as string };
  } catch { return null; }
}

export async function visibleDirectory(guildId: string, viewerToken: string, cursor?: { userId: string; provider: string } | null, filter?: OAuthProvider) {
  if (!(await memberGuilds(viewerToken)).some((guild) => guild.id === guildId)) throw new Error("Not a member.");
  const afterUser = cursor?.userId || "";
  const afterProvider = cursor?.provider || "";
  const providerFilter = filter || "";
  const rows = await prisma.$queryRaw<{ userId: string; provider: string; providerId: string; revision: string | null }[]>`
    SELECT a."userId", a."provider", a."providerId", r."revision"
    FROM "PersonalSocialVisibility" v JOIN "PersonalSocialAccount" a ON a."userId" = v."userId" AND a."provider" = v."provider"
    LEFT JOIN "PersonalSocialRevision" r ON r."userId" = a."userId" AND r."provider" = a."provider"
    WHERE v."guildId" = ${guildId}
      AND (${providerFilter} = '' OR a."provider" = ${providerFilter})
      AND (${afterUser} = '' OR a."userId" > ${afterUser} OR (a."userId" = ${afterUser} AND a."provider" > ${afterProvider}))
    ORDER BY a."userId", a."provider" LIMIT 21`;
  const page = rows.slice(0, 20);
  const sessions = await prisma.dashboardSession.findMany({
    where: { discordId: { in: page.map((row) => row.userId) }, expiresAt: { gt: new Date() } },
    select: { discordId: true, accessToken: true }, orderBy: { expiresAt: "desc" },
  });
  const tokens = new Map<string, string>();
  for (const session of sessions) if (!tokens.has(session.discordId)) tokens.set(session.discordId, session.accessToken);
  const checked = await Promise.all(page.map(async (row) => {
    const token = tokens.get(row.userId);
    if (!token || !row.revision) return null;
    try {
      if (!(await memberGuilds(token)).some((guild) => guild.id === guildId)) return null;
      return row;
    }
    catch { return null; }
  }));
  // The viewer may have left or lost access while owner memberships were checked.
  if (!(await memberGuilds(viewerToken)).some((guild) => guild.id === guildId)) throw new Error("Not a member.");
  // Recheck all grants together after every membership lookup has finished.
  const current = await prisma.$queryRaw<{ userId: string; provider: string; providerId: string; revision: string; label: string; url: string }[]>`
    SELECT a."userId", a."provider", a."providerId", r."revision", a."label", a."url"
    FROM "PersonalSocialVisibility" v JOIN "PersonalSocialAccount" a ON a."userId" = v."userId" AND a."provider" = v."provider"
    JOIN "PersonalSocialRevision" r ON r."userId" = a."userId" AND r."provider" = a."provider"
    WHERE v."guildId" = ${guildId}
      AND (${providerFilter} = '' OR a."provider" = ${providerFilter})
      AND (${afterUser} = '' OR a."userId" > ${afterUser} OR (a."userId" = ${afterUser} AND a."provider" > ${afterProvider}))
    ORDER BY a."userId", a."provider" LIMIT 21`;
  const verified = new Map(checked.filter((entry) => entry !== null)
    .map((row) => [`${row.userId}:${row.provider}`, row]));
  const accounts = current.flatMap((row) => {
    const previous = verified.get(`${row.userId}:${row.provider}`);
    return previous && previous.providerId === row.providerId && previous.revision === row.revision
      ? [{ userId: row.userId, provider: row.provider, label: row.label, url: row.url }] : [];
  });
  const last = page[page.length - 1];
  return {
    accounts,
    nextCursor: rows.length > 20 && last ? encodeDirectoryCursor(last.userId, last.provider, guildId, filter) : null,
  };
}
