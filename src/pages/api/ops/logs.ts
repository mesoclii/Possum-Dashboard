import type { NextApiRequest, NextApiResponse } from "next";
import { callAgent, firstQueryValue, requireOpsOwner } from "@/lib/opsProxy";

const SOURCES = new Set(["bot-out", "bot-error", "dashboard-out", "dashboard-error", "bridge-out", "bridge-error", "ops-out", "ops-error"]);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") return res.status(405).json({ success: false, error: "Method not allowed" });
  const actor = await requireOpsOwner(req, res);
  if (!actor) return;
  const source = firstQueryValue(req.query.source);
  const severity = firstQueryValue(req.query.severity);
  const rawLimit = Number(firstQueryValue(req.query.limit) || 200);
  const limit = Math.max(1, Math.min(500, Number.isFinite(rawLimit) ? rawLimit : 200));
  const aliases: Record<string, string> = { "dash-out": "dashboard-out", "dash-error": "dashboard-error" };
  const normalizedSource = aliases[source] || source;
  const query = new URLSearchParams({ limit: String(limit) });
  if (SOURCES.has(normalizedSource)) query.set("kind", normalizedSource);
  const result = await callAgent({ path: `/v1/logs?${query.toString()}`, actor });
  res.setHeader("cache-control", "private, no-store");
  if (!result.ok) return res.status(result.status).json({ success: false, error: result.error });
  const rows = Array.isArray((result.data as any)?.logs) ? (result.data as any).logs : [];
  const lines = rows.map((line: any) => ({
    source: String(line.kind || "unknown"),
    label: String(line.kind || ""),
    level: String(line.severity || "info"),
    category: String(line.kind || "runtime"),
    text: String(line.line || ""),
  })).filter((line: any) => !severity || severity === "all" || line.level === severity);
  return res.status(200).json({ success: true, data: { lines: lines.slice(-limit) } });
}
