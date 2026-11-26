import { NextRequest, NextResponse } from "next/server";
import { auditDashboardEvent } from "@/lib/dashboardAudit";
import {
  fetchDiscordGuilds,
  getDiscordGuildIconUrl,
  hasGuildManageAccess,
  isDiscordOauthConfigured,
} from "@/lib/discordOAuth";
import { readGuildDiscoveryCache, writeGuildDiscoveryCache } from "@/lib/guildDiscoveryCache";
import { enforceDashboardRateLimit, isRateLimitError } from "@/lib/rateLimiter";
import { DASHBOARD_SESSION_COOKIE, readDashboardSessionValue } from "@/lib/session";

export async function GET(request: NextRequest) {
  const includeAll = request.nextUrl.searchParams.get("includeAll") === "1";
  try {
    await enforceDashboardRateLimit(request, "guilds_admin");
  } catch (error: any) {
    if (isRateLimitError(error)) {
      return NextResponse.json({ success: false, error: "Too many guild requests. Please retry shortly." }, { status: 429 });
    }
  }

  if (!isDiscordOauthConfigured()) {
    return NextResponse.json({
      success: true,
      oauthConfigured: false,
      loggedIn: false,
      user: null,
      guilds: [],
    });
  }

  const session = await readDashboardSessionValue(request.cookies.get(DASHBOARD_SESSION_COOKIE)?.value);
  if (!session) {
    return NextResponse.json({
      success: true,
      oauthConfigured: true,
      loggedIn: false,
      user: null,
      guilds: [],
    });
  }

  try {
    const cacheNamespace = includeAll ? "discord_user_guilds" : "discord_admin_guilds";
    const cached = await readGuildDiscoveryCache<{
      guilds: any[];
      user: typeof session.user;
    }>(cacheNamespace, session.user.id);

    if (cached) {
      return NextResponse.json({
        success: true,
        oauthConfigured: true,
        loggedIn: true,
        user: cached.user,
        guilds: cached.guilds,
        cached: true,
      });
    }

    const guilds = await fetchDiscordGuilds(session.accessToken);
    const listedGuilds = guilds
      .filter((guild) => includeAll || hasGuildManageAccess(guild))
      .map((guild) => ({
        id: String(guild.id),
        name: String(guild.name || guild.id),
        icon: guild.icon || null,
        iconUrl: getDiscordGuildIconUrl(String(guild.id), guild.icon),
        owner: guild.owner === true,
        permissions: String(guild.permissions_new || guild.permissions || ""),
        manageable: hasGuildManageAccess(guild),
        botPresent: false,
      }));

    await writeGuildDiscoveryCache(
      cacheNamespace,
      session.user.id,
      {
        user: session.user,
        guilds: listedGuilds,
      },
      45
    );

    void auditDashboardEvent({
      guildId: null,
      actorUserId: session.user.id,
      actorTag: session.user.globalName || session.user.username || session.user.id,
      area: "guild_discovery",
      action: "load_admin_guilds",
      severity: "info",
      metadata: {
        guildCount: listedGuilds.length,
      },
    });

    return NextResponse.json({
      success: true,
      oauthConfigured: true,
      loggedIn: true,
      user: session.user,
      guilds: listedGuilds,
    });
  } catch (error: any) {
    void auditDashboardEvent({
      guildId: null,
      actorUserId: session.user.id,
      actorTag: session.user.globalName || session.user.username || session.user.id,
      area: "guild_discovery",
      action: "load_admin_guilds_failed",
      severity: "error",
      metadata: {
        error: error?.message || "Failed to load Discord guilds.",
      },
    });

    return NextResponse.json(
      {
        success: false,
        oauthConfigured: true,
        loggedIn: false,
        user: null,
        guilds: [],
        error: error?.message || "Failed to load Discord guilds.",
      },
      { status: 500 }
    );
  }
}
