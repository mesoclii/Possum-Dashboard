import { NextRequest, NextResponse } from "next/server";
import { auditDashboardEvent } from "@/lib/dashboardAudit";
import { enforceDashboardRateLimit, isRateLimitError } from "@/lib/rateLimiter";
import { getGuildSubscriptionStatus, setGuildSubscriptionStatus } from "@/lib/subscription";
import { buildServerBotApiHeaders, fetchServerBotApi, readServerBotApiJson, SERVER_BOT_API } from "@/lib/botApiServer";
import { DASHBOARD_SESSION_COOKIE, readDashboardSessionValue } from "@/lib/session";
import { isDashboardControlOwner } from "@/lib/dashboardOwner";

export async function GET(request: NextRequest) {
  try {
    await enforceDashboardRateLimit(request, "subscription_status");
  } catch (error: any) {
    if (isRateLimitError(error)) {
      return NextResponse.json({ success: false, error: "Too many subscription checks. Please retry shortly." }, { status: 429 });
    }
  }

  const guildId = String(request.nextUrl.searchParams.get("guildId") || "").trim();
  if (!guildId) {
    return NextResponse.json({ success: false, error: "guildId is required" }, { status: 400 });
  }

  const session = await readDashboardSessionValue(request.cookies.get(DASHBOARD_SESSION_COOKIE)?.value);
  const actorUserId = String(session?.user?.id || "").trim();
  if (!actorUserId) {
    return NextResponse.json({ success: false, error: "A valid dashboard session is required." }, { status: 401 });
  }
  const isMasterOwner = isDashboardControlOwner(actorUserId);

  if (!isMasterOwner) {
    if (!/^\d{16,20}$/.test(guildId)) {
      return NextResponse.json({ success: false, error: "A valid guildId is required" }, { status: 400 });
    }
    try {
      const access = await fetchServerBotApi(
        `${SERVER_BOT_API}/guild-access?guildId=${encodeURIComponent(guildId)}&userId=${encodeURIComponent(actorUserId)}`,
        { headers: buildServerBotApiHeaders(actorUserId, { allowFallback: false }), cache: "no-store" }
      );
      const accessJson = await readServerBotApiJson(access);
      if (!access.ok || accessJson?.success === false || accessJson?.access !== true) {
        return NextResponse.json({ success: false, error: "Insufficient permissions for this guild." }, { status: 403 });
      }
    } catch {
      return NextResponse.json({ success: false, error: "Could not verify guild access." }, { status: 502 });
    }
  }

  try {
    const status = await getGuildSubscriptionStatus(guildId, actorUserId);
    return NextResponse.json({ success: true, status, canManagePremium: isMasterOwner });
  } catch (error: any) {
    void auditDashboardEvent({
      guildId,
      actorUserId,
      actorTag: session?.user?.globalName || session?.user?.username || actorUserId,
      area: "subscriptions",
      action: "status_lookup_failed",
      severity: "error",
      metadata: {
        error: error?.message || "Subscription lookup failed.",
      },
    });

    return NextResponse.json(
      {
        success: false,
        error: error?.message || "Subscription lookup failed.",
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    await enforceDashboardRateLimit(request, "subscription_status_write");
  } catch (error: any) {
    if (isRateLimitError(error)) {
      return NextResponse.json({ success: false, error: "Too many premium plan updates. Please retry shortly." }, { status: 429 });
    }
  }

  const session = await readDashboardSessionValue(request.cookies.get(DASHBOARD_SESSION_COOKIE)?.value);
  const actorUserId = String(session?.user?.id || "").trim();
  const isMasterOwner = isDashboardControlOwner(actorUserId);

  if (!isMasterOwner) {
    return NextResponse.json({ success: false, error: "Only the master owner can change premium plan state." }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const guildId = String(body?.guildId || "").trim();
  if (!guildId) {
    return NextResponse.json({ success: false, error: "guildId is required" }, { status: 400 });
  }

  try {
    const scope = String(body?.scope || "guild").trim().toLowerCase() === "global" ? "global" : "guild";
    const active = body?.active === true;
    const trialDaysRaw = Math.trunc(Number(body?.trialDays || 0));
    const trialDays = Number.isFinite(trialDaysRaw) ? Math.max(0, Math.min(365, trialDaysRaw)) : 0;
    const requestedPlan = String(body?.plan || (active ? "PRO" : "FREE")).trim().toUpperCase();
    const allowedPlans = active ? ["PRO", "BUSINESS", "ELITE", "ENTERPRISE"] : ["FREE"];
    if (!allowedPlans.includes(requestedPlan)) {
      return NextResponse.json({ success: false, error: "Unknown premium plan." }, { status: 400 });
    }
    const premiumExpiresAt =
      active && trialDays > 0
        ? new Date(Date.now() + trialDays * 24 * 60 * 60 * 1000)
        : null;
    const status = await setGuildSubscriptionStatus(guildId, {
      active,
      plan: requestedPlan,
      premiumTier: active ? requestedPlan : null,
      premiumExpiresAt,
      source: scope === "global" ? (trialDays > 0 ? "global_trial" : "global_override") : (trialDays > 0 ? "owner_trial" : "owner_override"),
    }, actorUserId, { scope });

    if (scope === "guild") {
      try {
        const upstream = await fetchServerBotApi(`${SERVER_BOT_API}/api/premium/override`, {
          method: "POST",
          headers: {
            ...buildServerBotApiHeaders(actorUserId, { allowFallback: false }),
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            guildId,
            premium: status.active,
            premiumTier: status.plan,
            premiumExpiresAt: status.premiumExpiresAt,
          }),
        });
        const botResult = await readServerBotApiJson(upstream);
        if (!upstream.ok || botResult?.success === false) {
          throw new Error(botResult?.error || `Bot entitlement sync failed (${upstream.status}).`);
        }
      } catch (error: any) {
        void auditDashboardEvent({
          guildId,
          actorUserId,
          actorTag: session?.user?.globalName || session?.user?.username || actorUserId,
          area: "subscriptions",
          action: "bot_entitlement_sync_failed",
          severity: "error",
          metadata: { error: error?.message || "Bot entitlement sync failed." },
        });
        return NextResponse.json(
          {
            success: false,
            status,
            error: `Dashboard plan was saved, but bot limits could not be synchronized. Retry this change. ${error?.message || ""}`.trim(),
          },
          { status: 502 }
        );
      }
    }

    void auditDashboardEvent({
      guildId,
      actorUserId,
      actorTag: session?.user?.globalName || session?.user?.username || actorUserId,
      area: "subscriptions",
      action: "status_override",
      severity: "info",
      metadata: {
        active: status.active,
        plan: status.plan,
        premiumTier: status.premiumTier,
        scope: status.scope,
        trialDays,
      },
    });

    return NextResponse.json({ success: true, status, canManagePremium: true });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: error?.message || "Failed to update premium plan state.",
      },
      { status: 500 }
    );
  }
}
