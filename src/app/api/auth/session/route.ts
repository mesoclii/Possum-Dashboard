import { NextRequest, NextResponse } from "next/server";
import { DASHBOARD_SESSION_COOKIE, readDashboardSessionValue } from "@/lib/session";
import { MASTER_OWNER_USER_ID, isDashboardControlOwner } from "@/lib/dashboardOwner";
import { buildServerBotApiHeaders, fetchServerBotApi, readServerBotApiJson, SERVER_BOT_API } from "@/lib/botApiServer";
import { fetchDiscordGuilds, hasGuildManageAccess, isDiscordOauthConfigured } from "@/lib/discordOAuth";

export async function GET(request: NextRequest) {
  const oauthConfigured = isDiscordOauthConfigured();
  const session = await readDashboardSessionValue(request.cookies.get(DASHBOARD_SESSION_COOKIE)?.value);
  const brief = request.nextUrl.searchParams.get("brief") === "1";

  if (!session) {
    return NextResponse.json({
      success: true,
      oauthConfigured,
      loggedIn: false,
      isMasterOwner: false,
      isPrimaryOwner: false,
      canEnterDashboard: false,
      accessibleGuildCount: 0,
      user: null,
    });
  }

  const actorUserId = String(session.user.id || MASTER_OWNER_USER_ID).trim() || MASTER_OWNER_USER_ID;
  const isMasterOwner = isDashboardControlOwner(actorUserId);
  const isPrimaryOwner = actorUserId === MASTER_OWNER_USER_ID;

  if (brief) {
    return NextResponse.json({
      success: true,
      oauthConfigured,
      loggedIn: true,
      isMasterOwner,
      isPrimaryOwner,
      canEnterDashboard: true,
      accessibleGuildCount: null,
      counts: null,
      user: session.user,
    });
  }

  let adminGuildCount = 0;
  let installedGuildCount = 0;

  if (oauthConfigured) {
    try {
      const guilds = await fetchDiscordGuilds(session.accessToken);
      adminGuildCount = guilds.filter((guild) => hasGuildManageAccess(guild)).length;
    } catch {
      adminGuildCount = 0;
    }
  }

  try {
    const upstream = await fetchServerBotApi(`${SERVER_BOT_API}/guilds?userId=${encodeURIComponent(actorUserId)}`, {
      headers: buildServerBotApiHeaders(actorUserId),
      cache: "no-store",
    });
    const data = await readServerBotApiJson(upstream);
    installedGuildCount = Array.isArray(data?.guilds) ? data.guilds.length : 0;
  } catch {
    installedGuildCount = 0;
  }

  const accessibleGuildCount = Math.max(adminGuildCount, installedGuildCount);

  return NextResponse.json({
    success: true,
    oauthConfigured,
    loggedIn: true,
    isMasterOwner,
    isPrimaryOwner,
    canEnterDashboard: isMasterOwner || accessibleGuildCount > 0,
    accessibleGuildCount,
    counts: {
      adminGuilds: adminGuildCount,
      installedGuilds: installedGuildCount,
    },
    user: session.user,
  });
}
