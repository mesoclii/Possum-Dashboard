import { NextRequest, NextResponse } from "next/server";
import { normalizeIncident, opsAgentRequest, opsError, requireOpsOwner } from "@/lib/opsAgent";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = await requireOpsOwner(request);
  if (auth.response) return auth.response;

  const limit = Math.max(1, Math.min(500, Number(request.nextUrl.searchParams.get("limit") || 50)));
  const status = request.nextUrl.searchParams.get("status");
  const query = new URLSearchParams({ limit: String(limit) });
  if (status) query.set("status", status);

  const result = await opsAgentRequest(`/v1/incidents?${query.toString()}`);
  if (!result.ok) return opsError(result);

  const raw = result.body?.data || {};
  const incidents = (Array.isArray(raw.incidents) ? raw.incidents : []).map(normalizeIncident);
  return NextResponse.json({ success: true, data: { incidents, counts: raw.counts || {} } });
}
