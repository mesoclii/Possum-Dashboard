import type { NextApiRequest, NextApiResponse } from "next";
import { BOT_API, buildBotApiHeaders, fetchBotApi, readJsonSafe } from "@/lib/botApi";
import { enforceDashboardRateLimit, isRateLimitError } from "@/lib/rateLimiter";

const DASHBOARD_TOKEN = String(process.env.DASHBOARD_API_TOKEN || "").trim();
const ALLOWED_ACTIONS = new Set(["request", "access", "state", "challenge", "claim", "upgrade", "status", "provider", "provider-test"]);
const STATE_TOKEN = /^[A-Za-z0-9_-]{40,64}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SNOWFLAKE = /^\d{16,20}$/;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader("Cache-Control", "no-store");
  const action = String(Array.isArray(req.query.action) ? req.query.action[0] : req.query.action || "").trim();
  if (req.method === "GET" && action === "client-config") {
    let botConfig: Record<string, unknown> = {};
    if (DASHBOARD_TOKEN) {
      try {
        const upstream = await fetchBotApi(`${BOT_API}/api/age-assurance/client-config`, {
          headers: { "x-dashboard-token": DASHBOARD_TOKEN },
        });
        const payload = await readJsonSafe(upstream);
        if (upstream.ok && payload?.success === true && payload.config && typeof payload.config === "object") {
          botConfig = payload.config as Record<string, unknown>;
        }
      } catch {
        // Dashboard .env values remain usable if the bot provider endpoint is unavailable.
      }
    }
    const mode = String(process.env.KID_MODE || botConfig.mode || "test").trim().toLowerCase();
    const config = {
      publishableKey: String(process.env.NEXT_PUBLIC_KID_PUBLISHABLE_KEY || botConfig.publishableKey || "").trim(),
      baseUrl: String(process.env.NEXT_PUBLIC_KID_BASE_URL || botConfig.baseUrl || "").trim(),
      supportEmail: String(process.env.NEXT_PUBLIC_KID_SUPPORT_EMAIL || botConfig.supportEmail || "").trim(),
      dashboardUrl: String(process.env.NEXT_PUBLIC_DASHBOARD_URL || process.env.DASHBOARD_PUBLIC_URL || botConfig.dashboardUrl || "").trim(),
      mode,
    };
    return res.status(200).json({ success: true, config });
  }
  if (!DASHBOARD_TOKEN) return res.status(503).json({ success: false, error: "Age assurance API is not configured." });
  if (req.method === "GET") {
    if (action !== "provider") {
      res.setHeader("Allow", "GET, POST");
      return res.status(405).json({ success: false, error: "Method not allowed." });
    }
    try {
      await enforceDashboardRateLimit(req, "age_assurance_provider_read");
    } catch (error) {
      if (isRateLimitError(error)) return res.status(429).json({ success: false, error: "Too many age assurance requests. Retry shortly." });
      return res.status(503).json({ success: false, error: "Age assurance rate limiting is unavailable." });
    }
    try {
      const headers = action === "provider"
        ? await buildBotApiHeaders(req)
        : { "x-dashboard-token": DASHBOARD_TOKEN };
      const upstream = await fetchBotApi(`${BOT_API}/api/age-assurance/${action}`, { headers });
      const payload = await readJsonSafe(upstream);
      if (action === "provider" && payload?.provider && typeof payload.provider === "object") {
        payload.provider = {
          ...payload.provider,
          publishableKeyConfigured: Boolean(process.env.NEXT_PUBLIC_KID_PUBLISHABLE_KEY || payload.provider.publishableKeyConfigured),
          browserBaseUrlConfigured: Boolean(process.env.NEXT_PUBLIC_KID_BASE_URL || payload.provider.browserBaseUrlConfigured),
          dashboardUrlConfigured: Boolean(process.env.NEXT_PUBLIC_DASHBOARD_URL || process.env.DASHBOARD_PUBLIC_URL || payload.provider.dashboardUrlConfigured),
          supportEmailConfigured: Boolean(process.env.NEXT_PUBLIC_KID_SUPPORT_EMAIL || payload.provider.supportEmailConfigured),
        };
      }
      return res.status(upstream.status).json(payload);
    } catch {
      return res.status(502).json({ success: false, error: "Possum Bot could not load k-ID setup." });
    }
  }
  if (req.method !== "POST") {
    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ success: false, error: "Method not allowed." });
  }
  if (!ALLOWED_ACTIONS.has(action)) {
    return res.status(404).json({ success: false, error: "Unknown age assurance action." });
  }

  if (action === "provider" || action === "provider-test") {
    try {
      await enforceDashboardRateLimit(req, "age_assurance_provider_write");
    } catch (error) {
      if (isRateLimitError(error)) return res.status(429).json({ success: false, error: "Too many age assurance updates. Retry shortly." });
      return res.status(503).json({ success: false, error: "Age assurance rate limiting is unavailable." });
    }
    try {
      const endpoint = action === "provider-test" ? "provider/test" : "provider";
      const upstream = await fetchBotApi(`${BOT_API}/api/age-assurance/${endpoint}`, {
        method: "POST",
        headers: await buildBotApiHeaders(req, { json: true }),
        body: JSON.stringify(req.body && typeof req.body === "object" && !Array.isArray(req.body) ? req.body : {}),
      });
      return res.status(upstream.status).json(await readJsonSafe(upstream));
    } catch {
      return res.status(502).json({ success: false, error: "Possum Bot could not save or test k-ID setup." });
    }
  }
  try {
    await enforceDashboardRateLimit(req, "age_assurance_provider");
  } catch (error) {
    if (isRateLimitError(error)) {
      return res.status(429).json({ success: false, error: "Too many age assurance requests. Retry shortly." });
    }
    return res.status(503).json({ success: false, error: "Age assurance rate limiting is unavailable." });
  }

  const body = req.body && typeof req.body === "object" && !Array.isArray(req.body) ? req.body : {};
  if (action === "request") {
    const guildId = String(body.guildId || "").trim();
    const surface = String(body.surface || "").trim();
    if (!SNOWFLAKE.test(guildId) || surface !== "adultFeatures") {
      return res.status(400).json({ success: false, error: "A valid server and feature are required." });
    }
    try {
      const upstream = await fetchBotApi(`${BOT_API}/api/age-assurance/request`, {
        method: "POST",
        headers: await buildBotApiHeaders(req, { json: true }),
        body: JSON.stringify({ guildId, surface }),
      });
      return res.status(upstream.status).json(await readJsonSafe(upstream));
    } catch (error) {
      return res.status(502).json({ success: false, error: error instanceof Error ? error.message : "Could not start age assurance." });
    }
  }

  const token = String(body.token || "").trim();
  if (!STATE_TOKEN.test(token)) {
    return res.status(400).json({ success: false, error: "Invalid age assurance request token." });
  }
  const payload: Record<string, string> = { token };
  if (action === "access") {
    const guildId = String(body.guildId || "").trim();
    if (!SNOWFLAKE.test(guildId)) {
      return res.status(400).json({ success: false, error: "A valid server ID is required." });
    }
    payload.guildId = guildId;
  }
  if (action === "claim") {
    const claimToken = String(body.claimToken || "").trim();
    if (claimToken.length < 20 || claimToken.length > 4096) {
      return res.status(400).json({ success: false, error: "Invalid k-ID claim token." });
    }
    payload.claimToken = claimToken;
  }
  if (action === "challenge") {
    const challengeId = String(body.challengeId || "").trim();
    if (!UUID.test(challengeId)) {
      return res.status(400).json({ success: false, error: "Invalid k-ID challenge ID." });
    }
    payload.challengeId = challengeId;
  }

  try {
    const upstream = await fetchBotApi(`${BOT_API}/api/age-assurance/${action}`, {
      method: "POST",
      headers: action === "access"
        ? await buildBotApiHeaders(req, { json: true })
        : {
          "Content-Type": "application/json",
          "x-dashboard-token": DASHBOARD_TOKEN,
        },
      body: JSON.stringify(payload),
    });
    return res.status(upstream.status).json(await readJsonSafe(upstream));
  } catch {
    return res.status(502).json({ success: false, error: "Possum Bot could not confirm age assurance." });
  }
}
