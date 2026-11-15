import type { NextApiRequest } from "next";

const PRODUCTION_GAME_AUTH_HOSTS = new Set([
  "possumbot.com",
  "www.possumbot.com",
  "dashboard.possumbot.com",
]);

function originFromUrl(input: string) {
  if (!input) return "";
  try {
    const url = new URL(input);
    if (url.protocol !== "http:" && url.protocol !== "https:") return "";
    return url.origin;
  } catch {
    return "";
  }
}

function originFromRequestHost(req: NextApiRequest, production: boolean) {
  const host = String(Array.isArray(req.headers.host) ? req.headers.host[0] : req.headers.host || "").trim();
  if (!host) return "";
  try {
    const url = new URL(`${production ? "https" : "http"}://${host}`);
    if (production) {
      if (!PRODUCTION_GAME_AUTH_HOSTS.has(url.hostname.toLowerCase()) || url.port) return "";
      return url.origin;
    }
    if (!/^[a-z0-9.\-:\[\]]+$/i.test(host)) return "";
    return url.origin;
  } catch {
    return "";
  }
}

// Use the current app host only when it is on the production allowlist; never trust forwarded headers.
export function getConfiguredGameAuthOrigin(req: NextApiRequest): string {
  const production = process.env.NODE_ENV === "production";
  const requestOrigin = originFromRequestHost(req, production);
  if (requestOrigin) return requestOrigin;

  for (const name of ["DASHBOARD_PUBLIC_URL", "NEXT_PUBLIC_DASHBOARD_URL", "NEXTAUTH_URL", "DISCORD_REDIRECT_URI"]) {
    const origin = originFromUrl(String(process.env[name] || "").trim());
    if (origin) return origin;
  }
  return "";
}
