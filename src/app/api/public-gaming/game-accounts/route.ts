import { NextRequest, NextResponse } from "next/server";
import { buildServerBotApiHeaders, fetchServerBotApi, readServerBotApiJson, SERVER_BOT_API } from "@/lib/botApiServer";
import { enforceDashboardRateLimit } from "@/lib/rateLimiter";
import { DASHBOARD_SESSION_COOKIE, readDashboardSessionValue } from "@/lib/session";
import { readPublicGamingGuestId } from "@/lib/publicGamingGuest";
import { resolvePublicGamingOwner } from "@/lib/publicGamingOwner";

export const dynamic = "force-dynamic";
const responseHeaders = { "Cache-Control": "no-store, private", "X-Content-Type-Options": "nosniff" };
const providers = new Set(["steam", "battlenet", "epic", "xbox", "bungie"]);

function reply(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: responseHeaders });
}

async function actor(request: NextRequest) {
  const guestId = readPublicGamingGuestId(request);
  const session = await readDashboardSessionValue(request.cookies.get(DASHBOARD_SESSION_COOKIE)?.value);
  const sessionId = String(session?.user?.id || "").trim();
  const discordId = /^\d{16,20}$/.test(sessionId) ? sessionId : "";
  return resolvePublicGamingOwner(guestId, discordId);
}

function sameOrigin(request: NextRequest) {
  const host = request.headers.get("host") || "";
  let origin: URL;
  try { origin = new URL(request.headers.get("origin") || ""); } catch { return false; }
  return Boolean(host && origin.host === host && ["http:", "https:"].includes(origin.protocol) &&
    (process.env.NODE_ENV !== "production" || origin.protocol === "https:") &&
    request.headers.get("sec-fetch-site") !== "cross-site");
}

function safeAccounts(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry: any) => {
    const provider = String(entry?.provider || "").trim().toLowerCase();
    const label = String(entry?.label || "").trim().slice(0, 40);
    const url = String(entry?.url || "").trim();
    if (!providers.has(provider) || !label || entry?.verified !== true) return [];
    if (url) {
      try {
        const parsed = new URL(url);
        if (parsed.protocol !== "https:" || !parsed.hostname || parsed.username || parsed.password || parsed.href.length > 300) return [];
        return [{ provider, label, url: parsed.href, verified: true }];
      } catch { return []; }
    }
    return [{ provider, label, url: "", verified: true }];
  });
}

async function readBody(request: NextRequest) {
  const reader = request.body?.getReader();
  if (!reader) return null;
  const decoder = new TextDecoder();
  let text = "";
  let size = 0;
  while (true) {
    const chunk = await reader.read();
    if (chunk.done) break;
    size += chunk.value.byteLength;
    if (size > 4096) { await reader.cancel(); throw new Error("body_too_large"); }
    text += decoder.decode(chunk.value, { stream: true });
  }
  try { return JSON.parse(text + decoder.decode()); } catch { return null; }
}

export async function GET(request: NextRequest) {
  try {
    await enforceDashboardRateLimit(request, "public_gaming_accounts_read");
    const userId = await actor(request);
    if (!userId) return reply({ success: false, error: "Create a private Gaming Hub profile first." }, 401);
    const upstream = await fetchServerBotApi(`${SERVER_BOT_API}/internal/public-gaming/linked-accounts/me`, {
      headers: buildServerBotApiHeaders(userId), cache: "no-store",
    });
    const data = await readServerBotApiJson(upstream);
    if (!upstream.ok || data?.success !== true) return reply({ success: false, error: "Game accounts are unavailable." }, 503);
    return reply({ success: true, accounts: safeAccounts(data.accounts) });
  } catch {
    return reply({ success: false, error: "Game accounts are unavailable or rate limited." }, 503);
  }
}

export async function POST(request: NextRequest) {
  try {
    await enforceDashboardRateLimit(request, "public_gaming_accounts_write");
    if (!sameOrigin(request)) return reply({ success: false, error: "Same-origin request required." }, 403);
    if (!(request.headers.get("content-type") || "").toLowerCase().startsWith("application/json")) return reply({ success: false, error: "JSON required." }, 415);
    const userId = await actor(request);
    if (!userId) return reply({ success: false, error: "Create a private Gaming Hub profile first." }, 401);
    let body: any;
    try { body = await readBody(request); } catch { return reply({ success: false, error: "Request is too large." }, 413); }
    if (!body || body.action !== "unlink" || !providers.has(String(body.provider || "").trim().toLowerCase())) {
      return reply({ success: false, error: "Choose a supported linked account to remove." }, 400);
    }
    const provider = String(body.provider).trim().toLowerCase();
    const upstream = await fetchServerBotApi(`${SERVER_BOT_API}/internal/public-gaming/linked-accounts/${encodeURIComponent(provider)}`, {
      method: "DELETE", headers: buildServerBotApiHeaders(userId), cache: "no-store",
    });
    const data = await readServerBotApiJson(upstream);
    if (!upstream.ok || data?.success !== true) return reply({ success: false, error: upstream.status === 400 ? String(data?.error || "Could not unlink account.") : "Could not unlink account." }, upstream.status === 400 ? 400 : 503);
    return reply({ success: true, accounts: safeAccounts(data.accounts) });
  } catch {
    return reply({ success: false, error: "Could not unlink the game account or request was rate limited." }, 503);
  }
}
