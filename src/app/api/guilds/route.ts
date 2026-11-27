import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { auditDashboardEvent } from "@/lib/dashboardAudit";
import {
  DiscordApiError,
  fetchDiscordGuilds,
  getDiscordGuildIconUrl,
  hasGuildManageAccess,
  isDiscordOauthConfigured,
} from "@/lib/discordOAuth";
import { readGuildDiscoveryCache, writeGuildDiscoveryCache } from "@/lib/guildDiscoveryCache";
import { enforceDashboardRateLimit, isRateLimitError } from "@/lib/rateLimiter";
import { DASHBOARD_SESSION_COOKIE, readDashboardSessionValue } from "@/lib/session";

const pendingGuildFetches = new Map<string, Promise<any[]>>();
const guildFetchRetryUntil = new Map<string, number>();

function fetchDiscordGuildsOnce(accessToken: string, userId: string) {
  const requestKey = createHash("sha256").update(`${userId}:${accessToken}`).digest("hex");
  const retryUntil = guildFetchRetryUntil.get(userId) || 0;
  if (retryUntil > Date.now()) {
    throw new DiscordApiError(429, "Discord temporarily rate limited guild discovery.", Math.max(1, Math.ceil((retryUntil - Date.now()) / 1000)));
  }
  if (retryUntil) guildFetchRetryUntil.delete(userId);

  const pending = pendingGuildFetches.get(requestKey);
  if (pending) return pending;

  const request = fetchDiscordGuilds(accessToken)
    .catch((error: unknown) => {
      if (error instanceof DiscordApiError && error.status === 429) {
        guildFetchRetryUntil.set(userId, Date.now() + (error.retryAfterSeconds || 5) * 1000);
      }
      throw error;
    })
    .finally(() => pendingGuildFetches.delete(requestKey));
  pendingGuildFetches.set(requestKey, request);
  return request;
}

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
    const cached = await readGuildDiscoveryCache<{
      guilds: any[];
      user: typeof session.user;
    }>("discord_user_guilds", session.user.id);

    if (cached) {
      const listedGuilds = includeAll ? cached.guilds : cached.guilds.filter((guild) => guild.manageable === true);
      return NextResponse.json({
        success: true,
        oauthConfigured: true,
        loggedIn: true,
        user: cached.user,
        guilds: listedGuilds,
        cached: true,
      });
    }

    const guilds = await fetchDiscordGuildsOnce(session.accessToken, session.user.id);
    const allGuilds = guilds
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
    const listedGuilds = includeAll ? allGuilds : allGuilds.filter((guild) => guild.manageable);

    await writeGuildDiscoveryCache(
      "discord_user_guilds",
      session.user.id,
      {
        user: session.user,
        guilds: allGuilds,
      },
      120
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

    if (error instanceof DiscordApiError && error.status === 429) {
      const retryAfterSeconds = error.retryAfterSeconds || 5;
      return NextResponse.json(
        {
          success: false,
          oauthConfigured: true,
          loggedIn: true,
          user: session.user,
          guilds: [],
          error: error.message,
          retryAfterSeconds,
        },
        { status: 429, headers: { "Retry-After": String(retryAfterSeconds), "Cache-Control": "no-store" } }
      );
    }

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
