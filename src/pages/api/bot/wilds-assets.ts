import type { NextApiRequest, NextApiResponse } from "next";
import { auditDashboardEvent } from "@/lib/dashboardAudit";
import { readGuildIdFromRequest, isWriteBlockedForGuild, stockLockError } from "@/lib/guildPolicy";
import { BOT_API, buildBotApiHeaders, fetchBotApi, readActorUserId, readJsonSafe } from "@/lib/botApi";
import { enforceDashboardRateLimit, isRateLimitError } from "@/lib/rateLimiter";

// Proxies the Possum Wilds species art registry to the bot. The bot owns the
// manifest file; this route only forwards, and refuses writes for stock-locked
// guilds exactly like the other bot-backed editors.
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    try {
      await enforceDashboardRateLimit(req, "bot_wilds_assets");
    } catch (error: any) {
      if (isRateLimitError(error)) {
        return res.status(429).json({ success: false, error: "Too many asset requests. Please retry shortly." });
      }
    }

    const guildId = readGuildIdFromRequest(req);
    if (!guildId) {
      return res.status(400).json({ success: false, error: "guildId is required" });
    }

    const actorUserId = await readActorUserId(req);
    if (!actorUserId) {
      return res.status(401).json({ success: false, error: "A valid dashboard session is required." });
    }

    if (req.method === "GET") {
      const upstream = await fetchBotApi(`${BOT_API}/wilds-assets?guildId=${encodeURIComponent(guildId)}`, {
        headers: await buildBotApiHeaders(req),
        cache: "no-store",
      });
      const data = await readJsonSafe(upstream);
      return res.status(upstream.status).json(data);
    }

    if (req.method === "POST" || req.method === "PUT") {
      if (isWriteBlockedForGuild(guildId)) {
        return res.status(403).json(stockLockError(guildId));
      }

      const body = {
        ...(req.body && typeof req.body === "object" ? req.body : {}),
        guildId,
        userId: actorUserId,
      };

      const upstream = await fetchBotApi(`${BOT_API}/wilds-assets`, {
        method: "POST",
        headers: await buildBotApiHeaders(req, { json: true }),
        body: JSON.stringify(body),
      });
      const data = await readJsonSafe(upstream);

      const slugs = Object.keys((body.species && typeof body.species === "object" ? body.species : {}) || {});
      void auditDashboardEvent({
        guildId,
        actorUserId,
        area: "wilds_assets",
        action: "species-art:save",
        severity: upstream.ok ? "info" : "error",
        metadata: { count: slugs.length, rejected: Array.isArray(data?.rejected) ? data.rejected.length : 0 },
      });

      return res.status(upstream.status).json(data);
    }

    return res.status(405).json({ success: false, error: "Method not allowed" });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err?.message || "Bot API unreachable" });
  }
}
