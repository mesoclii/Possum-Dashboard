import { NextRequest, NextResponse } from "next/server";
import { buildServerBotApiHeaders, fetchServerBotApi, readServerBotApiJson, SERVER_BOT_API } from "@/lib/botApiServer";
import { enforceDashboardRateLimit } from "@/lib/rateLimiter";
import { DASHBOARD_SESSION_COOKIE, readDashboardSessionValue } from "@/lib/session";
import { readPublicGamingGuestId } from "@/lib/publicGamingGuest";

export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "no-store, private" };
const cursorPattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z~[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
function reply(data: unknown, status = 200) { return NextResponse.json(data, { status, headers }); }

function unavailableError(value: unknown, fallback: string) {
  const known = [
    "Unexpected public LFG files; storage was not modified.",
    "Unexpected public LFG journal; storage was not modified.",
    "Unrecognized public LFG database; storage was not modified.",
    "Public LFG is busy; retry.",
  ];
  return typeof value === "string" && known.includes(value) ? value : fallback;
}

async function hasOwnListings(userId: string) {
  if (!userId) return false;
  const upstream = await fetchServerBotApi(`${SERVER_BOT_API}/internal/public-lfg?me=1`, {
    headers: buildServerBotApiHeaders(userId), cache: "no-store",
  }).catch(() => null);
  if (!upstream?.ok) return false;
  const data = await readServerBotApiJson(upstream).catch(() => null);
  return data?.success === true && Array.isArray(data.listings) && data.listings.length > 0;
}

async function actor(request: NextRequest) {
  const session = await readDashboardSessionValue(request.cookies.get(DASHBOARD_SESSION_COOKIE)?.value);
  const sessionDiscordId = String(session?.user?.id || "");
  const discordId = /^\d{16,20}$/.test(sessionDiscordId) ? sessionDiscordId : "";
  const guestId = readPublicGamingGuestId(request);
  if (guestId && discordId) {
    if (await hasOwnListings(guestId)) return guestId;
    if (await hasOwnListings(discordId)) return discordId;
  }
  return guestId || discordId;
}

function listing(value: any, own = false) {
  if (!value || typeof value.id !== "string" || typeof value.game !== "string" ||
      typeof value.mode !== "string" || typeof value.platform !== "string" || typeof value.note !== "string" ||
      typeof value.capacity !== "number" || typeof value.createdAt !== "string" || typeof value.expiresAt !== "string" ||
      !["open", "full"].includes(value.status) || !Array.isArray(value.members) ||
      value.members.some((member: any) => !member || typeof member.nickname !== "string" || typeof member.contact !== "string")) return null;
  return {
    id: value.id, game: value.game, mode: value.mode, platform: value.platform, note: value.note,
    capacity: value.capacity, createdAt: value.createdAt, expiresAt: value.expiresAt, status: value.status,
    members: value.members.map((member: any) => ({ nickname: member.nickname, contact: member.contact })),
    ...(own ? { isHost: value.isHost === true, isMember: value.isMember === true } : {}),
  };
}

async function readBody(request: NextRequest) {
  const reader = request.body?.getReader();
  if (!reader) return null;
  const decoder = new TextDecoder();
  let text = "", bytes = 0;
  while (true) {
    const chunk = await reader.read();
    if (chunk.done) break;
    bytes += chunk.value.byteLength;
    if (bytes > 4096) { await reader.cancel(); throw new Error("body_too_large"); }
    text += decoder.decode(chunk.value, { stream: true });
  }
  try { return JSON.parse(text + decoder.decode()); } catch { return null; }
}

export async function GET(request: NextRequest) {
  try {
    await enforceDashboardRateLimit(request, "public_lfg_read");
    const own = request.nextUrl.searchParams.get("me") === "1";
    const cursors = request.nextUrl.searchParams.getAll("cursor");
    const cursor = cursors[0];
    if (cursors.length > 1 || (cursors.length && (own || !cursorPattern.test(cursor)))) return reply({ success: false, error: "Invalid listing cursor." }, 400);
    const user = own ? await actor(request) : "";
    if (own && !user) return reply({ success: false, error: "Sign in to manage your listings." }, 401);
    const query = own ? "?me=1" : cursor ? `?cursor=${encodeURIComponent(cursor)}` : "";
    const upstream = await fetchServerBotApi(`${SERVER_BOT_API}/internal/public-lfg${query}`, {
      headers: buildServerBotApiHeaders(user), cache: "no-store",
    });
    const data = await readServerBotApiJson(upstream);
    if (!upstream.ok || data?.success !== true) {
      if (upstream.status === 400) return reply({ success: false, error: "Invalid listing cursor." }, 400);
      return reply({ success: false, error: unavailableError(data?.error, "Public LFG is unavailable.") }, 503);
    }
    return reply({ success: true, listings: Array.isArray(data.listings) ? data.listings.map((item: any) => listing(item, own)).filter(Boolean) : [],
      nextCursor: !own && typeof data.nextCursor === "string" && cursorPattern.test(data.nextCursor) ? data.nextCursor : null });
  } catch { return reply({ success: false, error: "Public LFG is unavailable or rate limited." }, 503); }
}

export async function POST(request: NextRequest) {
  try {
    await enforceDashboardRateLimit(request, "public_lfg_write");
    const origin = request.headers.get("origin") || "";
    const host = request.headers.get("host") || "";
    let parsed: URL | null = null;
    try { parsed = new URL(origin); } catch {}
    if (!host || !parsed || !["http:", "https:"].includes(parsed.protocol) || parsed.host !== host || request.headers.get("sec-fetch-site") === "cross-site") {
      return reply({ success: false, error: "Same-origin request required." }, 403);
    }
    const user = await actor(request);
    if (!user) return reply({ success: false, error: "Sign in to manage your listings." }, 401);
    if (!(request.headers.get("content-type") || "").toLowerCase().startsWith("application/json")) return reply({ success: false, error: "JSON required." }, 415);
    let body;
    try { body = await readBody(request); } catch { return reply({ success: false, error: "Request is too large." }, 413); }
    if (!body || !["post", "join", "leave", "close"].includes(body.action)) return reply({ success: false, error: "Invalid action." }, 400);
    const upstream = await fetchServerBotApi(`${SERVER_BOT_API}/internal/public-lfg`, {
      method: "POST", headers: { ...buildServerBotApiHeaders(user), "Content-Type": "application/json" },
      body: JSON.stringify({ action: body.action, id: body.id, consent: body.consent, nickname: body.nickname, contact: body.contact,
        game: body.game, mode: body.mode, platform: body.platform, note: body.note, capacity: body.capacity }),
      cache: "no-store",
    });
    const data = await readServerBotApiJson(upstream);
    if (!upstream.ok || data?.success !== true) {
      const status = [400, 403, 404, 409].includes(upstream.status) ? upstream.status : 503;
      return reply({ success: false, error: status === 503 ? unavailableError(data?.error, "Public LFG could not be updated.") : String(data?.error || "Invalid request.") }, status);
    }
    return reply({ success: true, listing: listing(data.listing) });
  } catch { return reply({ success: false, error: "Public LFG could not be updated or rate limited." }, 503); }
}
