"use client";

import type { CSSProperties, ReactNode } from "react";
import { useMemo, useState } from "react";

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

const s = {
  page: {
    color: "#ffd7d7",
    padding: "20px 22px 90px",
    width: "100%",
    maxWidth: 1080,
    margin: "0 auto",
    boxSizing: "border-box",
  } as CSSProperties,
  eyebrow: {
    color: "#ff3b3b",
    fontSize: 11,
    fontWeight: 800,
    letterSpacing: "0.18em",
    textTransform: "uppercase",
  } as CSSProperties,
  h1: { margin: "6px 0 4px", fontSize: 28, lineHeight: 1.1, color: "#fff" } as CSSProperties,
  sub: { margin: 0, color: "#ffb3b3", fontSize: 13, lineHeight: 1.6, maxWidth: 720 } as CSSProperties,
  card: {
    border: "1px solid #4a0505",
    borderRadius: 14,
    padding: 18,
    marginTop: 12,
    background: "linear-gradient(180deg, rgba(48,0,0,0.5), rgba(14,0,0,0.5))",
  } as CSSProperties,
  head: {
    display: "flex",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: 12,
    flexWrap: "wrap",
    marginBottom: 4,
  } as CSSProperties,
  h2: { margin: 0, fontSize: 14, color: "#ff5a5a", letterSpacing: "0.05em", textTransform: "uppercase" } as CSSProperties,
  hint: { color: "#c98b8b", fontSize: 12.5, lineHeight: 1.55, margin: "6px 0 14px" } as CSSProperties,
  grid: (min = 230) =>
    ({
      display: "grid",
      gridTemplateColumns: `repeat(auto-fit,minmax(${min}px,1fr))`,
      gap: 12,
    } as CSSProperties),
  label: { display: "block", color: "#ffd0d0", fontSize: 12, fontWeight: 700, marginBottom: 6 } as CSSProperties,
  help: { color: "#a87171", fontSize: 11.5, marginTop: 5, lineHeight: 1.45 } as CSSProperties,
  input: {
    width: "100%",
    boxSizing: "border-box",
    padding: "9px 11px",
    borderRadius: 9,
    border: "1px solid #6f0000",
    background: "#0b0505",
    color: "#ffe3e3",
    fontSize: 13,
    outline: "none",
  } as CSSProperties,
  area: {
    width: "100%",
    boxSizing: "border-box",
    minHeight: 82,
    padding: "9px 11px",
    borderRadius: 9,
    border: "1px solid #6f0000",
    background: "#0b0505",
    color: "#ffe3e3",
    fontSize: 13,
    lineHeight: 1.5,
    resize: "vertical",
    outline: "none",
  } as CSSProperties,
  missing: { borderColor: "#b45309" } as CSSProperties,
  btn: {
    padding: "9px 14px",
    borderRadius: 9,
    border: "1px solid #7a0000",
    background: "#1a0404",
    color: "#ffd7d7",
    fontWeight: 800,
    fontSize: 12.5,
    cursor: "pointer",
  } as CSSProperties,
  btnPrimary: {
    padding: "9px 16px",
    borderRadius: 9,
    border: "1px solid #ff3b3b",
    background: "linear-gradient(180deg,#b30d0d,#7d0505)",
    color: "#fff",
    fontWeight: 900,
    fontSize: 12.5,
    cursor: "pointer",
  } as CSSProperties,
  pill: (on: boolean) =>
    ({
      fontSize: 10,
      fontWeight: 900,
      letterSpacing: "0.12em",
      textTransform: "uppercase",
      padding: "5px 10px",
      borderRadius: 999,
      border: `1px solid ${on ? "#1f7a3a" : "#7a1f1f"}`,
      background: on ? "rgba(20,120,60,0.16)" : "rgba(140,20,20,0.16)",
      color: on ? "#63e08d" : "#ff8a8a",
      whiteSpace: "nowrap",
    } as CSSProperties),
};

type TabKey = "overview" | "gate" | "copy" | "advanced";

const TABS: Array<{ key: TabKey; label: string }> = [
  { key: "overview", label: "Overview" },
  { key: "gate", label: "Gate settings" },
  { key: "copy", label: "Message copy" },
  { key: "advanced", label: "Advanced" },
];

const STEPS: Array<{ n: string; title: string; body: string; owner: string }> = [
  { n: "01", title: "Join", body: "Pre-onboarding screens the account: blacklist rejoin, refusal role, profile guard.", owner: "Pre-onboarding" },
  { n: "02", title: "Gate message", body: "Welcome DM plus that member's own gate message in the welcome channel.", owner: "Verification" },
  { n: "03", title: "Rules", body: "The rules button opens #rules. Confirming unlocks the verify button.", owner: "Verification" },
  { n: "04", title: "Verify opens a ticket", body: "Verify records the rules read and opens a private ID ticket. Nothing is granted.", owner: "Onboarding" },
  { n: "05", title: "Staff ID check", body: "Staff claim the ticket, review the ID, then press ID Verified or reject.", owner: "Verification" },
  { n: "06", title: "Verified", body: "Role granted, gate message removed, post-verify message posted in main chat.", owner: "Onboarding" },
];

function toggleRole(list: string[], id: string) {
  const set = new Set(list || []);
  if (set.has(id)) set.delete(id);
  else set.add(id);
  return Array.from(set);
}

function Field({ label, help, warn, children }: { label: string; help?: string; warn?: boolean; children: ReactNode }) {
  return (
    <div>
      <label style={s.label}>
        {label}
        {warn ? <span style={{ color: "#f0a35e", marginLeft: 6 }}>•</span> : null}
      </label>
      {children}
      {help ? <div style={s.help}>{help}</div> : null}
    </div>
  );
}

function Switch({
  checked,
  onChange,
  title,
  description,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  title: string;
  description: string;
}) {
  return (
    <label
      style={{
        display: "flex",
        gap: 10,
        alignItems: "flex-start",
        padding: "10px 12px",
        borderRadius: 10,
        border: `1px solid ${checked ? "#7a1414" : "#3a1010"}`,
        background: checked ? "rgba(120,15,15,0.18)" : "rgba(255,255,255,0.015)",
        cursor: "pointer",
      }}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        style={{ marginTop: 2, accentColor: "#ff3b3b" }}
      />
      <span>
        <span style={{ display: "block", color: "#ffe0e0", fontSize: 12.5, fontWeight: 700 }}>{title}</span>
        <span style={{ display: "block", color: "#a87171", fontSize: 11.5, marginTop: 3, lineHeight: 1.45 }}>
          {description}
        </span>
      </span>
    </label>
  );
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

  const [tab, setTab] = useState<TabKey>("overview");
  const [roleQuery, setRoleQuery] = useState("");

  const textChannels = (channels as GuildChannel[]).filter(
    (channel) =>
      Number(channel?.type) === 0 ||
      Number(channel?.type) === 5 ||
      String(channel?.type || "").toLowerCase().includes("text")
  );
  const roleList = (roles as GuildRole[]) || [];

  const filteredRoles = useMemo(() => {
    const q = roleQuery.trim().toLowerCase();
    if (!q) return roleList;
    return roleList.filter((role) => role.name.toLowerCase().includes(q));
  }, [roleList, roleQuery]);

  const selectedRemovalRoles = (cfg.removeOnVerifyRoleIds || []).filter(Boolean);

  const health = useMemo(() => {
    const issues: string[] = [];
    if (!cfg.welcomeChannelId) issues.push("Welcome channel is not set — no gate message can be posted on join.");
    if (!cfg.rulesChannelId) issues.push("Rules channel is not set — the rules button will be missing from the gate.");
    if (!cfg.verifiedRoleId) issues.push("Verified role is not set — an approval cannot grant access.");
    if (Number(cfg.idTimeoutMinutes || 0) <= 0) issues.push("Ticket expiry is 0 minutes — open tickets will never expire.");
    if (!cfg.sendWelcomePanel) issues.push("Gate message is off — members join with no visible next step.");
    return issues;
  }, [cfg]);

  const rulesName = textChannels.find((c) => c.id === cfg.rulesChannelId)?.name;
  const welcomeName = textChannels.find((c) => c.id === cfg.welcomeChannelId)?.name;

  function preview(text: string) {
    return String(text || "")
      .replace(/<@\{\{userId\}\}>/g, "@new member")
      .replace(/\{\{memberMention\}\}/g, "@new member")
      .replace(/\{\{guildName\}\}/g, guildName || "this server")
      .replace(/<#\{\{rulesChannelId\}\}>/g, rulesName ? `#${rulesName}` : "#rules")
      .replace(/<#\{\{welcomeChannelId\}\}>/g, welcomeName ? `#${welcomeName}` : "#welcome")
      .replace(/\{\{rulesChannel\}\}/g, rulesName ? `#${rulesName}` : "#rules")
      .replace(/\{\{welcomeChannel\}\}/g, welcomeName ? `#${welcomeName}` : "#welcome")
      .replace(/\{\{displayName\}\}/g, "new member");
  }

  async function saveAndPost() {
    await save();
    await runAction("deployVerificationPanel", {});
  }

  if (!guildId) return <div style={{ color: "#ff8a8a", padding: 20 }}>Missing guildId. Open from /guilds.</div>;
  if (loading) return <div style={{ color: "#ff8a8a", padding: 20 }}>Loading verification...</div>;

  return (
    <div style={s.page}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap", alignItems: "flex-start" }}>
        <div>
          <div style={s.eyebrow}>Admission pipeline · Step 1 of 2</div>
          <h1 style={s.h1}>Verification</h1>
          <p style={s.sub}>
            The 18+ gate for <strong style={{ color: "#fff" }}>{guildName || guildId}</strong>. Members are welcomed,
            confirm the rules, and verify. Verifying opens their ID ticket — the staff ID check is what grants access.
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <span style={s.pill(!!cfg.enabled)}>{cfg.enabled ? "Gate active" : "Gate off"}</span>
          <button type="button" onClick={() => void reload()} disabled={saving} style={s.btn}>Refresh</button>
          <button type="button" onClick={() => void save()} disabled={saving} style={s.btnPrimary}>
            {saving ? "Saving..." : "Save changes"}
          </button>
        </div>
      </div>

      {message ? <div style={{ marginTop: 10, color: "#ffb3f0", fontSize: 13 }}>{message}</div> : null}

      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 16, borderBottom: "1px solid #3a0505", paddingBottom: 10 }}>
        {TABS.map((item) => {
          const active = tab === item.key;
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => setTab(item.key)}
              style={{
                padding: "8px 14px",
                borderRadius: 8,
                border: `1px solid ${active ? "#ff3b3b" : "#3a1010"}`,
                background: active ? "rgba(160,20,20,0.25)" : "transparent",
                color: active ? "#fff" : "#c98b8b",
                fontSize: 12.5,
                fontWeight: active ? 800 : 600,
                cursor: "pointer",
              }}
            >
              {item.label}
              {item.key === "gate" && health.length ? (
                <span style={{ marginLeft: 6, color: "#f0a35e", fontWeight: 900 }}>{health.length}</span>
              ) : null}
            </button>
          );
        })}
      </div>

      {tab === "overview" ? (
        <>
          {health.length ? (
            <div style={{ ...s.card, borderColor: "#7a4a0a", background: "rgba(80,45,0,0.28)" }}>
              <div style={s.head}>
                <h2 style={{ ...s.h2, color: "#f0a35e" }}>Needs attention</h2>
                <button type="button" onClick={() => setTab("gate")} style={s.btn}>Open gate settings</button>
              </div>
              <ul style={{ margin: "8px 0 0", paddingLeft: 18, color: "#ffd7a8", fontSize: 12.5, lineHeight: 1.7 }}>
                {health.map((item) => <li key={item}>{item}</li>)}
              </ul>
            </div>
          ) : (
            <div style={{ ...s.card, borderColor: "#1f5a33", background: "rgba(10,50,25,0.22)" }}>
              <h2 style={{ ...s.h2, color: "#63e08d" }}>Gate is fully configured</h2>
              <p style={{ ...s.hint, margin: "6px 0 0", color: "#9bd7b0" }}>
                Channels, role and ticket expiry all resolve. The next join gets the full flow.
              </p>
            </div>
          )}

          <div style={s.card}>
            <div style={s.head}>
              <h2 style={s.h2}>How the gate runs</h2>
              <span style={{ color: "#a87171", fontSize: 11.5 }}>One pass per member</span>
            </div>
            <div style={{ ...s.grid(170), marginTop: 10 }}>
              {STEPS.map((step) => (
                <div key={step.n} style={{ border: "1px solid #43090b", borderRadius: 10, padding: 12, background: "rgba(0,0,0,0.28)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 6 }}>
                    <span style={{ color: "#ff3b3b", fontWeight: 900, fontSize: 12 }}>{step.n}</span>
                    <span style={{ color: "#8d5a5a", fontSize: 9.5, textTransform: "uppercase", letterSpacing: "0.08em" }}>{step.owner}</span>
                  </div>
                  <div style={{ color: "#ffe4e4", fontWeight: 800, fontSize: 12.5, marginTop: 6 }}>{step.title}</div>
                  <div style={{ color: "#b98c8c", fontSize: 11.5, lineHeight: 1.5, marginTop: 4 }}>{step.body}</div>
                </div>
              ))}
            </div>
          </div>

          <EngineInsights summary={summary} details={details} />

          <div style={s.card}>
            <div style={s.head}>
              <h2 style={s.h2}>Ticket and post-verified message</h2>
              <a href="/dashboard/security/onboarding" style={{ color: "#ff8a8a", fontSize: 12, fontWeight: 700 }}>
                Edit on the Onboarding page
              </a>
            </div>
            <p style={{ ...s.hint, margin: "6px 0 0" }}>
              The entry ticket copy, its three staff buttons, refusal handling and the channel for the post-verified
              message all live with the onboarding engine. This page stops at the gate so the two never disagree.
            </p>
          </div>

          <div style={s.card}>
            <div style={s.head}>
              <h2 style={s.h2}>Test the gate</h2>
              <span style={{ color: "#a87171", fontSize: 11.5 }}>Auto-deletes after 30 minutes</span>
            </div>
            <p style={s.hint}>
              Saves first, then posts one copy of the gate message to the welcome channel. Nothing stays pinned.
            </p>
            <button type="button" onClick={() => void saveAndPost()} disabled={saving} style={s.btnPrimary}>
              {saving ? "Working..." : "Save + post test gate message"}
            </button>
          </div>
        </>
      ) : null}

      {tab === "gate" ? (
        <>
          <div style={s.card}>
            <div style={s.head}>
              <h2 style={s.h2}>Gate switches</h2>
              <span style={{ color: "#a87171", fontSize: 11.5 }}>Join and approval behaviour</span>
            </div>
            <div style={{ ...s.grid(260), marginTop: 10 }}>
              <Switch checked={!!cfg.enabled} onChange={(next) => setCfg({ ...cfg, enabled: next })} title="Verification enabled" description="Turns the whole gate on or off for this server." />
              <Switch checked={!!cfg.sendWelcomeDm} onChange={(next) => setCfg({ ...cfg, sendWelcomeDm: next })} title="Send the welcome DM" description="DMs the member where to start when they join." />
              <Switch checked={!!cfg.sendWelcomePanel} onChange={(next) => setCfg({ ...cfg, sendWelcomePanel: next })} title="Post the gate message on join" description="One message per member, with the rules and verify buttons." />
              <Switch checked={!!cfg.requireRulesRead} onChange={(next) => setCfg({ ...cfg, requireRulesRead: next })} title="Require the rules confirm" description="Verify stays locked until they confirm they read the rules." />
              <Switch checked={!!cfg.sendGateAnnouncement} onChange={(next) => setCfg({ ...cfg, sendGateAnnouncement: next })} title="Announce arrivals" description="Posts the arrival line above the gate message." />
              <Switch checked={!!cfg.grantVerifiedRole} onChange={(next) => setCfg({ ...cfg, grantVerifiedRole: next })} title="Grant the verified role" description="Applied by the staff ID approval, not by the verify press." />
              <Switch checked={!!cfg.removeRolesOnVerify} onChange={(next) => setCfg({ ...cfg, removeRolesOnVerify: next })} title="Remove gate roles on approval" description="Strips the roles selected in section 03 when access is granted." />
            </div>
          </div>

          <div style={s.card}>
            <div style={s.head}>
              <h2 style={s.h2}>Channels and roles</h2>
              <span style={{ color: "#a87171", fontSize: 11.5 }}>Amber means missing</span>
            </div>
            <div style={{ ...s.grid(240), marginTop: 10 }}>
              <Field label="Welcome channel" help="Gate message is posted here." warn={!cfg.welcomeChannelId}>
                <select style={{ ...s.input, ...(cfg.welcomeChannelId ? {} : s.missing) }} value={cfg.welcomeChannelId || ""} onChange={(e) => setCfg({ ...cfg, welcomeChannelId: e.target.value })}>
                  <option value="">Select channel</option>
                  {textChannels.map((channel) => <option key={channel.id} value={channel.id}>#{channel.name}</option>)}
                </select>
              </Field>
              <Field label="Rules channel" help="Opened by the rules button." warn={!cfg.rulesChannelId}>
                <select style={{ ...s.input, ...(cfg.rulesChannelId ? {} : s.missing) }} value={cfg.rulesChannelId || ""} onChange={(e) => setCfg({ ...cfg, rulesChannelId: e.target.value })}>
                  <option value="">Select channel</option>
                  {textChannels.map((channel) => <option key={channel.id} value={channel.id}>#{channel.name}</option>)}
                </select>
              </Field>
              <Field label="Main chat" help="Fallback only. Set the post-verify channel on the Onboarding page.">
                <select style={s.input} value={cfg.mainChatChannelId || ""} onChange={(e) => setCfg({ ...cfg, mainChatChannelId: e.target.value })}>
                  <option value="">Use the welcome channel</option>
                  {textChannels.map((channel) => <option key={channel.id} value={channel.id}>#{channel.name}</option>)}
                </select>
              </Field>
              <Field label="Verified role" help="Granted only on staff ID approval." warn={!cfg.verifiedRoleId}>
                <select style={{ ...s.input, ...(cfg.verifiedRoleId ? {} : s.missing) }} value={cfg.verifiedRoleId || ""} onChange={(e) => setCfg({ ...cfg, verifiedRoleId: e.target.value })}>
                  <option value="">Select role</option>
                  {roleList.map((role) => <option key={role.id} value={role.id}>@{role.name}</option>)}
                </select>
              </Field>
              <Field label="Decline role" help="Applied when a member declines the ID check.">
                <select style={s.input} value={cfg.declineRoleId || ""} onChange={(e) => setCfg({ ...cfg, declineRoleId: e.target.value })}>
                  <option value="">Not used</option>
                  {roleList.map((role) => <option key={role.id} value={role.id}>@{role.name}</option>)}
                </select>
              </Field>
              <Field label="ID request channel" help="Optional staging channel for the ID step.">
                <select style={s.input} value={cfg.idChannelId || ""} onChange={(e) => setCfg({ ...cfg, idChannelId: e.target.value })}>
                  <option value="">Not used</option>
                  {textChannels.map((channel) => <option key={channel.id} value={channel.id}>#{channel.name}</option>)}
                </select>
              </Field>
              <Field label="Ticket expiry (minutes)" help="Open ID tickets expire after this long." warn={Number(cfg.idTimeoutMinutes || 0) <= 0}>
                <input type="number" min={1} style={{ ...s.input, ...(Number(cfg.idTimeoutMinutes || 0) <= 0 ? s.missing : {}) }} value={Number(cfg.idTimeoutMinutes || 0)} onChange={(e) => setCfg({ ...cfg, idTimeoutMinutes: Number(e.target.value || 0) })} />
              </Field>
            </div>
          </div>

          <div style={s.card}>
            <div style={s.head}>
              <h2 style={s.h2}>Roles removed on approval</h2>
              <span style={{ color: "#a87171", fontSize: 11.5 }}>{selectedRemovalRoles.length} selected</span>
            </div>
            <p style={s.hint}>Whatever keeps a pending member restricted. Stripped at the same moment the verified role is granted.</p>
            <input style={{ ...s.input, marginBottom: 10 }} value={roleQuery} onChange={(e) => setRoleQuery(e.target.value)} placeholder="Filter roles..." />
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {filteredRoles.length ? filteredRoles.map((role) => {
                const active = (cfg.removeOnVerifyRoleIds || []).includes(role.id);
                return (
                  <button
                    key={role.id}
                    type="button"
                    onClick={() => setCfg({ ...cfg, removeOnVerifyRoleIds: toggleRole(cfg.removeOnVerifyRoleIds || [], role.id) })}
                    style={{
                      padding: "6px 10px",
                      borderRadius: 999,
                      cursor: "pointer",
                      fontSize: 11.5,
                      fontWeight: 700,
                      border: `1px solid ${active ? "#ff3b3b" : "#5a1a1a"}`,
                      background: active ? "rgba(180,20,20,0.28)" : "rgba(0,0,0,0.35)",
                      color: active ? "#ffe1e1" : "#c99a9a",
                    }}
                  >
                    @{role.name}
                  </button>
                );
              }) : <span style={{ color: "#a87171", fontSize: 12 }}>No roles match.</span>}
            </div>
          </div>
        </>
      ) : null}

      {tab === "copy" ? (
        <>
          <div style={s.card}>
            <div style={s.head}>
              <h2 style={s.h2}>Gate message</h2>
              <span style={{ color: "#a87171", fontSize: 11.5 }}>{"{{guildName}}"} · {"{{memberMention}}"} · {"{{rulesChannel}}"}</span>
            </div>
            <div style={{ ...s.grid(300), marginTop: 10 }}>
              <Field label="Panel title">
                <input style={s.input} value={cfg.panelTitle || ""} onChange={(e) => setCfg({ ...cfg, panelTitle: e.target.value })} />
              </Field>
              <Field label="Panel footer">
                <input style={s.input} value={cfg.panelFooter || ""} onChange={(e) => setCfg({ ...cfg, panelFooter: e.target.value })} />
              </Field>
            </div>
            <div style={{ marginTop: 12 }}>
              <Field label="Panel description">
                <textarea style={s.area} value={cfg.panelDescription || ""} onChange={(e) => setCfg({ ...cfg, panelDescription: e.target.value })} />
              </Field>
            </div>
            <div style={{ ...s.grid(300), marginTop: 12 }}>
              <Field label="Arrival announcement" help="Posted above the gate message.">
                <textarea style={s.area} value={cfg.gateAnnouncementTemplate || ""} onChange={(e) => setCfg({ ...cfg, gateAnnouncementTemplate: e.target.value })} />
              </Field>
              <Field label="Welcome DM" help="Sent once on join.">
                <textarea style={s.area} value={cfg.dmTemplate || ""} onChange={(e) => setCfg({ ...cfg, dmTemplate: e.target.value })} />
              </Field>
            </div>
          </div>

          <div style={s.card}>
            <div style={s.head}>
              <h2 style={s.h2}>Preview</h2>
              <span style={{ color: "#a87171", fontSize: 11.5 }}>Live from your copy</span>
            </div>
            <div style={{ borderLeft: "4px solid #ff3b3b", borderRadius: 10, background: "#0d0606", padding: 14, maxWidth: 560 }}>
              <div style={{ color: "#fff", fontWeight: 800, fontSize: 14 }}>{preview(cfg.panelTitle) || "Panel title"}</div>
              <div style={{ color: "#d9b3b3", fontSize: 12.5, lineHeight: 1.6, marginTop: 6, whiteSpace: "pre-wrap" }}>{preview(cfg.panelDescription)}</div>
              <div style={{ color: "#8d5a5a", fontSize: 11, marginTop: 8 }}>{preview(cfg.panelFooter)}</div>
              <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
                <span style={{ padding: "7px 12px", borderRadius: 6, background: "#1c1c22", color: "#c9c9d4", fontSize: 11.5, fontWeight: 700 }}>{cfg.rulesButtonLabel || "Open Rules"}</span>
                <span style={{ padding: "7px 12px", borderRadius: 6, background: "#2a2a33", color: "#c9c9d4", fontSize: 11.5, fontWeight: 700 }}>{cfg.readRulesButtonLabel || "Rules confirm"}</span>
                <span style={{ padding: "7px 12px", borderRadius: 6, background: "#1f6b3a", color: "#eafff0", fontSize: 11.5, fontWeight: 800 }}>{cfg.verifyButtonLabel || "Verify"}</span>
              </div>
            </div>
          </div>

          <div style={s.card}>
            <div style={s.head}>
              <h2 style={s.h2}>Button labels</h2>
            </div>
            <div style={{ ...s.grid(230), marginTop: 10 }}>
              <Field label="Rules link">
                <input style={s.input} value={cfg.rulesButtonLabel || ""} onChange={(e) => setCfg({ ...cfg, rulesButtonLabel: e.target.value })} />
              </Field>
              <Field label="Rules confirm">
                <input style={s.input} value={cfg.readRulesButtonLabel || ""} onChange={(e) => setCfg({ ...cfg, readRulesButtonLabel: e.target.value })} />
              </Field>
              <Field label="Rules confirmed (disabled)">
                <input style={s.input} value={cfg.readRulesConfirmedButtonLabel || ""} onChange={(e) => setCfg({ ...cfg, readRulesConfirmedButtonLabel: e.target.value })} />
              </Field>
              <Field label="Verify">
                <input style={s.input} value={cfg.verifyButtonLabel || ""} onChange={(e) => setCfg({ ...cfg, verifyButtonLabel: e.target.value })} />
              </Field>
            </div>
          </div>
        </>
      ) : null}



      {tab === "advanced" ? (
        <div style={s.card}>
          <div style={s.head}>
            <h2 style={s.h2}>Advanced config</h2>
            <span style={{ color: "#a87171", fontSize: 11.5 }}>Every key the engine reads</span>
          </div>
          <p style={s.hint}>Edit the raw config, then apply and save. Unknown keys are preserved.</p>
          <ConfigJsonEditor
            title="Advanced verification config"
            value={cfg}
            disabled={saving}
            onApply={(next) => setCfg({ ...DEFAULTS, ...(next as VerificationConfig) })}
          />
        </div>
      ) : null}

      <div
        style={{
          position: "sticky",
          bottom: 0,
          marginTop: 16,
          padding: "12px 0",
          background: "linear-gradient(180deg, rgba(6,0,0,0.2), rgba(6,0,0,0.95))",
          display: "flex",
          gap: 10,
          justifyContent: "flex-end",
        }}
      >
        <button type="button" onClick={() => void save()} disabled={saving} style={s.btnPrimary}>
          {saving ? "Saving..." : "Save verification"}
        </button>
      </div>
    </div>
  );
}
