import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Liveness only: this endpoint deliberately avoids Prisma, Discord, and external dependencies.
export async function GET() {
  return NextResponse.json(
    { ok: true, service: "possum-dashboard", timestamp: new Date().toISOString() },
    { headers: { "cache-control": "no-store" } }
  );
}
