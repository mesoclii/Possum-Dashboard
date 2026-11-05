import { NextRequest, NextResponse } from "next/server";
import { enforceDashboardRateLimit, isRateLimitError } from "@/lib/rateLimiter";
import { buildServerBotApiHeaders, fetchServerBotApi, readServerBotApiJson, SERVER_BOT_API } from "@/lib/botApiServer";
import { DASHBOARD_SESSION_COOKIE, readDashboardSessionValue } from "@/lib/session";

// The dashboard never touches billing data or Stripe directly: it forwards the signed-in user's id
// to the bot, which re-checks that user's permissions in the server.
export async function proxyAiBilling(request: NextRequest, path: string, method: "GET" | "POST", allowedKeys: string[]) {
  if (method === "POST") {
    try {
      await enforceDashboardRateLimit(request, "ai_billing");
    } catch (error: any) {
      if (isRateLimitError(error)) {
        return NextResponse.json({ success: false, error: "Too many requests. Please retry shortly." }, { status: 429 });
      }
    }
  }

  const session = await readDashboardSessionValue(request.cookies.get(DASHBOARD_SESSION_COOKIE)?.value);
  const actorUserId = String(session?.user?.id || "").trim();
  if (!actorUserId) {
    return NextResponse.json({ success: false, error: "A valid dashboard session is required." }, { status: 401 });
  }

  const source: Record<string, any> =
    method === "GET" ? Object.fromEntries(request.nextUrl.searchParams.entries()) : await request.json().catch(() => ({}));
  const guildId = String(source?.guildId || "").trim();
  if (!/^\d{16,20}$/.test(guildId)) {
    return NextResponse.json({ success: false, error: "A valid guildId is required." }, { status: 400 });
  }

  const payload: Record<string, any> = { guildId, userId: actorUserId };
  for (const key of allowedKeys) if (source[key] !== undefined) payload[key] = source[key];

  try {
    const headers = buildServerBotApiHeaders(actorUserId, { allowFallback: false });
    const res =
      method === "GET"
        ? await fetchServerBotApi(`${SERVER_BOT_API}${path}?${new URLSearchParams(payload as Record<string, string>).toString()}`, { headers, cache: "no-store" })
        : await fetchServerBotApi(`${SERVER_BOT_API}${path}`, {
            method: "POST",
            headers: { "content-type": "application/json", ...headers },
            body: JSON.stringify(payload),
            cache: "no-store",
          });
    const json = await readServerBotApiJson(res);
    if (!res.ok || json?.success === false) {
      return NextResponse.json({ success: false, error: json?.error || "Request failed." }, { status: res.status || 502 });
    }
    return NextResponse.json(json);
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error?.message || "Could not reach the bot." }, { status: 502 });
  }
}