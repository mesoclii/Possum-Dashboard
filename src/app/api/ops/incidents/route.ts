import { NextRequest, NextResponse } from "next/server";
import { normalizeIncident, opsAgentRequest, opsError, requireOpsOwner } from "@/lib/opsAgent";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = await requireOpsOwner(request);
  if (auth.response) return auth.response;
  const limit = Math.max(1, Math.min(200, Number(request.nextUrl.searchParams.get("limit") || 50)));
  const result = await opsAgentRequest(`/v1/incidents?limit=${limit}`);
  if (!result.ok) return opsError(result);
  const incidents = (Array.isArray(result.body?.incidents) ? result.body.incidents : []).map(normalizeIncident).reverse();
  return NextResponse.json({ success: true, data: { incidents } });
}
