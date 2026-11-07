import { NextRequest, NextResponse } from "next/server";
import { opsAgentRequest, opsError, requireOpsOwner } from "@/lib/opsAgent";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = await requireOpsOwner(request);
  if (auth.response) return auth.response;

  const params = request.nextUrl.searchParams;
  const resolution = String(params.get("resolution") || "raw");
  if (!["raw", "1m", "5m"].includes(resolution)) {
    return NextResponse.json({ success: false, error: "Invalid metrics resolution." }, { status: 400 });
  }
  const rangeMs = Math.max(60_000, Math.min(180 * 24 * 60 * 60 * 1000, Number(params.get("rangeMs") || 86_400_000)));
  const limit = Math.max(1, Math.min(2000, Number(params.get("limit") || 500)));
  const query = new URLSearchParams({ resolution, rangeMs: String(rangeMs), limit: String(limit) });
  const result = await opsAgentRequest(`/v1/metrics?${query.toString()}`);
  if (!result.ok) return opsError(result);
  return NextResponse.json({ success: true, data: Array.isArray(result.body?.data) ? result.body.data : [] });
}
