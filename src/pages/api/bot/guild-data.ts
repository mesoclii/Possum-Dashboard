import type { NextApiRequest, NextApiResponse } from "next";
import { BOT_API, buildBotApiHeaders, fetchBotApi, readActorUserId, readJsonSafe } from "@/lib/botApi";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ success: false, error: "Method not allowed" });
  }

  const guildId = String(req.query.guildId || "").trim();
  const viewerUserId = await readActorUserId(req);
  if (!viewerUserId) {
    return res.status(401).json({ success: false, error: "A valid dashboard session is required." });
  }
  if (!guildId) {
    return res.status(400).json({ success: false, error: "guildId is required" });
  }

  try {
    const upstream = await fetchBotApi(
      `${BOT_API}/guild-data?guildId=${encodeURIComponent(guildId)}${String(req.query.fresh || "").trim() === "1" ? "&refresh=1" : ""}`,
      { headers: await buildBotApiHeaders(req), cache: "no-store" }
    );
    return res.status(upstream.status).json(await readJsonSafe(upstream));
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      error: err?.message || "Bot API unreachable",
    });
  }
}
