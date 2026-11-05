"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import EngineContractPanel from "@/components/possum/EngineContractPanel";
import ProgressionStackShell from "@/components/possum/ProgressionStackShell";
import { buildDashboardHref } from "@/lib/dashboardContext";

type Role = { id: string; name: string; position?: number };
type Channel = { id: string; name: string; type?: number | string };

type AchRewards = {
  giveRole: boolean;
  giveRoleId: string;
  removeRole: boolean;
  removeRoleId: string;
  giveXp: boolean;
  xpAmount: number;
  giveCoins: boolean;
  coinAmount: number;
};

type AchSettings = {
  dontTrackProgress: boolean;
  setColor: string;
  sendThread: boolean;
};

type AchievementRow = {
  id: string;
  name: string;
  description: string;
  source: string;
  tier: string;
  flavor: string;
  action: string;
  count: number;
  enabled: boolean;
  overrideAnnouncement: boolean;
  announcementMessage: string;
  rewards: AchRewards;
  settings: AchSettings;
};

type AchievementsConfig = {
  active: boolean;
  announceChannelId: string;
  noticeMode: string;
  announcementTemplate: string;
  dmTemplate: string;
  commands: {
    achievements: boolean;
    achievementsadmin: boolean;
    achpanel: boolean;
    badge: boolean;
  };
  catalog: AchievementRow[];
};

type AchievementProgress = {
  achievers: number;
  percent: number;
};

type TabKey = "achievements" | "configuration" | "commands";

const EMPTY_CFG: AchievementsConfig = {
  active: true,
  announceChannelId: "",
  noticeMode: "channel",
  announcementTemplate: "{{user}} unlocked {{achievement}}",
  dmTemplate: "You unlocked {{achievement}} in {{guildName}}.",
  commands: {
    achievements: true,
    achievementsadmin: true,
    achpanel: true,
    badge: true
  },
  catalog: []
};

const EMPTY_REWARDS: AchRewards = {
  giveRole: false,
  giveRoleId: "",
  removeRole: false,
  removeRoleId: "",
  giveXp: false,
  xpAmount: 0,
  giveCoins: false,
  coinAmount: 0,
};

const EMPTY_SETTINGS: AchSettings = {
  dontTrackProgress: false,
  setColor: "",
  sendThread: false,
};

const NOTICE_MODES = ["disabled", "channel", "dm", "both"];

function boundedInt(value: unknown, fallback: number, min: number, max: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(min, Math.min(max, Math.floor(parsed))) : fallback;
}

function normalizeAchievementRow(input?: Partial<AchievementRow> | null): AchievementRow {
  return {
    id: String(input?.id || "").trim(),
    name: String(input?.name || "").trim(),
    description: String(input?.description || "").trim(),
    source: String(input?.source || "").trim(),
    tier: String(input?.tier || "standard").trim() || "standard",
    flavor: String(input?.flavor || "").trim(),
    action: String(input?.action || "manual").trim() || "manual",
    count: boundedInt(input?.count, 1, 1, 1_000_000_000),
    enabled: input?.enabled !== false,
    overrideAnnouncement: input?.overrideAnnouncement === true,
    announcementMessage: String(input?.announcementMessage || "").trim(),
    rewards: {
      ...EMPTY_REWARDS,
      ...(input?.rewards || {}),
      xpAmount: boundedInt(input?.rewards?.xpAmount, 0, 0, 1_000_000_000),
      coinAmount: boundedInt(input?.rewards?.coinAmount, 0, 0, 1_000_000_000),
    },
    settings: {
      ...EMPTY_SETTINGS,
      ...(input?.settings || {}),
    },
  };
}

function makeCustomAchievement(seed = 1): AchievementRow {
  const stamp = Date.now();
  return normalizeAchievementRow({
    id: `custom_achievement_${stamp}_${seed}`,
    name: `Custom Achievement ${seed}`,
    description: "Describe what players need to do.",
    source: "dashboard",
    tier: "bronze",
    action: "manual",
    count: 1,
    enabled: true,
  });
}

function getGuildId() {
  if (typeof window === "undefined") return "";
  const sp = new URLSearchParams(window.location.search);
  const fromUrl = sp.get("guildId") || sp.get("guildid") || "";
  const fromStore = localStorage.getItem("activeGuildId") || localStorage.getItem("activeGuildid") || "";
  const gid = (fromUrl || fromStore).trim();
  if (gid) {
    localStorage.setItem("activeGuildId", gid);
    localStorage.setItem("activeGuildid", gid);
  }
  return gid;
}

const shell: CSSProperties = { maxWidth: 1320, color: "#ffcaca" };
const card: CSSProperties = {
  border: "1px solid rgba(255,0,0,.34)",
  borderRadius: 12,
  background: "rgba(72,0,0,.14)",
  padding: 14
};
const input: CSSProperties = {
  width: "100%",
  background: "#070707",
  border: "1px solid rgba(255,0,0,.45)",
  color: "#ffd3d3",
  borderRadius: 10,
  padding: "10px 12px"
};

function tierColor(tier: string) {
  const t = String(tier || "").toLowerCase();
  if (t.includes("mythic")) return "#f97316";
  if (t.includes("diamond")) return "#22d3ee";
  if (t.includes("gold")) return "#fbbf24";
  if (t.includes("silver")) return "#cbd5e1";
  if (t.includes("bronze")) return "#d97706";
  return "#a78bfa";
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      onClick={onClick}
      style={{
        border: active ? "1px solid rgba(255,0,0,.7)" : "1px solid rgba(255,0,0,.25)",
        borderRadius: 8,
        background: active ? "rgba(255,0,0,.18)" : "rgba(0,0,0,.35)",
        color: active ? "#fff" : "#fda4af",
        fontWeight: 800,
        letterSpacing: "0.06em",
        textTransform: "uppercase",
        fontSize: 11,
        padding: "8px 10px",
        cursor: "pointer"
      }}
    >
      {children}
    </button>
  );
}

export default function AchievementsClient() {
  const [guildId, setGuildId] = useState("");
  const [cfg, setCfg] = useState<AchievementsConfig>(EMPTY_CFG);
  const [base, setBase] = useState<AchievementsConfig>(EMPTY_CFG);
  const [baselineCatalog, setBaselineCatalog] = useState<AchievementRow[]>([]);
  const [progressById, setProgressById] = useState<Record<string, AchievementProgress>>({});
  const [progressMemberBase, setProgressMemberBase] = useState(0);
  const [roles, setRoles] = useState<Role[]>([]);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [tab, setTab] = useState<TabKey>("achievements");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => setGuildId(getGuildId()), []);

  function applyRuntimeSnapshot(snapshot: any) {
    const merged: AchievementsConfig = {
      ...EMPTY_CFG,
      ...(snapshot?.config || {}),
      commands: {
        ...EMPTY_CFG.commands,
        ...((snapshot?.config?.commands || {}) as AchievementsConfig["commands"])
      },
      catalog: Array.isArray(snapshot?.config?.catalog)
        ? snapshot.config.catalog.map((row: AchievementRow) => normalizeAchievementRow(row))
        : []
    };

    setCfg(merged);
    setBase(JSON.parse(JSON.stringify(merged)));
    setBaselineCatalog(
      Array.isArray(snapshot?.baselineCatalog)
        ? snapshot.baselineCatalog.map((row: AchievementRow) => normalizeAchievementRow(row))
        : []
    );
    setProgressById(
      snapshot?.progressById && typeof snapshot.progressById === "object"
        ? snapshot.progressById as Record<string, AchievementProgress>
        : {}
    );
    setProgressMemberBase(Math.max(0, Number(snapshot?.progressMemberBase || 0)));
    if (merged.catalog.length) {
      setSelectedId((current) => (current && merged.catalog.some((row) => row.id === current) ? current : merged.catalog[0].id));
    } else {
      setSelectedId("");
    }
    return merged;
  }

  useEffect(() => {
    if (!guildId) {
      setLoading(false);
      return;
    }
    (async () => {
      try {
        setLoading(true);
        setMsg("");
        const [cfgRes, gdRes] = await Promise.all([
          fetch(`/api/runtime/engine?guildId=${encodeURIComponent(guildId)}&engine=achievements`, { cache: "no-store" }),
          fetch(`/api/bot/guild-data?guildId=${encodeURIComponent(guildId)}`, { cache: "no-store" })
        ]);
        const cfgJson = await cfgRes.json().catch(() => ({}));
        const gdJson = await gdRes.json().catch(() => ({}));
        applyRuntimeSnapshot(cfgJson);
        setRoles((Array.isArray(gdJson?.roles) ? gdJson.roles : []).sort((a: Role, b: Role) => Number(b.position || 0) - Number(a.position || 0)));
        setChannels((Array.isArray(gdJson?.channels) ? gdJson.channels : []).filter((c: Channel) => Number(c.type) === 0 || Number(c.type) === 5));
      } catch (e: any) {
        setMsg(e?.message || "Failed loading achievements.");
      } finally {
        setLoading(false);
      }
    })();
  }, [guildId]);

  const dirty = useMemo(() => JSON.stringify(cfg) !== JSON.stringify(base), [cfg, base]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return cfg.catalog;
    return cfg.catalog.filter((a) =>
      String(a.name || "").toLowerCase().includes(q) ||
      String(a.description || "").toLowerCase().includes(q) ||
      String(a.action || "").toLowerCase().includes(q) ||
      String(a.id || "").toLowerCase().includes(q)
    );
  }, [search, cfg.catalog]);

  const selected = useMemo(() => cfg.catalog.find((x) => x.id === selectedId) || null, [cfg.catalog, selectedId]);
  const baselineMap = useMemo(() => new Map(baselineCatalog.map((row) => [row.id, row])), [baselineCatalog]);
  const actionOptions = useMemo(() => {
    const seed = [
      "manual",
      "messages",
      "messagecount",
      "reactions_added",
      "voice_minutes",
      "threads_created",
      "server_boosts",
      "birthdays_set",
      "giveaway_entries",
      "giveawaywins",
      "roles_received",
      "store_purchases",
      "coins_earned",
      "invites",
      "heistwins",
      "catwins",
      "pokemon_caught_total",
      "voice_session_180",
      "crew_raid_wins",
      "xp_level",
    ];
    const options = new Set(seed);
    for (const row of [...cfg.catalog, ...baselineCatalog]) {
      if (row?.action) options.add(String(row.action));
    }
    return [...options];
  }, [cfg.catalog, baselineCatalog]);

  function updateCatalogRow(id: string, patch: Partial<AchievementRow>) {
    setCfg((prev) => ({
      ...prev,
      catalog: prev.catalog.map((row) => (row.id === id ? { ...row, ...patch } : row))
    }));
  }

  function updateReward(id: string, patch: Partial<AchRewards>) {
    setCfg((prev) => ({
      ...prev,
      catalog: prev.catalog.map((row) => (row.id === id ? { ...row, rewards: { ...row.rewards, ...patch } } : row))
    }));
  }

  function updateSettings(id: string, patch: Partial<AchSettings>) {
    setCfg((prev) => ({
      ...prev,
      catalog: prev.catalog.map((row) => (row.id === id ? { ...row, settings: { ...row.settings, ...patch } } : row))
    }));
  }

  function addAchievement() {
    setCfg((prev) => {
      const next = makeCustomAchievement(prev.catalog.length + 1);
      setSelectedId(next.id);
      return { ...prev, catalog: [...prev.catalog, next] };
    });
    setMsg("Added a new custom achievement draft.");
  }

  function restoreOrDeleteSelected() {
    if (!selected) return;
    const baseline = baselineMap.get(selected.id);
    if (baseline) {
      updateCatalogRow(selected.id, baseline);
      setMsg("Restored this achievement back to the shared Saviors baseline.");
      return;
    }

    setCfg((prev) => {
      const nextCatalog = prev.catalog.filter((row) => row.id !== selected.id);
      const nextSelected = nextCatalog[0]?.id || "";
      setSelectedId(nextSelected);
      return { ...prev, catalog: nextCatalog };
    });
    setMsg("Deleted the custom achievement draft.");
  }

  function restoreStandardCatalog() {
    setCfg((prev) => ({
      ...prev,
      catalog: baselineCatalog.map((row) => normalizeAchievementRow(row)),
    }));
    if (baselineCatalog[0]?.id) setSelectedId(baselineCatalog[0].id);
    setMsg("Restored the local editor to the standard Saviors baseline catalog.");
  }

  function buildOverlayCatalogRows(rows: AchievementRow[]) {
    const overlays: AchievementRow[] = [];
    for (const row of rows.map((entry) => normalizeAchievementRow(entry))) {
      const baseline = baselineMap.get(row.id);
      if (!baseline) {
        overlays.push(row);
        continue;
      }
      if (JSON.stringify(row) !== JSON.stringify(normalizeAchievementRow(baseline))) {
        overlays.push(row);
      }
    }
    return overlays;
  }

  async function saveAll() {
    if (!guildId) return;
    setSaving(true);
    setMsg("");
    try {
      const patch = {
        ...cfg,
        catalog: buildOverlayCatalogRows(cfg.catalog),
      };
      const r = await fetch("/api/runtime/engine", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ guildId, engine: "achievements", patch })
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || j?.success === false) throw new Error(j?.error || "Save failed");
      const refreshed = await fetch(`/api/runtime/engine?guildId=${encodeURIComponent(guildId)}&engine=achievements`, { cache: "no-store" });
      const refreshedJson = await refreshed.json().catch(() => ({}));
      if (!refreshed.ok || refreshedJson?.success === false) throw new Error(refreshedJson?.error || "Saved but failed to refresh achievements runtime.");
      applyRuntimeSnapshot(refreshedJson);
      setMsg("Saved live achievements runtime.");
    } catch (e: any) {
      setMsg(e?.message || "Save failed.");
    } finally {
      setSaving(false);
    }
  }

  if (!guildId && !loading) return <div style={{ color: "#ff6b6b", padding: 24 }}>Missing guildId. Open from /guilds first.</div>;

  return (
    <div style={shell}>
      <ProgressionStackShell
        activeKey="achievements"
        title="Achievements Engine"
        subtitle="Milestone grant layer on top of progression. This page controls what unlocks, how rewards are granted, and how your badge/achievement surfaces are announced."
      />
      <EngineContractPanel
        engineKey="achievements"
        intro="Achievements are the milestone grant layer above progression. This surface should decide which actions unlock, what each unlock grants, and how the catalog is presented without collapsing into a flat badge list."
        related={[
          { label: "Progression", route: "/dashboard/economy/progression", reason: "progression events are the intake feed for achievement logic" },
          { label: "Hall Of Fame", route: "/dashboard/halloffame", reason: "Hall Of Fame is the public recognition layer for achievement output" },
          { label: "Prestige", route: "/dashboard/prestige", reason: "late-loop prestige should stay aligned with how hard achievements are to earn" },
        ]}
      />
      <div style={{ ...card, marginBottom: 12, position: "sticky", top: 8, zIndex: 20, backdropFilter: "blur(4px)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontSize: 24, letterSpacing: "0.16em", textTransform: "uppercase", fontWeight: 900, color: "#ff2f2f" }}>Achievements</div>
            <div style={{ color: "#ff9e9e", marginTop: 4 }}>Guild: {typeof window !== 'undefined' ? (localStorage.getItem('activeGuildName') || guildId) : guildId}</div>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <label style={{ color: "#fff", fontSize: 12, fontWeight: 800 }}>
              <input type="checkbox" checked={cfg.active} onChange={(e) => setCfg((p) => ({ ...p, active: e.target.checked }))} /> Active
            </label>
            <span style={{ padding: "2px 8px", borderRadius: 999, fontSize: 11, fontWeight: 900, border: dirty ? "1px solid #f59e0b" : "1px solid #64748b", color: dirty ? "#fcd34d" : "#cbd5e1" }}>
              {dirty ? "UNSAVED" : "SAVED"}
            </span>
            <button onClick={saveAll} disabled={saving || !dirty} style={{ ...input, width: "auto", cursor: "pointer", fontWeight: 900, padding: "8px 12px" }}>
              {saving ? "Saving..." : "Save"}
            </button>
          </div>
        </div>
        {msg ? <div style={{ marginTop: 8, color: "#fcd34d", fontSize: 12 }}>{msg}</div> : null}
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <TabButton active={tab === "achievements"} onClick={() => setTab("achievements")}>Achievements</TabButton>
        <TabButton active={tab === "configuration"} onClick={() => setTab("configuration")}>Configuration</TabButton>
        <TabButton active={tab === "commands"} onClick={() => setTab("commands")}>Commands</TabButton>
      </div>

      {loading ? <div style={{ color: "#ffd1d1", padding: 14 }}>Loading...</div> : null}

      {!loading && tab === "achievements" ? (
        <div style={{ display: "grid", gridTemplateColumns: "1.6fr 1fr", gap: 12 }}>
          <section style={card}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2,minmax(240px,1fr))", gap: 10, marginBottom: 12 }}>
              <div style={{ border: "1px dashed rgba(255,0,0,.4)", borderRadius: 10, padding: 12 }}>
                <div style={{ color: "#fff", fontWeight: 800 }}>Standard Saviors Baseline</div>
                <div style={{ color: "#fca5a5", fontSize: 12 }}>Every guild starts from the same tiered baseline, then you can override rows or add custom ones.</div>
              </div>
              <div style={{ border: "1px dashed rgba(255,0,0,.4)", borderRadius: 10, padding: 12 }}>
                <div style={{ color: "#fff", fontWeight: 800 }}>Custom Add-Ons</div>
                <div style={{ color: "#fca5a5", fontSize: 12 }}>New custom achievements stay editable without replacing the shared baseline for every guild.</div>
              </div>
            </div>

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
              <button onClick={addAchievement} style={{ ...input, width: "auto", cursor: "pointer", fontWeight: 900 }}>Add Achievement</button>
              <button onClick={restoreStandardCatalog} style={{ ...input, width: "auto", cursor: "pointer", fontWeight: 900 }}>Restore Standard Catalog</button>
              <div style={{ color: "#ffb3b3", fontSize: 12, alignSelf: "center" }}>
                Baseline rows: {baselineCatalog.length} | Guild member base: {progressMemberBase || "live"}
              </div>
            </div>

            <div style={{ marginBottom: 10 }}>
              <input style={input} placeholder="Search for an achievement" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(4,minmax(180px,1fr))", gap: 10 }}>
              {filtered.map((a) => {
                const active = selectedId === a.id;
                const color = tierColor(a.tier);
                const progress = progressById[a.id] || { achievers: 0, percent: 0 };
                return (
                  <button
                    key={a.id}
                    onClick={() => setSelectedId(a.id)}
                    style={{
                      textAlign: "left",
                      border: active ? "1px solid rgba(255,0,0,.75)" : "1px solid rgba(255,0,0,.24)",
                      borderRadius: 10,
                      background: "rgba(0,0,0,.28)",
                      color: "#ffdada",
                      padding: 10,
                      cursor: "pointer"
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                      <span style={{ width: 22, height: 22, borderRadius: 999, background: color, display: "inline-block" }} />
                      <input
                        type="checkbox"
                        checked={a.enabled}
                        onChange={(e) => {
                          e.stopPropagation();
                          updateCatalogRow(a.id, { enabled: e.target.checked });
                        }}
                      />
                    </div>
                    <div style={{ marginTop: 8, color: "#fff", fontWeight: 800, fontSize: 13, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{a.name}</div>
                    <div style={{ color: "#fca5a5", fontSize: 11, marginTop: 4, minHeight: 28 }}>{a.description || "No description"}</div>
                    <div style={{ marginTop: 8, fontSize: 11, color: "#fde68a" }}>{a.action} · {a.count} · {a.tier}</div>
                    <div style={{ marginTop: 8, height: 4, borderRadius: 999, background: "rgba(255,255,255,.15)" }}>
                      <div style={{ width: `${progress.percent}%`, height: "100%", borderRadius: 999, background: color }} />
                    </div>
                    <div style={{ marginTop: 6, fontSize: 10, color: "#cbd5e1" }}>Server progress · {progress.percent}% · {progress.achievers} unlocked</div>
                  </button>
                );
              })}
            </div>
          </section>

          <section style={card}>
            {!selected ? <div style={{ color: "#ffb4b4" }}>Select an achievement.</div> : (
              <div style={{ display: "grid", gap: 10 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <div style={{ color: "#fff", fontWeight: 900, fontSize: 18 }}>{selected.name}</div>
                    <div style={{ color: "#fca5a5", fontSize: 12, marginTop: 4 }}>
                      {baselineMap.has(selected.id) ? "Shared baseline row" : "Custom guild row"} · ID: {selected.id}
                    </div>
                  </div>
                  <button
                    onClick={restoreOrDeleteSelected}
                    style={{ ...input, width: "auto", cursor: "pointer", fontWeight: 900, background: "rgba(127,29,29,.35)" }}
                  >
                    {baselineMap.has(selected.id) ? "Restore Baseline" : "Delete"}
                  </button>
                </div>

                <div style={{ border: "1px solid rgba(255,0,0,.22)", borderRadius: 10, padding: 12, background: "rgba(0,0,0,.2)" }}>
                  <div style={{ color: "#fff", fontWeight: 800 }}>Achievement progress</div>
                  <div style={{ color: "#fca5a5", fontSize: 12, marginTop: 4 }}>Check how many members in this guild have unlocked this achievement.</div>
                  <div style={{ marginTop: 12, height: 6, borderRadius: 999, background: "rgba(255,255,255,.15)" }}>
                    <div style={{ width: `${(progressById[selected.id]?.percent || 0)}%`, height: "100%", borderRadius: 999, background: tierColor(selected.tier) }} />
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6, fontSize: 11, color: "#cbd5e1" }}>
                    <span>Server progress</span>
                    <span>{progressById[selected.id]?.percent || 0}%</span>
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <div>
                    <div style={{ color: "#ffb0b0", fontSize: 12, marginBottom: 6 }}>Achievement Name</div>
                    <input style={input} value={selected.name} onChange={(e) => updateCatalogRow(selected.id, { name: e.target.value })} />
                  </div>
                  <div>
                    <div style={{ color: "#ffb0b0", fontSize: 12, marginBottom: 6 }}>Tier</div>
                    <select style={input} value={selected.tier} onChange={(e) => updateCatalogRow(selected.id, { tier: e.target.value })}>
                      {["bronze", "silver", "gold", "diamond", "mythic", "standard"].map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                    </select>
                  </div>
                </div>

                <div>
                  <div style={{ color: "#ffb0b0", fontSize: 12, marginBottom: 6 }}>Description</div>
                  <textarea style={{ ...input, minHeight: 70 }} value={selected.description} onChange={(e) => updateCatalogRow(selected.id, { description: e.target.value })} />
                </div>

                <div>
                  <div style={{ color: "#ffb0b0", fontSize: 12, marginBottom: 6 }}>Flavor / Badge subtitle</div>
                  <input style={input} value={selected.flavor || ""} onChange={(e) => updateCatalogRow(selected.id, { flavor: e.target.value })} placeholder="Optional flavor line for the unlock embed" />
                </div>

                <div>
                  <div style={{ color: "#ffb0b0", fontSize: 12, marginBottom: 6 }}>Action</div>
                  <select style={input} value={selected.action} onChange={(e) => updateCatalogRow(selected.id, { action: e.target.value })}>
                    {actionOptions.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                  </select>
                </div>

                <div>
                  <div style={{ color: "#ffb0b0", fontSize: 12, marginBottom: 6 }}>Count</div>
                  <input type="number" style={input} min={1} max={1_000_000_000} step={1} value={selected.count} onChange={(e) => updateCatalogRow(selected.id, { count: boundedInt(e.target.value, 1, 1, 1_000_000_000) })} />
                </div>

                <label style={{ fontSize: 12, color: "#ffd1d1" }}>
                  <input type="checkbox" checked={selected.overrideAnnouncement} onChange={(e) => updateCatalogRow(selected.id, { overrideAnnouncement: e.target.checked })} /> Override announcement message
                </label>

                <textarea
                  style={{ ...input, minHeight: 70 }}
                  value={selected.announcementMessage || ""}
                  onChange={(e) => updateCatalogRow(selected.id, { announcementMessage: e.target.value })}
                  placeholder="Custom achievement announcement message"
                />

                <div style={{ borderTop: "1px solid rgba(255,0,0,.22)", paddingTop: 10 }}>
                  <div style={{ color: "#fff", fontWeight: 800, marginBottom: 8 }}>Rewards</div>
                  <label style={{ display: "block", marginBottom: 6 }}><input type="checkbox" checked={selected.rewards.giveRole} onChange={(e) => updateReward(selected.id, { giveRole: e.target.checked })} /> Give a role for achieving</label>
                  {selected.rewards.giveRole ? (
                    <select style={input} value={selected.rewards.giveRoleId || ""} onChange={(e) => updateReward(selected.id, { giveRoleId: e.target.value })}>
                      <option value="">Select role</option>
                      {roles.map((r) => <option key={r.id} value={r.id}>@{r.name}</option>)}
                    </select>
                  ) : null}

                  <label style={{ display: "block", marginTop: 8, marginBottom: 6 }}><input type="checkbox" checked={selected.rewards.removeRole} onChange={(e) => updateReward(selected.id, { removeRole: e.target.checked })} /> Remove a role for achieving</label>
                  {selected.rewards.removeRole ? (
                    <select style={input} value={selected.rewards.removeRoleId || ""} onChange={(e) => updateReward(selected.id, { removeRoleId: e.target.value })}>
                      <option value="">Select role</option>
                      {roles.map((r) => <option key={r.id} value={r.id}>@{r.name}</option>)}
                    </select>
                  ) : null}

                  <label style={{ display: "block", marginTop: 8 }}><input type="checkbox" checked={selected.rewards.giveXp} onChange={(e) => updateReward(selected.id, { giveXp: e.target.checked })} /> Give XP for achieving</label>
                  {selected.rewards.giveXp ? (
                    <input type="number" style={{ ...input, marginTop: 6 }} min={0} max={1_000_000_000} step={1} value={selected.rewards.xpAmount || 0} onChange={(e) => updateReward(selected.id, { xpAmount: boundedInt(e.target.value, 0, 0, 1_000_000_000) })} />
                  ) : null}

                  <label style={{ display: "block", marginTop: 8 }}><input type="checkbox" checked={selected.rewards.giveCoins} onChange={(e) => updateReward(selected.id, { giveCoins: e.target.checked })} /> Give coins for achieving</label>
                  {selected.rewards.giveCoins ? (
                    <input type="number" style={{ ...input, marginTop: 6 }} min={0} max={1_000_000_000} step={1} value={selected.rewards.coinAmount || 0} onChange={(e) => updateReward(selected.id, { coinAmount: boundedInt(e.target.value, 0, 0, 1_000_000_000) })} />
                  ) : null}
                </div>

                <div style={{ borderTop: "1px solid rgba(255,0,0,.22)", paddingTop: 10 }}>
                  <div style={{ color: "#fff", fontWeight: 800, marginBottom: 8 }}>Settings</div>
                  <label style={{ display: "block", marginBottom: 6 }}><input type="checkbox" checked={selected.settings.dontTrackProgress} onChange={(e) => updateSettings(selected.id, { dontTrackProgress: e.target.checked })} /> Don&apos;t track progress</label>
                  <label style={{ display: "block", marginBottom: 6 }}><input type="checkbox" checked={selected.settings.sendThread} onChange={(e) => updateSettings(selected.id, { sendThread: e.target.checked })} /> Send thread</label>
                  <input style={input} value={selected.settings.setColor || ""} onChange={(e) => updateSettings(selected.id, { setColor: e.target.value })} placeholder="Badge / embed accent color override (optional)" />
                </div>
              </div>
            )}
          </section>
        </div>
      ) : null}

      {!loading && tab === "configuration" ? (
        <section style={card}>
          <h3 style={{ margin: "0 0 10px", color: "#fff", letterSpacing: "0.08em", textTransform: "uppercase", fontSize: 13 }}>General</h3>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div>
              <div style={{ marginBottom: 6, color: "#ffb0b0", fontSize: 12 }}>Announcement Channel</div>
              <select style={input} value={cfg.announceChannelId || ""} onChange={(e) => setCfg((p) => ({ ...p, announceChannelId: e.target.value }))}>
                <option value="">Select channel</option>
                {channels.map((c) => <option key={c.id} value={c.id}>#{c.name}</option>)}
              </select>
            </div>
            <div>
              <div style={{ marginBottom: 6, color: "#ffb0b0", fontSize: 12 }}>Notice Mode</div>
              <select style={input} value={cfg.noticeMode || "channel"} onChange={(e) => setCfg((p) => ({ ...p, noticeMode: e.target.value }))}>
                {NOTICE_MODES.map((mode) => <option key={mode} value={mode}>{mode}</option>)}
              </select>
            </div>
            <div>
              <div style={{ marginBottom: 6, color: "#ffb0b0", fontSize: 12 }}>Default Unlock Message</div>
              <textarea style={{ ...input, minHeight: 80 }} value={cfg.announcementTemplate || ""} onChange={(e) => setCfg((p) => ({ ...p, announcementTemplate: e.target.value }))} />
            </div>
            <div>
              <div style={{ marginBottom: 6, color: "#ffb0b0", fontSize: 12 }}>DM Unlock Message</div>
              <textarea style={{ ...input, minHeight: 80 }} value={cfg.dmTemplate || ""} onChange={(e) => setCfg((p) => ({ ...p, dmTemplate: e.target.value }))} />
            </div>
          </div>

          <div style={{ marginTop: 10, color: "#fca5a5", fontSize: 12 }}>
            Tokens: <code>{'{{user}}'}</code>, <code>{'{{userId}}'}</code>, <code>{'{{achievement}}'}</code>, <code>{'{{achievementId}}'}</code>, <code>{'{{achievementCount}}'}</code>, <code>{'{{guildName}}'}</code>, <code>{'{{source}}'}</code>, <code>{'{{description}}'}</code>, <code>{'{{rewardSummary}}'}</code>, <code>{'{{season}}'}</code>
          </div>

          <div style={{ marginTop: 16, border: "1px solid rgba(255,0,0,.5)", borderRadius: 10, padding: 12 }}>
            <div style={{ color: "#fff", fontWeight: 800 }}>Reset Progress</div>
            <div style={{ color: "#fca5a5", fontSize: 12, marginTop: 6 }}>
              Use `/achievementsadmin reset` to reset live Carol progress. This button only resets local dashboard filters.
            </div>
            <button onClick={() => { setSearch(""); setMsg("Local filters reset. Use /achievementsadmin reset for runtime progress reset."); }} style={{ ...input, width: "auto", marginTop: 8, cursor: "pointer", fontWeight: 800 }}>
              Reset Progress
            </button>
          </div>
        </section>
      ) : null}

      {!loading && tab === "commands" ? (
        <section style={card}>
          <h3 style={{ margin: "0 0 10px", color: "#fff", letterSpacing: "0.08em", textTransform: "uppercase", fontSize: 13 }}>Native Slash Routing</h3>
          <div style={{ color: "#fca5a5", fontSize: 13, lineHeight: 1.7, maxWidth: 860 }}>
            Achievement slash-command availability now lives in the separate native Slash Command Master. This keeps
            command policy in one place and avoids overlap with the achievement catalog editor.
          </div>
          <div style={{ display: "grid", gap: 8, marginTop: 12 }}>
            {([
              ["achievements", "Display all achievement progress"],
              ["achievementsadmin", "Staff achievement management"],
              ["achpanel", "Achievement panel command"],
              ["badge", "Member badge card display"]
            ] as Array<[keyof AchievementsConfig["commands"], string]>).map(([key, desc]) => (
              <div key={key} style={{ border: "1px solid rgba(255,0,0,.22)", borderRadius: 8, padding: "10px 12px", background: "rgba(0,0,0,.28)" }}>
                <div style={{ color: "#fff", fontWeight: 800, fontSize: 13 }}>/ {key}</div>
                <div style={{ color: "#fca5a5", fontSize: 12, marginTop: 4 }}>{desc}</div>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 14 }}>
            <Link
              href={buildDashboardHref("/dashboard/slash-commands")}
              style={{ ...input, display: "inline-block", width: "auto", textDecoration: "none", fontWeight: 900, cursor: "pointer" }}
            >
              Open Slash Command Master
            </Link>
          </div>
        </section>
      ) : null}
    </div>
  );
}
