import { NextRequest, NextResponse } from "next/server";
import { opsAgentRequest, opsError, requireOpsOwner } from "@/lib/opsAgent";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = await requireOpsOwner(request);
  if (auth.response) return auth.response;

  const result = await opsAgentRequest("/v1/overview");
  if (!result.ok) return opsError(result);

  // The modular agent already returns the OperationsClient contract inside data.
  const data = result.body?.data;
  if (!data || typeof data !== "object") {
    return NextResponse.json({ success: false, error: "Operations agent returned an invalid overview." }, { status: 502 });
  }

  return NextResponse.json({
    success: true,
    data: {
      agent: data.agent || null,
      host: data.host || null,
      gateway: data.gateway || null,
      pm2: data.pm2 || null,
      services: Array.isArray(data.services) ? data.services : [],
      http: data.http || {},
      incidents: data.incidents || {},
      delivery: data.delivery || {},
    },
  });
}
