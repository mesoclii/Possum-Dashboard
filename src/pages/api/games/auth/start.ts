import type { NextApiRequest, NextApiResponse } from "next";
import { SERVER_BOT_API, buildServerBotApiHeaders, fetchServerBotApi, readServerBotApiJson } from "@/lib/botApiServer";
import { readActorUserId } from "@/lib/botApi";
import { getConfiguredGameAuthOrigin } from "@/lib/gameAuthOrigin";

function getRequestOrigin(req: NextApiRequest): string {
  return getConfiguredGameAuthOrigin(req);
}

function buildFallbackReturnPath(guildId: string, userId: string) {
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

  const guildId = String(req.query.guildId || "").trim();
  const providerKey = String(req.query.provider || req.query.providerKey || "").trim();
  const platform = String(req.query.platform || "").trim();
  const userId = await readActorUserId(req);
  const origin = getRequestOrigin(req);
  const fallbackReturnPath = buildFallbackReturnPath(guildId, userId);
  const returnPath = String(req.query.returnPath || req.query.returnTo || fallbackReturnPath).trim() || fallbackReturnPath;

  if (!guildId || !providerKey || !userId || !origin) {
    return res.redirect(302, appendError(fallbackReturnPath, providerKey || "unknown", "Missing guild, provider, user, or dashboard origin."));
  }

  try {
    const response = await fetchServerBotApi(`${SERVER_BOT_API}/api/game-provider-auth/start`, {
      method: "POST",
      headers: { ...buildServerBotApiHeaders(userId, { allowFallback: false }), "Content-Type": "application/json" },
      body: JSON.stringify({
        guildId,
        userId,
        providerKey,
        platform,
        callbackBaseUrl: origin,
        returnPath,
      }),
    });
    const json = await readServerBotApiJson(response);
    if (!response.ok || json?.success === false || !json?.authorizeUrl) {
      return res.redirect(302, appendError(returnPath || fallbackReturnPath, providerKey, json?.error || `Failed to start ${providerKey} login.`));
    }
    return res.redirect(302, String(json.authorizeUrl));
  } catch (error: any) {
    return res.redirect(302, appendError(returnPath || fallbackReturnPath, providerKey, error?.message || "Failed to start provider login."));
  }
}
