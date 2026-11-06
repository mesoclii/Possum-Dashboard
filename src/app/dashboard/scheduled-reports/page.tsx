"use client";

import { useEffect, useState } from "react";
import { useGuildEngineEditor } from "@/components/possum/useGuildEngineEditor";

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
    <div style={{ color: "#ffe9f6", padding: 18, maxWidth: 980 }}>
      <h1 style={{ margin: 0, letterSpacing: "0.08em", textTransform: "uppercase" }}>Scheduled Reports</h1>
      <p>{guildName || guildId}</p>
      <p>A failed moderation lookup is shown as missing. It is not shown as zero.</p>
      <label>Cadence <select value={cadence} onChange={(event) => setCadence(event.target.value)}><option value="daily">Daily</option><option value="weekly">Weekly</option><option value="monthly">Monthly</option></select></label>
      <label style={{ marginLeft: 12 }}>Channel <select value={channelId} onChange={(event) => setChannelId(event.target.value)}><option value="">Store only</option>{textChannels.map((channel) => <option key={channel.id} value={channel.id}>#{channel.name}</option>)}</select></label>
      <button type="button" style={{ marginLeft: 12 }} onClick={async () => {
        const response = await fetch("/api/bot/pro", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ feature: "scheduled-reports", action: "schedule", guildId, cadence, channelId, enabled: true }) });
        const body = await response.json();
        setNotice(body.success ? "Schedule saved." : body.error || "Schedule failed.");
        await load();
      }}>Save schedule</button>
      {notice ? <p>{notice}</p> : null}
      {schedules.map((row) => <p key={row.id}>{row.cadence} · next {row.nextRunAt || "now"} · channel {row.channelId || "store only"}</p>)}
      {reports.slice().reverse().map((row) => (
        <article key={row.id} style={{ border: "1px solid #ff4d6a", marginTop: 12, padding: 12 }}>
          <strong>{row.cadence}</strong> {row.generatedAt}
          <p>Members {row.memberCount ?? "missing"}. Moderation {row.moderation?.missing ? "missing" : row.moderation?.audit30}. Events {(row.eventIds || []).length}.</p>
          <p>Delivery {row.delivery?.ok ? "sent" : row.delivery?.error || "not sent"}.</p>
        </article>
      ))}
    </div>
  );
}