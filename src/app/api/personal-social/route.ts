import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { DASHBOARD_SESSION_COOKIE, readDashboardSessionValue } from "@/lib/session";
import { readPersonalSocialGuestId } from "@/lib/personalSocialGuest";
import { decodeDirectoryCursor, disconnectSocial, isSocialOAuthProvider, memberGuilds, sameOrigin, setSocialVisibility, SOCIAL_PROVIDERS, socialProviderStatus, visibleDirectory } from "@/lib/personalSocial";
import { enforceDashboardRateLimit } from "@/lib/rateLimiter";
import { RateLimiterMemory } from "rate-limiter-flexible";

const headers = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" };
const reply = (data: object, status = 200) => NextResponse.json(data, { status, headers });
const directoryLimiter = new RateLimiterMemory({ points: 5, duration: 60 });

export async function GET(request: NextRequest) {
  const session = await readDashboardSessionValue(request.cookies.get(DASHBOARD_SESSION_COOKIE)?.value);
  const guestId = readPersonalSocialGuestId(request);
  const userId = session?.user.id || guestId || "";
  if (!userId) return reply({ error: "Open the Gaming Hub or sign in with Discord first." }, 401);
  try { await enforceDashboardRateLimit(request, "personal_social_read", userId); }
  catch { return reply({ error: "Too many requests." }, 429); }
  try {
    const guildId = request.nextUrl.searchParams.get("guildId");
    if (guildId) {
      if (!session) return reply({ error: "Discord sign-in is required for server sharing." }, 403);
      if (!/^\d{1,20}$/.test(guildId)) return reply({ error: "Invalid server." }, 400);
      const rawCursor = request.nextUrl.searchParams.get("cursor");
      const cursor = rawCursor ? decodeDirectoryCursor(rawCursor, guildId) : null;
      if (rawCursor !== null && !cursor) return reply({ error: "Invalid directory cursor." }, 400);
      try { await directoryLimiter.consume(userId); }
      catch { return reply({ error: "Too many directory requests. Please retry shortly." }, 429); }
      return reply(await visibleDirectory(guildId, session.accessToken, cursor));
    }
    const [guilds, { accounts, visibility }] = await Promise.all([
      memberGuilds(session.accessToken).catch(() => null),
      session ? memberGuilds(session.accessToken).catch(() => null) : Promise.resolve(null),
      prisma.$transaction(async (tx: Prisma.TransactionClient) => ({
        accounts: await tx.$queryRaw<{ provider: string; providerId: string; revision: string | null; label: string; url: string }[]>`SELECT a."provider", a."providerId", r."revision", a."label", a."url" FROM "PersonalSocialAccount" a LEFT JOIN "PersonalSocialRevision" r ON r."userId" = a."userId" AND r."provider" = a."provider" WHERE a."userId" = ${userId}`,
        visibility: await tx.$queryRaw<{ provider: string; guildId: string }[]>`SELECT "provider", "guildId" FROM "PersonalSocialVisibility" WHERE "userId" = ${userId}`,
      })),
    ]);
    return reply({
      providers: SOCIAL_PROVIDERS.map((id) => ({ id, status: isSocialOAuthProvider(id) ? socialProviderStatus(id) : "unsupported" })),
      guilds: (guilds || []).map(({ id, name }) => ({ id, name })), guildsVerified: guilds !== null, accounts, visibility,
      identityType: session ? "discord" : "browser",
    });
  } catch {
    return reply({ error: "Could not load provider profiles. Please retry." }, 503);
  }
}

export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return reply({ error: "Invalid request origin." }, 403);
  const session = await readDashboardSessionValue(request.cookies.get(DASHBOARD_SESSION_COOKIE)?.value);
  const guestId = readPersonalSocialGuestId(request);
  const userId = session?.user.id || guestId || "";
  if (!userId) return reply({ error: "Open the Gaming Hub or sign in with Discord first." }, 401);
  try { await enforceDashboardRateLimit(request, "personal_social_write", userId); }
  catch { return reply({ error: "Too many requests." }, 429); }
  let input: { action?: string; provider?: string; guildId?: string; visible?: boolean; expectedProviderId?: string; expectedRevision?: string };
  try { input = await request.json(); } catch { return reply({ error: "Invalid request." }, 400); }
  if (!input || typeof input.provider !== "string" || !isSocialOAuthProvider(input.provider)) return reply({ error: "Unsupported provider." }, 400);
  try {
    if (input.action === "disconnect") {
      await disconnectSocial(input.provider, userId);
      return reply({ success: true });
    }
    if (input.action !== "visibility" || typeof input.visible !== "boolean" || !/^\d{1,20}$/.test(input.guildId || "")) return reply({ error: "Invalid request." }, 400);
    if (!session) return reply({ error: "Discord sign-in is required for server sharing." }, 403);
    const guildId = input.guildId!;
    if (input.visible) {
      if (typeof input.expectedProviderId !== "string" || !input.expectedProviderId || input.expectedProviderId.length > 128) return reply({ error: "Account identity is required." }, 400);
      if (typeof input.expectedRevision !== "string" || !/^[a-f0-9]{32}$/.test(input.expectedRevision)) return reply({ error: "Sharing version is required. Refresh and try again." }, 400);
      if (!(await memberGuilds(session.accessToken)).some((guild) => guild.id === guildId)) return reply({ error: "You must be a server member." }, 403);
      const applied = await setSocialVisibility(input.provider, userId, guildId, true, input.expectedProviderId, input.expectedRevision);
      if (!applied) return reply({ error: "Your account or sharing choices changed. Refresh and choose sharing again." }, 409);
    } else {
      await setSocialVisibility(input.provider, userId, guildId, false);
    }
    return reply({ success: true });
  } catch {
    return reply({ error: "Could not update your settings. Please retry." }, 503);
  }
}
