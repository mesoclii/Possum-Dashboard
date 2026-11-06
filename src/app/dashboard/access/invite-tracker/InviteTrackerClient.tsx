"use client";

import { useMemo } from "react";
import EngineInsights from "@/components/possum/EngineInsights";
import { useGuildEngineEditor } from "@/components/possum/useGuildEngineEditor";

type Config = {
  enabled: boolean;
  stayDays: number;
  minAccountAgeDays: number;
  recruiterThreshold: number;
  joinLogChannelId: string;
  leaveLogChannelId: string;
  logChannelId: string;
  recruiterRoleId: string;
  recruitedRoleId: string;
  removeVipOnDrop: boolean;
  vipRoleId: string;
};

const DEFAULT_CONFIG: Config = {
  enabled: true,
  stayDays: 7,
  minAccountAgeDays: 3,
  recruiterThreshold: 10,
  joinLogChannelId: "",
  leaveLogChannelId: "",
  logChannelId: "",
  recruiterRoleId: "",
  recruitedRoleId: "",
  removeVipOnDrop: false,
  vipRoleId: "",
};

const wrap: React.CSSProperties = { color: "#ffd0d0", padding: 16, maxWidth: 1240 };
const card: React.CSSProperties = { border: "1px solid #6a0000", borderRadius: 12, background: "rgba(120,0,0,0.10)", padding: 14, marginBottom: 12 };
const input: React.CSSProperties = { width: "100%", padding: "10px 12px", background: "#0b0b0b", color: "#ffd8d8", border: "1px solid #7a0000", borderRadius: 8 };

export default function InviteTrackerClient() {
  const {
    guildId,
    guildName,
    config,
    setConfig,
    roles,
    channels,
    summary,
    details,
    loading,
    saving,
    message,
    save,
  } = useGuildEngineEditor<Config>("inviteTracker", DEFAULT_CONFIG);

  const textChannels = useMemo(
    () => channels.filter((c) => Number(c?.type) === 0 || Number(c?.type) === 5 || String(c?.type || "").toLowerCase().includes("text")),
    [channels]
  );

  if (!guildId) {
    return <main style={{ padding: 16, color: "#ff6666" }}>Missing guildId. Open from /guilds first.</main>;
  }

  return (
    <main style={wrap}>
      <h1 style={{ marginTop: 0, color: "#ff4444", textTransform: "uppercase", letterSpacing: "0.12em" }}>Invite Tracker Engine</h1>
      <div style={{ color: "#ff9999" }}>Guild: {guildName || guildId}</div>
      <div style={{ color: "#ffb0b0", fontSize: 12, marginTop: 4 }}>
        Real invite runtime controls for invite validation, stay windows, recruiter rewards, and drop behavior.
      </div>
      {message ? <div style={{ color: "#ffb3f0", marginTop: 8 }}>{message}</div> : null}

      {loading ? (
        <div style={{ ...card, marginTop: 12 }}>Loading invite tracker...</div>
      ) : (
        <>
          <EngineInsights summary={summary} details={details} />

          <section style={{ ...card, marginTop: 12 }}>
            <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
              <label><input type="checkbox" checked={config.enabled} onChange={(e) => setConfig((p) => ({ ...p, enabled: e.target.checked }))} /> Engine Enabled</label>
              <label><input type="checkbox" checked={config.removeVipOnDrop} onChange={(e) => setConfig((p) => ({ ...p, removeVipOnDrop: e.target.checked }))} /> Remove VIP On Drop</label>
            </div>
          </section>

          <section style={card}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 12 }}>
              <div>
                <div style={{ marginBottom: 6 }}>Required Stay Days</div>
                <input style={input} type="number" min={0} value={config.stayDays} onChange={(e) => setConfig((p) => ({ ...p, stayDays: Number(e.target.value || 0) }))} />
              </div>
              <div>
                <div style={{ marginBottom: 6 }}>Minimum Account Age (days)</div>
                <input style={input} type="number" min={0} value={config.minAccountAgeDays} onChange={(e) => setConfig((p) => ({ ...p, minAccountAgeDays: Number(e.target.value || 0) }))} />
              </div>
              <div>
                <div style={{ marginBottom: 6 }}>Recruiter Threshold</div>
                <input style={input} type="number" min={0} value={config.recruiterThreshold} onChange={(e) => setConfig((p) => ({ ...p, recruiterThreshold: Number(e.target.value || 0) }))} />
              </div>
            </div>
          </section>

          <section style={card}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))", gap: 12 }}>
              <div>
                <div style={{ marginBottom: 6 }}>Join Log Channel</div>
                <select style={input} value={config.joinLogChannelId || ""} onChange={(e) => setConfig((p) => ({ ...p, joinLogChannelId: e.target.value }))}>
                  <option value="">None</option>
                  {textChannels.map((channel) => <option key={channel.id} value={channel.id}>#{channel.name}</option>)}
                </select>
              </div>
              <div>
                <div style={{ marginBottom: 6 }}>Leave Log Channel</div>
                <select style={input} value={config.leaveLogChannelId || ""} onChange={(e) => setConfig((p) => ({ ...p, leaveLogChannelId: e.target.value }))}>
                  <option value="">None</option>
                  {textChannels.map((channel) => <option key={channel.id} value={channel.id}>#{channel.name}</option>)}
                </select>
              </div>
              <div>
                <div style={{ marginBottom: 6 }}>Shared Fallback Log Channel</div>
                <select style={input} value={config.logChannelId || ""} onChange={(e) => setConfig((p) => ({ ...p, logChannelId: e.target.value }))}>
                  <option value="">None</option>
                  {textChannels.map((channel) => <option key={channel.id} value={channel.id}>#{channel.name}</option>)}
                </select>
              </div>
              <div>
                <div style={{ marginBottom: 6 }}>Recruiter Role</div>
                <select style={input} value={config.recruiterRoleId || ""} onChange={(e) => setConfig((p) => ({ ...p, recruiterRoleId: e.target.value }))}>
                  <option value="">None</option>
                  {roles.map((role) => <option key={role.id} value={role.id}>@{role.name}</option>)}
                </select>
              </div>
              <div>
                <div style={{ marginBottom: 6 }}>Recruited Role</div>
                <select style={input} value={config.recruitedRoleId || ""} onChange={(e) => setConfig((p) => ({ ...p, recruitedRoleId: e.target.value }))}>
                  <option value="">None</option>
                  {roles.map((role) => <option key={role.id} value={role.id}>@{role.name}</option>)}
                </select>
              </div>
              <div>
                <div style={{ marginBottom: 6 }}>VIP Role</div>
                <select style={input} value={config.vipRoleId || ""} onChange={(e) => setConfig((p) => ({ ...p, vipRoleId: e.target.value }))}>
                  <option value="">None</option>
                  {roles.map((role) => <option key={role.id} value={role.id}>@{role.name}</option>)}
                </select>
              </div>
            </div>
          </section>

          <div style={{ ...card, display: "flex", justifyContent: "flex-end" }}>
            <button onClick={() => save()} disabled={saving} style={{ ...input, width: "auto", cursor: "pointer", fontWeight: 900 }}>
              {saving ? "Saving..." : "Save Invite Tracker"}
            </button>
          </div>
        </>
      )}
    </main>
  );
}
