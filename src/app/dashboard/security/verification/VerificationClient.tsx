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
  welcomeChannelId: string;
  mainChatChannelId: string;
  rulesChannelId: string;
  verifiedRoleId: string;
  removeOnVerifyRoleIds: string[];
  dmTemplate: string;
  panelTitle: string;
  panelDescription: string;
  panelFooter: string;
  gateAnnouncementTemplate: string;
  rulesButtonLabel: string;
  readRulesButtonLabel: string;
  readRulesConfirmedButtonLabel: string;
  verifyButtonLabel: string;
};

const DEFAULTS: VerificationConfig = {
  enabled: true,
  sendWelcomeDm: true,
  sendWelcomePanel: true,
  requireRulesRead: true,
  sendGateAnnouncement: true,
  grantVerifiedRole: true,
  removeRolesOnVerify: true,
  welcomeChannelId: "",
  mainChatChannelId: "",
  rulesChannelId: "",
  verifiedRoleId: "",
  removeOnVerifyRoleIds: [],
  dmTemplate: "Welcome to {{guildName}}.\n\nStart verification in <#{{welcomeChannelId}}>. ",
  panelTitle: "Welcome to {{guildName}}",
  panelDescription: "Read the rules in <#{{rulesChannelId}}> and press verify to continue.",
  panelFooter: "Verification comes first. Onboarding comes after this step.",
  gateAnnouncementTemplate: "Survivor <@{{userId}}> has reached the gates.",
  rulesButtonLabel: "Open Rules",
  readRulesButtonLabel: "I've Read the Survival Code",
  readRulesConfirmedButtonLabel: "Rules Confirmed",
  verifyButtonLabel: "Enter The Safe Zone (18+)",
};

const styles = {
  page: { color: "#ffb3b3", padding: 14, maxWidth: 1240 },
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
    minHeight: 92,
    padding: 10,
    borderRadius: 8,
    border: "1px solid #6f0000",
    background: "#0a0a0a",
    color: "#ffd7d7",
  },
};

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
  } = useGuildEngineEditor<VerificationConfig>("verification", DEFAULTS);

  const textChannels = (channels as GuildChannel[]).filter(
    (channel) => Number(channel?.type) === 0 || Number(channel?.type) === 5 || String(channel?.type || "").toLowerCase().includes("text")
  );

  const toggleRole = (list: string[], id: string) => {
    const set = new Set(list || []);
    if (set.has(id)) set.delete(id);
    else set.add(id);
    return Array.from(set);
  };

  if (!guildId) return <div style={{ color: "#ff8a8a", padding: 20 }}>Missing guildId. Open from /guilds.</div>;
  if (loading) return <div style={{ color: "#ff8a8a", padding: 20 }}>Loading verification...</div>;

  return (
    <div style={styles.page}>
      <h1 style={{ marginTop: 0, color: "#ff3b3b", letterSpacing: "0.08em", textTransform: "uppercase" }}>Verification</h1>
      <p style={{ marginTop: 0 }}>
        Guild: {guildName || guildId}
      </p>
      <div style={{ ...styles.card, borderColor: "#7a2200", background: "rgba(160,40,0,0.12)" }}>
        <strong>Step 1:</strong> this is the rules + welcome gate.
        <div style={{ marginTop: 8, color: "#ffd7a8", lineHeight: 1.6 }}>
          Member joins - sees the welcome/rules message - presses verify - gets the verified access role - then moves on to onboarding only if your guild uses optional ID review. Verification can run by itself.
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
        <h3 style={{ marginTop: 0, color: "#ff4444" }}>Feature toggles</h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 10 }}>
          <label><input type="checkbox" checked={!!cfg.sendWelcomeDm} onChange={(e) => setCfg({ ...cfg, sendWelcomeDm: e.target.checked })} /> Send welcome DM</label>
          <label><input type="checkbox" checked={!!cfg.sendWelcomePanel} onChange={(e) => setCfg({ ...cfg, sendWelcomePanel: e.target.checked })} /> Send welcome panel</label>
          <label><input type="checkbox" checked={!!cfg.requireRulesRead} onChange={(e) => setCfg({ ...cfg, requireRulesRead: e.target.checked })} /> Require rules read before verify</label>
          <label><input type="checkbox" checked={!!cfg.sendGateAnnouncement} onChange={(e) => setCfg({ ...cfg, sendGateAnnouncement: e.target.checked })} /> Send gate announcement</label>
          <label><input type="checkbox" checked={!!cfg.grantVerifiedRole} onChange={(e) => setCfg({ ...cfg, grantVerifiedRole: e.target.checked })} /> Grant verified role</label>
          <label><input type="checkbox" checked={!!cfg.removeRolesOnVerify} onChange={(e) => setCfg({ ...cfg, removeRolesOnVerify: e.target.checked })} /> Remove gate roles on verify</label>
        </div>
      </div>

      <div style={styles.card}>
        <h3 style={{ marginTop: 0, color: "#ff4444" }}>Where the verification step happens</h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))", gap: 10 }}>
          <div>
            <label>Welcome channel</label>
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
            <label>Verified role</label>
            <select style={styles.input} value={cfg.verifiedRoleId || ""} onChange={(e) => setCfg({ ...cfg, verifiedRoleId: e.target.value })}>
              <option value="">Select role</option>
              {(roles as GuildRole[]).map((role) => <option key={role.id} value={role.id}>@{role.name}</option>)}
            </select>
          </div>
        </div>
      </div>

      <div style={styles.card}>
        <h3 style={{ marginTop: 0, color: "#ff4444" }}>What members see</h3>
        <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 10 }}>
          <div>
            <label>DM intro</label>
            <textarea style={styles.area} value={cfg.dmTemplate || ""} onChange={(e) => setCfg({ ...cfg, dmTemplate: e.target.value })} />
          </div>
          <div>
            <label>Verification panel title</label>
            <input style={styles.input} value={cfg.panelTitle || ""} onChange={(e) => setCfg({ ...cfg, panelTitle: e.target.value })} />
          </div>
          <div>
            <label>Verification panel description</label>
            <textarea style={styles.area} value={cfg.panelDescription || ""} onChange={(e) => setCfg({ ...cfg, panelDescription: e.target.value })} />
          </div>
          <div>
            <label>Verification panel footer</label>
            <input style={styles.input} value={cfg.panelFooter || ""} onChange={(e) => setCfg({ ...cfg, panelFooter: e.target.value })} />
          </div>
          <div>
            <label>Gate announcement to staff/log area</label>
            <textarea style={styles.area} value={cfg.gateAnnouncementTemplate || ""} onChange={(e) => setCfg({ ...cfg, gateAnnouncementTemplate: e.target.value })} />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 10 }}>
            <div>
              <label>Rules button label</label>
              <input style={styles.input} value={cfg.rulesButtonLabel || ""} onChange={(e) => setCfg({ ...cfg, rulesButtonLabel: e.target.value })} />
            </div>
            <div>
              <label>Read-rules button label</label>
              <input style={styles.input} value={cfg.readRulesButtonLabel || ""} onChange={(e) => setCfg({ ...cfg, readRulesButtonLabel: e.target.value })} />
            </div>
            <div>
              <label>Read-rules confirmed label</label>
              <input style={styles.input} value={cfg.readRulesConfirmedButtonLabel || ""} onChange={(e) => setCfg({ ...cfg, readRulesConfirmedButtonLabel: e.target.value })} />
            </div>
            <div>
              <label>Verify button label</label>
              <input style={styles.input} value={cfg.verifyButtonLabel || ""} onChange={(e) => setCfg({ ...cfg, verifyButtonLabel: e.target.value })} />
            </div>
          </div>
        </div>
      </div>

      <div style={styles.card}>
        <h3 style={{ marginTop: 0, color: "#ff4444" }}>Verified role cleanup</h3>
        <div style={{ color: "#ffb3b3", fontSize: 12, marginBottom: 10 }}>
          Remove any temporary gate roles automatically once the member receives this guild&apos;s verified role.
        </div>
        <div style={{ maxHeight: 240, overflowY: "auto", border: "1px solid #5a0000", borderRadius: 8, padding: 8 }}>
          {(roles as GuildRole[]).map((role) => (
            <label key={`remove_${role.id}`} style={{ display: "block", marginBottom: 4 }}>
              <input
                type="checkbox"
                checked={(cfg.removeOnVerifyRoleIds || []).includes(role.id)}
                onChange={() => setCfg({ ...cfg, removeOnVerifyRoleIds: toggleRole(cfg.removeOnVerifyRoleIds || [], role.id) })}
              />{" "}
              @{role.name}
            </label>
          ))}
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
