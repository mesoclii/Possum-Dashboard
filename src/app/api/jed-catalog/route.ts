import { NextRequest, NextResponse } from "next/server";
import { buildServerBotApiHeaders, fetchServerBotApi, readServerBotApiJson, SERVER_BOT_API } from "@/lib/botApiServer";
import { enforceDashboardRateLimit, isRateLimitError } from "@/lib/rateLimiter";
import { DASHBOARD_SESSION_COOKIE, readDashboardSessionValue } from "@/lib/session";

export const dynamic = "force-dynamic";

function reply(data: unknown, status = 200) {
  return NextResponse.json(data, { status, headers: { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } });
}

async function userId(request: NextRequest) {
  const session = await readDashboardSessionValue(request.cookies.get(DASHBOARD_SESSION_COOKIE)?.value);
  return String(session?.user?.id || "").trim();
}

async function limited(request: NextRequest, scope: string) {
  try { await enforceDashboardRateLimit(request, scope); return false; }
  catch (error) { return isRateLimitError(error); }
}

export async function GET(request: NextRequest) {
  if (await limited(request, "jed_catalog_read")) return reply({ success: false, error: "Too many catalog requests. Retry shortly." }, 429);
  const mediaId = String(request.nextUrl.searchParams.get("assetId") || "").trim();
  if (mediaId) {
    const actor = await userId(request);
    if (!actor) return reply({ success: false, error: "Sign in to view your private JED assets." }, 401);
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(mediaId)) {
      return reply({ success: false, error: "Invalid private asset." }, 400);
    }
    try {
      const upstream = await fetchServerBotApi(`${SERVER_BOT_API}/internal/jed-catalog/media/${encodeURIComponent(mediaId)}`, {
        headers: buildServerBotApiHeaders(actor), cache: "no-store",
      });
      if (!upstream.ok) {
        const data = await readServerBotApiJson(upstream);
        return reply({ success: false, error: data?.error || "Private JED asset is unavailable." }, upstream.status || 503);
      }
      const mime = upstream.headers.get("content-type") || "application/octet-stream";
      if (!/^image\/(?:png|jpeg|webp|gif)$/.test(mime)) return reply({ success: false, error: "Unsupported private asset." }, 415);
      return new NextResponse(upstream.body, { status: 200, headers: {
        "Cache-Control": "private, no-store",
        "Content-Type": mime,
        "X-Content-Type-Options": "nosniff",
      } });
    } catch {
      return reply({ success: false, error: "Private JED storage is unavailable." }, 503);
    }
  }
  const guildId = String(request.nextUrl.searchParams.get("guildId") || "").trim();
  const collection = request.nextUrl.searchParams.get("collection") === "1";
  const q = String(request.nextUrl.searchParams.get("q") || "").slice(0, 80);
  const type = String(request.nextUrl.searchParams.get("type") || "").slice(0, 16);
  const actor = guildId || collection ? await userId(request) : "";
  if ((guildId || collection) && !actor) return reply({ success: false, error: "Sign in with Discord to inspect server assets or your private collection." }, 401);
  const params = new URLSearchParams();
  if (guildId) params.set("guildId", guildId);
  if (collection) params.set("collection", "1");
  if (q) params.set("q", q);
  if (type) params.set("type", type);
  try {
    const upstream = await fetchServerBotApi(`${SERVER_BOT_API}/internal/jed-catalog${params.size ? `?${params}` : ""}`, {
      headers: buildServerBotApiHeaders(actor), cache: "no-store",
    });
    const data = await readServerBotApiJson(upstream);
    if (!upstream.ok || data?.success !== true) return reply({ success: false, error: data?.error || "JED catalog is unavailable." }, upstream.status || 503);
    return reply(data);
  } catch { return reply({ success: false, error: "JED catalog is unavailable or rate limited." }, 503); }
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
    if (size > 7_000_000) { await reader.cancel(); throw new Error("body_too_large"); }
    text += decoder.decode(chunk.value, { stream: true });
  }
  try { return { body: JSON.parse(text + decoder.decode()), size }; } catch { return null; }
}

export async function POST(request: NextRequest) {
  if (await limited(request, "jed_catalog_write")) return reply({ success: false, error: "Too many catalog updates. Retry shortly." }, 429);
  const origin = request.headers.get("origin") || "";
  if (!origin || new URL(origin).origin !== request.nextUrl.origin || request.headers.get("sec-fetch-site") === "cross-site") {
    return reply({ success: false, error: "Same-origin request required." }, 403);
  }
  const actor = await userId(request);
  if (!actor) return reply({ success: false, error: "Sign in with Discord to use the JED catalog." }, 401);
  if (!(request.headers.get("content-type") || "").toLowerCase().startsWith("application/json")) return reply({ success: false, error: "JSON required." }, 415);
  let parsed: Awaited<ReturnType<typeof readBody>>;
  try { parsed = await readBody(request); } catch { return reply({ success: false, error: "Request is too large." }, 413); }
  if (parsed && parsed.size > 16_384 && parsed.body?.action !== "upload-personal") {
    return reply({ success: false, error: "Only private asset uploads may exceed 16 KiB." }, 413);
  }
  const body: any = parsed?.body;
  if (!body || typeof body !== "object" || Array.isArray(body)) return reply({ success: false, error: "Invalid request." }, 400);
  try {
    const upstream = await fetchServerBotApi(`${SERVER_BOT_API}/internal/jed-catalog`, {
      method: "POST", headers: { ...buildServerBotApiHeaders(actor), "Content-Type": "application/json" },
      body: JSON.stringify(body), cache: "no-store",
    });
    const data = await readServerBotApiJson(upstream);
    if (!upstream.ok || data?.success !== true) return reply({ success: false, error: data?.error || "JED catalog request failed." }, upstream.status || 503);
    return reply(data);
  } catch { return reply({ success: false, error: "JED catalog service is unavailable." }, 503); }
}
