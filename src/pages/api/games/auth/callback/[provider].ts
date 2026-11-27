import type { NextApiRequest, NextApiResponse } from "next";
import {
  SERVER_BOT_API,
  buildServerBotApiHeaders,
  fetchServerBotApi,
  readServerBotApiJson,
} from "@/lib/botApiServer";
import { readActorUserId } from "@/lib/botApi";
import { getConfiguredGameAuthOrigin } from "@/lib/gameAuthOrigin";
import { deleteServerCachePrefix } from "@/lib/serverCache";
import { PUBLIC_GAMING_GUEST_COOKIE, readPublicGamingGuestIdFromValue } from "@/lib/publicGamingGuest";
import { resolvePublicGamingOwner } from "@/lib/publicGamingOwner";

function readFirst(value: string | string[] | undefined): string {
  return String(Array.isArray(value) ? value[0] : value || "").trim();
}

function getRequestOrigin(req: NextApiRequest): string {
  return getConfiguredGameAuthOrigin(req);
}

function fallbackPath(req: NextApiRequest, userId: string) {
  const guildId = readFirst(req.query.guildId as string | string[] | undefined);
  const params = new URLSearchParams();
  if (guildId) params.set("guildId", guildId);
  if (userId) params.set("userId", userId);
  return `/dashboard/games${params.toString() ? `?${params.toString()}` : ""}`;
}

function appendError(pathname: string, providerKey: string, message: string) {
  const url = new URL(pathname, "http://dashboard.local");
  url.searchParams.set("providerAuth", "error");
  url.searchParams.set("provider", providerKey);
  url.searchParams.set("authMessage", String(message || "Provider login failed.").slice(0, 180));
  return `${url.pathname}${url.search}${url.hash}`;
}

function safeReturnPath(value: unknown, fallback: string) {
  const candidate = String(value || "").trim();
  if (!candidate.startsWith("/") || candidate.startsWith("//")) return fallback;
  try {
    const parsed = new URL(candidate, "http://dashboard.local");
    return parsed.origin === "http://dashboard.local" ? `${parsed.pathname}${parsed.search}${parsed.hash}` : fallback;
  } catch { return fallback; }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ success: false, error: "Method not allowed" });
  }

  const providerKey = readFirst((req.query.provider as string | string[] | undefined) || (req.query.providerKey as string | string[] | undefined));
  const origin = getRequestOrigin(req);
  const guestId = readPublicGamingGuestIdFromValue(req.cookies[PUBLIC_GAMING_GUEST_COOKIE]);
  const discordId = await readActorUserId(req);
  const actorUserId = await resolvePublicGamingOwner(guestId, discordId);
  const fallback = guestId ? "/gaming" : fallbackPath(req, actorUserId);

  // The single-use OAuth state is the credential here. Requiring a dashboard
  // session too broke every login started from Discord, because the provider
  // redirects in whatever browser the user happens to use. When a session does
  // exist we still pass it through so the bot can cross-check the user.
  if (!providerKey || !origin) {
    return res.redirect(302, appendError(fallback, providerKey || "unknown", "This login link is missing its provider or dashboard origin."));
  }

  try {
    const callbackEndpoint = guestId && actorUserId === guestId
      ? `${SERVER_BOT_API}/internal/public-gaming/provider-auth/callback/${encodeURIComponent(providerKey)}`
      : `${SERVER_BOT_API}/api/game-provider-auth/callback`;
    const response = await fetchServerBotApi(callbackEndpoint, {
      method: "POST",
      headers: {
        ...buildServerBotApiHeaders(actorUserId, { allowFallback: false }),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        providerKey,
        callbackBaseUrl: origin,
        query: req.query,
      }),
    });
    const json = await readServerBotApiJson(response);
    const redirectPath = safeReturnPath(json?.redirectPath, fallback);
    if (!response.ok || json?.success === false) {
      return res.redirect(302, appendError(redirectPath || fallback, providerKey, json?.error || `Failed to finish ${providerKey} login.`));
    }
    const callbackRedirect = new URL(redirectPath, origin);
    const guildId = String(callbackRedirect.searchParams.get("guildId") || "").trim();
    if (/^\d{16,20}$/.test(guildId)) {
      deleteServerCachePrefix(`runtime-engine:${guildId}:`);
    }
    return res.redirect(302, redirectPath);
  } catch (error: any) {
    return res.redirect(302, appendError(fallback, providerKey, error?.message || "Failed to finish provider login."));
  }
}
