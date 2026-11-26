"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import GuildEmojiField from "@/components/possum/GuildEmojiField";
import GuildEmojiPicker, { type GuildEmoji } from "@/components/possum/GuildEmojiPicker";

type GuildRole = { id: string; name: string };
type GuildChannel = { id: string; name: string; type?: string };
type NativeCommandEntry = {
  key: string;
  title: string;
  description: string;
  optionSummary?: string[];
  executable?: boolean;
  commandName?: string;
};

type TriggerType =
  | "MESSAGE_CREATE"
  | "MESSAGE_DELETE"
  | "MESSAGE_UPDATE"
  | "MESSAGE_BULK_DELETE"
  | "BUTTON_CLICK"
  | "REACTION_ADD"
  | "REACTION_REMOVE"
  | "MEMBER_JOIN"
  | "MEMBER_LEAVE"
  | "MEMBER_UPDATE"
  | "MEMBER_ROLE_ADD"
  | "MEMBER_ROLE_REMOVE"
  | "VOICE_JOIN"
  | "VOICE_LEAVE"
  | "VOICE_MOVE"
  | "THREAD_CREATE"
  | "CHANNEL_CREATE"
  | "CHANNEL_UPDATE"
  | "CHANNEL_DELETE"
  | "ROLE_CREATE"
  | "ROLE_UPDATE"
  | "ROLE_DELETE"
  | "GUILD_BAN_ADD"
  | "GUILD_BAN_REMOVE"
  | "INVITE_CREATE"
  | "INVITE_DELETE"
  | "WEBHOOKS_UPDATE"
  | "EMOJI_CREATE"
  | "EMOJI_UPDATE"
  | "EMOJI_DELETE"
  | "STICKER_CREATE"
  | "STICKER_UPDATE"
  | "STICKER_DELETE"
  | "VACATION_MODE_START"
  | "VACATION_MODE_END"
  | "SCHEDULED";

type ConditionType =
  | "CHANNEL_IS"
  | "CATEGORY_IS"
  | "MESSAGE_CONTAINS"
  | "MESSAGE_STARTS_WITH"
  | "MESSAGE_EQUALS"
  | "MESSAGE_HAS_ATTACHMENT"
  | "MESSAGE_HAS_LINK"
  | "IS_BOT"
  | "HAS_ROLE"
  | "LACKS_ROLE"
  | "IS_STAFF"
  | "VOICE_SESSION_SHORTER_THAN"
  | "RANDOM_CHANCE";

type ActionType =
  | "SEND_MESSAGE"
  | "SEND_EMBED"
  | "REPLY"
  | "REACT"
  | "ADD_ROLE"
  | "REMOVE_ROLE"
  | "MUTE_MEMBER"
  | "TIMEOUT_MEMBER"
  | "KICK_MEMBER"
  | "BAN_MEMBER"
  | "DM"
  | "DELETE_TRIGGER_MESSAGE"
  | "DELAY"
  | "CREATE_THREAD"
  | "RUN_NATIVE_COMMAND";

type AutomationItem = {
  id: string;
  guildId: string;
  name: string;
  description?: string | null;
  status?: string | null;
  enabled?: boolean;
  triggerType?: string;
  triggerConfig?: Record<string, unknown> | null;
  runLimitPerMin?: number;
  maxActions?: number;
  timeoutMs?: number;
  updatedAt?: string;
  publishedAt?: string | null;
};

type AutomationBlock = {
  id?: string;
  kind: "CONDITION" | "ACTION";
  type: string;
  config?: Record<string, unknown>;
  order?: number;
  groupId?: string | null;
  groupOp?: "AND" | "OR" | null;
  negate?: boolean;
};

type AutomationDetail = AutomationItem & {
  blocks?: AutomationBlock[];
};

type ConditionDraft = {
  id: string;
  type: ConditionType;
  negate: boolean;
  config: Record<string, unknown>;
};

type ActionDraft = {
  id: string;
  type: ActionType;
  config: Record<string, unknown>;
};

type TriggerDef = {
  value: TriggerType;
  label: string;
  description: string;
};

const TRIGGER_GROUPS: Array<{ label: string; items: TriggerDef[] }> = [
  { label: "Messages and community", items: [
    { value: "MESSAGE_CREATE", label: "Sends a message", description: "Runs when a member sends a message." },
    { value: "MESSAGE_UPDATE", label: "Edits a message", description: "Runs when a member edits a message." },
    { value: "MESSAGE_DELETE", label: "Deletes a message", description: "Runs when a member deletes a message." },
    { value: "MESSAGE_BULK_DELETE", label: "Messages are bulk-deleted", description: "Runs when messages are purged in a channel." },
    { value: "BUTTON_CLICK", label: "Clicks a button", description: "Runs on a server button interaction." },
    { value: "REACTION_ADD", label: "Adds a reaction", description: "Runs when a member adds a reaction." },
    { value: "REACTION_REMOVE", label: "Removes a reaction", description: "Runs when a member removes a reaction." },
    { value: "THREAD_CREATE", label: "Creates a thread", description: "Runs when a new thread is created." },
  ] },
  { label: "Members and voice", items: [
    { value: "MEMBER_JOIN", label: "Joins the server", description: "Runs when a member joins." },
    { value: "MEMBER_LEAVE", label: "Leaves the server", description: "Runs when a member leaves." },
    { value: "MEMBER_UPDATE", label: "Updates their member profile", description: "Runs when Discord reports a member profile or role update." },
    { value: "MEMBER_ROLE_ADD", label: "Gains a role", description: "Runs when a member gains one of the selected roles." },
    { value: "MEMBER_ROLE_REMOVE", label: "Loses a role", description: "Runs when a member loses one of the selected roles." },
    { value: "VOICE_JOIN", label: "Joins a voice channel", description: "Runs when a member joins voice." },
    { value: "VOICE_LEAVE", label: "Leaves a voice channel", description: "Runs when a member leaves voice." },
    { value: "VOICE_MOVE", label: "Moves voice channels", description: "Runs when a member moves between voice channels." },
  ] },
  { label: "Server changes", items: [
    { value: "CHANNEL_CREATE", label: "A channel is created", description: "Runs when a server channel is created." },
    { value: "CHANNEL_UPDATE", label: "A channel is updated", description: "Runs when a server channel changes." },
    { value: "CHANNEL_DELETE", label: "A channel is deleted", description: "Runs when a server channel is deleted." },
    { value: "ROLE_CREATE", label: "A role is created", description: "Runs when a server role is created." },
    { value: "ROLE_UPDATE", label: "A role is updated", description: "Runs when a server role changes." },
    { value: "ROLE_DELETE", label: "A role is deleted", description: "Runs when a server role is deleted." },
    { value: "GUILD_BAN_ADD", label: "A member is banned", description: "Runs when Discord reports a server ban." },
    { value: "GUILD_BAN_REMOVE", label: "A ban is removed", description: "Runs when a server ban is lifted." },
    { value: "INVITE_CREATE", label: "An invite is created", description: "Runs when a server invite is created." },
    { value: "INVITE_DELETE", label: "An invite is deleted", description: "Runs when a server invite is deleted." },
    { value: "WEBHOOKS_UPDATE", label: "Server webhooks change", description: "Runs when Discord reports a channel webhook update." },
    { value: "EMOJI_CREATE", label: "An emoji is added", description: "Runs when a server emoji is added." },
    { value: "EMOJI_UPDATE", label: "An emoji is changed", description: "Runs when a server emoji is changed." },
    { value: "EMOJI_DELETE", label: "An emoji is removed", description: "Runs when a server emoji is removed." },
    { value: "STICKER_CREATE", label: "A sticker is added", description: "Runs when a server sticker is added." },
    { value: "STICKER_UPDATE", label: "A sticker is changed", description: "Runs when a server sticker is changed." },
    { value: "STICKER_DELETE", label: "A sticker is removed", description: "Runs when a server sticker is removed." },
  ] },
  { label: "Schedules and vacation mode", items: [
    { value: "SCHEDULED", label: "Hits a timer", description: "Runs on the interval you set." },
    { value: "VACATION_MODE_START", label: "Vacation mode starts", description: "Runs when an admin turns vacation mode on." },
    { value: "VACATION_MODE_END", label: "Vacation mode ends", description: "Runs when an admin turns vacation mode off." },
  ] },
];
const TRIGGERS = TRIGGER_GROUPS.flatMap((group) => group.items);

const CONDITION_OPTIONS: Array<{ value: ConditionType; label: string }> = [
  { value: "MESSAGE_CONTAINS", label: "Message contains" },
  { value: "MESSAGE_STARTS_WITH", label: "Message starts with" },
  { value: "MESSAGE_EQUALS", label: "Message exactly matches" },
  { value: "MESSAGE_HAS_ATTACHMENT", label: "Message has an attachment" },
  { value: "MESSAGE_HAS_LINK", label: "Message has a link" },
  { value: "IS_BOT", label: "Author is a bot" },
  { value: "CHANNEL_IS", label: "Channel is" },
  { value: "CATEGORY_IS", label: "Category is" },
  { value: "HAS_ROLE", label: "Member has role" },
  { value: "LACKS_ROLE", label: "Member lacks role" },
  { value: "IS_STAFF", label: "Member is staff (admin)" },
  { value: "VOICE_SESSION_SHORTER_THAN", label: "Voice stay shorter than" },
  { value: "RANDOM_CHANCE", label: "Random chance %" },
];

const ACTION_OPTIONS: Array<{ value: ActionType; label: string }> = [
  { value: "SEND_MESSAGE", label: "Send a message" },
  { value: "SEND_EMBED", label: "Embed Messages" },
  { value: "REPLY", label: "Reply to message" },
  { value: "REACT", label: "React with emoji" },
  { value: "ADD_ROLE", label: "Give role" },
  { value: "REMOVE_ROLE", label: "Remove role" },
  { value: "MUTE_MEMBER", label: "Mute member" },
  { value: "TIMEOUT_MEMBER", label: "Timeout member" },
  { value: "KICK_MEMBER", label: "Kick member" },
  { value: "BAN_MEMBER", label: "Ban member" },
  { value: "DM", label: "Send DM" },
  { value: "DELETE_TRIGGER_MESSAGE", label: "Delete trigger message" },
  { value: "DELAY", label: "Delay" },
  { value: "CREATE_THREAD", label: "Create thread" },
  { value: "RUN_NATIVE_COMMAND", label: "Run an available bot command" },
];

function getGuildId(): string {
  if (typeof window === "undefined") return "";
  const q = new URLSearchParams(window.location.search).get("guildId") || "";
  const s = localStorage.getItem("activeGuildId") || "";
  const guildId = (q || s).trim();
  if (guildId) localStorage.setItem("activeGuildId", guildId);
  return guildId;
}

function getAutomationIdFromQuery(): string {
  if (typeof window === "undefined") return "";
  return String(new URLSearchParams(window.location.search).get("automationId") || "").trim();
}

function setAutomationQueryParam(automationId: string) {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  if (automationId) url.searchParams.set("automationId", automationId);
  else url.searchParams.delete("automationId");
  window.history.replaceState({}, "", url.toString());
}

function parseAutomationsResponse(payload: unknown): AutomationItem[] {
  if (Array.isArray(payload)) return payload as AutomationItem[];
  if (payload && typeof payload === "object") {
    const record = payload as Record<string, unknown>;
    if (Array.isArray(record.automations)) return record.automations as AutomationItem[];
    if (Array.isArray(record.items)) return record.items as AutomationItem[];
  }
  return [];
}

function formatTime(value?: string | null): string {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleString();
}

function uid(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

function asString(obj: Record<string, unknown>, key: string, fallback = ""): string {
  const value = obj[key];
  return typeof value === "string" ? value : fallback;
}

function asNumber(obj: Record<string, unknown>, key: string, fallback = 0): number {
  const value = obj[key];
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function asBoolean(obj: Record<string, unknown>, key: string, fallback = false): boolean {
  const value = obj[key];
  if (typeof value === "boolean") return value;
  return fallback;
}

function appendEmojiToken(currentValue: string, emojiToken: string): string {
  const nextToken = String(emojiToken || "").trim();
  if (!nextToken) return String(currentValue || "");
  const existing = String(currentValue || "")
    .split(/[\r\n,]+/)
    .map((item) => item.trim())
    .filter(Boolean);
  if (!existing.includes(nextToken)) existing.push(nextToken);
  return existing.join(", ");
}

function toggleId(list: string[], id: string): string[] {
  return list.includes(id) ? list.filter((value) => value !== id) : [...list, id];
}

function defaultTriggerConfig(triggerType: TriggerType): Record<string, unknown> {
  switch (triggerType) {
    case "REACTION_ADD":
    case "REACTION_REMOVE":
      return { emojis: [] };
    case "BUTTON_CLICK":
      return { customIds: [] };
    case "MEMBER_ROLE_ADD":
    case "MEMBER_ROLE_REMOVE":
      return { roleIds: [] };
    case "SCHEDULED":
      return { intervalValue: 1, intervalUnit: "hours", channelId: "" };
    case "MESSAGE_CREATE":
    case "MESSAGE_DELETE":
    case "MESSAGE_UPDATE":
      return { channels: [], keywords: [] };
    default:
      return {};
  }
}

function defaultCondition(type: ConditionType): ConditionDraft {
  if (type === "CHANNEL_IS") return { id: uid("cond"), type, negate: false, config: { channelId: "" } };
  if (type === "CATEGORY_IS") return { id: uid("cond"), type, negate: false, config: { categoryId: "" } };
  if (type === "HAS_ROLE" || type === "LACKS_ROLE") return { id: uid("cond"), type, negate: false, config: { roleId: "" } };
  if (type === "VOICE_SESSION_SHORTER_THAN") return { id: uid("cond"), type, negate: false, config: { seconds: 30 } };
  if (type === "RANDOM_CHANCE") return { id: uid("cond"), type, negate: false, config: { pct: 100 } };
  if (type === "IS_STAFF" || type === "IS_BOT" || type === "MESSAGE_HAS_ATTACHMENT" || type === "MESSAGE_HAS_LINK") return { id: uid("cond"), type, negate: false, config: {} };
  return { id: uid("cond"), type, negate: false, config: { value: "" } };
}

function defaultAction(type: ActionType): ActionDraft {
  if (type === "SEND_MESSAGE") return { id: uid("act"), type, config: { channelId: "", content: "", reactions: "" } };
  if (type === "SEND_EMBED") {
    return {
      id: uid("act"),
      type,
      config: {
        channelId: "",
        content: "",
        title: "",
        description: "",
        color: "#ff5a5a",
        imageUrl: "",
        thumbnailUrl: "",
        footerText: "",
        reactions: "",
        ephemeral: false,
      }
    };
  }
  if (type === "REPLY") return { id: uid("act"), type, config: { content: "", reactions: "", ephemeral: false } };
  if (type === "REACT") return { id: uid("act"), type, config: { emoji: "" } };
  if (type === "ADD_ROLE" || type === "REMOVE_ROLE") return { id: uid("act"), type, config: { roleId: "" } };
  if (type === "MUTE_MEMBER") return { id: uid("act"), type, config: { roleId: "", reason: "" } };
  if (type === "TIMEOUT_MEMBER") return { id: uid("act"), type, config: { minutes: 10, reason: "" } };
  if (type === "KICK_MEMBER") return { id: uid("act"), type, config: { reason: "" } };
  if (type === "BAN_MEMBER") return { id: uid("act"), type, config: { reason: "", deleteMessageSeconds: 0 } };
  if (type === "DM") return { id: uid("act"), type, config: { content: "", reactions: "" } };
  if (type === "DELETE_TRIGGER_MESSAGE") return { id: uid("act"), type, config: {} };
  if (type === "DELAY") return { id: uid("act"), type, config: { ms: 1000 } };
  if (type === "RUN_NATIVE_COMMAND") return { id: uid("act"), type, config: { commandKey: "", optionsJson: "{\n}", channelId: "", silent: true } };
  return { id: uid("act"), type, config: { name: "Thread", autoArchiveDuration: 60 } };
}

function conditionFromBlock(block: AutomationBlock): ConditionDraft {
  const type = String(block.type || "MESSAGE_CONTAINS") as ConditionType;
  const base = defaultCondition(type);
  const config = (block.config && typeof block.config === "object" ? block.config : {}) as Record<string, unknown>;
  return {
    id: block.id || uid("cond"),
    type,
    negate: Boolean(block.negate),
    config: { ...base.config, ...config },
  };
}

function actionFromBlock(block: AutomationBlock): ActionDraft {
  const type = String(block.type || "REPLY") as ActionType;
  const base = defaultAction(type);
  const config = (block.config && typeof block.config === "object" ? block.config : {}) as Record<string, unknown>;
  return {
    id: block.id || uid("act"),
    type,
    config: { ...base.config, ...config },
  };
}

function asPositiveInt(input: number, fallback: number): number {
  const n = Number(input);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.floor(n);
}

function firstIdFromResponse(payload: unknown): string {
  if (!payload || typeof payload !== "object") return "";
  const obj = payload as Record<string, unknown>;
  if (typeof obj.id === "string") return obj.id;
  if (obj.automation && typeof obj.automation === "object") {
    const nested = obj.automation as Record<string, unknown>;
    if (typeof nested.id === "string") return nested.id;
  }
  return "";
}

export default function BotAutomationStudioClient() {
  const [guildId, setGuildId] = useState<string>("");
  const [guildName, setGuildName] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [logChannelId, setLogChannelId] = useState("");
  const [exemptRoleIds, setExemptRoleIds] = useState<string[]>([]);
  const [vacationModeEnabled, setVacationModeEnabled] = useState(false);
  const [vacationBusy, setVacationBusy] = useState(false);

  const [roles, setRoles] = useState<GuildRole[]>([]);
  const [channels, setChannels] = useState<GuildChannel[]>([]);
  const [emojis, setEmojis] = useState<GuildEmoji[]>([]);
  const [emojiError, setEmojiError] = useState("");
  const [nativeCommandEntries, setNativeCommandEntries] = useState<NativeCommandEntry[]>([]);
  const [automations, setAutomations] = useState<AutomationItem[]>([]);
  const [selectedId, setSelectedId] = useState<string>("new");

  const [name, setName] = useState("New Automation");
  const [description, setDescription] = useState("");
  const [enabled, setEnabled] = useState(true);
  const [status, setStatus] = useState("DRAFT");
  const [triggerType, setTriggerType] = useState<TriggerType>("MESSAGE_CREATE");
  const [triggerConfig, setTriggerConfig] = useState<Record<string, unknown>>(defaultTriggerConfig("MESSAGE_CREATE"));
  const [runLimitPerMin, setRunLimitPerMin] = useState<number>(30);
  const [maxActions, setMaxActions] = useState<number>(25);
  const [timeoutMs, setTimeoutMs] = useState<number>(3000);
  const [conditionJoinOp, setConditionJoinOp] = useState<"AND" | "OR">("AND");
  const [conditions, setConditions] = useState<ConditionDraft[]>([]);
  const [actions, setActions] = useState<ActionDraft[]>([defaultAction("SEND_MESSAGE")]);
  const [mentionRoleByAction, setMentionRoleByAction] = useState<Record<string, string>>({});
  const [mentionChannelByAction, setMentionChannelByAction] = useState<Record<string, string[]>>({});

  const categoryChannels = useMemo(
    () => channels.filter((c) => String(c.type || "").toLowerCase().includes("category")),
    [channels]
  );
  const textChannels = useMemo(
    () => channels.filter((c) => [0, 5].includes(Number(c.type || 0))),
    [channels]
  );
  const sortedRoles = useMemo(
    () => [...roles].sort((a, b) => a.name.localeCompare(b.name)),
    [roles]
  );
  const activeCount = useMemo(() => automations.filter((a) => a.enabled !== false).length, [automations]);

  function resetDraft(nextTrigger: TriggerType = "MESSAGE_CREATE") {
    setName("New Automation");
    setDescription("");
    setEnabled(true);
    setStatus("DRAFT");
    setTriggerType(nextTrigger);
    setTriggerConfig(defaultTriggerConfig(nextTrigger));
    setRunLimitPerMin(30);
    setMaxActions(25);
    setTimeoutMs(3000);
    setConditionJoinOp("AND");
    setConditions([]);
    setActions([defaultAction("SEND_MESSAGE")]);
    setMentionRoleByAction({});
    setMentionChannelByAction({});
  }

  async function loadGuildMeta(targetGuildId: string) {
    setEmojiError("");
    try {
      const r = await fetch(`/api/bot/guild-data?guildId=${encodeURIComponent(targetGuildId)}`);
      const j = await r.json();
      if (!r.ok || j?.success === false) throw new Error(j?.error || "Failed to load guild data");
      setRoles(Array.isArray(j?.roles) ? j.roles : []);
      setChannels(Array.isArray(j?.channels) ? j.channels : []);
      setEmojis(Array.isArray(j?.emojis) ? j.emojis : []);
      const nextGuildName = String(j?.guild?.name || "").trim();
      setGuildName(nextGuildName);
      if (nextGuildName) localStorage.setItem("activeGuildName", nextGuildName);
    } catch (error) {
      setEmojiError(error instanceof Error ? error.message : "Failed to load guild data");
      throw error;
    }
  }

  async function loadAutomations(targetGuildId: string) {
    const res = await fetch(`/api/bot/automations?guildId=${encodeURIComponent(targetGuildId)}`, { cache: "no-store" });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error((json as { error?: string })?.error || "Failed to load automations");
    const items = parseAutomationsResponse(json);
    setAutomations(items);
    return items;
  }

  async function loadStudioConfig(targetGuildId: string) {
    const res = await fetch(`/api/bot/engine-config?guildId=${encodeURIComponent(targetGuildId)}&engine=automationStudio`, { cache: "no-store" });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || json?.success === false) {
      throw new Error((json as { error?: string })?.error || "Failed to load automation studio config");
    }
    setLogChannelId(String(json?.config?.logChannelId || ""));
    setExemptRoleIds(
      Array.isArray(json?.config?.exemptRoleIds)
        ? json.config.exemptRoleIds.map((id: unknown) => String(id || "").trim()).filter(Boolean)
        : []
    );
    setVacationModeEnabled(json?.config?.vacationMode?.enabled === true);
  }

  async function loadNativeCommands(targetGuildId: string) {
    const res = await fetch(`/api/bot/native-commands?guildId=${encodeURIComponent(targetGuildId)}&bust=${Date.now()}`, { cache: "no-store" });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || json?.success === false) {
      throw new Error((json as { error?: string })?.error || "Failed to load bot slash commands");
    }

    const entries = Array.isArray(json?.registry?.entries) ? json.registry.entries : [];
    const aggregateRoots = new Set(["control", "ops", "games", "community", "progress"]);
    const filtered = entries
      .filter((entry: NativeCommandEntry) => entry?.executable && !aggregateRoots.has(String(entry?.commandName || "").toLowerCase()))
      .sort((left: NativeCommandEntry, right: NativeCommandEntry) => String(left.title || left.key).localeCompare(String(right.title || right.key)));
    setNativeCommandEntries(filtered);
  }

  async function loadAutomationDetail(id: string) {
    const res = await fetch(`/api/bot/automation/${encodeURIComponent(id)}`, { cache: "no-store" });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error((json as { error?: string })?.error || "Failed to load automation");
    const detail = (json || {}) as AutomationDetail;

    setName(detail.name || "Untitled Automation");
    setDescription(String(detail.description || ""));
    setEnabled(detail.enabled !== false);
    setStatus(String(detail.status || "DRAFT"));
    const trigger = (detail.triggerType || "MESSAGE_CREATE") as TriggerType;
    setTriggerType(trigger);
    setTriggerConfig(
      detail.triggerConfig && typeof detail.triggerConfig === "object"
        ? ({ ...defaultTriggerConfig(trigger), ...(detail.triggerConfig as Record<string, unknown>) })
        : defaultTriggerConfig(trigger)
    );
    setRunLimitPerMin(asPositiveInt(Number(detail.runLimitPerMin || 30), 30));
    setMaxActions(asPositiveInt(Number(detail.maxActions || 25), 25));
    setTimeoutMs(asPositiveInt(Number(detail.timeoutMs || 3000), 3000));

    const blocks = Array.isArray(detail.blocks) ? [...detail.blocks] : [];
    blocks.sort((a, b) => Number(a.order || 0) - Number(b.order || 0));
    const condBlocks = blocks.filter((b) => b.kind === "CONDITION");
    const actionBlocks = blocks.filter((b) => b.kind === "ACTION");
    setConditionJoinOp((condBlocks[0]?.groupOp || "AND") === "OR" ? "OR" : "AND");
    setConditions(condBlocks.map(conditionFromBlock));
    setActions(actionBlocks.map(actionFromBlock));
    setMentionRoleByAction({});
    setMentionChannelByAction({});
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const gid = getGuildId();
      setGuildId(gid);
      if (!gid) {
        setLoading(false);
        return;
      }
      setLoading(true);
      setMsg("");
      try {
        await Promise.all([loadGuildMeta(gid), loadStudioConfig(gid), loadNativeCommands(gid)]);
        const items = await loadAutomations(gid);
        const requestedId = getAutomationIdFromQuery();
        if (cancelled) return;
        if (requestedId && items.some((it) => it.id === requestedId)) {
          setSelectedId(requestedId);
          await loadAutomationDetail(requestedId);
        } else {
          setSelectedId("new");
          resetDraft();
          setAutomationQueryParam("");
        }
      } catch (err: unknown) {
        if (cancelled) return;
        setMsg(err instanceof Error ? err.message : "Failed to load automation studio");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function openAutomation(id: string) {
    setSelectedId(id);
    setAutomationQueryParam(id);
    setMsg("");
    try {
      setLoading(true);
      await loadAutomationDetail(id);
    } catch (err: unknown) {
      setMsg(err instanceof Error ? err.message : "Failed to open automation");
    } finally {
      setLoading(false);
    }
  }

  function createNewDraft() {
    setSelectedId("new");
    setAutomationQueryParam("");
    resetDraft();
    setMsg("");
  }

  async function saveStudioSettings() {
    if (!guildId) return;
    setSaving(true);
    setMsg("");
    try {
      const res = await fetch("/api/bot/engine-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          guildId,
          engine: "automationStudio",
          patch: { logChannelId, exemptRoleIds }
        })
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json?.success === false) {
        throw new Error((json as { error?: string })?.error || "Failed to save automation studio config");
      }
      setLogChannelId(String(json?.config?.logChannelId || ""));
      setExemptRoleIds(
        Array.isArray(json?.config?.exemptRoleIds)
          ? json.config.exemptRoleIds.map((id: unknown) => String(id || "").trim()).filter(Boolean)
          : []
      );
      setMsg("Automation studio settings saved.");
    } catch (err: unknown) {
      setMsg(err instanceof Error ? err.message : "Failed to save automation studio config");
    } finally {
      setSaving(false);
    }
  }

  async function toggleVacationMode() {
    if (!guildId) return;
    const nextEnabled = !vacationModeEnabled;
    setVacationBusy(true);
    setMsg("");
    try {
      const res = await fetch("/api/bot/engine-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          guildId,
          engine: "automationStudio",
          patch: { vacationMode: { enabled: nextEnabled } },
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json?.success === false) {
        throw new Error((json as { error?: string })?.error || "Could not change vacation mode.");
      }
      setVacationModeEnabled(json?.config?.vacationMode?.enabled === true);
      setMsg(nextEnabled
        ? "Vacation mode is on. Published Vacation Mode Starts automations have been triggered."
        : "Vacation mode is off. Published Vacation Mode Ends automations have been triggered.");
    } catch (err: unknown) {
      setMsg(err instanceof Error ? err.message : "Could not change vacation mode.");
    } finally {
      setVacationBusy(false);
    }
  }

  function updateCondition(id: string, patch: Partial<ConditionDraft>) {
    setConditions((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  }

  function updateConditionConfig(id: string, patch: Record<string, unknown>) {
    setConditions((prev) =>
      prev.map((c) => (c.id === id ? { ...c, config: { ...(c.config || {}), ...patch } } : c))
    );
  }

  function updateAction(id: string, patch: Partial<ActionDraft>) {
    setActions((prev) => prev.map((a) => (a.id === id ? { ...a, ...patch } : a)));
  }

  function updateActionConfig(id: string, patch: Record<string, unknown>) {
    setActions((prev) =>
      prev.map((a) => (a.id === id ? { ...a, config: { ...(a.config || {}), ...patch } } : a))
    );
  }

  function moveCondition(id: string, direction: -1 | 1) {
    setConditions((prev) => {
      const idx = prev.findIndex((c) => c.id === id);
      if (idx < 0) return prev;
      const next = idx + direction;
      if (next < 0 || next >= prev.length) return prev;
      const copy = [...prev];
      const temp = copy[idx];
      copy[idx] = copy[next];
      copy[next] = temp;
      return copy;
    });
  }

  function moveAction(id: string, direction: -1 | 1) {
    setActions((prev) => {
      const idx = prev.findIndex((a) => a.id === id);
      if (idx < 0) return prev;
      const next = idx + direction;
      if (next < 0 || next >= prev.length) return prev;
      const copy = [...prev];
      const temp = copy[idx];
      copy[idx] = copy[next];
      copy[next] = temp;
      return copy;
    });
  }

  function appendRoleMentionToAction(actionId: string, roleId: string) {
    const rid = String(roleId || "").trim();
    if (!rid) return;
    setActions((prev) =>
      prev.map((a) => {
        if (a.id !== actionId) return a;
        if (!(a.type === "SEND_MESSAGE" || a.type === "SEND_EMBED" || a.type === "REPLY" || a.type === "DM")) return a;
        const current = asString(a.config, "content", "");
        const mention = `<@&${rid}>`;
        const next = current.trim().length ? `${current} ${mention}` : mention;
        return { ...a, config: { ...a.config, content: next } };
      })
    );
  }

  function appendChannelMentionToAction(actionId: string, channelIds: string | string[]) {
    const ids = (Array.isArray(channelIds) ? channelIds : [channelIds])
      .map((channelId) => String(channelId || "").trim())
      .filter(Boolean);
    if (!ids.length) return;
    setActions((prev) =>
      prev.map((a) => {
        if (a.id !== actionId) return a;
        if (!(a.type === "SEND_MESSAGE" || a.type === "SEND_EMBED" || a.type === "REPLY" || a.type === "DM")) return a;
        const current = asString(a.config, "content", "");
        const existing = current.trim().length ? current.trim().split(/\s+/) : [];
        const mentions = ids.map((cid) => `<#${cid}>`).filter((mention) => !existing.includes(mention));
        if (!mentions.length) return a;
        const appended = mentions.join(" ");
        const next = current.trim().length ? `${current} ${appended}` : appended;
        return { ...a, config: { ...a.config, content: next } };
      })
    );
  }

  function toggleChannelMentionSelection(actionId: string, channelId: string) {
    const cid = String(channelId || "").trim();
    if (!cid) return;
    setMentionChannelByAction((prev) => {
      const selected = prev[actionId] || [];
      return {
        ...prev,
        [actionId]: selected.includes(cid)
          ? selected.filter((value) => value !== cid)
          : [...selected, cid],
      };
    });
  }

  function renderChannelMentionPicker(actionId: string) {
    const selected = mentionChannelByAction[actionId] || [];
    return (
      <div style={{ display: "grid", gap: 8 }}>
        <div style={{ fontSize: 12, color: "#ffb5b5" }}>
          Select one or more channels to tag. Selected: {selected.length}
        </div>
        <div
          style={{
            ...inputStyle,
            minHeight: 112,
            maxHeight: 180,
            overflowY: "auto",
            padding: 8,
            display: "grid",
            gap: 6,
          }}
        >
          {channels.map((c) => (
            <label
              key={c.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                color: "#ffd6d6",
                fontSize: 13,
              }}
            >
              <input
                type="checkbox"
                checked={selected.includes(c.id)}
                onChange={() => toggleChannelMentionSelection(actionId, c.id)}
              />
              <span>#{c.name}</span>
            </label>
          ))}
        </div>
        <button
          style={btnStyle}
          onClick={() => appendChannelMentionToAction(actionId, selected)}
        >
          Tag Channels
        </button>
      </div>
    );
  }

  function appendEmojiToActionConfig(actionId: string, configKey: string, emojiToken: string) {
    const token = String(emojiToken || "").trim();
    if (!token) return;
    setActions((prev) =>
      prev.map((action) => {
        if (action.id !== actionId) return action;
        const current = asString(action.config, configKey, "");
        return {
          ...action,
          config: {
            ...action.config,
            [configKey]: configKey === "emoji" ? token : appendEmojiToken(current, token),
          },
        };
      })
    );
  }

  function appendEmojiToTriggerConfig(configKey: string, emojiToken: string) {
    const token = String(emojiToken || "").trim();
    if (!token) return;
    setTriggerConfig((prev) => {
      const current = Array.isArray(prev[configKey]) ? prev[configKey] : String(prev[configKey] || "").split(/[\r\n,]+/);
      const next = current.map((item) => String(item || "").trim()).filter(Boolean);
      if (!next.includes(token)) next.push(token);
      return { ...prev, [configKey]: next };
    });
  }

  function renderEmojiPicker(targetKey: string, onInsert: (emojiToken: string) => void) {
    return <GuildEmojiPicker key={targetKey} emojis={emojis} error={emojiError} onInsert={onInsert} />;
  }

  async function saveAutomation(publishAfterSave = false) {
    if (!guildId) return;
    if (!name.trim()) {
      setMsg("Automation name is required.");
      return;
    }
    setSaving(true);
    setMsg("");
    try {
      const metaPayload = {
        name: name.trim(),
        description: description.trim() || null,
        status: publishAfterSave ? "DRAFT" : status || "DRAFT",
        enabled: !!enabled,
        triggerType,
        triggerConfig,
        runLimitPerMin: asPositiveInt(runLimitPerMin, 30),
        maxActions: asPositiveInt(maxActions, 25),
        timeoutMs: asPositiveInt(timeoutMs, 3000),
      };

      let automationId = selectedId !== "new" ? selectedId : "";

      if (selectedId === "new") {
        const createPayload = {
          guildId,
          version: 1,
          ...metaPayload,
        };
        const createRes = await fetch("/api/bot/automations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(createPayload),
        });
        const createJson = await createRes.json().catch(() => ({}));
        if (!createRes.ok) throw new Error((createJson as { error?: string })?.error || "Failed to create automation");
        automationId = firstIdFromResponse(createJson);
        if (!automationId) throw new Error("Create succeeded but automation id was missing.");
      } else {
        const updateRes = await fetch(`/api/bot/automation/${encodeURIComponent(automationId)}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(metaPayload),
        });
        const updateJson = await updateRes.json().catch(() => ({}));
        if (!updateRes.ok) throw new Error((updateJson as { error?: string })?.error || "Failed to update automation");
      }

      const blocks: AutomationBlock[] = [];
      conditions.forEach((c, i) => {
        blocks.push({
          kind: "CONDITION",
          type: c.type,
          config: c.config || {},
          order: i,
          groupId: "main",
          groupOp: conditionJoinOp,
          negate: !!c.negate,
        });
      });
      actions.forEach((a, i) => {
        blocks.push({
          kind: "ACTION",
          type: a.type,
          config: a.config || {},
          order: i,
        });
      });

      const blocksRes = await fetch(`/api/bot/automation/${encodeURIComponent(automationId)}/blocks`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ blocks }),
      });
      const blocksJson = await blocksRes.json().catch(() => ({}));
      if (!blocksRes.ok) throw new Error((blocksJson as { error?: string })?.error || "Failed to save automation blocks");

      if (publishAfterSave) {
        const publishRes = await fetch(`/api/bot/automation/${encodeURIComponent(automationId)}/publish`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        });
        const publishJson = await publishRes.json().catch(() => ({}));
        if (!publishRes.ok) throw new Error((publishJson as { error?: string })?.error || "Failed to publish automation");
      }

      const updatedItems = await loadAutomations(guildId);
      setSelectedId(automationId);
      setAutomationQueryParam(automationId);
      await loadAutomationDetail(automationId);
      const updated = updatedItems.find((it) => it.id === automationId);
      setStatus(String(updated?.status || (publishAfterSave ? "PUBLISHED" : status || "DRAFT")));
      setMsg(publishAfterSave ? "Automation saved and published." : "Automation saved.");
    } catch (err: unknown) {
      setMsg(err instanceof Error ? err.message : "Failed to save automation");
    } finally {
      setSaving(false);
    }
  }

  async function discardDraft() {
    setMsg("");
    if (selectedId === "new") {
      resetDraft(triggerType);
      return;
    }
    setLoading(true);
    try {
      await loadAutomationDetail(selectedId);
      setMsg("Discarded local edits.");
    } catch (err: unknown) {
      setMsg(err instanceof Error ? err.message : "Failed to discard");
    } finally {
      setLoading(false);
    }
  }

  async function deleteAutomation() {
    if (selectedId === "new") {
      setMsg("Save the automation before deleting it.");
      return;
    }
    if (!guildId) return;
    if (typeof window !== "undefined") {
      const ok = window.confirm(`Delete automation "${name}"? This cannot be undone.`);
      if (!ok) return;
    }

    setSaving(true);
    setMsg("");
    try {
      const res = await fetch(`/api/bot/automation/${encodeURIComponent(selectedId)}`, {
        method: "DELETE",
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((json as { error?: string })?.error || "Failed to delete automation");

      const updatedItems = await loadAutomations(guildId);
      createNewDraft();
      if (updatedItems.length) {
        const nextId = updatedItems[0]?.id || "";
        if (nextId) {
          await openAutomation(nextId);
        }
      }
      setMsg("Automation deleted.");
    } catch (err: unknown) {
      setMsg(err instanceof Error ? err.message : "Failed to delete automation");
    } finally {
      setSaving(false);
    }
  }

  function applyStarterTemplate(templateKey: string) {
    if (templateKey === "from-scratch") {
      resetDraft("MESSAGE_CREATE");
      setName("New Automation");
      return;
    }
    if (templateKey === "welcome") {
      resetDraft("MEMBER_JOIN");
      setName("Welcome - Template");
      setDescription("Welcome onboarding automation");
      setActions([
        {
          id: uid("act"),
          type: "SEND_MESSAGE",
          config: { channelId: "", content: "Welcome to the server <@{user}>!" },
        },
      ]);
      return;
    }
    if (templateKey === "starboard") {
      resetDraft("REACTION_ADD");
      setName("Starboard - Template");
      setDescription("Reaction-based automation");
      setConditions([defaultCondition("RANDOM_CHANCE")]);
      setActions([
        { id: uid("act"), type: "REPLY", config: { content: "Starboard reaction detected.", ephemeral: false } },
      ]);
      return;
    }
    if (templateKey === "thread-joiner") {
      resetDraft("THREAD_CREATE");
      setName("Thread Joiner - Template");
      setDescription("Thread-based automation");
      setActions([
        { id: uid("act"), type: "REPLY", config: { content: "Thread created. Team notified.", ephemeral: false } },
      ]);
      return;
    }
    if (templateKey === "vacation-start" || templateKey === "vacation-end") {
      const starting = templateKey === "vacation-start";
      const trigger: TriggerType = starting ? "VACATION_MODE_START" : "VACATION_MODE_END";
      resetDraft(trigger);
      setName(starting ? "Vacation Mode - Start" : "Vacation Mode - End");
      setDescription(starting ? "Run when vacation mode is turned on." : "Run when vacation mode is turned off.");
      setActions([defaultAction("SEND_MESSAGE")]);
    }
  }

  if (!guildId && !loading) {
    return <div style={{ color: "#ff7f7f", padding: 18 }}>Missing guildId. Open from /guilds first.</div>;
  }

  return (
    <div style={{ color: "#ffd0d0", maxWidth: 1450, padding: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
        <div>
          <h1 style={{ margin: 0, color: "#ff4f4f", letterSpacing: "0.10em", textTransform: "uppercase" }}>Bot Automation Studio</h1>
          <p style={{ marginTop: 8, color: "#ffabab" }}>Visual builder for bot automations. Security automation is separate.</p>
          <p style={{ marginTop: 4, color: "#ff9d9d" }}>
            Guild: {guildName || (guildId ? "Selected server" : "(not selected)")} | Active {activeCount}/{automations.length}
          </p>
        </div>
        <div style={{ display: "grid", gap: 6, textAlign: "right" }}>
          <Link href={`/dashboard/automations?guildId=${encodeURIComponent(guildId)}`} style={{ color: "#ffc6c6", fontSize: 12 }}>
            Back to Automations
          </Link>
          <Link href={`/dashboard/commands?guildId=${encodeURIComponent(guildId)}`} style={{ color: "#ffc6c6", fontSize: 12 }}>
            Open Command Studio
          </Link>
        </div>
      </div>

      {msg ? <div style={{ marginTop: 10, color: "#ffb3f0" }}>{msg}</div> : null}

      <div style={{ ...panelStyle, marginTop: 12 }}>
        <div style={{ display: "grid", gridTemplateColumns: "minmax(240px,420px) minmax(260px,1fr) auto", gap: 10, alignItems: "start" }}>
          <div>
            <div style={{ fontSize: 12, color: "#ffabab", marginBottom: 6 }}>Automation audit log channel</div>
            <select value={logChannelId} onChange={(e) => setLogChannelId(e.target.value)} style={inputStyle}>
              <option value="">Use moderator audit channel</option>
              {textChannels.map((channel) => (
                <option key={channel.id} value={channel.id}>#{channel.name}</option>
              ))}
            </select>
          </div>
          <div>
            <div style={{ fontSize: 12, color: "#ffabab", marginBottom: 6 }}>Exempt roles</div>
            <div
              style={{
                ...inputStyle,
                minHeight: 112,
                maxHeight: 180,
                overflowY: "auto",
                padding: 8,
                display: "grid",
                gap: 6,
              }}
            >
              {sortedRoles.map((role) => (
                <label
                  key={role.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    color: "#ffd6d6",
                    fontSize: 13,
                  }}
                >
                  <input
                    type="checkbox"
                    checked={exemptRoleIds.includes(role.id)}
                    onChange={() => setExemptRoleIds((prev) => toggleId(prev, role.id))}
                  />
                  <span>@{role.name}</span>
                </label>
              ))}
            </div>
            <div style={{ fontSize: 12, color: "#ffabab", marginTop: 6 }}>
              Members with these roles will be skipped by Automation Studio triggers.
            </div>
          </div>
          <button onClick={saveStudioSettings} style={btnStyle} disabled={saving || loading}>
            {saving ? "Saving..." : "Save Studio Log"}
          </button>
        </div>
      </div>

      <div style={{ ...panelStyle, marginTop: 10, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontWeight: 900 }}>Vacation mode: {vacationModeEnabled ? "ON" : "OFF"}</div>
          <div style={{ marginTop: 4, color: "#ffabab", fontSize: 12 }}>
            Turning it on or off fires a matching automation event. Build a start/end flow to post an away notice, DM staff, or run an available bot command.
          </div>
        </div>
        <button onClick={() => void toggleVacationMode()} style={btnStyle} disabled={vacationBusy || loading}>
          {vacationBusy ? "Updating…" : vacationModeEnabled ? "End Vacation Mode" : "Start Vacation Mode"}
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "320px minmax(0,1fr)", gap: 12, marginTop: 12 }}>
        <aside style={panelStyle}>
          <button onClick={createNewDraft} style={{ ...btnStyle, width: "100%", marginBottom: 10 }} disabled={saving}>
            + New Automation
          </button>

          <div style={{ fontSize: 12, color: "#ffabab", marginBottom: 8 }}>Starter templates</div>
          <div style={{ display: "grid", gap: 8 }}>
            <button style={miniCardStyle} onClick={() => applyStarterTemplate("from-scratch")} disabled={saving}>From Scratch</button>
            <button style={miniCardStyle} onClick={() => applyStarterTemplate("welcome")} disabled={saving}>Welcome</button>
            <button style={miniCardStyle} onClick={() => applyStarterTemplate("starboard")} disabled={saving}>Starboard</button>
            <button style={miniCardStyle} onClick={() => applyStarterTemplate("thread-joiner")} disabled={saving}>Thread Joiner</button>
            <button style={miniCardStyle} onClick={() => applyStarterTemplate("vacation-start")} disabled={saving}>Vacation Mode Start</button>
            <button style={miniCardStyle} onClick={() => applyStarterTemplate("vacation-end")} disabled={saving}>Vacation Mode End</button>
          </div>

          <div style={{ borderTop: "1px solid #2b0000", margin: "12px 0" }} />
          <div style={{ fontWeight: 900, marginBottom: 8 }}>Your Automations</div>
          {loading ? (
            <div style={{ color: "#ffaaaa" }}>Loading...</div>
          ) : automations.length === 0 ? (
            <div style={{ color: "#ffaaaa" }}>No automations yet.</div>
          ) : (
            <div style={{ display: "grid", gap: 8, maxHeight: 580, overflow: "auto", paddingRight: 4 }}>
              {automations.map((item) => {
                const selected = selectedId === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => openAutomation(item.id)}
                    style={{
                      ...miniCardStyle,
                      borderColor: selected ? "#ff4f4f" : "#5f0000",
                      background: selected ? "rgba(255,40,40,0.12)" : "#130000",
                    }}
                  >
                    <div style={{ fontWeight: 900, textAlign: "left", color: "#ffd4d4" }}>{item.name}</div>
                    <div style={{ textAlign: "left", marginTop: 4, fontSize: 11, color: "#ffa4a4" }}>
                      {item.status || "DRAFT"} | {item.enabled === false ? "OFF" : "ON"} | {item.triggerType || "-"}
                    </div>
                    <div style={{ textAlign: "left", marginTop: 4, fontSize: 11, color: "#ff8f8f" }}>
                      Updated {formatTime(item.updatedAt)}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </aside>

        <section style={panelStyle}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <div style={{ fontWeight: 900, fontSize: 20 }}>{selectedId === "new" ? "New Automation" : "Edit Automation"}</div>
            <div style={{ display: "flex", gap: 8 }}>
              <button style={btnStyle} onClick={deleteAutomation} disabled={saving || loading || selectedId === "new"}>
                Delete
              </button>
              <button style={btnStyle} onClick={discardDraft} disabled={saving || loading}>Discard</button>
              <button style={btnStyle} onClick={() => saveAutomation(false)} disabled={saving || loading}>
                {saving ? "Saving..." : "Save"}
              </button>
              <button style={btnPrimaryStyle} onClick={() => saveAutomation(true)} disabled={saving || loading}>
                {saving ? "Publishing..." : "Publish"}
              </button>
            </div>
          </div>
          <div style={{ ...sectionStyle, marginTop: 12 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 220px 200px 180px 160px", gap: 8 }}>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                style={inputStyle}
                placeholder="Automation name"
              />
              <label style={toggleLabel}>
                <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
                Enabled
              </label>
              <input
                type="number"
                min={1}
                value={runLimitPerMin}
                onChange={(e) => setRunLimitPerMin(Number(e.target.value || 0))}
                style={inputStyle}
                placeholder="Runs/min"
              />
              <input
                type="number"
                min={1}
                value={maxActions}
                onChange={(e) => setMaxActions(Number(e.target.value || 0))}
                style={inputStyle}
                placeholder="Max actions"
              />
              <input
                type="number"
                min={250}
                step={250}
                value={timeoutMs}
                onChange={(e) => setTimeoutMs(Number(e.target.value || 0))}
                style={inputStyle}
                placeholder="Timeout ms"
              />
            </div>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              style={{ ...inputStyle, marginTop: 8, minHeight: 56, resize: "vertical" }}
              placeholder="Description"
            />
          </div>

          <div style={sectionStyle}>
            <div style={sectionTitleStyle}>When</div>
            <select
              value={triggerType}
              onChange={(e) => {
                const nextTrigger = e.target.value as TriggerType;
                setTriggerType(nextTrigger);
                setTriggerConfig(defaultTriggerConfig(nextTrigger));
              }}
              style={{ ...inputStyle, marginTop: 10 }}
            >
              {TRIGGER_GROUPS.map((group) => (
                <optgroup key={group.label} label={group.label}>
                  {group.items.map((trigger) => <option key={trigger.value} value={trigger.value}>{trigger.label}</option>)}
                </optgroup>
              ))}
            </select>
            <div style={{ marginTop: 6, ...hintInline }}>{TRIGGERS.find((item) => item.value === triggerType)?.description || "Choose the event that starts this automation."}</div>
            {["MESSAGE_CREATE", "MESSAGE_UPDATE", "MESSAGE_DELETE"].includes(triggerType) ? (
              <div style={{ marginTop: 10, display: "grid", gridTemplateColumns: "minmax(200px,1fr) minmax(200px,1fr)", gap: 8 }}>
                <label style={{ ...hintInline, display: "grid", gap: 6 }}>
                  Only in these channels (optional)
                  <select
                    multiple
                    value={Array.isArray(triggerConfig.channels) ? triggerConfig.channels.map(String) : []}
                    onChange={(e) => {
                      const channels = [...e.currentTarget.selectedOptions].map((option) => option.value);
                      setTriggerConfig((prev) => ({ ...prev, channels }));
                    }}
                    style={{ ...inputStyle, minHeight: 110 }}
                  >
                    {textChannels.map((channel) => <option key={channel.id} value={channel.id}>#{channel.name}</option>)}
                  </select>
                </label>
                <label style={{ ...hintInline, display: "grid", gap: 6 }}>
                  Message must contain any keyword (optional)
                  <input
                    value={Array.isArray(triggerConfig.keywords) ? triggerConfig.keywords.join(", ") : ""}
                    onChange={(e) => setTriggerConfig((prev) => ({ ...prev, keywords: e.target.value.split(/[\r\n,]+/).map((value) => value.trim()).filter(Boolean) }))}
                    style={inputStyle}
                    placeholder="support, help, question"
                  />
                </label>
              </div>
            ) : null}
            {triggerType === "BUTTON_CLICK" ? (
              <label style={{ ...hintInline, display: "grid", gap: 6, marginTop: 10 }}>
                Button custom IDs (optional, comma separated)
                <input
                  value={Array.isArray(triggerConfig.customIds) ? triggerConfig.customIds.join(", ") : ""}
                  onChange={(e) => setTriggerConfig((prev) => ({ ...prev, customIds: e.target.value.split(/[\r\n,]+/).map((value) => value.trim()).filter(Boolean) }))}
                  style={inputStyle}
                  placeholder="Only run for these button IDs"
                />
              </label>
            ) : null}
            {["MEMBER_ROLE_ADD", "MEMBER_ROLE_REMOVE"].includes(triggerType) ? (
              <label style={{ ...hintInline, display: "grid", gap: 6, marginTop: 10 }}>
                Only when these roles change (optional)
                <select
                  multiple
                  value={Array.isArray(triggerConfig.roleIds) ? triggerConfig.roleIds.map(String) : []}
                  onChange={(e) => {
                    const roleIds = [...e.currentTarget.selectedOptions].map((option) => option.value);
                    setTriggerConfig((prev) => ({ ...prev, roleIds }));
                  }}
                  style={{ ...inputStyle, minHeight: 110 }}
                >
                  {sortedRoles.map((role) => <option key={role.id} value={role.id}>@{role.name}</option>)}
                </select>
              </label>
            ) : null}
            {["REACTION_ADD", "REACTION_REMOVE"].includes(triggerType) ? (
              <div style={{ marginTop: 10 }}>
                <label style={{ ...hintInline, display: "grid", gap: 6 }}>
                  Reaction filter (optional, comma separated)
                  <input
                    value={Array.isArray(triggerConfig.emojis) ? triggerConfig.emojis.join(", ") : ""}
                    onChange={(e) => setTriggerConfig((prev) => ({ ...prev, emojis: e.target.value.split(/[,\r\n]+/).map((value) => value.trim()).filter(Boolean) }))}
                    style={inputStyle}
                    placeholder="Example: :star:, :fire:, <:custom:1234567890>"
                  />
                </label>
                <div style={{ marginTop: 8 }}>
                  {renderEmojiPicker("trigger_emojis", (emojiToken) => appendEmojiToTriggerConfig("emojis", emojiToken))}
                </div>
              </div>
            ) : null}
            {triggerType === "SCHEDULED" ? (
              <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
                <div style={{ display: "grid", gridTemplateColumns: "180px 220px", gap: 8 }}>
                  <input
                    type="number"
                    min={1}
                    value={asNumber(triggerConfig, "intervalValue", 1)}
                    onChange={(e) => setTriggerConfig((prev) => ({ ...prev, intervalValue: Number(e.target.value || 1) }))}
                    style={inputStyle}
                    placeholder="Every"
                  />
                  <select
                    value={asString(triggerConfig, "intervalUnit", "hours")}
                    onChange={(e) => setTriggerConfig((prev) => ({ ...prev, intervalUnit: e.target.value }))}
                    style={inputStyle}
                  >
                    <option value="seconds">Seconds</option>
                    <option value="minutes">Minutes</option>
                    <option value="hours">Hours</option>
                    <option value="days">Days</option>
                    <option value="weeks">Weeks</option>
                  </select>
                </div>
                <select
                  value={asString(triggerConfig, "channelId", "")}
                  onChange={(e) => setTriggerConfig((prev) => ({ ...prev, channelId: e.target.value }))}
                  style={inputStyle}
                >
                  <option value="">No default channel</option>
                  {textChannels.map((c) => (
                    <option key={c.id} value={c.id}>#{c.name}</option>
                  ))}
                </select>
                <div style={hintInline}>Runs on the automation interval. Native command actions use the automation owner and this channel unless the action overrides it.</div>
              </div>
            ) : null}
          </div>

          <div style={sectionStyle}>
            <div style={sectionTitleStyle}>If</div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginTop: 10 }}>
              <label style={hintInline}>
                Join logic:
                <select
                  value={conditionJoinOp}
                  onChange={(e) => setConditionJoinOp(e.target.value === "OR" ? "OR" : "AND")}
                  style={{ ...inputStyle, width: 180, marginLeft: 8 }}
                >
                  <option value="AND">AND (all must pass)</option>
                  <option value="OR">OR (any may pass)</option>
                </select>
              </label>
              <button
                style={btnStyle}
                onClick={() => setConditions((prev) => [...prev, defaultCondition("MESSAGE_CONTAINS")])}
                disabled={saving}
              >
                + Add Condition
              </button>
            </div>

            {conditions.length === 0 ? (
              <div style={{ marginTop: 10, color: "#ffadad", fontSize: 13 }}>No conditions. Automation runs on every trigger event.</div>
            ) : (
              <div style={{ marginTop: 10, display: "grid", gap: 10 }}>
                {conditions.map((cond, idx) => (
                  <div key={cond.id} style={blockCardStyle}>
                    <div style={{ display: "flex", gap: 8, alignItems: "center", justifyContent: "space-between", flexWrap: "wrap" }}>
                      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                        <span style={chipStyle}>Condition {idx + 1}</span>
                        <select
                          value={cond.type}
                          onChange={(e) => updateCondition(cond.id, defaultCondition(e.target.value as ConditionType))}
                          style={inputStyle}
                        >
                          {CONDITION_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                          ))}
                        </select>
                        <label style={hintInline}>
                          <input
                            type="checkbox"
                            checked={cond.negate}
                            onChange={(e) => updateCondition(cond.id, { negate: e.target.checked })}
                          />
                          Negate
                        </label>
                      </div>
                      <div style={{ display: "flex", gap: 6 }}>
                        <button style={miniBtnStyle} onClick={() => moveCondition(cond.id, -1)}>Up</button>
                        <button style={miniBtnStyle} onClick={() => moveCondition(cond.id, 1)}>Down</button>
                        <button style={miniBtnStyle} onClick={() => setConditions((prev) => prev.filter((x) => x.id !== cond.id))}>Remove</button>
                      </div>
                    </div>

                    {cond.type === "MESSAGE_CONTAINS" || cond.type === "MESSAGE_STARTS_WITH" || cond.type === "MESSAGE_EQUALS" ? (
                      <input
                        value={asString(cond.config, "value", "")}
                        onChange={(e) => updateConditionConfig(cond.id, { value: e.target.value })}
                        style={{ ...inputStyle, marginTop: 8 }}
                        placeholder="Type value"
                      />
                    ) : null}

                    {cond.type === "CHANNEL_IS" ? (
                      <select
                        value={asString(cond.config, "channelId", "")}
                        onChange={(e) => updateConditionConfig(cond.id, { channelId: e.target.value })}
                        style={{ ...inputStyle, marginTop: 8 }}
                      >
                        <option value="">Select channel</option>
                        {channels.map((c) => (
                          <option key={c.id} value={c.id}>#{c.name}</option>
                        ))}
                      </select>
                    ) : null}

                    {cond.type === "CATEGORY_IS" ? (
                      <select
                        value={asString(cond.config, "categoryId", "")}
                        onChange={(e) => updateConditionConfig(cond.id, { categoryId: e.target.value })}
                        style={{ ...inputStyle, marginTop: 8 }}
                      >
                        <option value="">Select category</option>
                        {categoryChannels.map((c) => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </select>
                    ) : null}

                    {cond.type === "HAS_ROLE" || cond.type === "LACKS_ROLE" ? (
                      <select
                        value={asString(cond.config, "roleId", "")}
                        onChange={(e) => updateConditionConfig(cond.id, { roleId: e.target.value })}
                        style={{ ...inputStyle, marginTop: 8 }}
                      >
                        <option value="">Select role</option>
                        {roles.map((r) => (
                          <option key={r.id} value={r.id}>@{r.name}</option>
                        ))}
                      </select>
                    ) : null}

                    {cond.type === "RANDOM_CHANCE" ? (
                      <input
                        type="number"
                        min={1}
                        max={100}
                        value={asNumber(cond.config, "pct", 100)}
                        onChange={(e) => updateConditionConfig(cond.id, { pct: Number(e.target.value || 0) })}
                        style={{ ...inputStyle, marginTop: 8 }}
                        placeholder="Chance percent (1-100)"
                      />
                    ) : null}

                    {cond.type === "VOICE_SESSION_SHORTER_THAN" ? (
                      <input
                        type="number"
                        min={1}
                        value={asNumber(cond.config, "seconds", 30)}
                        onChange={(e) => updateConditionConfig(cond.id, { seconds: Number(e.target.value || 0) })}
                        style={{ ...inputStyle, marginTop: 8 }}
                        placeholder="Seconds in voice before leaving"
                      />
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div style={sectionStyle}>
            <div style={sectionTitleStyle}>Do This</div>
            <div style={{ ...hintInline, marginTop: 6 }}>
              Chain multiple replies, messages, role changes, and available bot commands. Message templates support {"{user}"}, {"{username}"}, {"{server}"}, {"{channel}"}, and {"{triggerContent}"}.
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 10 }}>
              <button
                style={btnStyle}
                onClick={() => setActions((prev) => [...prev, defaultAction("SEND_MESSAGE")])}
                disabled={saving}
              >
                + Add Action
              </button>
            </div>
            <div style={{ marginTop: 10, display: "grid", gap: 10 }}>
              {actions.map((action, idx) => (
                <div key={action.id} style={blockCardStyle}>
                  <div style={{ display: "flex", gap: 8, alignItems: "center", justifyContent: "space-between", flexWrap: "wrap" }}>
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <span style={chipStyle}>Action {idx + 1}</span>
                      <select
                        value={action.type}
                        onChange={(e) => updateAction(action.id, defaultAction(e.target.value as ActionType))}
                        style={inputStyle}
                      >
                        {ACTION_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                    </div>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button style={miniBtnStyle} onClick={() => moveAction(action.id, -1)}>Up</button>
                      <button style={miniBtnStyle} onClick={() => moveAction(action.id, 1)}>Down</button>
                      <button style={miniBtnStyle} onClick={() => setActions((prev) => prev.filter((x) => x.id !== action.id))}>Remove</button>
                    </div>
                  </div>

                  {action.type === "SEND_MESSAGE" ? (
                    <div style={{ marginTop: 8, display: "grid", gap: 8 }}>
                      <select
                        value={asString(action.config, "channelId", "")}
                        onChange={(e) => updateActionConfig(action.id, { channelId: e.target.value })}
                        style={inputStyle}
                      >
                        <option value="">Select channel</option>
                        {channels.map((c) => (
                          <option key={c.id} value={c.id}>#{c.name}</option>
                        ))}
                      </select>
                      <GuildEmojiField emojis={emojis} error={emojiError} onInsert={(value) => updateActionConfig(action.id, { content: value })}><textarea
                        value={asString(action.config, "content", "")}
                        onChange={(e) => updateActionConfig(action.id, { content: e.target.value })}
                        style={{ ...inputStyle, minHeight: 72, resize: "vertical" }}
                        placeholder="Message content"
                      /></GuildEmojiField>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 8 }}>
                        <select
                          value={mentionRoleByAction[action.id] || ""}
                          onChange={(e) => setMentionRoleByAction((prev) => ({ ...prev, [action.id]: e.target.value }))}
                          style={inputStyle}
                        >
                          <option value="">Select role to tag</option>
                          {roles.map((r) => (
                            <option key={r.id} value={r.id}>@{r.name}</option>
                          ))}
                        </select>
                        <button
                          style={btnStyle}
                          onClick={() => appendRoleMentionToAction(action.id, mentionRoleByAction[action.id] || "")}
                        >
                          Tag Role
                        </button>
                      </div>
                      {renderChannelMentionPicker(action.id)}
                      <input
                        value={asString(action.config, "reactions", "")}
                        onChange={(e) => updateActionConfig(action.id, { reactions: e.target.value })}
                        style={inputStyle}
                        placeholder="Reactions to add after sending (comma separated)"
                      />
                      {renderEmojiPicker(`${action.id}_reactions`, (emojiToken) =>
                        appendEmojiToActionConfig(action.id, "reactions", emojiToken)
                      )}
                    </div>
                  ) : null}

                  {action.type === "SEND_EMBED" ? (
                    <div style={{ marginTop: 8, display: "grid", gap: 8 }}>
                      <select
                        value={asString(action.config, "channelId", "")}
                        onChange={(e) => updateActionConfig(action.id, { channelId: e.target.value })}
                        style={inputStyle}
                      >
                        <option value="">Reply/current channel</option>
                        {channels.map((c) => (
                          <option key={c.id} value={c.id}>#{c.name}</option>
                        ))}
                      </select>
                      <GuildEmojiField emojis={emojis} error={emojiError} onInsert={(value) => updateActionConfig(action.id, { title: value })}><input
                        value={asString(action.config, "title", "")}
                        onChange={(e) => updateActionConfig(action.id, { title: e.target.value })}
                        style={inputStyle}
                        placeholder="Embed title"
                      /></GuildEmojiField>
                      <GuildEmojiField emojis={emojis} error={emojiError} onInsert={(value) => updateActionConfig(action.id, { content: value })}><textarea
                        value={asString(action.config, "content", "")}
                        onChange={(e) => updateActionConfig(action.id, { content: e.target.value })}
                        style={{ ...inputStyle, minHeight: 64, resize: "vertical" }}
                        placeholder="Optional message above the embed"
                      /></GuildEmojiField>
                      <GuildEmojiField emojis={emojis} error={emojiError} onInsert={(value) => updateActionConfig(action.id, { description: value })}><textarea
                        value={asString(action.config, "description", "")}
                        onChange={(e) => updateActionConfig(action.id, { description: e.target.value })}
                        style={{ ...inputStyle, minHeight: 88, resize: "vertical" }}
                        placeholder="Embed description"
                      /></GuildEmojiField>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                        <input
                          value={asString(action.config, "color", "#ff5a5a")}
                          onChange={(e) => updateActionConfig(action.id, { color: e.target.value })}
                          style={inputStyle}
                          placeholder="Color (#ff5a5a)"
                        />
                        <GuildEmojiField emojis={emojis} error={emojiError} onInsert={(value) => updateActionConfig(action.id, { footerText: value })}><input
                          value={asString(action.config, "footerText", "")}
                          onChange={(e) => updateActionConfig(action.id, { footerText: e.target.value })}
                          style={inputStyle}
                          placeholder="Footer text"
                        /></GuildEmojiField>
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                        <input
                          value={asString(action.config, "imageUrl", "")}
                          onChange={(e) => updateActionConfig(action.id, { imageUrl: e.target.value })}
                          style={inputStyle}
                          placeholder="Hero image URL"
                        />
                        <input
                          value={asString(action.config, "thumbnailUrl", "")}
                          onChange={(e) => updateActionConfig(action.id, { thumbnailUrl: e.target.value })}
                          style={inputStyle}
                          placeholder="Thumbnail URL"
                        />
                      </div>
                      <label style={toggleLabel}>
                        <input
                          type="checkbox"
                          checked={asBoolean(action.config, "ephemeral", false)}
                          onChange={(e) => updateActionConfig(action.id, { ephemeral: e.target.checked })}
                        />
                        Ephemeral when replying from slash context
                      </label>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 8 }}>
                        <select
                          value={mentionRoleByAction[action.id] || ""}
                          onChange={(e) => setMentionRoleByAction((prev) => ({ ...prev, [action.id]: e.target.value }))}
                          style={inputStyle}
                        >
                          <option value="">Select role to tag</option>
                          {roles.map((r) => (
                            <option key={r.id} value={r.id}>@{r.name}</option>
                          ))}
                        </select>
                        <button
                          style={btnStyle}
                          onClick={() => appendRoleMentionToAction(action.id, mentionRoleByAction[action.id] || "")}
                        >
                          Tag Role
                        </button>
                      </div>
                      {renderChannelMentionPicker(action.id)}
                      <input
                        value={asString(action.config, "reactions", "")}
                        onChange={(e) => updateActionConfig(action.id, { reactions: e.target.value })}
                        style={inputStyle}
                        placeholder="Reactions to add after sending (comma separated)"
                      />
                      {renderEmojiPicker(`${action.id}_reactions`, (emojiToken) =>
                        appendEmojiToActionConfig(action.id, "reactions", emojiToken)
                      )}
                    </div>
                  ) : null}

                  {action.type === "REPLY" ? (
                    <div style={{ marginTop: 8, display: "grid", gap: 8 }}>
                      <GuildEmojiField emojis={emojis} error={emojiError} onInsert={(value) => updateActionConfig(action.id, { content: value })}><textarea
                        value={asString(action.config, "content", "")}
                        onChange={(e) => updateActionConfig(action.id, { content: e.target.value })}
                        style={{ ...inputStyle, minHeight: 72, resize: "vertical" }}
                        placeholder="Reply content"
                      /></GuildEmojiField>
                      <label style={toggleLabel}>
                        <input
                          type="checkbox"
                          checked={asBoolean(action.config, "ephemeral", false)}
                          onChange={(e) => updateActionConfig(action.id, { ephemeral: e.target.checked })}
                        />
                        Ephemeral
                      </label>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 8 }}>
                        <select
                          value={mentionRoleByAction[action.id] || ""}
                          onChange={(e) => setMentionRoleByAction((prev) => ({ ...prev, [action.id]: e.target.value }))}
                          style={inputStyle}
                        >
                          <option value="">Select role to tag</option>
                          {roles.map((r) => (
                            <option key={r.id} value={r.id}>@{r.name}</option>
                          ))}
                        </select>
                        <button
                          style={btnStyle}
                          onClick={() => appendRoleMentionToAction(action.id, mentionRoleByAction[action.id] || "")}
                        >
                          Tag Role
                        </button>
                      </div>
                      {renderChannelMentionPicker(action.id)}
                      <input
                        value={asString(action.config, "reactions", "")}
                        onChange={(e) => updateActionConfig(action.id, { reactions: e.target.value })}
                        style={inputStyle}
                        placeholder="Reactions to add after replying (comma separated)"
                      />
                      {renderEmojiPicker(`${action.id}_reactions`, (emojiToken) =>
                        appendEmojiToActionConfig(action.id, "reactions", emojiToken)
                      )}
                    </div>
                  ) : null}

                  {action.type === "REACT" ? (
                    <div style={{ marginTop: 8, display: "grid", gap: 8 }}>
                      <input
                        value={asString(action.config, "emoji", "")}
                        onChange={(e) => updateActionConfig(action.id, { emoji: e.target.value })}
                        style={inputStyle}
                        placeholder="Emoji (example: :fire:)"
                      />
                      {renderEmojiPicker(`${action.id}_emoji`, (emojiToken) =>
                        appendEmojiToActionConfig(action.id, "emoji", emojiToken)
                      )}
                    </div>
                  ) : null}

                  {action.type === "ADD_ROLE" || action.type === "REMOVE_ROLE" || action.type === "MUTE_MEMBER" ? (
                    <select
                      value={asString(action.config, "roleId", "")}
                      onChange={(e) => updateActionConfig(action.id, { roleId: e.target.value })}
                      style={{ ...inputStyle, marginTop: 8 }}
                    >
                      <option value="">Select role</option>
                      {roles.map((r) => (
                        <option key={r.id} value={r.id}>@{r.name}</option>
                      ))}
                    </select>
                  ) : null}

                  {action.type === "MUTE_MEMBER" ? (
                    <input
                      value={asString(action.config, "reason", "")}
                      onChange={(e) => updateActionConfig(action.id, { reason: e.target.value })}
                      style={{ ...inputStyle, marginTop: 8 }}
                      placeholder="Mute reason (optional)"
                    />
                  ) : null}

                  {action.type === "TIMEOUT_MEMBER" ? (
                    <div style={{ marginTop: 8, display: "grid", gap: 8 }}>
                      <input
                        type="number"
                        min={1}
                        value={asNumber(action.config, "minutes", 10)}
                        onChange={(e) => updateActionConfig(action.id, { minutes: Number(e.target.value || 0) })}
                        style={inputStyle}
                        placeholder="Timeout minutes"
                      />
                      <input
                        value={asString(action.config, "reason", "")}
                        onChange={(e) => updateActionConfig(action.id, { reason: e.target.value })}
                        style={inputStyle}
                        placeholder="Reason (optional)"
                      />
                    </div>
                  ) : null}

                  {action.type === "KICK_MEMBER" ? (
                    <input
                      value={asString(action.config, "reason", "")}
                      onChange={(e) => updateActionConfig(action.id, { reason: e.target.value })}
                      style={{ ...inputStyle, marginTop: 8 }}
                      placeholder="Kick reason (optional)"
                    />
                  ) : null}

                  {action.type === "BAN_MEMBER" ? (
                    <div style={{ marginTop: 8, display: "grid", gap: 8 }}>
                      <input
                        value={asString(action.config, "reason", "")}
                        onChange={(e) => updateActionConfig(action.id, { reason: e.target.value })}
                        style={inputStyle}
                        placeholder="Ban reason (optional)"
                      />
                      <input
                        type="number"
                        min={0}
                        max={604800}
                        value={asNumber(action.config, "deleteMessageSeconds", 0)}
                        onChange={(e) => updateActionConfig(action.id, { deleteMessageSeconds: Number(e.target.value || 0) })}
                        style={inputStyle}
                        placeholder="Delete recent messages (seconds)"
                      />
                    </div>
                  ) : null}

                  {action.type === "DM" ? (
                    <div style={{ marginTop: 8, display: "grid", gap: 8 }}>
                      <GuildEmojiField emojis={emojis} error={emojiError} onInsert={(value) => updateActionConfig(action.id, { content: value })}><textarea
                        value={asString(action.config, "content", "")}
                        onChange={(e) => updateActionConfig(action.id, { content: e.target.value })}
                        style={{ ...inputStyle, minHeight: 72, resize: "vertical" }}
                        placeholder="DM content"
                      /></GuildEmojiField>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 8 }}>
                        <select
                          value={mentionRoleByAction[action.id] || ""}
                          onChange={(e) => setMentionRoleByAction((prev) => ({ ...prev, [action.id]: e.target.value }))}
                          style={inputStyle}
                        >
                          <option value="">Select role to tag</option>
                          {roles.map((r) => (
                            <option key={r.id} value={r.id}>@{r.name}</option>
                          ))}
                        </select>
                        <button
                          style={btnStyle}
                          onClick={() => appendRoleMentionToAction(action.id, mentionRoleByAction[action.id] || "")}
                        >
                          Tag Role
                        </button>
                      </div>
                      {renderChannelMentionPicker(action.id)}
                      <input
                        value={asString(action.config, "reactions", "")}
                        onChange={(e) => updateActionConfig(action.id, { reactions: e.target.value })}
                        style={inputStyle}
                        placeholder="Reactions to add after DM send (comma separated)"
                      />
                      {renderEmojiPicker(`${action.id}_reactions`, (emojiToken) =>
                        appendEmojiToActionConfig(action.id, "reactions", emojiToken)
                      )}
                    </div>
                  ) : null}

                  {action.type === "DELETE_TRIGGER_MESSAGE" ? (
                    <div style={{ ...miniCardStyle, marginTop: 8, color: "#ffb4b4" }}>
                      Deletes the original trigger message when the automation fires, when the event supports message deletion.
                    </div>
                  ) : null}

                  {action.type === "DELAY" ? (
                    <input
                      type="number"
                      min={1}
                      value={asNumber(action.config, "ms", 1000)}
                      onChange={(e) => updateActionConfig(action.id, { ms: Number(e.target.value || 0) })}
                      style={{ ...inputStyle, marginTop: 8 }}
                      placeholder="Delay in milliseconds"
                    />
                  ) : null}

                  {action.type === "CREATE_THREAD" ? (
                    <div style={{ marginTop: 8, display: "grid", gridTemplateColumns: "1fr 220px", gap: 8 }}>
                      <input
                        value={asString(action.config, "name", "Thread")}
                        onChange={(e) => updateActionConfig(action.id, { name: e.target.value })}
                        style={inputStyle}
                        placeholder="Thread name"
                      />
                      <select
                        value={String(asNumber(action.config, "autoArchiveDuration", 60))}
                        onChange={(e) => updateActionConfig(action.id, { autoArchiveDuration: Number(e.target.value || 60) })}
                        style={inputStyle}
                      >
                        <option value="60">Archive 1 hour</option>
                        <option value="1440">Archive 24 hours</option>
                        <option value="4320">Archive 3 days</option>
                        <option value="10080">Archive 7 days</option>
                      </select>
                    </div>
                  ) : null}

                  {action.type === "RUN_NATIVE_COMMAND" ? (
                    <div style={{ marginTop: 8, display: "grid", gap: 8 }}>
                      <div style={hintInline}>Runs an available bot command through its built-in handler. It does not fake a member typing or send a slash command as a user.</div>
                      <input
                        list="automation-native-command-keys"
                        value={asString(action.config, "commandKey", "")}
                        onChange={(e) => updateActionConfig(action.id, { commandKey: e.target.value })}
                        style={inputStyle}
                        placeholder="Command key (example: heist.start)"
                      />
                      <select
                        value={asString(action.config, "channelId", "")}
                        onChange={(e) => updateActionConfig(action.id, { channelId: e.target.value })}
                        style={inputStyle}
                      >
                        <option value="">Use automation/default channel</option>
                        {textChannels.map((c) => (
                          <option key={c.id} value={c.id}>#{c.name}</option>
                        ))}
                      </select>
                      <textarea
                        value={asString(action.config, "optionsJson", "{\n}")}
                        onChange={(e) => updateActionConfig(action.id, { optionsJson: e.target.value })}
                        style={{ ...inputStyle, minHeight: 120, resize: "vertical", fontFamily: "ui-monospace, SFMono-Regular, Consolas, monospace" }}
                        placeholder={'{\n  "edition": "LE"\n}'}
                      />
                      <label style={toggleLabel}>
                        <input
                          type="checkbox"
                          checked={asBoolean(action.config, "silent", true)}
                          onChange={(e) => updateActionConfig(action.id, { silent: e.target.checked })}
                        />
                        Keep command replies silent
                      </label>
                      {(() => {
                        const selected = nativeCommandEntries.find((entry) => entry.key === asString(action.config, "commandKey", ""));
                        if (!selected) return <div style={hintInline}>Use the bot&apos;s command key and a JSON object for its options.</div>;
                        return (
                          <div style={hintInline}>
                            {selected.title}
                            {selected.optionSummary?.length ? ` | Options: ${selected.optionSummary.join(", ")}` : " | No options"}
                          </div>
                        );
                      })()}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
      <datalist id="automation-native-command-keys">
        {nativeCommandEntries.map((entry) => (
          <option key={entry.key} value={entry.key}>{entry.title}</option>
        ))}
      </datalist>
    </div>
  );
}

const panelStyle: CSSProperties = {
  border: "1px solid #5f0000",
  borderRadius: 12,
  padding: 12,
  background: "rgba(90,0,0,0.11)",
};

const sectionStyle: CSSProperties = {
  border: "1px solid #360000",
  borderRadius: 10,
  padding: 10,
  marginTop: 12,
  background: "#110000",
};

const sectionTitleStyle: CSSProperties = {
  fontWeight: 900,
  color: "#ff8f8f",
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  fontSize: 12,
};

const blockCardStyle: CSSProperties = {
  border: "1px solid #4f0000",
  borderRadius: 10,
  padding: 10,
  background: "rgba(255,0,0,0.05)",
};

const chipStyle: CSSProperties = {
  border: "1px solid #5f0000",
  borderRadius: 999,
  padding: "3px 8px",
  fontSize: 11,
  color: "#ffb0b0",
  fontWeight: 800,
};

const inputStyle: CSSProperties = {
  width: "100%",
  border: "1px solid #6a0000",
  borderRadius: 8,
  padding: "8px 10px",
  background: "#1a0000",
  color: "#ffd8d8",
};

const btnStyle: CSSProperties = {
  border: "1px solid #6a0000",
  borderRadius: 8,
  background: "#1a0000",
  color: "#ffd0d0",
  padding: "8px 10px",
  cursor: "pointer",
  fontWeight: 800,
};

const btnPrimaryStyle: CSSProperties = {
  ...btnStyle,
  background: "#ff2e2e",
  borderColor: "#ff4f4f",
  color: "#1a0000",
};

const miniBtnStyle: CSSProperties = {
  ...btnStyle,
  padding: "4px 8px",
  fontSize: 12,
};

const miniCardStyle: CSSProperties = {
  border: "1px solid #5f0000",
  borderRadius: 10,
  padding: 10,
  background: "#130000",
  color: "#ffd0d0",
  textAlign: "left",
  cursor: "pointer",
};

const toggleLabel: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  color: "#ffb6b6",
  fontSize: 13,
};

const hintInline: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  color: "#ffb6b6",
  fontSize: 12,
};
