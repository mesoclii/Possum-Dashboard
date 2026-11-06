"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { fetchGuildData, fetchRuntimeEngine, resolveGuildContext, saveRuntimeEngine } from "@/lib/liveRuntime";

type Role = { id: string; name: string; position?: number };
type Channel = { id: string; name: string; type?: number | string };

const box: CSSProperties = { border: "1px solid #5f0000", borderRadius: 12, padding: 14, background: "rgba(120,0,0,0.08)", marginBottom: 14 };
const input: CSSProperties = { width: "100%", padding: 10, background: "#0a0a0a", border: "1px solid #6f0000", color: "#ffd7d7", borderRadius: 8 };
const action: CSSProperties = { ...input, width: "auto", cursor: "pointer", fontWeight: 900, textTransform: "uppercase", letterSpacing: "0.06em" };

const automodActions = [
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

const noticeModes = ["Disabled", "DM", "Reply In Channel", "Both"];

const automodNoticeRules = [
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

function toggleId(list: string[], id: string) {
  return list.includes(id) ? list.filter((value) => value !== id) : [...list, id];
}

function parseDomainList(value: string) {
  return Array.from(new Set(
    String(value || "")
      .split(/[,\r\n;]+/)
      .map((entry) => entry.trim().toLowerCase())
      .map((entry) => entry.replace(/^https?:\/\//, "").split(/[/?#]/)[0].replace(/:\d+$/, "").replace(/^\.+|\.+$/g, ""))
      .filter(Boolean)
  ));
}

function normalizeAutomodActionValue(value: unknown) {
  const raw = String(value || "").trim();
  if (raw === "Timeout") return "Timeout Member";
  if (raw === "Kick") return "Kick Member";
  if (raw === "Ban") return "Ban Member";
  return raw;
}

function normalizePolicyConfig(raw: Record<string, any>) {
  const next = { ...(raw || {}) };
  const automod = { ...(next.automod || {}) };
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
  ]) {
    automod[key] = normalizeAutomodActionValue(automod[key]);
  }
  next.automod = automod;
  return next;
}

function RoleChips({ label, roles, selected, onToggle }: { label: string; roles: Role[]; selected: string[]; onToggle: (roleId: string) => void }) {
  return (
    <div>
      <div style={{ color: "#ffb5b5", fontSize: 12, marginBottom: 6 }}>{label}</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {roles.map((role) => {
          const active = selected.includes(role.id);
          return (
            <button
              key={`${label}:${role.id}`}
              type="button"
              onClick={() => onToggle(role.id)}
              style={{
                borderRadius: 999,
                border: active ? "1px solid #ff5555" : "1px solid #553030",
                background: active ? "rgba(255,0,0,.24)" : "rgba(255,255,255,.03)",
                color: active ? "#fff" : "#ffb3b3",
                padding: "6px 10px",
                cursor: "pointer",
                fontSize: 12,
              }}
            >
              {role.name}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function PolicyClient() {
  const [guildId, setGuildId] = useState("");
  const [guildName, setGuildName] = useState("");
  const [cfg, setCfg] = useState<Record<string, any>>({});
  const [roles, setRoles] = useState<Role[]>([]);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const resolved = resolveGuildContext();
    setGuildId(resolved.guildId);
    setGuildName(resolved.guildName);
  }, []);

  useEffect(() => {
    async function loadAll(targetGuildId: string) {
      if (!targetGuildId) {
        setLoading(false);
        return;
      }
      try {
        setLoading(true);
        setMessage("");
        const [runtimeJson, guildJson] = await Promise.all([
          fetchRuntimeEngine(targetGuildId, "moderator"),
          fetchGuildData(targetGuildId),
        ]);
        setCfg(normalizePolicyConfig(runtimeJson?.config || {}));
        setRoles(Array.isArray(guildJson.roles) ? guildJson.roles : []);
        setChannels(Array.isArray(guildJson.channels) ? guildJson.channels : []);
      } catch (err: any) {
        setMessage(err?.message || "Failed to load moderation policy.");
      } finally {
        setLoading(false);
      }
    }
    void loadAll(guildId);
  }, [guildId]);

  async function save() {
    if (!guildId) return;
    try {
      setSaving(true);
      setMessage("");
      const json = await saveRuntimeEngine(guildId, "moderator", cfg);
      setCfg(normalizePolicyConfig(json?.config || {}));
      setMessage("Saved live moderation policy.");
    } catch (err: any) {
      setMessage(err?.message || "Save failed.");
    } finally {
      setSaving(false);
    }
  }

  const textChannels = useMemo(() => channels.filter((channel) => Number(channel.type) === 0 || Number(channel.type) === 5), [channels]);
  const categories = useMemo(() => channels.filter((channel) => Number(channel.type) === 4), [channels]);
  const logging = cfg.logging || {};
  const automod = cfg.automod || {};

  if (!guildId && !loading) return <div style={{ color: "#ff7777", padding: 20 }}>Missing guildId.</div>;

  return (
    <div style={{ color: "#ff4d4d", padding: 20, maxWidth: 1280 }}>
      <div style={box}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
          <div>
            <h1 style={{ marginTop: 0, letterSpacing: "0.12em", textTransform: "uppercase" }}>Security Policy</h1>
            <p style={{ margin: "6px 0 0" }}>Guild: {guildName || guildId}</p>
            <div style={{ color: "#ffb3b3", fontSize: 12 }}>
              This page edits the live `moderator` engine only. Per-command access stays in the native slash command master.
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Link href={`/dashboard/moderator?guildId=${encodeURIComponent(guildId)}`} style={{ ...action, textDecoration: "none" }}>Open Moderator</Link>
            <Link href={`/dashboard/slash-commands?guildId=${encodeURIComponent(guildId)}`} style={{ ...action, textDecoration: "none" }}>Slash Commands</Link>
          </div>
        </div>
        {message ? <div style={{ marginTop: 10, color: "#ffb3f0" }}>{message}</div> : null}
      </div>

      {loading ? <div style={box}>Loading moderation policy...</div> : null}

      {!loading ? (
        <>
          <div style={box}>
            <h3 style={{ marginTop: 0, color: "#ff4444" }}>Core Controls</h3>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,minmax(180px,1fr))", gap: 10 }}>
              <label><input type="checkbox" checked={Boolean(cfg.active)} onChange={(event) => setCfg((prev: Record<string, any>) => ({ ...prev, active: event.target.checked }))} /> Policy active</label>
              <label><input type="checkbox" checked={Boolean(automod.enabled)} onChange={(event) => setCfg((prev: Record<string, any>) => ({ ...prev, automod: { ...(prev.automod || {}), enabled: event.target.checked } }))} /> Automod enabled</label>
              <label><input type="checkbox" checked={Boolean(logging.dontLogBotActions)} onChange={(event) => setCfg((prev: Record<string, any>) => ({ ...prev, logging: { ...(prev.logging || {}), dontLogBotActions: event.target.checked } }))} /> Ignore bot actions</label>
              <label><input type="checkbox" checked={Boolean(logging.dontDisplayThumbnails)} onChange={(event) => setCfg((prev: Record<string, any>) => ({ ...prev, logging: { ...(prev.logging || {}), dontDisplayThumbnails: event.target.checked } }))} /> Hide thumbnails</label>
              <label><input type="checkbox" checked={Boolean(automod.autoModerateIgnoresBots)} onChange={(event) => setCfg((prev: Record<string, any>) => ({ ...prev, automod: { ...(prev.automod || {}), autoModerateIgnoresBots: event.target.checked } }))} /> Ignore bots in automod</label>
              <label><input type="checkbox" checked={Boolean(automod.replyToDeletion)} onChange={(event) => setCfg((prev: Record<string, any>) => ({ ...prev, automod: { ...(prev.automod || {}), replyToDeletion: event.target.checked } }))} /> Reply on deletion</label>
              <label><input type="checkbox" checked={Boolean(automod.allowInviteLinks)} onChange={(event) => setCfg((prev: Record<string, any>) => ({ ...prev, automod: { ...(prev.automod || {}), allowInviteLinks: event.target.checked } }))} /> Allow invite links everywhere</label>
              <label><input type="checkbox" checked={Boolean(automod.allowGifLinks)} onChange={(event) => setCfg((prev: Record<string, any>) => ({ ...prev, automod: { ...(prev.automod || {}), allowGifLinks: event.target.checked } }))} /> Allow GIF links everywhere</label>
              <label><input type="checkbox" checked={Boolean(automod.allowImageLinks)} onChange={(event) => setCfg((prev: Record<string, any>) => ({ ...prev, automod: { ...(prev.automod || {}), allowImageLinks: event.target.checked } }))} /> Allow image links everywhere</label>
            </div>
            <div style={{ color: "#ffbcbc", marginTop: 10 }}>
              Automod now assumes all channels are protected by default. Invite, GIF, and image links can be carved out separately here, while uploaded GIF/image media can still use dedicated actions below and every rule can carry its own exemptions.
            </div>
          </div>

          <div style={box}>
            <h3 style={{ marginTop: 0, color: "#ff4444" }}>Roles + Audit Routing</h3>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <RoleChips label="Admin roles" roles={roles} selected={Array.isArray(cfg.adminRoleIds) ? cfg.adminRoleIds : []} onToggle={(roleId) => setCfg((prev: Record<string, any>) => ({ ...prev, adminRoleIds: toggleId(Array.isArray(prev.adminRoleIds) ? prev.adminRoleIds : [], roleId) }))} />
              <RoleChips label="Immunity roles" roles={roles} selected={Array.isArray(cfg.immunityRoleIds) ? cfg.immunityRoleIds : []} onToggle={(roleId) => setCfg((prev: Record<string, any>) => ({ ...prev, immunityRoleIds: toggleId(Array.isArray(prev.immunityRoleIds) ? prev.immunityRoleIds : [], roleId) }))} />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 10 }}>
              <div>
                <label>Log channel</label>
                <select style={input} value={String(logging.logChannelId || "")} onChange={(event) => setCfg((prev: Record<string, any>) => ({ ...prev, logging: { ...(prev.logging || {}), logChannelId: event.target.value } }))}>
                  <option value="">Select channel</option>
                  {textChannels.map((channel) => <option key={channel.id} value={channel.id}>#{channel.name}</option>)}
                </select>
              </div>
              <div>
                <label>Ignored channels</label>
                <div style={{ maxHeight: 180, overflowY: "auto", border: "1px solid #4f0000", borderRadius: 10, padding: 10, background: "#110000" }}>
                  {textChannels.map((channel) => (
                    <label key={`ignore_${channel.id}`} style={{ display: "block", marginBottom: 6 }}>
                      <input
                        type="checkbox"
                        checked={Array.isArray(logging.ignoreChannelIds) && logging.ignoreChannelIds.includes(channel.id)}
                        onChange={() => setCfg((prev: Record<string, any>) => ({
                          ...prev,
                          logging: {
                            ...(prev.logging || {}),
                            ignoreChannelIds: toggleId(Array.isArray(prev.logging?.ignoreChannelIds) ? prev.logging.ignoreChannelIds : [], channel.id),
                          },
                        }))}
                      />{" "}
                      #{channel.name}
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div style={box}>
            <h3 style={{ marginTop: 0, color: "#ff4444" }}>Automod Policy Matrix</h3>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 10 }}>
              {[
                ["badWordsAction", "Bad words"],
                ["repeatedTextAction", "Repeated text"],
                ["spamAction", "Spam"],
                ["capsAction", "Caps"],
                ["linksAction", "Links"],
                ["inviteAction", "Invites"],
                ["gifAction", "GIF media"],
                ["imageAction", "Image media"],
                ["mentionAction", "Mentions"],
                ["zalgoAction", "Zalgo"],
              ].map(([key, label]) => (
                <div key={key}>
                  <label>{label}</label>
                  <select style={input} value={String(automod[key] || "Disabled")} onChange={(event) => setCfg((prev: Record<string, any>) => ({ ...prev, automod: { ...(prev.automod || {}), [key]: event.target.value } }))}>
                    {automodActions.map((option) => <option key={`${key}:${option}`} value={option}>{option}</option>)}
                  </select>
                </div>
              ))}
              <div>
                <label>Spam threshold</label>
                <input style={input} type="number" value={Number(automod.spamThreshold || 5)} onChange={(event) => setCfg((prev: Record<string, any>) => ({ ...prev, automod: { ...(prev.automod || {}), spamThreshold: Number(event.target.value || 0) } }))} />
              </div>
              <div>
                <label>Caps threshold</label>
                <input style={input} type="number" value={Number(automod.capsThreshold || 70)} onChange={(event) => setCfg((prev: Record<string, any>) => ({ ...prev, automod: { ...(prev.automod || {}), capsThreshold: Number(event.target.value || 0) } }))} />
              </div>
              <div>
                <label>Mention threshold</label>
                <input style={input} type="number" value={Number(automod.mentionThreshold || 5)} onChange={(event) => setCfg((prev: Record<string, any>) => ({ ...prev, automod: { ...(prev.automod || {}), mentionThreshold: Number(event.target.value || 0) } }))} />
              </div>
              <div>
                <label>Timeout minutes</label>
                <input style={input} type="number" value={Number(automod.timeoutDurationMinutes || 10)} onChange={(event) => setCfg((prev: Record<string, any>) => ({ ...prev, automod: { ...(prev.automod || {}), timeoutDurationMinutes: Number(event.target.value || 0) } }))} />
              </div>
              <div>
                <label>Mute minutes</label>
                <input style={input} type="number" value={Number(automod.muteDurationMinutes || 10)} onChange={(event) => setCfg((prev: Record<string, any>) => ({ ...prev, automod: { ...(prev.automod || {}), muteDurationMinutes: Number(event.target.value || 0) } }))} />
              </div>
              <label><input type="checkbox" checked={Boolean(automod.kickDeleteRecentMessages)} onChange={(event) => setCfg((prev: Record<string, any>) => ({ ...prev, automod: { ...(prev.automod || {}), kickDeleteRecentMessages: event.target.checked } }))} /> Kick also purge recent messages</label>
              <div>
                <label>Kick purge days</label>
                <input style={input} type="number" min={0} max={7} value={Number(automod.kickDeleteRecentMessageDays || 7)} onChange={(event) => setCfg((prev: Record<string, any>) => ({ ...prev, automod: { ...(prev.automod || {}), kickDeleteRecentMessageDays: Number(event.target.value || 0) } }))} />
              </div>
              <label><input type="checkbox" checked={Boolean(automod.banDeleteRecentMessages)} onChange={(event) => setCfg((prev: Record<string, any>) => ({ ...prev, automod: { ...(prev.automod || {}), banDeleteRecentMessages: event.target.checked } }))} /> Ban also purge recent messages</label>
              <div>
                <label>Ban purge days</label>
                <input style={input} type="number" min={0} max={7} value={Number(automod.banDeleteRecentMessageDays || 7)} onChange={(event) => setCfg((prev: Record<string, any>) => ({ ...prev, automod: { ...(prev.automod || {}), banDeleteRecentMessageDays: Number(event.target.value || 0) } }))} />
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 10 }}>
              <div>
                <label>Blocked words</label>
                <textarea style={{ ...input, minHeight: 120 }} value={Array.isArray(automod.blockedWords) ? automod.blockedWords.join("\n") : ""} onChange={(event) => setCfg((prev: Record<string, any>) => ({ ...prev, automod: { ...(prev.automod || {}), blockedWords: event.target.value.split(/\r?\n+/).map((value) => value.trim()).filter(Boolean) } }))} />
              </div>
              <div>
                <label>Warning message</label>
                <textarea style={{ ...input, minHeight: 120 }} value={String(automod.warningMessage || "")} onChange={(event) => setCfg((prev: Record<string, any>) => ({ ...prev, automod: { ...(prev.automod || {}), warningMessage: event.target.value } }))} />
              </div>
            </div>
            <div style={{ marginTop: 12 }}>
              <div style={{ color: "#ffbcbc", fontWeight: 800, marginBottom: 8 }}>Per-rule responses</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))", gap: 12 }}>
                {automodNoticeRules.map(([ruleKey, label]) => {
                  const modeKey = `${ruleKey}NoticeMode`;
                  const messageKey = `${ruleKey}NoticeMessage`;
                  const modeValue = String(automod[modeKey] || "");
                  const normalizedMode = modeValue === "dm" ? "DM" : modeValue === "reply" ? "Reply In Channel" : modeValue === "both" ? "Both" : "Disabled";
                  return (
                    <div key={`policy_notice_${ruleKey}`} style={{ border: "1px solid #4f0000", borderRadius: 10, padding: 12, background: "#110000" }}>
                      <div style={{ color: "#ffdcdc", fontWeight: 800, marginBottom: 8 }}>{label}</div>
                      <div>
                        <label>Response mode</label>
                        <select
                          style={input}
                          value={normalizedMode}
                          onChange={(event) => setCfg((prev: Record<string, any>) => {
                            const nextMode = event.target.value === "DM" ? "dm" : event.target.value === "Reply In Channel" ? "reply" : event.target.value === "Both" ? "both" : "disabled";
                            return { ...prev, automod: { ...(prev.automod || {}), [modeKey]: nextMode } };
                          })}
                        >
                          {noticeModes.map((mode) => <option key={`${ruleKey}_${mode}`} value={mode}>{mode}</option>)}
                        </select>
                      </div>
                      <div style={{ marginTop: 8 }}>
                        <label>Response message</label>
                        <textarea
                          style={{ ...input, minHeight: 92 }}
                          value={String(automod[messageKey] || "")}
                          onChange={(event) => setCfg((prev: Record<string, any>) => ({ ...prev, automod: { ...(prev.automod || {}), [messageKey]: event.target.value } }))}
                          placeholder="Leave blank to use the global warning message."
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            <div style={{ marginTop: 12 }}>
              <div style={{ color: "#ffbcbc", fontWeight: 800, marginBottom: 8 }}>Scoped link allowances</div>
              <div style={{ color: "#ffbcbc", marginBottom: 10 }}>
                Allow trusted domains like `twitch.tv` only in chosen channels or categories without opening the rest of the server.
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))", gap: 12 }}>
                <div>
                  <label>Allowed external link domains</label>
                  <textarea
                    style={{ ...input, minHeight: 120 }}
                    value={Array.isArray(automod.allowedLinkDomains) ? automod.allowedLinkDomains.join("\n") : ""}
                    onChange={(event) => setCfg((prev: Record<string, any>) => ({ ...prev, automod: { ...(prev.automod || {}), allowedLinkDomains: parseDomainList(event.target.value) } }))}
                    placeholder={"twitch.tv\nyoutube.com\nyoutu.be"}
                  />
                </div>
                <div>
                  <label>Channels where trusted domains are allowed</label>
                  <div style={{ maxHeight: 180, overflowY: "auto", border: "1px solid #4f0000", borderRadius: 10, padding: 10, background: "#110000" }}>
                    {textChannels.map((channel) => (
                      <label key={`allowed_domain_channel_${channel.id}`} style={{ display: "block", marginBottom: 6 }}>
                        <input
                          type="checkbox"
                          checked={Array.isArray(automod.allowedLinkChannelIds) && automod.allowedLinkChannelIds.includes(channel.id)}
                          onChange={() => setCfg((prev: Record<string, any>) => ({
                            ...prev,
                            automod: {
                              ...(prev.automod || {}),
                              allowedLinkChannelIds: toggleId(Array.isArray(prev.automod?.allowedLinkChannelIds) ? prev.automod.allowedLinkChannelIds : [], channel.id),
                            },
                          }))}
                        />{" "}
                        #{channel.name}
                      </label>
                    ))}
                  </div>
                </div>
                <div>
                  <label>Categories where trusted domains are allowed</label>
                  <div style={{ maxHeight: 180, overflowY: "auto", border: "1px solid #4f0000", borderRadius: 10, padding: 10, background: "#110000" }}>
                    {categories.length ? categories.map((channel) => (
                      <label key={`allowed_domain_category_${channel.id}`} style={{ display: "block", marginBottom: 6 }}>
                        <input
                          type="checkbox"
                          checked={Array.isArray(automod.allowedLinkCategoryIds) && automod.allowedLinkCategoryIds.includes(channel.id)}
                          onChange={() => setCfg((prev: Record<string, any>) => ({
                            ...prev,
                            automod: {
                              ...(prev.automod || {}),
                              allowedLinkCategoryIds: toggleId(Array.isArray(prev.automod?.allowedLinkCategoryIds) ? prev.automod.allowedLinkCategoryIds : [], channel.id),
                            },
                          }))}
                        />{" "}
                        {channel.name}
                      </label>
                    )) : <div style={{ color: "#ffbcbc" }}>No categories found.</div>}
                  </div>
                </div>
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))", gap: 12, marginTop: 12 }}>
              <div>
                <label>Exempt channels</label>
                <div style={{ maxHeight: 180, overflowY: "auto", border: "1px solid #4f0000", borderRadius: 10, padding: 10, background: "#110000" }}>
                  {textChannels.map((channel) => (
                    <label key={`policy_exempt_${channel.id}`} style={{ display: "block", marginBottom: 6 }}>
                      <input
                        type="checkbox"
                        checked={Array.isArray(automod.exemptChannelIds) && automod.exemptChannelIds.includes(channel.id)}
                        onChange={() => setCfg((prev: Record<string, any>) => ({
                          ...prev,
                          automod: {
                            ...(prev.automod || {}),
                            exemptChannelIds: toggleId(Array.isArray(prev.automod?.exemptChannelIds) ? prev.automod.exemptChannelIds : [], channel.id),
                          },
                        }))}
                      />{" "}
                      #{channel.name}
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <label>Exempt categories</label>
                <div style={{ maxHeight: 180, overflowY: "auto", border: "1px solid #4f0000", borderRadius: 10, padding: 10, background: "#110000" }}>
                  {categories.length ? categories.map((channel) => (
                    <label key={`policy_exempt_category_${channel.id}`} style={{ display: "block", marginBottom: 6 }}>
                      <input
                        type="checkbox"
                        checked={Array.isArray(automod.exemptCategoryIds) && automod.exemptCategoryIds.includes(channel.id)}
                        onChange={() => setCfg((prev: Record<string, any>) => ({
                          ...prev,
                          automod: {
                            ...(prev.automod || {}),
                            exemptCategoryIds: toggleId(Array.isArray(prev.automod?.exemptCategoryIds) ? prev.automod.exemptCategoryIds : [], channel.id),
                          },
                        }))}
                      />{" "}
                      {channel.name}
                    </label>
                  )) : <div style={{ color: "#ffbcbc" }}>No categories found.</div>}
                </div>
              </div>
            </div>
            <div style={{ marginTop: 12 }}>
              <RoleChips
                label="Automod exempt roles"
                roles={roles}
                selected={Array.isArray(automod.exemptRoleIds) ? automod.exemptRoleIds : []}
                onToggle={(roleId) => setCfg((prev: Record<string, any>) => ({
                  ...prev,
                  automod: {
                    ...(prev.automod || {}),
                    exemptRoleIds: toggleId(Array.isArray(prev.automod?.exemptRoleIds) ? prev.automod.exemptRoleIds : [], roleId),
                  },
                }))}
              />
            </div>
            <div style={{ marginTop: 12 }}>
              <div style={{ color: "#ffbcbc", fontWeight: 800, marginBottom: 8 }}>Per-rule exemptions</div>
              <div style={{ color: "#ffbcbc", marginBottom: 10 }}>
                Give each automod rule its own exempt roles, channels, and categories so self-promo, media, and VIP spaces can be tuned without weakening the whole policy.
              </div>
              <div style={{ display: "grid", gap: 12 }}>
                {automodNoticeRules.map(([ruleKey, label]) => {
                  const channelKey = `${ruleKey}ExemptChannelIds`;
                  const categoryKey = `${ruleKey}ExemptCategoryIds`;
                  const roleKey = `${ruleKey}ExemptRoleIds`;
                  const selectedChannels = Array.isArray(automod[channelKey]) ? automod[channelKey] : [];
                  const selectedCategories = Array.isArray(automod[categoryKey]) ? automod[categoryKey] : [];
                  const selectedRoles = Array.isArray(automod[roleKey]) ? automod[roleKey] : [];
                  return (
                    <details key={`policy_scope_${ruleKey}`} style={{ border: "1px solid #4f0000", borderRadius: 10, padding: 12, background: "#110000" }}>
                      <summary style={{ cursor: "pointer", color: "#ffdcdc", fontWeight: 800 }}>{label}</summary>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))", gap: 12, marginTop: 12 }}>
                        <div>
                          <div style={{ color: "#ffbcbc", fontWeight: 700, marginBottom: 8 }}>Exempt channels</div>
                          <div style={{ maxHeight: 200, overflowY: "auto", border: "1px solid #4f0000", borderRadius: 10, padding: 10, background: "#170000" }}>
                            {textChannels.map((channel) => (
                              <label key={`${ruleKey}_channel_${channel.id}`} style={{ display: "block", marginBottom: 6 }}>
                                <input
                                  type="checkbox"
                                  checked={selectedChannels.includes(channel.id)}
                                  onChange={() => setCfg((prev: Record<string, any>) => ({
                                    ...prev,
                                    automod: {
                                      ...(prev.automod || {}),
                                      [channelKey]: toggleId(Array.isArray(prev.automod?.[channelKey]) ? prev.automod[channelKey] : [], channel.id),
                                    },
                                  }))}
                                />{" "}
                                #{channel.name}
                              </label>
                            ))}
                          </div>
                        </div>
                        <div>
                          <div style={{ color: "#ffbcbc", fontWeight: 700, marginBottom: 8 }}>Exempt categories</div>
                          <div style={{ maxHeight: 200, overflowY: "auto", border: "1px solid #4f0000", borderRadius: 10, padding: 10, background: "#170000" }}>
                            {categories.length ? categories.map((channel) => (
                              <label key={`${ruleKey}_category_${channel.id}`} style={{ display: "block", marginBottom: 6 }}>
                                <input
                                  type="checkbox"
                                  checked={selectedCategories.includes(channel.id)}
                                  onChange={() => setCfg((prev: Record<string, any>) => ({
                                    ...prev,
                                    automod: {
                                      ...(prev.automod || {}),
                                      [categoryKey]: toggleId(Array.isArray(prev.automod?.[categoryKey]) ? prev.automod[categoryKey] : [], channel.id),
                                    },
                                  }))}
                                />{" "}
                                {channel.name}
                              </label>
                            )) : <div style={{ color: "#ffbcbc" }}>No categories found.</div>}
                          </div>
                        </div>
                        <div>
                          <div style={{ color: "#ffbcbc", fontWeight: 700, marginBottom: 8 }}>Exempt roles</div>
                          <div style={{ maxHeight: 200, overflowY: "auto", border: "1px solid #4f0000", borderRadius: 10, padding: 10, background: "#170000" }}>
                            {roles.map((role) => (
                              <label key={`${ruleKey}_role_${role.id}`} style={{ display: "block", marginBottom: 6 }}>
                                <input
                                  type="checkbox"
                                  checked={selectedRoles.includes(role.id)}
                                  onChange={() => setCfg((prev: Record<string, any>) => ({
                                    ...prev,
                                    automod: {
                                      ...(prev.automod || {}),
                                      [roleKey]: toggleId(Array.isArray(prev.automod?.[roleKey]) ? prev.automod[roleKey] : [], role.id),
                                    },
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
          </div>

          <div style={box}>
            <h3 style={{ marginTop: 0, color: "#ff4444" }}>Logging Events</h3>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4,minmax(180px,1fr))", gap: 10 }}>
              {[
                ["messageDeleted", "Message deleted"],
                ["messageUpdated", "Message updated"],
                ["memberJoined", "Member joined"],
                ["memberLeft", "Member left"],
                ["memberRoleChanged", "Member role changed"],
                ["moderationBan", "Moderation ban"],
                ["moderationWarn", "Moderation warn"],
                ["invitePosted", "Invite posted"],
                ["channelCreated", "Channel created"],
                ["channelUpdated", "Channel updated"],
                ["channelDeleted", "Channel deleted"],
                ["serverUpdated", "Server updated"],
              ].map(([key, label]) => (
                <label key={key}><input type="checkbox" checked={Boolean(logging[key])} onChange={(event) => setCfg((prev: Record<string, any>) => ({ ...prev, logging: { ...(prev.logging || {}), [key]: event.target.checked } }))} /> {label}</label>
              ))}
            </div>
          </div>

          <div style={box}>
            <button onClick={() => void save()} disabled={saving} style={action}>
              {saving ? "Saving..." : "Save Live Policy"}
            </button>
          </div>
        </>
      ) : null}
    </div>
  );
}
