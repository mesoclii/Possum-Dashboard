"use client";

import { clampNumber } from "@/lib/dashboard/numberInput";

import EngineInsights from "@/components/possum/EngineInsights";
import { useGuildEngineEditor } from "@/components/possum/useGuildEngineEditor";

type RareSpawnCfg = {
  enabled: boolean;
  minMinutes: number;
  maxMinutes: number;
  despawnMinutes: number;
  cooldownMinutes: number;
  rotationOffsetMinutes: number;
  rewardCoinsMin: number;
  rewardCoinsMax: number;
  channels: string[];
  categories: string[];
  spawnWindows: string[];
  logChannelId: string;
};

const EMPTY: RareSpawnCfg = {
  enabled: true,
  minMinutes: 30,
  maxMinutes: 90,
  despawnMinutes: 15,
  cooldownMinutes: 0,
  rotationOffsetMinutes: 0,
  rewardCoinsMin: 150,
  rewardCoinsMax: 450,
  channels: [],
  categories: [],
  spawnWindows: [],
  logChannelId: "",
};

const box: React.CSSProperties = { border: "1px solid #5f0000", borderRadius: 12, padding: 14, background: "rgba(120,0,0,0.10)", marginBottom: 12 };
const input: React.CSSProperties = { width: "100%", background: "#0a0a0a", color: "#ffd0d0", border: "1px solid #7f0000", borderRadius: 8, padding: "10px 12px" };

function toggle(list: string[], id: string) {
  const set = new Set(list || []);
  if (set.has(id)) set.delete(id); else set.add(id);
  return Array.from(set);
}

function lines(value: string) {
  return String(value || "")
    .split(/\r?\n+/)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

export default function RareSpawnEnginePage() {
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
    runAction,
  } = useGuildEngineEditor<RareSpawnCfg>("rareSpawn", EMPTY);

  const textChannels = channels.filter((c) => Number(c?.type) === 0 || String(c?.type || "").toLowerCase().includes("text"));
  const categories = channels.filter((c) => Number(c?.type) === 4 || String(c?.type || "").toLowerCase().includes("category"));

  if (!guildId) return <div style={{ color: "#ff8080", padding: 24 }}>Missing guildId. Open from /guilds first.</div>;

  return (
    <div style={{ color: "#ffd0d0", padding: 18, maxWidth: 1200 }}>
      <h1 style={{ margin: 0, color: "#ff4444", letterSpacing: "0.12em", textTransform: "uppercase" }}>Rare Spawn Engine</h1>
      <div style={{ color: "#ff9999", marginTop: 6, marginBottom: 12 }}>Guild: {guildName || guildId}</div>
      {message ? <div style={{ marginBottom: 10, color: "#ffb3f0" }}>{message}</div> : null}

      {loading ? <div style={box}>Loading...</div> : (
        <>
          <EngineInsights summary={summary} details={details} />

          <section style={{ ...box, marginTop: 12 }}>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
              <label><input type="checkbox" checked={cfg.enabled} onChange={(e) => setCfg((p) => ({ ...p, enabled: e.target.checked }))} /> Enabled</label>
              <button onClick={() => runAction("spawnNow")} disabled={saving} style={{ ...input, width: "auto", cursor: "pointer", fontWeight: 800 }}>Spawn Now</button>
              <button onClick={() => runAction("clearActive")} disabled={saving} style={{ ...input, width: "auto", cursor: "pointer", fontWeight: 800 }}>Clear Active Spawn</button>
            </div>
          </section>

          <section style={box}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 12 }}>
              <div><div>Minimum Minutes</div><input style={input} type="number" min={1} max={10080} value={cfg.minMinutes} onChange={(e) => setCfg((p) => ({ ...p, minMinutes: clampNumber(e.target.value, 1, 10080), maxMinutes: Math.max(p.maxMinutes, clampNumber(e.target.value, 1, 10080)) }))} /></div>
              <div><div>Maximum Minutes</div><input style={input} type="number" min={1} max={10080} value={cfg.maxMinutes} onChange={(e) => setCfg((p) => ({ ...p, maxMinutes: clampNumber(e.target.value, 1, 10080) }))} /></div>
              <div><div>Despawn Minutes</div><input style={input} type="number" min={1} max={10080} value={cfg.despawnMinutes} onChange={(e) => setCfg((p) => ({ ...p, despawnMinutes: clampNumber(e.target.value, 1, 10080) }))} /></div>
              <div><div>Cooldown Minutes</div><input style={input} type="number" min={0} max={10080} value={cfg.cooldownMinutes} onChange={(e) => setCfg((p) => ({ ...p, cooldownMinutes: clampNumber(e.target.value, 0, 10080) }))} /></div>
              <div><div>Rotation Offset Minutes</div><input style={input} type="number" min={0} max={10080} value={cfg.rotationOffsetMinutes} onChange={(e) => setCfg((p) => ({ ...p, rotationOffsetMinutes: clampNumber(e.target.value, 0, 10080) }))} /></div>
              <div><div>Reward Coins Min</div><input style={input} type="number" min={0} max={1000000} value={cfg.rewardCoinsMin} onChange={(e) => setCfg((p) => ({ ...p, rewardCoinsMin: clampNumber(e.target.value, 0, 1000000), rewardCoinsMax: Math.max(p.rewardCoinsMax, clampNumber(e.target.value, 0, 1000000)) }))} /></div>
              <div><div>Reward Coins Max</div><input style={input} type="number" min={0} max={1000000} value={cfg.rewardCoinsMax} onChange={(e) => setCfg((p) => ({ ...p, rewardCoinsMax: clampNumber(e.target.value, 0, 1000000) }))} /></div>
            </div>
          </section>

          <section style={box}>
            <div style={{ marginBottom: 6 }}>Spawn Windows</div>
            <textarea
              style={{ ...input, minHeight: 96 }}
              value={(cfg.spawnWindows || []).join("\n")}
              onChange={(e) => setCfg((p) => ({ ...p, spawnWindows: lines(e.target.value) }))}
            />
            <div style={{ color: "#ffb3b3", fontSize: 12, marginTop: 8 }}>
              One window per line. Example: <code>mon-fri 18:00-23:30</code> or <code>sat-sun 12:00-02:00</code>.
            </div>
          </section>

          <section style={box}>
            <div style={{ marginBottom: 6 }}>Log Channel</div>
            <select style={input} value={cfg.logChannelId || ""} onChange={(e) => setCfg((p) => ({ ...p, logChannelId: e.target.value }))}>
              <option value="">None</option>
              {textChannels.map((c) => <option key={c.id} value={c.id}>#{c.name}</option>)}
            </select>
          </section>

          <section style={box}>
            <div style={{ color: "#ffb3b3", fontSize: 12, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 6 }}>Spawn Channels</div>
            <div style={{ maxHeight: 180, overflowY: "auto", border: "1px solid #500000", borderRadius: 8, padding: 8 }}>
              {textChannels.map((c) => (
                <label key={c.id} style={{ display: "block", marginBottom: 4 }}>
                  <input type="checkbox" checked={cfg.channels.includes(c.id)} onChange={() => setCfg((p) => ({ ...p, channels: toggle(p.channels, c.id) }))} /> #{c.name}
                </label>
              ))}
            </div>
          </section>

          <section style={box}>
            <div style={{ color: "#ffb3b3", fontSize: 12, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 6 }}>Spawn Categories</div>
            <div style={{ maxHeight: 180, overflowY: "auto", border: "1px solid #500000", borderRadius: 8, padding: 8 }}>
              {categories.map((c) => (
                <label key={c.id} style={{ display: "block", marginBottom: 4 }}>
                  <input type="checkbox" checked={cfg.categories.includes(c.id)} onChange={() => setCfg((p) => ({ ...p, categories: toggle(p.categories, c.id) }))} /> {c.name}
                </label>
              ))}
            </div>
          </section>

          <button onClick={() => save()} disabled={saving} style={{ ...input, width: "auto", cursor: "pointer", fontWeight: 900 }}>
            {saving ? "Saving..." : "Save Rare Spawn"}
          </button>
        </>
      )}
    </div>
  );
}
