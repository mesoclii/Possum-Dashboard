import type { NextApiRequest, NextApiResponse } from "next";
import { BOT_API, buildBotApiHeaders, fetchBotApi, readJsonSafe } from "@/lib/botApi";
import { enforceDashboardRateLimit, isRateLimitError } from "@/lib/rateLimiter";

const DASHBOARD_TOKEN = String(process.env.DASHBOARD_API_TOKEN || "").trim();
type Mode = "test" | "live";

function readMode(value: unknown): Mode | "" {
  const mode = String(value || "").trim().toLowerCase();
  return mode === "test" || mode === "live" ? mode : "";
}

function readString(value: unknown, maxLength: number): string {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader("Cache-Control", "no-store");
  if (!DASHBOARD_TOKEN) {
    return res.status(503).json({ success: false, error: "Age assurance API is not configured." });
  }

  if (req.method === "GET") {
    try {
      const upstream = await fetchBotApi(`${BOT_API}/api/age-assurance/provider`, {
        headers: await buildBotApiHeaders(req),
      });
      return res.status(upstream.status).json(await readJsonSafe(upstream));
    } catch (error) {
      return res.status(401).json({
        success: false,
        error: error instanceof Error ? error.message : "Could not load k-ID provider settings.",
      });
    }
  }

  if (req.method !== "POST") {
    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ success: false, error: "Method not allowed." });
  }

  try {
    await enforceDashboardRateLimit(req, "age_assurance_provider_settings");
  } catch (error) {
    if (isRateLimitError(error)) {
      return res.status(429).json({ success: false, error: "Too many provider setting requests. Retry shortly." });
    }
    return res.status(503).json({ success: false, error: "Provider setting rate limiting is unavailable." });
  }

  const body = req.body && typeof req.body === "object" && !Array.isArray(req.body) ? req.body : {};
  const action = String(body.action || "").trim().toLowerCase();
  const mode = readMode(body.mode);
  if (!mode) return res.status(400).json({ success: false, error: "Choose the k-ID test or live environment." });

  let pathname = "";
  let payload: Record<string, unknown> = { mode };
  if (action === "save") {
    pathname = "/provider";
    payload = {
      mode,
      apiKey: readString(body.apiKey, 4096),
      publishableKey: readString(body.publishableKey, 2048),
      apiBaseUrl: readString(body.apiBaseUrl, 512),
      browserBaseUrl: readString(body.browserBaseUrl, 512),
      dashboardUrl: readString(body.dashboardUrl, 512),
      publicWebsiteUrl: readString(body.publicWebsiteUrl, 512),
      developmentOrigin: readString(body.developmentOrigin, 512),
      supportEmail: readString(body.supportEmail, 254),
      iconUrl: readString(body.iconUrl, 2048),
      clearIconUrl: body.clearIconUrl === true,
      activate: false,
    };
  } else if (action === "test") {
    pathname = "/provider/test";
  } else if (action === "activate") {
    pathname = "/provider/activate";
  } else {
    return res.status(400).json({ success: false, error: "Choose save, test, or activate." });
  }

  try {
    const upstream = await fetchBotApi(`${BOT_API}/api/age-assurance${pathname}`, {
      method: "POST",
      headers: await buildBotApiHeaders(req, { json: true }),
      body: JSON.stringify(payload),
    });
    return res.status(upstream.status).json(await readJsonSafe(upstream));
  } catch (error) {
    return res.status(502).json({
      success: false,
      error: error instanceof Error ? error.message : "Could not update k-ID provider settings.",
    });
  }
}
