import { NextRequest, NextResponse } from "next/server";
import { auditDashboardEvent } from "@/lib/dashboardAudit";
import { buildDashboardUrl } from "@/lib/dashboardUrl";
import { dashboardSessionCookieDomain, DASHBOARD_OAUTH_STATE_COOKIE, DASHBOARD_SESSION_COOKIE, destroyDashboardSession, readDashboardSessionValue, shouldUseSecureCookies } from "@/lib/session";

export async function GET(request: NextRequest) {
  const rawSession = request.cookies.get(DASHBOARD_SESSION_COOKIE)?.value;
  const session = await readDashboardSessionValue(rawSession);
  await destroyDashboardSession(rawSession);

  const response = NextResponse.redirect(buildDashboardUrl("/", request));
  response.cookies.delete(DASHBOARD_SESSION_COOKIE);
  const cookieDomain = dashboardSessionCookieDomain();
  if (cookieDomain) {
    response.cookies.set(DASHBOARD_SESSION_COOKIE, "", {
      httpOnly: true,
      sameSite: "lax",
      secure: shouldUseSecureCookies(),
      path: "/",
      domain: cookieDomain,
      maxAge: 0,
    });
  }
  response.cookies.delete(DASHBOARD_OAUTH_STATE_COOKIE);

  if (session?.user?.id) {
    void auditDashboardEvent({
      actorUserId: session.user.id,
      actorTag: session.user.globalName || session.user.username || session.user.id,
      area: "oauth",
      action: "discord_logout",
      severity: "info",
    });
  }
  return response;
}
