import { socialStart } from "@/lib/personalSocialRoutes";
import type { NextRequest } from "next/server";
export function POST(request: NextRequest) { return socialStart(request, "youtube"); }
