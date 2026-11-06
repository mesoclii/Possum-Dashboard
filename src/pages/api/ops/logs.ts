import type { NextApiRequest, NextApiResponse } from "next";
import { proxyOps, queryString } from "@/lib/opsProxy";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ success: false, error: "Method not allowed" });
  }
  return proxyOps(req, res, `/v1/logs${queryString(req, ["source", "severity", "limit"])}`);
}
