import { NextRequest, NextResponse } from "next/server";
import {
  buildDiscordInviteUrl,
  getDiscordOauthConfigurationIssue,
} from "@/lib/discordOAuth";
import {
  createOauthState,
  DASHBOARD_OAUTH_STATE_COOKIE,
  DASHBOARD_RETURN_TO_COOKIE,
  isDashboardSessionConfigured,
  shouldUseSecureCookies,
} from "@/lib/session";

export async function GET(req: NextRequest) {
  try {
    const guildId = String(req.nextUrl.searchParams.get("guildId") || "").trim() || undefined;
    const state = createOauthState();
    const inviteUrl = buildDiscordInviteUrl({ guildId, state });
    const invite = new URL(inviteUrl);
    const response = NextResponse.redirect(invite);

    if (invite.searchParams.get("response_type") === "code") {
      const oauthIssue = getDiscordOauthConfigurationIssue();
      if (oauthIssue || !isDashboardSessionConfigured()) {
        return NextResponse.json(
          { error: oauthIssue || "SESSION_SECRET is not configured on the dashboard." },
          { status: 500 }
        );
      }

      const cookieOptions = {
        httpOnly: true,
        sameSite: "lax" as const,
        secure: shouldUseSecureCookies(),
        path: "/",
        maxAge: 60 * 10,
      };
      response.cookies.set(DASHBOARD_OAUTH_STATE_COOKIE, state, cookieOptions);
      response.cookies.set(DASHBOARD_RETURN_TO_COOKIE, "/guilds", cookieOptions);
    }

    return response;
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to build Discord invite URL." },
      { status: 500 }
    );
  }
}
