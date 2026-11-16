import type { NextApiRequest, NextApiResponse } from "next";
import { BOT_API, buildBotApiHeaders, fetchBotApi, readJsonSafe } from "@/lib/botApi";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method !== "GET") {
      return res.status(405).json({ success: false, error: "Method not allowed" });
    }

    const guildId = String(req.query.guildId || "").trim();
    if (!guildId) {
      return res.status(400).json({ success: false, error: "guildId is required" });
    }

    const upstream = await fetchBotApi(
      `${BOT_API}/api/native-commands/${encodeURIComponent(guildId)}`,
      { headers: await buildBotApiHeaders(req), cache: "no-store" }
    );
    return res.status(upstream.status).json(await readJsonSafe(upstream));
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err?.message || "Bot API unreachable" });
  }
}
