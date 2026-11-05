import type { NextApiRequest } from "next";

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

// Callback origin comes from configuration only; forwarded headers are client-controlled and never trusted.
export function getConfiguredGameAuthOrigin(req: NextApiRequest): string {
  for (const name of ["DASHBOARD_PUBLIC_URL", "NEXT_PUBLIC_DASHBOARD_URL", "NEXTAUTH_URL", "DISCORD_REDIRECT_URI"]) {
    const origin = originFromUrl(String(process.env[name] || "").trim());
    if (origin) return origin;
  }
  if (process.env.NODE_ENV === "production") return "";
  const host = String(Array.isArray(req.headers.host) ? req.headers.host[0] : req.headers.host || "").trim();
  if (!host || !/^[a-z0-9.\-:\[\]]+$/i.test(host)) return "";
  return `http://${host}`;
}
