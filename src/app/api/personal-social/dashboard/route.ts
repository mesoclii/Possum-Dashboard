import { NextRequest, NextResponse } from "next/server";
import { isSocialOAuthProvider, socialOrigin } from "@/lib/personalSocial";

export function GET(request: NextRequest) {
  const origin = socialOrigin();
  if (!origin) return NextResponse.json({ error: "Dashboard origin is not configured." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  const destination = new URL("/personal-social", origin);
  const guildId = request.nextUrl.searchParams.get("guildId") || "";
  if (/^\d{1,20}$/.test(guildId)) destination.searchParams.set("guildId", guildId);
  const provider = request.nextUrl.searchParams.get("provider") || "";
  if (isSocialOAuthProvider(provider)) destination.searchParams.set("provider", provider);
  const response = NextResponse.redirect(destination.toString(), 303);
  response.headers.set("Cache-Control", "no-store");
  return response;
}
