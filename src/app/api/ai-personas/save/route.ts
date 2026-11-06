import { NextRequest } from "next/server";
import { proxyAiBilling } from "@/lib/aiBillingProxy";

export async function POST(request: NextRequest) {
  return proxyAiBilling(request, "/api/ai-personas/save", "POST", ["persona"]);
}
