import crypto from "node:crypto";
import type { NextRequest, NextResponse } from "next/server";
import { DASHBOARD_SESSION_COOKIE, readDashboardSessionValue } from "@/lib/session";

export const PUBLIC_GAMING_GUEST_COOKIE = "possum_gaming_guest";
const guestIdPattern = /^guest_[0-9a-f-]{36}$/i;

type GamingActor = { id: string; guest: boolean; cookieValue?: string };

function secret() {
  const value = String(process.env.SESSION_SECRET || "").trim();
  if (!value) throw new Error("SESSION_SECRET is required for public Gaming Hub accounts.");
  return value;
}

function sign(id: string) {
  return crypto.createHmac("sha256", secret()).update(id).digest("hex");
}

function readGuestCookie(value: string | undefined) {
  const [id, signature, extra] = String(value || "").split(".");
  if (extra || !guestIdPattern.test(id || "") || !/^[a-f0-9]{64}$/i.test(signature || "")) return "";
  const expected = Buffer.from(sign(id), "hex");
  const actual = Buffer.from(signature, "hex");
  return expected.length === actual.length && crypto.timingSafeEqual(expected, actual) ? id : "";
}

export function readPublicGamingGuestIdFromCookie(value: string | undefined) {
  return readGuestCookie(value);
}

export async function publicGamingActor(request: NextRequest, createGuest = false): Promise<GamingActor | null> {
  const sessionValue = request.cookies.get(DASHBOARD_SESSION_COOKIE)?.value;
  const session = await readDashboardSessionValue(sessionValue).catch(() => null);
  const discordId = String(session?.user?.id || "").trim();
  if (/^\d{16,20}$/.test(discordId)) return { id: discordId, guest: false };

  const cookieValue = request.cookies.get(PUBLIC_GAMING_GUEST_COOKIE)?.value;
  const guestId = readGuestCookie(cookieValue);
  if (guestId) return { id: guestId, guest: true };
  if (!createGuest) return null;

  const id = "guest_" + crypto.randomUUID();
  return { id, guest: true, cookieValue: id + "." + sign(id) };
}

export function attachPublicGamingGuestCookie(response: NextResponse, actor: GamingActor | null, request: NextRequest) {
  if (!actor?.guest || !actor.cookieValue) return response;
  response.cookies.set(PUBLIC_GAMING_GUEST_COOKIE, actor.cookieValue, {
    httpOnly: true,
    secure: request.nextUrl.protocol === "https:",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  return response;
}
