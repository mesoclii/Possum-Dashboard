import { NextRequest, NextResponse } from "next/server";
import { opsAgentRequest, opsError, requireOpsOwner } from "@/lib/opsAgent";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const auth = await requireOpsOwner(request);
  if (auth.response) return auth.response;
  const result = await opsAgentRequest("/v1/alerts/test", { method: "POST", body: "{}" });
  if (!result.ok) return opsError(result);
  return NextResponse.json({ success: true, data: result.body });
}
