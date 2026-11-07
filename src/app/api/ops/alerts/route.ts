import { NextRequest, NextResponse } from "next/server";
import { opsAgentRequest, opsError, requireOpsOwner } from "@/lib/opsAgent";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = await requireOpsOwner(request);
  if (auth.response) return auth.response;

  const result = await opsAgentRequest("/v1/alerts/config");
  if (!result.ok) return opsError(result);

  const data = result.body?.data;
  if (!data || typeof data !== "object") {
    return NextResponse.json({ success: false, error: "Operations agent returned invalid alert configuration." }, { status: 502 });
  }
  return NextResponse.json({ success: true, data });
}
