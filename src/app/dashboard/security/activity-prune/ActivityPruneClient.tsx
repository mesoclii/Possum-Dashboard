"use client";

import { useMemo } from "react";
import type { CSSProperties } from "react";
import EngineInsights from "@/components/possum/EngineInsights";
import { useGuildEngineEditor } from "@/components/possum/useGuildEngineEditor";

type ActivityPruneConfig = {
  enabled: boolean;
  autoKickEnabled: boolean;
  dryRunOnly: boolean;
  inactivityDays: number;
  minimumMembershipDays: number;
  sweepIntervalHours: number;
  previewLimit: number;
  warningBeforeKickEnabled: boolean;
  warningGraceHours: number;
  requireNoRoles: boolean;
  ignoreBoosters: boolean;
  countMessageActivity: boolean;
  countInteractionActivity: boolean;
  countReactionActivity: boolean;
  countVoiceActivity: boolean;
  scanMessageHistoryOnSweep: boolean;
  messageWindowDays: number;
  minimumMessagesInWindow: number;
  messageHistoryScanPerChannelLimit: number;
  sendWarningDm: boolean;
  warningPublicEnabled: boolean;
  kickAnnouncementEnabled: boolean;
  skipKickIfWarningFailed: boolean;
  removeWarningRoleOnActivity: boolean;
  removeWarningRoleOnKick: boolean;
  exemptRoleIds: string[];
  exemptUserIds: string[];
  warningRoleId: string;
  logChannelId: string;
  announceChannelId: string;
  warningChannelId: string;
  kickChannelId: string;
  kickReasonTemplate: string;
  warningDmTemplate: string;
  warningPublicTemplate: string;
  kickAnnouncementTemplate: string;
  notes: string;
};

const DEFAULTS: ActivityPruneConfig = {
  enabled: false,
  autoKickEnabled: false,
  dryRunOnly: true,
  inactivityDays: 30,
  minimumMembershipDays: 14,
  sweepIntervalHours: 24,
  previewLimit: 25,
  warningBeforeKickEnabled: true,
  warningGraceHours: 72,
  requireNoRoles: false,
  ignoreBoosters: true,
  countMessageActivity: true,
  countInteractionActivity: true,
  countReactionActivity: true,
  countVoiceActivity: true,
  scanMessageHistoryOnSweep: true,
  messageWindowDays: 30,
  minimumMessagesInWindow: 0,
  messageHistoryScanPerChannelLimit: 200,
  sendWarningDm: true,
  warningPublicEnabled: false,
  kickAnnouncementEnabled: false,
  skipKickIfWarningFailed: true,
  removeWarningRoleOnActivity: true,
  removeWarningRoleOnKick: true,
  exemptRoleIds: [],
  exemptUserIds: [],
  warningRoleId: "",
  logChannelId: "",
  announceChannelId: "",
  warningChannelId: "",
  kickChannelId: "",
  kickReasonTemplate: "Inactive for {inactiveDays} day(s) with no tracked server activity.",
  warningDmTemplate: "Hey {displayName}, you look inactive in {guildName}.\n\nWe will remove you in {graceHours} hour(s) if we still do not see activity from you.\nLast tracked activity: {lastSeenAt}\nCurrent inactivity: {inactiveDays} day(s)\n\nSend a message, react, press a bot button, or join voice to stay.",
  warningPublicTemplate: "{user} has been marked inactive. They have {graceHours} hour(s) to become active again before removal.",
  kickAnnouncementTemplate: "{user} was removed for inactivity after {inactiveDays} day(s) without tracked server activity.",
  notes: "",
};

const shell: CSSProperties = { color: "#ffd0d0", padding: 18, maxWidth: 1440 };
const card: CSSProperties = {
  border: "1px solid #5f0000",
  borderRadius: 14,
  padding: 16,
  background: "linear-gradient(180deg, rgba(120,0,0,0.12), rgba(0,0,0,0.72))",
  marginBottom: 14,
};
const input: CSSProperties = {
  width: "100%",
  background: "#0a0a0a",
  color: "#ffd0d0",
  border: "1px solid #7f0000",
  borderRadius: 10,
  padding: "10px 12px",
};
const label: CSSProperties = {
  color: "#ffb9b9",
  fontSize: 12,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  marginBottom: 6,
};

function parseUserList(value: string) {
  return Array.from(new Set(String(value || "").match(/\d{16,20}/g) || []));
}

function toggle(list: string[], id: string) {
  const next = new Set(list || []);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  return Array.from(next);
}

function sectionRows(entries: any[]) {
  return entries.length ? entries : [];
}

export default function ActivityPruneClient() {
  const {
    guildId,
    guildName,
    config,
    setConfig,
    channels,
    roles,
    summary,
    details,
    loading,
    saving,
    message,
    save,
    runAction,
  } = useGuildEngineEditor<ActivityPruneConfig>("activityPrune", DEFAULTS);

  const cfg = useMemo(() => ({ ...DEFAULTS, ...(config || {}) }), [config]);
  const textChannels = useMemo(
    () => channels.filter((c) => Number(c?.type) === 0 || Number(c?.type) === 5 || String(c?.type || "").toLowerCase().includes("text")),
    [channels]
  );
  const candidates = useMemo(() => sectionRows(Array.isArray((details as any)?.candidates) ? (details as any).candidates : []), [details]);
  const pendingGrace = useMemo(() => sectionRows(Array.isArray((details as any)?.pendingGrace) ? (details as any).pendingGrace : []), [details]);
  const trackedMembers = useMemo(() => sectionRows(Array.isArray((details as any)?.trackedMembers) ? (details as any).trackedMembers : []), [details]);
  const recentActions = useMemo(() => sectionRows(Array.isArray((details as any)?.recentActions) ? (details as any).recentActions : []), [details]);
  const exemptUserText = useMemo(() => (cfg.exemptUserIds || []).join(", "), [cfg.exemptUserIds]);

  function patch(next: Partial<ActivityPruneConfig>) {
    setConfig((prev) => ({ ...(prev || cfg), ...next }));
  }

  async function runConfiguredAction(action: "previewSweep" | "runSweep" | "clearWarnings") {
    if (action === "runSweep" && !window.confirm("Run a LIVE sweep now? Members past their grace window will be kicked.")) return;
    const saved = await save();
    if (!saved) return;
    if (action === "clearWarnings") {
      await runAction("clearWarnings");
      return;
    }
    await runAction(action, { limit: cfg.previewLimit });
  }

  if (!guildId) {
    return <div style={{ ...shell, color: "#ff8080" }}>Missing guildId. Open from /guilds first.</div>;
  }

  return (
    <div style={shell}>
      <h1 style={{ marginTop: 0, color: "#ff4d4d", textTransform: "uppercase", letterSpacing: "0.1em" }}>Activity Prune Studio</h1>
      <div style={{ color: "#ff9c9c", marginBottom: 12 }}>Guild: {guildName || guildId}</div>
      <div style={{ color: "#ffb6b6", marginBottom: 14, lineHeight: 1.6 }}>
        This is the deeper inactivity engine: tracked activity signals, warning DM flow, grace windows, warning roles,
        custom public messages, and live auto-kick sweeps that are much stronger than Discord prune.
      </div>
      <div style={{ color: "#ffbdbd", marginBottom: 12, lineHeight: 1.6 }}>
        Tokens: <code>{"{user}"}</code>, <code>{"{displayName}"}</code>, <code>{"{username}"}</code>, <code>{"{guildName}"}</code>, <code>{"{inactiveDays}"}</code>, <code>{"{membershipDays}"}</code>, <code>{"{lastSeenAt}"}</code>, <code>{"{graceHours}"}</code>, <code>{"{warningExpiresAt}"}</code>, <code>{"{kickReason}"}</code>
      </div>
      {message ? <div style={{ marginBottom: 10, color: "#ffb3f0" }}>{message}</div> : null}
      {loading ? <div style={card}>Loading inactivity prune engine...</div> : null}

      {!loading ? (
        <>
          <EngineInsights summary={summary} details={details} showDetails />

          <section style={card}>
            <div style={{ ...label, marginBottom: 10 }}>Core Controls</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 14 }}>
              <label style={{ color: "#ffdcdc", fontWeight: 700 }}><input type="checkbox" checked={cfg.enabled} onChange={(e) => patch({ enabled: e.target.checked })} /> Engine enabled</label>
              <label style={{ color: "#ffdcdc", fontWeight: 700 }}><input type="checkbox" checked={cfg.autoKickEnabled} onChange={(e) => patch({ autoKickEnabled: e.target.checked })} /> Auto kick enabled</label>
              <label style={{ color: "#ffdcdc", fontWeight: 700 }}><input type="checkbox" checked={cfg.dryRunOnly} onChange={(e) => patch({ dryRunOnly: e.target.checked })} /> Dry run only</label>
              <label style={{ color: "#ffdcdc", fontWeight: 700 }}><input type="checkbox" checked={cfg.warningBeforeKickEnabled} onChange={(e) => patch({ warningBeforeKickEnabled: e.target.checked })} /> Warn before kick</label>
              <label style={{ color: "#ffdcdc", fontWeight: 700 }}><input type="checkbox" checked={cfg.requireNoRoles} onChange={(e) => patch({ requireNoRoles: e.target.checked })} /> Only target members with no extra roles</label>
              <label style={{ color: "#ffdcdc", fontWeight: 700 }}><input type="checkbox" checked={cfg.ignoreBoosters} onChange={(e) => patch({ ignoreBoosters: e.target.checked })} /> Ignore boosters</label>
            </div>
          </section>

          <section style={card}>
            <div style={{ ...label, marginBottom: 10 }}>Thresholds</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 14 }}>
              <div><div style={label}>Inactive Days Before Action</div><input style={input} type="number" value={cfg.inactivityDays} onChange={(e) => patch({ inactivityDays: Number(e.target.value || 0) })} /></div>
              <div><div style={label}>Minimum Membership Days</div><input style={input} type="number" value={cfg.minimumMembershipDays} onChange={(e) => patch({ minimumMembershipDays: Number(e.target.value || 0) })} /></div>
              <div><div style={label}>Sweep Interval Hours</div><input style={input} type="number" value={cfg.sweepIntervalHours} onChange={(e) => patch({ sweepIntervalHours: Number(e.target.value || 0) })} /></div>
              <div><div style={label}>Preview Limit</div><input style={input} type="number" value={cfg.previewLimit} onChange={(e) => patch({ previewLimit: Number(e.target.value || 0) })} /></div>
              <div><div style={label}>Warning Grace Hours</div><input style={input} type="number" value={cfg.warningGraceHours} onChange={(e) => patch({ warningGraceHours: Number(e.target.value || 0) })} /></div>
              <div><div style={label}>Message Window Days</div><input style={input} type="number" value={cfg.messageWindowDays} onChange={(e) => patch({ messageWindowDays: Number(e.target.value || 0) })} /></div>
              <div><div style={label}>Minimum Messages In Window</div><input style={input} type="number" value={cfg.minimumMessagesInWindow} onChange={(e) => patch({ minimumMessagesInWindow: Number(e.target.value || 0) })} /></div>
              <div><div style={label}>History Scan Limit Per Channel</div><input style={input} type="number" value={cfg.messageHistoryScanPerChannelLimit} onChange={(e) => patch({ messageHistoryScanPerChannelLimit: Number(e.target.value || 0) })} /></div>
            </div>
          </section>

          <section style={card}>
            <div style={{ ...label, marginBottom: 10 }}>Tracked Activity Signals</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 14 }}>
              <label style={{ color: "#ffdcdc", fontWeight: 700 }}><input type="checkbox" checked={cfg.countMessageActivity} onChange={(e) => patch({ countMessageActivity: e.target.checked })} /> Count message activity</label>
              <label style={{ color: "#ffdcdc", fontWeight: 700 }}><input type="checkbox" checked={cfg.countInteractionActivity} onChange={(e) => patch({ countInteractionActivity: e.target.checked })} /> Count button/slash activity</label>
              <label style={{ color: "#ffdcdc", fontWeight: 700 }}><input type="checkbox" checked={cfg.countReactionActivity} onChange={(e) => patch({ countReactionActivity: e.target.checked })} /> Count reaction activity</label>
              <label style={{ color: "#ffdcdc", fontWeight: 700 }}><input type="checkbox" checked={cfg.countVoiceActivity} onChange={(e) => patch({ countVoiceActivity: e.target.checked })} /> Count voice activity</label>
              <label style={{ color: "#ffdcdc", fontWeight: 700 }}><input type="checkbox" checked={cfg.scanMessageHistoryOnSweep} onChange={(e) => patch({ scanMessageHistoryOnSweep: e.target.checked })} /> Scan recent message history during sweeps</label>
            </div>
            <div style={{ color: "#ffb3b3", marginTop: 10, lineHeight: 1.6 }}>
              This backfills recent speakers the live tracker may have missed and can enforce a minimum message count in the configured message window.
            </div>
          </section>

          <section style={card}>
            <div style={{ ...label, marginBottom: 10 }}>Warning Flow</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))", gap: 14 }}>
              <label style={{ color: "#ffdcdc", fontWeight: 700 }}><input type="checkbox" checked={cfg.sendWarningDm} onChange={(e) => patch({ sendWarningDm: e.target.checked })} /> Send warning DM</label>
              <label style={{ color: "#ffdcdc", fontWeight: 700 }}><input type="checkbox" checked={cfg.warningPublicEnabled} onChange={(e) => patch({ warningPublicEnabled: e.target.checked })} /> Send public warning post</label>
              <label style={{ color: "#ffdcdc", fontWeight: 700 }}><input type="checkbox" checked={cfg.kickAnnouncementEnabled} onChange={(e) => patch({ kickAnnouncementEnabled: e.target.checked })} /> Send kick announcement post</label>
              <label style={{ color: "#ffdcdc", fontWeight: 700 }}><input type="checkbox" checked={cfg.skipKickIfWarningFailed} onChange={(e) => patch({ skipKickIfWarningFailed: e.target.checked })} /> Skip kick if warning delivery fails</label>
              <label style={{ color: "#ffdcdc", fontWeight: 700 }}><input type="checkbox" checked={cfg.removeWarningRoleOnActivity} onChange={(e) => patch({ removeWarningRoleOnActivity: e.target.checked })} /> Remove warning role on activity</label>
              <label style={{ color: "#ffdcdc", fontWeight: 700 }}><input type="checkbox" checked={cfg.removeWarningRoleOnKick} onChange={(e) => patch({ removeWarningRoleOnKick: e.target.checked })} /> Clear warning state on kick</label>
            </div>
          </section>

          <section style={card}>
            <div style={{ ...label, marginBottom: 10 }}>Channels And Warning Role</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))", gap: 14 }}>
              <div>
                <div style={label}>Warning Role</div>
                <select style={input} value={cfg.warningRoleId} onChange={(e) => patch({ warningRoleId: e.target.value })}>
                  <option value="">No warning role</option>
                  {roles.map((role) => <option key={role.id} value={role.id}>@{role.name}</option>)}
                </select>
              </div>
              <div>
                <div style={label}>Log Channel</div>
                <select style={input} value={cfg.logChannelId} onChange={(e) => patch({ logChannelId: e.target.value })}>
                  <option value="">Select channel</option>
                  {textChannels.map((channel) => <option key={channel.id} value={channel.id}>#{channel.name}</option>)}
                </select>
              </div>
              <div>
                <div style={label}>Default Announcement Channel</div>
                <select style={input} value={cfg.announceChannelId} onChange={(e) => patch({ announceChannelId: e.target.value })}>
                  <option value="">Select channel</option>
                  {textChannels.map((channel) => <option key={channel.id} value={channel.id}>#{channel.name}</option>)}
                </select>
              </div>
              <div>
                <div style={label}>Warning Channel Override</div>
                <select style={input} value={cfg.warningChannelId} onChange={(e) => patch({ warningChannelId: e.target.value })}>
                  <option value="">Use announcement channel</option>
                  {textChannels.map((channel) => <option key={channel.id} value={channel.id}>#{channel.name}</option>)}
                </select>
              </div>
              <div>
                <div style={label}>Kick Channel Override</div>
                <select style={input} value={cfg.kickChannelId} onChange={(e) => patch({ kickChannelId: e.target.value })}>
                  <option value="">Use announcement channel</option>
                  {textChannels.map((channel) => <option key={channel.id} value={channel.id}>#{channel.name}</option>)}
                </select>
              </div>
            </div>
          </section>

          <section style={card}>
            <div style={{ ...label, marginBottom: 10 }}>Messaging Templates</div>
            <div style={{ display: "grid", gap: 14 }}>
              <div>
                <div style={label}>Kick Reason Template</div>
                <input style={input} value={cfg.kickReasonTemplate} onChange={(e) => patch({ kickReasonTemplate: e.target.value })} />
              </div>
              <div>
                <div style={label}>Warning DM Template</div>
                <textarea style={{ ...input, minHeight: 140 }} value={cfg.warningDmTemplate} onChange={(e) => patch({ warningDmTemplate: e.target.value })} />
              </div>
              <div>
                <div style={label}>Warning Public Template</div>
                <textarea style={{ ...input, minHeight: 100 }} value={cfg.warningPublicTemplate} onChange={(e) => patch({ warningPublicTemplate: e.target.value })} />
              </div>
              <div>
                <div style={label}>Kick Announcement Template</div>
                <textarea style={{ ...input, minHeight: 100 }} value={cfg.kickAnnouncementTemplate} onChange={(e) => patch({ kickAnnouncementTemplate: e.target.value })} />
              </div>
            </div>
          </section>

          <section style={card}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))", gap: 14 }}>
              <div>
                <div style={label}>Exempt Users</div>
                <input style={input} value={exemptUserText} onChange={(e) => patch({ exemptUserIds: parseUserList(e.target.value) })} placeholder="User IDs or mentions, comma separated" />
              </div>
              <div style={{ gridColumn: "1 / -1" }}>
                <div style={label}>Exempt Roles</div>
                <div style={{ maxHeight: 260, overflowY: "auto", border: "1px solid #500000", borderRadius: 10, padding: 10, background: "#0a0a0a" }}>
                  {roles.map((role) => (
                    <label key={role.id} style={{ display: "block", color: "#ffdcdc", marginBottom: 6 }}>
                      <input type="checkbox" checked={cfg.exemptRoleIds.includes(role.id)} onChange={() => patch({ exemptRoleIds: toggle(cfg.exemptRoleIds || [], role.id) })} />{" "}
                      @{role.name}
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </section>

          <section style={card}>
            <div style={label}>Operator Notes</div>
            <textarea style={{ ...input, minHeight: 100 }} value={cfg.notes} onChange={(e) => patch({ notes: e.target.value })} />
          </section>

          <section style={card}>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button onClick={() => void save()} disabled={saving} style={{ ...input, width: "auto", cursor: "pointer", fontWeight: 900 }}>{saving ? "Saving..." : "Save Engine"}</button>
              <button onClick={() => void runConfiguredAction("previewSweep")} disabled={saving} style={{ ...input, width: "auto", cursor: "pointer", fontWeight: 900 }}>{saving ? "Working..." : "Preview Sweep"}</button>
              <button onClick={() => void runConfiguredAction("runSweep")} disabled={saving || !cfg.enabled || !cfg.autoKickEnabled || cfg.dryRunOnly} style={{ ...input, width: "auto", cursor: "pointer", fontWeight: 900, opacity: (!cfg.enabled || !cfg.autoKickEnabled || cfg.dryRunOnly) ? 0.6 : 1 }}>{saving ? "Working..." : "Run Live Sweep Now"}</button>
              <button onClick={() => void runConfiguredAction("clearWarnings")} disabled={saving} style={{ ...input, width: "auto", cursor: "pointer", fontWeight: 900 }}>{saving ? "Working..." : "Clear Pending Warnings"}</button>
            </div>
            <div style={{ color: "#ffb3b3", marginTop: 10, lineHeight: 1.6 }}>
              Preview and sweep actions now save the current prune settings first, so your exempt roles and message-window changes are applied before the engine runs.
            </div>
          </section>

          <section style={card}>
            <div style={{ ...label, marginBottom: 10 }}>Action Queue</div>
            {candidates.length ? candidates.map((entry: any) => (
              <div key={entry.id || entry.title} style={{ borderTop: "1px solid #3b0000", padding: "8px 0", color: "#ffdcdc" }}>
                <div style={{ fontWeight: 700 }}>{entry.title || entry.name}</div>
                <div style={{ color: "#ffb7b7" }}>{entry.value}</div>
              </div>
            )) : <div style={{ color: "#ffb3b3" }}>No action rows yet. Run a preview sweep to populate this list.</div>}
          </section>

          <section style={card}>
            <div style={{ ...label, marginBottom: 10 }}>Pending Grace Members</div>
            {pendingGrace.length ? pendingGrace.map((entry: any) => (
              <div key={entry.id || entry.title} style={{ borderTop: "1px solid #3b0000", padding: "8px 0", color: "#ffdcdc" }}>
                <div style={{ fontWeight: 700 }}>{entry.title || entry.name}</div>
                <div style={{ color: "#ffb7b7" }}>{entry.value}</div>
              </div>
            )) : <div style={{ color: "#ffb3b3" }}>No members are currently sitting in a warning grace window.</div>}
          </section>

          <section style={card}>
            <div style={{ ...label, marginBottom: 10 }}>Recently Tracked Members</div>
            {trackedMembers.length ? trackedMembers.map((entry: any) => (
              <div key={entry.id || entry.title} style={{ borderTop: "1px solid #3b0000", padding: "8px 0", color: "#ffdcdc" }}>
                <div style={{ fontWeight: 700 }}>{entry.title || entry.name}</div>
                <div style={{ color: "#ffb7b7" }}>{entry.value}</div>
              </div>
            )) : <div style={{ color: "#ffb3b3" }}>No tracked member activity yet.</div>}
          </section>

          <section style={card}>
            <div style={{ ...label, marginBottom: 10 }}>Recent Sweep Activity</div>
            {recentActions.length ? recentActions.map((entry: any) => (
              <div key={entry.id || entry.title} style={{ borderTop: "1px solid #3b0000", padding: "8px 0", color: "#ffdcdc" }}>
                <div style={{ fontWeight: 700 }}>{entry.title || entry.name}</div>
                <div style={{ color: "#ffb7b7" }}>{entry.value}</div>
              </div>
            )) : <div style={{ color: "#ffb3b3" }}>No sweep activity yet.</div>}
          </section>
        </>
      ) : null}
    </div>
  );
}
