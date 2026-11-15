import type { NextApiRequest, NextApiResponse } from "next";
import {
  SERVER_BOT_API,
  buildServerBotApiHeaders,
  fetchServerBotApi,
  readServerBotApiJson,
} from "@/lib/botApiServer";
import { readActorUserId } from "@/lib/botApi";
import { isDashboardControlOwner } from "@/lib/dashboardOwner";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET" && req.method !== "POST") {
    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ success: false, error: "Method not allowed" });
  }

  const actorUserId = await readActorUserId(req);
  if (!isDashboardControlOwner(actorUserId)) {
    return res.status(403).json({ success: false, error: "Only bot owners can manage provider credentials." });
  }

  try {
    const response = await fetchServerBotApi(`${SERVER_BOT_API}/api/game-provider-auth/settings`, {
      method: req.method,
      headers: {
        ...buildServerBotApiHeaders(actorUserId, { allowFallback: false }),
        ...(req.method === "POST" ? { "Content-Type": "application/json" } : {}),
      },
      ...(req.method === "POST" ? { body: JSON.stringify({ providers: req.body?.providers }) } : {}),
    });
    const json = await readServerBotApiJson(response);
    return res.status(response.status).json(json);
  } catch (error: any) {
    return res.status(502).json({
      success: false,
      error: error?.message || "Could not reach the bot credential service.",
    });
  }
}
