"use client";

import ConfigJsonEditor from "@/components/possum/ConfigJsonEditor";
import EngineInsights from "@/components/possum/EngineInsights";
import { useGuildEngineEditor } from "@/components/possum/useGuildEngineEditor";

type GuildChannel = { id: string; name: string; type?: number | string };
type GuildRole = { id: string; name: string };

type PreOnboardingConfig = {
  autoBanOnBlacklistRejoin: boolean;
  autoBanOnRefusalRole: boolean;
  sendRemovalDm: boolean;
  enforcementAction: "kick" | "ban";
  profileThreatGuardEnabled: boolean;
  profileThreatScanOnUpdate: boolean;
  profileThreatAction: "log" | "kick" | "ban";
  profileThreatKeywords: string;
  profileThreatDomains: string;
  profileThreatExemptRoleIds: string[];
  refusalRoleId: string;
  enforcementChannelId: string;
  contactUser: string;
  banDmTemplate: string;
};

const DEFAULTS: PreOnboardingConfig = {
  autoBanOnBlacklistRejoin: true,
  autoBanOnRefusalRole: true,
  sendRemovalDm: true,
  enforcementAction: "ban",
  profileThreatGuardEnabled: false,
  profileThreatScanOnUpdate: true,
  profileThreatAction: "kick",
  profileThreatKeywords: "telegram\nmegalinks\nt.me",
  profileThreatDomains: "t.me\ntelegram.me\nmega.nz",
  profileThreatExemptRoleIds: [],
  refusalRoleId: "",
  enforcementChannelId: "",
  contactUser: "Support Team",
  banDmTemplate: "You were removed from the server.\n\nReason: **{{reason}}**\nTrigger: **{{type}}**\n\nContact: **{{contactUser}}**",
};

const styles = {
  page: { color: "#ffb3b3", padding: 14, maxWidth: 1120 },
  card: {
    border: "1px solid #5f0000",
    borderRadius: 12,
    padding: 14,
    background: "rgba(120,0,0,0.10)",
    marginBottom: 12,
  },
  input: {
    width: "100%",
    padding: 10,
    borderRadius: 8,
    border: "1px solid #6f0000",
    background: "#0a0a0a",
    color: "#ffd7d7",
  },
  area: {
    width: "100%",
    minHeight: 110,
    padding: 10,
    borderRadius: 8,
    border: "1px solid #6f0000",
    background: "#0a0a0a",
    color: "#ffd7d7",
  },
};

function toggleRole(list: string[], id: string) {
  const set = new Set(list || []);
  if (set.has(id)) set.delete(id);
  else set.add(id);
  return Array.from(set);
}

export default function PreOnboardingClient() {
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
    reload,
  } = useGuildEngineEditor<PreOnboardingConfig>("preOnboarding", DEFAULTS);

  const textChannels = (channels as GuildChannel[]).filter(
    (channel) => Number(channel?.type) === 0 || Number(channel?.type) === 5 || String(channel?.type || "").toLowerCase().includes("text")
  );

  if (!guildId) return <div style={{ color: "#ff8a8a", padding: 20 }}>Missing guildId. Open from /guilds.</div>;
  if (loading) return <div style={{ color: "#ff8a8a", padding: 20 }}>Loading pre-onboarding...</div>;

  return (
    <div style={styles.page}>
      <h1 style={{ marginTop: 0, color: "#ff3b3b", letterSpacing: "0.08em", textTransform: "uppercase" }}>Pre-Onboarding</h1>
      <p style={{ marginTop: 0 }}>Guild: {guildName || guildId}</p>
      <div style={{ ...styles.card, borderColor: "#7a2200", background: "rgba(160,40,0,0.12)" }}>
        <strong>Step 0:</strong> this is the hard gate before verification even starts.
        <div style={{ marginTop: 8, color: "#ffd7a8", lineHeight: 1.6 }}>
          Use this page for blacklist rejoin handling, refusal-role enforcement, and the new profile threat guard. You asked for <strong>kick or ban</strong> here, so that choice is now explicit.
        </div>
      </div>
      {message ? <div style={{ color: "#ffb3f0", marginBottom: 8 }}>{message}</div> : null}

      <EngineInsights summary={summary} details={details} />

      <div style={styles.card}>
        <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <label><input type="checkbox" checked={!!cfg.autoBanOnBlacklistRejoin} onChange={(e) => setCfg({ ...cfg, autoBanOnBlacklistRejoin: e.target.checked })} /> Remove blacklisted rejoiners automatically</label>
          <label><input type="checkbox" checked={!!cfg.autoBanOnRefusalRole} onChange={(e) => setCfg({ ...cfg, autoBanOnRefusalRole: e.target.checked })} /> Remove members who get the refusal role</label>
          <label><input type="checkbox" checked={!!cfg.sendRemovalDm} onChange={(e) => setCfg({ ...cfg, sendRemovalDm: e.target.checked })} /> Send removal DM</label>
          <button onClick={() => void reload()} disabled={saving} style={{ ...styles.input, width: "auto", cursor: "pointer", fontWeight: 800 }}>
            Refresh Live Config
          </button>
        </div>
      </div>

      <div style={styles.card}>
        <h3 style={{ marginTop: 0, color: "#ff4444" }}>Enforcement</h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 10 }}>
          <div>
            <label>Enforcement action</label>
            <select style={styles.input} value={cfg.enforcementAction || "ban"} onChange={(e) => setCfg({ ...cfg, enforcementAction: e.target.value as "kick" | "ban" })}>
              <option value="kick">Kick</option>
              <option value="ban">Ban</option>
            </select>
          </div>
          <div>
            <label>Refusal role</label>
            <select style={styles.input} value={cfg.refusalRoleId || ""} onChange={(e) => setCfg({ ...cfg, refusalRoleId: e.target.value })}>
              <option value="">Select role</option>
              {(roles as GuildRole[]).map((role) => <option key={role.id} value={role.id}>@{role.name}</option>)}
            </select>
          </div>
          <div>
            <label>Enforcement log channel</label>
            <select style={styles.input} value={cfg.enforcementChannelId || ""} onChange={(e) => setCfg({ ...cfg, enforcementChannelId: e.target.value })}>
              <option value="">Select channel</option>
              {textChannels.map((channel) => <option key={channel.id} value={channel.id}>#{channel.name}</option>)}
            </select>
          </div>
          <div>
            <label>Contact user / team name</label>
            <input style={styles.input} value={cfg.contactUser || ""} onChange={(e) => setCfg({ ...cfg, contactUser: e.target.value })} />
          </div>
        </div>
      </div>

      <div style={styles.card}>
        <h3 style={{ marginTop: 0, color: "#ff4444" }}>Removal DM</h3>
        <textarea style={styles.area} value={cfg.banDmTemplate || ""} onChange={(e) => setCfg({ ...cfg, banDmTemplate: e.target.value })} />
        <div style={{ marginTop: 8, color: "#ffb8b8", fontSize: 12 }}>
          Tokens: <code>{'{{reason}}'}</code>, <code>{'{{type}}'}</code>, <code>{'{{contactUser}}'}</code>
        </div>
      </div>

      <div style={styles.card}>
        <h3 style={{ marginTop: 0, color: "#ff4444" }}>Profile Threat Guard</h3>
        <div style={{ color: "#ffd7a8", marginBottom: 10, lineHeight: 1.6 }}>
          Scans visible identity surfaces when someone joins or changes profile identity: username, global name, server nickname, and visible custom status text/URL when Discord exposes it.
        </div>
        <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", marginBottom: 12 }}>
          <label><input type="checkbox" checked={!!cfg.profileThreatGuardEnabled} onChange={(e) => setCfg({ ...cfg, profileThreatGuardEnabled: e.target.checked })} /> Enable profile threat guard</label>
          <label><input type="checkbox" checked={!!cfg.profileThreatScanOnUpdate} onChange={(e) => setCfg({ ...cfg, profileThreatScanOnUpdate: e.target.checked })} /> Re-scan on profile / nickname changes</label>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))", gap: 10 }}>
          <div>
            <label>Threat action</label>
            <select style={styles.input} value={cfg.profileThreatAction || "kick"} onChange={(e) => setCfg({ ...cfg, profileThreatAction: e.target.value as "log" | "kick" | "ban" })}>
              <option value="log">Log only</option>
              <option value="kick">Kick</option>
              <option value="ban">Ban</option>
            </select>
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 12 }}>
          <div>
            <label>Blocked keywords / phrases</label>
            <textarea style={styles.area} value={cfg.profileThreatKeywords || ""} onChange={(e) => setCfg({ ...cfg, profileThreatKeywords: e.target.value })} />
            <div style={{ marginTop: 8, color: "#ffb8b8", fontSize: 12 }}>
              One per line or comma-separated. Example: <code>telegram</code>, <code>megalinks</code>, <code>t.me</code>
            </div>
          </div>
          <div>
            <label>Blocked domains</label>
            <textarea style={styles.area} value={cfg.profileThreatDomains || ""} onChange={(e) => setCfg({ ...cfg, profileThreatDomains: e.target.value })} />
            <div style={{ marginTop: 8, color: "#ffb8b8", fontSize: 12 }}>
              One per line or comma-separated. Example: <code>t.me</code>, <code>telegram.me</code>, <code>mega.nz</code>
            </div>
          </div>
        </div>
        <div style={{ marginTop: 12 }}>
          <label>Exempt roles</label>
          <div style={{ maxHeight: 220, overflowY: "auto", border: "1px solid #5a0000", borderRadius: 8, padding: 8 }}>
            {(roles as GuildRole[]).map((role) => (
              <label key={`pre_onboarding_exempt_${role.id}`} style={{ display: "block", marginBottom: 4 }}>
                <input
                  type="checkbox"
                  checked={(cfg.profileThreatExemptRoleIds || []).includes(role.id)}
                  onChange={() => setCfg({ ...cfg, profileThreatExemptRoleIds: toggleRole(cfg.profileThreatExemptRoleIds || [], role.id) })}
                />{" "}
                @{role.name}
              </label>
            ))}
          </div>
        </div>
      </div>

      <ConfigJsonEditor
        title="Advanced Pre-Onboarding Config"
        value={cfg}
        disabled={saving}
        onApply={(next) => setCfg({ ...DEFAULTS, ...(next as PreOnboardingConfig) })}
      />

      <button onClick={() => void save()} disabled={saving} style={{ ...styles.input, width: "auto", cursor: "pointer", fontWeight: 900 }}>
        {saving ? "Saving..." : "Save Pre-Onboarding"}
      </button>
    </div>
  );
}
