import crypto from "node:crypto";
import type { NextRequest } from "next/server";

export const PUBLIC_GAMING_GUEST_COOKIE = "possum_public_gaming_guest";
const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

function guestSecret() {
  const secret = String(process.env.SESSION_SECRET || "").trim();
  if (!secret) throw new Error("SESSION_SECRET is not configured.");
  return secret;
}

function signature(value: string) {
  return crypto.createHmac("sha256", guestSecret()).update(value).digest("base64url");
}

export function makePublicGamingGuestCookieValue(id = `guest_${crypto.randomUUID()}`) {
  const expiresAt = Math.floor(Date.now() / 1000) + COOKIE_MAX_AGE_SECONDS;
  const signed = `${id}.${expiresAt}`;
  return { value: `${signed}.${signature(signed)}`, maxAge: COOKIE_MAX_AGE_SECONDS };
}

export function readPublicGamingGuestId(request: NextRequest) {
  return readPublicGamingGuestIdFromValue(request.cookies.get(PUBLIC_GAMING_GUEST_COOKIE)?.value);
}

export function readPublicGamingGuestIdFromValue(value: unknown) {
  const raw = String(value || "");
  const [id, expiresText, suppliedSignature, ...extra] = raw.split(".");
  if (extra.length || !/^guest_[0-9a-f-]{36}$/i.test(id || "")) return "";
  const expiresAt = Number(expiresText);
  if (!Number.isSafeInteger(expiresAt) || expiresAt <= Math.floor(Date.now() / 1000)) return "";
  try {
    const expected = signature(`${id}.${expiresAt}`);
    const supplied = Buffer.from(suppliedSignature || "", "utf8");
    const wanted = Buffer.from(expected, "utf8");
    return supplied.length === wanted.length && crypto.timingSafeEqual(supplied, wanted) ? id : "";
  } catch {
    return "";
  }
}
