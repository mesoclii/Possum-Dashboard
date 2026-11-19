import { NextRequest, NextResponse } from "next/server";
import { DASHBOARD_SESSION_COOKIE, readDashboardSessionValue } from "@/lib/session";
import { enforceDashboardRateLimit, isRateLimitError } from "@/lib/rateLimiter";
import { sameOrigin } from "@/lib/personalSocial";
import { buildServerBotApiHeaders, SERVER_BOT_API } from "@/lib/botApiServer";

const headers = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" };
const reply = (data: object, status = 200) => NextResponse.json(data, { status, headers });

async function handle(request: NextRequest, method: "GET" | "POST" | "PUT") {
  if (method !== "GET" && !sameOrigin(request)) return reply({ error: "Invalid request origin." }, 403);
  const session = await readDashboardSessionValue(request.cookies.get(DASHBOARD_SESSION_COOKIE)?.value);
  if (!session) return reply({ error: "Sign in with Discord first." }, 401);
  try {
    await enforceDashboardRateLimit(request, `tcg_${method.toLowerCase()}`, session.user.id);
  } catch (error) {
    if (isRateLimitError(error)) return reply({ error: "Too many requests. Please retry shortly." }, 429);
    console.error("[TCG] Rate limiter unavailable.", error instanceof Error ? error.name : "UnknownError");
    return reply({ error: "TCG access is temporarily unavailable." }, 503);
  }
  const action = request.nextUrl.searchParams.get("action") || "collection";
  const tradeActions: Record<string, string> = {
    trades: "trades",
    tradeRespond: "trades/respond",
    tradeComplete: "trades/complete",
    tradeCancel: "trades/cancel",
  };
  if ((method === "GET" && !["collection", "rules", "artwork", "trades"].includes(action)) ||
      (method === "POST" && !["open", "trades", "tradeRespond", "tradeComplete", "tradeCancel"].includes(action)) ||
      (method === "PUT" && action !== "rules")) {
    return reply({ error: "Invalid TCG action." }, 400);
  }
  let base: URL;
  try {
    base = new URL(SERVER_BOT_API);
    if (base.protocol !== "http:" || !["127.0.0.1", "localhost"].includes(base.hostname) ||
        base.username || base.password || base.pathname !== "/" || base.search || base.hash) throw new Error("Invalid bot API origin.");
  } catch (error) {
    console.error("[TCG] Bot API must use a loopback origin.", error instanceof Error ? error.name : "UnknownError");
    return reply({ error: "TCG service is not configured." }, 503);
  }
  const url = new URL(`/api/tcg/${tradeActions[action] || action}`, base);
  if (method === "GET" && action === "collection") {
    const cursor = request.nextUrl.searchParams.get("cursor");
    if (cursor !== null) url.searchParams.set("cursor", cursor);
    const view = request.nextUrl.searchParams.get("view");
    if (view !== null) url.searchParams.set("view", view);
  }
  if (method === "GET" && action === "artwork") {
    const keys = request.nextUrl.searchParams.get("keys");
    if (!keys || keys.length > 4096) return reply({ error: "Invalid artwork request." }, 400);
    url.searchParams.set("keys", keys);
  }
  let body: string | undefined;
  if (method !== "GET") {
    const length = Number(request.headers.get("content-length") || "0");
    if (!Number.isFinite(length) || length < 0 || length > 16384) return reply({ error: "Request is too large." }, 413);
    body = await request.text();
    if (Buffer.byteLength(body, "utf8") > 16384) return reply({ error: "Request is too large." }, 413);
    try { JSON.parse(body); } catch { return reply({ error: "Invalid request." }, 400); }
  }
  try {
    const upstream = await fetch(url, {
      method,
      headers: {
        ...buildServerBotApiHeaders(),
        "x-tcg-discord-access-token": session.accessToken,
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      },
      body,
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(15000),
    });
    const data: unknown = await upstream.json();
    if (!data || typeof data !== "object" || Array.isArray(data)) throw new Error("Invalid bot response.");
    return reply(data, upstream.status);
  } catch (error) {
    console.error("[TCG] Bot API request failed.", error instanceof Error ? error.name : "UnknownError");
    return reply({ error: "TCG service is temporarily unavailable." }, 503);
  }
}

export async function GET(request: NextRequest) { return handle(request, "GET"); }
export async function POST(request: NextRequest) { return handle(request, "POST"); }
export async function PUT(request: NextRequest) { return handle(request, "PUT"); }
