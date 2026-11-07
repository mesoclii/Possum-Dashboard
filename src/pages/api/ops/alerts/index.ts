import type { NextApiRequest, NextApiResponse } from "next";
import { callAgent, requireOpsOwner } from "@/lib/opsProxy";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") return res.status(405).json({ success: false, error: "Method not allowed" });
  const actor = await requireOpsOwner(req, res);
  if (!actor) return;
  const result = await callAgent({ path: "/v1/alerts/config", actor });
  res.setHeader("cache-control", "private, no-store");
  if (!result.ok) return res.status(result.status).json({ success: false, error: result.error });
  const config = (result.data as any)?.config || {};
  return res.status(200).json({
    success: true,
    data: {
      webhookConfigured: Boolean(config.webhookConfigured),
      alertRepeatMs: Number(config.repeatMs || 0),
      maxDeliveryAttempts: null,
      delivery: { pending: 0 },
    },
  });
}
