"use client";

import EngineInsights from "@/components/possum/EngineInsights";
import ProgressionStackShell from "@/components/possum/ProgressionStackShell";
import { useGuildEngineEditor } from "@/components/possum/useGuildEngineEditor";

type PrestigeCfg = {
  enabled: boolean;
  maxLevel: number;
  xpMultiplierPerPrestige: number;
  announceChannelId: string;
  roleRewards: Record<string, string>;
};

const DEFAULT_PRESTIGE: PrestigeCfg = {
  enabled: true,
  maxLevel: 50,
  xpMultiplierPerPrestige: 0.1,
  announceChannelId: "",
  roleRewards: {},
};

const shell: React.CSSProperties = { color: "#ffd0d0", padding: 18, maxWidth: 1200 };
const card: React.CSSProperties = { border: "1px solid #5f0000", borderRadius: 12, padding: 14, background: "rgba(120,0,0,0.10)", marginBottom: 12 };
const input: React.CSSProperties = { width: "100%", background: "#0a0a0a", color: "#ffd0d0", border: "1px solid #7f0000", borderRadius: 8, padding: "10px 12px" };

function toRows(value: Record<string, string>) {
  const rows = Object.entries(value || {})
    .slice(0, 100)
    .map(([prestige, roleId]) => ({ prestige: Number(prestige || 0), roleId: String(roleId || "") }))
    .filter((row) => Number.isFinite(row.prestige) && row.prestige > 0)
    .map((row) => ({ ...row, prestige: Math.min(10000, Math.max(1, Math.floor(row.prestige))) }));
  return rows.length ? rows.sort((a, b) => a.prestige - b.prestige) : [{ prestige: 1, roleId: "" }];
}

function rowsToRewards(rows: Array<{ prestige: number; roleId: string }>) {
  return rows.reduce<Record<string, string>>((out, row) => {
    const parsed = Number(row.prestige);
    const prestige = Number.isFinite(parsed) ? Math.min(10000, Math.max(1, Math.floor(parsed))) : 1;
    const roleId = String(row.roleId || "").trim();
    if (roleId) out[String(prestige)] = roleId;
    return out;
  }, {});
}

export default function PrestigePage() {
  const {
    guildId,
    guildName,
    config: cfg,
    setConfig: setCfg,
    channels,
    roles,
    summary,
    details,
    loading,
    saving,
    message,
    save,
  } = useGuildEngineEditor<PrestigeCfg>("prestige", DEFAULT_PRESTIGE);

  const textChannels = channels.filter((c) => Number(c?.type) === 0 || Number(c?.type) === 5 || String(c?.type || "").toLowerCase().includes("text"));
  const roleRows = toRows(cfg.roleRewards);

  function clampNumber(value: unknown, min: number, max: number, fallback: number) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? Math.min(max, Math.max(min, parsed)) : fallback;
  }

  function savePrestige() {
    const safeMaxLevel = Math.floor(clampNumber(cfg.maxLevel, 1, 10000, 50));
    const safeCfg = {
      ...cfg,
      maxLevel: safeMaxLevel,
      xpMultiplierPerPrestige: clampNumber(cfg.xpMultiplierPerPrestige, 0, 1, 0.1),
      roleRewards: Object.entries(cfg.roleRewards || {}).reduce<Record<string, string>>((out, [count, roleId]) => {
        const normalizedRoleId = String(roleId || "").trim();
        if (normalizedRoleId) out[String(Math.floor(clampNumber(count, 1, 10000, 1)))] = normalizedRoleId;
        return out;
      }, {}),
    };
    void save(safeCfg);
  }

  function updateRoleReward(index: number, patch: Partial<{ prestige: number; roleId: string }>) {
    const next = [...roleRows];
    next[index] = { ...next[index], ...patch };
    setCfg((p) => ({ ...p, roleRewards: rowsToRewards(next) }));
  }

  function addRoleReward() {
    if (roleRows.length >= 100) return;
    const next = [...roleRows, { prestige: roleRows.length + 1, roleId: "" }];
    setCfg((p) => ({ ...p, roleRewards: rowsToRewards(next) }));
  }

  function removeRoleReward(index: number) {
    const next = roleRows.filter((_, i) => i !== index);
    setCfg((p) => ({ ...p, roleRewards: rowsToRewards(next) }));
  }

  if (!guildId) return <div style={{ color: "#ff8080", padding: 24 }}>Missing guildId. Open from /guilds first.</div>;

  return (
    <div style={shell}>
      <ProgressionStackShell
        activeKey="prestige"
        title="Prestige Engine"
        subtitle="Late-loop reset and elevation layer. Progression and achievements fill the runway, Hall Of Fame shows recognition, Loyalty keeps tenure value, and Prestige is the capstone loop when members have truly cleared the stack."
      />
      <div style={{ color: "#ff9999", marginTop: -2, marginBottom: 12 }}>Guild: {guildName || guildId}</div>
      {message ? <div style={{ marginBottom: 10, color: "#ffd27a" }}>{message}</div> : null}

      {loading ? <div style={card}>Loading...</div> : (
        <>
          <EngineInsights summary={summary} details={details} />

          <section style={{ ...card, marginTop: 12 }}>
            <label><input type="checkbox" checked={cfg.enabled} onChange={(e) => setCfg((p) => ({ ...p, enabled: e.target.checked }))} /> Prestige Enabled</label>
          </section>

          <section style={card}>
            <div style={{ color: "#ffb0b0", lineHeight: 1.6, marginBottom: 12 }}>
              Achievement prestige in the live bot is a separate archival milestone once a member clears the achievement threshold. This page controls the main prestige loop itself: level requirement, announce routing, and prestige reward roles.
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))", gap: 12 }}>
              <div>
                <div style={{ marginBottom: 6 }}>Required Max Level</div>
                <input style={input} type="number" min={1} max={10000} value={cfg.maxLevel} onChange={(e) => setCfg((p) => ({ ...p, maxLevel: Number(e.target.value || 0) }))} />
              </div>
              <div>
                <div style={{ marginBottom: 6 }}>XP Multiplier Per Prestige</div>
                <input style={input} type="number" min={0} max={1} step="0.01" value={cfg.xpMultiplierPerPrestige} onChange={(e) => setCfg((p) => ({ ...p, xpMultiplierPerPrestige: Number(e.target.value || 0) }))} />
              </div>
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
            <div style={{ color: "#ffb0b0", lineHeight: 1.7, marginBottom: 12 }}>
              XP multiplier per prestige controls the carry-forward value members get after they reset. Keep it aligned with loyalty reward pacing and achievement prestige so one loop does not dwarf the others.
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 10 }}>
              <div>
                <div style={{ color: "#ffb0b0", fontSize: 12, letterSpacing: "0.08em", textTransform: "uppercase" }}>Prestige Role Rewards</div>
                <div style={{ color: "#ff9898", fontSize: 12 }}>Assign milestone roles by prestige count instead of editing raw `prestige:roleId` text.</div>
              </div>
              <button onClick={addRoleReward} disabled={roleRows.length >= 100} style={{ ...input, width: "auto", cursor: "pointer", fontWeight: 900 }}>+ Add Reward</button>
            </div>
            <div style={{ display: "grid", gap: 10 }}>
              {roleRows.map((row, index) => (
                <div key={`${row.prestige}_${index}`} style={{ display: "grid", gridTemplateColumns: "160px minmax(240px,1fr) 120px", gap: 10, alignItems: "end" }}>
                  <div>
                    <div style={{ marginBottom: 6 }}>Prestige Count</div>
                    <input
                      style={input}
                      type="number"
                      min={1}
                      max={10000}
                      value={row.prestige}
                      onChange={(e) => updateRoleReward(index, { prestige: Number(e.target.value || 0) })}
                    />
                  </div>
                  <div>
                    <div style={{ marginBottom: 6 }}>Reward Role</div>
                    <select
                      style={input}
                      value={row.roleId}
                      onChange={(e) => updateRoleReward(index, { roleId: e.target.value })}
                    >
                      <option value="">Select role</option>
                      {roles.map((role) => (
                        <option key={role.id} value={role.id}>
                          @{role.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <button onClick={() => removeRoleReward(index)} style={{ ...input, cursor: "pointer", borderColor: "#a00000", color: "#ffb6b6" }}>
                    Remove
                  </button>
                </div>
              ))}
            </div>
          </section>

          <button onClick={savePrestige} disabled={saving} style={{ ...input, width: "auto", cursor: "pointer", fontWeight: 900 }}>
            {saving ? "Saving..." : "Save Prestige"}
          </button>
        </>
      )}
    </div>
  );
}
