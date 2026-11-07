import { NextRequest, NextResponse } from "next/server";
import { opsAgentRequest, opsError, requireOpsOwner } from "@/lib/opsAgent";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = await requireOpsOwner(request);
  if (auth.response) return auth.response;
  const result = await opsAgentRequest("/v1/alerts/config");
  if (!result.ok) return opsError(result);
  const config = result.body?.config || {};
  return NextResponse.json({
    success: true,
    data: {
      webhookConfigured: Boolean(config.webhookConfigured),
      alertRepeatMs: Number(config.repeatMs || 0),
      maxDeliveryAttempts: null,
      delivery: { pending: 0 },
    },
  });
}
