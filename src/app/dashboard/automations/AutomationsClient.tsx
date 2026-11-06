"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Automation = {
  id?: string;
  name?: string;
  enabled?: boolean;
  published?: boolean;
};

type CustomCommand = {
  id?: string;
  name?: string;
  enabled?: boolean;
};

function getGuildId(): string {
  if (typeof window === "undefined") return "";
  const q = new URLSearchParams(window.location.search).get("guildId") || "";
  const s = localStorage.getItem("activeGuildId") || "";
  const guildId = (q || s).trim();
  if (guildId) localStorage.setItem("activeGuildId", guildId);
  return guildId;
}

function withGuild(href: string, guildId: string): string {
  if (!guildId) return href;
  const sep = href.includes("?") ? "&" : "?";
  return `${href}${sep}guildId=${encodeURIComponent(guildId)}`;
}

function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return "Failed to load automation data.";
}

export default function AutomationsClient() {
  const [guildId] = useState<string>(() => getGuildId());
  const [guildName, setGuildName] = useState("");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [automations, setAutomations] = useState<Automation[]>([]);
  const [commands, setCommands] = useState<CustomCommand[]>([]);

  useEffect(() => {
    if (!guildId) {
      setLoading(false);
      return;
    }

    (async () => {
      try {
        setLoading(true);
        setMessage("");

        const [aRes, cRes, gRes] = await Promise.all([
          fetch(`/api/bot/automations?guildId=${encodeURIComponent(guildId)}`),
          fetch(`/api/bot/commands?guildId=${encodeURIComponent(guildId)}`),
          fetch(`/api/bot/guild-data?guildId=${encodeURIComponent(guildId)}`),
        ]);

        const aJson = await aRes.json().catch(() => ({}));
        const cJson = await cRes.json().catch(() => ({}));
        const gJson = await gRes.json().catch(() => ({}));

        setAutomations(Array.isArray(aJson?.automations) ? aJson.automations : Array.isArray(aJson) ? aJson : []);
        setCommands(Array.isArray(cJson?.commands) ? cJson.commands : Array.isArray(cJson) ? cJson : []);
        const nextGuildName = String(gJson?.guild?.name || "").trim();
        setGuildName(nextGuildName);
        if (nextGuildName) localStorage.setItem("activeGuildName", nextGuildName);
      } catch (err: unknown) {
        setMessage(errorMessage(err));
      } finally {
        setLoading(false);
      }
    })();
  }, [guildId]);

  if (!guildId && !loading) {
    return <div style={{ color: "#ff7f7f", padding: 18 }}>Missing guildId. Open from /guilds first.</div>;
  }

  return (
    <div style={{ color: "#ffd0d0", maxWidth: 1180, padding: 16 }}>
      <h1 style={{ margin: 0, color: "#ff4f4f", letterSpacing: "0.10em", textTransform: "uppercase" }}>Bot Automations</h1>
      <p style={{ marginTop: 8, color: "#ffabab" }}>
        Bot automation surface. Separate from Security rule automation.
      </p>
      <p style={{ color: "#ff9d9d" }}>
        Guild: {guildName || (guildId || "(not selected)")}
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 10, marginTop: 12 }}>
        <div style={{ border: "1px solid #5f0000", borderRadius: 10, padding: 12, background: "#130000" }}>
          <div style={{ fontSize: 12, color: "#ffb5b5" }}>Automations</div>
          <div style={{ fontSize: 26, fontWeight: 900 }}>{automations.length}</div>
        </div>
        <div style={{ border: "1px solid #5f0000", borderRadius: 10, padding: 12, background: "#130000" }}>
          <div style={{ fontSize: 12, color: "#ffb5b5" }}>Published</div>
          <div style={{ fontSize: 26, fontWeight: 900 }}>{automations.filter((a) => a.published).length}</div>
        </div>
        <div style={{ border: "1px solid #5f0000", borderRadius: 10, padding: 12, background: "#130000" }}>
          <div style={{ fontSize: 12, color: "#ffb5b5" }}>Custom Commands</div>
          <div style={{ fontSize: 26, fontWeight: 900 }}>{commands.length}</div>
        </div>
      </div>

      {message ? <p style={{ marginTop: 10, color: "#ffb3f0" }}>{message}</p> : null}

      <div style={{ marginTop: 14, display: "grid", gap: 8 }}>
        <Link href={withGuild("/dashboard/automations/studio", guildId)} style={{ color: "#ffd0d0" }}>
          Open Bot Automation Studio
        </Link>
        <Link href={withGuild("/dashboard/commands", guildId)} style={{ color: "#ffd0d0" }}>
          Open Command Studio
        </Link>
      </div>

      {loading ? (
        <p style={{ marginTop: 12 }}>Loading automation data...</p>
      ) : (
        <div style={{ marginTop: 12, border: "1px solid #5f0000", borderRadius: 12, padding: 12, background: "rgba(120,0,0,0.08)" }}>
          <h3 style={{ marginTop: 0 }}>Recent Automations</h3>
          {automations.length === 0 ? (
            <div style={{ color: "#ffaaaa" }}>No automations found for this guild.</div>
          ) : (
            <ul style={{ margin: 0, paddingLeft: 18 }}>
              {automations.slice(0, 10).map((a, idx) => (
                <li key={String(a.id || idx)}>
                  <Link href={withGuild(`/dashboard/automations/studio?automationId=${encodeURIComponent(String(a.id || ""))}`, guildId)} style={{ color: "#ffd0d0" }}>
                    {a.name || `Automation ${idx + 1}`}
                  </Link>{" "}
                  {a.enabled === false ? "(disabled)" : "(enabled)"}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
