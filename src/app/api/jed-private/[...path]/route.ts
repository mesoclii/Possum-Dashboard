import { NextResponse } from "next/server";

function unavailable() {
  return NextResponse.json(
    { available: false, error: "Private JED media is not enabled." },
    { status: 503, headers: { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } }
  );
}

export const GET = unavailable;
export const POST = unavailable;
export const DELETE = unavailable;
