import { NextRequest, NextResponse } from "next/server";
import { auditDashboardEvent } from "@/lib/dashboardAudit";
import { buildDashboardUrl } from "@/lib/dashboardUrl";
import {
  exchangeDiscordCode,
  fetchDiscordUser,
  getDiscordOauthConfigurationIssue,
} from "@/lib/discordOAuth";
import { enforceDashboardRateLimit, isRateLimitError } from "@/lib/rateLimiter";
import {
  createDashboardSessionValue,
  DASHBOARD_OAUTH_STATE_COOKIE,
  DASHBOARD_RETURN_TO_COOKIE,
  DASHBOARD_SESSION_COOKIE,
  isDashboardSessionConfigured,
  sanitizeDashboardReturnTo,
  shouldUseSecureCookies,
} from "@/lib/session";

export async function GET(request: NextRequest) {
  try {
    await enforceDashboardRateLimit(request, "oauth_callback");
  } catch (error: any) {
    if (isRateLimitError(error)) {
      return NextResponse.json({ success: false, error: "Too many callback attempts. Please retry shortly." }, { status: 429 });
    }
  }

  const oauthIssue = getDiscordOauthConfigurationIssue();
  if (oauthIssue || !isDashboardSessionConfigured()) {
    return NextResponse.json(
      { success: false, error: oauthIssue || "SESSION_SECRET is not configured on the dashboard." },
      { status: 500 }
    );
  }

  const code = String(request.nextUrl.searchParams.get("code") || "").trim();
  const state = String(request.nextUrl.searchParams.get("state") || "").trim();
  const storedState = String(request.cookies.get(DASHBOARD_OAUTH_STATE_COOKIE)?.value || "").trim();
  const returnTo = sanitizeDashboardReturnTo(request.cookies.get(DASHBOARD_RETURN_TO_COOKIE)?.value);

  if (!code) {
    return NextResponse.json({ success: false, error: "Missing OAuth code." }, { status: 400 });
  }

  if (!state || !storedState || state !== storedState) {
    return NextResponse.json({ success: false, error: "OAuth state mismatch." }, { status: 400 });
  }

  let token: Awaited<ReturnType<typeof exchangeDiscordCode>>;
  let user: Awaited<ReturnType<typeof fetchDiscordUser>>;
  let sessionValue: string;
  try {
    token = await exchangeDiscordCode(code);
    user = await fetchDiscordUser(token.access_token);
    sessionValue = await createDashboardSessionValue({
      user: {
        id: String(user.id),
        username: String(user.username || "Discord User"),
        globalName: user.global_name ?? null,
        avatar: user.avatar ?? null,
      },
      accessToken: token.access_token,
      refreshToken: token.refresh_token ?? null,
      expiresAt: Date.now() + Number(token.expires_in || 604800) * 1000,
    });
  } catch (error: any) {
    const message = String(error?.message || error || "Unknown login error");
    console.error("[discord-callback] login failed:", message);
    return NextResponse.json({ success: false, error: `Discord login failed: ${message}` }, { status: 502 });
  }

  const redirectUrl = buildDashboardUrl(returnTo, request);
  if (!redirectUrl.searchParams.get("userId")) {
    redirectUrl.searchParams.set("userId", String(user.id));
  }

  const response = NextResponse.redirect(redirectUrl);
  response.cookies.set(DASHBOARD_SESSION_COOKIE, sessionValue, {
    httpOnly: true,
    sameSite: "lax",
    secure: shouldUseSecureCookies(),
    path: "/",
    maxAge: Math.max(60, Number(token.expires_in || 604800)),
  });
  response.cookies.delete(DASHBOARD_OAUTH_STATE_COOKIE);
  response.cookies.delete(DASHBOARD_RETURN_TO_COOKIE);

  void auditDashboardEvent({
    actorUserId: String(user.id),
    actorTag: user.global_name || user.username || String(user.id),
    area: "oauth",
    action: "discord_callback_success",
    severity: "info",
    metadata: {
      redirectTo: redirectUrl.toString(),
    },
  });

  return response;
}
