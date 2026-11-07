import type { NextApiRequest, NextApiResponse } from "next";
import { callAgent, firstQueryValue, requireOpsOwner } from "@/lib/opsProxy";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") return res.status(405).json({ success: false, error: "Method not allowed" });
  const actor = await requireOpsOwner(req, res);
  if (!actor) return;
  const rawLimit = Number(firstQueryValue(req.query.limit) || 50);
  const limit = Math.max(1, Math.min(200, Number.isFinite(rawLimit) ? rawLimit : 50));
  const result = await callAgent({ path: `/v1/incidents?limit=${limit}`, actor });
  res.setHeader("cache-control", "private, no-store");
  if (!result.ok) return res.status(result.status).json({ success: false, error: result.error });
  const rows = Array.isArray((result.data as any)?.incidents) ? (result.data as any).incidents : [];
  const incidents = rows.map((item: any) => ({
    id: String(item?.id || ""),
    ref: String(item?.ref || item?.id || ""),
    title: String(item?.title || "Untitled incident"),
    severity: String(item?.severity || "warning"),
    status: String(item?.status || "open"),
    service: String(item?.service || item?.source || "system"),
    occurrences: Number(item?.occurrences || 1),
    firstSeenAt: String(item?.firstSeenAt || item?.createdAt || ""),
    lastSeenAt: String(item?.lastSeenAt || item?.createdAt || ""),
    summary: String(item?.summary || item?.detail || ""),
  })).reverse();
  return res.status(200).json({ success: true, data: { incidents } });
}
