import { NextRequest, NextResponse } from "next/server";
import { enforceDashboardRateLimit } from "@/lib/rateLimiter";
import { attachPublicGamingGuestCookie, publicGamingActor } from "@/lib/publicGamingGuest";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    await enforceDashboardRateLimit(request, "public_gaming_guest");
    const actor = await publicGamingActor(request, true);
    if (!actor) return NextResponse.json({ success: false, error: "A private Gaming Hub session could not be created." }, {
      status: 503,
      headers: { "Cache-Control": "no-store, private" },
    });
    const response = NextResponse.json({ success: true }, { headers: { "Cache-Control": "no-store, private" } });
    return attachPublicGamingGuestCookie(response, actor, request);
  } catch {
    return NextResponse.json({ success: false, error: "A private Gaming Hub session could not be created." }, {
      status: 503,
      headers: { "Cache-Control": "no-store, private" },
    });
  }
}
