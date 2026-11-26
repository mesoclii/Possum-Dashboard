import type { NextApiRequest, NextApiResponse } from "next";
import { BOT_API, buildBotApiHeaders, fetchBotApi, readJsonSafe } from "@/lib/botApi";
import { enforceDashboardRateLimit, isRateLimitError } from "@/lib/rateLimiter";

const DASHBOARD_TOKEN = String(process.env.DASHBOARD_API_TOKEN || "").trim();
const ALLOWED_ACTIONS = new Set(["request", "access", "state", "challenge", "session", "claim", "upgrade", "status", "settings-challenge", "delete-session"]);
const STATE_TOKEN = /^[A-Za-z0-9_-]{40,64}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SNOWFLAKE = /^\d{16,20}$/;

function validBrowserBaseUrl(value: unknown, mode: string): string {
  const expectedHost = mode === "live" ? "kai-api.k-id.com" : "kai-api.test.k-id.com";
  try {
    const url = new URL(String(value || "").trim());
    if (url.protocol !== "https:" || url.hostname.toLowerCase() !== expectedHost ||
        url.pathname.replace(/\/+$/, "") !== "/fapi/v1" || url.username || url.password || url.search || url.hash) {
      return "";
    }
    return `${url.origin}/fapi/v1`;
  } catch {
    return "";
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader("Cache-Control", "no-store");
  const action = String(Array.isArray(req.query.action) ? req.query.action[0] : req.query.action || "").trim();
  if (req.method === "GET" && action === "client-config") {
    if (!DASHBOARD_TOKEN) return res.status(503).json({ success: false, error: "Age assurance API is not configured." });
    try {
      const upstream = await fetchBotApi(`${BOT_API}/api/age-assurance/client-config`, {
        headers: { "x-dashboard-token": DASHBOARD_TOKEN },
      });
      const payload = await readJsonSafe(upstream);
      if (!upstream.ok || payload?.success !== true || !payload?.config) {
        return res.status(502).json({ success: false, error: "Possum Bot could not load the active k-ID browser settings." });
      }
      const source = payload.config as Record<string, unknown>;
      const mode = String(source.mode || "test").toLowerCase() === "live" ? "live" : "test";
      const dashboardUrl = String(source.dashboardUrl || "").trim().replace(/\/+$/, "");
      const config = {
        publishableKey: String(source.publishableKey || "").trim(),
        baseUrl: validBrowserBaseUrl(source.baseUrl, mode),
        supportEmail: String(source.supportEmail || "").trim(),
        dashboardUrl,
        iconUrl: String(source.iconUrl || "").trim(),
        mode,
      };
      return res.status(200).json({ success: true, config });
    } catch {
      return res.status(502).json({ success: false, error: "Possum Bot could not load the active k-ID browser settings." });
    }
  }
  if (req.method === "GET" && action === "settings") {
    if (!DASHBOARD_TOKEN) return res.status(503).json({ success: false, error: "Age assurance API is not configured." });
    try {
      const upstream = await fetchBotApi(`${BOT_API}/api/age-assurance/settings`, {
        headers: await buildBotApiHeaders(req),
      });
      return res.status(upstream.status).json(await readJsonSafe(upstream));
    } catch (error) {
      return res.status(401).json({
        success: false,
        error: error instanceof Error ? error.message : "A signed-in Discord account is required to manage age assurance settings.",
      });
    }
  }
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ success: false, error: "Method not allowed." });
  }
  if (!DASHBOARD_TOKEN) {
    return res.status(503).json({ success: false, error: "Age assurance API is not configured." });
  }

  if (!ALLOWED_ACTIONS.has(action)) {
    return res.status(404).json({ success: false, error: "Unknown age assurance action." });
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
  if (action === "settings-challenge" || action === "delete-session") {
    const challengeId = String(body.challengeId || "").trim();
    if (action === "settings-challenge" && !UUID.test(challengeId)) {
      return res.status(400).json({ success: false, error: "Invalid k-ID challenge ID." });
    }
    const endpoint = action === "settings-challenge" ? "settings/challenge" : "delete-session";
    try {
      const upstream = await fetchBotApi(`${BOT_API}/api/age-assurance/${endpoint}`, {
        method: "POST",
        headers: await buildBotApiHeaders(req, { json: true }),
        body: JSON.stringify(action === "settings-challenge" ? { challengeId } : {}),
      });
      return res.status(upstream.status).json(await readJsonSafe(upstream));
    } catch (error) {
      return res.status(401).json({
        success: false,
        error: error instanceof Error ? error.message : "A signed-in Discord account is required to manage age assurance settings.",
      });
    }
  }
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
  if (action === "session") {
    const sessionId = String(body.sessionId || "").trim();
    if (!UUID.test(sessionId)) {
      return res.status(400).json({ success: false, error: "Invalid k-ID session ID." });
    }
    payload.sessionId = sessionId;
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
