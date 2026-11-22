import { NextRequest, NextResponse } from "next/server";
import { buildServerBotApiHeaders, fetchServerBotApi, readServerBotApiJson, SERVER_BOT_API } from "@/lib/botApiServer";
import { enforceDashboardRateLimit } from "@/lib/rateLimiter";
import { DASHBOARD_SESSION_COOKIE, readDashboardSessionValue } from "@/lib/session";

export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "no-store, private" };

function reply(data: unknown, status = 200) {
  return NextResponse.json(data, { status, headers });
}

async function actor(request: NextRequest) {
  const session = await readDashboardSessionValue(request.cookies.get(DASHBOARD_SESSION_COOKIE)?.value);
  return String(session?.user?.id || "").trim();
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
  return { nickname: value.nickname, game: value.game, contactHandle: typeof value.contactHandle === "string" ? value.contactHandle : "", accounts };
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
    const userId = own ? await actor(request) : "";
    if (own && !userId) return reply({ success: false, error: "Sign in to manage your public profile." }, 401);
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
    const userId = await actor(request);
    if (!userId) return reply({ success: false, error: "Sign in to manage your public profile." }, 401);
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
      headers: { ...buildServerBotApiHeaders(userId), "Content-Type": "application/json" },
      body: JSON.stringify({ action: body.action, consent: body.consent, nickname: body.nickname, game: body.game, contactHandle: body.contactHandle, accounts: body.accounts }),
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
