import { NextRequest, NextResponse } from "next/server";
import { buildServerBotApiHeaders, fetchServerBotApi, readServerBotApiJson, SERVER_BOT_API } from "@/lib/botApiServer";
import { enforceDashboardRateLimit } from "@/lib/rateLimiter";
import { attachPublicGamingGuestCookie, publicGamingActor } from "@/lib/publicGamingGuest";

export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "no-store, private" };

function reply(data: unknown, status = 200) {
  return NextResponse.json(data, { status, headers });
}

function profile(value: any) {
  if (!value || typeof value.nickname !== "string" || typeof value.game !== "string") return null;
  const accounts = Array.isArray(value.accounts) ? value.accounts.flatMap((entry: any) => {
    if (!entry || typeof entry.label !== "string" || entry.label.length < 1 || entry.label.length > 40 ||
        typeof entry.url !== "string" || entry.url.length > 300) return [];
    try {
      const url = new URL(entry.url);
      if (url.protocol !== "https:" || !url.hostname || url.username || url.password) return [];
      return [{ label: entry.label, url: url.href }];
    } catch {
      return [];
    }
  }).slice(0, 8) : [];
  const gameStats = Array.isArray(value.gameStats) ? value.gameStats.flatMap((entry: any) => {
    if (!entry || typeof entry.game !== "string" || entry.game.length > 80 ||
        typeof entry.platform !== "string" || entry.platform.length > 40 ||
        typeof entry.progress !== "string" || entry.progress.length > 120 ||
        typeof entry.hours !== "number" || !Number.isFinite(entry.hours) || entry.hours < 0 || entry.hours > 100000) return [];
    return [{ game: entry.game, platform: entry.platform, hours: entry.hours, progress: entry.progress }];
  }).slice(0, 20) : [];
  return { nickname: value.nickname, game: value.game, contactHandle: typeof value.contactHandle === "string" ? value.contactHandle : "", accounts, gameStats };
}

async function readBody(request: NextRequest) {
  const reader = request.body?.getReader();
  if (!reader) return null;
  const decoder = new TextDecoder();
  let text = "";
  let bytes = 0;
  while (true) {
    const chunk = await reader.read();
    if (chunk.done) break;
    bytes += chunk.value.byteLength;
    if (bytes > 4096) {
      await reader.cancel();
      throw new Error("body_too_large");
    }
    text += decoder.decode(chunk.value, { stream: true });
  }
  try { return JSON.parse(text + decoder.decode()); } catch { return null; }
}

export async function GET(request: NextRequest) {
  try {
    await enforceDashboardRateLimit(request, "public_gaming_read");
    const own = request.nextUrl.searchParams.get("me") === "1";
    const actor = own ? await publicGamingActor(request, true) : null;
    if (own && !actor) return reply({ success: false, error: "A public Gaming Hub account could not be created." }, 503);
    const upstream = await fetchServerBotApi(`${SERVER_BOT_API}/internal/public-gaming${own ? "/me" : ""}`, {
      headers: buildServerBotApiHeaders(actor?.id || ""),
      cache: "no-store",
    });
    const data = await readServerBotApiJson(upstream);
    if (!upstream.ok || data?.success !== true) return reply({ success: false, error: "Public Gaming Hub is unavailable." }, 503);
    if (own) return attachPublicGamingGuestCookie(reply({ success: true, profile: profile(data.profile) }), actor, request);
    return reply({ success: true, profiles: Array.isArray(data.profiles) ? data.profiles.map(profile).filter(Boolean) : [] });
  } catch {
    return reply({ success: false, error: "Public Gaming Hub is unavailable or rate limited." }, 503);
  }
}

export async function POST(request: NextRequest) {
  try {
    await enforceDashboardRateLimit(request, "public_gaming_write");
    const origin = request.headers.get("origin") || "";
    const host = request.headers.get("host") || "";
    let originHost = "";
    try { originHost = new URL(origin).host; } catch {}
    if (!host || !originHost || originHost !== host || request.headers.get("sec-fetch-site") === "cross-site") {
      return reply({ success: false, error: "Same-origin request required." }, 403);
    }
    const actor = await publicGamingActor(request, true);
    if (!actor) return reply({ success: false, error: "A public Gaming Hub account is unavailable." }, 503);
    if (!(request.headers.get("content-type") || "").toLowerCase().startsWith("application/json")) {
      return reply({ success: false, error: "JSON required." }, 415);
    }
    let body;
    try { body = await readBody(request); } catch { return reply({ success: false, error: "Request is too large." }, 413); }
    if (!body || (body.action !== "publish" && body.action !== "revoke")) {
      return reply({ success: false, error: "Invalid action." }, 400);
    }
    const upstream = await fetchServerBotApi(`${SERVER_BOT_API}/internal/public-gaming/me`, {
      method: "POST",
      headers: { ...buildServerBotApiHeaders(actor.id), "Content-Type": "application/json" },
      body: JSON.stringify({ action: body.action, consent: body.consent, nickname: body.nickname, game: body.game, contactHandle: body.contactHandle, accounts: body.accounts, gameStats: body.gameStats }),
      cache: "no-store",
    });
    const data = await readServerBotApiJson(upstream);
    if (!upstream.ok || data?.success !== true) {
      return reply({ success: false, error: upstream.status === 400 ? String(data?.error || "Invalid profile.") : "Public profile could not be updated." }, upstream.status === 400 ? 400 : 503);
    }
    return attachPublicGamingGuestCookie(reply({ success: true, profile: profile(data.profile) }), actor, request);
  } catch {
    return reply({ success: false, error: "Public profile could not be updated or rate limited." }, 503);
  }
}
