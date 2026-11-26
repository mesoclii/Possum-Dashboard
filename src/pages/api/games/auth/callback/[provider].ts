import type { NextApiRequest, NextApiResponse } from "next";
import {
  SERVER_BOT_API,
  buildServerBotApiHeaders,
  fetchServerBotApi,
  readServerBotApiJson,
} from "@/lib/botApiServer";
import { readActorUserId } from "@/lib/botApi";
import { getConfiguredGameAuthOrigin } from "@/lib/gameAuthOrigin";
import { readPublicGamingGuestIdFromCookie } from "@/lib/publicGamingGuest";

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

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ success: false, error: "Method not allowed" });
  }

  const providerKey = readFirst((req.query.provider as string | string[] | undefined) || (req.query.providerKey as string | string[] | undefined));
  const origin = getRequestOrigin(req);
  const actorUserId = await readActorUserId(req);
  const state = readFirst(req.query.state as string | string[] | undefined);
  const isPublicGamingFlow = /^g[a-f0-9]{32}$/i.test(state);
  const publicGamingUserId = actorUserId || readPublicGamingGuestIdFromCookie(req.cookies.possum_gaming_guest);
  const fallback = isPublicGamingFlow ? "/gaming?tab=directory" : fallbackPath(req, actorUserId);

  if (!providerKey || !origin || (isPublicGamingFlow ? !publicGamingUserId : !actorUserId)) {
    return res.redirect(302, appendError(fallback, providerKey || "unknown", isPublicGamingFlow
      ? "Return to the Gaming Hub in the same browser to finish linking this account."
      : "A valid dashboard session, provider, and origin are required."));
  }

  try {
    const response = await fetchServerBotApi(isPublicGamingFlow
      ? `${SERVER_BOT_API}/internal/public-gaming/provider-auth/callback/${encodeURIComponent(providerKey)}`
      : `${SERVER_BOT_API}/api/game-provider-auth/callback`, {
      method: "POST",
      headers: {
        ...buildServerBotApiHeaders(isPublicGamingFlow ? publicGamingUserId : actorUserId, { allowFallback: false }),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        providerKey,
        callbackBaseUrl: origin,
        query: req.query,
        ...(isPublicGamingFlow ? { publicGamingUserId } : {}),
      }),
    });
    const json = await readServerBotApiJson(response);
    const redirectPath = String(json?.redirectPath || fallback).trim() || fallback;
    if (!response.ok || json?.success === false) {
      return res.redirect(302, appendError(redirectPath || fallback, providerKey, json?.error || `Failed to finish ${providerKey} login.`));
    }
    return res.redirect(302, redirectPath);
  } catch (error: any) {
    return res.redirect(302, appendError(fallback, providerKey, error?.message || "Failed to finish provider login."));
  }
}
