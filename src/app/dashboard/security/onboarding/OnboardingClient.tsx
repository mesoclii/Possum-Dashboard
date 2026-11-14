"use client";

import ConfigJsonEditor from "@/components/possum/ConfigJsonEditor";
import EngineInsights from "@/components/possum/EngineInsights";
import { useGuildEngineEditor } from "@/components/possum/useGuildEngineEditor";

type GuildChannel = { id: string; name: string; type?: number | string };
type GuildRole = { id: string; name: string };

type OnboardingConfig = {
  enabled: boolean;
  idFlowEnabled: boolean;
  sendPostVerifyMessage: boolean;
  sendTicketTranscript: boolean;
  removeRolesOnVerify: boolean;
  welcomeChannelId: string;
  mainChatChannelId: string;
  rulesChannelId: string;
  verifiedRoleId: string;
  dmTemplate: string;
  panelTitle: string;
  panelDescription: string;
  panelFooter: string;
  gateAnnouncementTemplate: string;
  idChannelId: string;
  ticketCategoryId: string;
  transcriptChannelId: string;
  logChannelId: string;
  declineRoleId: string;
  staffRoleIds: string[];
  removeOnVerifyRoleIds: string[];
  idTimeoutMinutes: number;
  hostingLegacyChannelId: string;
  hostingEnhancedChannelId: string;
  staffIntroChannelId: string;
  selfRolesChannelId: string;
  botGuideChannelId: string;
  updatesChannelId: string;
  funChannelId: string;
  funCategoryId: string;
  subscriptionChannelId: string;
  idPanelTitle: string;
  idPanelDescription: string;
  idPanelContent: string;
  postVerifyTemplate: string;
  postVerifyAutoDeleteMinutes: number;
  sendJoinWelcome: boolean;
  welcomeMessageChannelId: string;
  welcomeMessageTemplate: string;
  joinWelcomeAutoDeleteMinutes: number;
  postVerifyChannelId: string;
  ticketPanelTitle: string;
  ticketPanelDescription: string;
  ticketPanelFooter: string;
  ticketPanelContent: string;
  idTicketButtonLabel: string;
  idReadyButtonLabel: string;
  idDeclineButtonLabel: string;
  ticketAcceptButtonLabel: string;
  ticketVerifiedButtonLabel: string;
  ticketCloseButtonLabel: string;
  autoKickOnDecline: boolean;
  autoKickOnTimeout: boolean;
  declineKickReason: string;
  timeoutKickReason: string;
  declineReplyTemplate: string;
};

const DEFAULTS: OnboardingConfig = {
  enabled: true,
  idFlowEnabled: true,
  sendPostVerifyMessage: true,
  sendTicketTranscript: true,
  removeRolesOnVerify: true,
  welcomeChannelId: "",
  mainChatChannelId: "",
  rulesChannelId: "",
  verifiedRoleId: "",
  dmTemplate: "Welcome to {{guildName}}.\n\nStart onboarding in <#{{welcomeChannelId}}>.",
  panelTitle: "Welcome to {{guildName}}",
  panelDescription: "Read the rules in <#{{rulesChannelId}}> and confirm below to continue.",
  panelFooter: "Complete onboarding to unlock the server.",
  gateAnnouncementTemplate: "Survivor <@{{userId}}> has reached the gates.",
  idChannelId: "",
  ticketCategoryId: "",
  transcriptChannelId: "",
  logChannelId: "",
  declineRoleId: "",
  staffRoleIds: [],
  removeOnVerifyRoleIds: [],
  idTimeoutMinutes: 30,
  hostingLegacyChannelId: "",
  hostingEnhancedChannelId: "",
  staffIntroChannelId: "",
  selfRolesChannelId: "",
  botGuideChannelId: "",
  updatesChannelId: "",
  funChannelId: "",
  funCategoryId: "",
  subscriptionChannelId: "",
  idPanelTitle: "ID Verification - Final Gate",
  idPanelDescription: "<@{{userId}}> choose how you proceed.\n\nThose who refuse will be removed.",
  idPanelContent: "Survivor <@{{userId}}>",
  postVerifyTemplate: "<@{{userId}}> is now verified. Welcome to {{guildName}}.",
  postVerifyAutoDeleteMinutes: 0,
  sendJoinWelcome: true,
  welcomeMessageChannelId: "",
  welcomeMessageTemplate:
    "Welcome to {{guildName}}, {{memberMention}}.\n\nYou are survivor #{{memberCount}}. Read {{rulesChannel}}, then verify to enter.",
  joinWelcomeAutoDeleteMinutes: 0,
  postVerifyChannelId: "",
  ticketPanelTitle: "ID Verification",
  ticketPanelDescription: "Upload your ID here. Staff will review it and verify you.\n\nDeclining ends the admission process.",
  ticketPanelFooter: "This ticket is private.",
  ticketPanelContent: "Survivor <@{{userId}}>",
  idTicketButtonLabel: "Open ID Verification Ticket",
  idReadyButtonLabel: "I'm Ready To Submit ID",
  idDeclineButtonLabel: "I'm Leaving The Safe Zone",
  ticketAcceptButtonLabel: "Accept Ticket",
  ticketVerifiedButtonLabel: "ID Verified",
  ticketCloseButtonLabel: "Close Ticket",
  autoKickOnDecline: true,
  autoKickOnTimeout: true,
  declineKickReason: "Declined ID verification",
  timeoutKickReason: "ID submission timeout",
  declineReplyTemplate: "You declined ID verification.",
};

const styles = {
  page: { color: "#ffb3b3", padding: 14, maxWidth: 1320 },
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

function toggleRole(list: string[], id: string) {
  const set = new Set(list || []);
  if (set.has(id)) set.delete(id);
  else set.add(id);
  return Array.from(set);
}

export default function OnboardingClient() {
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
  } = useGuildEngineEditor<OnboardingConfig>("onboarding", DEFAULTS);

  const textChannels = (channels as GuildChannel[]).filter(
    (channel) => Number(channel?.type) === 0 || Number(channel?.type) === 5 || String(channel?.type || "").toLowerCase().includes("text")
  );
  const categoryChannels = (channels as GuildChannel[]).filter(
    (channel) => Number(channel?.type) === 4 || String(channel?.type || "").toLowerCase().includes("category")
  );

  if (!guildId) return <div style={{ color: "#ff8a8a", padding: 20 }}>Missing guildId. Open from /guilds.</div>;
  if (loading) return <div style={{ color: "#ff8a8a", padding: 20 }}>Loading onboarding...</div>;

  return (
    <div style={styles.page}>
      <h1 style={{ marginTop: 0, color: "#ff3b3b", letterSpacing: "0.08em", textTransform: "uppercase" }}>Onboarding</h1>
      <p style={{ marginTop: 0 }}>Guild: {guildName || guildId}</p>
      <div style={{ ...styles.card, borderColor: "#7a2200", background: "rgba(160,40,0,0.12)" }}>
        <strong>Step 2:</strong> this is the ID request / final-entry flow.
        <div style={{ marginTop: 8, color: "#ffd7a8", lineHeight: 1.6 }}>
          Member verifies first. After that, onboarding handles the optional ID ticket flow, staff review, post-verify cleanup, and the follow-up message they should receive after the verified role lands.
          <div style={{ marginTop: 8 }}>
            If your guild does not want ID review, leave the ID request channel/category blank. Members will still get the verified-role handoff and the post-verified message.
          </div>
        </div>
      </div>
      {message ? <div style={{ color: "#ffb3f0", marginBottom: 8 }}>{message}</div> : null}

      <EngineInsights summary={summary} details={details} />

      <div style={styles.card}>
        <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <label><input type="checkbox" checked={!!cfg.enabled} onChange={(e) => setCfg({ ...cfg, enabled: e.target.checked })} /> Onboarding enabled</label>
          <button onClick={() => void reload()} disabled={saving} style={{ ...styles.input, width: "auto", cursor: "pointer", fontWeight: 800 }}>
            Refresh Live Config
          </button>
        </div>
      </div>

      <div style={styles.card}>
        <h3 style={{ marginTop: 0, color: "#ff4444" }}>Feature toggles</h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 10 }}>
          <label><input type="checkbox" checked={!!cfg.idFlowEnabled} onChange={(e) => setCfg({ ...cfg, idFlowEnabled: e.target.checked })} /> Optional ID flow enabled</label>
          <label><input type="checkbox" checked={!!cfg.sendPostVerifyMessage} onChange={(e) => setCfg({ ...cfg, sendPostVerifyMessage: e.target.checked })} /> Send post-verified message</label>
          <label><input type="checkbox" checked={!!cfg.sendTicketTranscript} onChange={(e) => setCfg({ ...cfg, sendTicketTranscript: e.target.checked })} /> Send ticket transcript</label>
          <label><input type="checkbox" checked={!!cfg.removeRolesOnVerify} onChange={(e) => setCfg({ ...cfg, removeRolesOnVerify: e.target.checked })} /> Remove configured roles after final verification</label>
        </div>
      </div>

      <div style={styles.card}>
        <h3 style={{ marginTop: 0, color: "#ff4444" }}>Join welcome (hello page)</h3>
        <div style={{ color: "#ffd7a8", marginBottom: 10, fontSize: 13 }}>
          A plain welcome posted the moment someone joins. It is separate from the gate message: no buttons, no
          admission logic. Tokens: {"{{guildName}}"}, {"{{memberMention}}"}, {"{{memberCount}}"}, {"{{rulesChannel}}"}.
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))", gap: 10 }}>
          <label><input type="checkbox" checked={!!cfg.sendJoinWelcome} onChange={(e) => setCfg({ ...cfg, sendJoinWelcome: e.target.checked })} /> Send the join welcome</label>
          <div>
            <label>Hello page channel</label>
            <select style={styles.input} value={cfg.welcomeMessageChannelId || ""} onChange={(e) => setCfg({ ...cfg, welcomeMessageChannelId: e.target.value })}>
              <option value="">Use the welcome channel</option>
              {textChannels.map((channel) => <option key={channel.id} value={channel.id}>#{channel.name}</option>)}
            </select>
          </div>
          <div>
            <label>Auto-delete minutes (0 = keep)</label>
            <input style={styles.input} type="number" min={0} max={10080} value={cfg.joinWelcomeAutoDeleteMinutes || 0} onChange={(e) => setCfg({ ...cfg, joinWelcomeAutoDeleteMinutes: Number(e.target.value || 0) })} />
          </div>
        </div>
        <div style={{ marginTop: 10 }}>
          <label>Join welcome message</label>
          <textarea style={styles.area} value={cfg.welcomeMessageTemplate || ""} onChange={(e) => setCfg({ ...cfg, welcomeMessageTemplate: e.target.value })} />
        </div>
      </div>

      <div style={styles.card}>
        <h3 style={{ marginTop: 0, color: "#ff4444" }}>Welcome routing and gate copy</h3>
        <div style={{ color: "#ffd7a8", marginBottom: 10, fontSize: 13 }}>
          The current welcome values live on the Verification page. These are the onboarding engine&apos;s own fallbacks, used when verification has no value set.
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))", gap: 10 }}>
          <div>
            <label>Welcome channel</label>
            <select style={styles.input} value={cfg.welcomeChannelId || ""} onChange={(e) => setCfg({ ...cfg, welcomeChannelId: e.target.value })}>
              <option value="">Not set</option>
              {textChannels.map((channel) => <option key={channel.id} value={channel.id}>#{channel.name}</option>)}
            </select>
          </div>
          <div>
            <label>Rules channel</label>
            <select style={styles.input} value={cfg.rulesChannelId || ""} onChange={(e) => setCfg({ ...cfg, rulesChannelId: e.target.value })}>
              <option value="">Not set</option>
              {textChannels.map((channel) => <option key={channel.id} value={channel.id}>#{channel.name}</option>)}
            </select>
          </div>
          <div>
            <label>Main chat channel</label>
            <select style={styles.input} value={cfg.mainChatChannelId || ""} onChange={(e) => setCfg({ ...cfg, mainChatChannelId: e.target.value })}>
              <option value="">Not set</option>
              {textChannels.map((channel) => <option key={channel.id} value={channel.id}>#{channel.name}</option>)}
            </select>
          </div>
          <div>
            <label>Verified role</label>
            <select style={styles.input} value={cfg.verifiedRoleId || ""} onChange={(e) => setCfg({ ...cfg, verifiedRoleId: e.target.value })}>
              <option value="">Not set</option>
              {(roles as GuildRole[]).map((role) => <option key={role.id} value={role.id}>@{role.name}</option>)}
            </select>
          </div>
        </div>
        <div style={{ display: "grid", gap: 10, marginTop: 10 }}>
          <div>
            <label>Welcome DM</label>
            <textarea style={styles.area} value={cfg.dmTemplate || ""} onChange={(e) => setCfg({ ...cfg, dmTemplate: e.target.value })} />
          </div>
          <div>
            <label>Gate panel title</label>
            <input style={styles.input} value={cfg.panelTitle || ""} onChange={(e) => setCfg({ ...cfg, panelTitle: e.target.value })} />
          </div>
          <div>
            <label>Gate panel description</label>
            <textarea style={styles.area} value={cfg.panelDescription || ""} onChange={(e) => setCfg({ ...cfg, panelDescription: e.target.value })} />
          </div>
          <div>
            <label>Gate panel footer</label>
            <input style={styles.input} value={cfg.panelFooter || ""} onChange={(e) => setCfg({ ...cfg, panelFooter: e.target.value })} />
          </div>
          <div>
            <label>Arrival announcement</label>
            <textarea style={styles.area} value={cfg.gateAnnouncementTemplate || ""} onChange={(e) => setCfg({ ...cfg, gateAnnouncementTemplate: e.target.value })} />
          </div>
        </div>
      </div>

      <div style={styles.card}>
        <h3 style={{ marginTop: 0, color: "#ff4444" }}>ID request routing</h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))", gap: 10 }}>
          <div>
            <label>ID request channel</label>
            <select style={styles.input} value={cfg.idChannelId || ""} onChange={(e) => setCfg({ ...cfg, idChannelId: e.target.value })}>
              <option value="">Select channel</option>
              {textChannels.map((channel) => <option key={channel.id} value={channel.id}>#{channel.name}</option>)}
            </select>
          </div>
          <div>
            <label>Ticket category</label>
            <select style={styles.input} value={cfg.ticketCategoryId || ""} onChange={(e) => setCfg({ ...cfg, ticketCategoryId: e.target.value })}>
              <option value="">Select category</option>
              {categoryChannels.map((channel) => <option key={channel.id} value={channel.id}>{channel.name}</option>)}
            </select>
          </div>
          <div>
            <label>Transcript channel</label>
            <select style={styles.input} value={cfg.transcriptChannelId || ""} onChange={(e) => setCfg({ ...cfg, transcriptChannelId: e.target.value })}>
              <option value="">Select channel</option>
              {textChannels.map((channel) => <option key={channel.id} value={channel.id}>#{channel.name}</option>)}
            </select>
          </div>
          <div>
            <label>Onboarding log channel</label>
            <select style={styles.input} value={cfg.logChannelId || ""} onChange={(e) => setCfg({ ...cfg, logChannelId: e.target.value })}>
              <option value="">Select channel</option>
              {textChannels.map((channel) => <option key={channel.id} value={channel.id}>#{channel.name}</option>)}
            </select>
          </div>
          <div>
            <label>Decline role</label>
            <select style={styles.input} value={cfg.declineRoleId || ""} onChange={(e) => setCfg({ ...cfg, declineRoleId: e.target.value })}>
              <option value="">Select role</option>
              {(roles as GuildRole[]).map((role) => <option key={role.id} value={role.id}>@{role.name}</option>)}
            </select>
          </div>
          <div>
            <label>ID timeout (minutes)</label>
            <input style={styles.input} type="number" value={cfg.idTimeoutMinutes || 0} onChange={(e) => setCfg({ ...cfg, idTimeoutMinutes: Number(e.target.value || 0) })} />
          </div>
        </div>
      </div>

      <div style={styles.card}>
        <h3 style={{ marginTop: 0, color: "#ff4444" }}>Staff access and cleanup</h3>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div>
            <label>Staff roles</label>
            <div style={{ maxHeight: 220, overflowY: "auto", border: "1px solid #5a0000", borderRadius: 8, padding: 8 }}>
              {(roles as GuildRole[]).map((role) => (
                <label key={`staff_${role.id}`} style={{ display: "block", marginBottom: 4 }}>
                  <input
                    type="checkbox"
                    checked={(cfg.staffRoleIds || []).includes(role.id)}
                    onChange={() => setCfg({ ...cfg, staffRoleIds: toggleRole(cfg.staffRoleIds || [], role.id) })}
                  />{" "}
                  @{role.name}
                </label>
              ))}
            </div>
          </div>
          <div>
            <label>Remove these roles after verification</label>
            <div style={{ maxHeight: 220, overflowY: "auto", border: "1px solid #5a0000", borderRadius: 8, padding: 8 }}>
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
        </div>
      </div>

      <div style={styles.card}>
        <h3 style={{ marginTop: 0, color: "#ff4444" }}>Entry ticket, post-verify and refusal</h3>
        <div style={{ color: "#ffd7a8", marginBottom: 10, fontSize: 13 }}>
          This is the message the member gets inside their new ticket, the three staff buttons on it, and where the
          verified message lands. Blank copy falls back to the legacy ID panel values.
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 10 }}>
          <div>
            <label>Entry ticket title</label>
            <input style={styles.input} value={cfg.ticketPanelTitle || ""} placeholder={cfg.idPanelTitle || "ID Verification"} onChange={(e) => setCfg({ ...cfg, ticketPanelTitle: e.target.value })} />
          </div>
          <div>
            <label>Entry ticket description</label>
            <textarea style={styles.area} value={cfg.ticketPanelDescription || ""} placeholder={cfg.idPanelDescription || "Upload your ID here..."} onChange={(e) => setCfg({ ...cfg, ticketPanelDescription: e.target.value })} />
          </div>
          <div>
            <label>Entry ticket header line</label>
            <textarea style={styles.area} value={cfg.ticketPanelContent || ""} placeholder={cfg.idPanelContent || "Survivor <@{{userId}}>"} onChange={(e) => setCfg({ ...cfg, ticketPanelContent: e.target.value })} />
          </div>
          <div>
            <label>Entry ticket footer</label>
            <input style={styles.input} value={cfg.ticketPanelFooter || ""} placeholder="This ticket is private." onChange={(e) => setCfg({ ...cfg, ticketPanelFooter: e.target.value })} />
          </div>
          <div>
            <label>Post-verify message channel</label>
            <select style={styles.input} value={cfg.postVerifyChannelId || ""} onChange={(e) => setCfg({ ...cfg, postVerifyChannelId: e.target.value })}>
              <option value="">Use the main chat channel</option>
              {textChannels.map((channel) => <option key={channel.id} value={channel.id}>#{channel.name}</option>)}
            </select>
          </div>
          <div>
            <label>Post-verify message</label>
            <textarea style={styles.area} value={cfg.postVerifyTemplate || ""} onChange={(e) => setCfg({ ...cfg, postVerifyTemplate: e.target.value })} />
          </div>
          <div>
            <label>Post-verify auto-delete minutes (0 = keep)</label>
            <input
              style={styles.input}
              type="number"
              min={0}
              max={10080}
              value={cfg.postVerifyAutoDeleteMinutes || 0}
              onChange={(e) => setCfg({ ...cfg, postVerifyAutoDeleteMinutes: Number(e.target.value || 0) })}
            />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 10 }}>
            <div>
              <label>Post-verify ID ticket button</label>
              <input style={styles.input} value={cfg.idTicketButtonLabel || ""} onChange={(e) => setCfg({ ...cfg, idTicketButtonLabel: e.target.value })} />
            </div>
            <div>
              <label>ID ready button</label>
              <input style={styles.input} value={cfg.idReadyButtonLabel || ""} onChange={(e) => setCfg({ ...cfg, idReadyButtonLabel: e.target.value })} />
            </div>
            <div>
              <label>ID decline button</label>
              <input style={styles.input} value={cfg.idDeclineButtonLabel || ""} onChange={(e) => setCfg({ ...cfg, idDeclineButtonLabel: e.target.value })} />
            </div>
            <div>
              <label>Staff accept ticket button</label>
              <input style={styles.input} value={cfg.ticketAcceptButtonLabel || ""} onChange={(e) => setCfg({ ...cfg, ticketAcceptButtonLabel: e.target.value })} />
            </div>
            <div>
              <label>Staff verified button</label>
              <input style={styles.input} value={cfg.ticketVerifiedButtonLabel || ""} onChange={(e) => setCfg({ ...cfg, ticketVerifiedButtonLabel: e.target.value })} />
            </div>
            <div>
              <label>Ticket close button</label>
              <input style={styles.input} value={cfg.ticketCloseButtonLabel || ""} onChange={(e) => setCfg({ ...cfg, ticketCloseButtonLabel: e.target.value })} />
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <label><input type="checkbox" checked={!!cfg.autoKickOnDecline} onChange={(e) => setCfg({ ...cfg, autoKickOnDecline: e.target.checked })} /> Auto-remove on decline</label>
            <label><input type="checkbox" checked={!!cfg.autoKickOnTimeout} onChange={(e) => setCfg({ ...cfg, autoKickOnTimeout: e.target.checked })} /> Auto-remove on timeout</label>
          </div>
          <div>
            <label>Decline reason</label>
            <input style={styles.input} value={cfg.declineKickReason || ""} onChange={(e) => setCfg({ ...cfg, declineKickReason: e.target.value })} />
          </div>
          <div>
            <label>Timeout reason</label>
            <input style={styles.input} value={cfg.timeoutKickReason || ""} onChange={(e) => setCfg({ ...cfg, timeoutKickReason: e.target.value })} />
          </div>
          <div>
            <label>Decline reply message</label>
            <textarea style={styles.area} value={cfg.declineReplyTemplate || ""} onChange={(e) => setCfg({ ...cfg, declineReplyTemplate: e.target.value })} />
          </div>
        </div>
      </div>

      <div style={styles.card}>
        <h3 style={{ marginTop: 0, color: "#ff4444" }}>Post-verify destination channels</h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 10 }}>
          {[
            ["hostingLegacyChannelId", "Hosting legacy"],
            ["hostingEnhancedChannelId", "Hosting enhanced"],
            ["staffIntroChannelId", "Staff intro"],
            ["selfRolesChannelId", "Self roles"],
            ["botGuideChannelId", "Bot guide"],
            ["updatesChannelId", "Updates"],
            ["subscriptionChannelId", "Subscriptions"],
          ].map(([key, label]) => (
            <div key={key}>
              <label>{label}</label>
              <select style={styles.input} value={(cfg as any)[key] || ""} onChange={(e) => setCfg({ ...cfg, [key]: e.target.value } as OnboardingConfig)}>
                <option value="">Select channel</option>
                {textChannels.map((channel) => <option key={channel.id} value={channel.id}>#{channel.name}</option>)}
              </select>
            </div>
          ))}
          <div>
            <label>Fun channel</label>
            <select style={styles.input} value={cfg.funChannelId || ""} onChange={(e) => setCfg({ ...cfg, funChannelId: e.target.value })}>
              <option value="">Select channel</option>
              {textChannels.map((channel) => <option key={channel.id} value={channel.id}>#{channel.name}</option>)}
            </select>
          </div>
          <div>
            <label>Fun category</label>
            <select style={styles.input} value={cfg.funCategoryId || ""} onChange={(e) => setCfg({ ...cfg, funCategoryId: e.target.value })}>
              <option value="">Select category</option>
              {categoryChannels.map((channel) => <option key={channel.id} value={channel.id}>{channel.name}</option>)}
            </select>
          </div>
        </div>
      </div>

      <ConfigJsonEditor
        title="Advanced Onboarding Config"
        value={cfg}
        disabled={saving}
        onApply={(next) => setCfg({ ...DEFAULTS, ...(next as OnboardingConfig) })}
      />

      <button onClick={() => void save()} disabled={saving} style={{ ...styles.input, width: "auto", cursor: "pointer", fontWeight: 900 }}>
        {saving ? "Saving..." : "Save Onboarding"}
      </button>
    </div>
  );
}
