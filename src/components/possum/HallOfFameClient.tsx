"use client";

import { useEffect, useState } from "react";
import EngineContractPanel from "@/components/possum/EngineContractPanel";
import EngineInsights from "@/components/possum/EngineInsights";
import ProgressionStackShell from "@/components/possum/ProgressionStackShell";

type Channel = { id: string; name: string; type?: number | string };
type SummaryItem = { label: string; value: string };
type DetailItem = { rank?: number; name?: string; title?: string; value: string };
type Details = Record<string, DetailItem[] | { title: string; value: string } | null | undefined>;

type EntityConfig = {
  active: boolean;
  primaryChannelId: string;
  logChannelId: string;
  messageTemplate: string;
  notes: string;
};

const EMPTY_CONFIG: EntityConfig = {
  active: true,
  primaryChannelId: "",
  logChannelId: "",
  messageTemplate: "Hall of Fame refresh posted for {{guildName}}.",
  notes: "",
};

const shell: React.CSSProperties = { color: "#ffd0d0", padding: 18, maxWidth: 1280 };
const card: React.CSSProperties = {
  border: "1px solid #5f0000",
  borderRadius: 12,
  padding: 14,
  background: "rgba(120,0,0,0.10)",
  marginBottom: 12,
};
const input: React.CSSProperties = {
  width: "100%",
  background: "#0a0a0a",
  color: "#ffd0d0",
  border: "1px solid #7f0000",
  borderRadius: 8,
  padding: "10px 12px",
};

function getGuildId() {
  if (typeof window === "undefined") return "";
  const query = new URLSearchParams(window.location.search).get("guildId") || "";
  const stored = localStorage.getItem("activeGuildId") || "";
  const guildId = (query || stored).trim();
  if (guildId) localStorage.setItem("activeGuildId", guildId);
  return guildId;
}

export default function HallOfFameClient() {
  const [guildId, setGuildId] = useState("");
  const [guildName, setGuildName] = useState("");
  const [channels, setChannels] = useState<Channel[]>([]);
  const [summary, setSummary] = useState<SummaryItem[]>([]);
  const [details, setDetails] = useState<Details>({});
  const [config, setConfig] = useState<EntityConfig>(EMPTY_CONFIG);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    setGuildId(getGuildId());
  }, []);

  useEffect(() => {
    if (!guildId) {
      setLoading(false);
      return;
    }

    (async () => {
      setLoading(true);
      setMessage("");
      try {
        const [runtimeRes, guildRes] = await Promise.all([
          fetch(`/api/runtime/engine?guildId=${encodeURIComponent(guildId)}&engine=hallOfFame`, { cache: "no-store" }),
          fetch(`/api/bot/guild-data?guildId=${encodeURIComponent(guildId)}`, { cache: "no-store" }),
        ]);

        const runtimeJson = await runtimeRes.json().catch(() => ({}));
        const guildJson = await guildRes.json().catch(() => ({}));

        if (!runtimeRes.ok || runtimeJson?.success === false) {
          throw new Error(runtimeJson?.error || "Failed loading hall of fame runtime.");
        }

        const nextName = String(guildJson?.guild?.name || "").trim();
        if (nextName) {
          setGuildName(nextName);
          localStorage.setItem("activeGuildName", nextName);
        }
        setChannels((Array.isArray(guildJson?.channels) ? guildJson.channels : []).filter((row: Channel) => Number(row?.type) === 0 || Number(row?.type) === 5));
        setSummary(Array.isArray(runtimeJson?.summary) ? runtimeJson.summary : []);
        setDetails(runtimeJson?.details && typeof runtimeJson.details === "object" ? runtimeJson.details : {});
        setConfig({ ...EMPTY_CONFIG, ...(runtimeJson?.config || {}) });
        if (!guildRes.ok || guildJson?.success === false) {
          setMessage(guildJson?.error || "Hall Of Fame settings loaded, but Discord channels could not be loaded.");
        }
      } catch (err: any) {
        setMessage(err?.message || "Failed loading Hall of Fame.");
      } finally {
        setLoading(false);
      }
    })();
  }, [guildId]);

  async function save() {
    if (!guildId) return;
    setSaving(true);
    setMessage("");
    try {
      const res = await fetch("/api/runtime/engine", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          guildId,
          engine: "hallOfFame",
          patch: { ...config, messageTemplate: String(config.messageTemplate || "").slice(0, 2000) },
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json?.success === false) {
        throw new Error(json?.error || "Save failed");
      }
      setConfig({ ...EMPTY_CONFIG, ...(json?.config || config) });
      setMessage("Hall Of Fame settings saved.");
    } catch (err: any) {
      setMessage(err?.message || "Save failed.");
    } finally {
      setSaving(false);
    }
  }

  async function publishNow() {
    if (!guildId) return;
    setPublishing(true);
    setMessage("");
    try {
      const res = await fetch("/api/runtime/engine-action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          guildId,
          engine: "hallOfFame",
          action: "publishNow",
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json?.success === false) {
        throw new Error(json?.error || "Publish failed");
      }
      if (Array.isArray(json?.summary)) setSummary(json.summary);
      if (json?.details && typeof json.details === "object") setDetails(json.details);
      setMessage("Hall Of Fame leaderboard published.");
    } catch (err: any) {
      setMessage(err?.message || "Publish failed.");
    } finally {
      setPublishing(false);
    }
  }

  if (!guildId) {
    return <div style={{ ...shell, color: "#ff8080" }}>Missing guildId. Open from /guilds first.</div>;
  }

  return (
    <div style={shell}>
      <ProgressionStackShell
        activeKey="hallOfFame"
        title="Hall Of Fame"
        subtitle="Recognition layer for the achievement stack. This page surfaces top achievers and the display routing that should be used when you expose the Hall publicly."
      />
      <EngineContractPanel
        engineKey="hallOfFame"
        intro="Hall Of Fame is the recognition surface for the linked progression stack. It should reflect achievement output and prestige history, not create its own parallel progression logic."
        related={[
          { label: "Achievements", route: "/dashboard/achievements", reason: "achievement unlocks are the raw fuel for Hall Of Fame recognition" },
          { label: "Prestige", route: "/dashboard/prestige", reason: "prestige milestones should be reflected in how public recognition is framed" },
          { label: "Loyalty", route: "/dashboard/loyalty", reason: "long-tail tenure rewards help define which recognition moments deserve public display" },
        ]}
      />

      <div style={{ color: "#ff9999", marginTop: -2, marginBottom: 12 }}>Guild: {guildName || guildId}</div>
      {message ? <div style={{ marginBottom: 10, color: "#ffd27a" }}>{message}</div> : null}

      {loading ? (
        <div style={card}>Loading Hall Of Fame...</div>
      ) : (
        <>
          <EngineInsights summary={summary} details={details} />

          <section style={{ ...card, marginTop: 12 }}>
            <label>
              <input
                type="checkbox"
                checked={config.active}
                onChange={(e) => setConfig((prev) => ({ ...prev, active: e.target.checked }))}
              />{" "}
              Hall Of Fame Active
            </label>
            <div style={{ color: "#ffb0b0", fontSize: 12, marginTop: 8, lineHeight: 1.6 }}>
              Hall Of Fame reads the achievement layer. It does not create progression itself. If this is off, the command/display surface should be treated as hidden even though achievement tracking still exists underneath.
            </div>
          </section>

          <section style={card}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))", gap: 12 }}>
              <div>
                <div style={{ marginBottom: 6 }}>Leaderboard Channel</div>
                <select
                  style={input}
                  value={config.primaryChannelId}
                  onChange={(e) => setConfig((prev) => ({ ...prev, primaryChannelId: e.target.value }))}
                >
                  <option value="">Select channel</option>
                  {channels.map((channel) => (
                    <option key={channel.id} value={channel.id}>
                      #{channel.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <div style={{ marginBottom: 6 }}>Hall Audit / Log Channel</div>
                <select
                  style={input}
                  value={config.logChannelId}
                  onChange={(e) => setConfig((prev) => ({ ...prev, logChannelId: e.target.value }))}
                >
                  <option value="">Select channel</option>
                  {channels.map((channel) => (
                    <option key={channel.id} value={channel.id}>
                      #{channel.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </section>

          <section style={card}>
            <div style={{ marginBottom: 6 }}>Announcement Template</div>
            <textarea
              style={{ ...input, minHeight: 90 }}
              maxLength={2000}
              value={config.messageTemplate}
              onChange={(e) => setConfig((prev) => ({ ...prev, messageTemplate: e.target.value }))}
            />
            <div style={{ color: "#ffaaaa", fontSize: 12, marginTop: 8 }}>
              Suggested variables: <code>{"{{guildName}}"}</code>, <code>{"{{userId}}"}</code>, <code>{"{{achievementCount}}"}</code>
            </div>
          </section>

          <section style={card}>
            <div style={{ marginBottom: 6 }}>Recognition Notes</div>
            <textarea
              style={{ ...input, minHeight: 120 }}
              maxLength={2000}
              value={config.notes}
              onChange={(e) => setConfig((prev) => ({ ...prev, notes: e.target.value }))}
            />
          </section>

          <div style={{ ...card, display: "flex", justifyContent: "flex-end", gap: 10, flexWrap: "wrap" }}>
            <button onClick={publishNow} disabled={publishing} style={{ ...input, width: "auto", cursor: "pointer", fontWeight: 900 }}>
              {publishing ? "Publishing..." : "Publish Leaderboard"}
            </button>
            <button onClick={save} disabled={saving} style={{ ...input, width: "auto", cursor: "pointer", fontWeight: 900 }}>
              {saving ? "Saving..." : "Save Hall Of Fame"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
