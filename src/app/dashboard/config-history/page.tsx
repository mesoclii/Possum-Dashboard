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
const button = {
  background: "#070006",
  color: "#ffd1f5",
  borderRadius: 999,
  padding: "10px 16px",
  fontWeight: 900,
  letterSpacing: "0.08em",
  textTransform: "uppercase" as const,
  cursor: "pointer",
};

export default function ConfigHistoryPage() {
  const { guildId, guildName } = useGuildEngineEditor("proAlerts", { processHealth: false });
  const [changes, setChanges] = useState<any[]>([]);
  const [pending, setPending] = useState<any>(null);
  const [notice, setNotice] = useState("");

  async function load() {
    if (!guildId) return;
    const response = await fetch(`/api/bot/pro?guildId=${guildId}&feature=config-history&action=list`);
    const body = await response.json();
    setChanges(Array.isArray(body.changes) ? body.changes : []);
    setPending(body.pending || null);
    if (!response.ok) setNotice(body.error || "History could not be loaded.");
  }

  useEffect(() => { void load(); }, [guildId]);

  if (!guildId) return <div style={{ color: "#ffe9f6", padding: 18 }}>Open this page from a guild.</div>;

  return (
    <div style={shell}>
      <h1 style={{ margin: 0, letterSpacing: "0.08em", textTransform: "uppercase" }}>Configuration History</h1>
      <p style={{ color: "#ffe9f6" }}>{guildName || guildId}</p>
      {pending ? (
        <section style={card}>
          <strong>Pending</strong>
          <p style={{ marginBottom: 0 }}>A change is still pending: {pending.section} from {pending.source}.</p>
        </section>
      ) : null}
      {notice ? <p>{notice}</p> : null}
      {changes.length === 0 ? <p>No configuration changes are recorded for this server yet.</p> : null}
      {changes.slice().reverse().map((row) => (
        <article key={row.id} style={card}>
          <strong style={{ letterSpacing: "0.06em", textTransform: "uppercase" }}>{row.section}</strong>
          <p>{row.status} · {row.source} · {row.actorUserId || "internal"}</p>
          <p>{row.at}</p>
          <button type="button" className="possum-btn" style={button} disabled={row.status !== "committed"} onClick={async () => {
            const response = await fetch("/api/bot/pro", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ feature: "config-history", action: "restore", guildId, changeId: row.id }) });
            const body = await response.json();
            setNotice(body.success ? "Section restored through the current config writer." : body.error || body.reason || "Restore failed.");
            await load();
          }}>Restore this version</button>
        </article>
      ))}
    </div>
  );
}
