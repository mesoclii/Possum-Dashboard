"use client";

import { useMemo, useState } from "react";
import type { CSSProperties } from "react";
import EngineInsights from "@/components/possum/EngineInsights";
import { useGuildEngineEditor } from "@/components/possum/useGuildEngineEditor";

type PresetConfig = {
  key: string;
  label: string;
  description: string;
  tankSlots: number;
  healerSlots: number;
  dpsSlots: number;
  enabled: boolean;
};

type MotdConfig = {
  enabled: boolean;
  channelId: string;
  panelChannelId: string;
  mentionRoleId: string;
  keepLatestOnly: boolean;
  pinLatest: boolean;
  autoDeleteMinutes: number;
  colorHex: string;
  titleTemplate: string;
  bodyTemplate: string;
  footerTemplate: string;
  imageUrl: string;
  thumbnailUrl: string;
  panelTitle: string;
  panelDescription: string;
  buttonLabel: string;
  clearButtonLabel: string;
};

type Config = {
  enabled: boolean;
  signupChannelId: string;
  announceChannelId: string;
  logChannelId: string;
  controlPanelChannelId: string;
  staffRoleIds: string[];
  pingRoleIds: string[];
  requiredRoleIds: string[];
  blockedRoleIds: string[];
  allowTentative: boolean;
  maxConcurrentSessions: number;
  sessionTimeoutMinutes: number;
  autoBumpMinutes: number;
  autoDeleteCompletedMinutes: number;
  autoDeleteCancelledMinutes: number;
  embedColorHex: string;
  signupImageUrl: string;
  signupThumbnailUrl: string;
  tankLabel: string;
  healerLabel: string;
  dpsLabel: string;
  tentativeLabel: string;
  panelTitleTemplate: string;
  panelDescriptionTemplate: string;
  signupAnnouncementTemplate: string;
  bumpAnnouncementTemplate: string;
  fullAnnouncementTemplate: string;
  closeAnnouncementTemplate: string;
  completionAnnouncementTemplate: string;
  cancellationAnnouncementTemplate: string;
  presets: PresetConfig[];
  motd: MotdConfig;
  notes: string;
};

type RuntimeRow = {
  id?: string;
  sessionId?: string;
  title?: string;
  value?: string;
  status?: string;
};

const DEFAULTS: Config = {
  enabled: true,
  signupChannelId: "",
  announceChannelId: "",
  logChannelId: "",
  controlPanelChannelId: "",
  staffRoleIds: [],
  pingRoleIds: [],
  requiredRoleIds: [],
  blockedRoleIds: [],
  allowTentative: true,
  maxConcurrentSessions: 12,
  sessionTimeoutMinutes: 0,
  autoBumpMinutes: 0,
  autoDeleteCompletedMinutes: 180,
  autoDeleteCancelledMinutes: 45,
  embedColorHex: "#c79c6e",
  signupImageUrl: "",
  signupThumbnailUrl: "",
  tankLabel: "Tank",
  healerLabel: "Healer",
  dpsLabel: "DPS",
  tentativeLabel: "Tentative",
  panelTitleTemplate: "{title}",
  panelDescriptionTemplate: "{description}\n\n{tankSection}\n\n{healerSection}\n\n{dpsSection}\n\n{tentativeSection}\n\nStatus: **{status}**\nNeed: {openSummary}",
  signupAnnouncementTemplate: "{roleMentions} {title} signup is live in {channelMention}.",
  bumpAnnouncementTemplate: "{roleMentions} {title} still needs {openSummary}.",
  fullAnnouncementTemplate: "{title} is now full.",
  closeAnnouncementTemplate: "{title} signup closed.",
  completionAnnouncementTemplate: "{title} is complete.",
  cancellationAnnouncementTemplate: "{title} signup cancelled.",
  presets: [
    { key: "mythic5", label: "5-Man Group", description: "1 tank, 1 healer, 3 DPS.", tankSlots: 1, healerSlots: 1, dpsSlots: 3, enabled: true },
    { key: "raid10", label: "10-Man Raid", description: "2 tanks, 2 healers, 6 DPS.", tankSlots: 2, healerSlots: 2, dpsSlots: 6, enabled: true },
    { key: "raid25", label: "25-Man Raid", description: "2 tanks, 5 healers, 18 DPS.", tankSlots: 2, healerSlots: 5, dpsSlots: 18, enabled: true },
  ],
  motd: {
    enabled: true,
    channelId: "",
    panelChannelId: "",
    mentionRoleId: "",
    keepLatestOnly: true,
    pinLatest: false,
    autoDeleteMinutes: 1440,
    colorHex: "#c79c6e",
    titleTemplate: "{title}",
    bodyTemplate: "{message}",
    footerTemplate: "Message of the Day",
    imageUrl: "",
    thumbnailUrl: "",
    panelTitle: "WoW Message of the Day",
    panelDescription: "Use the button below to compose and publish a message of the day.",
    buttonLabel: "Post MOTD",
    clearButtonLabel: "Clear Live MOTD",
  },
  notes: "",
};

const box: CSSProperties = {
  border: "1px solid #5f0000",
  borderRadius: 12,
  padding: 14,
  background: "rgba(120,0,0,0.10)",
  marginBottom: 12,
};

const input: CSSProperties = {
  width: "100%",
  padding: 10,
  borderRadius: 8,
  border: "1px solid #6f0000",
  background: "#0a0a0a",
  color: "#ffd7d7",
};

function toggle(list: string[], id: string) {
  const next = new Set(list || []);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  return Array.from(next);
}

export default function WowClient() {
  const {
    guildId,
    guildName,
    config: rawCfg,
    setConfig: setCfg,
    channels,
    roles,
    summary,
    details,
    loading,
    saving,
    message,
    save,
    runAction,
  } = useGuildEngineEditor<Config>("wowGuild", DEFAULTS);

  const cfg = useMemo<Config>(
    () => ({
      ...DEFAULTS,
      ...(rawCfg || {}),
      presets: Array.isArray((rawCfg as any)?.presets) && (rawCfg as any).presets.length ? (rawCfg as any).presets : DEFAULTS.presets,
      motd: { ...DEFAULTS.motd, ...((rawCfg as any)?.motd || {}) },
    }),
    [rawCfg]
  );

  const textChannels = useMemo(
    () => channels.filter((c) => Number(c?.type) === 0 || Number(c?.type) === 5 || String(c?.type || "").toLowerCase().includes("text")),
    [channels]
  );

  const activeSessions = useMemo(() => (Array.isArray((details as any)?.activeSessions) ? ((details as any).activeSessions as RuntimeRow[]) : []), [details]);
  const recentSessions = useMemo(() => (Array.isArray((details as any)?.recentSessions) ? ((details as any).recentSessions as RuntimeRow[]) : []), [details]);
  const motdHistory = useMemo(() => (Array.isArray((details as any)?.motdHistory) ? ((details as any).motdHistory as RuntimeRow[]) : []), [details]);

  const [createForm, setCreateForm] = useState({
    presetKey: "mythic5",
    title: "Tonight's Run",
    description: "Drop your role and be ready when the group fills.",
    channelId: "",
    timeoutMinutes: "0",
  });
  const [motdForm, setMotdForm] = useState({
    title: "Raid Night",
    message: "Be online 15 minutes early with consumables ready.",
    channelId: "",
    expiresMinutes: String(cfg.motd.autoDeleteMinutes || 0),
  });

  function updatePreset(index: number, patch: Partial<PresetConfig>) {
    const next = cfg.presets.map((entry: PresetConfig, entryIndex: number) => (entryIndex === index ? { ...entry, ...patch } : entry));
    setCfg({ ...cfg, presets: next });
  }

  async function createSession() {
    await runAction("createSession", {
      presetKey: createForm.presetKey,
      title: createForm.title,
      description: createForm.description,
      channelId: createForm.channelId,
      timeoutMinutes: Number(createForm.timeoutMinutes || 0),
    });
  }

  async function postMotd() {
    await runAction("postMotd", {
      title: motdForm.title,
      message: motdForm.message,
      channelId: motdForm.channelId,
      expiresMinutes: Number(motdForm.expiresMinutes || 0),
    });
  }

  if (!guildId) return <div style={{ color: "#ff8a8a", padding: 20 }}>Missing guildId. Open from /guilds.</div>;
  if (loading) return <div style={{ color: "#ff8a8a", padding: 20 }}>Loading WoW studio...</div>;

  return (
    <div style={{ color: "#ffb3b3", padding: 14, maxWidth: 1450 }}>
      <h1 style={{ marginTop: 0, color: "#ff3b3b", letterSpacing: "0.08em", textTransform: "uppercase" }}>WoW Group Studio</h1>
      <p style={{ marginTop: 0 }}>Guild: {guildName || guildId}</p>
      <p style={{ color: "#ffb7b7", marginTop: -4, lineHeight: 1.6 }}>
        This engine handles 5-man, 10-man, and 25-man World of Warcraft signups with live role slots, tentative joins, multiple
        concurrent groups, and a built-in message-of-the-day surface for raid comms.
      </p>
      {message ? <div style={{ color: "#ffb3f0", marginBottom: 8 }}>{message}</div> : null}

      <EngineInsights summary={summary} details={details} showDetails />

      <div style={box}>
        <h3 style={{ marginTop: 0, color: "#ff4444" }}>Core Controls</h3>
        <label><input type="checkbox" checked={cfg.enabled} onChange={(e) => setCfg({ ...cfg, enabled: e.target.checked })} /> WoW engine enabled</label><br />
        <label><input type="checkbox" checked={cfg.allowTentative} onChange={(e) => setCfg({ ...cfg, allowTentative: e.target.checked })} /> Allow tentative signups</label>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, minmax(180px, 1fr))", gap: 10, marginTop: 10 }}>
          <div><label>Max concurrent</label><input style={input} type="number" value={cfg.maxConcurrentSessions} onChange={(e) => setCfg({ ...cfg, maxConcurrentSessions: Number(e.target.value || 1) })} /></div>
          <div><label>Timeout minutes</label><input style={input} type="number" value={cfg.sessionTimeoutMinutes} onChange={(e) => setCfg({ ...cfg, sessionTimeoutMinutes: Number(e.target.value || 0) })} /></div>
          <div><label>Auto-bump minutes</label><input style={input} type="number" value={cfg.autoBumpMinutes} onChange={(e) => setCfg({ ...cfg, autoBumpMinutes: Number(e.target.value || 0) })} /></div>
          <div><label>Delete completed</label><input style={input} type="number" value={cfg.autoDeleteCompletedMinutes} onChange={(e) => setCfg({ ...cfg, autoDeleteCompletedMinutes: Number(e.target.value || 0) })} /></div>
          <div><label>Delete cancelled</label><input style={input} type="number" value={cfg.autoDeleteCancelledMinutes} onChange={(e) => setCfg({ ...cfg, autoDeleteCancelledMinutes: Number(e.target.value || 0) })} /></div>
        </div>
      </div>

      <div style={box}>
        <h3 style={{ marginTop: 0, color: "#ff4444" }}>Channels and Roles</h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(6, minmax(180px, 1fr))", gap: 10 }}>
          {[
            ["Signup channel", "signupChannelId"],
            ["Announce channel", "announceChannelId"],
            ["Log channel", "logChannelId"],
            ["Control panel", "controlPanelChannelId"],
            ["MOTD channel", "motd.channelId"],
            ["MOTD panel", "motd.panelChannelId"],
          ].map(([label, key]) => (
            <div key={key}>
              <label>{label}</label>
              <select
                style={input}
                value={key.startsWith("motd.") ? (cfg.motd as any)[key.split(".")[1]] : (cfg as any)[key]}
                onChange={(e) =>
                  key.startsWith("motd.")
                    ? setCfg({ ...cfg, motd: { ...cfg.motd, [key.split(".")[1]]: e.target.value } })
                    : setCfg({ ...cfg, [key]: e.target.value } as Config)
                }
              >
                <option value="">Select channel</option>
                {textChannels.map((c) => <option key={c.id} value={c.id}>#{c.name}</option>)}
              </select>
            </div>
          ))}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(240px, 1fr))", gap: 10, marginTop: 12 }}>
          {[
            ["Staff roles", "staffRoleIds"],
            ["Ping roles", "pingRoleIds"],
            ["Required roles", "requiredRoleIds"],
            ["Blocked roles", "blockedRoleIds"],
          ].map(([label, key]) => (
            <div key={key}>
              <div style={{ marginBottom: 6 }}>{label}</div>
              <div style={{ maxHeight: 180, overflowY: "auto", border: "1px solid #5a0000", borderRadius: 8, padding: 8 }}>
                {roles.map((role) => (
                  <label key={`${key}_${role.id}`} style={{ display: "block", marginBottom: 4 }}>
                    <input
                      type="checkbox"
                      checked={((cfg as any)[key] || []).includes(role.id)}
                      onChange={() => setCfg({ ...cfg, [key]: toggle((cfg as any)[key] || [], role.id) } as Config)}
                    />{" "}
                    @{role.name}
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div style={box}>
        <h3 style={{ marginTop: 0, color: "#ff4444" }}>Labels and Copy</h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(180px, 1fr))", gap: 10 }}>
          <div><label>Tank label</label><input style={input} value={cfg.tankLabel} onChange={(e) => setCfg({ ...cfg, tankLabel: e.target.value })} /></div>
          <div><label>Healer label</label><input style={input} value={cfg.healerLabel} onChange={(e) => setCfg({ ...cfg, healerLabel: e.target.value })} /></div>
          <div><label>DPS label</label><input style={input} value={cfg.dpsLabel} onChange={(e) => setCfg({ ...cfg, dpsLabel: e.target.value })} /></div>
          <div><label>Tentative label</label><input style={input} value={cfg.tentativeLabel} onChange={(e) => setCfg({ ...cfg, tentativeLabel: e.target.value })} /></div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(260px, 1fr))", gap: 10, marginTop: 10 }}>
          <div><label>Panel title template</label><input style={input} value={cfg.panelTitleTemplate} onChange={(e) => setCfg({ ...cfg, panelTitleTemplate: e.target.value })} /></div>
          <div><label>Signup announcement</label><input style={input} value={cfg.signupAnnouncementTemplate} onChange={(e) => setCfg({ ...cfg, signupAnnouncementTemplate: e.target.value })} /></div>
          <div style={{ gridColumn: "1 / -1" }}><label>Panel description template</label><textarea style={{ ...input, minHeight: 120 }} value={cfg.panelDescriptionTemplate} onChange={(e) => setCfg({ ...cfg, panelDescriptionTemplate: e.target.value })} /></div>
          <div><label>Bump announcement</label><input style={input} value={cfg.bumpAnnouncementTemplate} onChange={(e) => setCfg({ ...cfg, bumpAnnouncementTemplate: e.target.value })} /></div>
          <div><label>Full announcement</label><input style={input} value={cfg.fullAnnouncementTemplate} onChange={(e) => setCfg({ ...cfg, fullAnnouncementTemplate: e.target.value })} /></div>
          <div><label>Close announcement</label><input style={input} value={cfg.closeAnnouncementTemplate} onChange={(e) => setCfg({ ...cfg, closeAnnouncementTemplate: e.target.value })} /></div>
          <div><label>Completion announcement</label><input style={input} value={cfg.completionAnnouncementTemplate} onChange={(e) => setCfg({ ...cfg, completionAnnouncementTemplate: e.target.value })} /></div>
          <div><label>Cancellation announcement</label><input style={input} value={cfg.cancellationAnnouncementTemplate} onChange={(e) => setCfg({ ...cfg, cancellationAnnouncementTemplate: e.target.value })} /></div>
          <div><label>Embed color (hex)</label><input style={input} value={cfg.embedColorHex} placeholder="#c79c6e" onChange={(e) => setCfg({ ...cfg, embedColorHex: e.target.value })} /></div>
          <div><label>Signup image URL</label><input style={input} value={cfg.signupImageUrl} onChange={(e) => setCfg({ ...cfg, signupImageUrl: e.target.value })} /></div>
          <div><label>Signup thumbnail URL</label><input style={input} value={cfg.signupThumbnailUrl} onChange={(e) => setCfg({ ...cfg, signupThumbnailUrl: e.target.value })} /></div>
        </div>
      </div>

      <div style={box}>
        <h3 style={{ marginTop: 0, color: "#ff4444" }}>Presets</h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(260px, 1fr))", gap: 10 }}>
          {cfg.presets.map((preset, index) => (
            <div key={preset.key} style={{ border: "1px solid #5f0000", borderRadius: 12, padding: 12, background: "rgba(30,0,0,0.42)" }}>
              <label><input type="checkbox" checked={preset.enabled} onChange={(e) => updatePreset(index, { enabled: e.target.checked })} /> Preset enabled</label>
              <div style={{ marginTop: 8 }}><label>Label</label><input style={input} value={preset.label} onChange={(e) => updatePreset(index, { label: e.target.value })} /></div>
              <div style={{ marginTop: 8 }}><label>Description</label><textarea style={{ ...input, minHeight: 90 }} value={preset.description} onChange={(e) => updatePreset(index, { description: e.target.value })} /></div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(80px, 1fr))", gap: 8, marginTop: 8 }}>
                <div><label>Tanks</label><input style={input} type="number" value={preset.tankSlots} onChange={(e) => updatePreset(index, { tankSlots: Number(e.target.value || 0) })} /></div>
                <div><label>Healers</label><input style={input} type="number" value={preset.healerSlots} onChange={(e) => updatePreset(index, { healerSlots: Number(e.target.value || 0) })} /></div>
                <div><label>DPS</label><input style={input} type="number" value={preset.dpsSlots} onChange={(e) => updatePreset(index, { dpsSlots: Number(e.target.value || 0) })} /></div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div style={box}>
        <h3 style={{ marginTop: 0, color: "#ff4444" }}>Session Runtime</h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(180px, 1fr))", gap: 10 }}>
          <div>
            <label>Preset</label>
            <select style={input} value={createForm.presetKey} onChange={(e) => setCreateForm({ ...createForm, presetKey: e.target.value })}>
              {cfg.presets.map((preset) => <option key={preset.key} value={preset.key}>{preset.label}</option>)}
            </select>
          </div>
          <div><label>Title</label><input style={input} value={createForm.title} onChange={(e) => setCreateForm({ ...createForm, title: e.target.value })} /></div>
          <div><label>Channel</label><select style={input} value={createForm.channelId} onChange={(e) => setCreateForm({ ...createForm, channelId: e.target.value })}><option value="">Use default</option>{textChannels.map((c) => <option key={c.id} value={c.id}>#{c.name}</option>)}</select></div>
          <div><label>Timeout minutes</label><input style={input} type="number" value={createForm.timeoutMinutes} onChange={(e) => setCreateForm({ ...createForm, timeoutMinutes: e.target.value })} /></div>
          <div style={{ gridColumn: "1 / -1" }}><label>Description</label><textarea style={{ ...input, minHeight: 90 }} value={createForm.description} onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })} /></div>
        </div>
        <div style={{ display: "flex", gap: 10, marginTop: 12, flexWrap: "wrap" }}>
          <button style={{ ...input, width: "auto", cursor: "pointer", fontWeight: 900 }} disabled={saving} onClick={createSession}>Open Session</button>
          <button style={{ ...input, width: "auto", cursor: "pointer", fontWeight: 900 }} disabled={saving} onClick={() => runAction("deployControlPanel", { channelId: cfg.controlPanelChannelId })}>Deploy Control Panel</button>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(280px, 1fr))", gap: 10, marginTop: 14 }}>
          <div style={{ ...box, marginBottom: 0 }}>
            <h4 style={{ marginTop: 0, color: "#ff6b6b" }}>Active Sessions</h4>
            {activeSessions.length ? activeSessions.map((row) => (
              <div key={String(row.sessionId || row.id)} style={{ padding: "10px 0", borderTop: "1px solid #330000" }}>
                <div style={{ fontWeight: 800 }}>{row.title}</div>
                <div style={{ color: "#ffb3b3", fontSize: 12, marginTop: 4 }}>{row.value}</div>
                <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
                  <button style={{ ...input, width: "auto", cursor: "pointer" }} onClick={() => runAction("refreshSession", { sessionId: row.sessionId || row.id })}>Refresh</button>
                  <button style={{ ...input, width: "auto", cursor: "pointer" }} onClick={() => runAction("closeSession", { sessionId: row.sessionId || row.id })}>Close</button>
                  <button style={{ ...input, width: "auto", cursor: "pointer" }} onClick={() => runAction("reopenSession", { sessionId: row.sessionId || row.id })}>Reopen</button>
                  <button style={{ ...input, width: "auto", cursor: "pointer" }} onClick={() => runAction("completeSession", { sessionId: row.sessionId || row.id })}>Complete</button>
                  <button style={{ ...input, width: "auto", cursor: "pointer" }} disabled={saving} onClick={() => { if (window.confirm("Cancel this session?")) void runAction("cancelSession", { sessionId: row.sessionId || row.id }); }}>Cancel</button>
                  <button style={{ ...input, width: "auto", cursor: "pointer" }} disabled={saving} onClick={() => { if (window.confirm("Delete this session permanently?")) void runAction("deleteSession", { sessionId: row.sessionId || row.id }); }}>Delete</button>
                </div>
              </div>
            )) : <div style={{ color: "#ffb3b3" }}>No active sessions.</div>}
          </div>
          <div style={{ ...box, marginBottom: 0 }}>
            <h4 style={{ marginTop: 0, color: "#ff6b6b" }}>Recent Sessions</h4>
            {recentSessions.length ? recentSessions.map((row) => (
              <div key={String(row.sessionId || row.id)} style={{ padding: "10px 0", borderTop: "1px solid #330000" }}>
                <div style={{ fontWeight: 800 }}>{row.title}</div>
                <div style={{ color: "#ffb3b3", fontSize: 12 }}>{row.value}</div>
              </div>
            )) : <div style={{ color: "#ffb3b3" }}>No recent session history yet.</div>}
          </div>
        </div>
      </div>

      <div style={box}>
        <h3 style={{ marginTop: 0, color: "#ff4444" }}>MOTD Studio</h3>
        <label><input type="checkbox" checked={cfg.motd.enabled} onChange={(e) => setCfg({ ...cfg, motd: { ...cfg.motd, enabled: e.target.checked } })} /> MOTD enabled</label><br />
        <label><input type="checkbox" checked={cfg.motd.keepLatestOnly} onChange={(e) => setCfg({ ...cfg, motd: { ...cfg.motd, keepLatestOnly: e.target.checked } })} /> Keep latest only</label><br />
        <label><input type="checkbox" checked={cfg.motd.pinLatest} onChange={(e) => setCfg({ ...cfg, motd: { ...cfg.motd, pinLatest: e.target.checked } })} /> Pin latest</label>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(180px, 1fr))", gap: 10, marginTop: 10 }}>
          <div><label>Mention role</label><select style={input} value={cfg.motd.mentionRoleId} onChange={(e) => setCfg({ ...cfg, motd: { ...cfg.motd, mentionRoleId: e.target.value } })}><option value="">None</option>{roles.map((r) => <option key={r.id} value={r.id}>@{r.name}</option>)}</select></div>
          <div><label>Auto-delete minutes</label><input style={input} type="number" value={cfg.motd.autoDeleteMinutes} onChange={(e) => setCfg({ ...cfg, motd: { ...cfg.motd, autoDeleteMinutes: Number(e.target.value || 0) } })} /></div>
          <div><label>Accent color</label><input style={input} value={cfg.motd.colorHex} onChange={(e) => setCfg({ ...cfg, motd: { ...cfg.motd, colorHex: e.target.value } })} /></div>
          <div><label>Footer text</label><input style={input} value={cfg.motd.footerTemplate} onChange={(e) => setCfg({ ...cfg, motd: { ...cfg.motd, footerTemplate: e.target.value } })} /></div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(260px, 1fr))", gap: 10, marginTop: 10 }}>
          <div><label>MOTD image URL</label><input style={input} value={cfg.motd.imageUrl} onChange={(e) => setCfg({ ...cfg, motd: { ...cfg.motd, imageUrl: e.target.value } })} /></div>
          <div><label>MOTD thumbnail URL</label><input style={input} value={cfg.motd.thumbnailUrl} onChange={(e) => setCfg({ ...cfg, motd: { ...cfg.motd, thumbnailUrl: e.target.value } })} /></div>
          <div><label>Title template</label><input style={input} value={cfg.motd.titleTemplate} onChange={(e) => setCfg({ ...cfg, motd: { ...cfg.motd, titleTemplate: e.target.value } })} /></div>
          <div><label>Body template</label><input style={input} value={cfg.motd.bodyTemplate} onChange={(e) => setCfg({ ...cfg, motd: { ...cfg.motd, bodyTemplate: e.target.value } })} /></div>
          <div><label>Panel title</label><input style={input} value={cfg.motd.panelTitle} onChange={(e) => setCfg({ ...cfg, motd: { ...cfg.motd, panelTitle: e.target.value } })} /></div>
          <div><label>Post button label</label><input style={input} value={cfg.motd.buttonLabel} onChange={(e) => setCfg({ ...cfg, motd: { ...cfg.motd, buttonLabel: e.target.value } })} /></div>
          <div><label>Clear button label</label><input style={input} value={cfg.motd.clearButtonLabel} onChange={(e) => setCfg({ ...cfg, motd: { ...cfg.motd, clearButtonLabel: e.target.value } })} /></div>
          <div><label>Panel description</label><textarea style={{ ...input, minHeight: 90 }} value={cfg.motd.panelDescription} onChange={(e) => setCfg({ ...cfg, motd: { ...cfg.motd, panelDescription: e.target.value } })} /></div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(180px, 1fr))", gap: 10, marginTop: 14 }}>
          <div><label>MOTD title</label><input style={input} value={motdForm.title} onChange={(e) => setMotdForm({ ...motdForm, title: e.target.value })} /></div>
          <div><label>Channel</label><select style={input} value={motdForm.channelId} onChange={(e) => setMotdForm({ ...motdForm, channelId: e.target.value })}><option value="">Use default</option>{textChannels.map((c) => <option key={c.id} value={c.id}>#{c.name}</option>)}</select></div>
          <div><label>Expires minutes</label><input style={input} type="number" value={motdForm.expiresMinutes} onChange={(e) => setMotdForm({ ...motdForm, expiresMinutes: e.target.value })} /></div>
        </div>
        <div style={{ marginTop: 10 }}><label>MOTD message</label><textarea style={{ ...input, minHeight: 120 }} value={motdForm.message} onChange={(e) => setMotdForm({ ...motdForm, message: e.target.value })} /></div>
        <div style={{ display: "flex", gap: 10, marginTop: 12, flexWrap: "wrap" }}>
          <button style={{ ...input, width: "auto", cursor: "pointer", fontWeight: 900 }} disabled={saving} onClick={postMotd}>Post MOTD</button>
          <button style={{ ...input, width: "auto", cursor: "pointer", fontWeight: 900 }} disabled={saving} onClick={() => runAction("deployMotdPanel", { channelId: cfg.motd.panelChannelId })}>Deploy MOTD Panel</button>
          <button style={{ ...input, width: "auto", cursor: "pointer", fontWeight: 900 }} disabled={saving} onClick={() => runAction("clearMotd")}>Clear Live MOTD</button>
        </div>
        <div style={{ marginTop: 14 }}>
          <h4 style={{ marginTop: 0, color: "#ff6b6b" }}>Recent MOTD History</h4>
          {motdHistory.length ? motdHistory.map((row) => (
            <div key={String(row.id)} style={{ padding: "10px 0", borderTop: "1px solid #330000" }}>
              <div style={{ fontWeight: 800 }}>{row.title}</div>
              <div style={{ color: "#ffb3b3", fontSize: 12 }}>{row.value}</div>
            </div>
          )) : <div style={{ color: "#ffb3b3" }}>No MOTD history yet.</div>}
        </div>
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
        <button onClick={() => save(cfg)} disabled={saving} style={{ ...input, width: "auto", cursor: "pointer", fontWeight: 900 }}>
          {saving ? "Saving..." : "Save WoW Studio"}
        </button>
      </div>
    </div>
  );
}
