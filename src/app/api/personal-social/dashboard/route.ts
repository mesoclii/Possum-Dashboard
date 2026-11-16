import { NextResponse } from "next/server";
import { socialOrigin } from "@/lib/personalSocial";

export function GET() {
  const origin = socialOrigin();
  if (!origin) return NextResponse.json({ error: "Dashboard origin is not configured." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  const response = NextResponse.redirect(`${origin}/personal-social`, 303);
  response.headers.set("Cache-Control", "no-store");
  return response;
}
