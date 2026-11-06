"use client";

import { useCallback, useEffect, useState } from "react";
import type { CSSProperties } from "react";

type OperatorLogEntry = {
  id: string;
  at: string;
  engine: string;
  level: string;
  stage: string;
  guildId?: string | null;
  guildLabel?: string | null;
  routeId?: string | null;
  routeLabel?: string | null;
  channelId?: string | null;
  channelLabel?: string | null;
  voiceChannelId?: string | null;
  voiceChannelLabel?: string | null;
  userId?: string | null;
  userLabel?: string | null;
  event?: string | null;
  message: string;
  details?: Record<string, unknown> | null;
};

const shell: CSSProperties = {
  border: "1px solid #5a0000",
  borderRadius: 12,
  padding: 16,
  background: "rgba(90,0,0,0.12)",
  marginTop: 14,
};

const action: CSSProperties = {
  border: "1px solid #7a0000",
  borderRadius: 10,
  background: "#140707",
  color: "#ffd7d7",
  padding: "8px 12px",
  fontWeight: 800,
  letterSpacing: "0.06em",
  textTransform: "uppercase",
  cursor: "pointer",
};

function pretty(value: unknown) {
  try {
    return JSON.stringify(value, null, 2).replace(/\b\d{16,20}\b/g, "[id hidden]");
  } catch {
    return String(value ?? "").replace(/\b\d{16,20}\b/g, "[id hidden]");
  }
}

function contextLine(entry: OperatorLogEntry) {
  const parts = [`stage=${entry.stage || "runtime"}`];
  if (entry.routeLabel) parts.push(`route=${entry.routeLabel}`);
  if (entry.channelLabel) parts.push(`channel=${entry.channelLabel}`);
  if (entry.voiceChannelLabel) parts.push(`voice=${entry.voiceChannelLabel}`);
  if (entry.userLabel) parts.push(`user=${entry.userLabel}`);
  if (entry.guildLabel) parts.push(`guild=${entry.guildLabel}`);
  return parts.join(" · ");
}

export default function OperatorLogPanel({
  guildId,
  engine,
  title,
  limit = 40,
}: {
  guildId: string;
  engine?: string;
  title?: string;
  limit?: number;
}) {
  const [logs, setLogs] = useState<OperatorLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const loadLogs = useCallback(async () => {
    if (!guildId) return;
    setLoading(true);
    try {
      const query = new URLSearchParams({
        guildId,
        limit: String(limit),
      });
      if (engine) query.set("engine", engine);
      const res = await fetch(`/api/bot/operator-logs?${query.toString()}`, { cache: "no-store" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json?.success === false) {
        throw new Error(json?.error || "Failed to load operator logs.");
      }
      setLogs(Array.isArray(json?.logs) ? json.logs : []);
      setMessage("");
    } catch (error: any) {
      setMessage(error?.message || "Failed to load operator logs.");
    } finally {
      setLoading(false);
    }
  }, [engine, guildId, limit]);

  async function clearLogs() {
    if (!guildId) return;
    setBusy(true);
    try {
      const res = await fetch("/api/bot/operator-logs", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          guildId,
          engine: engine || null,
          action: "clear",
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json?.success === false) {
        throw new Error(json?.error || "Failed to clear operator logs.");
      }
      setMessage(`Cleared ${Number(json?.removed || 0)} operator log entr${Number(json?.removed || 0) === 1 ? "y" : "ies"}.`);
      await loadLogs();
    } catch (error: any) {
      setMessage(error?.message || "Failed to clear operator logs.");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    void loadLogs();
  }, [loadLogs]);

  return (
    <section style={shell}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        <div>
          <div style={{ color: "#ff9c9c", fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase" }}>
            Operator Logging
          </div>
          <div style={{ color: "#ffdada", fontWeight: 800, marginTop: 4 }}>
            {title || `${engine ? `${engine.toUpperCase()} ` : ""}Recent Runtime Logs`}
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button type="button" style={action} onClick={() => void loadLogs()} disabled={loading || busy}>
            {loading ? "Refreshing..." : "Refresh"}
          </button>
          <button type="button" style={{ ...action, borderColor: "#a00000", color: "#ffafaf" }} onClick={() => void clearLogs()} disabled={busy}>
            {busy ? "Clearing..." : "Clear"}
          </button>
        </div>
      </div>
      {message ? <div style={{ color: "#ffb3f0", marginTop: 10 }}>{message}</div> : null}
      <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
        {!loading && !logs.length ? (
          <div style={{ color: "#ffaaaa", fontSize: 13 }}>No operator logs captured yet for this view.</div>
        ) : null}
        {logs.map((entry) => (
          <div key={entry.id} style={{ border: "1px solid #3f0000", borderRadius: 10, padding: 12, background: "#130505" }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
              <div style={{ color: entry.level === "error" ? "#ff8f8f" : entry.level === "warn" ? "#ffb3f0" : "#ffdada", fontWeight: 800 }}>
                [{String(entry.level || "info").toUpperCase()}] {entry.message}
              </div>
              <div style={{ color: "#caa", fontSize: 12 }}>{entry.at || "Unknown time"}</div>
            </div>
            <div style={{ color: "#ffbaba", fontSize: 12, marginTop: 6 }}>{contextLine(entry)}</div>
            {entry.details ? (
              <pre style={{ marginTop: 10, whiteSpace: "pre-wrap", wordBreak: "break-word", color: "#ffd7d7", fontSize: 12 }}>
                {pretty(entry.details)}
              </pre>
            ) : null}
          </div>
        ))}
      </div>
    </section>
  );
}
