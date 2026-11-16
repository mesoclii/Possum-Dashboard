import type { NextApiRequest, NextApiResponse } from "next";
import { BOT_API, buildBotApiHeaders, fetchBotApi, readActorUserId, readJsonSafe } from "@/lib/botApi";
import { enforceDashboardRateLimit, isRateLimitError } from "@/lib/rateLimiter";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    try {
      await enforceDashboardRateLimit(req, "bot_engine_catalog");
    } catch (error: any) {
      if (isRateLimitError(error)) {
        return res.status(429).json({ success: false, error: "Too many engine catalog requests. Please retry shortly." });
      }
    }

    if (req.method !== "GET") {
      return res.status(405).json({ success: false, error: "Method not allowed" });
    }

    if (!(await readActorUserId(req))) {
      return res.status(401).json({ success: false, error: "A valid dashboard session is required." });
    }

    const params = new URLSearchParams();
    const guildId = String(req.query.guildId || "").trim();
    const engine = String(req.query.engine || "").trim();

    if (guildId) params.set("guildId", guildId);
    if (engine) params.set("engine", engine);

    const upstream = await fetchBotApi(`${BOT_API}/engine-catalog${params.toString() ? `?${params.toString()}` : ""}`, {
      headers: await buildBotApiHeaders(req),
      cache: "no-store",
    });
    return res.status(upstream.status).json(await readJsonSafe(upstream));
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err?.message || "Bot engine catalog unreachable" });
  }
}
