import type { NextApiRequest, NextApiResponse } from "next";
import { BOT_API, buildBotApiHeaders, readActorUserId, readJsonSafe } from "@/lib/botApi";
import { enforceDashboardRateLimit, isRateLimitError } from "@/lib/rateLimiter";
import { requirePremiumAccess } from "@/lib/premiumGuard";
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
      await enforceDashboardRateLimit(req, "runtime_engine_validate");
    } catch (error: any) {
      if (isRateLimitError(error)) {
        return res.status(429).json({ success: false, error: "Too many validation requests. Please retry shortly." });
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
    const patch =
      req.body?.patch && typeof req.body.patch === "object"
        ? req.body.patch
        : req.body?.config && typeof req.body.config === "object"
          ? req.body.config
          : {};

    if (!guildId) {
      return res.status(400).json({ success: false, error: "guildId is required" });
    }
    if (!normalizedEngine) {
      return res.status(400).json({ success: false, error: "engine is required" });
    }

    const allowed = await requirePremiumAccess(req, res, guildId, normalizedEngine);
    if (allowed !== true) return allowed;

    const upstream = await fetch(`${BOT_API}/engine-runtime/validate`, {
      method: "POST",
      headers: await buildBotApiHeaders(req, { json: true }),
      body: JSON.stringify({ guildId, engine: normalizedEngine, patch }),
    });
    const json = await readJsonSafe(upstream);
    return res.status(upstream.status).json(json);
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err?.message || "Internal error" });
  }
}
