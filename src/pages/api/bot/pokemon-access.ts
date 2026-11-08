import type { NextApiRequest, NextApiResponse } from "next";
import { MASTER_OWNER_USER_ID } from "@/lib/dashboardOwner";
import { BOT_API, buildBotApiHeaders, fetchBotApi, readActorUserId, readJsonSafe } from "@/lib/botApi";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const actorUserId = await readActorUserId(req);
  if (!actorUserId) {
    return res.status(401).json({ success: false, error: "A valid dashboard session is required." });
  }
  if (actorUserId !== MASTER_OWNER_USER_ID) {
    return res.status(403).json({ success: false, error: "Pokémon access controls are available only to the Possum creator." });
  }

  if (req.method !== "GET" && req.method !== "POST") {
    return res.status(405).json({ success: false, error: "Method not allowed." });
  }

  try {
    const headers = await buildBotApiHeaders(req, { json: req.method === "POST" });
    const upstream = await fetchBotApi(`${BOT_API}/api/pokemon/access`, {
      method: req.method,
      headers,
      body: req.method === "POST" ? JSON.stringify(req.body || {}) : undefined,
      cache: "no-store",
    });
    return res.status(upstream.status).json(await readJsonSafe(upstream));
  } catch (error: unknown) {
    return res.status(502).json({
      success: false,
      error: error instanceof Error ? error.message : "Could not reach the bot API.",
    });
  }
}
