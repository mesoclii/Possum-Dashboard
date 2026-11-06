import type { NextApiRequest, NextApiResponse } from "next";
import { proxyOps } from "@/lib/opsProxy";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ success: false, error: "Method not allowed" });
  }
  return proxyOps(req, res, "/v1/alerts/test", { method: "POST", body: {} });
}
