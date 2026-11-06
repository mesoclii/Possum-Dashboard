"use client";

import { useEffect, useState } from "react";
import { useGuildEngineEditor } from "@/components/possum/useGuildEngineEditor";

type EventRow = {
  id: string;
  source: string;
  sourceRecordId: string;
  kind: string;
  severity: string;
  state: string;
  summary: string;
  occurredAt: string;
  lastSeenAt: string;
};

export default function AlertInboxPage() {
  const editor = useGuildEngineEditor<{ processHealth: boolean }>("proAlerts", { processHealth: false });
  const [state, setState] = useState("");
  const [severity, setSeverity] = useState("");
  const [source, setSource] = useState("");
  const [events, setEvents] = useState<EventRow[]>([]);
  const [detail, setDetail] = useState<any>(null);
  const [notice, setNotice] = useState("");
  const [retryMessage, setRetryMessage] = useState("");

  async function load() {
    if (!editor.guildId) return;
    const params = new URLSearchParams({ guildId: editor.guildId, feature: "alert-inbox", action: "list" });
    if (state) params.set("state", state);
    if (severity) params.set("severity", severity);
    if (source) params.set("source", source);
    const response = await fetch(`/api/bot/pro?${params.toString()}`);
    const body = await response.json();
    setEvents(Array.isArray(body.events) ? body.events : []);
    setRetryMessage(body.retryStorageAvailable === false ? body.retryStorageMessage || "Retry storage is unavailable." : "");
    if (!response.ok) setNotice(body.error || "The inbox could not be loaded.");
  }

  useEffect(() => { void load(); }, [editor.guildId, state, severity, source]);

  async function act(action: "acknowledge" | "resolve", row: EventRow) {
    const response = await fetch("/api/bot/pro", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ feature: "alert-inbox", action, guildId: editor.guildId, source: row.source, sourceRecordId: row.sourceRecordId, resolution: "acknowledged" }),
    });
    const body = await response.json();
    setNotice(body.success ? "Saved." : body.error || body.reason || "Not saved.");
    await load();
  }

  if (!editor.guildId) return <div style={{ color: "#ffe9f6", padding: 18 }}>Open this page from a guild.</div>;

  return (
    <div style={{ color: "#ffe9f6", padding: 18, maxWidth: 980 }}>
      <h1 style={{ margin: 0, letterSpacing: "0.08em", textTransform: "uppercase" }}>Alert Inbox</h1>
      <p>{editor.guildName || editor.guildId}</p>
      <label><input type="checkbox" checked={editor.config.processHealth === true} onChange={(event) => editor.setConfig({ ...editor.config, processHealth: event.target.checked })} /> Publish process health for this server</label>
      <button type="button" onClick={() => void editor.save()} disabled={editor.saving} style={{ marginLeft: 12 }}>{editor.saving ? "Saving" : "Save"}</button>
      <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
        <select value={state} onChange={(event) => setState(event.target.value)}><option value="">All states</option><option value="open">Open</option><option value="acknowledged">Acknowledged</option><option value="resolved">Resolved</option></select>
        <select value={severity} onChange={(event) => setSeverity(event.target.value)}><option value="">All severities</option><option value="critical">Critical</option><option value="warning">Warning</option><option value="info">Info</option></select>
        <select value={source} onChange={(event) => setSource(event.target.value)}><option value="">All sources</option><option value="infrastructure">Infrastructure</option><option value="systemHealth">Process health</option><option value="eventReactor">Event Reactor</option></select>
      </div>
      {retryMessage ? <p>{retryMessage}</p> : null}
      {notice ? <p>{notice}</p> : null}
      {events.map((row) => (
        <article key={row.id} style={{ border: "1px solid #ff4d6a", marginTop: 12, padding: 12 }}>
          <strong>{row.severity}</strong> {row.summary}
          <p>{row.state} · {row.kind} · {row.source}</p>
          <button type="button" onClick={async () => {
            const response = await fetch(`/api/bot/pro?guildId=${editor.guildId}&feature=alert-inbox&action=detail&eventId=${row.id}`);
            setDetail(await response.json());
          }}>Details</button>
          <button type="button" onClick={() => void act("acknowledge", row)}>Acknowledge</button>
          <button type="button" onClick={() => void act("resolve", row)}>Resolve</button>
        </article>
      ))}
      {detail?.event ? (
        <section style={{ marginTop: 16 }}>
          <h2>Event {detail.event.id}</h2>
          <p>Source record {detail.event.sourceRecordId}</p>
          <p>{detail.sourceHint}</p>
          <p>First seen {detail.event.occurredAt}. Last seen {detail.event.lastSeenAt}.</p>
        </section>
      ) : null}
    </div>
  );
}
