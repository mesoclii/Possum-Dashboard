import type { NextApiRequest, NextApiResponse } from "next";
import { auditDashboardEvent } from "@/lib/dashboardAudit";
import { isWriteBlockedForGuild, stockLockError } from "@/lib/guildPolicy";
import { BOT_API, buildBotApiHeaders, readActorUserId, readJsonSafe } from "@/lib/botApi";
import { requirePremiumAccess } from "@/lib/premiumGuard";
import { enforceDashboardRateLimit, isRateLimitError } from "@/lib/rateLimiter";
import { normalizeEngineKey } from "@/lib/engineKeys";

export const config = {
  api: {
    bodyParser: {
      sizeLimit: "12mb",
    },
  },
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    try {
      await enforceDashboardRateLimit(req, "runtime_engine_action");
    } catch (error: any) {
      if (isRateLimitError(error)) {
        return res.status(429).json({ success: false, error: "Too many runtime actions. Please retry shortly." });
      }
    }

    if (req.method !== "POST") {
      return res.status(405).json({ success: false, error: "Method not allowed" });
    }

    const actorUserId = await readActorUserId(req);
    if (!actorUserId) {
      return res.status(401).json({ success: false, error: "A valid dashboard session is required." });
    }

    const guildId = String(req.body?.guildId || "").trim();
    const engine = String(req.body?.engine || "").trim();
    const normalizedEngine = normalizeEngineKey(engine);
    const action = String(req.body?.action || "").trim();
    const payload = req.body?.payload && typeof req.body.payload === "object" ? req.body.payload : undefined;

    if (!guildId) {
      return res.status(400).json({ success: false, error: "guildId is required" });
    }
    if (!normalizedEngine) {
      return res.status(400).json({ success: false, error: "engine is required" });
    }
    if (!action) {
      return res.status(400).json({ success: false, error: "action is required" });
    }

    if (isWriteBlockedForGuild(guildId)) {
      return res.status(403).json(stockLockError(guildId));
    }

    const allowed = await requirePremiumAccess(req, res, guildId, normalizedEngine);
    if (allowed !== true) return allowed;

    const upstream = await fetch(`${BOT_API}/engine-runtime/action`, {
      method: "POST",
      headers: await buildBotApiHeaders(req, { json: true }),
      body: JSON.stringify({
        guildId,
        engine: normalizedEngine,
        action,
        userId: actorUserId,
        routePath: String(req.body?.routePath || req.body?.route || "").trim(),
        payload,
      }),
    });
    const json = await readJsonSafe(upstream);
    void auditDashboardEvent({
      guildId,
      actorUserId,
      area: "runtime_engine_action",
      action: `${normalizedEngine}:${action}`,
      severity: upstream.ok ? "info" : "error",
      metadata: {
        engine: normalizedEngine,
        action,
        payloadKeys: payload ? Object.keys(payload) : [],
      },
    });
    return res.status(upstream.status).json(json);
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err?.message || "Internal error" });
  }
}
