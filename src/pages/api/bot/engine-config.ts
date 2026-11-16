import type { NextApiRequest, NextApiResponse } from "next";
import { auditDashboardEvent } from "@/lib/dashboardAudit";
import {
  readGuildIdFromRequest,
  isWriteBlockedForGuild,
  stockLockError,
} from "@/lib/guildPolicy";
import { BOT_API, buildBotApiHeaders, fetchBotApi, readActorUserId, readJsonSafe } from "@/lib/botApi";
import { enforceDashboardRateLimit, isRateLimitError } from "@/lib/rateLimiter";
import { requirePremiumAccess } from "@/lib/premiumGuard";

function normalizeWriteBody(req: NextApiRequest, guildId: string) {
  const body = req.body && typeof req.body === "object" ? { ...req.body } : {};
  body.guildId = guildId;

  if (
    typeof body.engine === "string" &&
    body.engine.trim() &&
    body.config === undefined &&
    body.patch !== undefined
  ) {
    body.config = body.patch;
  }

  return body;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    try {
      await enforceDashboardRateLimit(req, "bot_engine_config");
    } catch (error: any) {
      if (isRateLimitError(error)) {
        return res.status(429).json({ success: false, error: "Too many engine config requests. Please retry shortly." });
      }
    }

    const guildId = readGuildIdFromRequest(req);

    if (req.method === "GET") {
      const actorUserId = await readActorUserId(req);
      if (!actorUserId) {
        return res.status(401).json({ success: false, error: "A valid dashboard session is required." });
      }

      const engine = String(req.query.engine || "").trim();

      if (!guildId) {
        return res.status(400).json({ success: false, error: "guildId is required" });
      }
      if (engine) {
        const allowed = await requirePremiumAccess(req, res, guildId, engine);
        if (allowed !== true) return allowed;
      }

      const query = new URLSearchParams({ guildId });
      if (engine) query.set("engine", engine);
      const upstream = await fetchBotApi(`${BOT_API}/engine-config?${query.toString()}`, {
        headers: await buildBotApiHeaders(req),
        cache: "no-store",
      });
      return res.status(upstream.status).json(await readJsonSafe(upstream));
    }

    if (req.method === "POST" || req.method === "PUT") {
      if (!guildId) {
        return res.status(400).json({ success: false, error: "guildId is required" });
      }

      if (isWriteBlockedForGuild(guildId)) {
        return res.status(403).json(stockLockError(guildId));
      }

      const body = normalizeWriteBody(req, guildId);
      if (typeof body.engine === "string" && body.engine.trim()) {
        const allowed = await requirePremiumAccess(req, res, guildId, body.engine);
        if (allowed !== true) return allowed;
      }
      const upstream = await fetchBotApi(`${BOT_API}/engine-config`, {
        method: req.method,
        headers: await buildBotApiHeaders(req, { json: true }),
        body: JSON.stringify(body),
      });

      const data = await readJsonSafe(upstream);
      void auditDashboardEvent({
        guildId,
        actorUserId: String(req.headers["x-dashboard-user-id"] || req.body?.userId || req.query?.userId || "").trim() || null,
        area: "engine_config",
        action: `${String(body.engine || "unknown")}:save`,
        severity: upstream.ok ? "info" : "error",
        metadata: {
          engine: body.engine || null,
          keys: Object.keys((body.config && typeof body.config === "object" ? body.config : {}) || {}),
        },
      });
      return res.status(upstream.status).json(data);
    }

    return res.status(405).json({ success: false, error: "Method not allowed" });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      error: err?.message || "Bot API unreachable",
    });
  }
}
