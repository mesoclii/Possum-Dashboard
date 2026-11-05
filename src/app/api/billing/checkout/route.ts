import { NextRequest, NextResponse } from "next/server";
import { enforceDashboardRateLimit, isRateLimitError } from "@/lib/rateLimiter";
import { buildServerBotApiHeaders, fetchServerBotApi, readServerBotApiJson, SERVER_BOT_API } from "@/lib/botApiServer";
import { DASHBOARD_SESSION_COOKIE, readDashboardSessionValue } from "@/lib/session";

const PLANS = new Set(["monthly", "yearly", "lifetime", "ai_addon"]);

export async function GET(request: NextRequest) {
  const session = await readDashboardSessionValue(request.cookies.get(DASHBOARD_SESSION_COOKIE)?.value);
  const actorUserId = String(session?.user?.id || "").trim();
  if (!actorUserId) {
    return NextResponse.json({ success: false, error: "A valid dashboard session is required." }, { status: 401 });
  }
  try {
    const res = await fetchServerBotApi(`${SERVER_BOT_API}/api/stripe/plans`, {
      headers: buildServerBotApiHeaders(actorUserId, { allowFallback: false }),
      cache: "no-store",
    });
    const json = await readServerBotApiJson(res);
    return NextResponse.json(res.ok ? json : { success: true, enabled: false, plans: {} });
  } catch {
    return NextResponse.json({ success: true, enabled: false, plans: {} });
  }
}

export async function POST(request: NextRequest) {
  try {
    await enforceDashboardRateLimit(request, "billing_checkout");
  } catch (error: any) {
    if (isRateLimitError(error)) {
      return NextResponse.json({ success: false, error: "Too many checkout attempts. Please retry shortly." }, { status: 429 });
    }
  }

  const session = await readDashboardSessionValue(request.cookies.get(DASHBOARD_SESSION_COOKIE)?.value);
  const actorUserId = String(session?.user?.id || "").trim();
  if (!actorUserId) {
    return NextResponse.json({ success: false, error: "A valid dashboard session is required." }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const guildId = String(body?.guildId || "").trim();
  const plan = String(body?.plan || "").trim().toLowerCase();
  if (!/^\d{16,20}$/.test(guildId)) {
    return NextResponse.json({ success: false, error: "A valid guildId is required." }, { status: 400 });
  }
  if (!PLANS.has(plan)) {
    return NextResponse.json({ success: false, error: "Unknown plan." }, { status: 400 });
  }

  try {
    const res = await fetchServerBotApi(`${SERVER_BOT_API}/api/stripe/checkout`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...buildServerBotApiHeaders(actorUserId, { allowFallback: false }),
      },
      body: JSON.stringify({ guildId, userId: actorUserId, plan }),
      cache: "no-store",
    });
    const json = await readServerBotApiJson(res);
    if (!res.ok || json?.success === false) {
      const error = res.status === 503 ? "Billing is not enabled yet." : json?.error || "Checkout failed.";
      return NextResponse.json({ success: false, error }, { status: res.status || 502 });
    }
    return NextResponse.json({ success: true, url: json?.url });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error?.message || "Could not reach the bot." }, { status: 502 });
  }
}
