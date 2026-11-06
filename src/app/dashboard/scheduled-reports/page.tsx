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

  useEffect(() => { void load(); }, [guildId]);

  if (!guildId) return <div style={{ color: "#ffe9f6", padding: 18 }}>Open this page from a guild.</div>;

  return (
    <div style={shell}>
      <h1 style={{ margin: 0, letterSpacing: "0.08em", textTransform: "uppercase" }}>Scheduled Reports</h1>
      <p style={{ color: "#ffe9f6" }}>{guildName || guildId}</p>
      <section style={card}>
        <p style={{ marginTop: 0 }}>A failed moderation lookup is shown as missing. It is not shown as zero.</p>
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
          setNotice(body.success ? "Schedule saved." : body.error || "Schedule failed.");
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
          <p>Members {row.memberCount ?? "missing"}. Moderation {row.moderation?.missing ? "missing" : row.moderation?.audit30}. Events {(row.eventIds || []).length}.</p>
          <p style={{ marginBottom: 0 }}>Delivery {row.delivery?.ok ? "sent" : row.delivery?.error || "not sent"}.</p>
        </article>
      ))}
    </div>
  );
}
