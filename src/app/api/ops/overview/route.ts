import { NextRequest, NextResponse } from "next/server";
import { normalizeIncident, opsAgentRequest, opsError, requireOpsOwner } from "@/lib/opsAgent";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = await requireOpsOwner(request);
  if (auth.response) return auth.response;
  const result = await opsAgentRequest("/v1/overview");
  if (!result.ok) return opsError(result);
  const raw = result.body || {};
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
  const incidentRows = Array.isArray(raw.incidents) ? raw.incidents.map(normalizeIncident) : [];
  const incidents = {
    open: incidentRows.filter((x: any) => x.status === "open").length,
    acknowledged: incidentRows.filter((x: any) => x.status === "acknowledged").length,
    investigating: incidentRows.filter((x: any) => x.status === "investigating").length,
    resolved: incidentRows.filter((x: any) => x.status === "resolved").length,
    total: incidentRows.length,
  };
  const http: Record<string, any> = {};
  for (const service of sourceServices) {
    const key = service.id === "possum-bot" ? "bot" : service.id === "possum-dashboard" ? "dashboard" : service.id === "game-provider-bridge" ? "bridge" : service.id;
    http[key] = service.http || {};
  }
  const botProbe = sourceServices.find((service: any) => service.id === "possum-bot")?.http;
  const gateway = typeof botProbe?.discordReady === "boolean"
    ? { state: botProbe.discordReady ? "ready" : "disconnected", durationMs: 0 }
    : null;
  return NextResponse.json({
    success: true,
    data: {
      agent: { uptimeSec: raw.agent?.startedAt ? Math.max(0, (Date.now() - Date.parse(raw.agent.startedAt)) / 1000) : 0, ticks: raw.agent?.lastCheckAt ? 1 : 0, lastTickAt: raw.agent?.lastCheckAt || null, lastError: null },
      host: hostView,
      gateway,
      pm2: { ok: Array.isArray(raw.pm2) && raw.pm2.length > 0, error: Array.isArray(raw.pm2) && raw.pm2.length > 0 ? null : "PM2 returned no processes" },
      services,
      http,
      incidents,
      delivery: { pending: 0, webhookConfigured: Boolean(raw.alerts?.webhookConfigured) },
    },
  });
}
