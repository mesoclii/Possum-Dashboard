"use client";



import { useMemo } from "react";
import EngineInsights from "@/components/possum/EngineInsights";
import { useGuildEngineEditor } from "@/components/possum/useGuildEngineEditor";

type Config = {
  active: boolean;
  signupEnabled: boolean;
  signupChannelId: string;
  announceChannelId: string;
  transcriptChannelId: string;
  hostRoleIds: string[];
  exemptRoleIds: string[];
  pingRoleIds?: {
    EE: string[];
    LE: string[];
  };
  maxPlayers: number;
  reserveSlots: number;
  weeklyLimit: number;
  autoBumpMinutes: number;
  joinWindowMinutes: number;
  sessionDurationMinutes: number;
  cooldownMinutes: number;
  autoLockOnStart: boolean;
  requireVoiceChannel: boolean;
  voiceChannelId: string;
  payoutEnabled: boolean;
  payoutCoinsWin: number;
  payoutCoinsLose: number;
  streakBonusEnabled: boolean;
  minAccountAgeDays: number;
  mustBeVerified: boolean;
  verifiedRoleId: string;
  blockedRoleIds: string[];
  panelTitleTemplate: string;
  panelDescriptionTemplate: string;
  signupAnnouncementTemplate: string;
  bumpAnnouncementTemplate: string;
  nextGroupAnnouncementTemplate: string;
  nextUpTemplate: string;
  notes: string;
  updatedAt: string;
};

const DEFAULTS: Config = {
  active: true,
  signupEnabled: true,
  signupChannelId: "",
  announceChannelId: "",
  transcriptChannelId: "",
  hostRoleIds: [],
  exemptRoleIds: [],
  pingRoleIds: {
    EE: [],
    LE: [],
  },
  maxPlayers: 3,
  reserveSlots: 0,
  weeklyLimit: 3,
  autoBumpMinutes: 10,
  joinWindowMinutes: 0,
  sessionDurationMinutes: 0,
  cooldownMinutes: 15,
  autoLockOnStart: false,
  requireVoiceChannel: false,
  voiceChannelId: "",
  payoutEnabled: true,
  payoutCoinsWin: 1000,
  payoutCoinsLose: 250,
  streakBonusEnabled: true,
  minAccountAgeDays: 0,
  mustBeVerified: false,
  verifiedRoleId: "",
  blockedRoleIds: [],
  panelTitleTemplate: "Supply Heist Signup ({edition})",
  panelDescriptionTemplate: "💰 3mil instant finish\n\n👑 Host: {host}\n{slots}\n\n🕓 Pending Queue: {pending}\n\nStatus: **{status}**",
  signupAnnouncementTemplate: "{roleMentions} {edition} heist signup is live.",
  bumpAnnouncementTemplate: "{roleMentions} {edition} heist signup bumped.",
  nextGroupAnnouncementTemplate: "{roleMentions} Next group ready!",
  nextUpTemplate: "📣 {nextUp} you're up!",
  notes: "",
  updatedAt: "",
};

const box: React.CSSProperties = {
  border: "1px solid #5f0000",
  borderRadius: 12,
  padding: 14,
  background: "rgba(120,0,0,0.10)",
  marginBottom: 12,
};

const input: React.CSSProperties = {
  width: "100%",
  padding: 10,
  borderRadius: 8,
  border: "1px solid #6f0000",
  background: "#0a0a0a",
  color: "#ffd7d7",
};

function clampWhole(raw: string, min: number, max: number) {
  const n = Math.trunc(Number(raw));
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : min;
}

function toggle(list: string[], id: string) {
  const set = new Set(list || []);
  if (set.has(id)) set.delete(id);
  else set.add(id);
  return Array.from(set);
}

export default function HeistPage() {
  const {
    guildId,
    guildName,
    config: rawCfg,
    setConfig: setCfg,
    roles,
    channels,
    summary,
    details,
    loading,
    saving,
    message,
    save,
  } = useGuildEngineEditor<Config>("heist", DEFAULTS);

  const cfg = useMemo(
    () => ({
      ...DEFAULTS,
      ...(rawCfg || {}),
      pingRoleIds: {
        EE: Array.isArray((rawCfg as any)?.pingRoleIds?.EE)
          ? (rawCfg as any).pingRoleIds.EE
          : Array.isArray((rawCfg as any)?.pingRoles?.EE)
            ? (rawCfg as any).pingRoles.EE
            : [],
        LE: Array.isArray((rawCfg as any)?.pingRoleIds?.LE)
          ? (rawCfg as any).pingRoleIds.LE
          : Array.isArray((rawCfg as any)?.pingRoles?.LE)
            ? (rawCfg as any).pingRoles.LE
            : [],
      },
      maxPlayers: 3,
      reserveSlots: 0,
    }),
    [rawCfg]
  );
  const textChannels = useMemo(
    () => channels.filter((c) => Number(c?.type) === 0 || Number(c?.type) === 5 || String(c?.type || "").toLowerCase().includes("text")),
    [channels]
  );
  const voiceChannels = useMemo(
    () => channels.filter((c) => Number(c?.type) === 2 || Number(c?.type) === 13 || String(c?.type || "").toLowerCase().includes("voice")),
    [channels]
  );

  if (!guildId) return <div style={{ color: "#ff8a8a", padding: 20 }}>Missing guildId. Open from /guilds.</div>;
  if (loading) return <div style={{ color: "#ff8a8a", padding: 20 }}>Loading heist ops...</div>;

  return (
    <div style={{ color: "#ffb3b3", padding: 14, maxWidth: 1300 }}>
      <h1 style={{ marginTop: 0, color: "#ff3b3b", letterSpacing: "0.08em", textTransform: "uppercase" }}>Heist Ops Studio</h1>
      <p style={{ marginTop: 0 }}>Guild: {guildName || guildId}</p>
      <p style={{ color: "#ffb7b7", marginTop: -4, lineHeight: 1.6 }}>
        Heist runs two live lanes in this build: <strong>LE</strong> and <strong>EE</strong>. Each lane is fixed to
        <strong> 1 host + 3 signup slots + pending members</strong>.
      </p>
      <p style={{ color: "#ff9d9d", marginTop: -6, lineHeight: 1.6 }}>
        Staff command surface is intentionally minimal here: <strong>/heist start</strong> and <strong>/heist forcecancel</strong>,
        each with an <strong>LE</strong> or <strong>EE</strong> lane choice.
      </p>
      <p style={{ color: "#ff9d9d", marginTop: -6, lineHeight: 1.6 }}>
        Signups stay open until staff closes, cancels, or marks them done. They should not auto-close on their own anymore.
      </p>
      {message ? <div style={{ color: "#ffb3f0", marginBottom: 8 }}>{message}</div> : null}

      <EngineInsights summary={summary} details={details} />

      <div style={box}>
        <label><input type="checkbox" checked={cfg.active} onChange={(e) => setCfg({ ...cfg, active: e.target.checked })} /> Heist engine active</label><br />
        <label><input type="checkbox" checked={cfg.signupEnabled} onChange={(e) => setCfg({ ...cfg, signupEnabled: e.target.checked })} /> Signup flow enabled</label><br />
        <label><input type="checkbox" checked={cfg.requireVoiceChannel} onChange={(e) => setCfg({ ...cfg, requireVoiceChannel: e.target.checked })} /> Require voice channel</label>
      </div>

      <div style={box}>
        <h3 style={{ marginTop: 0, color: "#ff4444" }}>Channels and Roles</h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(180px, 1fr))", gap: 10 }}>
          <div>
            <label>Signup channel</label>
            <select style={input} value={cfg.signupChannelId} onChange={(e) => setCfg((p) => ({ ...p, signupChannelId: e.target.value }))}>
              <option value="">Select channel</option>
              {textChannels.map((c) => <option key={c.id} value={c.id}>#{c.name}</option>)}
            </select>
          </div>
          <div>
            <label>Announce channel</label>
            <select style={input} value={cfg.announceChannelId} onChange={(e) => setCfg((p) => ({ ...p, announceChannelId: e.target.value }))}>
              <option value="">Select channel</option>
              {textChannels.map((c) => <option key={c.id} value={c.id}>#{c.name}</option>)}
            </select>
          </div>
          <div>
            <label>Transcript channel</label>
            <select style={input} value={cfg.transcriptChannelId} onChange={(e) => setCfg((p) => ({ ...p, transcriptChannelId: e.target.value }))}>
              <option value="">Select channel</option>
              {textChannels.map((c) => <option key={c.id} value={c.id}>#{c.name}</option>)}
            </select>
          </div>
          <div>
            <label>Voice channel</label>
            <select style={input} value={cfg.voiceChannelId} onChange={(e) => setCfg((p) => ({ ...p, voiceChannelId: e.target.value }))}>
              <option value="">Select voice channel</option>
              {voiceChannels.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label>Verified role</label>
            <select style={input} value={cfg.verifiedRoleId} onChange={(e) => setCfg((p) => ({ ...p, verifiedRoleId: e.target.value }))}>
              <option value="">Select role</option>
              {roles.map((r) => <option key={r.id} value={r.id}>@{r.name}</option>)}
            </select>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))", gap: 10, marginTop: 12 }}>
          <div>
            <div style={{ marginBottom: 6 }}>Host roles</div>
            <div style={{ maxHeight: 180, overflowY: "auto", border: "1px solid #5a0000", borderRadius: 8, padding: 8 }}>
              {roles.map((r) => (
                <label key={`host_${r.id}`} style={{ display: "block", marginBottom: 4 }}>
                  <input type="checkbox" checked={cfg.hostRoleIds.includes(r.id)} onChange={() => setCfg((p) => ({ ...p, hostRoleIds: toggle(p.hostRoleIds, r.id) }))} /> @{r.name}
                </label>
              ))}
            </div>
          </div>
          <div>
            <div style={{ marginBottom: 6 }}>Weekly-limit exempt roles</div>
            <div style={{ maxHeight: 180, overflowY: "auto", border: "1px solid #5a0000", borderRadius: 8, padding: 8 }}>
              {roles.map((r) => (
                <label key={`exempt_${r.id}`} style={{ display: "block", marginBottom: 4 }}>
                  <input type="checkbox" checked={cfg.exemptRoleIds.includes(r.id)} onChange={() => setCfg((p) => ({ ...p, exemptRoleIds: toggle(p.exemptRoleIds, r.id) }))} /> @{r.name}
                </label>
              ))}
            </div>
          </div>
          <div>
            <div style={{ marginBottom: 6 }}>LE ping roles</div>
            <div style={{ maxHeight: 180, overflowY: "auto", border: "1px solid #5a0000", borderRadius: 8, padding: 8 }}>
              {roles.map((r) => (
                <label key={`ping_le_${r.id}`} style={{ display: "block", marginBottom: 4 }}>
                  <input
                    type="checkbox"
                    checked={cfg.pingRoleIds?.LE?.includes(r.id) || false}
                    onChange={() =>
                      setCfg((p) => ({
                        ...p,
                        pingRoleIds: {
                          EE: p.pingRoleIds?.EE || [],
                          LE: toggle(p.pingRoleIds?.LE || [], r.id),
                        },
                      }))
                    }
                  />{" "}
                  @{r.name}
                </label>
              ))}
            </div>
          </div>
          <div>
            <div style={{ marginBottom: 6 }}>EE ping roles</div>
            <div style={{ maxHeight: 180, overflowY: "auto", border: "1px solid #5a0000", borderRadius: 8, padding: 8 }}>
              {roles.map((r) => (
                <label key={`ping_ee_${r.id}`} style={{ display: "block", marginBottom: 4 }}>
                  <input
                    type="checkbox"
                    checked={cfg.pingRoleIds?.EE?.includes(r.id) || false}
                    onChange={() =>
                      setCfg((p) => ({
                        ...p,
                        pingRoleIds: {
                          EE: toggle(p.pingRoleIds?.EE || [], r.id),
                          LE: p.pingRoleIds?.LE || [],
                        },
                      }))
                    }
                  />{" "}
                  @{r.name}
                </label>
              ))}
            </div>
          </div>
          <div>
            <div style={{ marginBottom: 6 }}>Blocked roles</div>
            <div style={{ maxHeight: 180, overflowY: "auto", border: "1px solid #5a0000", borderRadius: 8, padding: 8 }}>
              {roles.map((r) => (
                <label key={`blocked_${r.id}`} style={{ display: "block", marginBottom: 4 }}>
                  <input type="checkbox" checked={cfg.blockedRoleIds.includes(r.id)} onChange={() => setCfg((p) => ({ ...p, blockedRoleIds: toggle(p.blockedRoleIds, r.id) }))} /> @{r.name}
                </label>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div style={box}>
        <h3 style={{ marginTop: 0, color: "#ff4444" }}>Session Rules</h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(180px, 1fr))", gap: 10 }}>
          <div>
            <label>Heist layout</label>
            <div style={{ ...input, display: "flex", alignItems: "center", minHeight: 42, opacity: 0.9 }}>
              1 host + 3 signup slots + pending members
            </div>
          </div>
          <div><label>Weekly limit</label><input style={input} type="number" min={1} max={1000} value={cfg.weeklyLimit} onChange={(e) => setCfg({ ...cfg, weeklyLimit: clampWhole(e.target.value, 1, 1000) })} /></div>
          <div><label>Auto-bump (minutes)</label><input style={input} type="number" min={0} max={1440} value={cfg.autoBumpMinutes} onChange={(e) => setCfg({ ...cfg, autoBumpMinutes: clampWhole(e.target.value, 0, 1440) })} /></div>
          <div><label>Cooldown (minutes)</label><input style={input} type="number" min={0} max={10080} value={cfg.cooldownMinutes} onChange={(e) => setCfg({ ...cfg, cooldownMinutes: clampWhole(e.target.value, 0, 10080) })} /></div>
          <div><label>Min account age (days)</label><input style={input} type="number" min={0} max={3650} value={cfg.minAccountAgeDays} onChange={(e) => setCfg({ ...cfg, minAccountAgeDays: clampWhole(e.target.value, 0, 3650) })} /></div>
        </div>
        <div style={{ marginTop: 8 }}>
          <label><input type="checkbox" checked={cfg.mustBeVerified} onChange={(e) => setCfg({ ...cfg, mustBeVerified: e.target.checked })} /> Must be verified to join</label>
        </div>
      </div>

      <div style={box}>
        <h3 style={{ marginTop: 0, color: "#ff4444" }}>Payouts</h3>
        <label><input type="checkbox" checked={cfg.payoutEnabled} onChange={(e) => setCfg({ ...cfg, payoutEnabled: e.target.checked })} /> Payouts enabled</label><br />
        <label><input type="checkbox" checked={cfg.streakBonusEnabled} onChange={(e) => setCfg({ ...cfg, streakBonusEnabled: e.target.checked })} /> Streak bonus enabled</label>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 10 }}>
          <div><label>Win payout coins</label><input style={input} type="number" min={0} max={10000000} value={cfg.payoutCoinsWin} onChange={(e) => setCfg({ ...cfg, payoutCoinsWin: clampWhole(e.target.value, 0, 10000000) })} /></div>
        </div>
      </div>

      <div style={box}>
        <h3 style={{ marginTop: 0, color: "#ff4444" }}>Messages and Copy</h3>
        <div style={{ color: "#ffb7b7", marginBottom: 10, lineHeight: 1.6 }}>
          Tokens you can use here: <code>{`{edition}`}</code>, <code>{`{host}`}</code>, <code>{`{slots}`}</code>, <code>{`{pending}`}</code>, <code>{`{status}`}</code>, <code>{`{nextUp}`}</code>, <code>{`{roleMentions}`}</code>.
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(260px, 1fr))", gap: 10 }}>
          <div>
            <label>Panel title</label>
            <input style={input} value={cfg.panelTitleTemplate} onChange={(e) => setCfg({ ...cfg, panelTitleTemplate: e.target.value })} />
          </div>
          <div>
            <label>Next up message</label>
            <input style={input} value={cfg.nextUpTemplate} onChange={(e) => setCfg({ ...cfg, nextUpTemplate: e.target.value })} />
          </div>
          <div style={{ gridColumn: "1 / -1" }}>
            <label>Panel body</label>
            <textarea style={{ ...input, minHeight: 140 }} value={cfg.panelDescriptionTemplate} onChange={(e) => setCfg({ ...cfg, panelDescriptionTemplate: e.target.value })} />
          </div>
          <div>
            <label>Signup live announcement</label>
            <textarea style={{ ...input, minHeight: 90 }} value={cfg.signupAnnouncementTemplate} onChange={(e) => setCfg({ ...cfg, signupAnnouncementTemplate: e.target.value })} />
          </div>
          <div>
            <label>Autobump announcement</label>
            <textarea style={{ ...input, minHeight: 90 }} value={cfg.bumpAnnouncementTemplate} onChange={(e) => setCfg({ ...cfg, bumpAnnouncementTemplate: e.target.value })} />
          </div>
          <div style={{ gridColumn: "1 / -1" }}>
            <label>Next group announcement</label>
            <textarea style={{ ...input, minHeight: 90 }} value={cfg.nextGroupAnnouncementTemplate} onChange={(e) => setCfg({ ...cfg, nextGroupAnnouncementTemplate: e.target.value })} />
          </div>
        </div>
      </div>

      <div style={box}>
        <label>Notes</label>
        <textarea style={{ ...input, minHeight: 90 }} value={cfg.notes} onChange={(e) => setCfg({ ...cfg, notes: e.target.value })} />
      </div>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
        <button onClick={() => save(cfg)} disabled={saving} style={{ ...input, width: "auto", cursor: "pointer", fontWeight: 900 }}>
          {saving ? "Saving..." : "Save Heist Ops"}
        </button>
      </div>
    </div>
  );
}
