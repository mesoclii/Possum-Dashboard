import type { NextApiRequest, NextApiResponse } from "next";
import { BOT_API, buildBotApiHeaders, fetchBotApi, readActorUserId, readJsonSafe } from "@/lib/botApi";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const viewerUserId = await readActorUserId(req);
  if (!viewerUserId) {
    return res.status(401).json({ success: false, error: "A valid dashboard session is required." });
  }

  try {
    const headers = await buildBotApiHeaders(req);
    if (req.method === "GET") {
      const guildId = String(req.query.guildId || "").trim();
      const format = String(req.query.format || "").trim();
      const exportFlag = String(req.query.export || "").trim();
      const upstream = await fetchBotApi(
        `${BOT_API}/infrastructure?guildId=${encodeURIComponent(guildId)}&format=${encodeURIComponent(format)}&export=${encodeURIComponent(exportFlag)}`,
        { headers, cache: "no-store" }
      );
      return res.status(upstream.status).json(await readJsonSafe(upstream));
    }

    if (req.method === "POST") {
      const postHeaders = await buildBotApiHeaders(req, { json: true });
      const upstream = await fetchBotApi(`${BOT_API}/infrastructure`, {
        method: "POST",
        headers: postHeaders,
        body: JSON.stringify(req.body || {}),
        cache: "no-store",
      });
      return res.status(upstream.status).json(await readJsonSafe(upstream));
    }

    return res.status(405).json({ success: false, error: "Method not allowed" });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error?.message || "Bot API unreachable" });
  }
}
