import { NextRequest, NextResponse } from "next/server";
import { opsAgentRequest, opsError, requireOpsOwner } from "@/lib/opsAgent";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SOURCES = new Set(["bot-out", "bot-error", "dashboard-out", "dashboard-error", "bridge-out", "bridge-error", "ops-out", "ops-error"]);

export async function GET(request: NextRequest) {
  const auth = await requireOpsOwner(request);
  if (auth.response) return auth.response;
  const source = String(request.nextUrl.searchParams.get("source") || "");
  const severity = String(request.nextUrl.searchParams.get("severity") || "");
  const limit = Math.max(1, Math.min(500, Number(request.nextUrl.searchParams.get("limit") || 200)));
  const query = new URLSearchParams({ limit: String(limit) });
  const sourceAliases: Record<string, string> = { "dash-out": "dashboard-out", "dash-error": "dashboard-error" };
  const normalizedSource = sourceAliases[source] || source;
  if (SOURCES.has(normalizedSource)) query.set("kind", normalizedSource);
  const result = await opsAgentRequest(`/v1/logs?${query.toString()}`);
  if (!result.ok) return opsError(result);
  const lines = (Array.isArray(result.body?.logs) ? result.body.logs : [])
    .map((line: any) => ({
      source: String(line.kind || "unknown"),
      label: String(line.kind || ""),
      level: String(line.severity || "info"),
      category: String(line.kind || "runtime"),
      text: String(line.line || ""),
    }))
    .filter((line: any) => !severity || severity === "all" || line.level === severity);
  return NextResponse.json({ success: true, data: { lines: lines.slice(-limit) } });
}
