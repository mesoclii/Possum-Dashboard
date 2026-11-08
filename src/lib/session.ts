import crypto from "node:crypto";
import prisma from "@/lib/prisma";

export const DASHBOARD_SESSION_COOKIE = "possum_dashboard_session";
export const DASHBOARD_OAUTH_STATE_COOKIE = "possum_dashboard_oauth_state";
export const DASHBOARD_RETURN_TO_COOKIE = "possum_dashboard_return_to";

export function dashboardOAuthStateCookieName(state: string) {
  const suffix = crypto.createHash("sha256").update(state).digest("hex");
  return `${DASHBOARD_OAUTH_STATE_COOKIE}_${suffix}`;
}

export function dashboardReturnToCookieName(state: string) {
  const suffix = crypto.createHash("sha256").update(state).digest("hex");
  return `${DASHBOARD_RETURN_TO_COOKIE}_${suffix}`;
}

export type DashboardDiscordUser = {
  id: string;
  username: string;
  globalName: string | null;
  avatar: string | null;
};

export type DashboardSession = {
  id?: string;
  user: DashboardDiscordUser;
  accessToken: string;
  refreshToken?: string | null;
  expiresAt: number;
};

function getSessionSecret() {
  const secret = String(process.env.SESSION_SECRET || "").trim();
  if (!secret) {
    throw new Error("SESSION_SECRET is not configured.");
  }
  return secret;
}

function sign(value: string) {
  return crypto.createHmac("sha256", getSessionSecret()).update(value).digest("base64url");
}

function safeJsonParse(input: string): DashboardSession | null {
  try {
    return JSON.parse(input) as DashboardSession;
  } catch {
    return null;
  }
}

export function isDashboardSessionConfigured() {
  return Boolean(String(process.env.SESSION_SECRET || "").trim());
}

function buildSignedCookieValue(payloadValue: string) {
  const payload = Buffer.from(payloadValue, "utf8").toString("base64url");
  const signature = sign(payload);
  return `${payload}.${signature}`;
}

function parseSignedCookieValue(rawValue: string | undefined | null) {
  if (!rawValue) return null;

  const split = rawValue.split(".");
  if (split.length !== 2) return null;

  const [payload, signature] = split;
  const expected = sign(payload);

  const signatureBuffer = Buffer.from(signature, "utf8");
  const expectedBuffer = Buffer.from(expected, "utf8");

  if (
    signatureBuffer.length !== expectedBuffer.length ||
    !crypto.timingSafeEqual(signatureBuffer, expectedBuffer)
  ) {
    return null;
  }

  return Buffer.from(payload, "base64url").toString("utf8");
}

function readLegacyDashboardSession(rawValue: string | undefined | null) {
  const json = parseSignedCookieValue(rawValue);
  if (!json || json.startsWith("v2:")) return null;
  const session = safeJsonParse(json);
  if (!session) return null;
  if (!session.accessToken || !session.user?.id) return null;
  if (!Number.isFinite(session.expiresAt) || session.expiresAt <= Date.now()) return null;
  return session;
}

export async function createDashboardSessionValue(session: DashboardSession) {
  const stored = await prisma.dashboardSession.create({
    data: {
      discordId: String(session.user.id),
      username: String(session.user.username || "Discord User"),
      globalName: session.user.globalName || null,
      avatar: session.user.avatar || null,
      accessToken: String(session.accessToken),
      refreshToken: session.refreshToken || null,
      expiresAt: new Date(session.expiresAt),
    },
  });

  return buildSignedCookieValue(`v2:${stored.id}`);
}

export async function readDashboardSessionValue(rawValue: string | undefined | null) {
  const payload = parseSignedCookieValue(rawValue);
  if (!payload) return null;

  if (!payload.startsWith("v2:")) {
    return readLegacyDashboardSession(rawValue);
  }

  const sessionId = String(payload.slice(3) || "").trim();
  if (!sessionId) return null;

  const stored = await prisma.dashboardSession.findUnique({
    where: { id: sessionId },
  }).catch(() => null);

  if (!stored) return null;
  if (stored.expiresAt.getTime() <= Date.now()) {
    await prisma.dashboardSession.delete({ where: { id: sessionId } }).catch(() => null);
    return null;
  }

  return {
    id: stored.id,
    user: {
      id: stored.discordId,
      username: stored.username,
      globalName: stored.globalName,
      avatar: stored.avatar,
    },
    accessToken: stored.accessToken,
    refreshToken: stored.refreshToken,
    expiresAt: stored.expiresAt.getTime(),
  } satisfies DashboardSession;
}

export async function destroyDashboardSession(rawValue: string | undefined | null) {
  const payload = parseSignedCookieValue(rawValue);
  if (!payload) return false;
  if (!payload.startsWith("v2:")) return true;
  const sessionId = String(payload.slice(3) || "").trim();
  if (!sessionId) return false;
  await prisma.dashboardSession.delete({ where: { id: sessionId } }).catch(() => null);
  return true;
}

export function createOauthState() {
  return crypto.randomBytes(24).toString("hex");
}

export function sanitizeDashboardReturnTo(rawValue: string | undefined | null) {
  const value = String(rawValue || "").trim();
  if (!value) return "/guilds";
  if (!value.startsWith("/") || value.startsWith("//")) return "/guilds";
  return value;
}

export function shouldUseSecureCookies() {
  return String(process.env.DISCORD_REDIRECT_URI || "").trim().startsWith("https://");
}
