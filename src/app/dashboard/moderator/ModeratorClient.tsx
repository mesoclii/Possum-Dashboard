"use client";

import Link from "next/link";
import { CSSProperties, useEffect, useMemo, useState } from "react";
import { buildDashboardHref, readDashboardGuildId } from "@/lib/dashboardContext";

type Role = { id: string; name: string; position?: number };
type Channel = { id: string; name: string; type?: number | string };

const AUTOMOD_NOTICE_RULES = [
  ["badWords", "Blocked words"],
  ["repeatedText", "Repeated text"],
  ["spam", "Spam burst"],
  ["caps", "Caps spam"],
  ["links", "External links"],
  ["invite", "Discord invites"],
  ["gif", "GIF media"],
  ["image", "Image media"],
  ["mention", "Mention burst"],
  ["zalgo", "Zalgo"],
] as const;

type AutomodRuleKey = typeof AUTOMOD_NOTICE_RULES[number][0];
type AutomodRuleScopedExemptions =
  Record<`${AutomodRuleKey}ExemptChannelIds`, string[]> &
  Record<`${AutomodRuleKey}ExemptCategoryIds`, string[]> &
  Record<`${AutomodRuleKey}ExemptRoleIds`, string[]>;

const AUTOMOD_RULE_KEYS = AUTOMOD_NOTICE_RULES.map(([key]) => key) as AutomodRuleKey[];
const EMPTY_AUTOMOD_RULE_EXEMPTIONS = Object.fromEntries(
  AUTOMOD_RULE_KEYS.flatMap((ruleKey) => [
    [`${ruleKey}ExemptChannelIds`, []],
    [`${ruleKey}ExemptCategoryIds`, []],
    [`${ruleKey}ExemptRoleIds`, []],
  ])
) as unknown as AutomodRuleScopedExemptions;

type ModeratorConfig = {
  active: boolean;
  adminRoleIds: string[];
  immunityRoleIds: string[];
  logging: {
    logChannelId: string;
    memberMuted: boolean;
    memberUnmuted: boolean;
    moderationBan: boolean;
    moderationWarn: boolean;
    messageUpdated: boolean;
    messageDeleted: boolean;
    invitePosted: boolean;
    memberRoleChanged: boolean;
    memberJoined: boolean;
    memberLeft: boolean;
    userUpdated: boolean;
    roleCreated: boolean;
    roleUpdated: boolean;
    roleDeleted: boolean;
    channelCreated: boolean;
    channelUpdated: boolean;
    channelDeleted: boolean;
    voiceJoined: boolean;
    voiceMoved: boolean;
    voiceLeft: boolean;
    serverUpdated: boolean;
    ignoreChannelIds: string[];
    dontLogBotActions: boolean;
    dontDisplayThumbnails: boolean;
  };
  automod: {
    enabled: boolean;
    logChannelId: string;
    badWordsAction: string;
    repeatedTextAction: string;
    spamAction: string;
    capsAction: string;
    linksAction: string;
    inviteAction: string;
    gifAction: string;
    imageAction: string;
    mentionAction: string;
    zalgoAction: string;
    spamThreshold: number;
    spamWindowSeconds: number;
    repeatedTextThreshold: number;
    repeatedTextWindowSeconds: number;
    capsThreshold: number;
    mentionThreshold: number;
    blockedWords: string[];
    restrictedChannelIds: string[];
    exemptChannelIds: string[];
    exemptCategoryIds: string[];
    exemptRoleIds: string[];
    allowInviteLinks: boolean;
    allowGifLinks: boolean;
    allowImageLinks: boolean;
    allowedLinkDomains: string[];
    allowedLinkChannelIds: string[];
    allowedLinkCategoryIds: string[];
    badWordsNoticeMode: string;
    badWordsNoticeMessage: string;
    repeatedTextNoticeMode: string;
    repeatedTextNoticeMessage: string;
    spamNoticeMode: string;
    spamNoticeMessage: string;
    capsNoticeMode: string;
    capsNoticeMessage: string;
    linksNoticeMode: string;
    linksNoticeMessage: string;
    inviteNoticeMode: string;
    inviteNoticeMessage: string;
    gifNoticeMode: string;
    gifNoticeMessage: string;
    imageNoticeMode: string;
    imageNoticeMessage: string;
    mentionNoticeMode: string;
    mentionNoticeMessage: string;
    zalgoNoticeMode: string;
    zalgoNoticeMessage: string;
    autoModerateIgnoresBots: boolean;
    sendWarningMessage: boolean;
    replyToDeletion: boolean;
    warningMessage: string;
    timeoutDurationMinutes: number;
    muteDurationMinutes: number;
    kickDeleteRecentMessages: boolean;
    kickDeleteRecentMessageDays: number;
    banDeleteRecentMessages: boolean;
    banDeleteRecentMessageDays: number;
  } & AutomodRuleScopedExemptions;
  notes: string;
};

type NativeRule = {
  enabled: boolean;
  requiredLevel: string;
};

type NativeEntry = {
  key: string;
  kind: string;
  title: string;
  description: string;
  commandName: string;
  defaultRequiredLevelName: string;
};

type NativeConfig = {
  active: boolean;
  slashEnabled: boolean;
  notes: string;
  rules: Record<string, any>;
};

type TabKey = "automod" | "admin" | "audit" | "commands";

const ACTIONS = [
  "Disabled",
  "Delete Message",
  "Warn Member",
  "Delete Message + Warn Member",
  "Timeout Member",
  "Delete Message + Timeout Member",
  "Mute Member",
  "Delete Message + Mute Member",
  "Kick Member",
  "Delete Message + Kick Member",
  "Ban Member",
  "Delete Message + Ban Member",
];

const NOTICE_MODES = ["Disabled", "DM", "Reply In Channel", "Both"];

const LEVELS = [
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

const DEFAULT_CONFIG: ModeratorConfig = {
  active: true,
  adminRoleIds: [],
  immunityRoleIds: [],
  logging: {
    logChannelId: "",
    memberMuted: true,
    memberUnmuted: true,
    moderationBan: true,
    moderationWarn: true,
    messageUpdated: true,
    messageDeleted: true,
    invitePosted: true,
    memberRoleChanged: true,
    memberJoined: true,
    memberLeft: true,
    userUpdated: true,
    roleCreated: false,
    roleUpdated: false,
    roleDeleted: false,
    channelCreated: true,
    channelUpdated: true,
    channelDeleted: true,
    voiceJoined: false,
    voiceMoved: false,
    voiceLeft: false,
    serverUpdated: true,
    ignoreChannelIds: [],
    dontLogBotActions: true,
    dontDisplayThumbnails: false,
  },
  automod: {
    enabled: false,
    logChannelId: "",
    badWordsAction: "Delete Message + Warn Member",
    repeatedTextAction: "Delete Message",
    spamAction: "Delete Message",
    capsAction: "Delete Message",
    linksAction: "Disabled",
    inviteAction: "Delete Message",
    gifAction: "Disabled",
    imageAction: "Disabled",
    mentionAction: "Delete Message",
    zalgoAction: "Disabled",
    spamThreshold: 5,
    spamWindowSeconds: 60,
    repeatedTextThreshold: 5,
    repeatedTextWindowSeconds: 120,
    capsThreshold: 70,
    mentionThreshold: 5,
    blockedWords: [],
    restrictedChannelIds: [],
    exemptChannelIds: [],
    exemptCategoryIds: [],
    exemptRoleIds: [],
    allowInviteLinks: false,
    allowGifLinks: false,
    allowImageLinks: false,
    allowedLinkDomains: [],
    allowedLinkChannelIds: [],
    allowedLinkCategoryIds: [],
    ...EMPTY_AUTOMOD_RULE_EXEMPTIONS,
    badWordsNoticeMode: "",
    badWordsNoticeMessage: "",
    repeatedTextNoticeMode: "",
    repeatedTextNoticeMessage: "",
    spamNoticeMode: "",
    spamNoticeMessage: "",
    capsNoticeMode: "",
    capsNoticeMessage: "",
    linksNoticeMode: "",
    linksNoticeMessage: "",
    inviteNoticeMode: "",
    inviteNoticeMessage: "",
    gifNoticeMode: "",
    gifNoticeMessage: "",
    imageNoticeMode: "",
    imageNoticeMessage: "",
    mentionNoticeMode: "",
    mentionNoticeMessage: "",
    zalgoNoticeMode: "",
    zalgoNoticeMessage: "",
    autoModerateIgnoresBots: true,
    sendWarningMessage: true,
    replyToDeletion: false,
    warningMessage: "Your message was removed by server moderation.",
    timeoutDurationMinutes: 10,
    muteDurationMinutes: 10,
    kickDeleteRecentMessages: false,
    kickDeleteRecentMessageDays: 7,
    banDeleteRecentMessages: false,
    banDeleteRecentMessageDays: 7,
  },
  notes: "",
};

const frame: CSSProperties = {
  color: "#ffd0d0",
  maxWidth: 1480,
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

function toggleId(list: string[], id: string) {
  return list.includes(id) ? list.filter((value) => value !== id) : [...list, id];
}

function parseWordList(value: string): string[] {
  return String(value || "")
    .split(/[,\r\n]+/)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function parseDomainList(value: string): string[] {
  return Array.from(new Set(
    String(value || "")
      .split(/[,\r\n;]+/)
      .map((entry) => entry.trim().toLowerCase())
      .map((entry) => entry.replace(/^https?:\/\//, "").split(/[/?#]/)[0].replace(/:\d+$/, "").replace(/^\.+|\.+$/g, ""))
      .filter(Boolean)
  ));
}

function normalizeAutomodActionValue(value: unknown): string {
  const raw = String(value || "").trim();
  if (raw === "Timeout") return "Timeout Member";
  if (raw === "Kick") return "Kick Member";
  if (raw === "Ban") return "Ban Member";
  return raw;
}

function normalizeModerator(raw: any): ModeratorConfig {
  const automod = { ...DEFAULT_CONFIG.automod, ...(raw?.automod || {}) } as ModeratorConfig["automod"];
  for (const key of [
    "badWordsAction",
    "repeatedTextAction",
    "spamAction",
    "capsAction",
    "linksAction",
    "inviteAction",
    "gifAction",
    "imageAction",
    "mentionAction",
    "zalgoAction",
  ] as const) {
    automod[key] = normalizeAutomodActionValue(automod[key]);
  }
  return {
    ...DEFAULT_CONFIG,
    ...raw,
    logging: { ...DEFAULT_CONFIG.logging, ...(raw?.logging || {}) },
    automod,
  };
}

function moderatorCommandRule(entry: NativeEntry, config: NativeConfig): NativeRule {
  const rule = config.rules?.[entry.key] || {};
  return {
    enabled: typeof rule.enabled === "boolean" ? rule.enabled : true,
    requiredLevel: String(rule.requiredLevel || entry.defaultRequiredLevelName || "SUPPORT_STAFF"),
  };
}

export default function ModeratorClient() {
  const [guildId, setGuildId] = useState("");
  const [guildName, setGuildName] = useState("");
  const [roles, setRoles] = useState<Role[]>([]);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [cfg, setCfg] = useState<ModeratorConfig>(DEFAULT_CONFIG);
  const [blockedWordsText, setBlockedWordsText] = useState("");
  const [nativeConfig, setNativeConfig] = useState<NativeConfig>({ active: true, slashEnabled: true, notes: "", rules: {} });
  const [nativeEntries, setNativeEntries] = useState<NativeEntry[]>([]);
  const [tab, setTab] = useState<TabKey>("automod");
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

  async function loadAll(targetGuildId: string) {
    if (!targetGuildId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setMessage("");

      const [cfgRes, guildRes, nativeRes] = await Promise.all([
        fetch(`/api/bot/engine-config?guildId=${encodeURIComponent(targetGuildId)}&engine=moderator`, { cache: "no-store" }),
        fetch(`/api/bot/guild-data?guildId=${encodeURIComponent(targetGuildId)}`, { cache: "no-store" }),
        fetch(`/api/bot/native-commands?guildId=${encodeURIComponent(targetGuildId)}`, { cache: "no-store" }),
      ]);

      const cfgJson = await cfgRes.json().catch(() => ({}));
      const guildJson = await guildRes.json().catch(() => ({}));
      const nativeJson = await nativeRes.json().catch(() => ({}));

      if (!cfgRes.ok || cfgJson?.success === false) {
        throw new Error(cfgJson?.error || "Failed to load moderator config.");
      }

      const nextCfg = normalizeModerator(cfgJson?.config || {});
      setCfg(nextCfg);
      setBlockedWordsText((nextCfg.automod.blockedWords || []).join(", "));
      setNativeConfig({
        active: nativeJson?.config?.active !== false,
        slashEnabled: nativeJson?.config?.slashEnabled !== false,
        notes: String(nativeJson?.config?.notes || ""),
        rules: nativeJson?.config?.rules && typeof nativeJson.config.rules === "object" ? nativeJson.config.rules : {},
      });

      const nextNativeEntries = Array.isArray(nativeJson?.registry?.entries)
        ? nativeJson.registry.entries.filter((entry: NativeEntry) => entry.commandName === "moderator" && entry.kind === "subcommand")
        : [];
      setNativeEntries(nextNativeEntries);

      const nextRoles = Array.isArray(guildJson?.roles) ? guildJson.roles : [];
      nextRoles.sort((a: Role, b: Role) => (Number(b.position || 0) - Number(a.position || 0)) || a.name.localeCompare(b.name));
      setRoles(nextRoles);

      const nextChannels = Array.isArray(guildJson?.channels) ? guildJson.channels : [];
      setChannels(nextChannels.filter((channel: Channel) => [0, 2, 4, 5].includes(Number(channel.type || 0))));

      const nextGuildName = String(guildJson?.guild?.name || "").trim();
      if (nextGuildName) {
        setGuildName(nextGuildName);
        localStorage.setItem("activeGuildName", nextGuildName);
      }
    } catch (err: any) {
      setMessage(err?.message || "Failed to load moderator.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadAll(guildId);
  }, [guildId]);

  const auditEvents = useMemo(() => ([
    ["memberMuted", "Member muted"],
    ["memberUnmuted", "Member unmuted"],
    ["moderationBan", "Manual kick / ban logs"],
    ["moderationWarn", "Warnings"],
    ["messageUpdated", "Message edited"],
    ["messageDeleted", "Message deleted"],
    ["invitePosted", "Invite posted"],
    ["memberRoleChanged", "Member roles changed"],
    ["memberJoined", "Member joined"],
    ["memberLeft", "Member left"],
    ["userUpdated", "User profile updated"],
    ["channelCreated", "Channel created"],
    ["channelUpdated", "Channel updated"],
    ["channelDeleted", "Channel deleted"],
    ["voiceJoined", "Voice joined"],
    ["voiceMoved", "Voice moved"],
    ["voiceLeft", "Voice left"],
    ["serverUpdated", "Server updated"],
  ]), []);
  const textChannels = useMemo(
    () => channels.filter((channel) => [0, 5].includes(Number(channel.type || 0))),
    [channels]
  );
  const categories = useMemo(
    () => channels.filter((channel) => Number(channel.type || 0) === 4),
    [channels]
  );

  function patchModeratorCommand(entry: NativeEntry, patch: Partial<any>) {
    setNativeConfig((prev) => ({
      ...prev,
      rules: {
        ...prev.rules,
        [entry.key]: {
          enabled: true,
          requiredLevel: entry.defaultRequiredLevelName || "SUPPORT_STAFF",
          ...(prev.rules?.[entry.key] || {}),
          ...patch,
        },
      },
    }));
  }

  async function saveAll() {
    if (!guildId) return;
    setSaving(true);
    setMessage("");
    try {
      const moderatorPatch = {
        ...cfg,
        automod: {
          ...cfg.automod,
          blockedWords: parseWordList(blockedWordsText),
        },
      };
      const moderatorRes = await fetch("/api/bot/engine-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ guildId, engine: "moderator", patch: moderatorPatch }),
      });
      const moderatorJson = await moderatorRes.json().catch(() => ({}));
      if (!moderatorRes.ok || moderatorJson?.success === false) {
        throw new Error(moderatorJson?.error || "Failed to save moderator config.");
      }

      const nativeRes = await fetch("/api/bot/engine-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ guildId, engine: "nativeCommands", patch: nativeConfig }),
      });
      const nativeJson = await nativeRes.json().catch(() => ({}));
      if (!nativeRes.ok || nativeJson?.success === false) {
        throw new Error(nativeJson?.error || "Failed to save moderator commands.");
      }

      const nextCfg = normalizeModerator(moderatorJson?.config || moderatorPatch);
      setCfg(nextCfg);
      setBlockedWordsText((nextCfg.automod.blockedWords || []).join(", "));
      setNativeConfig({
        active: nativeJson?.config?.active !== false,
        slashEnabled: nativeJson?.config?.slashEnabled !== false,
        notes: String(nativeJson?.config?.notes || ""),
        rules: nativeJson?.config?.rules && typeof nativeJson.config.rules === "object" ? nativeJson.config.rules : {},
      });
      if (nativeJson?.sync?.ok) {
        setMessage(`Saved moderator module. Synced ${Number(nativeJson.sync.count || 0)} slash commands to Discord.`);
      } else if (nativeJson?.sync?.error) {
        setMessage(`Saved moderator module, but slash sync failed: ${nativeJson.sync.error}`);
      } else {
        setMessage("Saved moderator module.");
      }
    } catch (err: any) {
      setMessage(err?.message || "Failed to save moderator module.");
    } finally {
      setSaving(false);
    }
  }

  if (!guildId) {
    return <div style={{ color: "#ff6b6b", padding: 24 }}>Missing guildId. Open from `/guilds` first.</div>;
  }

  return (
    <div style={frame}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        <div>
          <div style={{ color: "#ff9a9a", fontSize: 12, letterSpacing: "0.16em", textTransform: "uppercase" }}>Separate Moderator Module</div>
          <h1 style={{ margin: "8px 0 0", color: "#ff4d4d", letterSpacing: "0.10em", textTransform: "uppercase" }}>Moderator</h1>
          <div style={{ color: "#ff9a9a", marginTop: 8 }}>Guild: {guildName || guildId}</div>
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <label style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
            <input type="checkbox" checked={cfg.active} onChange={(e) => setCfg((prev) => ({ ...prev, active: e.target.checked }))} />
            Active
          </label>
          <Link href={buildDashboardHref("/dashboard/slash-commands")} style={{ ...button, textDecoration: "none" }}>
            Open Slash Master
          </Link>
          <button style={button} onClick={saveAll} disabled={saving}>
            {saving ? "Saving..." : "Save Moderator"}
          </button>
        </div>
      </div>

      <div style={{ marginTop: 12, color: "#ffbcbc", maxWidth: 1120, lineHeight: 1.7 }}>
        This is a separate moderation surface. It is not the security stack and it does not touch your `!custom` command studio.
        Automod, audit logging, immunity/admin roles, and `/moderator` slash-command controls live here.
      </div>

      {message ? (
        <div style={{ ...card, marginTop: 14, color: "#ffb3f0" }}>{message}</div>
      ) : null}

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 14 }}>
        {([
          ["automod", "Automod"],
          ["admin", "Admin"],
          ["audit", "Audit Logging"],
          ["commands", "Commands"],
        ] as Array<[TabKey, string]>).map(([value, label]) => (
          <button
            key={value}
            style={{
              ...button,
              background: tab === value ? "#2a0000" : "#160000",
              borderColor: tab === value ? "#ff4d4d" : "#6f0000",
            }}
            onClick={() => setTab(value)}
          >
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ ...card, marginTop: 14 }}>Loading moderator...</div>
      ) : null}

      {!loading && tab === "automod" ? (
        <section style={{ ...card, marginTop: 14 }}>
          <h2 style={{ marginTop: 0, color: "#ff5f5f", letterSpacing: "0.08em", textTransform: "uppercase" }}>Automod</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 12 }}>
            <label><input type="checkbox" checked={cfg.automod.enabled} onChange={(e) => setCfg((prev) => ({ ...prev, automod: { ...prev.automod, enabled: e.target.checked } }))} /> Enabled</label>
            <label><input type="checkbox" checked={cfg.automod.autoModerateIgnoresBots} onChange={(e) => setCfg((prev) => ({ ...prev, automod: { ...prev.automod, autoModerateIgnoresBots: e.target.checked } }))} /> Ignore bots</label>
            <label><input type="checkbox" checked={cfg.automod.sendWarningMessage} onChange={(e) => setCfg((prev) => ({ ...prev, automod: { ...prev.automod, sendWarningMessage: e.target.checked } }))} /> DM warning</label>
            <label><input type="checkbox" checked={cfg.automod.replyToDeletion} onChange={(e) => setCfg((prev) => ({ ...prev, automod: { ...prev.automod, replyToDeletion: e.target.checked } }))} /> Reply in channel</label>
            <label><input type="checkbox" checked={cfg.automod.allowInviteLinks} onChange={(e) => setCfg((prev) => ({ ...prev, automod: { ...prev.automod, allowInviteLinks: e.target.checked } }))} /> Allow invite links everywhere</label>
            <label><input type="checkbox" checked={cfg.automod.allowGifLinks} onChange={(e) => setCfg((prev) => ({ ...prev, automod: { ...prev.automod, allowGifLinks: e.target.checked } }))} /> Allow GIF links everywhere</label>
            <label><input type="checkbox" checked={cfg.automod.allowImageLinks} onChange={(e) => setCfg((prev) => ({ ...prev, automod: { ...prev.automod, allowImageLinks: e.target.checked } }))} /> Allow image links everywhere</label>
          </div>

          <div style={{ color: "#ffbcbc", marginTop: 10 }}>
            Link controls can allow invite, GIF, or image links to pass without weakening the rest of your link blocker. Uploaded GIF/image media can still use their own automod actions below, and every rule can now have its own exemptions.
          </div>

          <div style={{ marginTop: 14 }}>
            <label>Automod log channel</label>
            <select
              style={input}
              value={cfg.automod.logChannelId}
              onChange={(e) => setCfg((prev) => ({ ...prev, automod: { ...prev.automod, logChannelId: e.target.value } }))}
            >
              <option value="">Use moderator audit log channel</option>
              {textChannels.map((channel) => (
                <option key={channel.id} value={channel.id}>#{channel.name}</option>
              ))}
            </select>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 12, marginTop: 14 }}>
            {([
              ["badWordsAction", "Blocked words"],
              ["repeatedTextAction", "Repeated text"],
              ["spamAction", "Spam burst"],
              ["capsAction", "Caps"],
              ["linksAction", "External links"],
              ["inviteAction", "Discord invites"],
              ["gifAction", "GIF media"],
              ["imageAction", "Image media"],
              ["mentionAction", "Mention burst"],
              ["zalgoAction", "Zalgo"],
            ] as Array<[keyof ModeratorConfig["automod"], string]>).map(([key, label]) => (
              <div key={String(key)}>
                <label>{label}</label>
                <select
                  style={input}
                  value={String(cfg.automod[key])}
                  onChange={(e) => setCfg((prev) => ({ ...prev, automod: { ...prev.automod, [key]: e.target.value } }))}
                >
                  {ACTIONS.map((action) => <option key={action} value={action}>{action}</option>)}
                </select>
              </div>
            ))}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(4,minmax(160px,1fr))", gap: 12, marginTop: 14 }}>
            <div>
              <label>Spam threshold</label>
              <input style={input} type="number" value={cfg.automod.spamThreshold} onChange={(e) => setCfg((prev) => ({ ...prev, automod: { ...prev.automod, spamThreshold: Number(e.target.value || 0) } }))} />
            </div>
            <div>
              <label>Spam window seconds</label>
              <input style={input} type="number" value={cfg.automod.spamWindowSeconds} onChange={(e) => setCfg((prev) => ({ ...prev, automod: { ...prev.automod, spamWindowSeconds: Number(e.target.value || 0) } }))} />
            </div>
            <div>
              <label>Repeated text threshold</label>
              <input style={input} type="number" value={cfg.automod.repeatedTextThreshold} onChange={(e) => setCfg((prev) => ({ ...prev, automod: { ...prev.automod, repeatedTextThreshold: Number(e.target.value || 0) } }))} />
            </div>
            <div>
              <label>Repeated text window seconds</label>
              <input style={input} type="number" value={cfg.automod.repeatedTextWindowSeconds} onChange={(e) => setCfg((prev) => ({ ...prev, automod: { ...prev.automod, repeatedTextWindowSeconds: Number(e.target.value || 0) } }))} />
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 12, marginTop: 14 }}>
            <div>
              <label>Caps threshold %</label>
              <input style={input} type="number" value={cfg.automod.capsThreshold} onChange={(e) => setCfg((prev) => ({ ...prev, automod: { ...prev.automod, capsThreshold: Number(e.target.value || 0) } }))} />
            </div>
            <div>
              <label>Mention threshold</label>
              <input style={input} type="number" value={cfg.automod.mentionThreshold} onChange={(e) => setCfg((prev) => ({ ...prev, automod: { ...prev.automod, mentionThreshold: Number(e.target.value || 0) } }))} />
            </div>
            <div>
              <label>Timeout minutes</label>
              <input style={input} type="number" value={cfg.automod.timeoutDurationMinutes} onChange={(e) => setCfg((prev) => ({ ...prev, automod: { ...prev.automod, timeoutDurationMinutes: Number(e.target.value || 0) } }))} />
            </div>
            <div>
              <label>Mute minutes</label>
              <input style={input} type="number" value={cfg.automod.muteDurationMinutes} onChange={(e) => setCfg((prev) => ({ ...prev, automod: { ...prev.automod, muteDurationMinutes: Number(e.target.value || 0) } }))} />
            </div>
            <label><input type="checkbox" checked={cfg.automod.kickDeleteRecentMessages} onChange={(e) => setCfg((prev) => ({ ...prev, automod: { ...prev.automod, kickDeleteRecentMessages: e.target.checked } }))} /> Kick also purge recent messages</label>
            <div>
              <label>Kick purge days</label>
              <input style={input} type="number" min={0} max={7} value={cfg.automod.kickDeleteRecentMessageDays} onChange={(e) => setCfg((prev) => ({ ...prev, automod: { ...prev.automod, kickDeleteRecentMessageDays: Number(e.target.value || 0) } }))} />
            </div>
            <label><input type="checkbox" checked={cfg.automod.banDeleteRecentMessages} onChange={(e) => setCfg((prev) => ({ ...prev, automod: { ...prev.automod, banDeleteRecentMessages: e.target.checked } }))} /> Ban also purge recent messages</label>
            <div>
              <label>Ban purge days</label>
              <input style={input} type="number" min={0} max={7} value={cfg.automod.banDeleteRecentMessageDays} onChange={(e) => setCfg((prev) => ({ ...prev, automod: { ...prev.automod, banDeleteRecentMessageDays: Number(e.target.value || 0) } }))} />
            </div>
          </div>

          <div style={{ marginTop: 14 }}>
            <label>Blocked words (comma or new-line separated)</label>
            <textarea
              style={{ ...input, minHeight: 90 }}
              value={blockedWordsText}
              onChange={(e) => setBlockedWordsText(e.target.value)}
              onBlur={() => setCfg((prev) => ({
                ...prev,
                automod: {
                  ...prev.automod,
                  blockedWords: parseWordList(blockedWordsText),
                },
              }))}
            />
          </div>

          <div style={{ marginTop: 14 }}>
            <label>Warning message</label>
            <textarea
              style={{ ...input, minHeight: 80 }}
              value={cfg.automod.warningMessage}
              onChange={(e) => setCfg((prev) => ({ ...prev, automod: { ...prev.automod, warningMessage: e.target.value } }))}
            />
          </div>

          <div style={{ marginTop: 14 }}>
            <h3 style={{ color: "#ff5f5f", marginTop: 0 }}>Per-Rule Responses</h3>
            <div style={{ color: "#ffbcbc", marginBottom: 10 }}>
              Each automod rule can now have its own DM, channel reply, both, or no notice at all. Leave a rule message blank to fall back to the global warning message above.
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))", gap: 12 }}>
              {AUTOMOD_NOTICE_RULES.map(([ruleKey, label]) => {
                const modeKey = `${ruleKey}NoticeMode` as keyof ModeratorConfig["automod"];
                const messageKey = `${ruleKey}NoticeMessage` as keyof ModeratorConfig["automod"];
                const modeValue = String(cfg.automod[modeKey] || "");
                const normalizedMode = modeValue === "dm" ? "DM" : modeValue === "reply" ? "Reply In Channel" : modeValue === "both" ? "Both" : "Disabled";
                return (
                  <div key={`notice_${ruleKey}`} style={{ border: "1px solid #4f0000", borderRadius: 10, padding: 12, background: "#120000" }}>
                    <div style={{ color: "#ffdcdc", fontWeight: 800, marginBottom: 8 }}>{label}</div>
                    <div>
                      <label>Response mode</label>
                      <select
                        style={input}
                        value={normalizedMode}
                        onChange={(e) => setCfg((prev) => {
                          const nextMode = e.target.value === "DM" ? "dm" : e.target.value === "Reply In Channel" ? "reply" : e.target.value === "Both" ? "both" : "disabled";
                          return { ...prev, automod: { ...prev.automod, [modeKey]: nextMode } };
                        })}
                      >
                        {NOTICE_MODES.map((mode) => <option key={`${ruleKey}_${mode}`} value={mode}>{mode}</option>)}
                      </select>
                    </div>
                    <div style={{ marginTop: 8 }}>
                      <label>Response message</label>
                      <textarea
                        style={{ ...input, minHeight: 92 }}
                        value={String(cfg.automod[messageKey] || "")}
                        onChange={(e) => setCfg((prev) => ({ ...prev, automod: { ...prev.automod, [messageKey]: e.target.value } }))}
                        placeholder="Leave blank to use the global warning message."
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div style={{ marginTop: 14 }}>
            <h3 style={{ color: "#ff5f5f", marginTop: 0 }}>Scoped Link Allowances</h3>
            <div style={{ color: "#ffbcbc", marginBottom: 10 }}>
              Use this when you want Twitch, YouTube, or other trusted domains to pass only in selected promo channels while the rest of the server stays locked down.
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))", gap: 14 }}>
              <div>
                <label>Allowed external link domains</label>
                <textarea
                  style={{ ...input, minHeight: 120 }}
                  value={cfg.automod.allowedLinkDomains.join("\n")}
                  onChange={(e) => setCfg((prev) => ({ ...prev, automod: { ...prev.automod, allowedLinkDomains: parseDomainList(e.target.value) } }))}
                  placeholder={"twitch.tv\nyoutube.com\nyoutu.be"}
                />
              </div>
              <div>
                <div style={{ color: "#ffbcbc", fontWeight: 700, marginBottom: 8 }}>Channels where trusted domains are allowed</div>
                <div style={{ display: "grid", gap: 6, maxHeight: 260, overflowY: "auto" }}>
                  {textChannels.map((channel) => (
                    <label key={`allowed_domain_channel_${channel.id}`}>
                      <input
                        type="checkbox"
                        checked={cfg.automod.allowedLinkChannelIds.includes(channel.id)}
                        onChange={() => setCfg((prev) => ({
                          ...prev,
                          automod: { ...prev.automod, allowedLinkChannelIds: toggleId(prev.automod.allowedLinkChannelIds, channel.id) },
                        }))}
                      />{" "}
                      #{channel.name}
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <div style={{ color: "#ffbcbc", fontWeight: 700, marginBottom: 8 }}>Categories where trusted domains are allowed</div>
                <div style={{ display: "grid", gap: 6, maxHeight: 260, overflowY: "auto" }}>
                  {categories.length ? categories.map((channel) => (
                    <label key={`allowed_domain_category_${channel.id}`}>
                      <input
                        type="checkbox"
                        checked={cfg.automod.allowedLinkCategoryIds.includes(channel.id)}
                        onChange={() => setCfg((prev) => ({
                          ...prev,
                          automod: { ...prev.automod, allowedLinkCategoryIds: toggleId(prev.automod.allowedLinkCategoryIds, channel.id) },
                        }))}
                      />{" "}
                      {channel.name}
                    </label>
                  )) : <div style={{ color: "#ffbcbc" }}>No categories found.</div>}
                </div>
              </div>
            </div>
          </div>

          <div style={{ marginTop: 14 }}>
            <h3 style={{ color: "#ff5f5f", marginTop: 0 }}>Automod Scope</h3>
            <div style={{ color: "#ffbcbc", marginBottom: 10 }}>
              Automod now assumes all channels are protected by default. Use channel and category exemptions to carve out safe spaces.
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))", gap: 14 }}>
              <div>
                <div style={{ color: "#ffbcbc", fontWeight: 700, marginBottom: 8 }}>Exempt Channels</div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(2,minmax(180px,1fr))", gap: 6, maxHeight: 260, overflowY: "auto" }}>
                  {textChannels.map((channel) => (
                    <label key={`exempt_${channel.id}`}>
                      <input
                        type="checkbox"
                        checked={cfg.automod.exemptChannelIds.includes(channel.id)}
                        onChange={() => setCfg((prev) => ({
                          ...prev,
                          automod: { ...prev.automod, exemptChannelIds: toggleId(prev.automod.exemptChannelIds, channel.id) },
                        }))}
                      />{" "}
                      #{channel.name}
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <div style={{ color: "#ffbcbc", fontWeight: 700, marginBottom: 8 }}>Exempt Categories</div>
                <div style={{ display: "grid", gap: 6, maxHeight: 260, overflowY: "auto" }}>
                  {categories.length ? categories.map((channel) => (
                    <label key={`exempt_category_${channel.id}`}>
                      <input
                        type="checkbox"
                        checked={cfg.automod.exemptCategoryIds.includes(channel.id)}
                        onChange={() => setCfg((prev) => ({
                          ...prev,
                          automod: { ...prev.automod, exemptCategoryIds: toggleId(prev.automod.exemptCategoryIds, channel.id) },
                        }))}
                      />{" "}
                      {channel.name}
                    </label>
              )) : <div style={{ color: "#ffbcbc" }}>No categories found.</div>}
                </div>
              </div>
            </div>
          </div>

          <div style={{ marginTop: 14 }}>
            <h3 style={{ color: "#ff5f5f", marginTop: 0 }}>Per-Rule Exemptions</h3>
            <div style={{ color: "#ffbcbc", marginBottom: 10 }}>
              Every automod rule can now have its own exempt roles, channels, and categories. Use this for self-promo rooms, media rooms, or trusted member groups without weakening the rest of the policy.
            </div>
            <div style={{ display: "grid", gap: 12 }}>
              {AUTOMOD_NOTICE_RULES.map(([ruleKey, label]) => {
                const channelKey = `${ruleKey}ExemptChannelIds` as keyof ModeratorConfig["automod"];
                const categoryKey = `${ruleKey}ExemptCategoryIds` as keyof ModeratorConfig["automod"];
                const roleKey = `${ruleKey}ExemptRoleIds` as keyof ModeratorConfig["automod"];
                const selectedChannels = Array.isArray(cfg.automod[channelKey]) ? cfg.automod[channelKey] as string[] : [];
                const selectedCategories = Array.isArray(cfg.automod[categoryKey]) ? cfg.automod[categoryKey] as string[] : [];
                const selectedRoles = Array.isArray(cfg.automod[roleKey]) ? cfg.automod[roleKey] as string[] : [];
                return (
                  <details key={`rule_scope_${ruleKey}`} style={{ border: "1px solid #4f0000", borderRadius: 10, padding: 12, background: "#120000" }}>
                    <summary style={{ cursor: "pointer", color: "#ffdcdc", fontWeight: 800 }}>{label}</summary>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))", gap: 12, marginTop: 12 }}>
                      <div>
                        <div style={{ color: "#ffbcbc", fontWeight: 700, marginBottom: 8 }}>Exempt channels</div>
                        <div style={{ display: "grid", gap: 6, maxHeight: 220, overflowY: "auto" }}>
                          {textChannels.map((channel) => (
                            <label key={`${ruleKey}_channel_${channel.id}`}>
                              <input
                                type="checkbox"
                                checked={selectedChannels.includes(channel.id)}
                                onChange={() => setCfg((prev) => ({
                                  ...prev,
                                  automod: { ...prev.automod, [channelKey]: toggleId((prev.automod[channelKey] as string[]) || [], channel.id) },
                                }))}
                              />{" "}
                              #{channel.name}
                            </label>
                          ))}
                        </div>
                      </div>
                      <div>
                        <div style={{ color: "#ffbcbc", fontWeight: 700, marginBottom: 8 }}>Exempt categories</div>
                        <div style={{ display: "grid", gap: 6, maxHeight: 220, overflowY: "auto" }}>
                          {categories.length ? categories.map((channel) => (
                            <label key={`${ruleKey}_category_${channel.id}`}>
                              <input
                                type="checkbox"
                                checked={selectedCategories.includes(channel.id)}
                                onChange={() => setCfg((prev) => ({
                                  ...prev,
                                  automod: { ...prev.automod, [categoryKey]: toggleId((prev.automod[categoryKey] as string[]) || [], channel.id) },
                                }))}
                              />{" "}
                              {channel.name}
                            </label>
                          )) : <div style={{ color: "#ffbcbc" }}>No categories found.</div>}
                        </div>
                      </div>
                      <div>
                        <div style={{ color: "#ffbcbc", fontWeight: 700, marginBottom: 8 }}>Exempt roles</div>
                        <div style={{ display: "grid", gap: 6, maxHeight: 220, overflowY: "auto" }}>
                          {roles.map((role) => (
                            <label key={`${ruleKey}_role_${role.id}`}>
                              <input
                                type="checkbox"
                                checked={selectedRoles.includes(role.id)}
                                onChange={() => setCfg((prev) => ({
                                  ...prev,
                                  automod: { ...prev.automod, [roleKey]: toggleId((prev.automod[roleKey] as string[]) || [], role.id) },
                                }))}
                              />{" "}
                              @{role.name}
                            </label>
                          ))}
                        </div>
                      </div>
                    </div>
                  </details>
                );
              })}
            </div>
          </div>

          <div style={{ marginTop: 14 }}>
            <h3 style={{ color: "#ff5f5f", marginTop: 0 }}>Automod Exempt Roles</h3>
            <div style={{ color: "#ffbcbc", marginBottom: 10 }}>
              These roles bypass automod only. They are separate from full moderator immunity roles.
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,minmax(220px,1fr))", gap: 6, maxHeight: 260, overflowY: "auto" }}>
              {roles.map((role) => (
                <label key={`automod_role_${role.id}`}>
                  <input
                    type="checkbox"
                    checked={cfg.automod.exemptRoleIds.includes(role.id)}
                    onChange={() => setCfg((prev) => ({
                      ...prev,
                      automod: { ...prev.automod, exemptRoleIds: toggleId(prev.automod.exemptRoleIds, role.id) },
                    }))}
                  />{" "}
                  @{role.name}
                </label>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {!loading && tab === "admin" ? (
        <section style={{ ...card, marginTop: 14 }}>
          <h2 style={{ marginTop: 0, color: "#ff5f5f", letterSpacing: "0.08em", textTransform: "uppercase" }}>Admin</h2>
          <div style={{ color: "#ffbcbc", marginBottom: 12 }}>
            Admin roles can operate the moderator slash tools here. Immunity roles bypass automod and moderator command targeting.
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <div>
              <h3 style={{ color: "#ff5f5f", marginTop: 0 }}>Admin Roles</h3>
              <div style={{ display: "grid", gap: 6, maxHeight: 360, overflowY: "auto" }}>
                {roles.map((role) => (
                  <label key={role.id}>
                    <input
                      type="checkbox"
                      checked={cfg.adminRoleIds.includes(role.id)}
                      onChange={() => setCfg((prev) => ({ ...prev, adminRoleIds: toggleId(prev.adminRoleIds, role.id) }))}
                    />{" "}
                    {role.name}
                  </label>
                ))}
              </div>
            </div>

            <div>
              <h3 style={{ color: "#ff5f5f", marginTop: 0 }}>Immunity Roles</h3>
              <div style={{ display: "grid", gap: 6, maxHeight: 360, overflowY: "auto" }}>
                {roles.map((role) => (
                  <label key={role.id}>
                    <input
                      type="checkbox"
                      checked={cfg.immunityRoleIds.includes(role.id)}
                      onChange={() => setCfg((prev) => ({ ...prev, immunityRoleIds: toggleId(prev.immunityRoleIds, role.id) }))}
                    />{" "}
                    {role.name}
                  </label>
                ))}
              </div>
            </div>
          </div>

          <div style={{ marginTop: 14 }}>
            <label>Moderator Notes</label>
            <textarea style={{ ...input, minHeight: 90 }} value={cfg.notes} onChange={(e) => setCfg((prev) => ({ ...prev, notes: e.target.value }))} />
          </div>
        </section>
      ) : null}

      {!loading && tab === "audit" ? (
        <section style={{ ...card, marginTop: 14 }}>
          <h2 style={{ marginTop: 0, color: "#ff5f5f", letterSpacing: "0.08em", textTransform: "uppercase" }}>Audit Logging</h2>
          <div>
            <label>Log Channel</label>
            <select style={input} value={cfg.logging.logChannelId} onChange={(e) => setCfg((prev) => ({ ...prev, logging: { ...prev.logging, logChannelId: e.target.value } }))}>
              <option value="">Select a channel</option>
              {channels.map((channel) => <option key={channel.id} value={channel.id}>#{channel.name}</option>)}
            </select>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,minmax(220px,1fr))", gap: 8, marginTop: 14 }}>
            {auditEvents.map(([key, label]) => (
              <label key={String(key)}>
                <input
                  type="checkbox"
                  checked={Boolean((cfg.logging as any)[key])}
                  onChange={(e) => setCfg((prev) => ({ ...prev, logging: { ...prev.logging, [key]: e.target.checked } }))}
                />{" "}
                {label}
              </label>
            ))}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(2,minmax(240px,1fr))", gap: 12, marginTop: 14 }}>
            <label><input type="checkbox" checked={cfg.logging.dontLogBotActions} onChange={(e) => setCfg((prev) => ({ ...prev, logging: { ...prev.logging, dontLogBotActions: e.target.checked } }))} /> Ignore bot actions</label>
            <label><input type="checkbox" checked={cfg.logging.dontDisplayThumbnails} onChange={(e) => setCfg((prev) => ({ ...prev, logging: { ...prev.logging, dontDisplayThumbnails: e.target.checked } }))} /> Hide thumbnails</label>
          </div>

          <div style={{ marginTop: 14 }}>
            <h3 style={{ color: "#ff5f5f", marginTop: 0 }}>Ignored Channels</h3>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,minmax(220px,1fr))", gap: 6, maxHeight: 260, overflowY: "auto" }}>
              {channels.map((channel) => (
                <label key={channel.id}>
                  <input
                    type="checkbox"
                    checked={cfg.logging.ignoreChannelIds.includes(channel.id)}
                    onChange={() => setCfg((prev) => ({
                      ...prev,
                      logging: { ...prev.logging, ignoreChannelIds: toggleId(prev.logging.ignoreChannelIds, channel.id) },
                    }))}
                  />{" "}
                  #{channel.name}
                </label>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {!loading && tab === "commands" ? (
        <section style={{ ...card, marginTop: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
            <div>
              <h2 style={{ margin: 0, color: "#ff5f5f", letterSpacing: "0.08em", textTransform: "uppercase" }}>Moderator Slash Commands</h2>
              <div style={{ color: "#ffbcbc", marginTop: 8 }}>
                These are the new `/moderator` native slash commands. The full native slash registry still lives in the separate Slash Command Master.
              </div>
            </div>
            <Link href={buildDashboardHref("/dashboard/slash-commands")} style={{ ...button, textDecoration: "none" }}>
              Open Full Slash Master
            </Link>
          </div>

          <div style={{ display: "grid", gap: 10, marginTop: 14 }}>
            {nativeEntries.map((entry) => {
              const rule = moderatorCommandRule(entry, nativeConfig);
              return (
                <div key={entry.key} style={{ border: "1px solid #4f0000", borderRadius: 10, padding: 12, background: "#120000" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
                    <div>
                      <div style={{ color: "#ffdcdc", fontWeight: 800 }}>{entry.title}</div>
                      <div style={{ color: "#ffbcbc", fontSize: 13, marginTop: 4 }}>{entry.description}</div>
                    </div>
                    <label><input type="checkbox" checked={rule.enabled} onChange={(e) => patchModeratorCommand(entry, { enabled: e.target.checked })} /> Enabled</label>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "260px 1fr", gap: 12, marginTop: 10, alignItems: "center" }}>
                    <div>
                      <label>Minimum Access Level</label>
                      <select style={input} value={rule.requiredLevel} onChange={(e) => patchModeratorCommand(entry, { requiredLevel: e.target.value })}>
                        {LEVELS.map((level) => <option key={level} value={level}>{level}</option>)}
                      </select>
                    </div>
                    <div style={{ color: "#ffbcbc", fontSize: 13 }}>
                      Key: <code>{entry.key}</code>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ) : null}
    </div>
  );
}
