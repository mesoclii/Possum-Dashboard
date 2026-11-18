"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { buildDashboardHref } from "@/lib/dashboardContext";
import { MODERATOR_AUDIT_HREF } from "@/lib/moderatorNavigation";
import { readAuditResponse, requestAuditData } from "@/lib/auditRequests";

type LoadState<T> =
  | { status: "idle" | "loading" }
  | { status: "error"; error: string }
  | { status: "success"; data: T };

function isConfig(value: unknown): value is Record<string, any> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function isEvents(value: unknown): value is any[] {
  return Array.isArray(value);
}

function isLines(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((line) => typeof line === "string");
}

function useAuditResource<T>(field: string, isValid: (value: unknown) => value is T) {
  const [state, setState] = useState<LoadState<T>>({ status: "idle" });
  const pending = useRef<AbortController | null>(null);

  useEffect(() => () => {
    pending.current?.abort();
  }, []);

  const load = useCallback(async (url: string) => {
    pending.current?.abort();
    const controller = new AbortController();
    pending.current = controller;
    setState({ status: "loading" });
    try {
      const data = await requestAuditData(url, field, isValid, controller.signal);
      if (!controller.signal.aborted) setState({ status: "success", data });
    } catch (error) {
      if (!controller.signal.aborted) {
        setState({ status: "error", error: error instanceof Error ? error.message : "Request failed." });
      }
    }
  }, [field, isValid]);

  return { state, setState, load };
}

function getGuildId() {
  if (typeof window === "undefined") return "";
  const q = new URLSearchParams(window.location.search).get("guildId") || "";
  const s = localStorage.getItem("activeGuildId") || "";
  const g = (q || s).trim();
  if (g) localStorage.setItem("activeGuildId", g);
  return g;
}

export default function AuditTrailPage() {
  const [guildId] = useState(() => getGuildId());
  const config = useAuditResource("config", isConfig);
  const events = useAuditResource("events", isEvents);
  const logs = useAuditResource("lines", isLines);
  const [kind, setKind] = useState("dash-error");
  const [msg, setMsg] = useState("");

  const loadConfig = config.load;
  const loadEvents = events.load;
  const loadLogs = logs.load;
  const configUrl = `/api/audit/config?guildId=${encodeURIComponent(guildId)}`;
  const eventsUrl = `/api/audit/events?guildId=${encodeURIComponent(guildId)}&limit=200`;
  const logUrl = (k: string) => `/api/audit/log-feed?kind=${encodeURIComponent(k)}&lines=200`;

  useEffect(() => {
    if (!guildId) return;
    void loadConfig(configUrl);
    void loadEvents(eventsUrl);
    void loadLogs(logUrl("dash-error"));
  }, [guildId, configUrl, eventsUrl, loadConfig, loadEvents, loadLogs]);

  function refreshAll() {
    if (!guildId) return;
    void loadConfig(configUrl);
    void loadEvents(eventsUrl);
    void loadLogs(logUrl(kind));
  }

  function updateConfig(patch: Record<string, unknown>) {
    config.setState((current) => current.status === "success"
      ? { status: "success", data: { ...current.data, ...patch } }
      : current);
  }

  async function save() {
    if (!guildId || config.state.status !== "success") return;
    try {
      const r = await fetch("/api/audit/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ guildId, patch: config.state.data })
      });
      await readAuditResponse(r);
      setMsg("Audit config saved.");
    } catch (error) {
      setMsg(`Save failed: ${error instanceof Error ? error.message : "Request failed."}`);
    }
  }

  return (
    <div style={{ padding: 18 }}>
      <h1 style={{ marginTop: 0 }}>Audit Trail</h1>
      <p>
        This page shows dashboard configuration history and process logs. Discord moderation event
        switches and destinations are separate:{" "}
        <Link href={buildDashboardHref(MODERATOR_AUDIT_HREF)}>Moderator audit logging</Link>{" · "}
        <Link href={buildDashboardHref("/dashboard/channels")}>Engine channel routing</Link>
      </p>
      <div style={{ color: "#ff9c9c", marginBottom: 10 }}>{msg}</div>
      {!guildId && <p role="alert">Select a server from the guilds page to load audit data.</p>}
      <button onClick={refreshAll} disabled={!guildId}>Refresh Audit Data</button>

      {config.state.status === "loading" && <p>Loading audit config...</p>}
      {config.state.status === "error" && <p role="alert">Audit config could not be loaded: {config.state.error}</p>}
      {config.state.status === "success" && (
        <div style={{ marginBottom: 12, padding: 12, border: "1px solid #5f0000", borderRadius: 10 }}>
          <label><input type="checkbox" checked={!!config.state.data.active} onChange={(e) => updateConfig({ active: e.target.checked })} /> Active</label>
          <div style={{ marginTop: 8, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <input value={config.state.data.retainDays} onChange={(e) => updateConfig({ retainDays: Number(e.target.value || 0) })} placeholder="retainDays" />
            <input value={config.state.data.exportChannelId || ""} onChange={(e) => updateConfig({ exportChannelId: e.target.value })} placeholder="exportChannelId" />
          </div>
          <div style={{ marginTop: 8 }}>
            <button onClick={save}>Save Audit Config</button>
          </div>
        </div>
      )}

      <div style={{ marginBottom: 12, padding: 12, border: "1px solid #5f0000", borderRadius: 10 }}>
        <h3 style={{ marginTop: 0 }}>Config Change History</h3>
        <div style={{ maxHeight: 260, overflow: "auto", fontSize: 12, background: "#111", padding: 8 }}>
          {events.state.status === "loading" && <div>Loading events...</div>}
          {events.state.status === "error" && <div role="alert">Events could not be loaded: {events.state.error}</div>}
          {events.state.status === "success" && events.state.data.map((e, i) => (
            <div key={i} style={{ marginBottom: 6 }}>
              [{e?.at}] {e?.area} {e?.action} {Array.isArray(e?.keys) ? `(${e.keys.join(", ")})` : ""}
            </div>
          ))}
          {events.state.status === "success" && events.state.data.length === 0 && <div>No events yet.</div>}
        </div>
      </div>

      <div style={{ padding: 12, border: "1px solid #5f0000", borderRadius: 10 }}>
        <h3 style={{ marginTop: 0 }}>Live PM2 Log Feed</h3>
        <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
          <select value={kind} onChange={(e) => {
            const nextKind = e.target.value;
            setKind(nextKind);
            if (guildId) void loadLogs(logUrl(nextKind));
          }}>
            <option value="dash-error">dash-error</option>
            <option value="dash-out">dash-out</option>
            <option value="bot-error">bot-error</option>
            <option value="bot-out">bot-out</option>
          </select>
          <button onClick={() => void loadLogs(logUrl(kind))} disabled={!guildId}>Refresh Log</button>
        </div>
        {logs.state.status === "loading" && <div>Loading log feed...</div>}
        {logs.state.status === "error" && <div role="alert">Log feed could not be loaded: {logs.state.error}</div>}
        {logs.state.status === "success" && (logs.state.data.length === 0 ? <div>No log lines.</div> : (
        <pre style={{ maxHeight: 260, overflow: "auto", background: "#0b0b0b", color: "#ffc7c7", padding: 8, whiteSpace: "pre-wrap" }}>
{logs.state.data.join("\n")}
        </pre>
        ))}
      </div>
    </div>
  );
}
