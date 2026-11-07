import { NextRequest, NextResponse } from "next/server";
import { normalizeIncident, opsAgentRequest, opsError, requireOpsOwner } from "@/lib/opsAgent";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await requireOpsOwner(request);
  if (auth.response) return auth.response;
  const { id } = await context.params;
  if (!/^[A-Za-z0-9_-]{1,100}$/.test(id)) return NextResponse.json({ success: false, error: "Invalid incident ID." }, { status: 400 });
  const result = await opsAgentRequest(`/v1/incidents/${encodeURIComponent(id)}`);
  if (!result.ok) return opsError(result);
  return NextResponse.json({ success: true, data: { incident: normalizeIncident(result.body) } });
}
