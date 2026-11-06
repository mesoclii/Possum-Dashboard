import type { NextApiRequest, NextApiResponse } from "next";
import { BOT_API, buildBotApiHeaders, fetchBotApi, readActorUserId, readJsonSafe } from "@/lib/botApi";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const viewerUserId = await readActorUserId(req);
  if (!viewerUserId) return res.status(401).json({ success: false, error: "A valid dashboard session is required." });
  try {
    const headers = await buildBotApiHeaders(req, { json: req.method !== "GET" });
    if (req.method === "GET") {
      const params = new URLSearchParams();
      for (const [key, value] of Object.entries(req.query)) {
        if (typeof value === "string") params.set(key, value);
      }
      const upstream = await fetchBotApi(`${BOT_API}/api/pro?${params.toString()}`, { headers, cache: "no-store" });
      return res.status(upstream.status).json(await readJsonSafe(upstream));
    }
    if (req.method === "POST") {
      const upstream = await fetchBotApi(`${BOT_API}/api/pro`, {
        method: "POST",
        headers,
        body: JSON.stringify({ ...(req.body || {}), userId: viewerUserId }),
        cache: "no-store",
      });
      return res.status(upstream.status).json(await readJsonSafe(upstream));
    }
    return res.status(405).json({ success: false, error: "Method not allowed" });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error?.message || "Bot API unreachable" });
  }
}
