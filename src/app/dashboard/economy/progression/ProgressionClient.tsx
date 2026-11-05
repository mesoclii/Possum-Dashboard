"use client";



import { useEffect, useMemo, useState } from "react";
import EngineContractPanel from "@/components/possum/EngineContractPanel";
import ProgressionStackShell from "@/components/possum/ProgressionStackShell";

type Role = { id: string; name: string };
type Channel = { id: string; name: string; type?: number | string };
type BackgroundOption = { id: string; label: string };

type LevelRoleReward = { level: number; roleId: string; oneTime: boolean };
type LevelCoinReward = { level: number; coins: number; oneTime: boolean };

type Cfg = {
  active: boolean;
  xp: {
    enabled: boolean;
    xpPerMessageMin: number;
    xpPerMessageMax: number;
    cooldownSeconds: number;
    minMessageLength: number;
    levelFormula: string;
    maxLevel: number;
    ignoredChannelIds: string[];
    ignoredRoleIds: string[];
  };
  levelUp: {
    enabled: boolean;
    announceChannelId: string;
    cardBackgroundId: string;
    announceTemplate: string;
    dmOnLevelUp: boolean;
    dmTemplate: string;
  };
  achievements: {
    enabled: boolean;
    autoGrant: boolean;
    announceChannelId: string;
    cardBackgroundId: string;
    categoriesEnabled: {
      messages: boolean;
      invites: boolean;
      economy: boolean;
      games: boolean;
      governance: boolean;
    };
  };
  badges: {
    enabled: boolean;
    panelEnabled: boolean;
    panelChannelId: string;
    cardBackgroundId: string;
    panelTitle: string;
    panelThumbnailUrl: string;
    panelImageUrl: string;
    roleSyncEnabled: boolean;
  };
  rewards: {
    levelRoleRewards: LevelRoleReward[];
    levelCoinRewards: LevelCoinReward[];
  };
  multipliers: {
    weekendBoostEnabled: boolean;
    weekendMultiplier: number;
    vipRoleIds: string[];
    vipMultiplier: number;
    boosterRoleIds: string[];
    boosterMultiplier: number;
  };
  antiAbuse: {
    enabled: boolean;
    antiSpamWindowSec: number;
    antiSpamMaxMessages: number;
    maxXpPerMinute: number;
  };
  notes: string;
};

const DEFAULT_CFG: Cfg = {
  active: true,
  xp: {
    enabled: true,
    xpPerMessageMin: 5,
    xpPerMessageMax: 15,
    cooldownSeconds: 45,
    minMessageLength: 6,
    levelFormula: "classic",
    maxLevel: 200,
    ignoredChannelIds: [],
    ignoredRoleIds: [],
  },
  levelUp: {
    enabled: true,
    announceChannelId: "",
    cardBackgroundId: "possum-night",
    announceTemplate: "🎉 <@{{userId}}> reached level {{level}} in {{guildName}}!",
    dmOnLevelUp: false,
    dmTemplate: "You reached level {{level}} in {{guildName}}."
  },
  achievements: {
    enabled: true,
    autoGrant: true,
    announceChannelId: "",
    cardBackgroundId: "possum-night",
    categoriesEnabled: {
      messages: true,
      invites: true,
      economy: true,
      games: true,
      governance: true
    }
  },
  badges: {
    enabled: true,
    panelEnabled: false,
    panelChannelId: "",
    cardBackgroundId: "possum-night",
    panelTitle: "Achievements & Badges",
    panelThumbnailUrl: "",
    panelImageUrl: "",
    roleSyncEnabled: true
  },
  rewards: {
    levelRoleRewards: [{ level: 5, roleId: "", oneTime: false }],
    levelCoinRewards: [{ level: 10, coins: 250, oneTime: true }]
  },
  multipliers: {
    weekendBoostEnabled: false,
    weekendMultiplier: 1.5,
    vipRoleIds: [],
    vipMultiplier: 1.25,
    boosterRoleIds: [],
    boosterMultiplier: 1.15
  },
  antiAbuse: {
    enabled: true,
    antiSpamWindowSec: 30,
    antiSpamMaxMessages: 6,
    maxXpPerMinute: 120
  },
  notes: ""
};

function getGuildId(): string {
  if (typeof window === "undefined") return "";
  const fromUrl = new URLSearchParams(window.location.search).get("guildId") || "";
  const fromStore = localStorage.getItem("activeGuildId") || "";
  const guildId = (fromUrl || fromStore).trim();
  if (guildId) localStorage.setItem("activeGuildId", guildId);
  return guildId;
}

function fromCsv(v: string): string[] {
  return v.split(",").map((x) => x.trim()).filter(Boolean);
}

function toCsv(v: string[]): string {
  return (v || []).join(", ");
}

function parseBackgroundRows(value: unknown): BackgroundOption[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((row: any) => {
      const id = String(row?.value || "").split("|")[0]?.trim() || "";
      const label = String(row?.name || row?.title || id || "Background").trim();
      return id ? { id, label } : null;
    })
    .filter(Boolean) as BackgroundOption[];
}

function mergeCfg(raw: any): Cfg {
  return {
    ...DEFAULT_CFG,
    ...(raw || {}),
    xp: { ...DEFAULT_CFG.xp, ...(raw?.xp || {}) },
    levelUp: { ...DEFAULT_CFG.levelUp, ...(raw?.levelUp || {}) },
    achievements: {
      ...DEFAULT_CFG.achievements,
      ...(raw?.achievements || {}),
      categoriesEnabled: {
        ...DEFAULT_CFG.achievements.categoriesEnabled,
        ...(raw?.achievements?.categoriesEnabled || {})
      }
    },
    badges: { ...DEFAULT_CFG.badges, ...(raw?.badges || {}) },
    rewards: {
      ...DEFAULT_CFG.rewards,
      ...(raw?.rewards || {}),
      levelRoleRewards: Array.isArray(raw?.rewards?.levelRoleRewards) ? raw.rewards.levelRoleRewards : DEFAULT_CFG.rewards.levelRoleRewards,
      levelCoinRewards: Array.isArray(raw?.rewards?.levelCoinRewards) ? raw.rewards.levelCoinRewards : DEFAULT_CFG.rewards.levelCoinRewards
    },
    multipliers: { ...DEFAULT_CFG.multipliers, ...(raw?.multipliers || {}) },
    antiAbuse: { ...DEFAULT_CFG.antiAbuse, ...(raw?.antiAbuse || {}) }
  };
}

const box = { border: "1px solid #5f0000", borderRadius: 12, padding: 14, background: "rgba(120,0,0,0.07)", marginBottom: 14 };
const input = { width: "100%", padding: 10, background: "#0a0a0a", border: "1px solid #6f0000", color: "#ffd7d7", borderRadius: 8 } as const;

export default function ProgressionPage() {
  const [guildId, setGuildId] = useState("");
  const [cfg, setCfg] = useState<Cfg>(DEFAULT_CFG);
  const [roles, setRoles] = useState<Role[]>([]);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [backgrounds, setBackgrounds] = useState<BackgroundOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const backgroundOptions = useMemo(
    () => backgrounds.length ? backgrounds : [{ id: "possum-night", label: "Possum Night" }],
    [backgrounds]
  );

  const textChannels = channels.filter((channel) => Number(channel.type) === 0 || Number(channel.type) === 5 || String(channel.type || "").toLowerCase().includes("text"));

  useEffect(() => setGuildId(getGuildId()), []);

  useEffect(() => {
    if (!guildId) {
      setLoading(false);
      return;
    }
    (async () => {
      try {
        setLoading(true);
        const [cfgRes, guildRes, profileRes] = await Promise.all([
          fetch(`/api/runtime/engine?guildId=${encodeURIComponent(guildId)}&engine=progression`, { cache: "no-store" }),
          fetch(`/api/bot/guild-data?guildId=${encodeURIComponent(guildId)}`),
          fetch(`/api/runtime/engine?guildId=${encodeURIComponent(guildId)}&engine=profile`, { cache: "no-store" })
        ]);
        const cfgJson = await cfgRes.json();
        const guildJson = await guildRes.json();
        const profileJson = await profileRes.json();
        const failedResponse = [cfgRes, guildRes, profileRes].find((response) => !response.ok);
        const failedPayload = [cfgJson, guildJson, profileJson].find((payload) => payload?.success === false);
        if (failedResponse || failedPayload) {
          throw new Error(failedPayload?.error || `Failed to load dashboard data (${failedResponse?.status || "API error"}).`);
        }

        setCfg(mergeCfg(cfgJson?.config));
        setRoles(Array.isArray(guildJson?.roles) ? guildJson.roles.map((r: any) => ({ id: String(r.id), name: String(r.name) })) : []);
        setChannels(Array.isArray(guildJson?.channels) ? guildJson.channels.map((c: any) => ({ id: String(c.id), name: String(c.name), type: c.type })) : []);
        setBackgrounds(parseBackgroundRows(profileJson?.details?.backgrounds));
      } catch (error: any) {
        setMsg(error?.message || "Failed to load live progression runtime.");
      } finally {
        setLoading(false);
      }
    })();
  }, [guildId]);

  function clampNumber(value: unknown, min: number, max: number, fallback = min, integer = true) {
    const parsed = Number(value);
    const safe = Number.isFinite(parsed) ? Math.min(max, Math.max(min, parsed)) : fallback;
    return integer ? Math.floor(safe) : safe;
  }

  async function save() {
    if (!guildId) return;
    const maxLevel = clampNumber(cfg.xp.maxLevel, 1, 10000, 200);
    const safeCfg = {
      ...cfg,
      xp: {
        ...cfg.xp,
        xpPerMessageMin: clampNumber(cfg.xp.xpPerMessageMin, 1, 10000, 3),
        xpPerMessageMax: Math.max(clampNumber(cfg.xp.xpPerMessageMin, 1, 10000, 3), clampNumber(cfg.xp.xpPerMessageMax, 1, 10000, 7)),
        cooldownSeconds: clampNumber(cfg.xp.cooldownSeconds, 1, 86400, 45),
        minMessageLength: clampNumber(cfg.xp.minMessageLength, 0, 2000, 6),
        maxLevel,
      },
      rewards: {
        ...cfg.rewards,
        levelRoleRewards: cfg.rewards.levelRoleRewards.slice(0, 100).map((reward) => ({
          ...reward,
          level: clampNumber(reward.level, 1, maxLevel, 1),
        })),
        levelCoinRewards: cfg.rewards.levelCoinRewards.slice(0, 100).map((reward) => ({
          ...reward,
          level: clampNumber(reward.level, 1, maxLevel, 1),
          coins: clampNumber(reward.coins, 0, 1_000_000_000, 0),
        })),
      },
      multipliers: {
        ...cfg.multipliers,
        weekendMultiplier: clampNumber(cfg.multipliers.weekendMultiplier, 1, 10, 1, false),
        vipMultiplier: clampNumber(cfg.multipliers.vipMultiplier, 1, 10, 1, false),
        boosterMultiplier: clampNumber(cfg.multipliers.boosterMultiplier, 1, 10, 1, false),
      },
      antiAbuse: {
        ...cfg.antiAbuse,
        antiSpamWindowSec: clampNumber(cfg.antiAbuse.antiSpamWindowSec, 1, 86400, 30),
        antiSpamMaxMessages: clampNumber(cfg.antiAbuse.antiSpamMaxMessages, 1, 10000, 6),
        maxXpPerMinute: clampNumber(cfg.antiAbuse.maxXpPerMinute, 0, 1_000_000, 120),
      },
    };
    try {
      setSaving(true);
      setMsg("");
      const res = await fetch("/api/runtime/engine", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ guildId, engine: "progression", patch: safeCfg })
      });
      const json = await res.json();
      if (!res.ok || json?.success === false) throw new Error(json?.error || "Save failed");
      setCfg(mergeCfg(json?.config || safeCfg));
      setMsg("Saved live progression runtime.");
    } catch (e: any) {
      setMsg(e?.message || "Save failed.");
    } finally {
      setSaving(false);
    }
  }

  function addRoleReward() {
    if (cfg.rewards.levelRoleRewards.length >= 100) return;
    setCfg((p) => ({
      ...p,
      rewards: {
        ...p.rewards,
        levelRoleRewards: [...p.rewards.levelRoleRewards, { level: 1, roleId: "", oneTime: false }]
      }
    }));
  }

  function addCoinReward() {
    if (cfg.rewards.levelCoinRewards.length >= 100) return;
    setCfg((p) => ({
      ...p,
      rewards: {
        ...p.rewards,
        levelCoinRewards: [...p.rewards.levelCoinRewards, { level: 1, coins: 100, oneTime: true }]
      }
    }));
  }

  if (!guildId) return <div style={{ color: "#ff7777", padding: 20 }}>Missing guildId.</div>;

  return (
    <div style={{ color: "#ff4d4d", padding: 20, maxWidth: 1220 }}>
      <ProgressionStackShell
        activeKey="progression"
        title="Progression Engine"
        subtitle="Core XP and event-ingest layer for the linked achievement stack. This page is where the bot decides what gets tracked, how fast members climb, and which reward hooks become eligible."
      />
      <EngineContractPanel
        engineKey="progression"
        intro="Progression is the intake layer for the entire achievement family. Every XP event, anti-abuse rule, role reward, and category gate here changes what the rest of the stack can see."
        related={[
          { label: "Achievements", route: "/dashboard/achievements", reason: "achievement unlocks are downstream of progression events" },
          { label: "Hall Of Fame", route: "/dashboard/halloffame", reason: "recognition only matters if progression intake is balanced correctly" },
          { label: "Prestige", route: "/dashboard/prestige", reason: "prestige gating starts with max-level pacing here" },
        ]}
      />
      <h1 style={{ marginTop: 0, letterSpacing: "0.12em", textTransform: "uppercase" }}>Progression Engine</h1>
      <p>Guild: {typeof window !== 'undefined' ? (localStorage.getItem('activeGuildName') || guildId) : guildId}</p>

      {loading ? <p>Loading...</p> : (
        <>
          <div style={box}>
            <label><input type="checkbox" checked={cfg.active} onChange={(e) => setCfg({ ...cfg, active: e.target.checked })} /> Progression active</label>
          </div>

          <div style={box}>
            <h3 style={{ marginTop: 0, color: "#ff4444" }}>XP Core</h3>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10 }}>
              <div><label>XP min</label><input style={input} type="number" value={cfg.xp.xpPerMessageMin} onChange={(e) => setCfg({ ...cfg, xp: { ...cfg.xp, xpPerMessageMin: Number(e.target.value || 0) } })} /></div>
              <div><label>XP max</label><input style={input} type="number" value={cfg.xp.xpPerMessageMax} onChange={(e) => setCfg({ ...cfg, xp: { ...cfg.xp, xpPerMessageMax: Number(e.target.value || 0) } })} /></div>
              <div><label>Cooldown sec</label><input style={input} type="number" value={cfg.xp.cooldownSeconds} onChange={(e) => setCfg({ ...cfg, xp: { ...cfg.xp, cooldownSeconds: Number(e.target.value || 0) } })} /></div>
              <div><label>Max level</label><input style={input} type="number" value={cfg.xp.maxLevel} onChange={(e) => setCfg({ ...cfg, xp: { ...cfg.xp, maxLevel: Number(e.target.value || 0) } })} /></div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 10 }}>
              <div><label>Min message length</label><input style={input} type="number" value={cfg.xp.minMessageLength} onChange={(e) => setCfg({ ...cfg, xp: { ...cfg.xp, minMessageLength: Number(e.target.value || 0) } })} /></div>
              <div>
                <label>Level formula</label>
                <select style={input} value={cfg.xp.levelFormula} onChange={(e) => setCfg({ ...cfg, xp: { ...cfg.xp, levelFormula: e.target.value } })}>
                  <option value="classic">classic</option>
                  <option value="linear">linear</option>
                  <option value="steep">steep</option>
                </select>
              </div>
            </div>

            <div style={{ marginTop: 10 }}>
              <label><input type="checkbox" checked={cfg.xp.enabled} onChange={(e) => setCfg({ ...cfg, xp: { ...cfg.xp, enabled: e.target.checked } })} /> XP enabled</label>
              <span style={{ marginLeft: 16 }}>Bots, webhooks, and direct messages are always excluded.</span>
            </div>

            <div style={{ marginTop: 10 }}>
              <label>Ignored channels (comma IDs)</label>
              <input style={input} value={toCsv(cfg.xp.ignoredChannelIds)} onChange={(e) => setCfg({ ...cfg, xp: { ...cfg.xp, ignoredChannelIds: fromCsv(e.target.value) } })} />
            </div>
            <div style={{ marginTop: 10 }}>
              <label>Ignored roles (comma IDs)</label>
              <input style={input} value={toCsv(cfg.xp.ignoredRoleIds)} onChange={(e) => setCfg({ ...cfg, xp: { ...cfg.xp, ignoredRoleIds: fromCsv(e.target.value) } })} />
            </div>
          </div>

          <div style={box}>
            <h3 style={{ marginTop: 0, color: "#ff4444" }}>Level-Up Announcements</h3>
            <label><input type="checkbox" checked={cfg.levelUp.enabled} onChange={(e) => setCfg({ ...cfg, levelUp: { ...cfg.levelUp, enabled: e.target.checked } })} /> Enabled</label>
            <label style={{ marginLeft: 16 }}><input type="checkbox" checked={cfg.levelUp.dmOnLevelUp} onChange={(e) => setCfg({ ...cfg, levelUp: { ...cfg.levelUp, dmOnLevelUp: e.target.checked } })} /> DM on level-up</label>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 10 }}>
              <div>
                <label>Announce channel</label>
                <select style={input} value={cfg.levelUp.announceChannelId} onChange={(e) => setCfg({ ...cfg, levelUp: { ...cfg.levelUp, announceChannelId: e.target.value } })}>
                  <option value="">Select channel</option>
                  {textChannels.map((c) => <option key={c.id} value={c.id}>#{c.name}</option>)}
                </select>
              </div>
              <div>
                <label>DM template</label>
                <input style={input} value={cfg.levelUp.dmTemplate} onChange={(e) => setCfg({ ...cfg, levelUp: { ...cfg.levelUp, dmTemplate: e.target.value } })} />
              </div>
            </div>

            <div style={{ marginTop: 10 }}>
              <label>Level-up card background</label>
              <select style={input} value={cfg.levelUp.cardBackgroundId} onChange={(e) => setCfg({ ...cfg, levelUp: { ...cfg.levelUp, cardBackgroundId: e.target.value } })}>
                {backgroundOptions.map((bg) => <option key={bg.id} value={bg.id}>{bg.label} ({bg.id})</option>)}
              </select>
            </div>

            <div style={{ marginTop: 10 }}>
              <label>Announce template</label>
              <textarea style={{ ...input, minHeight: 80 }} value={cfg.levelUp.announceTemplate} onChange={(e) => setCfg({ ...cfg, levelUp: { ...cfg.levelUp, announceTemplate: e.target.value } })} />
            </div>
          </div>

          <div style={box}>
            <h3 style={{ marginTop: 0, color: "#ff4444" }}>Achievements + Badge Panel</h3>
            <label><input type="checkbox" checked={cfg.achievements.enabled} onChange={(e) => setCfg({ ...cfg, achievements: { ...cfg.achievements, enabled: e.target.checked } })} /> Achievements enabled</label>
            <label style={{ marginLeft: 16 }}><input type="checkbox" checked={cfg.achievements.autoGrant} onChange={(e) => setCfg({ ...cfg, achievements: { ...cfg.achievements, autoGrant: e.target.checked } })} /> Auto grant</label>

            <div style={{ marginTop: 10 }}>
              <label>Achievement announce channel</label>
              <select style={input} value={cfg.achievements.announceChannelId} onChange={(e) => setCfg({ ...cfg, achievements: { ...cfg.achievements, announceChannelId: e.target.value } })}>
                <option value="">Select channel</option>
                {textChannels.map((c) => <option key={c.id} value={c.id}>#{c.name}</option>)}
              </select>
            </div>

            <div style={{ marginTop: 10 }}>
              <label>Achievement pop background</label>
              <select style={input} value={cfg.achievements.cardBackgroundId} onChange={(e) => setCfg({ ...cfg, achievements: { ...cfg.achievements, cardBackgroundId: e.target.value } })}>
                {backgroundOptions.map((bg) => <option key={bg.id} value={bg.id}>{bg.label} ({bg.id})</option>)}
              </select>
            </div>

            <div style={{ marginTop: 10 }}>
              <label><input type="checkbox" checked={cfg.achievements.categoriesEnabled.messages} onChange={(e) => setCfg({ ...cfg, achievements: { ...cfg.achievements, categoriesEnabled: { ...cfg.achievements.categoriesEnabled, messages: e.target.checked } } })} /> Messages</label>
              <label style={{ marginLeft: 14 }}><input type="checkbox" checked={cfg.achievements.categoriesEnabled.invites} onChange={(e) => setCfg({ ...cfg, achievements: { ...cfg.achievements, categoriesEnabled: { ...cfg.achievements.categoriesEnabled, invites: e.target.checked } } })} /> Invites</label>
              <label style={{ marginLeft: 14 }}><input type="checkbox" checked={cfg.achievements.categoriesEnabled.economy} onChange={(e) => setCfg({ ...cfg, achievements: { ...cfg.achievements, categoriesEnabled: { ...cfg.achievements.categoriesEnabled, economy: e.target.checked } } })} /> Economy</label>
              <label style={{ marginLeft: 14 }}><input type="checkbox" checked={cfg.achievements.categoriesEnabled.games} onChange={(e) => setCfg({ ...cfg, achievements: { ...cfg.achievements, categoriesEnabled: { ...cfg.achievements.categoriesEnabled, games: e.target.checked } } })} /> Games</label>
              <label style={{ marginLeft: 14 }}><input type="checkbox" checked={cfg.achievements.categoriesEnabled.governance} onChange={(e) => setCfg({ ...cfg, achievements: { ...cfg.achievements, categoriesEnabled: { ...cfg.achievements.categoriesEnabled, governance: e.target.checked } } })} /> Governance</label>
            </div>

            <hr style={{ borderColor: "#440000", margin: "12px 0" }} />

            <label><input type="checkbox" checked={cfg.badges.enabled} onChange={(e) => setCfg({ ...cfg, badges: { ...cfg.badges, enabled: e.target.checked } })} /> Badge system enabled</label>
            <label style={{ marginLeft: 16 }}><input type="checkbox" checked={cfg.badges.panelEnabled} onChange={(e) => setCfg({ ...cfg, badges: { ...cfg.badges, panelEnabled: e.target.checked } })} /> Badge panel enabled</label>
            <label style={{ marginLeft: 16 }}><input type="checkbox" checked={cfg.badges.roleSyncEnabled} onChange={(e) => setCfg({ ...cfg, badges: { ...cfg.badges, roleSyncEnabled: e.target.checked } })} /> Role sync enabled</label>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 10 }}>
              <div>
                <label>Badge panel channel</label>
                <select style={input} value={cfg.badges.panelChannelId} onChange={(e) => setCfg({ ...cfg, badges: { ...cfg.badges, panelChannelId: e.target.value } })}>
                  <option value="">Select channel</option>
                  {textChannels.map((c) => <option key={c.id} value={c.id}>#{c.name}</option>)}
                </select>
              </div>
              <div>
                <label>Badge panel title</label>
                <input style={input} value={cfg.badges.panelTitle} onChange={(e) => setCfg({ ...cfg, badges: { ...cfg.badges, panelTitle: e.target.value } })} />
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 10 }}>
              <div>
                <label>Badge panel thumbnail URL</label>
                <input style={input} value={cfg.badges.panelThumbnailUrl} onChange={(e) => setCfg({ ...cfg, badges: { ...cfg.badges, panelThumbnailUrl: e.target.value } })} placeholder="https://..." />
              </div>
              <div>
                <label>Badge panel background image URL</label>
                <input style={input} value={cfg.badges.panelImageUrl} onChange={(e) => setCfg({ ...cfg, badges: { ...cfg.badges, panelImageUrl: e.target.value } })} placeholder="https://..." />
              </div>
            </div>

            <div style={{ marginTop: 10 }}>
              <label>Badge card background</label>
              <select style={input} value={cfg.badges.cardBackgroundId} onChange={(e) => setCfg({ ...cfg, badges: { ...cfg.badges, cardBackgroundId: e.target.value } })}>
                {backgroundOptions.map((bg) => <option key={bg.id} value={bg.id}>{bg.label} ({bg.id})</option>)}
              </select>
            </div>
          </div>

          <div style={box}>
            <h3 style={{ marginTop: 0, color: "#ff4444" }}>Level Rewards</h3>

            <h4 style={{ marginBottom: 8 }}>Role rewards</h4>
            {cfg.rewards.levelRoleRewards.map((r, i) => (
              <div key={i} style={{ display: "grid", gridTemplateColumns: "90px 1fr auto auto auto", gap: 8, marginBottom: 8, alignItems: "center" }}>
                <input style={input} type="number" value={r.level} onChange={(e) => {
                  const next = [...cfg.rewards.levelRoleRewards];
                  next[i] = { ...next[i], level: Number(e.target.value || 0) };
                  setCfg({ ...cfg, rewards: { ...cfg.rewards, levelRoleRewards: next } });
                }} />
                <select style={input} value={r.roleId} onChange={(e) => {
                  const next = [...cfg.rewards.levelRoleRewards];
                  next[i] = { ...next[i], roleId: e.target.value };
                  setCfg({ ...cfg, rewards: { ...cfg.rewards, levelRoleRewards: next } });
                }}>
                  <option value="">Select role</option>
                  {roles.map((x) => <option key={x.id} value={x.id}>@{x.name}</option>)}
                </select>
                <label><input type="checkbox" checked={r.oneTime} onChange={(e) => {
                  const next = [...cfg.rewards.levelRoleRewards];
                  next[i] = { ...next[i], oneTime: e.target.checked };
                  setCfg({ ...cfg, rewards: { ...cfg.rewards, levelRoleRewards: next } });
                }} /> one-time</label>
                <button style={{ ...input, width: "auto" }} onClick={() => {
                  setCfg({ ...cfg, rewards: { ...cfg.rewards, levelRoleRewards: cfg.rewards.levelRoleRewards.filter((_, idx) => idx !== i) } });
                }}>X</button>
              </div>
            ))}
            <button style={{ ...input, width: "auto", marginBottom: 14 }} onClick={addRoleReward}>+ Add Role Reward</button>

            <h4 style={{ marginBottom: 8 }}>Coin rewards</h4>
            {cfg.rewards.levelCoinRewards.map((r, i) => (
              <div key={i} style={{ display: "grid", gridTemplateColumns: "90px 120px auto auto", gap: 8, marginBottom: 8, alignItems: "center" }}>
                <input style={input} type="number" value={r.level} onChange={(e) => {
                  const next = [...cfg.rewards.levelCoinRewards];
                  next[i] = { ...next[i], level: Number(e.target.value || 0) };
                  setCfg({ ...cfg, rewards: { ...cfg.rewards, levelCoinRewards: next } });
                }} />
                <input style={input} type="number" value={r.coins} onChange={(e) => {
                  const next = [...cfg.rewards.levelCoinRewards];
                  next[i] = { ...next[i], coins: Number(e.target.value || 0) };
                  setCfg({ ...cfg, rewards: { ...cfg.rewards, levelCoinRewards: next } });
                }} />
                <label><input type="checkbox" checked={r.oneTime} onChange={(e) => {
                  const next = [...cfg.rewards.levelCoinRewards];
                  next[i] = { ...next[i], oneTime: e.target.checked };
                  setCfg({ ...cfg, rewards: { ...cfg.rewards, levelCoinRewards: next } });
                }} /> one-time</label>
                <button style={{ ...input, width: "auto" }} onClick={() => {
                  setCfg({ ...cfg, rewards: { ...cfg.rewards, levelCoinRewards: cfg.rewards.levelCoinRewards.filter((_, idx) => idx !== i) } });
                }}>X</button>
              </div>
            ))}
            <button style={{ ...input, width: "auto" }} onClick={addCoinReward}>+ Add Coin Reward</button>
          </div>

          <div style={box}>
            <h3 style={{ marginTop: 0, color: "#ff4444" }}>Multipliers + Anti-abuse</h3>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10 }}>
              <div><label>Weekend multiplier</label><input style={input} type="number" step="0.05" value={cfg.multipliers.weekendMultiplier} onChange={(e) => setCfg({ ...cfg, multipliers: { ...cfg.multipliers, weekendMultiplier: Number(e.target.value || 1) } })} /></div>
              <div><label>VIP multiplier</label><input style={input} type="number" step="0.05" value={cfg.multipliers.vipMultiplier} onChange={(e) => setCfg({ ...cfg, multipliers: { ...cfg.multipliers, vipMultiplier: Number(e.target.value || 1) } })} /></div>
              <div><label>Booster multiplier</label><input style={input} type="number" step="0.05" value={cfg.multipliers.boosterMultiplier} onChange={(e) => setCfg({ ...cfg, multipliers: { ...cfg.multipliers, boosterMultiplier: Number(e.target.value || 1) } })} /></div>
            </div>

            <div style={{ marginTop: 10 }}>
              <label><input type="checkbox" checked={cfg.multipliers.weekendBoostEnabled} onChange={(e) => setCfg({ ...cfg, multipliers: { ...cfg.multipliers, weekendBoostEnabled: e.target.checked } })} /> Weekend boost enabled</label>
            </div>

            <div style={{ marginTop: 10 }}>
              <label>VIP role IDs (comma)</label>
              <input style={input} value={toCsv(cfg.multipliers.vipRoleIds)} onChange={(e) => setCfg({ ...cfg, multipliers: { ...cfg.multipliers, vipRoleIds: fromCsv(e.target.value) } })} />
            </div>
            <div style={{ marginTop: 10 }}>
              <label>Booster role IDs (comma)</label>
              <input style={input} value={toCsv(cfg.multipliers.boosterRoleIds)} onChange={(e) => setCfg({ ...cfg, multipliers: { ...cfg.multipliers, boosterRoleIds: fromCsv(e.target.value) } })} />
            </div>

            <hr style={{ borderColor: "#440000", margin: "12px 0" }} />

            <label><input type="checkbox" checked={cfg.antiAbuse.enabled} onChange={(e) => setCfg({ ...cfg, antiAbuse: { ...cfg.antiAbuse, enabled: e.target.checked } })} /> Anti-abuse enabled</label>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10, marginTop: 10 }}>
              <div><label>Spam window (sec)</label><input style={input} type="number" value={cfg.antiAbuse.antiSpamWindowSec} onChange={(e) => setCfg({ ...cfg, antiAbuse: { ...cfg.antiAbuse, antiSpamWindowSec: Number(e.target.value || 0) } })} /></div>
              <div><label>Max msgs in window</label><input style={input} type="number" value={cfg.antiAbuse.antiSpamMaxMessages} onChange={(e) => setCfg({ ...cfg, antiAbuse: { ...cfg.antiAbuse, antiSpamMaxMessages: Number(e.target.value || 0) } })} /></div>
              <div><label>Max XP per minute</label><input style={input} type="number" value={cfg.antiAbuse.maxXpPerMinute} onChange={(e) => setCfg({ ...cfg, antiAbuse: { ...cfg.antiAbuse, maxXpPerMinute: Number(e.target.value || 0) } })} /></div>
            </div>
          </div>

          <div style={box}>
            <h3 style={{ marginTop: 0, color: "#ff4444" }}>Notes</h3>
            <textarea style={{ ...input, minHeight: 90 }} value={cfg.notes} onChange={(e) => setCfg({ ...cfg, notes: e.target.value })} />
          </div>

          <button style={{ ...input, width: "auto", fontWeight: 700 }} onClick={save} disabled={saving}>
            {saving ? "Saving..." : "Save Progression"}
          </button>
          {msg ? <p style={{ marginTop: 10 }}>{msg}</p> : null}
        </>
      )}
    </div>
  );
}
