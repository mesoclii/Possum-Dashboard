import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { buildServerBotApiHeaders, fetchServerBotApi, readServerBotApiJson, SERVER_BOT_API } from "@/lib/botApiServer";
import { enforceDashboardRateLimit } from "@/lib/rateLimiter";
import { DASHBOARD_SESSION_COOKIE, readDashboardSessionValue } from "@/lib/session";
import { readPersonalSocialGuestId } from "@/lib/personalSocialGuest";
import { attachPublicGamingGuestCookie, publicGamingActor } from "@/lib/publicGamingGuest";

export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "no-store, private", "X-Content-Type-Options": "nosniff" };
const socialProviders = new Set(["twitch", "youtube", "reddit", "x", "tiktok"]);

export async function GET(request: NextRequest) {
  const session = await readDashboardSessionValue(request.cookies.get(DASHBOARD_SESSION_COOKIE)?.value);
  const socialUserId = session?.user.id || readPersonalSocialGuestId(request);
  let actor: Awaited<ReturnType<typeof publicGamingActor>> = null;
  try {
    actor = await publicGamingActor(request, true);
    if (!actor) return NextResponse.json({ success: false, error: "A public Gaming Hub account is unavailable." }, { status: 503, headers });
    await enforceDashboardRateLimit(request, "public_gaming_linked_accounts", actor.id);
    const socialAccounts = socialUserId ? await prisma.$queryRaw<{ provider: string; label: string; url: string; revision: string | null }[]>`
      SELECT a."provider", a."label", a."url", r."revision"
      FROM "PersonalSocialAccount" a
      JOIN "PersonalSocialRevision" r ON r."userId" = a."userId" AND r."provider" = a."provider"
      WHERE a."userId" = ${socialUserId}
      ORDER BY a."provider"
    ` : [];
    const gameResponse = await fetchServerBotApi(`${SERVER_BOT_API}/internal/public-gaming/linked-accounts/me`, {
      headers: buildServerBotApiHeaders(actor.id), cache: "no-store",
    });
    const gameData = await readServerBotApiJson(gameResponse);
    if (!gameResponse.ok || !Array.isArray(gameData.accounts)) throw new Error("Verified game accounts are unavailable.");
    const accounts = [
      ...socialAccounts.filter((row) => socialProviders.has(row.provider) && /^[a-f0-9]{32}$/.test(row.revision || "") && typeof row.label === "string" && typeof row.url === "string")
        .map(({ provider, label, url }) => ({ provider, label, url, verified: true })),
      ...gameData.accounts.filter((entry: any) => entry?.verified === true && typeof entry.provider === "string" && typeof entry.label === "string" && typeof entry.url === "string"),
    ];
    const response = NextResponse.json({ success: true, accounts }, { headers });
    return attachPublicGamingGuestCookie(response, actor, request);
  } catch {
    return NextResponse.json({ success: false, error: "Verified provider accounts are unavailable." }, { status: 503, headers });
  }
}
