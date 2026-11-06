"use client";

import { clampNumber } from "@/lib/dashboard/numberInput";

import EngineInsights from "@/components/possum/EngineInsights";
import { useGuildEngineEditor } from "@/components/possum/useGuildEngineEditor";

type TruthDareCfg = {
  enabled: boolean;
  channelId: string;
  builtInTruthEnabled: boolean;
  builtInDareEnabled: boolean;
  truthPool: string;
  darePool: string;
  minBet: number;
  maxBet: number;
  generatedEnabled: boolean;
};

const DEFAULT_CONFIG: TruthDareCfg = {
  enabled: true,
  channelId: "",
  builtInTruthEnabled: true,
  builtInDareEnabled: true,
  truthPool: "",
  darePool: "",
  minBet: 0,
  maxBet: 50000,
  generatedEnabled: true,
};

const shell: React.CSSProperties = { color: "#ffd0d0", padding: 18, maxWidth: 1200 };
const card: React.CSSProperties = { border: "1px solid #5f0000", borderRadius: 12, padding: 14, background: "rgba(120,0,0,0.10)", marginBottom: 12 };
const input: React.CSSProperties = { width: "100%", background: "#0a0a0a", color: "#ffd0d0", border: "1px solid #7f0000", borderRadius: 8, padding: "10px 12px" };

export default function TruthDareEnginePage() {
  const {
    guildId,
    guildName,
    config: cfg,
    setConfig: setCfg,
    channels,
    summary,
    details,
    loading,
    saving,
    message,
    save,
  } = useGuildEngineEditor<TruthDareCfg>("truthDare", DEFAULT_CONFIG);

  const textChannels = channels.filter((c) => Number(c?.type) === 0 || Number(c?.type) === 5 || String(c?.type || "").toLowerCase().includes("text"));

  if (!guildId) return <div style={{ ...shell, color: "#ff8080" }}>Missing guildId. Open from /guilds first.</div>;

  return (
    <div style={shell}>
      <h1 style={{ margin: 0, color: "#ff4444", letterSpacing: "0.12em", textTransform: "uppercase" }}>Truth Or Dare Engine</h1>
      <div style={{ color: "#ff9999", marginTop: 6 }}>Guild: {guildName || guildId}</div>
      <div style={{ color: "#ffb0b0", fontSize: 12, marginTop: 4 }}>
        Built-in prompts are included by default. Add your own prompts on top, or switch the built-in truth/dare pools off if a guild wants only custom questions.
      </div>
      {message ? <div style={{ marginTop: 8, color: "#ffb3f0" }}>{message}</div> : null}

      {loading ? (
        <div style={{ ...card, marginTop: 12 }}>Loading truth or dare...</div>
      ) : (
        <>
          <EngineInsights summary={summary} details={details} />

          <section style={{ ...card, marginTop: 12 }}>
            <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
              <label><input type="checkbox" checked={cfg.enabled} onChange={(e) => setCfg((p) => ({ ...p, enabled: e.target.checked }))} /> Enabled</label>
              <label><input type="checkbox" checked={cfg.builtInTruthEnabled} onChange={(e) => setCfg((p) => ({ ...p, builtInTruthEnabled: e.target.checked }))} /> Built-In Truths Enabled</label>
              <label><input type="checkbox" checked={cfg.builtInDareEnabled} onChange={(e) => setCfg((p) => ({ ...p, builtInDareEnabled: e.target.checked }))} /> Built-In Dares Enabled</label>
              <label><input type="checkbox" checked={cfg.generatedEnabled} onChange={(e) => setCfg((p) => ({ ...p, generatedEnabled: e.target.checked }))} /> Generated Prompts Enabled</label>
            </div>
          </section>

          <section style={card}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 12 }}>
              <div>
                <div style={{ marginBottom: 6 }}>Locked Channel</div>
                <select style={input} value={cfg.channelId || ""} onChange={(e) => setCfg((p) => ({ ...p, channelId: e.target.value }))}>
                  <option value="">Any text channel</option>
                  {textChannels.map((channel) => <option key={channel.id} value={channel.id}>#{channel.name}</option>)}
                </select>
              </div>
              <div>
                <div style={{ marginBottom: 6 }}>Minimum Bet</div>
                <input style={input} type="number" min={0} max={1000000000} value={cfg.minBet} onChange={(e) => setCfg((p) => ({ ...p, minBet: clampNumber(e.target.value, 0, 1000000000) }))} />
              </div>
              <div>
                <div style={{ marginBottom: 6 }}>Maximum Bet</div>
                <input style={input} type="number" min={0} max={1000000000} value={cfg.maxBet} onChange={(e) => setCfg((p) => ({ ...p, maxBet: clampNumber(e.target.value, 0, 1000000000) }))} />
              </div>
            </div>
          </section>

          <section style={card}>
            <div style={{ marginBottom: 6 }}>Additional Truth Prompts (one prompt per line)</div>
            <textarea style={{ ...input, minHeight: 150 }} value={cfg.truthPool} onChange={(e) => setCfg((p) => ({ ...p, truthPool: e.target.value }))} />
          </section>

          <section style={card}>
            <div style={{ marginBottom: 6 }}>Additional Dare Prompts (one prompt per line)</div>
            <textarea style={{ ...input, minHeight: 150 }} value={cfg.darePool} onChange={(e) => setCfg((p) => ({ ...p, darePool: e.target.value }))} />
          </section>

          <div style={{ ...card, display: "flex", justifyContent: "flex-end" }}>
            <button onClick={() => save()} disabled={saving} style={{ ...input, width: "auto", cursor: "pointer", fontWeight: 900 }}>
              {saving ? "Saving..." : "Save Truth Or Dare"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
