import type { NextApiRequest, NextApiResponse } from "next";
import { BOT_API, buildBotApiHeaders, fetchBotApi, readJsonSafe, readActorUserId } from "@/lib/botApi";
import { requirePremiumAccess } from "@/lib/premiumGuard";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method !== "GET") {
      return res.status(405).json({ success: false, error: "Method not allowed" });
    }

    if (!(await readActorUserId(req))) {
      return res.status(401).json({ success: false, error: "A valid dashboard session is required." });
    }
    const allowed = await requirePremiumAccess(req, res, "", "openai-platform");
    if (allowed !== true) return allowed;

    const guildId = String(req.query.guildId || "").trim();
    const query = guildId ? `?guildId=${encodeURIComponent(guildId)}` : "";
    const upstream = await fetchBotApi(`${BOT_API}/openai-runtime${query}`, {
      headers: await buildBotApiHeaders(req),
      cache: "no-store",
    });
    const data = await readJsonSafe(upstream);
    return res.status(upstream.status).json(data);
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err?.message || "Bot API unreachable" });
  }
}
