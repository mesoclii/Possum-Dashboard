import type { NextApiRequest, NextApiResponse } from "next";
import { BOT_API, buildBotApiHeaders, readActorUserId, readJsonSafe } from "@/lib/botApi";
import { auditDashboardEvent } from "@/lib/dashboardAudit";
import { enforceDashboardRateLimit, isRateLimitError } from "@/lib/rateLimiter";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    try {
      await enforceDashboardRateLimit(req, "dashboard_access_config");
    } catch (error) {
      if (isRateLimitError(error)) {
        return res.status(429).json({ success: false, error: "Too many dashboard access policy requests. Please retry shortly." });
      }
    }

    if (!await readActorUserId(req)) {
      return res.status(401).json({ success: false, error: "A valid dashboard session is required." });
    }

    const guildId =
      req.method === "GET"
        ? String(req.query.guildId || "").trim()
        : String(req.body?.guildId || "").trim();

    if (!guildId) {
      return res.status(400).json({ success: false, error: "guildId is required" });
    }

    if (req.method === "GET") {
      const upstream = await fetch(`${BOT_API}/dashboard-access-config?guildId=${encodeURIComponent(guildId)}`, {
        headers: await buildBotApiHeaders(req),
        cache: "no-store",
      });
      const data = await readJsonSafe(upstream);
      return res.status(upstream.status).json(data);
    }

    if (req.method === "POST" || req.method === "PUT") {
      const patch = req.body?.patch || req.body?.config || {};
      const upstream = await fetch(`${BOT_API}/dashboard-access-config`, {
        method: "POST",
        headers: await buildBotApiHeaders(req, { json: true }),
        body: JSON.stringify({ guildId, patch }),
      });
      const data = await readJsonSafe(upstream);
      void auditDashboardEvent({
        guildId,
        actorUserId: String(req.headers["x-dashboard-user-id"] || req.body?.userId || "").trim() || null,
        area: "bot_masters",
        action: "save_access_control",
        severity: upstream.ok ? "info" : "error",
        metadata: { keys: Object.keys(patch) },
      });
      return res.status(upstream.status).json(data);
    }

    return res.status(405).json({ success: false, error: "Method not allowed" });
  } catch (error) {
    return res.status(500).json({ success: false, error: error instanceof Error ? error.message : "Bot API unreachable" });
  }
}
