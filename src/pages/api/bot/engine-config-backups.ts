import type { NextApiRequest, NextApiResponse } from "next";
import { BOT_API, buildBotApiHeaders, fetchBotApi, readJsonSafe } from "@/lib/botApi";
import { auditDashboardEvent } from "@/lib/dashboardAudit";
import { enforceDashboardRateLimit, isRateLimitError } from "@/lib/rateLimiter";
import { DASHBOARD_SESSION_COOKIE, readDashboardSessionValue } from "@/lib/session";

export const config = { api: { bodyParser: false } };

async function readRequestBody(req: NextApiRequest): Promise<{ body: any; raw: Buffer }> {
  if (req.body && typeof req.body === "object") {
    const raw = Buffer.from(JSON.stringify(req.body), "utf8");
    return { body: req.body, raw };
  }
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    const part = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += part.length;
    if (size > 2 * 1024 * 1024) throw new Error("Request body is too large.");
    chunks.push(part);
  }
  const raw = Buffer.concat(chunks);
  try { return { body: raw.length ? JSON.parse(raw.toString("utf8")) : {}, raw }; }
  catch { throw new Error("Request body is not valid JSON."); }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader("Cache-Control", "private, no-store");
  try {
    try {
      await enforceDashboardRateLimit(req, "engine_config_backups");
    } catch (error: any) {
      if (isRateLimitError(error)) {
        return res.status(429).json({ success: false, error: "Too many backup requests. Please retry shortly." });
      }
    }

    if (req.method === "GET") {
      const guildId = String(req.query.guildId || "").trim();
      const query = new URLSearchParams({ guildId });
      const backupId = String(req.query.backupId || "").trim();
      if (backupId) query.set("backupId", backupId);
      const upstream = await fetchBotApi(`${BOT_API}/engine-config-backups?${query}`, {
        headers: await buildBotApiHeaders(req),
        cache: "no-store",
      });
      const data = await readJsonSafe(upstream);
      return res.status(upstream.status).json(data);
    }

    if (req.method === "POST") {
      let parsed: { body: any; raw: Buffer };
      try { parsed = await readRequestBody(req); }
      catch (error: any) { return res.status(400).json({ success: false, error: error?.message || "Invalid request body." }); }
      const body = parsed.body && typeof parsed.body === "object" && !Array.isArray(parsed.body) ? parsed.body : {};
      const action = String(body.action || "").trim().toLowerCase();
      const headers = await buildBotApiHeaders(req, { json: true });
      const proof = String(req.headers["x-restore-auth-proof"] || "").trim();
      if (proof) headers["x-restore-auth-proof"] = proof;
      if (action === "features-preview" || action === "features-restore") {
        let origin: string;
        let botUrl: URL;
        try {
          origin = new URL(String(process.env.DISCORD_REDIRECT_URI || "")).origin;
          botUrl = new URL(BOT_API);
        } catch {
          return res.status(503).json({ success: false, error: "Feature restore origin is not configured." });
        }
        if (req.headers.origin !== origin || !/^application\/json(?:\s*;|$)/i.test(String(req.headers["content-type"] || ""))) {
          return res.status(403).json({ success: false, error: "Feature restore requires a same-origin JSON request." });
        }
        if (botUrl.protocol !== "http:" || !["127.0.0.1", "[::1]"].includes(botUrl.hostname) ||
            botUrl.username || botUrl.password || botUrl.pathname !== "/" || botUrl.search || botUrl.hash) {
          return res.status(503).json({ success: false, error: "Feature restore requires a direct loopback bot connection." });
        }
        if (!proof) {
          const session = await readDashboardSessionValue(req.cookies?.[DASHBOARD_SESSION_COOKIE]);
          if (!session?.accessToken || session.user.id !== headers["x-dashboard-user-id"]) {
            return res.status(401).json({ success: false, error: "A valid dashboard session is required." });
          }
          headers["x-restore-discord-token"] = session.accessToken;
        }
      }
      const upstream = await fetchBotApi(`${BOT_API}/engine-config-backups`, {
        method: "POST",
        headers,
        body: parsed.raw as unknown as BodyInit,
        cache: "no-store",
        redirect: action === "features-preview" || action === "features-restore" ? "error" : "follow",
      });
      const data = await readJsonSafe(upstream);

      if (upstream.ok) {
        await auditDashboardEvent({
          guildId: String(body.guildId || "").trim(),
          area: "engine-config-backups",
          action,
          severity: action === "restore" || action === "features-restore" ? "warn" : "info",
          metadata: {
            backupId: String(data?.backup?.id || body.backupId || ""),
            recoveryBackupId: String(data?.recoveryBackup?.id || ""),
            engineCount: Number(data?.backup?.engineCount || 0),
          },
        }).catch(() => {
          data.warning = [data.warning, "Dashboard audit event could not be recorded."].filter(Boolean).join(" ");
        });
      }

      return res.status(upstream.status).json(data);
    }

    return res.status(405).json({ success: false, error: "Method not allowed" });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error?.message || "Configuration backup service unavailable" });
  }
}
