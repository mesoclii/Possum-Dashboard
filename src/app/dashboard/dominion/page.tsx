"use client";

import { useEffect, useMemo, useState } from "react";
import EngineContractPanel from "@/components/possum/EngineContractPanel";
import EngineInsights from "@/components/possum/EngineInsights";
import { useGuildEngineEditor } from "@/components/possum/useGuildEngineEditor";

type DominionCfg = {
  enabled: boolean;
  seasonsEnabled: boolean;
  seasonLengthDays: number;
  raidWindows: string[];
  timezone: string;
  basePayout: number;
  territoryDecayHours: number;
  announceChannelId: string;
  defaultRaidDurationMinutes: number;
  defaultRaidHealthPool: number;
  defaultRaidMaxTheft: number;
};

const DEFAULT_DOMINION: DominionCfg = {
  enabled: true,
  seasonsEnabled: false,
  seasonLengthDays: 30,
  raidWindows: [],
  timezone: "",
  basePayout: 500,
  territoryDecayHours: 0,
  announceChannelId: "",
  defaultRaidDurationMinutes: 30,
  defaultRaidHealthPool: 5000,
  defaultRaidMaxTheft: 5000,
};

function clampNum(raw: string, min: number, max: number) {
  const n = Math.floor(Number(raw));
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : min;
}

const shell: React.CSSProperties = { color: "#ffd0d0", padding: 18, maxWidth: 1280 };
const card: React.CSSProperties = { border: "1px solid #6a0000", borderRadius: 12, background: "rgba(120,0,0,0.10)", padding: 14, marginBottom: 12 };
const input: React.CSSProperties = { width: "100%", padding: "10px 12px", background: "#0b0b0b", color: "#ffd8d8", border: "1px solid #7a0000", borderRadius: 8 };

export default function DominionEnginePage() {
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
  } = useGuildEngineEditor<DominionCfg>("dominion", DEFAULT_DOMINION);

  const [windowsText, setWindowsText] = useState("");
  useEffect(() => {
    if (!loading) setWindowsText((cfg.raidWindows || []).join("\n"));
    // Only resync when the config finishes loading; typing keeps its own draft.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading]);

  const textChannels = useMemo(
    () => channels.filter((c) => Number(c?.type) === 0 || String(c?.type || "").toLowerCase().includes("text")),
    [channels]
  );

  if (!guildId) return <div style={{ ...shell, color: "#ff8a8a" }}>Missing guildId. Open from /guilds first.</div>;

  return (
    <div style={shell}>
      <h1 style={{ margin: 0, color: "#ff4444", letterSpacing: "0.12em", textTransform: "uppercase" }}>Dominion Engine</h1>
      <div style={{ color: "#ff9c9c", marginTop: 6 }}>Guild: {guildName || guildId}</div>
      <div style={{ color: "#ffb0b0", fontSize: 12, marginTop: 4 }}>
        Real dominion runtime controls with live raids, territories, leaderboard state, and season reset.
      </div>
      {message ? <div style={{ color: "#ffb3f0", marginTop: 8 }}>{message}</div> : null}

      {loading ? (
        <div style={card}>Loading dominion...</div>
      ) : (
        <>
          <EngineContractPanel
            engineKey="dominion"
            intro="Dominion is the crew-vs-crew war layer. This page controls season cadence, raid availability, payout timing, and the default health/theft profile that every active raid starts from."
            related={[
              { label: "Crew", route: "/dashboard/crew", reason: "dominion ownership, raids, and war state all resolve against crew identity" },
              { label: "Contracts", route: "/dashboard/contracts", reason: "dominion objectives and payouts should stay aligned with the wider economy loop" },
              { label: "Hall Of Fame", route: "/dashboard/halloffame", reason: "major competitive milestones can surface into recognition and archive layers" },
            ]}
          />
          <EngineInsights summary={summary} details={details} />

          <section style={{ ...card, marginTop: 12 }}>
            <div style={{ display: "flex", gap: 14, flexWrap: "wrap", alignItems: "center" }}>
              <label><input type="checkbox" checked={cfg.enabled} onChange={(e) => setCfg((p) => ({ ...p, enabled: e.target.checked }))} /> Dominion Enabled</label>
              <label><input type="checkbox" checked={cfg.seasonsEnabled} onChange={(e) => setCfg((p) => ({ ...p, seasonsEnabled: e.target.checked }))} /> Seasons Enabled</label>
              <button onClick={() => runAction("resetSeason")} disabled={saving} style={{ ...input, width: "auto", cursor: "pointer", fontWeight: 800 }}>
                Reset Season
              </button>
            </div>
          </section>

          <section style={card}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))", gap: 12 }}>
              <div>
                <div style={{ marginBottom: 6, color: "#ff9c9c", textTransform: "uppercase", letterSpacing: "0.08em", fontSize: 12 }}>Season Cadence</div>
                <div style={{ color: "#ffd0d0", lineHeight: 1.7 }}>
                  Season length decides when the season auto-rolls over (when Seasons Enabled) and resets ratings. Short seasons keep pressure high; longer seasons make territory income and raid defense matter more.
                </div>
              </div>
              <div>
                <div style={{ marginBottom: 6, color: "#ff9c9c", textTransform: "uppercase", letterSpacing: "0.08em", fontSize: 12 }}>Raid Defaults</div>
                <div style={{ color: "#ffd0d0", lineHeight: 1.7 }}>
                  Duration, health pool, and max theft are the baseline combat contract for every raid. If these drift too low, raids turn into free money instead of a real crew conflict loop.
                </div>
              </div>
            </div>
          </section>

          <section style={card}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 12 }}>
              <div><div style={{ marginBottom: 6 }}>Season Length (days, 1-365)</div><input style={input} type="number" min={1} max={365} value={cfg.seasonLengthDays} onChange={(e) => setCfg((p) => ({ ...p, seasonLengthDays: clampNum(e.target.value, 1, 365) }))} /></div>
              <div><div style={{ marginBottom: 6 }}>Base Payout (coins/hour per new territory)</div><input style={input} type="number" min={0} max={1000000} value={cfg.basePayout} onChange={(e) => setCfg((p) => ({ ...p, basePayout: clampNum(e.target.value, 0, 1000000) }))} /></div>
              <div>
                <div style={{ marginBottom: 6 }}>Announce Channel</div>
                <select style={input} value={cfg.announceChannelId || ""} onChange={(e) => setCfg((p) => ({ ...p, announceChannelId: e.target.value }))}>
                  <option value="">Select channel</option>
                  {textChannels.map((c) => <option key={c.id} value={c.id}>#{c.name}</option>)}
                </select>
              </div>
            </div>
          </section>

          <section style={card}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 12 }}>
              <div><div style={{ marginBottom: 6 }}>Default Raid Minutes (1-10080)</div><input style={input} type="number" min={1} max={10080} value={cfg.defaultRaidDurationMinutes} onChange={(e) => setCfg((p) => ({ ...p, defaultRaidDurationMinutes: clampNum(e.target.value, 1, 10080) }))} /></div>
              <div><div style={{ marginBottom: 6 }}>Default Raid Health</div><input style={input} type="number" min={1} max={10000000} value={cfg.defaultRaidHealthPool} onChange={(e) => setCfg((p) => ({ ...p, defaultRaidHealthPool: clampNum(e.target.value, 1, 10000000) }))} /></div>
              <div><div style={{ marginBottom: 6 }}>Default Max Theft</div><input style={input} type="number" min={1} max={10000000} value={cfg.defaultRaidMaxTheft} onChange={(e) => setCfg((p) => ({ ...p, defaultRaidMaxTheft: clampNum(e.target.value, 1, 10000000) }))} /></div>
            </div>
          </section>

          <section style={card}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))", gap: 12 }}>
              <div>
                <div style={{ marginBottom: 6 }}>Raid Windows (optional, one per line)</div>
                <textarea
                  style={{ ...input, minHeight: 84, fontFamily: "monospace" }}
                  placeholder={"Fri 20:00-22:00\nSat 22:00-02:00"}
                  value={windowsText}
                  onChange={(e) => {
                    setWindowsText(e.target.value);
                    const list = e.target.value.split("\n").map((s) => s.trim()).filter(Boolean).slice(0, 14);
                    setCfg((p) => ({ ...p, raidWindows: list }));
                  }}
                />
                <div style={{ color: "#ffb0b0", fontSize: 12, marginTop: 4 }}>
                  Leave empty to allow raids at any time. Format: Day(s) HH:MM-HH:MM, e.g. &quot;Fri,Sat 20:00-22:00&quot;. Windows may cross midnight (&quot;Fri 22:00-02:00&quot;). Invalid entries are rejected on save.
                </div>
              </div>
              <div>
                <div style={{ marginBottom: 6 }}>Raid Window Timezone (IANA)</div>
                <input style={input} placeholder="UTC" value={cfg.timezone || ""} onChange={(e) => setCfg((p) => ({ ...p, timezone: e.target.value.trim() }))} />
                <div style={{ color: "#ffb0b0", fontSize: 12, marginTop: 4 }}>e.g. America/New_York. Blank uses UTC. Only used when raid windows are set.</div>
              </div>
              <div>
                <div style={{ marginBottom: 6 }}>Territory Decay (hours idle, 0-8760)</div>
                <input style={input} type="number" min={0} max={8760} value={cfg.territoryDecayHours} onChange={(e) => setCfg((p) => ({ ...p, territoryDecayHours: clampNum(e.target.value, 0, 8760) }))} />
                <div style={{ color: "#ffb0b0", fontSize: 12, marginTop: 4 }}>
                  0 = off. A territory not claimed, defended, or raided for this long loses 25% of its income each period and becomes unowned at zero. Activity restores its income.
                </div>
              </div>
            </div>
          </section>

          <div style={{ ...card, display: "flex", justifyContent: "flex-end" }}>
            <button onClick={() => save()} disabled={saving} style={{ ...input, width: "auto", cursor: "pointer", fontWeight: 900 }}>
              {saving ? "Saving..." : "Save Dominion"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
