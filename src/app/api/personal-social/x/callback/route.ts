import { socialCallback } from "@/lib/personalSocialRoutes";
import type { NextRequest } from "next/server";
export function GET(request: NextRequest) { return socialCallback(request, "x"); }
