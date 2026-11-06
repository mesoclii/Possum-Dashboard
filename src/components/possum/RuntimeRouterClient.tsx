"use client";

import Link from "next/link";
import EngineInsights from "@/components/possum/EngineInsights";
import { useGuildEngineEditor } from "@/components/possum/useGuildEngineEditor";
import { buildDashboardHref } from "@/lib/dashboardContext";

type RuntimeRouterCfg = {
  personaAiEnabled: boolean | null;
  adaptiveAiEnabled: boolean | null;
  personaOnlyChannelIds: string[];
  personaKeywordTriggers: string[];
};

const DEFAULT_CFG: RuntimeRouterCfg = {
  personaAiEnabled: false,
  adaptiveAiEnabled: true,
  personaOnlyChannelIds: [],
  personaKeywordTriggers: ["persona", "character"],
};

const shell: React.CSSProperties = { color: "#ffd0d0", padding: 18, maxWidth: 1360 };
const card: React.CSSProperties = {
  border: "1px solid #5f0000",
  borderRadius: 14,
  padding: 16,
  background: "linear-gradient(180deg, rgba(120,0,0,0.12), rgba(0,0,0,0.72))",
  marginBottom: 14,
};
const input: React.CSSProperties = {
  width: "100%",
  background: "#0a0a0a",
  color: "#ffd0d0",
  border: "1px solid #7f0000",
  borderRadius: 10,
  padding: "10px 12px",
};
const action: React.CSSProperties = {
  ...input,
  width: "auto",
  cursor: "pointer",
  fontWeight: 900,
  textDecoration: "none",
  display: "inline-flex",
  alignItems: "center",
};
const label: React.CSSProperties = {
  color: "#ffb9b9",
  fontSize: 12,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  marginBottom: 6,
};

function toggle(list: string[], id: string) {
  const next = new Set(list || []);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  return Array.from(next);
}

export default function RuntimeRouterClient() {
  const {
    guildId,
    guildName,
    config: cfg,
    setConfig: setCfg,
    channels,
    summary,
    loading,
    saving,
    message,
    save,
    runAction,
  } = useGuildEngineEditor<RuntimeRouterCfg>("runtimeRouter", DEFAULT_CFG);

  const textChannels = channels.filter((c) => Number(c?.type) === 0 || Number(c?.type) === 5 || String(c?.type || "").toLowerCase().includes("text"));
  const keywordText = (cfg.personaKeywordTriggers || []).join(", ");

  if (!guildId) {
    return <div style={{ ...shell, color: "#ff8080" }}>Missing guildId. Open from /guilds first.</div>;
  }

  return (
    <div style={shell}>
      <h1 style={{ margin: 0, color: "#ff4444", letterSpacing: "0.12em", textTransform: "uppercase" }}>AI Talking Rules</h1>
      <div style={{ color: "#ff9999", marginTop: 6, marginBottom: 10 }}>Guild: {guildName || guildId}</div>
      <div style={{ ...card, color: "#ffb8b8", lineHeight: 1.7 }}>
        This page only decides <strong>who talks where</strong>.
        <br />
        Free <strong>Possum AI</strong> handles your normal homemade bot replies.
        <br />
        <strong>Persona AI</strong> is separate and should only be turned on if you want paid persona-style channels or trigger words.
      </div>
      {message ? <div style={{ marginBottom: 10, color: "#ffb3f0" }}>{message}</div> : null}

      {loading ? (
        <div style={card}>Loading AI talking rules...</div>
      ) : (
        <>
          <EngineInsights summary={summary} details={{}} />

          <section style={card}>
            <div style={{ color: "#ffb3b3", fontSize: 12, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 10 }}>
              Who Is Allowed To Answer
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))", gap: 14 }}>
              <label style={{ color: "#ffdcdc", fontWeight: 700, display: "block" }}>
                <input
                  type="checkbox"
                  checked={cfg.adaptiveAiEnabled !== false}
                  onChange={(e) => setCfg((prev) => ({ ...prev, adaptiveAiEnabled: e.target.checked }))}
                />{" "}
                Free Possum AI can answer in this guild
                <div style={{ color: "#ffb8b8", fontSize: 12, fontWeight: 500, marginTop: 8 }}>
                  Leave this on for your normal homemade Possum replies.
                </div>
              </label>
              <label style={{ color: "#ffdcdc", fontWeight: 700, display: "block" }}>
                <input
                  type="checkbox"
                  checked={!!cfg.personaAiEnabled}
                  onChange={(e) => setCfg((prev) => ({ ...prev, personaAiEnabled: e.target.checked }))}
                />{" "}
                Persona AI can answer in this guild
                <div style={{ color: "#ffb8b8", fontSize: 12, fontWeight: 500, marginTop: 8 }}>
                  Turn this on only if you want the paid persona path to take over in special channels or on special trigger words.
                </div>
              </label>
            </div>
            <div style={{ color: "#ffb8b8", fontSize: 13, lineHeight: 1.7, marginTop: 12 }}>
              Best default for most guilds: keep <strong>Free Possum AI on</strong>, keep <strong>Persona AI off</strong>, and only reserve persona channels if you actually use the paid persona feature.
            </div>
          </section>

          <section style={card}>
            <div style={{ color: "#ffb3b3", fontSize: 12, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 10 }}>
              Persona AI Rules
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))", gap: 14 }}>
              <div>
                <div style={label}>Words That Switch To Persona AI</div>
                <textarea
                  style={{ ...input, minHeight: 110 }}
                  value={keywordText}
                  onChange={(e) =>
                    setCfg((prev) => ({
                      ...prev,
                      personaKeywordTriggers: e.target.value
                        .split(",")
                        .map((value) => value.trim())
                        .filter(Boolean),
                    }))
                  }
                  placeholder="persona, character"
                />
                <div style={{ color: "#ffb8b8", fontSize: 12, marginTop: 8 }}>
                  Separate each word with a comma. If someone uses one of these words, the bot can switch over to Persona AI.
                </div>
              </div>
              <div>
                <div style={label}>Channels Reserved For Persona AI</div>
                <div style={{ maxHeight: 260, overflowY: "auto", border: "1px solid #500000", borderRadius: 10, padding: 10, background: "#0a0a0a" }}>
                  {textChannels.length ? textChannels.map((channel) => (
                    <label key={channel.id} style={{ display: "block", color: "#ffdcdc", marginBottom: 6 }}>
                      <input
                        type="checkbox"
                        checked={(cfg.personaOnlyChannelIds || []).includes(channel.id)}
                        onChange={() =>
                          setCfg((prev) => ({
                            ...prev,
                            personaOnlyChannelIds: toggle(prev.personaOnlyChannelIds || [], channel.id),
                          }))
                        }
                      />{" "}
                      #{channel.name}
                    </label>
                  )) : <div style={{ color: "#ffb8b8", fontSize: 12 }}>No text channels loaded yet.</div>}
                </div>
                <div style={{ color: "#ffb8b8", fontSize: 12, marginTop: 8 }}>
                  Messages in these channels stay on the Persona AI side so your free Possum AI does not step on them.
                </div>
              </div>
            </div>
          </section>

          <details style={card}>
            <summary style={{ cursor: "pointer", fontWeight: 800, color: "#ffdada" }}>Advanced cleanup tools</summary>
            <div style={{ color: "#ffb8b8", fontSize: 12, lineHeight: 1.7, marginTop: 12, marginBottom: 12 }}>
              These are reset buttons for live memory. Use them only when you want the bot to forget what it recently learned in this guild.
            </div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button onClick={() => void runAction("clearReplyMemory")} disabled={saving} style={action}>
                Forget Recent Reply Memory
              </button>
              <button onClick={() => void runAction("wipeProfiles")} disabled={saving} style={action}>
                Erase Learned Member Vibes
              </button>
              <button onClick={() => void runAction("wipeKnowledge")} disabled={saving} style={action}>
                Clear Stored Knowledge
              </button>
            </div>
          </details>

          <section style={{ ...card, display: "flex", justifyContent: "space-between", gap: 14, alignItems: "center", flexWrap: "wrap" }}>
            <div style={{ color: "#ffb8b8", lineHeight: 1.7, maxWidth: 820 }}>
              Need the deeper free AI settings like backstory, knowledge banks, or learning style? Go to <strong>Possum AI</strong>. This tab is only the traffic cop for who answers where.
            </div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <Link href={buildDashboardHref("/dashboard/ai/learning")} style={action}>
                Open Possum AI
              </Link>
              <button onClick={() => void save()} disabled={saving} style={action}>
                {saving ? "Saving..." : "Save Talking Rules"}
              </button>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
