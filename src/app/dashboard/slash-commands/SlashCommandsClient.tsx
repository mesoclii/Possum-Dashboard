"use client";

import Link from "next/link";
import { CSSProperties, useCallback, useEffect, useMemo, useState } from "react";
import { buildDashboardHref, readDashboardGuildId } from "@/lib/dashboardContext";

type GuildRole = { id: string; name: string; position?: number };
type GuildChannel = { id: string; name: string; type?: number | string };

type CommandEntry = {
  key: string;
  parentKey: string;
  kind: "command" | "group" | "subcommand";
  commandName: string;
  subcommandGroup?: string;
  subcommand?: string;
  title: string;
  description: string;
  executable: boolean;
  accessTarget: string;
  defaultRequiredLevelName: string;
  optionSummary: string[];
};

type NativeRule = {
  enabled: boolean;
  requiredLevel: string;
  requiredRoleIds: string[];
  blockedRoleIds: string[];
  allowedChannelIds: string[];
  blockedChannelIds: string[];
  cooldownSec: number;
  hideFromHelp: boolean;
  denyMessage: string;
  note: string;
};

type NativeConfig = {
  active: boolean;
  slashEnabled: boolean;
  logChannelId: string;
  notes: string;
  rules: Record<string, NativeRule>;
  renames: Record<string, string>;
};

type RenameDiagnostic = {
  key: string;
  attemptedName: string;
  code: string;
  message: string;
};

type DeployedTopLevelCommand = {
  key: string;
  name: string;
  renamed: boolean;
};

type DeploymentEntryState = {
  key: string;
  deployed: boolean;
  hasExplicitRule: boolean;
  explicitRuleKey: string;
  inheritedDisabledBy: string;
  enabled: boolean;
  overlapTarget: string;
  overlapSize: number;
  deployedName?: string;
  renamed?: boolean;
};

type OverlapGroup = {
  accessTarget: string;
  entries: Array<{
    key: string;
    title: string;
    description: string;
    commandName: string;
    kind: string;
    parentKey: string;
  }>;
};

type NativeDeployment = {
  guildId: string;
  active: boolean;
  slashEnabled: boolean;
  deployedTopLevelCommandNames: string[];
  deployedTopLevelCommands: DeployedTopLevelCommand[];
  deployedKeys: string[];
  overlapGroups: OverlapGroup[];
  entryStates: Record<string, DeploymentEntryState>;
  renames: Record<string, string>;
  renameDiagnostics: RenameDiagnostic[];
  summary: {
    configuredRuleCount: number;
    deployedTopLevelCount: number;
    deployedEntryCount: number;
    overlapGroupCount: number;
    activeRenameCount: number;
  };
};

type NativeResponse = {
  success?: boolean;
  registry?: {
    entries?: CommandEntry[];
  };
  config?: NativeConfig;
  deployment?: Partial<NativeDeployment>;
};

const LEVEL_OPTIONS = [
  "PUBLIC",
  "VERIFIED",
  "SUPPORTER",
  "VIP",
  "SUPPORT_STAFF",
  "ADMIN",
  "FOUNDER",
  "CO_OWNER",
  "OWNER",
];

const AUDIENCE_PRESETS = [
  { id: "EVERYONE", label: "Everyone", level: "PUBLIC", help: "Visible to everyone who can use the bot." },
  { id: "MEMBERS", label: "Members Only", level: "VERIFIED", help: "Member-facing command. Good default for normal community tools." },
  { id: "STAFF", label: "Staff Only", level: "SUPPORT_STAFF", help: "Staff-facing command without opening it to regular members." },
  { id: "ADMINS", label: "Admins Only", level: "ADMIN", help: "Admin-only command for higher risk actions." },
  { id: "CUSTOM", label: "Custom", level: "", help: "Use the raw level + role controls below for advanced tuning." },
] as const;

const SLASH_COMMAND_NAME_RE = /^[a-z0-9_-]{1,32}$/;

const shell: CSSProperties = {
  color: "#ffd0d0",
  maxWidth: 1520,
};

const card: CSSProperties = {
  border: "1px solid #5f0000",
  borderRadius: 12,
  padding: 14,
  background: "rgba(120,0,0,0.08)",
};

const input: CSSProperties = {
  width: "100%",
  background: "#0c0c0c",
  color: "#ffd6d6",
  border: "1px solid #7f0000",
  borderRadius: 8,
  padding: "9px 10px",
};

const button: CSSProperties = {
  border: "1px solid #a30000",
  borderRadius: 10,
  background: "#1a0000",
  color: "#ffcccc",
  padding: "8px 12px",
  cursor: "pointer",
  fontWeight: 700,
};

function sanitizeSlashCommandInput(value: string) {
  return String(value || "")
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9_-]/g, "")
    .slice(0, 32);
}

function normalizeRenameMap(raw: any, entries: CommandEntry[]) {
  const next: Record<string, string> = {};
  const source = raw && typeof raw === "object" ? raw : {};
  const commandKeys = new Set(entries.filter((entry) => entry.kind === "command").map((entry) => entry.key));
  for (const [key, value] of Object.entries(source)) {
    if (!commandKeys.has(key)) continue;
    const normalized = String(value || "").trim().toLowerCase();
    if (!normalized) continue;
    next[key] = normalized;
  }
  return next;
}

function buildRenamePreview(entries: CommandEntry[], config: NativeConfig) {
  const commands = entries.filter((entry) =>
    entry.kind === "command" &&
    config.active !== false &&
    config.slashEnabled !== false &&
    config.rules?.[entry.key]?.enabled !== false
  );
  const accepted: Record<string, string> = {};
  const diagnostics: RenameDiagnostic[] = [];
  const pending: Array<{ key: string; requestedName: string }> = [];
  const reservedCanonicalNames = new Set<string>();

  for (const entry of commands) {
    const canonicalName = String(entry.key || "").trim().toLowerCase();
    const requestedName = String(config.renames?.[canonicalName] || "").trim().toLowerCase();

    if (!requestedName || requestedName === canonicalName) {
      reservedCanonicalNames.add(canonicalName);
      continue;
    }

    if (!SLASH_COMMAND_NAME_RE.test(requestedName)) {
      diagnostics.push({
        key: canonicalName,
        attemptedName: requestedName,
        code: "invalid_name",
        message: `/${requestedName} is invalid for ${canonicalName}. Use 1-32 lowercase letters, numbers, hyphens, or underscores.`,
      });
      reservedCanonicalNames.add(canonicalName);
      continue;
    }

    pending.push({ key: canonicalName, requestedName });
  }

  const claimedRenameNames = new Set<string>();
  for (const item of pending) {
    if (reservedCanonicalNames.has(item.requestedName)) {
      diagnostics.push({
        key: item.key,
        attemptedName: item.requestedName,
        code: "reserved_conflict",
        message: `/${item.requestedName} is already used by another live command in this guild.`,
      });
      continue;
    }

    if (claimedRenameNames.has(item.requestedName)) {
      diagnostics.push({
        key: item.key,
        attemptedName: item.requestedName,
        code: "duplicate_rename",
        message: `/${item.requestedName} is already claimed by another custom slash rename in this guild.`,
      });
      continue;
    }

    claimedRenameNames.add(item.requestedName);
    accepted[item.key] = item.requestedName;
  }

  return { accepted, diagnostics };
}

function emptyRule(entry?: CommandEntry | null): NativeRule {
  return {
    enabled: true,
    requiredLevel: entry?.defaultRequiredLevelName || "VERIFIED",
    requiredRoleIds: [],
    blockedRoleIds: [],
    allowedChannelIds: [],
    blockedChannelIds: [],
    cooldownSec: 0,
    hideFromHelp: false,
    denyMessage: "This slash command is disabled or restricted in this server.",
    note: "",
  };
}

function normalizeConfig(raw: any, entries: CommandEntry[]): NativeConfig {
  const next: NativeConfig = {
    active: raw?.active !== false,
    slashEnabled: raw?.slashEnabled !== false,
    logChannelId: String(raw?.logChannelId || ""),
    notes: String(raw?.notes || ""),
    rules: {},
    renames: normalizeRenameMap(raw?.renames, entries),
  };

  const source = raw?.rules && typeof raw.rules === "object" ? raw.rules : {};
  for (const entry of entries) {
    if (!source[entry.key]) continue;
    next.rules[entry.key] = {
      ...emptyRule(entry),
      ...source[entry.key],
      requiredRoleIds: Array.isArray(source[entry.key]?.requiredRoleIds) ? source[entry.key].requiredRoleIds : [],
      blockedRoleIds: Array.isArray(source[entry.key]?.blockedRoleIds) ? source[entry.key].blockedRoleIds : [],
      allowedChannelIds: Array.isArray(source[entry.key]?.allowedChannelIds) ? source[entry.key].allowedChannelIds : [],
      blockedChannelIds: Array.isArray(source[entry.key]?.blockedChannelIds) ? source[entry.key].blockedChannelIds : [],
      cooldownSec: Number(source[entry.key]?.cooldownSec || 0) || 0,
      denyMessage: String(source[entry.key]?.denyMessage || emptyRule(entry).denyMessage),
      note: String(source[entry.key]?.note || ""),
    };
  }

  return next;
}

function toggleId(list: string[], id: string) {
  return list.includes(id) ? list.filter((value) => value !== id) : [...list, id];
}

function getAudiencePreset(requiredLevel: string) {
  const normalized = String(requiredLevel || "").trim().toUpperCase();
  if (normalized === "PUBLIC") return "EVERYONE";
  if (normalized === "VERIFIED") return "MEMBERS";
  if (normalized === "SUPPORT_STAFF") return "STAFF";
  if (normalized === "ADMIN") return "ADMINS";
  return "CUSTOM";
}

function getAudiencePresetMeta(requiredLevel: string) {
  const preset = getAudiencePreset(requiredLevel);
  return AUDIENCE_PRESETS.find((item) => item.id === preset) || AUDIENCE_PRESETS[AUDIENCE_PRESETS.length - 1];
}

function emptyDeployment(entries: CommandEntry[]): NativeDeployment {
  const entryStates = Object.fromEntries(
    entries.map((entry) => [
      entry.key,
      {
        key: entry.key,
        deployed: false,
        hasExplicitRule: false,
        explicitRuleKey: "",
        inheritedDisabledBy: "",
        enabled: true,
        overlapTarget: "",
        overlapSize: 0,
      },
    ])
  );

  return {
    guildId: "",
    active: true,
    slashEnabled: true,
    deployedTopLevelCommandNames: [],
    deployedTopLevelCommands: [],
    deployedKeys: [],
    overlapGroups: [],
    entryStates,
    renames: {},
    renameDiagnostics: [],
    summary: {
      configuredRuleCount: 0,
      deployedTopLevelCount: 0,
      deployedEntryCount: 0,
      overlapGroupCount: 0,
      activeRenameCount: 0,
    },
  };
}

function normalizeDeployment(raw: any, entries: CommandEntry[]): NativeDeployment {
  const fallback = emptyDeployment(entries);
  const incomingStates = raw?.entryStates && typeof raw.entryStates === "object" ? raw.entryStates : {};
  const deployedTopLevelCommands = Array.isArray(raw?.deployedTopLevelCommands) && raw.deployedTopLevelCommands.length
    ? raw.deployedTopLevelCommands
    : Array.isArray(raw?.deployedTopLevelCommandNames)
      ? raw.deployedTopLevelCommandNames.map((name: string) => ({ key: name, name, renamed: false }))
      : [];
  const entryStates = { ...fallback.entryStates };

  for (const entry of entries) {
    entryStates[entry.key] = {
      ...fallback.entryStates[entry.key],
      ...(incomingStates[entry.key] || {}),
      key: entry.key,
    };
  }

  return {
    guildId: String(raw?.guildId || ""),
    active: raw?.active !== false,
    slashEnabled: raw?.slashEnabled !== false,
    deployedTopLevelCommandNames: Array.isArray(raw?.deployedTopLevelCommandNames) ? raw.deployedTopLevelCommandNames : [],
    deployedTopLevelCommands,
    deployedKeys: Array.isArray(raw?.deployedKeys) ? raw.deployedKeys : [],
    overlapGroups: Array.isArray(raw?.overlapGroups) ? raw.overlapGroups : [],
    entryStates,
    renames: normalizeRenameMap(raw?.renames, entries),
    renameDiagnostics: Array.isArray(raw?.renameDiagnostics) ? raw.renameDiagnostics : [],
    summary: {
      configuredRuleCount: Number(raw?.summary?.configuredRuleCount || 0) || 0,
      deployedTopLevelCount: Number(raw?.summary?.deployedTopLevelCount || 0) || 0,
      deployedEntryCount: Number(raw?.summary?.deployedEntryCount || 0) || 0,
      overlapGroupCount: Number(raw?.summary?.overlapGroupCount || 0) || 0,
      activeRenameCount: Number(raw?.summary?.activeRenameCount || 0) || 0,
    },
  };
}

function kindLabel(kind: string) {
  if (kind === "subcommand") return "Subcommand";
  if (kind === "group") return "Group";
  return "Command";
}

export default function SlashCommandsClient() {
  const [guildId, setGuildId] = useState("");
  const [guildName, setGuildName] = useState("");
  const [roles, setRoles] = useState<GuildRole[]>([]);
  const [channels, setChannels] = useState<GuildChannel[]>([]);
  const [entries, setEntries] = useState<CommandEntry[]>([]);
  const [config, setConfig] = useState<NativeConfig>({ active: true, slashEnabled: true, logChannelId: "", notes: "", rules: {}, renames: {} });
  const [deployment, setDeployment] = useState<NativeDeployment>(emptyDeployment([]));
  const [selectedKey, setSelectedKey] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const nextGuildId = readDashboardGuildId();
    setGuildId(nextGuildId);
    if (typeof window !== "undefined") {
      setGuildName(localStorage.getItem("activeGuildName") || "");
    }
  }, []);

  const loadAll = useCallback(async (targetGuildId: string, options?: { preserveMessage?: boolean }) => {
    if (!targetGuildId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      if (!options?.preserveMessage) {
        setMessage("");
      }

      const [registryRes, guildRes] = await Promise.all([
        fetch(`/api/bot/native-commands?guildId=${encodeURIComponent(targetGuildId)}&bust=${Date.now()}`, { cache: "no-store" }),
        fetch(`/api/bot/guild-data?guildId=${encodeURIComponent(targetGuildId)}`, { cache: "no-store" }),
      ]);

      const registryJson: NativeResponse = await registryRes.json().catch(() => ({}));
      const guildJson = await guildRes.json().catch(() => ({}));

      if (!registryRes.ok || registryJson?.success === false) {
        throw new Error((registryJson as any)?.error || "Failed to load slash commands.");
      }

      const nextEntries = Array.isArray(registryJson?.registry?.entries) ? registryJson.registry.entries : [];
      setEntries(nextEntries);
      setConfig(normalizeConfig(registryJson?.config || {}, nextEntries));
      setDeployment(normalizeDeployment(registryJson?.deployment || {}, nextEntries));

      if (!selectedKey && nextEntries.length) {
        const preferred = nextEntries.find((entry) => entry.executable) || nextEntries[0];
        setSelectedKey(preferred.key);
      }

      const nextRoles = Array.isArray(guildJson?.roles) ? guildJson.roles : [];
      nextRoles.sort((a: GuildRole, b: GuildRole) => (Number(b.position || 0) - Number(a.position || 0)) || a.name.localeCompare(b.name));
      setRoles(nextRoles);

      const nextChannels = Array.isArray(guildJson?.channels) ? guildJson.channels : [];
      setChannels(nextChannels.filter((channel: GuildChannel) => [0, 5].includes(Number(channel.type || 0))));

      const nextGuildName = String(guildJson?.guild?.name || "").trim();
      if (nextGuildName) {
        setGuildName(nextGuildName);
        localStorage.setItem("activeGuildName", nextGuildName);
      }
    } catch (err: any) {
      setMessage(err?.message || "Failed to load slash commands.");
    } finally {
      setLoading(false);
    }
  }, [selectedKey]);

  useEffect(() => {
    void loadAll(guildId);
  }, [guildId, loadAll]);

  const filteredEntries = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return entries;
    return entries.filter((entry) =>
      `${entry.key} ${entry.title} ${entry.description} ${entry.accessTarget}`.toLowerCase().includes(query)
    );
  }, [entries, search]);

  const entryMap = useMemo(
    () => Object.fromEntries(entries.map((entry) => [entry.key, entry])),
    [entries]
  );

  const renamePreview = useMemo(
    () => buildRenamePreview(entries, config),
    [entries, config]
  );

  const selectedEntry = useMemo(
    () => entries.find((entry) => entry.key === selectedKey) || null,
    [entries, selectedKey]
  );

  const selectedRule = useMemo(() => {
    if (!selectedEntry) return emptyRule();
    return config.rules[selectedEntry.key] || emptyRule(selectedEntry);
  }, [config.rules, selectedEntry]);

  const selectedState = useMemo(() => {
    if (!selectedEntry) return null;
    return deployment.entryStates?.[selectedEntry.key] || null;
  }, [deployment.entryStates, selectedEntry]);

  const selectedRenameValue = useMemo(() => {
    if (!selectedEntry || selectedEntry.kind !== "command") return "";
    return config.renames[selectedEntry.key] || "";
  }, [config.renames, selectedEntry]);

  const selectedLiveCommandName = useMemo(() => {
    if (!selectedEntry) return "";
    return selectedState?.deployedName || selectedEntry.commandName;
  }, [selectedEntry, selectedState]);

  const selectedRenameDiagnostic = useMemo(() => {
    if (!selectedEntry || selectedEntry.kind !== "command") return null;
    return renamePreview.diagnostics.find((item) => item.key === selectedEntry.key) || null;
  }, [renamePreview.diagnostics, selectedEntry]);

  const selectedAudiencePreset = useMemo(
    () => getAudiencePreset(selectedRule.requiredLevel),
    [selectedRule.requiredLevel]
  );

  const selectedOverlapGroup = useMemo(() => {
    if (!selectedState?.overlapTarget) return null;
    return deployment.overlapGroups.find((group) => group.accessTarget === selectedState.overlapTarget) || null;
  }, [deployment.overlapGroups, selectedState]);

  function patchRule(patch: Partial<NativeRule>) {
    if (!selectedEntry) return;
    const nextRule = { ...selectedRule, ...patch };
    setConfig((prev) => ({
      ...prev,
      rules: {
        ...prev.rules,
        [selectedEntry.key]: nextRule,
      },
    }));
  }

  function resetSelectedRule() {
    if (!selectedEntry) return;
    setConfig((prev) => {
      const nextRules = { ...prev.rules };
      delete nextRules[selectedEntry.key];
      return { ...prev, rules: nextRules };
    });
  }

  function patchSelectedRename(value: string) {
    if (!selectedEntry || selectedEntry.kind !== "command") return;
    const nextValue = sanitizeSlashCommandInput(value);
    setConfig((prev) => {
      const nextRenames = { ...prev.renames };
      if (!nextValue || nextValue === selectedEntry.key) {
        delete nextRenames[selectedEntry.key];
      } else {
        nextRenames[selectedEntry.key] = nextValue;
      }
      return {
        ...prev,
        renames: nextRenames,
      };
    });
  }

  function resetSelectedRename() {
    if (!selectedEntry || selectedEntry.kind !== "command") return;
    setConfig((prev) => {
      const nextRenames = { ...prev.renames };
      delete nextRenames[selectedEntry.key];
      return {
        ...prev,
        renames: nextRenames,
      };
    });
  }

  function disableOverlapGroup() {
    if (!selectedOverlapGroup) return;
    setConfig((prev) => {
      const nextRules = { ...prev.rules };
      for (const item of selectedOverlapGroup.entries) {
        const entry = entryMap[item.key];
        if (!entry) continue;
        nextRules[item.key] = {
          ...emptyRule(entry),
          ...(prev.rules[item.key] || {}),
          enabled: false,
        };
      }
      return { ...prev, rules: nextRules };
    });
  }

  function resetOverlapGroup() {
    if (!selectedOverlapGroup) return;
    setConfig((prev) => {
      const nextRules = { ...prev.rules };
      for (const item of selectedOverlapGroup.entries) {
        delete nextRules[item.key];
      }
      return { ...prev, rules: nextRules };
    });
  }

  async function saveAll() {
    if (!guildId) return;
    setSaving(true);
    setMessage("");
    try {
      if (renamePreview.diagnostics.length) {
        throw new Error(renamePreview.diagnostics[0]?.message || "Fix your custom slash command names before saving.");
      }

      const res = await fetch("/api/bot/engine-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          guildId,
          engine: "nativeCommands",
          patch: config,
        }),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok || json?.success === false) {
        throw new Error(json?.error || "Failed to save slash commands.");
      }

      setConfig(normalizeConfig(json?.config || config, entries));
      if (json?.sync?.ok) {
        setMessage(`Saved slash command master. Synced ${Number(json.sync.count || 0)} slash commands to Discord.`);
      } else if (json?.sync?.error) {
        setMessage(`Saved slash command master, but Discord sync failed: ${json.sync.error}`);
      } else {
        setMessage("Saved slash command master.");
      }

      await loadAll(guildId, { preserveMessage: true });
    } catch (err: any) {
      setMessage(err?.message || "Failed to save slash commands.");
    } finally {
      setSaving(false);
    }
  }

  if (!guildId) {
    return <div style={{ color: "#ff6b6b", padding: 24 }}>Missing guildId. Open from `/guilds` first.</div>;
  }

  return (
    <div style={shell}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
        <div>
          <div style={{ color: "#ff9a9a", fontSize: 12, letterSpacing: "0.16em", textTransform: "uppercase" }}>Native Slash Control</div>
          <h1 style={{ margin: "8px 0 0", color: "#ff4a4a", letterSpacing: "0.10em", textTransform: "uppercase" }}>Slash Command Master</h1>
          <div style={{ color: "#ff9d9d", marginTop: 8 }}>Guild: {guildName || guildId}</div>
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Link href={buildDashboardHref("/dashboard/commands")} style={{ ...button, textDecoration: "none" }}>
            Open !Command Studio
          </Link>
          <button style={button} onClick={saveAll} disabled={saving}>
            {saving ? "Saving..." : "Save Slash Rules"}
          </button>
        </div>
      </div>

      <div style={{ marginTop: 12, color: "#ffb3b3", lineHeight: 1.7, maxWidth: 1100 }}>
        This tab controls the bot&apos;s built-in slash commands only. It does not touch your `!custom` command studio. You can disable,
        relock, channel-gate, cooldown, role-gate, and guild-rename native slash commands per server.
      </div>

      {message ? (
        <div style={{ ...card, marginTop: 14, color: "#ffb3f0" }}>
          {message}
        </div>
      ) : null}

      {loading ? (
        <div style={{ ...card, marginTop: 14 }}>Loading slash command registry...</div>
      ) : (
        <>
          <section style={{ ...card, marginTop: 14 }}>
            <h2 style={{ marginTop: 0, color: "#ff5f5f", letterSpacing: "0.08em", textTransform: "uppercase" }}>Global State</h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 12 }}>
              <label style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                <input type="checkbox" checked={config.active} onChange={(e) => setConfig((prev) => ({ ...prev, active: e.target.checked }))} />
                Command master active
              </label>
              <label style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                <input type="checkbox" checked={config.slashEnabled} onChange={(e) => setConfig((prev) => ({ ...prev, slashEnabled: e.target.checked }))} />
                Slash commands enabled
              </label>
              <div style={{ color: "#ffbcbc" }}>Registry entries: {entries.length}</div>
              <div style={{ color: "#ffbcbc" }}>Custom `!` commands: separate system</div>
              <div style={{ color: "#ffbcbc" }}>Active custom slash names: {renamePreview.diagnostics.length ? `${deployment.summary.activeRenameCount} live / ${renamePreview.diagnostics.length} blocked` : deployment.summary.activeRenameCount}</div>
            </div>
            <div style={{ marginTop: 12 }}>
              <label>Slash command audit log channel</label>
              <select
                style={input}
                value={config.logChannelId}
                onChange={(e) => setConfig((prev) => ({ ...prev, logChannelId: e.target.value }))}
              >
                <option value="">Use moderator audit channel</option>
                {channels.map((channel) => (
                  <option key={channel.id} value={channel.id}>#{channel.name}</option>
                ))}
              </select>
            </div>
            <div style={{ marginTop: 12 }}>
              <label>Operator Notes</label>
              <textarea
                style={{ ...input, minHeight: 90 }}
                value={config.notes}
                onChange={(e) => setConfig((prev) => ({ ...prev, notes: e.target.value }))}
              />
            </div>
          </section>

          <section style={{ ...card, marginTop: 14 }}>
            <h2 style={{ marginTop: 0, color: "#ff5f5f", letterSpacing: "0.08em", textTransform: "uppercase" }}>Live Deployment</h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 12 }}>
              <div style={{ color: "#ffbcbc" }}><b>Configured rules:</b> {deployment.summary.configuredRuleCount}</div>
              <div style={{ color: "#ffbcbc" }}><b>Deployed top-level commands:</b> {deployment.summary.deployedTopLevelCount}</div>
              <div style={{ color: "#ffbcbc" }}><b>Deployed registry entries:</b> {deployment.summary.deployedEntryCount}</div>
              <div style={{ color: "#ffbcbc" }}><b>Overlap groups:</b> {deployment.summary.overlapGroupCount}</div>
              <div style={{ color: "#ffbcbc" }}><b>Custom slash names live:</b> {deployment.summary.activeRenameCount}</div>
            </div>

            <div style={{ marginTop: 12, color: "#ffbcbc" }}>
              These are the slash commands the bot would register for this guild right now. Turning a command family off here removes it from the next guild sync without touching `!custom`.
            </div>

            <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap" }}>
              {deployment.deployedTopLevelCommands.length ? deployment.deployedTopLevelCommands.map((command) => (
                <button
                  key={command.key}
                  onClick={() => setSelectedKey(command.key)}
                  style={{
                    ...button,
                    padding: "6px 10px",
                    background: selectedKey === command.key ? "#2a0000" : "#140000",
                  }}
                >
                  /{command.name}
                </button>
              )) : (
                <div style={{ color: "#ff9d9d" }}>No slash commands are currently deployed for this guild.</div>
              )}
            </div>
            {deployment.renameDiagnostics.length ? (
              <div style={{ marginTop: 12, display: "grid", gap: 6 }}>
                {deployment.renameDiagnostics.map((item) => (
                  <div key={`${item.key}:${item.attemptedName}`} style={{ color: "#ffb3f0", fontSize: 13 }}>
                    Rename blocked for `/{item.key}`: {item.message}
                  </div>
                ))}
              </div>
            ) : null}
          </section>

          <section style={{ display: "grid", gridTemplateColumns: "360px 1fr", gap: 14, marginTop: 14 }}>
            <div style={card}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
                <h2 style={{ margin: 0, color: "#ff5f5f", letterSpacing: "0.08em", textTransform: "uppercase" }}>Registry</h2>
                <div style={{ color: "#ffbcbc", fontSize: 12 }}>{filteredEntries.length} shown</div>
              </div>

              <input
                style={{ ...input, marginTop: 12 }}
                placeholder="Search slash commands"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />

              <div style={{ marginTop: 12, display: "grid", gap: 8, maxHeight: 920, overflowY: "auto" }}>
                {filteredEntries.map((entry) => {
                  const explicitRule = config.rules[entry.key];
                  const enabled = explicitRule ? explicitRule.enabled : true;
                  const active = selectedKey === entry.key;
                  const state = deployment.entryStates?.[entry.key];
                  const effectiveEnabled = state ? state.enabled : enabled;
                  return (
                    <button
                      key={entry.key}
                      onClick={() => setSelectedKey(entry.key)}
                      style={{
                        ...button,
                        textAlign: "left",
                        background: active ? "#2a0000" : "#140000",
                        borderColor: active ? "#ff4a4a" : "#6f0000",
                        width: "100%",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                        <span>{entry.title}</span>
                        <span style={{ color: state?.deployed ? "#ffb3f0" : effectiveEnabled ? "#ffb3f0" : "#ff9d9d" }}>
                          {state?.deployed ? "Live" : effectiveEnabled ? "Ready" : "Off"}
                        </span>
                      </div>
                      <div style={{ marginTop: 6, fontSize: 12, color: "#ffbcbc" }}>
                        {kindLabel(entry.kind)} - {entry.key}
                      </div>
                      {entry.kind === "command" ? (
                        <div style={{ marginTop: 6, fontSize: 12, color: "#ffb3f0" }}>
                          Live slash: /{deployment.entryStates?.[entry.key]?.deployedName || entry.key}
                        </div>
                      ) : null}
                      {state?.overlapSize ? (
                        <div style={{ marginTop: 6, fontSize: 12, color: "#ffb3f0" }}>
                          Overlap set: {state.overlapTarget} ({state.overlapSize})
                        </div>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            </div>

            <div style={card}>
              {selectedEntry ? (
                <>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
                    <div>
                      <div style={{ color: "#ff9a9a", fontSize: 12, letterSpacing: "0.12em", textTransform: "uppercase" }}>{kindLabel(selectedEntry.kind)}</div>
                      <h2 style={{ margin: "8px 0 0", color: "#ff5f5f" }}>{selectedEntry.title}</h2>
                      <div style={{ color: "#ffbcbc", marginTop: 6 }}>{selectedEntry.description || "No description."}</div>
                    </div>
                    <button style={button} onClick={resetSelectedRule}>Reset Selected Rule</button>
                  </div>

                  <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 12 }}>
                    <div style={{ color: "#ffbcbc" }}><b>Registry Key:</b> {selectedEntry.key}</div>
                    <div style={{ color: "#ffbcbc" }}><b>Access Target:</b> {selectedEntry.accessTarget || selectedEntry.commandName}</div>
                    <div style={{ color: "#ffbcbc" }}><b>Default Level:</b> {selectedEntry.defaultRequiredLevelName}</div>
                    <div style={{ color: "#ffbcbc" }}><b>Executable:</b> {selectedEntry.executable ? "Yes" : "Parent Rule"}</div>
                    <div style={{ color: "#ffbcbc" }}><b>Currently Deployed:</b> {selectedState?.deployed ? "Yes" : "No"}</div>
                    <div style={{ color: "#ffbcbc" }}><b>Live Slash Name:</b> /{selectedLiveCommandName || selectedEntry.commandName}</div>
                    <div style={{ color: "#ffbcbc" }}><b>Explicit Rule:</b> {selectedState?.hasExplicitRule ? selectedState.explicitRuleKey : "No"}</div>
                    <div style={{ color: "#ffbcbc" }}><b>Inherited Off By:</b> {selectedState?.inheritedDisabledBy || "None"}</div>
                    <div style={{ color: "#ffbcbc" }}><b>Overlap Group:</b> {selectedState?.overlapTarget ? `${selectedState.overlapTarget} (${selectedState.overlapSize})` : "None"}</div>
                  </div>

                  {selectedEntry.kind === "command" ? (
                    <div style={{ ...card, marginTop: 14, padding: 12 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
                        <div>
                          <div style={{ color: "#ff5f5f", fontWeight: 700 }}>Custom Slash Name</div>
                          <div style={{ color: "#ffbcbc", marginTop: 6 }}>
                            Rename this slash command for this guild without changing the underlying handler, permissions, or cooldowns.
                          </div>
                        </div>
                        <button style={button} onClick={resetSelectedRename}>Reset Slash Name</button>
                      </div>
                      <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "minmax(240px,420px) 1fr", gap: 12, alignItems: "end" }}>
                        <div>
                          <label>Custom slash name for `/{selectedEntry.key}`</label>
                          <input
                            style={input}
                            placeholder={selectedEntry.key}
                            value={selectedRenameValue}
                            onChange={(e) => patchSelectedRename(e.target.value)}
                          />
                        </div>
                        <div style={{ color: "#ff9d9d", fontSize: 13 }}>
                          Use lowercase letters, numbers, hyphens, or underscores. Example: `guild-stats`
                        </div>
                      </div>
                      <div style={{ marginTop: 10, color: selectedRenameDiagnostic ? "#ffb3f0" : "#ffb3f0" }}>
                        {selectedRenameDiagnostic
                          ? selectedRenameDiagnostic.message
                          : selectedRenameValue
                            ? `This guild will see /${selectedRenameValue}. Internally it still routes to /${selectedEntry.key}.`
                            : `No custom slash name saved. This guild will keep /${selectedEntry.key}.`}
                      </div>
                    </div>
                  ) : null}

                  {selectedEntry.kind === "command" ? (
                    <div style={{ marginTop: 12, color: "#ffb3f0" }}>
                      Disabling a root command here disables the full slash command family for this guild and removes it on the next sync.
                    </div>
                  ) : null}

                  <div style={{ marginTop: 14, display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 12 }}>
                    <label style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                      <input type="checkbox" checked={selectedRule.enabled} onChange={(e) => patchRule({ enabled: e.target.checked })} />
                      Enabled
                    </label>
                    <label style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                      <input type="checkbox" checked={selectedRule.hideFromHelp} onChange={(e) => patchRule({ hideFromHelp: e.target.checked })} />
                      Hide from help
                    </label>
                    <div>
                      <label>Audience Preset</label>
                      <select
                        style={input}
                        value={selectedAudiencePreset}
                        onChange={(e) => {
                          const preset = AUDIENCE_PRESETS.find((item) => item.id === e.target.value);
                          if (preset?.level) {
                            patchRule({ requiredLevel: preset.level });
                          }
                        }}
                      >
                        {AUDIENCE_PRESETS.map((preset) => (
                          <option key={preset.id} value={preset.id}>{preset.label}</option>
                        ))}
                      </select>
                      <div style={{ color: "#ff9d9d", fontSize: 12, marginTop: 6 }}>
                        {getAudiencePresetMeta(selectedRule.requiredLevel).help}
                      </div>
                    </div>
                    <div>
                      <label>Minimum Access Level</label>
                      <select style={input} value={selectedRule.requiredLevel} onChange={(e) => patchRule({ requiredLevel: e.target.value })}>
                        {LEVEL_OPTIONS.map((level) => <option key={level} value={level}>{level}</option>)}
                      </select>
                    </div>
                    <div>
                      <label>Cooldown Seconds</label>
                      <input
                        style={input}
                        type="number"
                        value={selectedRule.cooldownSec}
                        onChange={(e) => patchRule({ cooldownSec: Number(e.target.value || 0) })}
                      />
                    </div>
                  </div>

                  <div style={{ marginTop: 14 }}>
                    <label>Deny Message</label>
                    <textarea
                      style={{ ...input, minHeight: 86 }}
                      value={selectedRule.denyMessage}
                      onChange={(e) => patchRule({ denyMessage: e.target.value })}
                    />
                  </div>

                  <div style={{ marginTop: 14 }}>
                    <label>Rule Note</label>
                    <textarea
                      style={{ ...input, minHeight: 70 }}
                      value={selectedRule.note}
                      onChange={(e) => patchRule({ note: e.target.value })}
                    />
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginTop: 14 }}>
                    <div>
                      <h3 style={{ color: "#ff5f5f", marginTop: 0 }}>Required Roles</h3>
                      <div style={{ display: "grid", gap: 6, maxHeight: 260, overflowY: "auto" }}>
                        {roles.map((role) => (
                          <label key={role.id}>
                            <input
                              type="checkbox"
                              checked={selectedRule.requiredRoleIds.includes(role.id)}
                              onChange={() => patchRule({ requiredRoleIds: toggleId(selectedRule.requiredRoleIds, role.id) })}
                            />{" "}
                            {role.name}
                          </label>
                        ))}
                      </div>
                    </div>

                    <div>
                      <h3 style={{ color: "#ff5f5f", marginTop: 0 }}>Blocked Roles</h3>
                      <div style={{ display: "grid", gap: 6, maxHeight: 260, overflowY: "auto" }}>
                        {roles.map((role) => (
                          <label key={role.id}>
                            <input
                              type="checkbox"
                              checked={selectedRule.blockedRoleIds.includes(role.id)}
                              onChange={() => patchRule({ blockedRoleIds: toggleId(selectedRule.blockedRoleIds, role.id) })}
                            />{" "}
                            {role.name}
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginTop: 14 }}>
                    <div>
                      <h3 style={{ color: "#ff5f5f", marginTop: 0 }}>Allowed Channels</h3>
                      <div style={{ display: "grid", gap: 6, maxHeight: 260, overflowY: "auto" }}>
                        {channels.map((channel) => (
                          <label key={channel.id}>
                            <input
                              type="checkbox"
                              checked={selectedRule.allowedChannelIds.includes(channel.id)}
                              onChange={() => patchRule({ allowedChannelIds: toggleId(selectedRule.allowedChannelIds, channel.id) })}
                            />{" "}
                            #{channel.name}
                          </label>
                        ))}
                      </div>
                    </div>

                    <div>
                      <h3 style={{ color: "#ff5f5f", marginTop: 0 }}>Blocked Channels</h3>
                      <div style={{ display: "grid", gap: 6, maxHeight: 260, overflowY: "auto" }}>
                        {channels.map((channel) => (
                          <label key={channel.id}>
                            <input
                              type="checkbox"
                              checked={selectedRule.blockedChannelIds.includes(channel.id)}
                              onChange={() => patchRule({ blockedChannelIds: toggleId(selectedRule.blockedChannelIds, channel.id) })}
                            />{" "}
                            #{channel.name}
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>

                  {selectedEntry.optionSummary.length ? (
                    <div style={{ marginTop: 14 }}>
                      <h3 style={{ color: "#ff5f5f", marginTop: 0 }}>Slash Options</h3>
                      <div style={{ display: "grid", gap: 6 }}>
                        {selectedEntry.optionSummary.map((item) => (
                          <div key={item} style={{ color: "#ffbcbc", fontSize: 13 }}>{item}</div>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {selectedOverlapGroup ? (
                    <div style={{ marginTop: 14 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
                        <h3 style={{ color: "#ff5f5f", margin: 0 }}>Overlap Set</h3>
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                          <button style={button} onClick={disableOverlapGroup}>Turn Off Overlap Set</button>
                          <button style={button} onClick={resetOverlapGroup}>Reset Overlap Set</button>
                        </div>
                      </div>
                      <div style={{ marginTop: 8, color: "#ffbcbc" }}>
                        These slash entries share the same handler target. If a guild does not want overlap, disable the routes you do not want exposed.
                      </div>
                      <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
                        {selectedOverlapGroup.entries.map((item) => {
                          const state = deployment.entryStates?.[item.key];
                          return (
                            <button
                              key={item.key}
                              onClick={() => setSelectedKey(item.key)}
                              style={{
                                ...button,
                                textAlign: "left",
                                width: "100%",
                                background: item.key === selectedKey ? "#2a0000" : "#140000",
                              }}
                            >
                              <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                                <span>{item.title}</span>
                                <span style={{ color: state?.deployed ? "#ffb3f0" : "#ff9d9d" }}>
                                  {state?.deployed ? "Live" : "Off"}
                                </span>
                              </div>
                              <div style={{ marginTop: 6, color: "#ffbcbc", fontSize: 12 }}>{item.key}</div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ) : null}
                </>
              ) : (
                <div>Select a slash command entry.</div>
              )}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
