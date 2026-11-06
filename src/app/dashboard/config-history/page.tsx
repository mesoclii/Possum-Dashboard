"use client";

import { useEffect, useState } from "react";
import { useGuildEngineEditor } from "@/components/possum/useGuildEngineEditor";

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
    <div style={{ color: "#ffe9f6", padding: 18, maxWidth: 980 }}>
      <h1 style={{ margin: 0, letterSpacing: "0.08em", textTransform: "uppercase" }}>Configuration History</h1>
      <p>{guildName || guildId}</p>
      {pending ? <p>A change is still pending: {pending.section} from {pending.source}.</p> : null}
      {notice ? <p>{notice}</p> : null}
      {changes.slice().reverse().map((row) => (
        <article key={row.id} style={{ border: "1px solid #ff8ab8", marginTop: 12, padding: 12 }}>
          <strong>{row.section}</strong> {row.status} · {row.source} · {row.actorUserId || "internal"}
          <p>{row.at}</p>
          <button type="button" disabled={row.status !== "committed"} onClick={async () => {
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
