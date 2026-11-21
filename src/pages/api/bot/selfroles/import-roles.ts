import type { NextApiRequest, NextApiResponse } from "next";
import { BOT_API, buildBotApiHeaders, readActorUserId, readJsonSafe } from "@/lib/botApi";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ success: false, error: "Method not allowed." });
  if (!await readActorUserId(req)) return res.status(401).json({ success: false, error: "A valid dashboard session is required." });
  try {
    const upstream = await fetch(`${BOT_API}/selfroles/import-roles`, {
      method: "POST",
      headers: await buildBotApiHeaders(req, { json: true }),
      body: JSON.stringify(req.body || {}),
    });
    const payload = await readJsonSafe(upstream);
    return res.status(upstream.status).json(payload);
  } catch (error) {
    return res.status(502).json({ success: false, error: error instanceof Error ? error.message : "Bot API unreachable." });
  }
}
