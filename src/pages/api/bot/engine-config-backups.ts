import type { NextApiRequest, NextApiResponse } from "next";
import { BOT_API, buildBotApiHeaders, fetchBotApi, readJsonSafe } from "@/lib/botApi";
import { auditDashboardEvent } from "@/lib/dashboardAudit";
import { enforceDashboardRateLimit, isRateLimitError } from "@/lib/rateLimiter";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
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
      const upstream = await fetchBotApi(`${BOT_API}/engine-config-backups?${query}`, {
        headers: await buildBotApiHeaders(req),
        cache: "no-store",
      });
      const data = await readJsonSafe(upstream);
      return res.status(upstream.status).json(data);
    }

    if (req.method === "POST") {
      const body = req.body && typeof req.body === "object" ? req.body : {};
      const upstream = await fetchBotApi(`${BOT_API}/engine-config-backups`, {
        method: "POST",
        headers: await buildBotApiHeaders(req, { json: true }),
        body: JSON.stringify(body),
        cache: "no-store",
      });
      const data = await readJsonSafe(upstream);

      if (upstream.ok) {
        const action = String(body.action || "").trim().toLowerCase();
        await auditDashboardEvent({
          guildId: String(body.guildId || "").trim(),
          area: "engine-config-backups",
          action,
          severity: action === "restore" ? "warn" : "info",
          metadata: {
            backupId: String(data?.backup?.id || body.backupId || ""),
            recoveryBackupId: String(data?.recoveryBackup?.id || ""),
            engineCount: Number(data?.backup?.engineCount || 0),
          },
        }).catch(() => {});
      }

      return res.status(upstream.status).json(data);
    }

    return res.status(405).json({ success: false, error: "Method not allowed" });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error?.message || "Configuration backup service unavailable" });
  }
}
