"use client";

import { useMemo } from "react";
import EngineInsights from "@/components/possum/EngineInsights";
import { useGuildEngineEditor } from "@/components/possum/useGuildEngineEditor";

type CatTierKey = "common" | "rare" | "epic" | "legendary" | "mythic" | "god";
type CatTier = { chance: number; catchRate: number; coins: number; days?: number; hours?: number };
type CatChannelWeight = { id: string; weight: number };
type CatSpecialCatchRoles = {
  godPermanentRoleId: string;
  milestone50RoleId: string;
  milestone100RoleId: string;
  milestone200RoleId: string;
};
type CatDropCfg = {
  enabled: boolean;
  maxActiveSpawns: number;
  spawnIntervalMinutes: number;
  spawnChance: number;
  despawnMinutes: number;
  minCatchAgeMs: number;
  channels: Array<string | CatChannelWeight>;
  tiers: Record<CatTierKey, CatTier>;
  specialCatchRoles: CatSpecialCatchRoles;
};

const TIER_KEYS: CatTierKey[] = ["common", "rare", "epic", "legendary", "mythic", "god"];

const DEFAULT_CONFIG: CatDropCfg = {
  enabled: true,
  maxActiveSpawns: 2,
  spawnIntervalMinutes: 4,
  spawnChance: 0.2,
  despawnMinutes: 15,
  minCatchAgeMs: 5000,
  channels: [],
  tiers: {
    common: { chance: 0.7, catchRate: 0.75, coins: 15 },
    rare: { chance: 0.2, catchRate: 0.55, coins: 50 },
    epic: { chance: 0.07, catchRate: 0.35, coins: 120 },
    legendary: { chance: 0.02, catchRate: 0.2, coins: 250, days: 30 },
    mythic: { chance: 0.01, catchRate: 0.1, coins: 400, hours: 72 },
    god: { chance: 0.0004, catchRate: 0.08, coins: 1000, hours: 144 },
  },
  specialCatchRoles: {
    godPermanentRoleId: "",
    milestone50RoleId: "",
    milestone100RoleId: "",
    milestone200RoleId: "",
  },
};

const shell: React.CSSProperties = { color: "#ffd0d0", padding: 18, maxWidth: 1280 };
const card: React.CSSProperties = { border: "1px solid #5f0000", borderRadius: 12, padding: 14, background: "rgba(120,0,0,0.10)", marginBottom: 12 };
const input: React.CSSProperties = { width: "100%", background: "#0a0a0a", color: "#ffd0d0", border: "1px solid #7f0000", borderRadius: 8, padding: "10px 12px" };

function normalizeChannels(raw: CatDropCfg["channels"] | undefined): CatChannelWeight[] {
  return Array.isArray(raw)
    ? raw
        .map((entry) => {
          if (typeof entry === "string") return { id: entry, weight: 1 };
          return { id: String(entry?.id || "").trim(), weight: Math.max(1, Number(entry?.weight || 1)) };
        })
    : [];
}

function normalizeConfig(raw: Partial<CatDropCfg> | CatDropCfg): CatDropCfg {
  const next = { ...DEFAULT_CONFIG, ...(raw || {}) };
  return {
    ...next,
    channels: normalizeChannels(next.channels),
    tiers: {
      common: { ...DEFAULT_CONFIG.tiers.common, ...(next.tiers?.common || {}) },
      rare: { ...DEFAULT_CONFIG.tiers.rare, ...(next.tiers?.rare || {}) },
      epic: { ...DEFAULT_CONFIG.tiers.epic, ...(next.tiers?.epic || {}) },
      legendary: { ...DEFAULT_CONFIG.tiers.legendary, ...(next.tiers?.legendary || {}) },
      mythic: { ...DEFAULT_CONFIG.tiers.mythic, ...(next.tiers?.mythic || {}) },
      god: { ...DEFAULT_CONFIG.tiers.god, ...(next.tiers?.god || {}) },
    },
    specialCatchRoles: {
      ...DEFAULT_CONFIG.specialCatchRoles,
      ...(next.specialCatchRoles || {}),
    },
  };
}

function clampNum(raw: string, min: number, max: number, whole = true) {
  const n = whole ? Math.floor(Number(raw)) : Number(raw);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : min;
}

function titleizeTier(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export default function CatDropEnginePage() {
  const {
    guildId,
    guildName,
    config: rawCfg,
    setConfig: setCfg,
    channels,
    roles,
    summary,
    details,
    loading,
    saving,
    message,
    save,
    runAction,
  } = useGuildEngineEditor<CatDropCfg>("catDrop", DEFAULT_CONFIG);

  const cfg = useMemo(() => normalizeConfig(rawCfg), [rawCfg]);
  const textChannels = useMemo(
    () => channels.filter((c) => Number(c?.type) === 0 || Number(c?.type) === 5 || String(c?.type || "").toLowerCase().includes("text")),
    [channels]
  );

  function updateChannel(index: number, patch: Partial<CatChannelWeight>) {
    const next = normalizeChannels(cfg.channels);
    next[index] = { ...next[index], ...patch };
    setCfg((prev) => ({ ...normalizeConfig(prev), channels: next }));
  }

  function addChannel() {
    setCfg((prev) => ({ ...normalizeConfig(prev), channels: [...normalizeChannels(normalizeConfig(prev).channels), { id: "", weight: 1 }] }));
  }

  function removeChannel(index: number) {
    const next = normalizeChannels(cfg.channels).filter((_, i) => i !== index);
    setCfg((prev) => ({ ...normalizeConfig(prev), channels: next }));
  }

  function updateTier(key: CatTierKey, patch: Partial<CatTier>) {
    setCfg((prev) => ({
      ...normalizeConfig(prev),
      tiers: {
        ...normalizeConfig(prev).tiers,
        [key]: { ...normalizeConfig(prev).tiers[key], ...patch },
      },
    }));
  }

  async function runSpawn(action: "spawnNow" | "spawnGod") {
    await runAction(action);
  }

  if (!guildId) return <div style={{ ...shell, color: "#ff8080" }}>Missing guildId. Open from /guilds first.</div>;

  return (
    <div style={shell}>
      <h1 style={{ margin: 0, color: "#ff4444", letterSpacing: "0.12em", textTransform: "uppercase" }}>Cat Drop Engine</h1>
      <div style={{ color: "#ff9999", marginTop: 6 }}>Guild: {guildName || guildId}</div>
      <div style={{ color: "#ffb0b0", fontSize: 12, marginTop: 4 }}>
        Live cat spawn scheduler, weighted spawn lanes, rarity table, and manual spawn controls backed by the bot runtime.
      </div>
      {message ? <div style={{ marginTop: 8, color: "#ffb3f0" }}>{message}</div> : null}

      {loading ? (
        <div style={{ ...card, marginTop: 12 }}>Loading cat drop...</div>
      ) : (
        <>
          <EngineInsights summary={summary} details={details} />

          <section style={{ ...card, marginTop: 12 }}>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
              <label><input type="checkbox" checked={cfg.enabled} onChange={(e) => setCfg((prev) => ({ ...normalizeConfig(prev), enabled: e.target.checked }))} /> Enabled</label>
              <button onClick={() => runSpawn("spawnNow")} disabled={saving} style={{ ...input, width: "auto", cursor: "pointer", fontWeight: 800 }}>Spawn Cat Now</button>
              <button onClick={() => runSpawn("spawnGod")} disabled={saving} style={{ ...input, width: "auto", cursor: "pointer", fontWeight: 800, borderColor: "#a00000", color: "#ffb6b6" }}>Spawn God Cat</button>
            </div>
          </section>

          <section style={card}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 12 }}>
              <div>
                <div style={{ marginBottom: 6 }}>Max Active Spawns</div>
                <input style={input} type="number" min={1} value={cfg.maxActiveSpawns} onChange={(e) => setCfg((prev) => ({ ...normalizeConfig(prev), maxActiveSpawns: clampNum(e.target.value, 1, 25) }))} />
              </div>
              <div>
                <div style={{ marginBottom: 6 }}>Spawn Interval (minutes)</div>
                <input style={input} type="number" min={1} max={1440} value={cfg.spawnIntervalMinutes} onChange={(e) => setCfg((prev) => ({ ...normalizeConfig(prev), spawnIntervalMinutes: clampNum(e.target.value, 1, 1440) }))} />
              </div>
              <div>
                <div style={{ marginBottom: 6 }}>Spawn Chance</div>
                <input style={input} type="number" min={0} max={1} step={0.01} value={cfg.spawnChance} onChange={(e) => setCfg((prev) => ({ ...normalizeConfig(prev), spawnChance: clampNum(e.target.value, 0, 1, false) }))} />
              </div>
              <div>
                <div style={{ marginBottom: 6 }}>Despawn Window (minutes)</div>
                <input style={input} type="number" min={1} max={1440} value={cfg.despawnMinutes} onChange={(e) => setCfg((prev) => ({ ...normalizeConfig(prev), despawnMinutes: clampNum(e.target.value, 1, 1440) }))} />
              </div>
              <div>
                <div style={{ marginBottom: 6 }}>Minimum Catch Age (ms)</div>
                <input style={input} type="number" min={0} max={60000} value={cfg.minCatchAgeMs} onChange={(e) => setCfg((prev) => ({ ...normalizeConfig(prev), minCatchAgeMs: clampNum(e.target.value, 0, 60000) }))} />
              </div>
            </div>
          </section>

          <section style={card}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <div>
                <div style={{ color: "#ffb3b3", fontSize: 12, letterSpacing: "0.08em", textTransform: "uppercase" }}>Weighted Spawn Channels</div>
                <div style={{ color: "#ff9c9c", fontSize: 12 }}>Higher weight means this channel is picked more often.</div>
              </div>
              <button onClick={addChannel} style={{ ...input, width: "auto", cursor: "pointer", fontWeight: 800 }}>+ Add Channel</button>
            </div>

            {normalizeChannels(cfg.channels).length ? (
              <div style={{ display: "grid", gap: 10, marginTop: 10 }}>
                {normalizeChannels(cfg.channels).map((row, index) => (
                  <div key={`${row.id}_${index}`} style={{ display: "grid", gridTemplateColumns: "minmax(240px,1fr) 140px 120px", gap: 10, alignItems: "end" }}>
                    <div>
                      <div style={{ marginBottom: 6 }}>Channel</div>
                      <select style={input} value={row.id} onChange={(e) => updateChannel(index, { id: e.target.value })}>
                        <option value="">Select channel</option>
                        {textChannels.map((channel) => <option key={channel.id} value={channel.id}>#{channel.name}</option>)}
                      </select>
                    </div>
                    <div>
                      <div style={{ marginBottom: 6 }}>Weight</div>
                      <input style={input} type="number" min={1} value={row.weight} onChange={(e) => updateChannel(index, { weight: Math.max(1, Number(e.target.value || 1)) })} />
                    </div>
                    <button onClick={() => removeChannel(index)} style={{ ...input, cursor: "pointer", borderColor: "#a00000", color: "#ffb6b6" }}>
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ color: "#ffaaaa", fontSize: 12, marginTop: 10 }}>No spawn channels configured yet.</div>
            )}
          </section>

          <section style={card}>
            <div style={{ color: "#ffb3b3", fontSize: 12, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 10 }}>Rarity Table</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))", gap: 12 }}>
              {TIER_KEYS.map((key) => {
                const tier = cfg.tiers[key];
                return (
                  <div key={key} style={{ border: "1px solid #4f0000", borderRadius: 10, padding: 12, background: "#120000" }}>
                    <div style={{ color: "#ff6666", fontSize: 13, fontWeight: 900, letterSpacing: "0.08em", textTransform: "uppercase" }}>{titleizeTier(key)}</div>
                    <div style={{ display: "grid", gap: 8, marginTop: 10 }}>
                      <div>
                        <div style={{ marginBottom: 4 }}>Spawn Chance</div>
                        <input style={input} type="number" min={0} max={1} step={0.0001} value={tier.chance} onChange={(e) => updateTier(key, { chance: clampNum(e.target.value, 0, 1, false) })} />
                      </div>
                      <div>
                        <div style={{ marginBottom: 4 }}>Catch Rate</div>
                        <input style={input} type="number" min={0} max={1} step={0.01} value={tier.catchRate} onChange={(e) => updateTier(key, { catchRate: clampNum(e.target.value, 0, 1, false) })} />
                      </div>
                      <div>
                        <div style={{ marginBottom: 4 }}>Coin Reward</div>
                        <input style={input} type="number" min={0} max={1000000} value={tier.coins} onChange={(e) => updateTier(key, { coins: clampNum(e.target.value, 0, 1000000) })} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <section style={card}>
            <div style={{ color: "#ffb3b3", fontSize: 12, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 10 }}>
              Special Catch Roles
            </div>
            <div style={{ color: "#ff9c9c", fontSize: 12, marginBottom: 12 }}>
              These are the live role rewards already wired into the cat engine. God Cat VIP still follows your VIP engine mapping.
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 12 }}>
              <div>
                <div style={{ marginBottom: 6 }}>50 Catches Role</div>
                <select
                  style={input}
                  value={cfg.specialCatchRoles.milestone50RoleId || ""}
                  onChange={(e) =>
                    setCfg((prev) => ({
                      ...normalizeConfig(prev),
                      specialCatchRoles: {
                        ...normalizeConfig(prev).specialCatchRoles,
                        milestone50RoleId: e.target.value,
                      },
                    }))
                  }
                >
                  <option value="">Select role</option>
                  {roles.map((role) => <option key={role.id} value={role.id}>@{role.name}</option>)}
                </select>
              </div>
              <div>
                <div style={{ marginBottom: 6 }}>100 Catches Role</div>
                <select
                  style={input}
                  value={cfg.specialCatchRoles.milestone100RoleId || ""}
                  onChange={(e) =>
                    setCfg((prev) => ({
                      ...normalizeConfig(prev),
                      specialCatchRoles: {
                        ...normalizeConfig(prev).specialCatchRoles,
                        milestone100RoleId: e.target.value,
                      },
                    }))
                  }
                >
                  <option value="">Select role</option>
                  {roles.map((role) => <option key={role.id} value={role.id}>@{role.name}</option>)}
                </select>
              </div>
              <div>
                <div style={{ marginBottom: 6 }}>200 Catches Role</div>
                <select
                  style={input}
                  value={cfg.specialCatchRoles.milestone200RoleId || ""}
                  onChange={(e) =>
                    setCfg((prev) => ({
                      ...normalizeConfig(prev),
                      specialCatchRoles: {
                        ...normalizeConfig(prev).specialCatchRoles,
                        milestone200RoleId: e.target.value,
                      },
                    }))
                  }
                >
                  <option value="">Select role</option>
                  {roles.map((role) => <option key={role.id} value={role.id}>@{role.name}</option>)}
                </select>
              </div>
              <div>
                <div style={{ marginBottom: 6 }}>God Catch Permanent Role</div>
                <select
                  style={input}
                  value={cfg.specialCatchRoles.godPermanentRoleId || ""}
                  onChange={(e) =>
                    setCfg((prev) => ({
                      ...normalizeConfig(prev),
                      specialCatchRoles: {
                        ...normalizeConfig(prev).specialCatchRoles,
                        godPermanentRoleId: e.target.value,
                      },
                    }))
                  }
                >
                  <option value="">Select role</option>
                  {roles.map((role) => <option key={role.id} value={role.id}>@{role.name}</option>)}
                </select>
              </div>
            </div>
          </section>

          <div style={{ ...card, display: "flex", justifyContent: "flex-end" }}>
            <button onClick={() => save({ ...cfg, channels: normalizeChannels(cfg.channels).filter((row) => row.id) })} disabled={saving} style={{ ...input, width: "auto", cursor: "pointer", fontWeight: 900 }}>
              {saving ? "Saving..." : "Save Cat Drop"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
