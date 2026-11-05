import { NextRequest } from "next/server";
import { proxyAiBilling } from "@/lib/aiBillingProxy";

export async function GET(request: NextRequest) {
  return proxyAiBilling(request, "/api/ai-billing/summary", "GET", []);
}
