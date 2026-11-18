"use client";

import { CSSProperties, useCallback, useEffect, useMemo, useRef, useState } from "react";
import GuildEmojiField from "@/components/possum/GuildEmojiField";
import GuildEmojiPicker, { type GuildEmoji } from "@/components/possum/GuildEmojiPicker";

type GuildRole = { id: string; name: string; position?: number };
type GuildChannel = { id: string; name: string; type?: number | string };
type NativeCommandEntry = {
  key: string;
  title: string;
  description: string;
  optionSummary?: string[];
  executable?: boolean;
  commandName?: string;
};

type CustomCommand = {
  id: string;
  guildId: string;
  name: string;
  description?: string | null;
  enabled: boolean;
  hideFromHelp: boolean;
  staffOnly: boolean;
  roleRequired?: string | null;
  cooldownSec: number;
  costCoins: number;
  actions: any[];
};

type ActionType =
  | "SEND_MESSAGE"
  | "SEND_EMBED"
  | "REPLY"
  | "DM"
  | "ADD_ROLE"
  | "REMOVE_ROLE"
  | "REACT"
  | "DELAY"
  | "CREATE_THREAD"
  | "RUN_NATIVE_COMMAND"
  | "RAW";

type ActionDraft = {
  id: string;
  type: ActionType;
  channelId: string;
  content: string;
  embedTitle: string;
  embedDescription: string;
  embedColor: string;
  embedImageUrl: string;
  embedThumbnailUrl: string;
  embedFooterText: string;
  roleId: string;
  emoji: string;
  delayMs: string;
  threadName: string;
  threadArchiveMin: string;
  ephemeral: boolean;
  nativeCommandKey: string;
  nativeCommandOptionsJson: string;
  nativeCommandChannelId: string;
  nativeCommandSilent: boolean;
  rawAction?: any;
};

type CommandDraft = {
  id?: string;
  name: string;
  description: string;
  enabled: boolean;
  hideFromHelp: boolean;
  staffOnly: boolean;
  roleRequired: string;
  cooldownSec: string;
  costCoins: string;
  actions: ActionDraft[];
};

const ACTION_LIBRARY: Array<{ type: ActionType; title: string; desc: string }> = [
  { type: "SEND_MESSAGE", title: "Send Message to Channel", desc: "Post in a selected channel" },
  { type: "SEND_EMBED", title: "Embed Messages", desc: "Post a styled embed in-channel or in a target channel" },
  { type: "REPLY", title: "Reply in Current Channel", desc: "Reply where command was used" },
  { type: "DM", title: "Send Direct Message", desc: "DM the user who ran command" },
  { type: "ADD_ROLE", title: "Give Role", desc: "Grant role to user" },
  { type: "REMOVE_ROLE", title: "Remove Role", desc: "Take role from user" },
  { type: "REACT", title: "React with Emoji", desc: "Add emoji reaction" },
  { type: "DELAY", title: "Delay Step", desc: "Wait before next step" },
  { type: "CREATE_THREAD", title: "Create Thread", desc: "Create thread from message context" },
  { type: "RUN_NATIVE_COMMAND", title: "Run Bot Slash Command", desc: "Trigger one of your built-in / commands" }
];

function makeId() {
  return `${Date.now()}_${Math.floor(Math.random() * 1_000_000)}`;
}

function getGuildId(): string {
  if (typeof window === "undefined") return "";
  const p = new URLSearchParams(window.location.search);
  const fromUrl = String(p.get("guildId") || "").trim();
  const fromStore = String(localStorage.getItem("activeGuildId") || "").trim();
  const guildId = fromUrl || fromStore || "";
  if (guildId) {
    localStorage.setItem("activeGuildId", guildId);
    if (!fromUrl) {
      p.set("guildId", guildId);
      window.history.replaceState({}, "", `${window.location.pathname}?${p.toString()}`);
    }
  }
  return guildId;
}


function splitPolicyAndActions(actionsRaw: any[]) {
  const all = Array.isArray(actionsRaw) ? actionsRaw : [];
  let policy: Record<string, any> = {};
  const actions: any[] = [];

  for (const a of all) {
    if (String(a?.type || "").toUpperCase() === "__POLICY" && a?.config && typeof a.config === "object") {
      policy = { ...a.config };
      continue;
    }
    actions.push(a);
  }

  return { policy, actions };
}

function parseBool(value: any): boolean | null {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  const text = String(value || "").trim().toLowerCase();
  if (!text) return null;
  if (["1", "true", "yes", "on", "enabled"].includes(text)) return true;
  if (["0", "false", "no", "off", "disabled"].includes(text)) return false;
  return null;
}

function firstBool(values: any[], fallback = false): boolean {
  for (const value of values) {
    const parsed = parseBool(value);
    if (parsed !== null) return parsed;
  }
  return fallback;
}

function firstNumber(values: any[], fallback = 0): number {
  for (const value of values) {
    const n = Number(value);
    if (Number.isFinite(n) && n >= 0) return Math.floor(n);
  }
  return fallback;
}

function resolveTriggerDeleteMode(policy: Record<string, any>, cmd?: any): "off" | "instant" | "timer" {
  const explicit = String(policy?.deleteMode || cmd?.deleteMode || "").trim().toLowerCase();
  if (explicit === "off") return "off";
  if (explicit === "instant") return "instant";
  if (explicit === "timer") return "timer";

  const enabled = firstBool([
    policy?.deleteTriggerMessage,
    policy?.hideCommandUsage,
    policy?.hideUsage,
    policy?.hideTriggerMessage,
    cmd?.deleteTriggerMessage,
    cmd?.hideCommandUsage,
    cmd?.hideUsage,
    cmd?.hideTriggerMessage
  ], false);

  if (!enabled) return "off";
  const delay = firstNumber([
    policy?.deleteDelaySec,
    policy?.deleteAfterSec,
    policy?.deleteTriggerDelaySec,
    cmd?.deleteDelaySec,
    cmd?.deleteAfterSec,
    cmd?.deleteTriggerDelaySec
  ], 0);
  return delay > 0 ? "timer" : "instant";
}

function resolveResponseDeleteMode(policy: Record<string, any>, cmd?: any): "off" | "timer" {
  const explicit = String(policy?.responseDeleteMode || cmd?.responseDeleteMode || "").trim().toLowerCase();
  if (explicit === "off") return "off";
  if (explicit === "timer") return "timer";

  const enabled = firstBool([
    policy?.deleteBotResponses,
    policy?.deleteResponses,
    policy?.deleteBotResponse,
    cmd?.deleteBotResponses,
    cmd?.deleteResponses,
    cmd?.deleteBotResponse
  ], false);

  return enabled ? "timer" : "off";
}


function emptyAction(type: ActionType): ActionDraft {
  return {
    id: makeId(),
    type,
    channelId: "",
    content: "",
    embedTitle: "",
    embedDescription: "",
    embedColor: "#ff5a5a",
    embedImageUrl: "",
    embedThumbnailUrl: "",
    embedFooterText: "",
    roleId: "",
    emoji: "",
    delayMs: "1000",
    threadName: "Thread",
    threadArchiveMin: "60",
    ephemeral: false,
    nativeCommandKey: "",
    nativeCommandOptionsJson: "{\n}",
    nativeCommandChannelId: "",
    nativeCommandSilent: true
  };
}

function emptyDraft(): CommandDraft {
  return {
    name: "",
    description: "",
    enabled: true,
    hideFromHelp: false,
    staffOnly: false,
    roleRequired: "",
    cooldownSec: "0",
    costCoins: "0",
    actions: []
  };
}

function apiActionToDraft(a: any): ActionDraft {
  const type = String(a?.type || "").toUpperCase();
  const c = a?.config || {};

  if (type === "SEND_MESSAGE") return { ...emptyAction("SEND_MESSAGE"), channelId: String(c.channelId || ""), content: String(c.content || "") };
  if (type === "SEND_EMBED")
    return {
      ...emptyAction("SEND_EMBED"),
      channelId: String(c.channelId || ""),
      content: String(c.content || ""),
      embedTitle: String(c.title || c.embedTitle || ""),
      embedDescription: String(c.description || c.embedDescription || ""),
      embedColor: String(c.color || c.embedColor || "#ff5a5a"),
      embedImageUrl: String(c.imageUrl || c.embedImageUrl || ""),
      embedThumbnailUrl: String(c.thumbnailUrl || c.embedThumbnailUrl || ""),
      embedFooterText: String(c.footerText || c.embedFooterText || ""),
      ephemeral: !!c.ephemeral,
    };
  if (type === "REPLY") return { ...emptyAction("REPLY"), content: String(c.content || ""), ephemeral: !!c.ephemeral };
  if (type === "DM") return { ...emptyAction("DM"), content: String(c.content || "") };
  if (type === "ADD_ROLE") return { ...emptyAction("ADD_ROLE"), roleId: String(c.roleId || "") };
  if (type === "REMOVE_ROLE") return { ...emptyAction("REMOVE_ROLE"), roleId: String(c.roleId || "") };
  if (type === "REACT") return { ...emptyAction("REACT"), emoji: String(c.emoji || "") };
  if (type === "DELAY") return { ...emptyAction("DELAY"), delayMs: String(c.ms ?? 1000) };
  if (type === "CREATE_THREAD")
    return {
      ...emptyAction("CREATE_THREAD"),
      threadName: String(c.name || "Thread"),
      threadArchiveMin: String(c.autoArchiveDuration ?? 60)
    };
  if (type === "RUN_NATIVE_COMMAND")
    return {
      ...emptyAction("RUN_NATIVE_COMMAND"),
      nativeCommandKey: String(c.commandKey || ""),
      nativeCommandOptionsJson: String(c.optionsJson || "{\n}"),
      nativeCommandChannelId: String(c.channelId || ""),
      nativeCommandSilent: c.silent !== false,
    };

  return { ...emptyAction("RAW"), rawAction: a };
}

function draftToApiAction(a: ActionDraft): any {
  if (a.type === "RAW" && a.rawAction) return a.rawAction;
  if (a.type === "SEND_MESSAGE") return { type: "SEND_MESSAGE", config: { channelId: a.channelId, content: a.content } };
  if (a.type === "SEND_EMBED")
    return {
      type: "SEND_EMBED",
      config: {
        channelId: a.channelId,
        content: a.content,
        title: a.embedTitle,
        description: a.embedDescription,
        color: a.embedColor,
        imageUrl: a.embedImageUrl,
        thumbnailUrl: a.embedThumbnailUrl,
        footerText: a.embedFooterText,
        ephemeral: a.ephemeral,
      }
    };
  if (a.type === "REPLY") return { type: "REPLY", config: { content: a.content, ephemeral: a.ephemeral } };
  if (a.type === "DM") return { type: "DM", config: { content: a.content } };
  if (a.type === "ADD_ROLE") return { type: "ADD_ROLE", config: { roleId: a.roleId } };
  if (a.type === "REMOVE_ROLE") return { type: "REMOVE_ROLE", config: { roleId: a.roleId } };
  if (a.type === "REACT") return { type: "REACT", config: { emoji: a.emoji } };
  if (a.type === "DELAY") return { type: "DELAY", config: { ms: Number(a.delayMs || 0) } };
  if (a.type === "CREATE_THREAD")
    return { type: "CREATE_THREAD", config: { name: a.threadName || "Thread", autoArchiveDuration: Number(a.threadArchiveMin || 60) } };
  if (a.type === "RUN_NATIVE_COMMAND") {
    return {
      type: "RUN_NATIVE_COMMAND",
      config: {
        commandKey: a.nativeCommandKey,
        optionsJson: a.nativeCommandOptionsJson || "{\n}",
        channelId: a.nativeCommandChannelId,
        silent: a.nativeCommandSilent,
      }
    };
  }
  return { type: "REPLY", config: { content: "No action configured." } };
}

export default function CustomCommandsPage() {
  const [guildId, setGuildId] = useState("");
  const [roles, setRoles] = useState<GuildRole[]>([]);
  const [channels, setChannels] = useState<GuildChannel[]>([]);
  const [emojis, setEmojis] = useState<GuildEmoji[]>([]);
  const [emojiError, setEmojiError] = useState("");
  const [nativeCommandEntries, setNativeCommandEntries] = useState<NativeCommandEntry[]>([]);
  const [guildDataLoading, setGuildDataLoading] = useState(false);
  const [nativeCommandsLoading, setNativeCommandsLoading] = useState(false);
  const nativeCommandsRequested = useRef(false);
  const [logChannelId, setLogChannelId] = useState("");
  const [commands, setCommands] = useState<CustomCommand[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string>("new");
  const [draft, setDraft] = useState<CommandDraft>(emptyDraft());
  const [policyRaw, setPolicyRaw] = useState<Record<string, any>>({});
  const [triggerDeleteMode, setTriggerDeleteMode] = useState<"off" | "instant" | "timer">("off");
  const [triggerDeleteDelaySec, setTriggerDeleteDelaySec] = useState("5");
  const [responseDeleteMode, setResponseDeleteMode] = useState<"off" | "timer">("off");
  const [responseDeleteDelaySec, setResponseDeleteDelaySec] = useState("10");
  const [trueHidden, setTrueHidden] = useState(false);
  const [mentionRoleByAction, setMentionRoleByAction] = useState<Record<string, string>>({});
  const [mentionChannelByAction, setMentionChannelByAction] = useState<Record<string, string>>({});

  const filteredCommands = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return commands;
    return commands.filter((c) => c.name.toLowerCase().includes(q));
  }, [commands, search]);

  const textChannels = useMemo(
    () => channels.filter((channel) => [0, 5].includes(Number(channel.type || 0))),
    [channels]
  );

  async function loadGuildData(targetGuildId: string) {
    setGuildDataLoading(true);
    setEmojiError("");
    const r = await fetch(`/api/bot/guild-data?guildId=${encodeURIComponent(targetGuildId)}`);
    const j = await r.json().catch(() => ({}));
    if (!r.ok || j?.success === false) throw new Error(j?.error || "Failed to load guild roles and channels");
    setRoles(Array.isArray(j?.roles) ? j.roles : []);
    setChannels(Array.isArray(j?.channels) ? j.channels : []);
    setEmojis(Array.isArray(j?.emojis) ? j.emojis : []);
    setGuildDataLoading(false);
  }

  async function loadCommands(targetGuildId: string) {
    const r = await fetch(`/api/bot/commands?guildId=${encodeURIComponent(targetGuildId)}`);
    const j = await r.json();
    if (!r.ok) throw new Error(j?.error || "Failed to load commands");
    setCommands(Array.isArray(j) ? j : []);
  }

  async function loadStudioConfig(targetGuildId: string) {
    const r = await fetch(`/api/bot/engine-config?guildId=${encodeURIComponent(targetGuildId)}&engine=customCommands`, { cache: "no-store" });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || j?.success === false) throw new Error(j?.error || "Failed to load custom command studio config");
    setLogChannelId(String(j?.config?.logChannelId || ""));
  }

  async function loadNativeCommands(targetGuildId: string) {
    setNativeCommandsLoading(true);
    try {
      const r = await fetch(`/api/bot/native-commands?guildId=${encodeURIComponent(targetGuildId)}`);
      const j = await r.json().catch(() => ({}));
      if (!r.ok || j?.success === false) throw new Error(j?.error || "Failed to load bot slash commands");

      const entries = Array.isArray(j?.registry?.entries) ? j.registry.entries : [];
      const aggregateRoots = new Set(["control", "ops", "games", "community", "progress"]);
      const filtered = entries
        .filter((entry: NativeCommandEntry) => entry?.executable && !aggregateRoots.has(String(entry?.commandName || "").toLowerCase()))
        .sort((left: NativeCommandEntry, right: NativeCommandEntry) => String(left.title || left.key).localeCompare(String(right.title || right.key)));
      setNativeCommandEntries(filtered);
    } finally {
      setNativeCommandsLoading(false);
    }
  }

  const loadAll = useCallback(async (targetGuildId: string) => {
    setLoading(true);
    setMsg("");
    try {
      await Promise.all([
        loadCommands(targetGuildId),
        loadStudioConfig(targetGuildId),
      ]);
    } catch (e: any) {
      setMsg(e?.message || "Load failed");
    } finally {
      setLoading(false);
    }
    void loadGuildData(targetGuildId).catch((e: any) => {
      setGuildDataLoading(false);
      setEmojiError(e?.message || "Failed to load guild data");
      setMsg(e?.message || "Failed to load guild roles and channels");
    });
  }, []);

  async function saveStudioSettings() {
    if (!guildId) return;
    setSaving(true);
    setMsg("");
    try {
      const r = await fetch("/api/bot/engine-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          guildId,
          engine: "customCommands",
          patch: { logChannelId }
        })
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || j?.success === false) throw new Error(j?.error || "Failed to save custom command studio settings");
      setLogChannelId(String(j?.config?.logChannelId || ""));
      setMsg("Custom command studio logging saved.");
    } catch (e: any) {
      setMsg(e?.message || "Failed to save studio settings");
    } finally {
      setSaving(false);
    }
  }

  useEffect(() => {
    const gid = getGuildId();
    setGuildId(gid);
    if (gid) void loadAll(gid);
    else setLoading(false);
  }, [loadAll]);

  const needsNativeCommands = draft.actions.some((action) => action.type === "RUN_NATIVE_COMMAND");
  useEffect(() => {
    if (!guildId || !needsNativeCommands || nativeCommandsRequested.current) return;
    nativeCommandsRequested.current = true;
    void loadNativeCommands(guildId).catch((e: any) => {
      setMsg(e?.message || "Failed to load bot slash commands");
    });
  }, [guildId, needsNativeCommands]);

  useEffect(() => {
    if (selectedId === "new") {
      setDraft(emptyDraft());
      setPolicyRaw({});
      setTriggerDeleteMode("off");
      setTriggerDeleteDelaySec("5");
      setResponseDeleteMode("off");
      setResponseDeleteDelaySec("10");
      setTrueHidden(false);
      setMentionRoleByAction({});
      setMentionChannelByAction({});
      return;
    }
    const cmd = commands.find((c) => c.id === selectedId);
    if (!cmd) return;

    const { policy, actions } = splitPolicyAndActions(cmd.actions || []);

    setPolicyRaw(policy);
    setTriggerDeleteMode(resolveTriggerDeleteMode(policy, cmd));
    setTriggerDeleteDelaySec(String(firstNumber([
      policy?.deleteDelaySec,
      policy?.deleteAfterSec,
      policy?.deleteTriggerDelaySec
    ], 5) || 5));
    setResponseDeleteMode(resolveResponseDeleteMode(policy, cmd));
    setResponseDeleteDelaySec(String(firstNumber([
      policy?.responseDeleteSec,
      policy?.responseDeleteAfterSec
    ], 10) || 10));
    setTrueHidden(
      resolveTriggerDeleteMode(policy, cmd) === "instant" &&
      resolveResponseDeleteMode(policy, cmd) === "timer" &&
      firstNumber([policy?.responseDeleteSec, policy?.responseDeleteAfterSec], 10) <= 1
    );

    setDraft({
      id: cmd.id,
      name: cmd.name || "",
      description: String(cmd.description || ""),
      enabled: !!cmd.enabled,
      hideFromHelp: !!cmd.hideFromHelp,
      staffOnly: !!cmd.staffOnly,
      roleRequired: String(cmd.roleRequired || ""),
      cooldownSec: String(cmd.cooldownSec ?? 0),
      costCoins: String(cmd.costCoins ?? 0),
      actions: Array.isArray(actions) ? actions.map(apiActionToDraft) : []
    });
    setMentionRoleByAction({});
    setMentionChannelByAction({});
  }, [selectedId, commands]);

  function updateDraft<K extends keyof CommandDraft>(key: K, value: CommandDraft[K]) {
    setDraft((prev) => ({ ...prev, [key]: value }));
  }

  function addAction(type: ActionType) {
    setDraft((prev) => ({ ...prev, actions: [...prev.actions, emptyAction(type)] }));
  }

  function updateAction(id: string, patch: Partial<ActionDraft>) {
    setDraft((prev) => ({
      ...prev,
      actions: prev.actions.map((a) => (a.id === id ? { ...a, ...patch } : a))
    }));
  }

  function removeAction(id: string) {
    setDraft((prev) => ({ ...prev, actions: prev.actions.filter((a) => a.id !== id) }));
  }

  function moveAction(id: string, dir: -1 | 1) {
    setDraft((prev) => {
      const idx = prev.actions.findIndex((a) => a.id === id);
      if (idx < 0) return prev;
      const next = idx + dir;
      if (next < 0 || next >= prev.actions.length) return prev;
      const arr = [...prev.actions];
      const tmp = arr[idx];
      arr[idx] = arr[next];
      arr[next] = tmp;
      return { ...prev, actions: arr };
    });
  }

  function appendRoleMentionToAction(actionId: string, roleId: string) {
    const rid = String(roleId || "").trim();
    if (!rid) return;
    const token = `<@&${rid}>`;
    setDraft((prev) => ({
      ...prev,
      actions: prev.actions.map((a) => {
        if (a.id !== actionId) return a;
        const body = String(a.content || "").trim();
        const nextContent = body.includes(token) ? body : (body ? `${body} ${token}` : token);
        return { ...a, content: nextContent };
      })
    }));
  }

  function appendChannelMentionToAction(actionId: string, channelId: string) {
    const cid = String(channelId || "").trim();
    if (!cid) return;
    const token = `<#${cid}>`;
    setDraft((prev) => ({
      ...prev,
      actions: prev.actions.map((a) => {
        if (a.id !== actionId) return a;
        const body = String(a.content || "").trim();
        const nextContent = body.includes(token) ? body : (body ? `${body} ${token}` : token);
        return { ...a, content: nextContent };
      })
    }));
  }

  async function saveCommand() {
    if (!guildId) return;
    const cleanName = draft.name.replace(/^!+/, "").trim().toLowerCase();
    if (!cleanName) {
      setMsg("Command name is required.");
      return;
    }
    if (!draft.actions.length) {
      setMsg("Add at least one action.");
      return;
    }

    setSaving(true);
    setMsg("");

    try {
      const policy = { ...(policyRaw || {}) };
      const triggerDelay = Math.max(1, Number(triggerDeleteDelaySec || 5));
      const responseDelay = Math.max(1, Number(responseDeleteDelaySec || 10));

      if (triggerDeleteMode === "off") {
        policy.deleteMode = "off";
        policy.deleteTriggerMessage = false;
        policy.hideCommandUsage = false;
        policy.deleteDelaySec = 0;
      } else if (triggerDeleteMode === "instant") {
        policy.deleteMode = "instant";
        policy.deleteTriggerMessage = true;
        policy.hideCommandUsage = true;
        policy.deleteDelaySec = 0;
      } else {
        policy.deleteMode = "timer";
        policy.deleteTriggerMessage = true;
        policy.hideCommandUsage = true;
        policy.deleteDelaySec = triggerDelay;
      }

      if (responseDeleteMode === "off") {
        policy.responseDeleteMode = "off";
        policy.responseDeleteSec = 0;
        policy.deleteBotResponses = false;
      } else {
        policy.responseDeleteMode = "timer";
        policy.responseDeleteSec = responseDelay;
        policy.deleteBotResponses = true;
      }

      if (trueHidden) {
        policy.deleteMode = "instant";
        policy.deleteTriggerMessage = true;
        policy.hideCommandUsage = true;
        policy.deleteDelaySec = 0;
        policy.responseDeleteMode = "timer";
        policy.responseDeleteSec = 1;
        policy.deleteBotResponses = true;
      }

      const actionsWithPolicy = draft.actions.map(draftToApiAction);
      actionsWithPolicy.unshift({ type: "__POLICY", config: policy });

      const payload = {
        guildId,
        name: cleanName,
        description: draft.description || null,
        enabled: draft.enabled,
        hideFromHelp: draft.hideFromHelp,
        staffOnly: draft.staffOnly,
        roleRequired: draft.roleRequired || null,
        cooldownSec: Number(draft.cooldownSec || 0),
        costCoins: Number(draft.costCoins || 0),
        actions: actionsWithPolicy,
      };

      if (!draft.id) {
        const r = await fetch("/api/bot/commands", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });
        const j = await r.json();
        if (!r.ok) throw new Error(j?.error || "Create failed");
      } else {
        const r = await fetch(`/api/bot/command/${encodeURIComponent(draft.id)}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });
        const j = await r.json();
        if (!r.ok) throw new Error(j?.error || "Update failed");
      }

      await loadCommands(guildId);
      setMsg(draft.id ? "Command updated." : "Command created.");
      if (!draft.id) setSelectedId("new");
    } catch (e: any) {
      setMsg(e?.message || "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function quickToggle(cmd: CustomCommand) {
    try {
      const r = await fetch(`/api/bot/command/${encodeURIComponent(cmd.id)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: !cmd.enabled })
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.error || "Toggle failed");
      await loadCommands(guildId);
    } catch (e: any) {
      setMsg(e?.message || "Toggle failed");
    }
  }

  async function quickDelete(cmd: CustomCommand) {
    try {
      const r = await fetch(`/api/bot/command/${encodeURIComponent(cmd.id)}`, { method: "DELETE" });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.error || "Delete failed");
      await loadCommands(guildId);
      if (selectedId === cmd.id) setSelectedId("new");
    } catch (e: any) {
      setMsg(e?.message || "Delete failed");
    }
  }

  if (!guildId) return <div style={{ color: "#ff6b6b", padding: 24 }}>Missing guildId. Open from /guilds first.</div>;

  return (
    <div style={{ color: "#ff6b6b", maxWidth: 1400 }}>
      <h1 style={h1Style}>!Command Studio</h1>
      <p style={{ marginTop: 0 }}>Guild: {typeof window !== 'undefined' ? (localStorage.getItem('activeGuildName') || guildId) : guildId}</p>
      {msg ? <p style={{ color: "#ffb3b3" }}>{msg}</p> : null}
      {loading ? <p>Loading...</p> : null}
      {!loading && guildDataLoading ? <p style={hintStyle}>Loading role and channel options...</p> : null}

      {!loading ? (
        <div style={{ display: "grid", gap: 14 }}>
          <div style={panelStyle}>
            <div style={{ display: "grid", gridTemplateColumns: "minmax(240px,420px) auto", gap: 10, alignItems: "end" }}>
              <div>
                <label style={{ display: "block", marginBottom: 6, color: "#ffb3b3" }}>Custom command audit log channel</label>
                <select value={logChannelId} onChange={(e) => setLogChannelId(e.target.value)} style={inputStyle}>
                  <option value="">Use moderator audit channel</option>
                  {textChannels.map((channel) => (
                    <option key={channel.id} value={channel.id}>#{channel.name}</option>
                  ))}
                </select>
              </div>
              <button onClick={saveStudioSettings} disabled={saving} style={{ ...btnPrimary, alignSelf: "end" }}>
                {saving ? "Saving..." : "Save Studio Log"}
              </button>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "360px 1fr", gap: 14 }}>
          <div style={panelStyle}>
            <button onClick={() => setSelectedId("new")} style={btnPrimary}>
              + New Command
            </button>

            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search commands"
              style={{ ...inputStyle, marginTop: 10 }}
            />

            <div style={{ marginTop: 10, display: "grid", gap: 8, maxHeight: 720, overflowY: "auto" }}>
              {filteredCommands.map((cmd) => (
                <div
                  key={cmd.id}
                  style={{
                    ...listRow,
                    borderColor: selectedId === cmd.id ? "#aa0000" : "#5f0000"
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                    <button onClick={() => setSelectedId(cmd.id)} style={listBtn}>
                      !{cmd.name}
                    </button>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button onClick={() => quickToggle(cmd)} style={btnGhostMini}>
                        {cmd.enabled ? "On" : "Off"}
                      </button>
                      <button onClick={() => quickDelete(cmd)} style={btnDangerMini}>
                        X
                      </button>
                    </div>
                  </div>
                  <div style={{ fontSize: 12, color: "#ff9d9d" }}>
                    {cmd.enabled ? "Enabled" : "Disabled"} • cooldown {cmd.cooldownSec || 0}s
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div style={panelStyle}>
            <h3 style={sectionTitle}>{draft.id ? `Edit !${draft.name}` : "Create Command"}</h3>

            <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 10 }}>
              <input
                value={draft.name}
                onChange={(e) => updateDraft("name", e.target.value)}
                placeholder="Command name (no ! needed)"
                style={inputStyle}
              />

              <textarea
                value={draft.description}
                onChange={(e) => updateDraft("description", e.target.value)}
                rows={2}
                placeholder="Description"
                style={{ ...inputStyle, fontFamily: "inherit" }}
              />
            </div>

            <div style={deletePanelStyle}>
              <div style={subTitle}>Auto-delete</div>

              <div style={twoCol}>
                <div>
                  <div style={miniLabel}>Command usage message</div>
                  <select value={triggerDeleteMode} onChange={(e) => { setTriggerDeleteMode(e.target.value as 'off' | 'instant' | 'timer'); setTrueHidden(false); }} style={inputStyle}>
                    <option value='off'>Off</option>
                    <option value='instant'>Instant delete</option>
                    <option value='timer'>Delete on timer</option>
                  </select>
                </div>
                <div>
                  {triggerDeleteMode === 'timer' ? (
                    <>
                      <div style={miniLabel}>Delay seconds</div>
                      <input value={triggerDeleteDelaySec} onChange={(e) => { setTriggerDeleteDelaySec(e.target.value); setTrueHidden(false); }} style={inputStyle} placeholder='5' />
                    </>
                  ) : (
                    <div style={hintStyle}>Controls whether the member command message is removed.</div>
                  )}
                </div>
              </div>

              <div style={twoCol}>
                <div>
                  <div style={miniLabel}>Bot response messages</div>
                  <select value={responseDeleteMode} onChange={(e) => { setResponseDeleteMode(e.target.value as 'off' | 'timer'); setTrueHidden(false); }} style={inputStyle}>
                    <option value='off'>Off</option>
                    <option value='timer'>Delete on timer</option>
                  </select>
                </div>
                <div>
                  {responseDeleteMode === 'timer' ? (
                    <>
                      <div style={miniLabel}>Delay seconds</div>
                      <input value={responseDeleteDelaySec} onChange={(e) => { setResponseDeleteDelaySec(e.target.value); setTrueHidden(false); }} style={inputStyle} placeholder='10' />
                    </>
                  ) : (
                    <div style={hintStyle}>Keeps bot output visible permanently.</div>
                  )}
                </div>
              </div>
              <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10, color: "#ffbdbd" }}>
                <input
                  type="checkbox"
                  checked={trueHidden}
                  onChange={(e) => {
                    const on = e.target.checked;
                    setTrueHidden(on);
                    if (on) {
                      setTriggerDeleteMode("instant");
                      setTriggerDeleteDelaySec("0");
                      setResponseDeleteMode("timer");
                      setResponseDeleteDelaySec("1");
                    }
                  }}
                />
                True hidden: remove trigger instantly and auto-delete bot output in ~1s.
              </label>
            </div>

            <details style={{ marginTop: 12 }}>
              <summary style={summaryStyle}>Advanced options and permissions</summary>
              <div style={{ marginTop: 10, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <select value={draft.roleRequired} onChange={(e) => updateDraft('roleRequired', e.target.value)} style={inputStyle}>
                  <option value=''>No required role</option>
                  {roles.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <input value={draft.cooldownSec} onChange={(e) => updateDraft('cooldownSec', e.target.value)} placeholder='Cooldown sec' style={inputStyle} />
                  <input value={draft.costCoins} onChange={(e) => updateDraft('costCoins', e.target.value)} placeholder='Coin cost' style={inputStyle} />
                </div>

                <label><input type='checkbox' checked={draft.enabled} onChange={(e) => updateDraft('enabled', e.target.checked)} /> enabled</label>
                <label><input type='checkbox' checked={draft.staffOnly} onChange={(e) => updateDraft('staffOnly', e.target.checked)} /> staff only</label>
                <label><input type='checkbox' checked={draft.hideFromHelp} onChange={(e) => updateDraft('hideFromHelp', e.target.checked)} /> hide from help</label>
              </div>
            </details>

            <div style={{ marginTop: 16 }}>
              <h4 style={subTitle}>Action Library</h4>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(220px, 1fr))", gap: 8 }}>
                {ACTION_LIBRARY.map((a) => (
                  <button key={a.type} onClick={() => addAction(a.type)} style={actionLibraryCard}>
                    <div style={{ fontWeight: 800 }}>{a.title}</div>
                    <div style={{ fontSize: 12, color: "#ff9d9d" }}>{a.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
              {draft.actions.map((a, idx) => (
                <div key={a.id} style={actionCard}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
                    <strong style={{ color: "#ffdede" }}>Action #{idx + 1}: {a.type}</strong>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button onClick={() => moveAction(a.id, -1)} style={btnGhostMini}>↑</button>
                      <button onClick={() => moveAction(a.id, 1)} style={btnGhostMini}>↓</button>
                      <button onClick={() => removeAction(a.id)} style={btnDangerMini}>Remove</button>
                    </div>
                  </div>

                  {(a.type === "SEND_MESSAGE") && (
                    <div style={{ display: "grid", gap: 8 }}>
                      <div style={twoCol}>
                        <select value={a.channelId} onChange={(e) => updateAction(a.id, { channelId: e.target.value })} style={inputStyle}>
                          <option value="">Select channel</option>
                          {channels.map((c) => <option key={c.id} value={c.id}>#{c.name}</option>)}
                        </select>
                        <GuildEmojiField emojis={emojis} loading={guildDataLoading} error={emojiError} onInsert={(value) => updateAction(a.id, { content: value })}><textarea rows={3} value={a.content} onChange={(e) => updateAction(a.id, { content: e.target.value })} placeholder="Message to send" style={{ ...inputStyle, fontFamily: "inherit" }} /></GuildEmojiField>
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 8 }}>
                        <select
                          value={mentionRoleByAction[a.id] || ""}
                          onChange={(e) => setMentionRoleByAction((prev) => ({ ...prev, [a.id]: e.target.value }))}
                          style={inputStyle}
                        >
                          <option value="">Select role to tag</option>
                          {roles.map((r) => <option key={r.id} value={r.id}>@{r.name}</option>)}
                        </select>
                        <button
                          onClick={() => appendRoleMentionToAction(a.id, mentionRoleByAction[a.id] || "")}
                          style={btnGhostMini}
                          disabled={!mentionRoleByAction[a.id]}
                        >
                          Tag Role
                        </button>
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 8 }}>
                        <select
                          value={mentionChannelByAction[a.id] || ""}
                          onChange={(e) => setMentionChannelByAction((prev) => ({ ...prev, [a.id]: e.target.value }))}
                          style={inputStyle}
                        >
                          <option value="">Select channel to tag</option>
                          {channels.map((c) => <option key={c.id} value={c.id}>#{c.name}</option>)}
                        </select>
                        <button
                          onClick={() => appendChannelMentionToAction(a.id, mentionChannelByAction[a.id] || "")}
                          style={btnGhostMini}
                          disabled={!mentionChannelByAction[a.id]}
                        >
                          Tag Channel
                        </button>
                      </div>
                      <div style={hintStyle}>Inserts mention tokens: <code>&lt;@&amp;ROLE_ID&gt;</code> and <code>&lt;#CHANNEL_ID&gt;</code></div>
                    </div>
                  )}

                  {(a.type === "SEND_EMBED") && (
                    <div style={{ display: "grid", gap: 8 }}>
                      <div style={twoCol}>
                        <select value={a.channelId} onChange={(e) => updateAction(a.id, { channelId: e.target.value })} style={inputStyle}>
                          <option value="">Reply/current channel</option>
                          {channels.map((c) => <option key={c.id} value={c.id}>#{c.name}</option>)}
                        </select>
                        <GuildEmojiField emojis={emojis} loading={guildDataLoading} error={emojiError} onInsert={(value) => updateAction(a.id, { embedTitle: value })}><input value={a.embedTitle} onChange={(e) => updateAction(a.id, { embedTitle: e.target.value })} placeholder="Embed title" style={inputStyle} /></GuildEmojiField>
                      </div>
                      <GuildEmojiField emojis={emojis} loading={guildDataLoading} error={emojiError} onInsert={(value) => updateAction(a.id, { content: value })}><textarea rows={2} value={a.content} onChange={(e) => updateAction(a.id, { content: e.target.value })} placeholder="Optional message above the embed" style={{ ...inputStyle, fontFamily: "inherit" }} /></GuildEmojiField>
                      <GuildEmojiField emojis={emojis} loading={guildDataLoading} error={emojiError} onInsert={(value) => updateAction(a.id, { embedDescription: value })}><textarea rows={4} value={a.embedDescription} onChange={(e) => updateAction(a.id, { embedDescription: e.target.value })} placeholder="Embed description" style={{ ...inputStyle, fontFamily: "inherit" }} /></GuildEmojiField>
                      <div style={twoCol}>
                        <input value={a.embedColor} onChange={(e) => updateAction(a.id, { embedColor: e.target.value })} placeholder="Color (#ff5a5a)" style={inputStyle} />
                        <GuildEmojiField emojis={emojis} loading={guildDataLoading} error={emojiError} onInsert={(value) => updateAction(a.id, { embedFooterText: value })}><input value={a.embedFooterText} onChange={(e) => updateAction(a.id, { embedFooterText: e.target.value })} placeholder="Footer text" style={inputStyle} /></GuildEmojiField>
                      </div>
                      <div style={twoCol}>
                        <input value={a.embedImageUrl} onChange={(e) => updateAction(a.id, { embedImageUrl: e.target.value })} placeholder="Hero image URL" style={inputStyle} />
                        <input value={a.embedThumbnailUrl} onChange={(e) => updateAction(a.id, { embedThumbnailUrl: e.target.value })} placeholder="Thumbnail URL" style={inputStyle} />
                      </div>
                      <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <input type="checkbox" checked={a.ephemeral} onChange={(e) => updateAction(a.id, { ephemeral: e.target.checked })} />
                        ephemeral when replying from slash context
                      </label>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 8 }}>
                        <select
                          value={mentionRoleByAction[a.id] || ""}
                          onChange={(e) => setMentionRoleByAction((prev) => ({ ...prev, [a.id]: e.target.value }))}
                          style={inputStyle}
                        >
                          <option value="">Select role to tag</option>
                          {roles.map((r) => <option key={r.id} value={r.id}>@{r.name}</option>)}
                        </select>
                        <button
                          onClick={() => appendRoleMentionToAction(a.id, mentionRoleByAction[a.id] || "")}
                          style={btnGhostMini}
                          disabled={!mentionRoleByAction[a.id]}
                        >
                          Tag Role
                        </button>
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 8 }}>
                        <select
                          value={mentionChannelByAction[a.id] || ""}
                          onChange={(e) => setMentionChannelByAction((prev) => ({ ...prev, [a.id]: e.target.value }))}
                          style={inputStyle}
                        >
                          <option value="">Select channel to tag</option>
                          {channels.map((c) => <option key={c.id} value={c.id}>#{c.name}</option>)}
                        </select>
                        <button
                          onClick={() => appendChannelMentionToAction(a.id, mentionChannelByAction[a.id] || "")}
                          style={btnGhostMini}
                          disabled={!mentionChannelByAction[a.id]}
                        >
                          Tag Channel
                        </button>
                      </div>
                      <div style={hintStyle}>Use this for rule cards, announcements, and formatted command responses without dropping into raw JSON.</div>
                    </div>
                  )}

                  {(a.type === "REPLY") && (
                    <div style={{ display: "grid", gap: 8 }}>
                      <div style={twoCol}>
                        <GuildEmojiField emojis={emojis} loading={guildDataLoading} error={emojiError} onInsert={(value) => updateAction(a.id, { content: value })}><textarea rows={3} value={a.content} onChange={(e) => updateAction(a.id, { content: e.target.value })} placeholder="Reply text" style={{ ...inputStyle, fontFamily: "inherit" }} /></GuildEmojiField>
                        <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <input type="checkbox" checked={a.ephemeral} onChange={(e) => updateAction(a.id, { ephemeral: e.target.checked })} />
                          ephemeral (slash context)
                        </label>
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 8 }}>
                        <select
                          value={mentionRoleByAction[a.id] || ""}
                          onChange={(e) => setMentionRoleByAction((prev) => ({ ...prev, [a.id]: e.target.value }))}
                          style={inputStyle}
                        >
                          <option value="">Select role to tag</option>
                          {roles.map((r) => <option key={r.id} value={r.id}>@{r.name}</option>)}
                        </select>
                        <button
                          onClick={() => appendRoleMentionToAction(a.id, mentionRoleByAction[a.id] || "")}
                          style={btnGhostMini}
                          disabled={!mentionRoleByAction[a.id]}
                        >
                          Tag Role
                        </button>
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 8 }}>
                        <select
                          value={mentionChannelByAction[a.id] || ""}
                          onChange={(e) => setMentionChannelByAction((prev) => ({ ...prev, [a.id]: e.target.value }))}
                          style={inputStyle}
                        >
                          <option value="">Select channel to tag</option>
                          {channels.map((c) => <option key={c.id} value={c.id}>#{c.name}</option>)}
                        </select>
                        <button
                          onClick={() => appendChannelMentionToAction(a.id, mentionChannelByAction[a.id] || "")}
                          style={btnGhostMini}
                          disabled={!mentionChannelByAction[a.id]}
                        >
                          Tag Channel
                        </button>
                      </div>
                    </div>
                  )}

                  {(a.type === "DM") && (
                    <div style={{ display: "grid", gap: 8 }}>
                      <GuildEmojiField emojis={emojis} loading={guildDataLoading} error={emojiError} onInsert={(value) => updateAction(a.id, { content: value })}><textarea rows={3} value={a.content} onChange={(e) => updateAction(a.id, { content: e.target.value })} placeholder="DM text" style={{ ...inputStyle, fontFamily: "inherit" }} /></GuildEmojiField>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 8 }}>
                        <select
                          value={mentionRoleByAction[a.id] || ""}
                          onChange={(e) => setMentionRoleByAction((prev) => ({ ...prev, [a.id]: e.target.value }))}
                          style={inputStyle}
                        >
                          <option value="">Select role to tag</option>
                          {roles.map((r) => <option key={r.id} value={r.id}>@{r.name}</option>)}
                        </select>
                        <button
                          onClick={() => appendRoleMentionToAction(a.id, mentionRoleByAction[a.id] || "")}
                          style={btnGhostMini}
                          disabled={!mentionRoleByAction[a.id]}
                        >
                          Tag Role
                        </button>
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 8 }}>
                        <select
                          value={mentionChannelByAction[a.id] || ""}
                          onChange={(e) => setMentionChannelByAction((prev) => ({ ...prev, [a.id]: e.target.value }))}
                          style={inputStyle}
                        >
                          <option value="">Select channel to tag</option>
                          {channels.map((c) => <option key={c.id} value={c.id}>#{c.name}</option>)}
                        </select>
                        <button
                          onClick={() => appendChannelMentionToAction(a.id, mentionChannelByAction[a.id] || "")}
                          style={btnGhostMini}
                          disabled={!mentionChannelByAction[a.id]}
                        >
                          Tag Channel
                        </button>
                      </div>
                    </div>
                  )}

                  {(a.type === "ADD_ROLE" || a.type === "REMOVE_ROLE") && (
                    <select value={a.roleId} onChange={(e) => updateAction(a.id, { roleId: e.target.value })} style={inputStyle}>
                      <option value="">Select role</option>
                      {roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                    </select>
                  )}

                  {(a.type === "REACT") && (
                    <div><input value={a.emoji} onChange={(e) => updateAction(a.id, { emoji: e.target.value })} placeholder="Emoji (😀, 🔥, <:custom:123>)" style={inputStyle} /><GuildEmojiPicker emojis={emojis} loading={guildDataLoading} error={emojiError} onInsert={(token) => updateAction(a.id, { emoji: token })} /></div>
                  )}

                  {(a.type === "DELAY") && (
                    <input value={a.delayMs} onChange={(e) => updateAction(a.id, { delayMs: e.target.value })} placeholder="Delay in ms (1000)" style={inputStyle} />
                  )}

                  {(a.type === "CREATE_THREAD") && (
                    <div style={twoCol}>
                      <input value={a.threadName} onChange={(e) => updateAction(a.id, { threadName: e.target.value })} placeholder="Thread name" style={inputStyle} />
                      <input value={a.threadArchiveMin} onChange={(e) => updateAction(a.id, { threadArchiveMin: e.target.value })} placeholder="Auto archive min (60)" style={inputStyle} />
                    </div>
                  )}

                  {(a.type === "RUN_NATIVE_COMMAND") && (
                    <div style={{ display: "grid", gap: 8 }}>
                      <input
                        list="native-command-keys"
                        value={a.nativeCommandKey}
                        onChange={(e) => updateAction(a.id, { nativeCommandKey: e.target.value })}
                        placeholder="Command key (example: heist.start)"
                        style={inputStyle}
                      />
                      <select
                        value={a.nativeCommandChannelId}
                        onChange={(e) => updateAction(a.id, { nativeCommandChannelId: e.target.value })}
                        style={inputStyle}
                      >
                        <option value="">Use current channel</option>
                        {textChannels.map((c) => <option key={c.id} value={c.id}>#{c.name}</option>)}
                      </select>
                      <textarea
                        rows={6}
                        value={a.nativeCommandOptionsJson}
                        onChange={(e) => updateAction(a.id, { nativeCommandOptionsJson: e.target.value })}
                        placeholder={'{\n  "edition": "LE"\n}'}
                        style={{ ...inputStyle, fontFamily: "ui-monospace, SFMono-Regular, Consolas, monospace" }}
                      />
                      <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <input
                          type="checkbox"
                          checked={a.nativeCommandSilent}
                          onChange={(e) => updateAction(a.id, { nativeCommandSilent: e.target.checked })}
                        />
                        keep command replies silent
                      </label>
                      {(() => {
                        const selected = nativeCommandEntries.find((entry) => entry.key === a.nativeCommandKey);
                        if (!selected) {
                          return (
                            <div style={hintStyle}>
                              {nativeCommandsLoading
                                ? "Loading available bot commands..."
                                : "Use the bot's canonical command key and a JSON object for its options."}
                            </div>
                          );
                        }
                        return (
                          <div style={hintStyle}>
                            {selected.title}
                            {selected.optionSummary?.length ? ` | Options: ${selected.optionSummary.join(", ")}` : " | No options"}
                          </div>
                        );
                      })()}
                    </div>
                  )}

                  {(a.type === "RAW") && (
                    <div style={{ fontSize: 12, color: "#ffb0b0" }}>
                      Unsupported legacy action kept safely. It will be preserved on save.
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div style={{ marginTop: 14, display: "flex", gap: 10 }}>
              <button onClick={saveCommand} disabled={saving} style={btnPrimary}>
                {saving ? "Saving..." : draft.id ? "Save Command" : "Create Command"}
              </button>
            </div>
          </div>
          </div>
        </div>
      ) : null}
      <datalist id="native-command-keys">
        {nativeCommandEntries.map((entry) => (
          <option key={entry.key} value={entry.key}>{entry.title}</option>
        ))}
      </datalist>
    </div>
  );
}

const h1Style: CSSProperties = {
  color: "#ff3131",
  letterSpacing: "0.14em",
  textTransform: "uppercase",
  marginBottom: 6
};

const panelStyle: CSSProperties = {
  border: "1px solid #6f0000",
  borderRadius: 12,
  padding: 12,
  background: "rgba(100,0,0,0.08)"
};

const listRow: CSSProperties = {
  border: "1px solid #5f0000",
  borderRadius: 10,
  padding: 8,
  background: "rgba(255,0,0,0.05)"
};

const inputStyle: CSSProperties = {
  width: "100%",
  padding: 10,
  background: "#0d0d0d",
  border: "1px solid #7a0000",
  color: "#ffd2d2",
  borderRadius: 8
};

const btnPrimary: CSSProperties = {
  border: "1px solid #9a0000",
  background: "rgba(255,0,0,0.15)",
  color: "#ffd6d6",
  padding: "10px 14px",
  borderRadius: 10,
  cursor: "pointer"
};

const btnGhostMini: CSSProperties = {
  border: "1px solid #8a0000",
  background: "transparent",
  color: "#ffd6d6",
  padding: "4px 8px",
  borderRadius: 8,
  cursor: "pointer"
};

const btnDangerMini: CSSProperties = {
  border: "1px solid #9a0000",
  background: "transparent",
  color: "#ffb0b0",
  padding: "4px 8px",
  borderRadius: 8,
  cursor: "pointer"
};

const listBtn: CSSProperties = {
  border: "none",
  background: "transparent",
  color: "#ffdede",
  cursor: "pointer",
  fontWeight: 800,
  padding: 0,
  textAlign: "left"
};

const sectionTitle: CSSProperties = {
  margin: "0 0 10px",
  color: "#ffdada",
  letterSpacing: "0.08em",
  textTransform: "uppercase"
};

const subTitle: CSSProperties = {
  margin: "0 0 8px",
  color: "#ffdada",
  letterSpacing: "0.06em",
  textTransform: "uppercase"
};

const summaryStyle: CSSProperties = {
  cursor: "pointer",
  color: "#ffbdbd",
  letterSpacing: "0.04em"
};

const actionLibraryCard: CSSProperties = {
  border: "1px solid #7a0000",
  background: "rgba(255,0,0,0.06)",
  color: "#ffd6d6",
  borderRadius: 10,
  padding: "10px 12px",
  textAlign: "left",
  cursor: "pointer"
};

const actionCard: CSSProperties = {
  border: "1px solid #5f0000",
  borderRadius: 10,
  padding: 10,
  background: "rgba(255,0,0,0.04)"
};

const twoCol: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 10,
  marginTop: 8
};

const deletePanelStyle: CSSProperties = {
  gridColumn: "1 / -1",
  borderTop: "1px solid rgba(255,0,0,0.2)",
  marginTop: 8,
  paddingTop: 10,
  display: "grid",
  gap: 8
};

const miniLabel: CSSProperties = {
  marginBottom: 6,
  fontSize: 11,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  color: "#ffbdbd"
};

const hintStyle: CSSProperties = {
  paddingTop: 12,
  color: "#ff9d9d",
  fontSize: 12
};
