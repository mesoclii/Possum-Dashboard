import { NextRequest, NextResponse } from "next/server";
import { enforceDashboardRateLimit } from "@/lib/rateLimiter";
import {
  makePublicGamingGuestCookieValue,
  PUBLIC_GAMING_GUEST_COOKIE,
  readPublicGamingGuestId,
} from "@/lib/publicGamingGuest";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    await enforceDashboardRateLimit(request, "public_gaming_guest");
    const id = readPublicGamingGuestId(request) || undefined;
    const guestCookie = makePublicGamingGuestCookieValue(id);
    const response = NextResponse.json({ success: true }, { headers: { "Cache-Control": "no-store, private" } });
    response.cookies.set(PUBLIC_GAMING_GUEST_COOKIE, guestCookie.value, {
      httpOnly: true,
      sameSite: "lax",
      secure: request.nextUrl.protocol === "https:" || process.env.NODE_ENV === "production",
      path: "/",
      maxAge: guestCookie.maxAge,
    });
    return response;
  } catch {
    return NextResponse.json({ success: false, error: "A private Gaming Hub session could not be created." }, {
      status: 503,
      headers: { "Cache-Control": "no-store, private" },
    });
  }
}
