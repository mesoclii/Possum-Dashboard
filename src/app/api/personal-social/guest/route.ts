import { NextRequest, NextResponse } from "next/server";
import { enforceDashboardRateLimit } from "@/lib/rateLimiter";
import {
  makePersonalSocialGuestCookieValue,
  PERSONAL_SOCIAL_GUEST_COOKIE,
  readPersonalSocialGuestId,
} from "@/lib/personalSocialGuest";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    await enforceDashboardRateLimit(request, "personal_social_guest");
  } catch {
    return NextResponse.json({ success: false, error: "Too many requests." }, {
      status: 429,
      headers: { "Cache-Control": "no-store, private" },
    });
  }
  try {
    const id = readPersonalSocialGuestId(request) || undefined;
    const guestCookie = makePersonalSocialGuestCookieValue(id);
    const response = NextResponse.json({ success: true }, { headers: { "Cache-Control": "no-store, private" } });
    response.cookies.set(PERSONAL_SOCIAL_GUEST_COOKIE, guestCookie.value, {
      httpOnly: true,
      sameSite: "lax",
      secure: request.nextUrl.protocol === "https:" || process.env.NODE_ENV === "production",
      path: "/",
      maxAge: guestCookie.maxAge,
    });
    return response;
  } catch {
    return NextResponse.json({ success: false, error: "A private provider-linking session could not be created." }, {
      status: 503,
      headers: { "Cache-Control": "no-store, private" },
    });
  }
}
