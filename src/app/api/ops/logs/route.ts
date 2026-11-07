import { NextRequest, NextResponse } from "next/server";
import { opsAgentRequest, opsError, requireOpsOwner } from "@/lib/opsAgent";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = await requireOpsOwner(request);
  if (auth.response) return auth.response;

  const source = String(request.nextUrl.searchParams.get("source") || "all");
  const severity = String(request.nextUrl.searchParams.get("severity") || "all");
  const limit = Math.max(1, Math.min(400, Number(request.nextUrl.searchParams.get("limit") || 200)));
  const query = new URLSearchParams({ limit: String(limit), source, severity });

  const result = await opsAgentRequest(`/v1/logs?${query.toString()}`);
  if (!result.ok) return opsError(result);

  const data = result.body?.data || {};
  return NextResponse.json({
    success: true,
    data: {
      sources: Array.isArray(data.sources) ? data.sources : [],
      count: Number(data.count) || 0,
      lines: Array.isArray(data.lines) ? data.lines : [],
    },
  });
}
