import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { DASHBOARD_SESSION_COOKIE, readDashboardSessionValue } from "@/lib/session";
import { decodeDirectoryCursor, disconnectSocial, isSocialOAuthProvider, memberGuilds, sameOrigin, setSocialVisibility, SOCIAL_PROVIDERS, socialProviderStatus, visibleDirectory } from "@/lib/personalSocial";
import { enforceDashboardRateLimit } from "@/lib/rateLimiter";
import { RateLimiterMemory } from "rate-limiter-flexible";

const headers = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" };
const reply = (data: object, status = 200) => NextResponse.json(data, { status, headers });
const directoryLimiter = new RateLimiterMemory({ points: 5, duration: 60 });

export async function GET(request: NextRequest) {
  const session = await readDashboardSessionValue(request.cookies.get(DASHBOARD_SESSION_COOKIE)?.value);
  if (!session) return reply({ error: "Sign in with Discord first." }, 401);
  try { await enforceDashboardRateLimit(request, "personal_social_read", session.user.id); }
  catch { return reply({ error: "Too many requests." }, 429); }
  try {
    const guildId = request.nextUrl.searchParams.get("guildId");
    if (guildId) {
      if (!/^\d{1,20}$/.test(guildId)) return reply({ error: "Invalid server." }, 400);
      const provider = request.nextUrl.searchParams.get("provider");
      if (provider !== null && !isSocialOAuthProvider(provider)) return reply({ error: "Unsupported provider." }, 400);
      const rawCursor = request.nextUrl.searchParams.get("cursor");
      const cursor = rawCursor ? decodeDirectoryCursor(rawCursor, guildId, provider || undefined) : null;
      if (rawCursor !== null && !cursor) return reply({ error: "Invalid directory cursor." }, 400);
      try { await directoryLimiter.consume(session.user.id); }
      catch { return reply({ error: "Too many directory requests. Please retry shortly." }, 429); }
      return reply(await visibleDirectory(guildId, session.accessToken, cursor, provider || undefined));
    }
    const [guilds, { accounts, visibility }] = await Promise.all([
      memberGuilds(session.accessToken).catch(() => null),
      prisma.$transaction(async (tx: Prisma.TransactionClient) => ({
        accounts: await tx.$queryRaw<{ provider: string; providerId: string; revision: string | null; label: string; url: string }[]>`SELECT a."provider", a."providerId", r."revision", a."label", a."url" FROM "PersonalSocialAccount" a LEFT JOIN "PersonalSocialRevision" r ON r."userId" = a."userId" AND r."provider" = a."provider" WHERE a."userId" = ${session.user.id}`,
        visibility: await tx.$queryRaw<{ provider: string; guildId: string }[]>`SELECT "provider", "guildId" FROM "PersonalSocialVisibility" WHERE "userId" = ${session.user.id}`,
      })),
    ]);
    return reply({
      providers: SOCIAL_PROVIDERS.map((id) => ({ id, status: isSocialOAuthProvider(id) ? socialProviderStatus(id) : "unsupported" })),
      guilds: (guilds || []).map(({ id, name }) => ({ id, name })), guildsVerified: guilds !== null, accounts, visibility,
    });
  } catch {
    return reply({ error: "Could not verify Discord membership. Please sign in again or retry." }, 503);
  }
}

export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return reply({ error: "Invalid request origin." }, 403);
  const session = await readDashboardSessionValue(request.cookies.get(DASHBOARD_SESSION_COOKIE)?.value);
  if (!session) return reply({ error: "Sign in with Discord first." }, 401);
  try { await enforceDashboardRateLimit(request, "personal_social_write", session.user.id); }
  catch { return reply({ error: "Too many requests." }, 429); }
  let input: { action?: string; provider?: string; guildId?: string; visible?: boolean; expectedProviderId?: string; expectedRevision?: string };
  try { input = await request.json(); } catch { return reply({ error: "Invalid request." }, 400); }
  if (!input || typeof input.provider !== "string" || !isSocialOAuthProvider(input.provider)) return reply({ error: "Unsupported provider." }, 400);
  try {
    if (input.action === "disconnect") {
      await disconnectSocial(input.provider, session.user.id);
      return reply({ success: true });
    }
    if (input.action !== "visibility" || typeof input.visible !== "boolean" || !/^\d{1,20}$/.test(input.guildId || "")) return reply({ error: "Invalid request." }, 400);
    const guildId = input.guildId!;
    if (input.visible) {
      if (typeof input.expectedProviderId !== "string" || !input.expectedProviderId || input.expectedProviderId.length > 128) return reply({ error: "Account identity is required." }, 400);
      if (typeof input.expectedRevision !== "string" || !/^[a-f0-9]{32}$/.test(input.expectedRevision)) return reply({ error: "Sharing version is required. Refresh and try again." }, 400);
      if (!(await memberGuilds(session.accessToken)).some((guild) => guild.id === guildId)) return reply({ error: "You must be a server member." }, 403);
      const applied = await setSocialVisibility(input.provider, session.user.id, guildId, true, input.expectedProviderId, input.expectedRevision);
      if (!applied) return reply({ error: "Your account or sharing choices changed. Refresh and choose sharing again." }, 409);
    } else {
      await setSocialVisibility(input.provider, session.user.id, guildId, false);
    }
    return reply({ success: true });
  } catch {
    return reply({ error: "Could not update your settings. Please retry." }, 503);
  }
}
