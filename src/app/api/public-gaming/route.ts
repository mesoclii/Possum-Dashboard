import { NextRequest, NextResponse } from "next/server";
import { buildServerBotApiHeaders, fetchServerBotApi, readServerBotApiJson, SERVER_BOT_API } from "@/lib/botApiServer";
import { enforceDashboardRateLimit } from "@/lib/rateLimiter";
import { DASHBOARD_SESSION_COOKIE, readDashboardSessionValue } from "@/lib/session";
import { readPublicGamingGuestId } from "@/lib/publicGamingGuest";

export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "no-store, private" };

function reply(data: unknown, status = 200) {
  return NextResponse.json(data, { status, headers });
}

async function readOwnProfile(userId: string) {
  if (!userId) return null;
  const upstream = await fetchServerBotApi(`${SERVER_BOT_API}/internal/public-gaming/me`, {
    headers: buildServerBotApiHeaders(userId),
    cache: "no-store",
  }).catch(() => null);
  if (!upstream?.ok) return null;
  const data = await readServerBotApiJson(upstream).catch(() => null);
  return data?.success === true ? profile(data.profile) : null;
}

async function actor(request: NextRequest) {
  const session = await readDashboardSessionValue(request.cookies.get(DASHBOARD_SESSION_COOKIE)?.value);
  const sessionDiscordId = String(session?.user?.id || "");
  const discordId = /^\d{16,20}$/.test(sessionDiscordId) ? sessionDiscordId : "";
  const guestId = readPublicGamingGuestId(request);
  if (guestId && discordId) {
    // Keep a browser's anonymous profile stable if its owner optionally signs in
    // to show a Discord username. Existing Discord-only profiles still resolve.
    if (await readOwnProfile(guestId)) return { userId: guestId, session };
    if (await readOwnProfile(discordId)) return { userId: discordId, session };
  }
  return { userId: guestId || discordId, session };
}

function profile(value: any) {
  if (!value || typeof value.nickname !== "string" || typeof value.game !== "string") return null;
  return {
    nickname: value.nickname,
    game: value.game,
    contactHandle: typeof value.contactHandle === "string" ? value.contactHandle : "",
    discordTag: typeof value.discordTag === "string" ? value.discordTag : "",
    accounts: Array.isArray(value.accounts) ? value.accounts.filter((item: any) => item && typeof item.label === "string" && typeof item.url === "string").slice(0, 8) : [],
    gameStats: Array.isArray(value.gameStats) ? value.gameStats.filter((item: any) => item && typeof item.game === "string" && typeof item.platform === "string" && typeof item.progress === "string" && typeof item.hours === "number").slice(0, 20) : [],
  };
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
    if (bytes > 32768) {
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
    const identity = own ? await actor(request) : { userId: "", session: null };
    const userId = identity.userId;
    if (own && !userId) return reply({ success: false, error: "Create a private Gaming Hub profile session first." }, 401);
    const upstream = await fetchServerBotApi(`${SERVER_BOT_API}/internal/public-gaming${own ? "/me" : ""}`, {
      headers: buildServerBotApiHeaders(userId),
      cache: "no-store",
    });
    const data = await readServerBotApiJson(upstream);
    if (!upstream.ok || data?.success !== true) return reply({ success: false, error: "Public Gaming Hub is unavailable." }, 503);
    if (own) return reply({ success: true, profile: profile(data.profile) });
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
    const identity = await actor(request);
    const userId = identity.userId;
    if (!userId) return reply({ success: false, error: "Create a private Gaming Hub profile session first." }, 401);
    if (!(request.headers.get("content-type") || "").toLowerCase().startsWith("application/json")) {
      return reply({ success: false, error: "JSON required." }, 415);
    }
    let body;
    try { body = await readBody(request); } catch { return reply({ success: false, error: "Request is too large." }, 413); }
    if (!body || (body.action !== "publish" && body.action !== "revoke")) {
      return reply({ success: false, error: "Invalid action." }, 400);
    }
    const shareDiscordTag = Boolean(identity.session?.user?.id) && body.shareDiscordTag === true;
    const discordTag = shareDiscordTag ? String(identity.session?.user?.username || "") : "";
    const upstream = await fetchServerBotApi(`${SERVER_BOT_API}/internal/public-gaming/me`, {
      method: "POST",
      headers: { ...buildServerBotApiHeaders(userId), "Content-Type": "application/json" },
      body: JSON.stringify({
        action: body.action,
        consent: body.consent,
        nickname: body.nickname,
        game: body.game,
        contactHandle: body.contactHandle,
        accounts: Array.isArray(body.accounts) ? body.accounts.filter((item: any) => String(item?.label || "").trim() || String(item?.url || "").trim()) : body.accounts,
        gameStats: Array.isArray(body.gameStats) ? body.gameStats.filter((item: any) => String(item?.game || "").trim() || String(item?.platform || "").trim() || String(item?.progress || "").trim() || Number(item?.hours) > 0) : body.gameStats,
        shareDiscordTag,
        discordTag,
      }),
      cache: "no-store",
    });
    const data = await readServerBotApiJson(upstream);
    if (!upstream.ok || data?.success !== true) {
      return reply({ success: false, error: upstream.status === 400 ? String(data?.error || "Invalid profile.") : "Public profile could not be updated." }, upstream.status === 400 ? 400 : 503);
    }
    return reply({ success: true, profile: profile(data.profile) });
  } catch {
    return reply({ success: false, error: "Public profile could not be updated or rate limited." }, 503);
  }
}
