import { NextRequest, NextResponse } from "next/server";
import { DASHBOARD_SESSION_COOKIE, readDashboardSessionValue } from "@/lib/session";
import { PERSONAL_SOCIAL_GUEST_COOKIE, readPersonalSocialGuestId } from "@/lib/personalSocialGuest";
import { beginSocial, consumeState, completeSocial, exchangeTwitch, exchangeYouTube, exchangeReddit, exchangeX, exchangeTikTok, sameOrigin, socialStateCookie, socialOrigin, socialProviderStatus, type OAuthProvider } from "@/lib/personalSocial";
import { enforceDashboardRateLimit } from "@/lib/rateLimiter";

export async function socialStart(request: NextRequest, provider: OAuthProvider) {
  const headers = { "Cache-Control": "private, no-store" };
  if (!sameOrigin(request)) return NextResponse.json({ error: "Invalid request origin." }, { status: 403, headers });
  const raw = request.cookies.get(DASHBOARD_SESSION_COOKIE)?.value || "";
  const session = await readDashboardSessionValue(raw);
  const rawGuestSession = request.cookies.get(PERSONAL_SOCIAL_GUEST_COOKIE)?.value || "";
  const guestId = readPersonalSocialGuestId(request);
  const userId = session?.user.id || guestId || "";
  const sessionValue = session ? raw : rawGuestSession;
  if (!userId) return NextResponse.json({ error: "Open the Gaming Hub or sign in with Discord to connect an account." }, { status: 401, headers });
  try { await enforceDashboardRateLimit(request, "personal_social_start", userId); }
  catch { return NextResponse.json({ error: "Too many requests." }, { status: 429, headers }); }
  if (socialProviderStatus(provider) !== "available") return NextResponse.json({ error: "Provider is not configured or enabled." }, { status: 503, headers });
  try {
    const result = await beginSocial(provider, userId, sessionValue);
    const response = NextResponse.json({ url: result.url }, { headers });
    response.cookies.set(socialStateCookie(provider), result.verifier ? `${result.state}.${result.verifier}` : result.state, { httpOnly: true, sameSite: "lax", secure: socialOrigin()!.startsWith("https:"), path: `/api/personal-social/${provider}/callback`, maxAge: 600 });
    return response;
  } catch {
    return NextResponse.json({ error: "Could not start connection." }, { status: 503, headers });
  }
}

export async function socialCallback(request: NextRequest, provider: OAuthProvider) {
  const origin = socialOrigin();
  if (!origin || socialProviderStatus(provider) !== "available") return NextResponse.json({ error: "Provider is not configured or enabled." }, { status: 503 });
  const redirect = (result: string) => {
    const response = NextResponse.redirect(`${origin}/personal-social?result=${result}`, 303);
    response.headers.set("Cache-Control", "private, no-store");
    response.headers.set("Referrer-Policy", "no-referrer");
    response.cookies.set(socialStateCookie(provider), "", { httpOnly: true, sameSite: "lax", secure: origin.startsWith("https:"), path: `/api/personal-social/${provider}/callback`, maxAge: 0 });
    return response;
  };
  const raw = request.cookies.get(DASHBOARD_SESSION_COOKIE)?.value || "";
  const session = await readDashboardSessionValue(raw);
  const rawGuestSession = request.cookies.get(PERSONAL_SOCIAL_GUEST_COOKIE)?.value || "";
  const guestId = readPersonalSocialGuestId(request);
  const userId = session?.user.id || guestId || "";
  const sessionValue = session ? raw : rawGuestSession;
  const state = request.nextUrl.searchParams.get("state") || "";
  try {
    const [cookieState, verifier] = (request.cookies.get(socialStateCookie(provider))?.value || "").split(".");
    if (!userId || !(await consumeState(provider, state, cookieState, userId, sessionValue))) return redirect("invalid");
    const code = request.nextUrl.searchParams.get("code") || "";
    if (!code || code.length > 2048) return redirect("cancelled");
    const account = provider === "twitch" ? await exchangeTwitch(code)
      : provider === "youtube" ? await exchangeYouTube(code, verifier || "")
      : provider === "x" ? await exchangeX(code, verifier || "")
      : provider === "reddit" ? await exchangeReddit(code) : await exchangeTikTok(code);
    if (!(await completeSocial(provider, state, userId, sessionValue, account))) return redirect("invalid");
    return redirect("connected");
  } catch {
    return redirect("failed");
  }
}
