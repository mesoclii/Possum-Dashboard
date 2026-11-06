"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type ServiceRow = {
  name: string;
  state: string;
  status: string | null;
  uptimeMs: number;
  restarts: number;
  cpu: number | null;
  memoryBytes: number | null;
};

type HttpProbe = { ok?: boolean; status?: number | null; latencyMs?: number | null; error?: string | null };

type Overview = {
  agent?: { uptimeSec?: number; ticks?: number; lastTickAt?: string | null; lastError?: string | null };
  host?: {
    uptimeSec?: number;
    cpu?: { usagePct?: number | null; loadAvg?: number[] | null; cores?: number };
    memory?: { usedPct?: number | null; swapUsedPct?: number | null; totalBytes?: number };
    disk?: { root?: { usedPct?: number | null } };
  } | null;
  gateway?: { state?: string; durationMs?: number } | null;
  pm2?: { ok?: boolean; error?: string | null } | null;
  services?: ServiceRow[];
  http?: Record<string, HttpProbe> | null;
  incidents?: { open?: number; acknowledged?: number; investigating?: number; resolved?: number; total?: number };
  delivery?: { pending?: number; webhookConfigured?: boolean };
};

type Incident = {
  id: string;
  ref: string;
  title: string;
  severity: string;
  status: string;
  service: string;
  occurrences: number;
  firstSeenAt: string;
  lastSeenAt: string;
  summary: string;
};

type LogLine = { source: string; label?: string; level: string; category: string; text: string };

type AlertsConfig = {
  webhookConfigured?: boolean;
  alertRepeatMs?: number;
  maxDeliveryAttempts?: number;
  delivery?: { pending?: number };
};

const panel = {
  border: "1px solid rgba(255,0,0,.30)",
  borderRadius: 12,
  padding: 16,
  background: "rgba(12,4,4,.72)",
  color: "#ffd0d0",
} as const;

const label = {
  fontSize: 11,
  letterSpacing: "0.16em",
  textTransform: "uppercase" as const,
  color: "#ff8a8a",
};

const mono = { fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" } as const;

function fmtPercent(value?: number | null) {
  return typeof value === "number" ? `${value.toFixed(1)}%` : "--";
}

function fmtBytes(value?: number | null) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "--";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let size = value;
  let unit = 0;
  while (size >= 1024 && unit < units.length - 1) {
    size /= 1024;
    unit += 1;
  }
  return `${size.toFixed(size >= 10 ? 0 : 1)} ${units[unit]}`;
}

function fmtUptime(ms?: number | null) {
  if (!ms || !Number.isFinite(ms)) return "--";
  const seconds = Math.floor(ms / 1000);
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (days) return `${days}d ${hours}h`;
  if (hours) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

const severityColor: Record<string, string> = {
  critical: "#ff4a4a",
  warning: "#f0a020",
  info: "#6ab0ff",
};

const statusColor: Record<string, string> = {
  online: "#39c46a",
  ready: "#39c46a",
  down: "#ff4a4a",
  missing: "#ff4a4a",
  disconnected: "#ff4a4a",
  not_registered: "#888888",
};

export default function OperationsClient() {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [logs, setLogs] = useState<LogLine[]>([]);
  const [alerts, setAlerts] = useState<AlertsConfig | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [paused, setPaused] = useState(false);
  const [logSource, setLogSource] = useState("all");
  const [logSeverity, setLogSeverity] = useState("all");
  const [busy, setBusy] = useState<string | null>(null);

  const pausedRef = useRef(paused);
  pausedRef.current = paused;

  const loadOverview = useCallback(async () => {
    try {
      const response = await fetch("/api/ops/overview", { cache: "no-store" });
      const body = await response.json();
      if (!body?.success) {
        setError(String(body?.error || "Operations agent unavailable"));
        setOverview(null);
        return;
      }
      setError(null);
      setOverview(body.data as Overview);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Operations agent unavailable");
    }
  }, []);

  const loadIncidents = useCallback(async () => {
    try {
      const response = await fetch("/api/ops/incidents?limit=50", { cache: "no-store" });
      const body = await response.json();
      if (body?.success) setIncidents((body.data?.incidents || []) as Incident[]);
    } catch {
      // keep the previous list rather than blanking the panel
    }
  }, []);

  const loadLogs = useCallback(async () => {
    if (pausedRef.current) return;
    const params = new URLSearchParams({ limit: "200" });
    if (logSource !== "all") params.set("source", logSource);
    if (logSeverity !== "all") params.set("severity", logSeverity);

    try {
      const response = await fetch(`/api/ops/logs?${params.toString()}`, { cache: "no-store" });
      const body = await response.json();
      if (body?.success) setLogs((body.data?.lines || []) as LogLine[]);
    } catch {
      // polling failures are non-fatal for the viewer
    }
  }, [logSource, logSeverity]);

  const loadAlerts = useCallback(async () => {
    try {
      const response = await fetch("/api/ops/alerts", { cache: "no-store" });
      const body = await response.json();
      if (body?.success) setAlerts(body.data as AlertsConfig);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    void loadOverview();
    void loadIncidents();
    void loadAlerts();
  }, [loadOverview, loadIncidents, loadAlerts]);

  useEffect(() => {
    const handle = setInterval(() => {
      void loadOverview();
    }, 10000);
    return () => clearInterval(handle);
  }, [loadOverview]);

  useEffect(() => {
    const handle = setInterval(() => {
      void loadIncidents();
    }, 15000);
    return () => clearInterval(handle);
  }, [loadIncidents]);

  useEffect(() => {
    void loadLogs();
    const handle = setInterval(() => {
      void loadLogs();
    }, 2000);
    return () => clearInterval(handle);
  }, [loadLogs]);

  async function mutateIncident(id: string, action: "acknowledge" | "resolve") {
    setBusy(id);
    try {
      await fetch(`/api/ops/incidents/${encodeURIComponent(id)}/${action}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ reason: action === "resolve" ? "Resolved from Operations Center" : undefined }),
      });
      await loadIncidents();
      await loadOverview();
    } finally {
      setBusy(null);
    }
  }

  async function sendTestAlert() {
    setBusy("test");
    try {
      await fetch("/api/ops/alerts/test", { method: "POST" });
      await loadAlerts();
    } finally {
      setBusy(null);
    }
  }

  const host = overview?.host;
  const services = overview?.services || [];
  const counts = overview?.incidents || {};
  const hostStatus = overview ? (overview.pm2?.ok === false ? "PM2 UNREACHABLE" : "ALL SYSTEMS OBSERVED") : "WAITING FOR AGENT";

  const openIncidents = useMemo(
    () => incidents.filter((incident) => incident.status !== "resolved"),
    [incidents]
  );

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <header style={{ ...panel, display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
        <div>
          <div style={label}>Possum Operations</div>
          <h1 style={{ margin: "6px 0 0", fontSize: 22, letterSpacing: "0.06em", textTransform: "uppercase" }}>
            {hostStatus}
          </h1>
          <div style={{ fontSize: 12, color: "#c99090", marginTop: 6 }}>
            Platform-wide operational overview. Creator only. Read-only: this console never restarts or repairs services.
          </div>
        </div>
        <div style={{ display: "flex", gap: 24, alignItems: "center", flexWrap: "wrap" }}>
          <Stat title="Active services" value={`${services.filter((svc) => svc.state === "online").length} / ${services.length}`} />
          <Stat title="Open incidents" value={String((counts.open || 0) + (counts.acknowledged || 0))} />
          <Stat title="Host memory" value={fmtPercent(host?.memory?.usedPct)} />
          <Stat title="Root disk" value={fmtPercent(host?.disk?.root?.usedPct)} />
        </div>
      </header>

      {error ? (
        <section style={{ ...panel, borderColor: "#ff4a4a" }}>
          <div style={label}>Agent unreachable</div>
          <p style={{ margin: "8px 0 0" }}>{error}</p>
          <p style={{ margin: "8px 0 0", fontSize: 12, color: "#c99090" }}>
            Start it with: pm2 start ops/ecosystem.ops.config.js. Set OPS_AGENT_TOKEN first.
          </p>
        </section>
      ) : null}

      <section style={panel}>
        <div style={label}>Services</div>
        <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 10, fontSize: 13 }}>
          <thead>
            <tr style={{ textAlign: "left", color: "#ff8a8a" }}>
              <th style={{ padding: "6px 8px" }}>Process</th>
              <th style={{ padding: "6px 8px" }}>PM2</th>
              <th style={{ padding: "6px 8px" }}>Health</th>
              <th style={{ padding: "6px 8px" }}>Uptime</th>
              <th style={{ padding: "6px 8px" }}>Restarts</th>
              <th style={{ padding: "6px 8px" }}>Memory</th>
            </tr>
          </thead>
          <tbody>
            {services.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ padding: 10, color: "#c99090" }}>
                  No sample yet.
                </td>
              </tr>
            ) : (
              services.map((service) => {
                const probeKey =
                  service.name === "possum-bot"
                    ? "bot"
                    : service.name === "possum-dashboard"
                    ? "dashboard"
                    : service.name === "game-provider-bridge"
                    ? "bridge"
                    : "";
                const probe = probeKey ? overview?.http?.[probeKey] : undefined;

                return (
                  <tr key={service.name} style={{ borderTop: "1px solid rgba(255,0,0,.14)" }}>
                    <td style={{ padding: "8px", ...mono }}>{service.name}</td>
                    <td style={{ padding: "8px", color: statusColor[service.state] || "#ffd0d0", fontWeight: 700 }}>
                      {service.state.toUpperCase()}
                    </td>
                    <td style={{ padding: "8px", color: probe?.ok ? "#39c46a" : probe ? "#ff4a4a" : "#888" }}>
                      {probe ? (probe.ok ? `ok ${probe.status ?? ""}` : probe.error || "failing") : "n/a"}
                      {probe?.latencyMs ? ` · ${probe.latencyMs}ms` : ""}
                    </td>
                    <td style={{ padding: "8px" }}>{fmtUptime(service.uptimeMs)}</td>
                    <td style={{ padding: "8px" }}>{service.restarts}</td>
                    <td style={{ padding: "8px" }}>{fmtBytes(service.memoryBytes)}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </section>

      <section style={panel}>
        <div style={label}>Host resources</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12, marginTop: 12 }}>
          <Stat title="CPU" value={fmtPercent(host?.cpu?.usagePct)} />
          <Stat title="Load 1m" value={host?.cpu?.loadAvg?.[0] !== undefined ? String(host.cpu.loadAvg[0]) : "--"} />
          <Stat title="Cores" value={host?.cpu?.cores ? String(host.cpu.cores) : "--"} />
          <Stat title="RAM" value={fmtPercent(host?.memory?.usedPct)} />
          <Stat title="Swap" value={fmtPercent(host?.memory?.swapUsedPct)} />
          <Stat title="Root disk" value={fmtPercent(host?.disk?.root?.usedPct)} />
          <Stat title="VM uptime" value={fmtUptime((host?.uptimeSec || 0) * 1000)} />
          <Stat
            title="Gateway"
            value={overview?.gateway?.state ? overview.gateway.state.toUpperCase() : "--"}
            color={overview?.gateway?.state === "disconnected" ? "#ff4a4a" : undefined}
          />
        </div>
      </section>

      <section style={panel}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <div style={label}>Incident center</div>
          <div style={{ fontSize: 12, color: "#c99090" }}>
            {openIncidents.length} active · {counts.resolved || 0} resolved
          </div>
        </div>

        <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
          {incidents.length === 0 ? (
            <div style={{ color: "#c99090", fontSize: 13 }}>No incidents recorded.</div>
          ) : (
            incidents.slice(0, 12).map((incident) => (
              <div
                key={incident.id}
                style={{
                  border: "1px solid rgba(255,0,0,.18)",
                  borderRadius: 10,
                  padding: 10,
                  display: "grid",
                  gap: 6,
                  background: "rgba(0,0,0,.28)",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                  <strong style={{ color: severityColor[incident.severity] || "#ffd0d0", fontSize: 13 }}>
                    {incident.ref} · {incident.title}
                  </strong>
                  <span style={{ fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", color: "#c99090" }}>
                    {incident.status} · {incident.occurrences}× · {incident.service}
                  </span>
                </div>
                <div style={{ fontSize: 12, color: "#c99090" }}>
                  First seen {incident.firstSeenAt} · last {incident.lastSeenAt}
                </div>
                {incident.status !== "resolved" ? (
                  <div style={{ display: "flex", gap: 8 }}>
                    {incident.status === "open" ? (
                      <button
                        type="button"
                        disabled={busy === incident.id}
                        onClick={() => void mutateIncident(incident.id, "acknowledge")}
                        style={actionButton}
                      >
                        Acknowledge
                      </button>
                    ) : null}
                    <button
                      type="button"
                      disabled={busy === incident.id}
                      onClick={() => void mutateIncident(incident.id, "resolve")}
                      style={actionButton}
                    >
                      Resolve
                    </button>
                  </div>
                ) : null}
              </div>
            ))
          )}
        </div>
      </section>

      <section style={panel}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <div style={label}>Live logs</div>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <select value={logSource} onChange={(event) => setLogSource(event.target.value)} style={select}>
              <option value="all">All sources</option>
              <option value="bot-out">Bot (out)</option>
              <option value="bot-error">Bot (error)</option>
              <option value="dash-out">Dashboard (out)</option>
              <option value="dash-error">Dashboard (error)</option>
              <option value="bridge-out">Bridge (out)</option>
              <option value="bridge-error">Bridge (error)</option>
              <option value="ops-out">Ops (out)</option>
              <option value="ops-error">Ops (error)</option>
            </select>
            <select value={logSeverity} onChange={(event) => setLogSeverity(event.target.value)} style={select}>
              <option value="all">All levels</option>
              <option value="critical">Critical</option>
              <option value="error">Error</option>
              <option value="warning">Warning</option>
              <option value="info">Info</option>
            </select>
            <button type="button" onClick={() => setPaused((value) => !value)} style={actionButton}>
              {paused ? "Resume" : "Pause"}
            </button>
          </div>
        </div>

        <div
          style={{
            ...mono,
            marginTop: 12,
            maxHeight: 320,
            overflow: "auto",
            fontSize: 12,
            lineHeight: 1.5,
            background: "rgba(0,0,0,.45)",
            border: "1px solid rgba(255,0,0,.16)",
            borderRadius: 10,
            padding: 10,
          }}
        >
          {logs.length === 0 ? (
            <div style={{ color: "#c99090" }}>No log lines yet.</div>
          ) : (
            logs.slice(-200).map((line, index) => (
              <div key={`${index}-${line.source}`} style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                <span style={{ color: severityColor[line.level] || "#8f8f8f" }}>[{line.level.toUpperCase()}]</span>{" "}
                <span style={{ color: "#7f6f6f" }}>{line.source}</span> {line.text}
              </div>
            ))
          )}
        </div>
        <div style={{ marginTop: 6, fontSize: 11, color: "#a08080" }}>
          Lines are redacted by the agent before they leave the VM process.
        </div>
      </section>

      <section style={panel}>
        <div style={label}>Alert configuration</div>
        <div style={{ display: "grid", gap: 8, marginTop: 12, fontSize: 13 }}>
          <Row left="Discord webhook" right={alerts?.webhookConfigured ? "configured" : "not configured"} />
          <Row left="Repeat cooldown" right={`${Math.round((alerts?.alertRepeatMs || 0) / 60000)} min`} />
          <Row left="Max delivery attempts" right={String(alerts?.maxDeliveryAttempts ?? "--")} />
          <Row left="Queued deliveries" right={String(alerts?.delivery?.pending ?? 0)} />
          <Row left="Agent ticks" right={String(overview?.agent?.ticks ?? 0)} />
          <Row left="Last tick" right={String(overview?.agent?.lastTickAt ?? "--")} />
        </div>
        <div style={{ marginTop: 12, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={() => void sendTestAlert()}
            disabled={busy === "test" || !alerts?.webhookConfigured}
            style={{ ...actionButton, opacity: alerts?.webhookConfigured ? 1 : 0.5 }}
          >
            Send test alert
          </button>
          <span style={{ fontSize: 11, color: "#a08080" }}>
            The webhook URL is never sent to the browser. Set OPS_DISCORD_WEBHOOK_URL in the agent environment.
          </span>
        </div>
        {overview?.agent?.lastError ? (
          <div style={{ marginTop: 10, fontSize: 12, color: "#ff9a9a", ...mono }}>{overview.agent.lastError}</div>
        ) : null}
      </section>
    </div>
  );
}

const actionButton = {
  border: "1px solid #7a0000",
  borderRadius: 8,
  background: "#130707",
  color: "#ffd7d7",
  padding: "6px 10px",
  fontWeight: 700,
  fontSize: 11,
  letterSpacing: "0.08em",
  textTransform: "uppercase" as const,
  cursor: "pointer",
};

const select = {
  border: "1px solid #7a0000",
  borderRadius: 8,
  background: "#130707",
  color: "#ffd7d7",
  padding: "6px 8px",
  fontSize: 12,
};

function Stat({ title, value, color }: { title: string; value: string; color?: string }) {
  return (
    <div style={{ minWidth: 96 }}>
      <div style={{ ...label, fontSize: 10 }}>{title}</div>
      <div style={{ fontSize: 20, fontWeight: 800, color: color || "#ffd0d0" }}>{value}</div>
    </div>
  );
}

function Row({ left, right }: { left: string; right: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, borderTop: "1px solid rgba(255,0,0,.10)", paddingTop: 6 }}>
      <span style={{ color: "#c99090" }}>{left}</span>
      <span style={{ ...mono }}>{right}</span>
    </div>
  );
}
