import type { NextApiRequest, NextApiResponse } from "next";
import { SERVER_BOT_API, buildServerBotApiHeaders, fetchServerBotApi, readServerBotApiJson } from "@/lib/botApiServer";
import { readActorUserId } from "@/lib/botApi";
import { getConfiguredGameAuthOrigin } from "@/lib/gameAuthOrigin";
import { readPublicGamingGuestIdFromCookie } from "@/lib/publicGamingGuest";

function readFirst(value: string | string[] | undefined) {
  return String(Array.isArray(value) ? value[0] : value || "").trim();
}

function redirectError(res: NextApiResponse, provider: string, message: string) {
  const target = new URL("/gaming?tab=directory", "http://local.invalid");
  target.searchParams.set("providerAuth", "error");
  target.searchParams.set("provider", provider || "unknown");
  target.searchParams.set("authMessage", String(message || "Could not start provider linking.").slice(0, 180));
  return res.redirect(302, `${target.pathname}${target.search}`);
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ success: false, error: "Method not allowed." });
  }
  const providerKey = readFirst(req.query.provider as string | string[] | undefined).toLowerCase();
  const origin = getConfiguredGameAuthOrigin(req);
  const actorId = await readActorUserId(req).catch(() => "") || readPublicGamingGuestIdFromCookie(req.cookies.possum_gaming_guest);
  if (!actorId) return redirectError(res, providerKey, "Your private Gaming Hub profile is unavailable. Return to the Gaming Hub and try again.");
  if (!origin) return redirectError(res, providerKey, "This site is not configured as an approved provider callback origin.");

  try {
    const response = await fetchServerBotApi(`${SERVER_BOT_API}/internal/public-gaming/provider-auth/start`, {
      method: "POST",
      headers: { ...buildServerBotApiHeaders(actorId, { allowFallback: false }), "Content-Type": "application/json" },
      body: JSON.stringify({ providerKey, callbackBaseUrl: origin, returnPath: "/gaming?tab=directory" }),
    });
    const json = await readServerBotApiJson(response);
    if (!response.ok || json?.success !== true || !json?.authorizeUrl) {
      return redirectError(res, providerKey, json?.error || `Could not start ${providerKey} linking.`);
    }
    return res.redirect(302, String(json.authorizeUrl));
  } catch (error: any) {
    return redirectError(res, providerKey, error?.message || "Could not reach the provider-link service.");
  }
}
