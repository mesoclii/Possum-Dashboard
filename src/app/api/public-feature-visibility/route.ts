import { NextRequest, NextResponse } from "next/server";
import { MASTER_OWNER_USER_ID } from "@/lib/dashboardOwner";
import { DASHBOARD_SESSION_COOKIE, readDashboardSessionValue } from "@/lib/session";
import {
  readPublicFeatureVisibility,
  writePublicFeatureVisibility,
} from "@/lib/publicFeatureVisibility";

async function isCreator(request: NextRequest) {
  const session = await readDashboardSessionValue(request.cookies.get(DASHBOARD_SESSION_COOKIE)?.value);
  return String(session?.user?.id || "").trim() === MASTER_OWNER_USER_ID;
}

export async function GET(request: NextRequest) {
  const visibility = readPublicFeatureVisibility();
  return NextResponse.json({
    success: true,
    visibility,
    canManage: await isCreator(request),
  });
}

export async function POST(request: NextRequest) {
  if (!(await isCreator(request))) {
    return NextResponse.json(
      { success: false, error: "Only the Possum creator can change public feature visibility." },
      { status: 403 }
    );
  }
  const body = await request.json().catch(() => null);
  try {
    const visibility = writePublicFeatureVisibility(body?.visibility);
    return NextResponse.json({ success: true, visibility });
  } catch (error: unknown) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Could not save feature visibility." },
      { status: 400 }
    );
  }
}
