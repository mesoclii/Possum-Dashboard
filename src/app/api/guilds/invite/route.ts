import { NextRequest, NextResponse } from "next/server";
import { isDashboardControlOwner } from "@/lib/dashboardOwner";
import { buildServerBotApiHeaders, fetchServerBotApi, readServerBotApiJson, SERVER_BOT_API } from "@/lib/botApiServer";
import { auditDashboardEvent } from "@/lib/dashboardAudit";
import { enforceDashboardRateLimit, isRateLimitError } from "@/lib/rateLimiter";
import { DASHBOARD_SESSION_COOKIE, readDashboardSessionValue } from "@/lib/session";
import { getDashboardPublicOrigin } from "@/lib/dashboardUrl";

function jsonError(error: string, status: number) {
  return NextResponse.json({ success: false, error }, { status, headers: { "Cache-Control": "no-store, private" } });
}

export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin");
  let originIsAllowed = false;
  try {
    originIsAllowed = Boolean(origin) && new URL(String(origin)).origin === getDashboardPublicOrigin(request);
  } catch {
    originIsAllowed = false;
  }
  if (!originIsAllowed) {
    return jsonError("This server action must come from the dashboard origin.", 403);
  }

  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite && fetchSite !== "same-origin" && fetchSite !== "none") {
    return jsonError("This server action must come from the dashboard origin.", 403);
  }

  const session = await readDashboardSessionValue(request.cookies.get(DASHBOARD_SESSION_COOKIE)?.value);
  const actorUserId = String(session?.user?.id || "").trim();
  if (!actorUserId) return jsonError("A valid dashboard session is required.", 401);
  if (!isDashboardControlOwner(actorUserId)) return jsonError("Only a Possum bot owner can create a server inspection invite.", 403);

  try {
    await enforceDashboardRateLimit(request, "guild_inspection_invite", actorUserId);
  } catch (error: any) {
    if (isRateLimitError(error)) return jsonError("Too many invite requests. Wait a moment and try again.", 429);
    return jsonError("Invite rate limit is unavailable.", 503);
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return jsonError("A valid server selection is required.", 400);
  }

  const guildId = String(body?.guildId || "").trim();
  if (!/^\d{16,20}$/.test(guildId)) return jsonError("A valid server selection is required.", 400);

  try {
    const upstream = await fetchServerBotApi(`${SERVER_BOT_API}/guilds/invite`, {
      method: "POST",
      headers: {
        ...buildServerBotApiHeaders(actorUserId),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ guildId }),
      cache: "no-store",
    });
    const data = await readServerBotApiJson(upstream);
    if (!upstream.ok || data?.success !== true || typeof data?.inviteUrl !== "string") {
      const status = upstream.ok ? 502 : upstream.status;
      const message = String(data?.error || "Possum could not create an invite for this server.").slice(0, 300);
      void auditDashboardEvent({
        guildId,
        actorUserId,
        actorTag: session?.user?.globalName || session?.user?.username || actorUserId,
        area: "guild_discovery",
        action: "create_inspection_invite_failed",
        severity: "warn",
        metadata: { status, error: message },
      });
      return jsonError(message, status);
    }

    void auditDashboardEvent({
      guildId,
      actorUserId,
      actorTag: session?.user?.globalName || session?.user?.username || actorUserId,
      area: "guild_discovery",
      action: "create_inspection_invite",
      severity: "info",
      metadata: { maxUses: 1, channelName: String(data?.channelName || "") },
    });

    return NextResponse.json({
      success: true,
      guild: data.guild,
      inviteUrl: data.inviteUrl,
      channelName: data.channelName,
      expiresAt: data.expiresAt || null,
      maxUses: 1,
    }, { headers: { "Cache-Control": "no-store, private" } });
  } catch (error: any) {
    return jsonError(error?.message || "Possum could not create an invite for this server.", 502);
  }
}
