import type { NextApiRequest, NextApiResponse } from "next";
import { enforceDashboardRateLimit } from "@/lib/rateLimiter";
import { SERVER_BOT_API, buildServerBotApiHeaders, fetchServerBotApi, readServerBotApiJson } from "@/lib/botApiServer";
import { readActorUserId } from "@/lib/botApi";
import { getConfiguredGameAuthOrigin } from "@/lib/gameAuthOrigin";
import { PUBLIC_GAMING_GUEST_COOKIE, readPublicGamingGuestIdFromValue } from "@/lib/publicGamingGuest";
import { resolvePublicGamingOwner } from "@/lib/publicGamingOwner";

const providers = new Set(["steam", "battlenet", "epic", "xbox", "bungie"]);

function sameOrigin(req: NextApiRequest) {
  const host = String(Array.isArray(req.headers.host) ? req.headers.host[0] : req.headers.host || "");
  const rawOrigin = String(Array.isArray(req.headers.origin) ? req.headers.origin[0] : req.headers.origin || "");
  try {
    const origin = new URL(rawOrigin);
    return Boolean(host && origin.host === host && ["http:", "https:"].includes(origin.protocol) &&
      (process.env.NODE_ENV !== "production" || origin.protocol === "https:") && req.headers["sec-fetch-site"] !== "cross-site");
  } catch { return false; }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader("Cache-Control", "no-store, private");
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ success: false, error: "Method not allowed." });
  }
  try {
    await enforceDashboardRateLimit(req, "public_gaming_provider_start");
    if (!sameOrigin(req)) return res.status(403).json({ success: false, error: "Same-origin request required." });
    const guestId = readPublicGamingGuestIdFromValue(req.cookies[PUBLIC_GAMING_GUEST_COOKIE]);
    const discordId = await readActorUserId(req);
    const userId = await resolvePublicGamingOwner(guestId, discordId);
    const providerKey = String(req.body?.providerKey || "").trim().toLowerCase();
    const origin = getConfiguredGameAuthOrigin(req);
    if (!userId) return res.status(401).json({ success: false, error: "Create a private Gaming Hub profile first." });
    if (!providers.has(providerKey)) return res.status(400).json({ success: false, error: "Choose a supported game provider." });
    if (!origin) return res.status(503).json({ success: false, error: "The public Gaming Hub callback address is not configured." });
    const upstream = await fetchServerBotApi(`${SERVER_BOT_API}/internal/public-gaming/provider-auth/start`, {
      method: "POST",
      headers: { ...buildServerBotApiHeaders(userId, { allowFallback: false }), "Content-Type": "application/json" },
      body: JSON.stringify({ providerKey, callbackBaseUrl: origin, returnPath: "/gaming" }),
    });
    const data = await readServerBotApiJson(upstream);
    if (!upstream.ok || data?.success !== true || typeof data?.authorizeUrl !== "string") {
      return res.status(upstream.status === 400 ? 400 : 503).json({ success: false, error: String(data?.error || "Could not start secure provider linking.") });
    }
    let authorizeUrl: URL;
    try { authorizeUrl = new URL(data.authorizeUrl); } catch { return res.status(503).json({ success: false, error: "The provider returned an invalid authorization address." }); }
    if (authorizeUrl.protocol !== "https:" || authorizeUrl.username || authorizeUrl.password) return res.status(503).json({ success: false, error: "The provider returned an invalid authorization address." });
    return res.status(200).json({ success: true, authorizeUrl: authorizeUrl.href });
  } catch {
    return res.status(503).json({ success: false, error: "Could not start secure provider linking or request was rate limited." });
  }
}
