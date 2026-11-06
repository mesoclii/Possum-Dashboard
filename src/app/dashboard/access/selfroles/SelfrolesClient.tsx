"use client";

import ConfigJsonEditor from "@/components/possum/ConfigJsonEditor";
import EngineInsights from "@/components/possum/EngineInsights";
import { useGuildEngineEditor } from "@/components/possum/useGuildEngineEditor";
import { useEffect, useMemo, useState } from "react";

type GuildChannel = { id: string; name: string; type?: number | string };
type GuildRole = { id: string; name: string };
type GuildOption = { id: string; name: string; botPresent?: boolean };

type RoleOption = {
  roleId: string;
  label: string;
  emoji: string;
  description: string;
  style: "primary" | "secondary" | "success" | "danger";
};

type Panel = {
  id: string;
  enabled: boolean;
  channelId: string;
  messageTitle: string;
  messageBody: string;
  mode: "buttons" | "select";
  maxSelectable: number;
  allowRemove: boolean;
  embedColor: string;
  footerText: string;
  thumbnailUrl: string;
  imageUrl: string;
  useWebhook: boolean;
  webhookName: string;
  webhookAvatarUrl: string;
  options: RoleOption[];
};

type Config = {
  active: boolean;
  requireVerification: boolean;
  verificationRoleId: string;
  maxRolesPerUser: number;
  antiAbuseCooldownSec: number;
  logChannelId: string;
  usageLogging: {
    enabled: boolean;
    retention: number;
    logSuccessful: boolean;
    logBlocked: boolean;
    logErrors: boolean;
    mirrorToAuditBus: boolean;
  };
  panelDefaults: {
    embedColor: string;
    footerText: string;
    thumbnailUrl: string;
    imageUrl: string;
    useWebhook: boolean;
    webhookName: string;
    webhookAvatarUrl: string;
  };
  panels: Panel[];
  notes: string;
  updatedAt: string;
};

const DEFAULTS: Config = {
  active: true,
  requireVerification: false,
  verificationRoleId: "",
  maxRolesPerUser: 10,
  antiAbuseCooldownSec: 3,
  logChannelId: "",
  usageLogging: {
    enabled: true,
    retention: 250,
    logSuccessful: true,
    logBlocked: true,
    logErrors: true,
    mirrorToAuditBus: true,
  },
  panelDefaults: {
    embedColor: "#2b2d31",
    footerText: "",
    thumbnailUrl: "",
    imageUrl: "",
    useWebhook: false,
    webhookName: "",
    webhookAvatarUrl: "",
  },
  panels: [],
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

function newOption(): RoleOption {
  return { roleId: "", label: "New Role", emoji: "", description: "", style: "secondary" };
}

function newPanel(defaults = DEFAULTS.panelDefaults): Panel {
  return {
    id: `panel_${Date.now()}`,
    enabled: true,
    channelId: "",
    messageTitle: "Pick Your Roles",
    messageBody: "Choose roles below.",
    mode: "buttons",
    maxSelectable: 1,
    allowRemove: true,
    embedColor: defaults.embedColor,
    footerText: defaults.footerText,
    thumbnailUrl: defaults.thumbnailUrl,
    imageUrl: defaults.imageUrl,
    useWebhook: defaults.useWebhook,
    webhookName: defaults.webhookName,
    webhookAvatarUrl: defaults.webhookAvatarUrl,
    options: [newOption()],
  };
}

function cloneImportedSelfrolesConfig(source: Partial<Config>, sourceGuildName: string): Config {
  const importedDefaults = {
    ...DEFAULTS.panelDefaults,
    ...(source.panelDefaults || {}),
  };
  const stamp = new Date().toLocaleString();

  return {
    active: source.active !== false,
    requireVerification: Boolean(source.requireVerification),
    verificationRoleId: "",
    maxRolesPerUser: Number(source.maxRolesPerUser || DEFAULTS.maxRolesPerUser),
    antiAbuseCooldownSec: Number(source.antiAbuseCooldownSec || DEFAULTS.antiAbuseCooldownSec),
    logChannelId: "",
    usageLogging: {
      ...DEFAULTS.usageLogging,
      ...((source as any).usageLogging || {}),
    },
    panelDefaults: importedDefaults,
    panels: Array.isArray(source.panels)
      ? source.panels.map((panel, panelIndex) => ({
          ...newPanel(importedDefaults),
          ...panel,
          id: String(panel?.id || `panel_${panelIndex + 1}`),
          channelId: "",
          options: Array.isArray(panel?.options)
            ? panel.options.map((option) => ({
                ...newOption(),
                ...option,
                roleId: "",
              }))
            : [],
        }))
      : [],
    notes: [source.notes?.trim(), `Imported from ${sourceGuildName} on ${stamp}. Role and channel IDs were cleared for remapping.`]
      .filter(Boolean)
      .join("\n\n"),
    updatedAt: "",
  };
}

export default function SelfrolesPage() {
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
    runAction,
  } = useGuildEngineEditor<Config>("selfroles", DEFAULTS);
  const [availableGuilds, setAvailableGuilds] = useState<GuildOption[]>([]);
  const [sourceGuildId, setSourceGuildId] = useState("");
  const [importing, setImporting] = useState(false);
  const [importMessage, setImportMessage] = useState("");

  const textChannels = (channels as GuildChannel[]).filter(
    (channel) => Number(channel?.type) === 0 || Number(channel?.type) === 5 || String(channel?.type || "").toLowerCase().includes("text")
  );
  const importableGuilds = useMemo(
    () => availableGuilds.filter((guild) => guild.id && guild.id !== guildId),
    [availableGuilds, guildId]
  );

  useEffect(() => {
    let alive = true;

    async function loadAvailableGuilds() {
      try {
        const res = await fetch("/api/guilds/installed", { cache: "no-store" });
        const json = await res.json().catch(() => ({}));
        if (!alive) return;
        const guilds = Array.isArray(json?.guilds) ? json.guilds : [];
        const nextGuilds = guilds
          .map((guild: any) => ({
            id: String(guild?.id || "").trim(),
            name: String(guild?.name || guild?.id || "").trim(),
            botPresent: guild?.botPresent !== false,
          }))
          .filter((guild: GuildOption) => guild.id && guild.botPresent !== false)
          .sort((a: GuildOption, b: GuildOption) => a.name.localeCompare(b.name));
        setAvailableGuilds(nextGuilds);

        if (!sourceGuildId && nextGuilds.length) {
          const saviors = nextGuilds.find((guild: GuildOption) => /saviors/i.test(guild.name));
          setSourceGuildId((saviors || nextGuilds[0]).id);
        }
      } catch {
        if (!alive) return;
        setAvailableGuilds([]);
      }
    }

    void loadAvailableGuilds();
    return () => {
      alive = false;
    };
  }, [sourceGuildId]);

  async function importFromGuild() {
    if (!guildId) return;
    const selected = importableGuilds.find((guild) => guild.id === sourceGuildId);
    if (!selected) {
      setImportMessage("Pick a source guild first.");
      return;
    }

    const confirmed = typeof window === "undefined"
      ? true
      : window.confirm(
          `Import all selfroles from ${selected.name}? This replaces the current selfroles template on this page. Channel IDs, log channel, verification role, and panel role IDs will be cleared so you can remap them for this guild.`
        );
    if (!confirmed) return;

    setImporting(true);
    setImportMessage("");
    try {
      const res = await fetch(`/api/bot/engine-config?guildId=${encodeURIComponent(selected.id)}&engine=selfroles`, {
        cache: "no-store",
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json?.success === false) {
        throw new Error(json?.error || "Failed to load source selfroles config.");
      }

      const imported = cloneImportedSelfrolesConfig(json?.config || {}, selected.name);
      setCfg(imported);
      setImportMessage(
        `Imported ${imported.panels.length} selfrole panel${imported.panels.length === 1 ? "" : "s"} from ${selected.name}. Role and channel mappings were cleared for this guild.`
      );
    } catch (err: any) {
      setImportMessage(err?.message || "Failed to import selfroles.");
    } finally {
      setImporting(false);
    }
  }

  function addPanel() {
    setCfg({ ...cfg, panels: [...(cfg.panels || []), newPanel(cfg.panelDefaults || DEFAULTS.panelDefaults)] });
  }

  function removePanel(index: number) {
    setCfg({ ...cfg, panels: (cfg.panels || []).filter((_, panelIndex) => panelIndex !== index) });
  }

  function updatePanel(index: number, patch: Partial<Panel>) {
    const next = [...(cfg.panels || [])];
    next[index] = { ...next[index], ...patch };
    setCfg({ ...cfg, panels: next });
  }

  function addOption(panelIndex: number) {
    const next = [...(cfg.panels || [])];
    next[panelIndex] = { ...next[panelIndex], options: [...(next[panelIndex].options || []), newOption()] };
    setCfg({ ...cfg, panels: next });
  }

  function updateOption(panelIndex: number, optionIndex: number, patch: Partial<RoleOption>) {
    const next = [...(cfg.panels || [])];
    const options = [...(next[panelIndex].options || [])];
    options[optionIndex] = { ...options[optionIndex], ...patch };
    next[panelIndex] = { ...next[panelIndex], options };
    setCfg({ ...cfg, panels: next });
  }

  function removeOption(panelIndex: number, optionIndex: number) {
    const next = [...(cfg.panels || [])];
    next[panelIndex] = { ...next[panelIndex], options: (next[panelIndex].options || []).filter((_, index) => index !== optionIndex) };
    setCfg({ ...cfg, panels: next });
  }

  if (!guildId) return <div style={{ color: "#ff8a8a", padding: 20 }}>Missing guildId. Open from /guilds.</div>;
  if (loading) return <div style={{ color: "#ff8a8a", padding: 20 }}>Loading selfroles...</div>;

  return (
    <div style={{ color: "#ffb3b3", padding: 14, maxWidth: 1300 }}>
      <h1 style={{ marginTop: 0, color: "#ff3b3b", letterSpacing: "0.08em", textTransform: "uppercase" }}>Selfroles Studio</h1>
      <p style={{ marginTop: 0 }}>Guild: {guildName || guildId}</p>
      {message ? <div style={{ color: "#ffb3f0", marginBottom: 8 }}>{message}</div> : null}
      {importMessage ? <div style={{ color: "#9ee493", marginBottom: 8 }}>{importMessage}</div> : null}

      <EngineInsights summary={summary} details={details} />

      <div style={box}>
        <h3 style={{ marginTop: 0, color: "#ff4444" }}>Import From Another Guild</h3>
        <p style={{ marginTop: 0, marginBottom: 10, color: "#ffd7d7" }}>
          Copy a full selfroles setup from Saviors or any other installed guild, then just remap the roles and channels for this server.
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "minmax(240px, 1fr) auto", gap: 10, alignItems: "end" }}>
          <div>
            <label>Source guild</label>
            <select style={input} value={sourceGuildId} onChange={(e) => setSourceGuildId(e.target.value)}>
              <option value="">Select guild</option>
              {importableGuilds.map((guild) => (
                <option key={guild.id} value={guild.id}>
                  {guild.name}
                </option>
              ))}
            </select>
          </div>
          <button
            onClick={() => void importFromGuild()}
            disabled={importing || !sourceGuildId}
            style={{ padding: "10px 14px", borderRadius: 8, border: "1px solid #7a0000", background: "#220000", color: "#ffd7d7", minWidth: 220 }}
          >
            {importing ? "Importing..." : "Import Selfroles Template"}
          </button>
        </div>
        <div style={{ marginTop: 10, color: "#ffb3b3", fontSize: 13 }}>
          Preserved: panel layout, text, emoji, button styles, embed styling, webhook styling, defaults, and limits.
          <br />
          Cleared on purpose: panel role IDs, panel channel IDs, log channel, and verification role, so this guild can be remapped cleanly.
        </div>
      </div>

      <div style={box}>
        <label><input type="checkbox" checked={cfg.active} onChange={(e) => setCfg({ ...cfg, active: e.target.checked })} /> Selfroles active</label><br />
        <label><input type="checkbox" checked={cfg.requireVerification} onChange={(e) => setCfg({ ...cfg, requireVerification: e.target.checked })} /> Require verification role first</label>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(180px, 1fr))", gap: 10, marginTop: 10 }}>
          <div>
            <label>Verification role</label>
            <select style={input} value={cfg.verificationRoleId} onChange={(e) => setCfg({ ...cfg, verificationRoleId: e.target.value })}>
              <option value="">Select role</option>
              {(roles as GuildRole[]).map((role) => <option key={role.id} value={role.id}>@{role.name}</option>)}
            </select>
          </div>
          <div><label>Max roles/user</label><input style={input} type="number" value={cfg.maxRolesPerUser} onChange={(e) => setCfg({ ...cfg, maxRolesPerUser: Number(e.target.value || 0) })} /></div>
          <div><label>Cooldown sec</label><input style={input} type="number" value={cfg.antiAbuseCooldownSec} onChange={(e) => setCfg({ ...cfg, antiAbuseCooldownSec: Number(e.target.value || 0) })} /></div>
          <div>
            <label>Discord selfroles log channel</label>
            <select style={input} value={cfg.logChannelId} onChange={(e) => setCfg({ ...cfg, logChannelId: e.target.value })}>
              <option value="">Select channel</option>
              {textChannels.map((channel) => <option key={channel.id} value={channel.id}>#{channel.name}</option>)}
            </select>
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(220px, 1fr))", gap: 10, marginTop: 10 }}>
          <div>
            <label>Default embed color</label>
            <input style={input} value={cfg.panelDefaults?.embedColor || ""} onChange={(e) => setCfg({ ...cfg, panelDefaults: { ...cfg.panelDefaults, embedColor: e.target.value } })} placeholder="#2b2d31" />
          </div>
          <div>
            <label>Default footer</label>
            <input style={input} value={cfg.panelDefaults?.footerText || ""} onChange={(e) => setCfg({ ...cfg, panelDefaults: { ...cfg.panelDefaults, footerText: e.target.value } })} />
          </div>
          <div>
            <label><input type="checkbox" checked={Boolean(cfg.panelDefaults?.useWebhook)} onChange={(e) => setCfg({ ...cfg, panelDefaults: { ...cfg.panelDefaults, useWebhook: e.target.checked } })} /> Default to webhook deploy</label>
          </div>
          <div>
            <label>Default thumbnail URL</label>
            <input style={input} value={cfg.panelDefaults?.thumbnailUrl || ""} onChange={(e) => setCfg({ ...cfg, panelDefaults: { ...cfg.panelDefaults, thumbnailUrl: e.target.value } })} placeholder="https://..." />
          </div>
          <div>
            <label>Default image URL</label>
            <input style={input} value={cfg.panelDefaults?.imageUrl || ""} onChange={(e) => setCfg({ ...cfg, panelDefaults: { ...cfg.panelDefaults, imageUrl: e.target.value } })} placeholder="https://..." />
          </div>
          <div>
            <label>Default webhook name</label>
            <input style={input} value={cfg.panelDefaults?.webhookName || ""} onChange={(e) => setCfg({ ...cfg, panelDefaults: { ...cfg.panelDefaults, webhookName: e.target.value } })} placeholder="Leave blank to use Bot Personalizer" />
          </div>
          <div style={{ gridColumn: "1 / -1" }}>
            <label>Default webhook avatar URL</label>
            <input style={input} value={cfg.panelDefaults?.webhookAvatarUrl || ""} onChange={(e) => setCfg({ ...cfg, panelDefaults: { ...cfg.panelDefaults, webhookAvatarUrl: e.target.value } })} placeholder="https://..." />
          </div>
        </div>
      </div>

      <div style={box}>
        <h3 style={{ marginTop: 0, color: "#ff4444" }}>Panels</h3>
        <button onClick={addPanel} style={{ marginBottom: 10, padding: "8px 10px", borderRadius: 8, border: "1px solid #7a0000", background: "#1a0000", color: "#ffd7d7" }}>+ Add Panel</button>

        {(cfg.panels || []).map((panel, panelIndex) => (
          <div key={panel.id + panelIndex} style={{ border: "1px solid #4f0000", borderRadius: 10, padding: 10, marginBottom: 10 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr auto", gap: 8, alignItems: "center" }}>
              <input style={input} value={panel.messageTitle} onChange={(e) => updatePanel(panelIndex, { messageTitle: e.target.value })} />
              <select style={input} value={panel.channelId} onChange={(e) => updatePanel(panelIndex, { channelId: e.target.value })}>
                <option value="">Select channel</option>
                {textChannels.map((channel) => <option key={channel.id} value={channel.id}>#{channel.name}</option>)}
              </select>
              <select style={input} value={panel.mode} onChange={(e) => updatePanel(panelIndex, { mode: e.target.value as Panel["mode"] })}>
                <option value="buttons">buttons</option>
                <option value="select">select</option>
              </select>
              <input style={input} type="number" value={panel.maxSelectable} onChange={(e) => updatePanel(panelIndex, { maxSelectable: Number(e.target.value || 1) })} />
              <button onClick={() => removePanel(panelIndex)} style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid #7a0000", background: "#220000", color: "#ffd7d7" }}>Remove</button>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 200px 180px", gap: 8, marginTop: 8 }}>
              <textarea style={{ ...input, minHeight: 58 }} value={panel.messageBody} onChange={(e) => updatePanel(panelIndex, { messageBody: e.target.value })} />
              <label><input type="checkbox" checked={panel.enabled} onChange={(e) => updatePanel(panelIndex, { enabled: e.target.checked })} /> panel enabled</label>
              <label><input type="checkbox" checked={panel.allowRemove} onChange={(e) => updatePanel(panelIndex, { allowRemove: e.target.checked })} /> allow remove role</label>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(220px, 1fr))", gap: 8, marginTop: 8 }}>
              <div>
                <label>Embed color</label>
                <input style={input} value={panel.embedColor || ""} onChange={(e) => updatePanel(panelIndex, { embedColor: e.target.value })} placeholder="#2b2d31" />
              </div>
              <div>
                <label>Footer text</label>
                <input style={input} value={panel.footerText || ""} onChange={(e) => updatePanel(panelIndex, { footerText: e.target.value })} />
              </div>
              <div style={{ display: "flex", alignItems: "end" }}>
                <label><input type="checkbox" checked={Boolean(panel.useWebhook)} onChange={(e) => updatePanel(panelIndex, { useWebhook: e.target.checked })} /> deploy with webhook identity</label>
              </div>
              <div>
                <label>Thumbnail URL</label>
                <input style={input} value={panel.thumbnailUrl || ""} onChange={(e) => updatePanel(panelIndex, { thumbnailUrl: e.target.value })} placeholder="https://..." />
              </div>
              <div>
                <label>Image URL</label>
                <input style={input} value={panel.imageUrl || ""} onChange={(e) => updatePanel(panelIndex, { imageUrl: e.target.value })} placeholder="https://..." />
              </div>
              <div>
                <label>Webhook name</label>
                <input style={input} value={panel.webhookName || ""} onChange={(e) => updatePanel(panelIndex, { webhookName: e.target.value })} placeholder="Uses Bot Personalizer if blank" />
              </div>
              <div style={{ gridColumn: "1 / -1" }}>
                <label>Webhook avatar URL</label>
                <input style={input} value={panel.webhookAvatarUrl || ""} onChange={(e) => updatePanel(panelIndex, { webhookAvatarUrl: e.target.value })} placeholder="https://..." />
              </div>
            </div>

            <div style={{ marginTop: 10 }}>
              <button onClick={() => addOption(panelIndex)} style={{ marginBottom: 8, padding: "8px 10px", borderRadius: 8, border: "1px solid #7a0000", background: "#1a0000", color: "#ffd7d7" }}>
                + Add Role Option
              </button>
              {(panel.options || []).map((option, optionIndex) => (
                <div key={optionIndex} style={{ display: "grid", gridTemplateColumns: "1fr 1fr 120px 140px 1fr auto", gap: 8, marginBottom: 6, alignItems: "center" }}>
                  <select style={input} value={option.roleId} onChange={(e) => updateOption(panelIndex, optionIndex, { roleId: e.target.value })}>
                    <option value="">Select role</option>
                    {(roles as GuildRole[]).map((role) => <option key={role.id} value={role.id}>@{role.name}</option>)}
                  </select>
                  <input style={input} placeholder="label" value={option.label} onChange={(e) => updateOption(panelIndex, optionIndex, { label: e.target.value })} />
                  <input style={input} placeholder="emoji" value={option.emoji} onChange={(e) => updateOption(panelIndex, optionIndex, { emoji: e.target.value })} />
                  <select style={input} value={option.style} onChange={(e) => updateOption(panelIndex, optionIndex, { style: e.target.value as RoleOption["style"] })}>
                    <option value="primary">primary</option>
                    <option value="secondary">secondary</option>
                    <option value="success">success</option>
                    <option value="danger">danger</option>
                  </select>
                  <input style={input} placeholder="description" value={option.description} onChange={(e) => updateOption(panelIndex, optionIndex, { description: e.target.value })} />
                  <button onClick={() => removeOption(panelIndex, optionIndex)} style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid #7a0000", background: "#220000", color: "#ffd7d7" }}>X</button>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div style={box}>
        <label>Notes</label>
        <textarea style={{ ...input, minHeight: 90 }} value={cfg.notes} onChange={(e) => setCfg({ ...cfg, notes: e.target.value })} />
      </div>

      <ConfigJsonEditor
        title="Advanced Selfroles Config"
        value={cfg}
        disabled={saving}
        onApply={(next) => setCfg({ ...DEFAULTS, ...(next as Config) })}
      />

      <div style={{ position: "fixed", right: 18, bottom: 18, zIndex: 40, border: "1px solid #7a0000", borderRadius: 12, padding: 10, background: "rgba(20,0,0,0.95)", display: "flex", alignItems: "center", gap: 8 }}>
        <button onClick={() => void runAction("deployPanels")} disabled={saving} style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #7a0000", background: "#220000", color: "#ffd7d7" }}>
          Deploy Panels
        </button>
        <button onClick={() => void save()} disabled={saving} style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #7a0000", background: "#220000", color: "#ffd7d7" }}>
          {saving ? "Saving..." : "Save Selfroles"}
        </button>
      </div>
    </div>
  );
}
