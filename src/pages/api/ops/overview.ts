import type { NextApiRequest, NextApiResponse } from "next";
import { callAgent, requireOpsOwner } from "@/lib/opsProxy";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ success: false, error: "Method not allowed" });
  }
  const actor = await requireOpsOwner(req, res);
  if (!actor) return;
  const result = await callAgent({ path: "/v1/overview", actor });
  res.setHeader("cache-control", "private, no-store");
  if (!result.ok) return res.status(result.status).json({ success: false, error: result.error });

  const raw: any = result.data || {};
  const sourceServices = Array.isArray(raw.services) ? raw.services : [];
  const services = sourceServices.map((service: any) => {
    const process = service.process && typeof service.process === "object" ? service.process : null;
    return {
      name: String(service.id || service.name || service.processName || "unknown"),
      state: process?.status || (service.processName ? "not_registered" : (service.http?.ok ? "online" : "down")),
      status: service.http?.statusCode ?? null,
      uptimeMs: Number(process?.uptime || 0),
      restarts: Number(process?.restarts || 0),
      cpu: Number.isFinite(Number(process?.cpu)) ? Number(process.cpu) : null,
      memoryBytes: Number.isFinite(Number(process?.memory)) ? Number(process.memory) : null,
    };
  });
  const host = raw.host || null;
  const hostView = host ? {
    uptimeSec: host.uptimeSec,
    cpu: { usagePct: host.cpuUsagePercent ?? null, loadAvg: [host.load1, host.load5, host.load15], cores: host.cpuCount },
    memory: { usedPct: host.memory?.usedPercent ?? null, swapUsedPct: host.swap?.usedPercent ?? null, totalBytes: host.memory?.totalBytes },
    disk: { root: { usedPct: host.disk?.usedPercent ?? null } },
  } : null;
  const incidentRows = Array.isArray(raw.incidents) ? raw.incidents : [];
  const incidents = {
    open: incidentRows.filter((item: any) => item.status === "open").length,
    acknowledged: incidentRows.filter((item: any) => item.status === "acknowledged").length,
    investigating: incidentRows.filter((item: any) => item.status === "investigating").length,
    resolved: incidentRows.filter((item: any) => item.status === "resolved").length,
    total: incidentRows.length,
  };
  const http: Record<string, any> = {};
  for (const service of sourceServices) {
    const key = service.id === "possum-bot" ? "bot" : service.id === "possum-dashboard" ? "dashboard" : service.id === "game-provider-bridge" ? "bridge" : service.id;
    http[key] = service.http ? {
      ok: Boolean(service.http.ok),
      status: service.http.statusCode ?? null,
      latencyMs: service.http.latencyMs ?? null,
      error: service.http.error || null,
    } : {};
  }
  const botProbe = sourceServices.find((service: any) => service.id === "possum-bot")?.http;
  const gateway = typeof botProbe?.discordReady === "boolean"
    ? { state: botProbe.discordReady ? "ready" : "disconnected", durationMs: 0 }
    : null;

  const alerts = await callAgent({ path: "/v1/alerts/config", actor });
  return res.status(200).json({
    success: true,
    data: {
      agent: {
        uptimeSec: raw.agent?.startedAt ? Math.max(0, (Date.now() - Date.parse(raw.agent.startedAt)) / 1000) : 0,
        ticks: raw.agent?.lastCheckAt ? 1 : 0,
        lastTickAt: raw.agent?.lastCheckAt || null,
        lastError: null,
      },
      host: hostView,
      gateway,
      pm2: { ok: Array.isArray(raw.pm2) && raw.pm2.length > 0, error: Array.isArray(raw.pm2) && raw.pm2.length > 0 ? null : "PM2 returned no processes" },
      services,
      http,
      incidents,
      delivery: {
        pending: 0,
        webhookConfigured: alerts.ok ? Boolean((alerts.data as any)?.config?.webhookConfigured) : false,
      },
    },
  });
}
