import type { NextApiRequest, NextApiResponse } from "next";
import { BOT_API, buildBotApiHeaders, fetchBotApi, readJsonSafe } from "@/lib/botApi";
import { enforceDashboardRateLimit, isRateLimitError } from "@/lib/rateLimiter";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    try {
      await enforceDashboardRateLimit(req, "bot_engine_health");
    } catch (error: any) {
      if (isRateLimitError(error)) {
        return res.status(429).json({ success: false, error: "Too many engine health requests. Please retry shortly." });
      }
    }

    if (req.method !== "GET") {
      return res.status(405).json({ success: false, error: "Method not allowed" });
    }

    const guildId = String(req.query.guildId || "").trim();
    const query = new URLSearchParams();
    if (guildId) query.set("guildId", guildId);

    const upstream = await fetchBotApi(`${BOT_API}/engine-health?${query.toString()}`, {
      headers: await buildBotApiHeaders(req),
      cache: "no-store",
    });
    return res.status(upstream.status).json(await readJsonSafe(upstream));
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err?.message || "Bot API unreachable" });
  }
}
