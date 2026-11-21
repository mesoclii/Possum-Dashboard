"use client";

import { useEffect, useState } from "react";
import { useGuildEngineEditor } from "@/components/possum/useGuildEngineEditor";

const shell = { color: "#ffe9f6", padding: 18, maxWidth: 980 } as const;
const card = {
  border: "1px solid #ff2bd6",
  borderRadius: 12,
  padding: 16,
  marginTop: 12,
  background: "#050005",
  boxShadow: "0 0 14px rgba(255, 43, 214, 0.28), 0 0 22px rgba(255, 42, 77, 0.2)",
} as const;
const field = {
  display: "block",
  marginTop: 6,
  minWidth: 180,
  width: "100%",
  maxWidth: 360,
  padding: "10px 12px",
  borderRadius: 8,
  border: "1px solid #ff2a4d",
  background: "#050005",
  color: "#ffe9f6",
} as const;
const button = {
  background: "#070006",
  color: "#ffd1f5",
  borderRadius: 999,
  padding: "10px 16px",
  fontWeight: 900,
  letterSpacing: "0.08em",
  textTransform: "uppercase" as const,
  cursor: "pointer",
  marginTop: 12,
};

export default function ScheduledReportsPage() {
  const { guildId, guildName, channels } = useGuildEngineEditor("proAlerts", { processHealth: false });
  const [cadence, setCadence] = useState("weekly");
  const [channelId, setChannelId] = useState("");
  const [schedules, setSchedules] = useState<any[]>([]);
  const [reports, setReports] = useState<any[]>([]);
  const [notice, setNotice] = useState("");
  const textChannels = channels.filter((channel) => String(channel.type) === "0" || String(channel.type).toLowerCase() === "guildtext");

  async function load() {
    if (!guildId) return;
    const response = await fetch(`/api/bot/pro?guildId=${guildId}&feature=scheduled-reports&action=list`);
    const body = await response.json();
    setSchedules(Array.isArray(body.schedules) ? body.schedules : []);
    setReports(Array.isArray(body.reports) ? body.reports : []);
    if (!response.ok) setNotice(body.error || "Reports could not be loaded.");
  }

  useEffect(() => {
    if (!guildId) return;
    let cancelled = false;
    (async () => {
      const response = await fetch(`/api/bot/pro?guildId=${guildId}&feature=scheduled-reports&action=list`);
      const body = await response.json();
      if (cancelled) return;
      setSchedules(Array.isArray(body.schedules) ? body.schedules : []);
      setReports(Array.isArray(body.reports) ? body.reports : []);
      if (!response.ok) setNotice(body.error || "Reports could not be loaded.");
    })();
    return () => { cancelled = true; };
  }, [guildId]);

  if (!guildId) return <div style={{ color: "#ffe9f6", padding: 18 }}>Open this page from a guild.</div>;

  return (
    <div style={shell}>
      <h1 style={{ margin: 0, letterSpacing: "0.08em", textTransform: "uppercase" }}>Scheduled Reports</h1>
      <p style={{ color: "#ffe9f6" }}>{guildName || "Selected server"}</p>
      <section style={card}>
        <p style={{ marginTop: 0 }}>Discord reports show community, activity, retention, audit, and event data. Activity and audit figures use the rolling periods shown; unavailable data is not counted as zero.</p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(180px, 1fr))", gap: 12 }}>
          <label>
            Cadence
            <select style={field} value={cadence} onChange={(event) => setCadence(event.target.value)}>
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
            </select>
          </label>
          <label>
            Channel
            <select style={field} value={channelId} onChange={(event) => setChannelId(event.target.value)}>
              <option value="">Store only</option>
              {textChannels.map((channel) => <option key={channel.id} value={channel.id}>#{channel.name}</option>)}
            </select>
          </label>
        </div>
        <button type="button" className="possum-btn" style={button} onClick={async () => {
          const response = await fetch("/api/bot/pro", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ feature: "scheduled-reports", action: "schedule", guildId, cadence, channelId, enabled: true }) });
          const body = await response.json();
          setNotice(body.success ? (body.existing ? "This schedule already exists; no duplicate was created." : "Schedule saved.") : body.error || "Schedule failed.");
          await load();
        }}>Save schedule</button>
      </section>
      {notice ? <p>{notice}</p> : null}
      {schedules.map((row) => (
        <article key={row.id} style={card}>
          <strong style={{ letterSpacing: "0.06em", textTransform: "uppercase" }}>{row.cadence}</strong>
          <p style={{ marginBottom: 0 }}>next {row.nextRunAt || "now"} · channel {row.channelId || "store only"}</p>
        </article>
      ))}
      {reports.slice().reverse().map((row) => (
        <article key={row.id} style={card}>
          <strong style={{ letterSpacing: "0.06em", textTransform: "uppercase" }}>{row.cadence}</strong> {row.generatedAt}
          <p>Server members: {row.memberCount == null ? "Unavailable" : `${row.memberCountApproximate ? "~" : ""}${row.memberCount}${row.memberCountApproximate ? " (approximate)" : ""}`} · Tracked members: {row.activity?.missing ? "Unavailable" : row.activity?.tracked ?? "Unavailable"}</p>
          <p>Active tracked members: {row.activity?.missing ? "Unavailable" : row.activity?.active1d ?? "Unavailable"} in 24 hours · {row.activity?.missing ? "Unavailable" : row.activity?.active7d ?? "Unavailable"} in 7 days · {row.activity?.missing ? "Unavailable" : row.activity?.active30d ?? "Unavailable"} in 30 days</p>
          <p>Tracked joins: {row.activity?.missing ? "Unavailable" : row.activity?.joined7d ?? "Unavailable"} in 7 days · {row.activity?.missing ? "Unavailable" : row.activity?.joined30d ?? "Unavailable"} in 30 days</p>
          <p>Tracked members older than 30 days: {row.retention?.missing ? "Unavailable" : row.retention?.olderThan30d ?? "Unavailable"} · Active in the last 30 days: {row.retention?.missing ? "Unavailable" : row.retention?.retained30d ?? "Unavailable"}</p>
          <p>Audit entries in 30 days: {row.moderation?.missing ? "Unavailable" : row.moderation?.audit30 ?? "Unavailable"} · Events: {row.eventsAvailable === true || (row.eventsAvailable == null && row.eventIds?.length > 0) ? (row.eventIds || []).length : "Unavailable"}</p>
          <p style={{ marginBottom: 0 }}>Delivery: {row.delivery?.skipped === "no-channel" ? "Stored only" : row.delivery?.ok ? "Sent" : row.delivery?.error || "Not sent"}.</p>
        </article>
      ))}
    </div>
  );
}
