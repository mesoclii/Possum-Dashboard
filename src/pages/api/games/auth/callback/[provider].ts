import type { NextApiRequest, NextApiResponse } from "next";
import {
  SERVER_BOT_API,
  buildServerBotApiHeaders,
  fetchServerBotApi,
  readServerBotApiJson,
} from "@/lib/botApiServer";
import { readActorUserId } from "@/lib/botApi";
import { getConfiguredGameAuthOrigin } from "@/lib/gameAuthOrigin";

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
  const fallback = fallbackPath(req, actorUserId);

  if (!providerKey || !origin || !actorUserId) {
    return res.redirect(302, appendError(fallback, providerKey || "unknown", "A valid dashboard session, provider, and origin are required."));
  }

  try {
    const response = await fetchServerBotApi(`${SERVER_BOT_API}/api/game-provider-auth/callback`, {
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
    const redirectPath = String(json?.redirectPath || fallback).trim() || fallback;
    if (!response.ok || json?.success === false) {
      return res.redirect(302, appendError(redirectPath || fallback, providerKey, json?.error || `Failed to finish ${providerKey} login.`));
    }
    return res.redirect(302, redirectPath);
  } catch (error: any) {
    return res.redirect(302, appendError(fallback, providerKey, error?.message || "Failed to finish provider login."));
  }
}
