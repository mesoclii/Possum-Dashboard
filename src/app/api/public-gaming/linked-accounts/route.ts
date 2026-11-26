import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { enforceDashboardRateLimit } from "@/lib/rateLimiter";
import { DASHBOARD_SESSION_COOKIE, readDashboardSessionValue } from "@/lib/session";
import { readPersonalSocialGuestId } from "@/lib/personalSocialGuest";

export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "no-store, private", "X-Content-Type-Options": "nosniff" };
const providers = new Set(["twitch", "youtube", "reddit", "x", "tiktok"]);

export async function GET(request: NextRequest) {
  const session = await readDashboardSessionValue(request.cookies.get(DASHBOARD_SESSION_COOKIE)?.value);
  const userId = session?.user.id || readPersonalSocialGuestId(request);
  if (!userId) return NextResponse.json({ success: false, error: "Open Personal Social to create a private linking session first." }, { status: 401, headers });
  try {
    await enforceDashboardRateLimit(request, "public_gaming_linked_accounts", userId);
    const rows = await prisma.$queryRaw<{ provider: string; label: string; url: string; revision: string | null }[]>`
      SELECT a."provider", a."label", a."url", r."revision"
      FROM "PersonalSocialAccount" a
      JOIN "PersonalSocialRevision" r ON r."userId" = a."userId" AND r."provider" = a."provider"
      WHERE a."userId" = ${userId}
      ORDER BY a."provider"
    `;
    return NextResponse.json({
      success: true,
      accounts: rows.filter((row) => providers.has(row.provider) && /^[a-f0-9]{32}$/.test(row.revision || "") &&
        typeof row.label === "string" && typeof row.url === "string")
        .map(({ provider, label, url }) => ({ provider, label, url, verified: true })),
    }, { headers });
  } catch {
    return NextResponse.json({ success: false, error: "Verified provider accounts are unavailable." }, { status: 503, headers });
  }
}
