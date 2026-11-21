import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    { error: "Personal social bridge unavailable." },
    { status: 503, headers: { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } },
  );
}
