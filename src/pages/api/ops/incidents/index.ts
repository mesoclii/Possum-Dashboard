import type { NextApiRequest, NextApiResponse } from "next";
import { proxyOps, queryString } from "@/lib/opsProxy";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === "DELETE") {
    return proxyOps(req, res, "/v1/incidents/resolved", {
      method: "DELETE",
      body: { actor: req.body?.actor },
    });
  }
  if (req.method === "GET") return proxyOps(req, res, `/v1/incidents${queryString(req, ["status", "limit"])}`);
  return res.status(405).json({ success: false, error: "Method not allowed" });
}
