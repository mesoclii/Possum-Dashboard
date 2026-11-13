"use client";

import ConfigJsonEditor from "@/components/possum/ConfigJsonEditor";
import EngineInsights from "@/components/possum/EngineInsights";
import { useGuildEngineEditor } from "@/components/possum/useGuildEngineEditor";

type GuildChannel = { id: string; name: string; type?: number | string };
type GuildRole = { id: string; name: string };

type VerificationConfig = {
  enabled: boolean;
  sendWelcomeDm: boolean;
  sendWelcomePanel: boolean;
  requireRulesRead: boolean;
  sendGateAnnouncement: boolean;
  grantVerifiedRole: boolean;
  removeRolesOnVerify: boolean;
  autoKickOnDecline: boolean;
  autoKickOnTimeout: boolean;
  welcomeChannelId: string;
  mainChatChannelId: string;
  rulesChannelId: string;
  verifiedRoleId: string;
  declineRoleId: string;
  removeOnVerifyRoleIds: string[];
  idChannelId: string;
  idTimeoutMinutes: number;
  dmTemplate: string;
  panelTitle: string;
  panelDescription: string;
  panelFooter: string;
  gateAnnouncementTemplate: string;
  rulesButtonLabel: string;
  readRulesButtonLabel: string;
  readRulesConfirmedButtonLabel: string;
  verifyButtonLabel: string;
  idPanelTitle: string;
  idPanelDescription: string;
  idPanelContent: string;
  declineKickReason: string;
  timeoutKickReason: string;
  declineReplyTemplate: string;
};

const DEFAULTS: VerificationConfig = {
  enabled: true,
  sendWelcomeDm: true,
  sendWelcomePanel: true,
  requireRulesRead: true,
  sendGateAnnouncement: true,
  grantVerifiedRole: true,
  removeRolesOnVerify: true,
  autoKickOnDecline: true,
  autoKickOnTimeout: true,
  welcomeChannelId: "",
  mainChatChannelId: "",
  rulesChannelId: "",
  verifiedRoleId: "",
  declineRoleId: "",
  removeOnVerifyRoleIds: [],
  idChannelId: "",
  idTimeoutMinutes: 30,
  dmTemplate: "Welcome to {{guildName}}.\n\nStart verification in <#{{welcomeChannelId}}>.",
  panelTitle: "Welcome to {{guildName}}",
  panelDescription: "Read the rules in <#{{rulesChannelId}}> and confirm below to continue.",
  panelFooter: "Complete verification to unlock the next step.",
  gateAnnouncementTemplate: "Survivor <@{{userId}}> has reached the gates.",
  rulesButtonLabel: "Open Rules",
  readRulesButtonLabel: "I've Read the Survival Code",
  readRulesConfirmedButtonLabel: "Rules Confirmed",
  verifyButtonLabel: "Enter The Safe Zone (18+)",
  idPanelTitle: "ID Verification - Final Gate",
  idPanelDescription: "<@{{userId}}> choose how you proceed.\n\nThose who refuse will be removed.",
  idPanelContent: "Survivor <@{{userId}}>",
  declineKickReason: "Declined ID verification",
  timeoutKickReason: "ID submission timeout",
  declineReplyTemplate: "You declined ID verification.",
};

const styles = {
  page: { color: "#ff5a5a", padding: 16, maxWidth: 1200 },
  card: {
    border: "1px solid #5c0000",
    borderRadius: 12,
    padding: 16,
    marginBottom: 14,
    background: "rgba(90,0,0,0.12)",
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
    minHeight: 92,
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

export default function VerificationClient() {
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
    runAction,
  } = useGuildEngineEditor<VerificationConfig>("verification", DEFAULTS);

  const textChannels = (channels as GuildChannel[]).filter(
    (channel) => Number(channel?.type) === 0 || Number(channel?.type) === 5 || String(channel?.type || "").toLowerCase().includes("text")
  );
  const roleList = (roles as GuildRole[]) || [];

  async function deployPanel() {
    await save();
    await runAction("deployVerificationPanel", {});
  }

  if (!guildId) return <div style={{ color: "#ff8a8a", padding: 20 }}>Missing guildId. Open from /guilds.</div>;
  if (loading) return <div style={{ color: "#ff8a8a", padding: 20 }}>Loading verification...</div>;

  return (
    <div style={styles.page}>
      <h1 style={{ marginTop: 0, color: "#ff3b3b", letterSpacing: "0.08em", textTransform: "uppercase" }}>Verification</h1>
      <p style={{ marginTop: 0 }}>Guild: {guildName || guildId}</p>
      <div style={{ ...styles.card, borderColor: "#7a2200", background: "rgba(160,40,0,0.12)" }}>
        <strong>Step 1:</strong> this is the 18+ gate. Members land in the welcome channel, read the rules, confirm, and verify.
        <div style={{ marginTop: 8, color: "#ffd7a8", lineHeight: 1.6 }}>
          Onboarding (the ID ticket) is the optional second step and lives on its own page. Everything here applies before a member is verified —
          the welcome DM, the gate panel, the rules buttons, the verified role, and what happens to members who decline or time out.
        </div>
      </div>
      {message ? <div style={{ color: "#ffb3f0", marginBottom: 8 }}>{message}</div> : null}

      <EngineInsights summary={summary} details={details} />

      <div style={styles.card}>
        <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <label><input type="checkbox" checked={!!cfg.enabled} onChange={(e) => setCfg({ ...cfg, enabled: e.target.checked })} /> Verification enabled</label>
          <button onClick={() => void reload()} disabled={saving} style={{ ...styles.input, width: "auto", cursor: "pointer", fontWeight: 800 }}>
            Refresh Live Config
          </button>
        </div>
      </div>

      <div style={styles.card}>
        <h3 style={{ marginTop: 0, color: "#ff4444" }}>Gate behavior</h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))", gap: 10 }}>
          <label><input type="checkbox" checked={!!cfg.sendWelcomeDm} onChange={(e) => setCfg({ ...cfg, sendWelcomeDm: e.target.checked })} /> Send the welcome DM on join</label>
          <label><input type="checkbox" checked={!!cfg.sendWelcomePanel} onChange={(e) => setCfg({ ...cfg, sendWelcomePanel: e.target.checked })} /> Post the gate panel on join</label>
          <label><input type="checkbox" checked={!!cfg.requireRulesRead} onChange={(e) => setCfg({ ...cfg, requireRulesRead: e.target.checked })} /> Require the rules confirm before verifying</label>
          <label><input type="checkbox" checked={!!cfg.sendGateAnnouncement} onChange={(e) => setCfg({ ...cfg, sendGateAnnouncement: e.target.checked })} /> Announce arrivals above the gate panel</label>
          <label><input type="checkbox" checked={!!cfg.grantVerifiedRole} onChange={(e) => setCfg({ ...cfg, grantVerifiedRole: e.target.checked })} /> Grant the verified role on verify</label>
          <label><input type="checkbox" checked={!!cfg.removeRolesOnVerify} onChange={(e) => setCfg({ ...cfg, removeRolesOnVerify: e.target.checked })} /> Remove the roles listed below on verify</label>
        </div>
      </div>

      <div style={styles.card}>
        <h3 style={{ marginTop: 0, color: "#ff4444" }}>Channels and roles</h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))", gap: 10 }}>
          <div>
            <label>Welcome channel (gate panel posts here)</label>
            <select style={styles.input} value={cfg.welcomeChannelId || ""} onChange={(e) => setCfg({ ...cfg, welcomeChannelId: e.target.value })}>
              <option value="">Select channel</option>
              {textChannels.map((channel) => <option key={channel.id} value={channel.id}>#{channel.name}</option>)}
            </select>
          </div>
          <div>
            <label>Rules channel</label>
            <select style={styles.input} value={cfg.rulesChannelId || ""} onChange={(e) => setCfg({ ...cfg, rulesChannelId: e.target.value })}>
              <option value="">Select channel</option>
              {textChannels.map((channel) => <option key={channel.id} value={channel.id}>#{channel.name}</option>)}
            </select>
          </div>
          <div>
            <label>Main chat / unlocked area</label>
            <select style={styles.input} value={cfg.mainChatChannelId || ""} onChange={(e) => setCfg({ ...cfg, mainChatChannelId: e.target.value })}>
              <option value="">Select channel</option>
              {textChannels.map((channel) => <option key={channel.id} value={channel.id}>#{channel.name}</option>)}
            </select>
          </div>
          <div>
            <label>ID request channel (optional second step)</label>
            <select style={styles.input} value={cfg.idChannelId || ""} onChange={(e) => setCfg({ ...cfg, idChannelId: e.target.value })}>
              <option value="">Not used</option>
              {textChannels.map((channel) => <option key={channel.id} value={channel.id}>#{channel.name}</option>)}
            </select>
          </div>
          <div>
            <label>Verified role</label>
            <select style={styles.input} value={cfg.verifiedRoleId || ""} onChange={(e) => setCfg({ ...cfg, verifiedRoleId: e.target.value })}>
              <option value="">Select role</option>
              {roleList.map((role) => <option key={role.id} value={role.id}>@{role.name}</option>)}
            </select>
          </div>
          <div>
            <label>Decline role (given instead of verified)</label>
            <select style={styles.input} value={cfg.declineRoleId || ""} onChange={(e) => setCfg({ ...cfg, declineRoleId: e.target.value })}>
              <option value="">Not used</option>
              {roleList.map((role) => <option key={role.id} value={role.id}>@{role.name}</option>)}
            </select>
          </div>
          <div>
            <label>ID submission timeout (minutes)</label>
            <input
              type="number"
              style={styles.input}
              value={Number(cfg.idTimeoutMinutes || 0)}
              onChange={(e) => setCfg({ ...cfg, idTimeoutMinutes: Number(e.target.value || 0) })}
            />
          </div>
        </div>
        <div style={{ marginTop: 12 }}>
          <label>Remove these roles once verified</label>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 6 }}>
            {roleList.length ? roleList.map((role) => {
              const active = (cfg.removeOnVerifyRoleIds || []).includes(role.id);
              return (
                <button
                  key={role.id}
                  type="button"
                  onClick={() => setCfg({ ...cfg, removeOnVerifyRoleIds: toggleRole(cfg.removeOnVerifyRoleIds || [], role.id) })}
                  style={{
                    ...styles.input,
                    width: "auto",
                    cursor: "pointer",
                    fontSize: 12,
                    background: active ? "#4a0000" : "#0a0a0a",
                    color: active ? "#ffd7d7" : "#ff9b9b",
                  }}
                >
                  @{role.name}
                </button>
              );
            }) : <span style={{ color: "#ff9b9b" }}>No roles loaded.</span>}
          </div>
        </div>
      </div>

      <div style={styles.card}>
        <h3 style={{ marginTop: 0, color: "#ff4444" }}>Gate panel copy</h3>
        <div style={{ display: "grid", gap: 10 }}>
          <div>
            <label>Panel title</label>
            <input style={styles.input} value={cfg.panelTitle || ""} onChange={(e) => setCfg({ ...cfg, panelTitle: e.target.value })} />
          </div>
          <div>
            <label>Panel description</label>
            <textarea style={styles.area} value={cfg.panelDescription || ""} onChange={(e) => setCfg({ ...cfg, panelDescription: e.target.value })} />
          </div>
          <div>
            <label>Panel footer</label>
            <input style={styles.input} value={cfg.panelFooter || ""} onChange={(e) => setCfg({ ...cfg, panelFooter: e.target.value })} />
          </div>
          <div>
            <label>Arrival announcement</label>
            <textarea style={styles.area} value={cfg.gateAnnouncementTemplate || ""} onChange={(e) => setCfg({ ...cfg, gateAnnouncementTemplate: e.target.value })} />
          </div>
          <div>
            <label>Welcome DM</label>
            <textarea style={styles.area} value={cfg.dmTemplate || ""} onChange={(e) => setCfg({ ...cfg, dmTemplate: e.target.value })} />
          </div>
        </div>
      </div>

      <div style={styles.card}>
        <h3 style={{ marginTop: 0, color: "#ff4444" }}>Buttons</h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))", gap: 10 }}>
          <div>
            <label>Rules link button</label>
            <input style={styles.input} value={cfg.rulesButtonLabel || ""} onChange={(e) => setCfg({ ...cfg, rulesButtonLabel: e.target.value })} />
          </div>
          <div>
            <label>Rules confirm button</label>
            <input style={styles.input} value={cfg.readRulesButtonLabel || ""} onChange={(e) => setCfg({ ...cfg, readRulesButtonLabel: e.target.value })} />
          </div>
          <div>
            <label>Rules confirmed (disabled state)</label>
            <input style={styles.input} value={cfg.readRulesConfirmedButtonLabel || ""} onChange={(e) => setCfg({ ...cfg, readRulesConfirmedButtonLabel: e.target.value })} />
          </div>
          <div>
            <label>Verify button</label>
            <input style={styles.input} value={cfg.verifyButtonLabel || ""} onChange={(e) => setCfg({ ...cfg, verifyButtonLabel: e.target.value })} />
          </div>
        </div>
      </div>

      <div style={styles.card}>
        <h3 style={{ marginTop: 0, color: "#ff4444" }}>ID review copy and decline handling</h3>
        <div style={{ display: "grid", gap: 10 }}>
          <div>
            <label>ID panel title</label>
            <input style={styles.input} value={cfg.idPanelTitle || ""} onChange={(e) => setCfg({ ...cfg, idPanelTitle: e.target.value })} />
          </div>
          <div>
            <label>ID panel description</label>
            <textarea style={styles.area} value={cfg.idPanelDescription || ""} onChange={(e) => setCfg({ ...cfg, idPanelDescription: e.target.value })} />
          </div>
          <div>
            <label>ID panel header content</label>
            <textarea style={styles.area} value={cfg.idPanelContent || ""} onChange={(e) => setCfg({ ...cfg, idPanelContent: e.target.value })} />
          </div>
          <div>
            <label>Decline reply message</label>
            <textarea style={styles.area} value={cfg.declineReplyTemplate || ""} onChange={(e) => setCfg({ ...cfg, declineReplyTemplate: e.target.value })} />
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))", gap: 10, marginTop: 10 }}>
          <label><input type="checkbox" checked={!!cfg.autoKickOnDecline} onChange={(e) => setCfg({ ...cfg, autoKickOnDecline: e.target.checked })} /> Remove members who decline</label>
          <label><input type="checkbox" checked={!!cfg.autoKickOnTimeout} onChange={(e) => setCfg({ ...cfg, autoKickOnTimeout: e.target.checked })} /> Remove members who time out</label>
          <div>
            <label>Decline removal reason</label>
            <input style={styles.input} value={cfg.declineKickReason || ""} onChange={(e) => setCfg({ ...cfg, declineKickReason: e.target.value })} />
          </div>
          <div>
            <label>Timeout removal reason</label>
            <input style={styles.input} value={cfg.timeoutKickReason || ""} onChange={(e) => setCfg({ ...cfg, timeoutKickReason: e.target.value })} />
          </div>
        </div>
      </div>

      <div style={styles.card}>
        <h3 style={{ marginTop: 0, color: "#ff4444" }}>Gate message</h3>
        <div style={{ color: "#ffd7a8", marginBottom: 10 }}>
          Every member gets their own gate message in the welcome channel when they join: rules button, rules confirm, then verify, which opens their ID ticket. Save posts a copy now for testing; it auto-deletes after 30 minutes, so nothing sits in the channel permanently.
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button onClick={() => void save()} disabled={saving} style={{ ...styles.input, width: "auto", cursor: "pointer", fontWeight: 800 }}>
            {saving ? "Saving..." : "Save Verification"}
          </button>
          <button onClick={() => void deployPanel()} disabled={saving} style={{ ...styles.input, width: "auto", cursor: "pointer", fontWeight: 800 }}>
            Save + Post Test Gate Message
          </button>
        </div>
      </div>

      <ConfigJsonEditor
        title="Advanced Verification Config"
        value={cfg}
        disabled={saving}
        onApply={(next) => setCfg({ ...DEFAULTS, ...(next as VerificationConfig) })}
      />

      <button onClick={() => void save()} disabled={saving} style={{ ...styles.input, width: "auto", cursor: "pointer", fontWeight: 900 }}>
        {saving ? "Saving..." : "Save Verification"}
      </button>
    </div>
  );
}
