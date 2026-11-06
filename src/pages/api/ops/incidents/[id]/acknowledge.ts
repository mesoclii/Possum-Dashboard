import type { NextApiRequest, NextApiResponse } from "next";
import { firstQueryValue, proxyOps } from "@/lib/opsProxy";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ success: false, error: "Method not allowed" });
  }

  const id = firstQueryValue(req.query.id);
  if (!id) return res.status(400).json({ success: false, error: "id is required" });

  return proxyOps(req, res, `/v1/incidents/${encodeURIComponent(id)}/acknowledge`, {
    method: "POST",
    body: { actor: req.body?.actor },
  });
}
