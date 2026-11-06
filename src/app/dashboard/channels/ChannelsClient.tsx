"use client";

import { useEffect, useMemo, useState } from "react";
import { fetchGuildData } from "@/lib/liveRuntime";

type GuildChannel = { id: string; name: string; type?: number | string };

type Field = {
  key: string;
  label: string;
  type: "text" | "voice" | "category" | "text-multi" | "category-multi";
};

type Section = {
  key: string;
  label: string;
  engine: string;
  fields: Field[];
  supportsPanels?: boolean;
  note?: string;
};

const SAVIORS_GUILD_ID = "1431799056211906582";

const SECTIONS: Section[] = [
  {
    key: "preOnboarding",
    label: "Pre-Onboarding",
    engine: "preOnboarding",
    fields: [
      { key: "enforcementChannelId", label: "Enforcement Log Channel", type: "text" },
    ],
    note: "This is the hard gate before verification. Use the Pre-Onboarding page for blacklist/refusal policy and kick-vs-ban behavior.",
  },
  {
    key: "tickets",
    label: "Tickets",
    engine: "tickets",
    fields: [
      { key: "panelChannelId", label: "Panel Channel", type: "text" },
      { key: "openCategoryId", label: "Open Category", type: "category" },
      { key: "closedCategoryId", label: "Closed Category", type: "category" },
      { key: "types.support.openCategoryId", label: "Support Open Category", type: "category" },
      { key: "types.support.closedCategoryId", label: "Support Closed Category", type: "category" },
      { key: "types.vip.openCategoryId", label: "VIP Open Category", type: "category" },
      { key: "types.vip.closedCategoryId", label: "VIP Closed Category", type: "category" },
      { key: "types.drops.openCategoryId", label: "Drops Open Category", type: "category" },
      { key: "types.drops.closedCategoryId", label: "Drops Closed Category", type: "category" },
    ],
    note: "Set the ticket panel and the open/closed categories only. Transcript routing falls back automatically and does not need its own channel slot here.",
  },
  {
    key: "onboarding",
    label: "Onboarding",
    engine: "onboarding",
    fields: [
      { key: "idChannelId", label: "ID Channel", type: "text" },
      { key: "ticketCategoryId", label: "Ticket Category", type: "category" },
      { key: "transcriptChannelId", label: "Transcript Channel", type: "text" },
      { key: "logChannelId", label: "Log Channel", type: "text" },
      { key: "hostingLegacyChannelId", label: "Hosting Legacy Channel", type: "text" },
      { key: "hostingEnhancedChannelId", label: "Hosting Enhanced Channel", type: "text" },
      { key: "staffIntroChannelId", label: "Staff Intro Channel", type: "text" },
      { key: "selfRolesChannelId", label: "Self Roles Channel", type: "text" },
      { key: "botGuideChannelId", label: "Bot Guide Channel", type: "text" },
      { key: "updatesChannelId", label: "Updates Channel", type: "text" },
      { key: "funChannelId", label: "Fun Channel", type: "text" },
      { key: "funCategoryId", label: "Fun Category", type: "category" },
      { key: "subscriptionChannelId", label: "Subscription Channel", type: "text" },
    ],
    note: "Onboarding is the optional ID/ticket step after verification plus the post-verified handoff channels.",
  },
  {
    key: "verification",
    label: "Verification",
    engine: "verification",
    fields: [
      { key: "welcomeChannelId", label: "Welcome Channel", type: "text" },
      { key: "mainChatChannelId", label: "Main Chat Channel", type: "text" },
      { key: "rulesChannelId", label: "Rules Channel", type: "text" },
    ],
    note: "Verification owns the welcome intro, rules surface, and the verified-role handoff before onboarding ever begins.",
  },
  {
    key: "selfroles",
    label: "Selfroles",
    engine: "selfroles",
    fields: [
      { key: "logChannelId", label: "Log Channel", type: "text" },
    ],
    supportsPanels: true,
  },
  {
    key: "progression",
    label: "Progression + Achievements",
    engine: "progression",
    fields: [
      { key: "levelUp.announceChannelId", label: "Level Up Channel", type: "text" },
      { key: "achievements.announceChannelId", label: "Achievement Channel", type: "text" },
      { key: "badges.panelChannelId", label: "Badge Panel Channel", type: "text" },
    ],
  },
  {
    key: "tts",
    label: "TTS",
    engine: "tts",
    fields: [
      { key: "allowedChannelIds", label: "Allowed Channels", type: "text-multi" },
      { key: "blockedChannelIds", label: "Blocked Channels", type: "text-multi" },
      { key: "autoTextChannelId", label: "Auto Text Channel", type: "text" },
      { key: "autoVoiceChannelId", label: "Auto Voice Channel", type: "voice" },
    ],
  },
  {
    key: "heist",
    label: "Heist",
    engine: "heist",
    fields: [
      { key: "signupChannelId", label: "Signup Channel", type: "text" },
      { key: "announceChannelId", label: "Announce Channel", type: "text" },
      { key: "transcriptChannelId", label: "Transcript Channel", type: "text" },
      { key: "voiceChannelId", label: "Voice Channel", type: "voice" },
    ],
  },
  {
    key: "giveaways",
    label: "Giveaways",
    engine: "giveaways",
    fields: [
      { key: "defaultChannelId", label: "Default Channel", type: "text" },
      { key: "channelId", label: "Legacy Channel", type: "text" },
      { key: "ticketChannelId", label: "Ticket Channel", type: "text" },
      { key: "allowedChannelIds", label: "Allowed Channels", type: "text-multi" }
    ],
  },
  {
    key: "store",
    label: "Store",
    engine: "store",
    fields: [
      { key: "panel.channelId", label: "Panel Channel", type: "text" },
      { key: "policies.logChannelId", label: "Log Channel", type: "text" },
    ],
  },
  {
    key: "vip",
    label: "VIP",
    engine: "vip",
    fields: [{ key: "grantLogChannelId", label: "Grant Log Channel", type: "text" }],
  },
  {
    key: "inviteTracker",
    label: "Invite Tracker",
    engine: "inviteTracker",
    fields: [
      { key: "joinLogChannelId", label: "Join Log Channel", type: "text" },
      { key: "leaveLogChannelId", label: "Leave Log Channel", type: "text" },
      { key: "logChannelId", label: "Fallback Log Channel", type: "text" }
    ],
  },
  {
    key: "eventReactor",
    label: "Event Alerts",
    engine: "eventReactor",
    fields: [{ key: "deadLetter.channelId", label: "Failed Jobs Channel", type: "text" }],
  },
  {
    key: "music",
    label: "Music",
    engine: "music",
    fields: [{ key: "panelDeploy.channelId", label: "Panel Channel", type: "text" }],
  },
  {
    key: "crew",
    label: "Crew",
    engine: "crew",
    fields: [{ key: "recruitChannelId", label: "Recruit Channel", type: "text" }],
  },
  {
    key: "dominion",
    label: "Dominion",
    engine: "dominion",
    fields: [{ key: "announceChannelId", label: "Battle Log Channel", type: "text" }],
  },
  {
    key: "prestige",
    label: "Prestige",
    engine: "prestige",
    fields: [{ key: "announceChannelId", label: "Prestige Channel", type: "text" }],
  },
  {
    key: "hallOfFame",
    label: "Hall Of Fame",
    engine: "hallOfFame",
    fields: [
      { key: "primaryChannelId", label: "Hall Of Fame Channel", type: "text" },
      { key: "logChannelId", label: "Log Channel", type: "text" },
    ],
  },
  {
    key: "loyalty",
    label: "Loyalty",
    engine: "loyalty",
    fields: [{ key: "announceChannelId", label: "Announce Channel", type: "text" }],
  },
  {
    key: "catDrop",
    label: "Cat Drop",
    engine: "catDrop",
    fields: [{ key: "channels", label: "Spawn Channels", type: "text-multi" }],
    note: "These are the text channels cat drops can land in. Weight tuning still lives on the Cat Drop page.",
  },
  {
    key: "rareSpawn",
    label: "Rare Spawn",
    engine: "rareSpawn",
    fields: [
      { key: "channels", label: "Spawn Channels", type: "text-multi" },
      { key: "categories", label: "Spawn Categories", type: "category-multi" },
      { key: "logChannelId", label: "Log Channel", type: "text" },
    ],
    note: "Pick the spawn areas and the log destination. The Rare Spawn page still owns reward tuning and timers.",
  },
  {
    key: "range",
    label: "Range",
    engine: "range",
    fields: [{ key: "allowedChannelIds", label: "Allowed Channels", type: "text-multi" }],
  },
  {
    key: "pokemon",
    label: "Pokemon",
    engine: "pokemon",
    fields: [
      { key: "channels", label: "Spawn Channels", type: "text-multi" },
      { key: "catchLogChannelId", label: "Catch Log Channel", type: "text" },
      { key: "battleChannelId", label: "Battle Channel", type: "text" },
      { key: "battleLogChannelId", label: "Battle Log Channel", type: "text" },
      { key: "tradeLogChannelId", label: "Trade Log Channel", type: "text" },
    ],
  },
  {
    key: "channelFlow",
    label: "Channel Flow",
    engine: "channelFlow",
    fields: [
      { key: "rooms.lobbyChannelId", label: "Temp Room Lobby", type: "voice" },
      { key: "rooms.categoryId", label: "Temp Room Category", type: "category" },
    ],
    note: "Counters and room templates stay on the Channel Flow page; this page just handles the routing channels.",
  },
  {
    key: "radio",
    label: "Radio + Birthday",
    engine: "radio",
    fields: [
      { key: "birthday.broadcastChannelId", label: "Birthday Broadcast Channel", type: "text" },
      { key: "radio.announceChannelId", label: "Radio Announce Channel", type: "text" },
    ],
  },
];

const card: React.CSSProperties = {
  border: "1px solid #5f0000",
  borderRadius: 12,
  padding: 14,
  background: "rgba(120,0,0,0.10)",
  marginBottom: 14,
};

const input: React.CSSProperties = {
  width: "100%",
  padding: 10,
  borderRadius: 8,
  border: "1px solid #6f0000",
  background: "#0a0a0a",
  color: "#ffd7d7",
};

function getGuildId(): string {
  if (typeof window === "undefined") return "";
  const q = new URLSearchParams(window.location.search).get("guildId") || "";
  const s = localStorage.getItem("activeGuildId") || "";
  const v = (q || s).trim();
  if (v) localStorage.setItem("activeGuildId", v);
  return v;
}

function readPath(input: any, path: string[]): any {
  let cur = input;
  for (const key of path) {
    if (!cur || typeof cur !== "object") return undefined;
    cur = cur[key];
  }
  return cur;
}

function writePath(input: any, path: string[], value: any) {
  const next = { ...(input || {}) };
  let cur: any = next;
  for (let i = 0; i < path.length - 1; i += 1) {
    const key = path[i];
    if (!cur[key] || typeof cur[key] !== "object") cur[key] = {};
    cur = cur[key];
  }
  cur[path[path.length - 1]] = value;
  return next;
}

function toggleId(list: string[], id: string) {
  const set = new Set(list || []);
  if (set.has(id)) set.delete(id);
  else set.add(id);
  return Array.from(set);
}

function extractIdList(value: any): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => {
      if (typeof entry === "string") return entry.trim();
      if (entry && typeof entry === "object") return String(entry.id || "").trim();
      return "";
    })
    .filter(Boolean);
}

function toggleIdEntries(value: any, id: string) {
  const current = Array.isArray(value) ? value : [];
  const currentIds = new Set(extractIdList(current));
  if (currentIds.has(id)) {
    return current.filter((entry) => {
      if (typeof entry === "string") return entry.trim() !== id;
      if (entry && typeof entry === "object") return String(entry.id || "").trim() !== id;
      return false;
    });
  }
  return [...current, id];
}

async function readEngineConfig(guildId: string, engine: string) {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 30_000);
  try {
    const res = await fetch(
      `/api/bot/engine-config?guildId=${encodeURIComponent(guildId)}&engine=${encodeURIComponent(engine)}`,
      { cache: "no-store", signal: controller.signal }
    );
    let text = "";
    try {
      text = await res.text();
    } catch (error: any) {
      if (error?.name === "AbortError" || /aborted|timed out/i.test(String(error?.message || ""))) {
        throw new Error(`Loading ${engine} channels timed out after 30000ms.`);
      }
      throw error;
    }
    const json = text ? JSON.parse(text) : {};
    if (!res.ok || json?.success === false) {
      throw new Error(json?.error || `Failed to load ${engine} channels.`);
    }
    return json?.config || {};
  } catch (error: any) {
    if (error?.name === "AbortError" || /aborted|timed out/i.test(String(error?.message || ""))) {
      throw new Error(`Loading ${engine} channels timed out after 30000ms.`);
    }
    throw error;
  } finally {
    window.clearTimeout(timeout);
  }
}

export default function ChannelsClient() {
  const [guildId, setGuildId] = useState("");
  const [channels, setChannels] = useState<GuildChannel[]>([]);
  const [configs, setConfigs] = useState<Record<string, any>>({});
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [savingAll, setSavingAll] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => setGuildId(getGuildId()), []);

  async function loadAllConfigs(activeGuildId: string) {
    const gd = await fetchGuildData(activeGuildId);
    setChannels(Array.isArray(gd?.channels) ? gd.channels : []);

    const entries = await Promise.allSettled(
      SECTIONS.map(async (section) => {
        const config = await readEngineConfig(activeGuildId, section.engine);
        return [section.key, config] as const;
      })
    );
    const next: Record<string, any> = {};
    const errors: string[] = [];
    for (const entry of entries) {
      if (entry.status === "fulfilled") {
        const [key, config] = entry.value;
        next[key] = config;
      } else {
        errors.push(entry.reason?.message || "Failed to load one channel section.");
      }
    }
    setConfigs(next);
    if (errors.length) {
      setMsg(errors.join(" | "));
    }
  }

  useEffect(() => {
    if (!guildId) return;
    (async () => {
      setMsg("");
      try {
        await loadAllConfigs(guildId);
      } catch (e: any) {
        setMsg(e?.message || "Failed to load channel setup.");
      }
    })();
  }, [guildId]);

  const textChannels = useMemo(
    () => channels.filter((c) => Number(c?.type) === 0 || Number(c?.type) === 5 || String(c?.type || "").toLowerCase().includes("text")),
    [channels]
  );
  const voiceChannels = useMemo(
    () => channels.filter((c) => Number(c?.type) === 2 || Number(c?.type) === 13 || String(c?.type || "").toLowerCase().includes("voice")),
    [channels]
  );
  const categoryChannels = useMemo(
    () => channels.filter((c) => Number(c?.type) === 4 || String(c?.type || "").toLowerCase().includes("category")),
    [channels]
  );
  const isSaviorsGuild = guildId === SAVIORS_GUILD_ID;

  function getOptions(field: Field) {
    if (field.type === "voice") return voiceChannels;
    if (field.type === "category" || field.type === "category-multi") return categoryChannels;
    return textChannels;
  }

  async function saveSection(section: Section) {
    if (!guildId) return;
    setSaving((prev) => ({ ...prev, [section.key]: true }));
    setMsg("");
    try {
      const res = await fetch("/api/bot/engine-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          guildId,
          engine: section.engine,
          config: configs[section.key] || {},
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json?.success === false) throw new Error(json?.error || "Save failed");
      await loadAllConfigs(guildId);
      setMsg(`${section.label} channels saved.`);
    } catch (e: any) {
      setMsg(e?.message || "Save failed.");
    } finally {
      setSaving((prev) => ({ ...prev, [section.key]: false }));
    }
  }

  async function saveAllSections() {
    if (!guildId || savingAll) return;
    setSavingAll(true);
    setMsg("");
    try {
      for (const section of SECTIONS) {
        const res = await fetch("/api/bot/engine-config", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            guildId,
            engine: section.engine,
            config: configs[section.key] || {},
          }),
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok || json?.success === false) {
          throw new Error(json?.error || `Failed to save ${section.label}.`);
        }
      }
      await loadAllConfigs(guildId);
      setMsg("All channel sections saved.");
    } catch (e: any) {
      setMsg(e?.message || "Failed to save all channels.");
    } finally {
      setSavingAll(false);
    }
  }

  function updateField(sectionKey: string, field: Field, value: any) {
    setConfigs((prev) => {
      const current = prev[sectionKey] || {};
      const path = field.key.split(".");
      const next = writePath(current, path, value);
      return { ...prev, [sectionKey]: next };
    });
  }

  function updatePanelChannel(sectionKey: string, index: number, channelId: string) {
    setConfigs((prev) => {
      const current = { ...(prev[sectionKey] || {}) };
      const panels = Array.isArray(current.panels) ? [...current.panels] : [];
      if (!panels[index]) return prev;
      panels[index] = { ...panels[index], channelId };
      return { ...prev, [sectionKey]: { ...current, panels } };
    });
  }

  function updateRoute(sectionKey: string, index: number, patch: Record<string, any>) {
    setConfigs((prev) => {
      const current = { ...(prev[sectionKey] || {}) };
      const routes = Array.isArray(current.routes) ? [...current.routes] : [];
      if (!routes[index]) return prev;
      routes[index] = { ...routes[index], ...patch };
      return { ...prev, [sectionKey]: { ...current, routes } };
    });
  }

  function updateCustomRoute(sectionKey: string, index: number, patch: Record<string, any>) {
    setConfigs((prev) => {
      const current = { ...(prev[sectionKey] || {}) };
      const routes = Array.isArray(current.customRoutes) ? [...current.customRoutes] : [];
      if (!routes[index]) return prev;
      routes[index] = { ...routes[index], ...patch };
      return { ...prev, [sectionKey]: { ...current, customRoutes: routes } };
    });
  }

  function toggleRouteList(sectionKey: string, index: number, fieldKey: string, channelId: string) {
    const current = configs[sectionKey] || {};
    const routes = Array.isArray(current.routes) ? current.routes : [];
    const route = routes[index] || {};
    const list = Array.isArray(route[fieldKey]) ? route[fieldKey] : [];
    const next = toggleId(list, channelId);
    updateRoute(sectionKey, index, { [fieldKey]: next });
  }

  if (!guildId) return <div style={{ color: "#ff8a8a", padding: 20 }}>Missing guildId. Open from /guilds.</div>;

  return (
    <div style={{ color: "#ffb3b3", padding: 14, maxWidth: 1300 }}>
      <h1 style={{ marginTop: 0, color: "#ff3b3b", letterSpacing: "0.08em", textTransform: "uppercase" }}>Channel Setup</h1>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
        <div>
          <p style={{ marginTop: 0, marginBottom: 6 }}>Guild: {typeof window !== "undefined" ? (localStorage.getItem("activeGuildName") || guildId) : guildId}</p>
          <div style={{ color: "#ffb7b7", fontSize: 13, lineHeight: 1.6, maxWidth: 920 }}>
            Pick where each system should post. For Saviors Gaming, blank legacy slots are auto-filled from the bot&apos;s built-in server defaults so you do not have to hunt IDs down by hand.
          </div>
        </div>
        <button
          onClick={() => void saveAllSections()}
          disabled={savingAll}
          style={{ ...input, width: "auto", cursor: "pointer", fontWeight: 900 }}
        >
          {savingAll ? "Saving Everything..." : isSaviorsGuild ? "Save All Saviors Channels" : "Save All Channels"}
        </button>
      </div>
      {msg ? <div style={{ color: "#ffb3f0", marginBottom: 12 }}>{msg}</div> : null}

      {SECTIONS.map((section) => {
        const cfg = configs[section.key] || {};
        return (
          <section key={section.key} style={card}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
              <div>
                <div style={{ color: "#ff6b6b", fontWeight: 900, textTransform: "uppercase", letterSpacing: "0.08em" }}>{section.label}</div>
                <div style={{ color: "#ffb7b7", fontSize: 12 }}>
                  {section.note || "Set the channel routing for this engine."}
                </div>
              </div>
              <button
                onClick={() => saveSection(section)}
                disabled={!!saving[section.key]}
                style={{ ...input, width: "auto", cursor: "pointer", fontWeight: 900 }}
              >
                {saving[section.key] ? "Saving..." : "Save Channels"}
              </button>
            </div>

            {section.fields.length ? (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10, marginTop: 12 }}>
                {section.fields.map((field) => {
                  const value = readPath(cfg, field.key.split("."));
                  if (field.type === "text-multi" || field.type === "category-multi") {
                    const list = extractIdList(value);
                    const options = getOptions(field);
                    return (
                      <div key={field.key}>
                        <label>{field.label}</label>
                        <div style={{ maxHeight: 180, overflowY: "auto", border: "1px solid #5a0000", borderRadius: 8, padding: 8 }}>
                          {options.map((c) => (
                            <label key={`${field.key}-${c.id}`} style={{ display: "block", marginBottom: 4 }}>
                              <input
                                type="checkbox"
                                checked={list.includes(c.id)}
                                onChange={() => updateField(section.key, field, toggleIdEntries(value, c.id))}
                              />{" "}
                              {field.type === "category-multi" ? c.name : `#${c.name}`}
                            </label>
                          ))}
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div key={field.key}>
                      <label>{field.label}</label>
                      <select
                        style={input}
                        value={value || ""}
                        onChange={(e) => updateField(section.key, field, e.target.value)}
                      >
                        <option value="">Select channel</option>
                        {getOptions(field).map((c) => (
                          <option key={c.id} value={c.id}>
                            {field.type === "voice" ? c.name : field.type === "category" ? c.name : `#${c.name}`}
                          </option>
                        ))}
                      </select>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div style={{ marginTop: 12, color: "#ffb7b7", fontSize: 13 }}>
                No direct channel fields live on this engine config.
              </div>
            )}

            {section.supportsPanels && Array.isArray(cfg.panels) ? (
              <div style={{ marginTop: 12 }}>
                <div style={{ color: "#ff9a9a", fontSize: 12, letterSpacing: "0.18em", textTransform: "uppercase" }}>Panel Channels</div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10, marginTop: 8 }}>
                  {cfg.panels.map((panel: any, index: number) => (
                    <div key={`panel-${index}`}>
                      <label>{panel?.messageTitle || `Panel ${index + 1}`}</label>
                      <select
                        style={input}
                        value={panel?.channelId || ""}
                        onChange={(e) => updatePanelChannel(section.key, index, e.target.value)}
                      >
                        <option value="">Select channel</option>
                        {textChannels.map((c) => (
                          <option key={c.id} value={c.id}>
                            #{c.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {section.key === "tts" && Array.isArray(cfg.routes) && cfg.routes.length ? (
              <div style={{ marginTop: 12 }}>
                <div style={{ color: "#ff9a9a", fontSize: 12, letterSpacing: "0.18em", textTransform: "uppercase" }}>TTS Route Channels</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 10, marginTop: 8 }}>
                  {cfg.routes.map((route: any, index: number) => {
                    const sourceIds = Array.isArray(route?.sourceChannelIds)
                      ? route.sourceChannelIds
                      : route?.sourceChannelId
                        ? [route.sourceChannelId]
                        : [];
                    return (
                      <div key={`tts-route-${index}`} style={{ border: "1px solid #4b0000", borderRadius: 10, padding: 10 }}>
                        <div style={{ fontWeight: 800, color: "#ffbdbd", marginBottom: 6 }}>{route?.name || `Route ${index + 1}`}</div>
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10 }}>
                          <div>
                            <label>Voice Channel</label>
                            <select
                              style={input}
                              value={route?.voiceChannelId || ""}
                              onChange={(e) => updateRoute(section.key, index, { voiceChannelId: e.target.value })}
                            >
                              <option value="">Select voice channel</option>
                              {voiceChannels.map((c) => (
                                <option key={c.id} value={c.id}>{c.name}</option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label>Source Text Channels</label>
                            <div style={{ maxHeight: 160, overflowY: "auto", border: "1px solid #5a0000", borderRadius: 8, padding: 8 }}>
                              {textChannels.map((c) => (
                                <label key={`tts-src-${index}-${c.id}`} style={{ display: "block", marginBottom: 4 }}>
                                  <input
                                    type="checkbox"
                                    checked={sourceIds.includes(c.id)}
                                    onChange={() => {
                                      const next = toggleId(sourceIds, c.id);
                                      updateRoute(section.key, index, { sourceChannelIds: next, sourceChannelId: next[0] || "" });
                                    }}
                                  />{" "}
                                  #{c.name}
                                </label>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : null}

            {section.key === "music" && Array.isArray(cfg.routes) && cfg.routes.length ? (
              <div style={{ marginTop: 12 }}>
                <div style={{ color: "#ff9a9a", fontSize: 12, letterSpacing: "0.18em", textTransform: "uppercase" }}>Music Route Channels</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 10, marginTop: 8 }}>
                  {cfg.routes.map((route: any, index: number) => {
                    const sourceIds = Array.isArray(route?.sourceTextChannelIds) ? route.sourceTextChannelIds : [];
                    return (
                      <div key={`music-route-${index}`} style={{ border: "1px solid #4b0000", borderRadius: 10, padding: 10 }}>
                        <div style={{ fontWeight: 800, color: "#ffbdbd", marginBottom: 6 }}>{route?.name || `Route ${index + 1}`}</div>
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10 }}>
                          <div>
                            <label>Target Voice Channel</label>
                            <select
                              style={input}
                              value={route?.targetVoiceChannelId || ""}
                              onChange={(e) => updateRoute(section.key, index, { targetVoiceChannelId: e.target.value })}
                            >
                              <option value="">Select voice channel</option>
                              {voiceChannels.map((c) => (
                                <option key={c.id} value={c.id}>{c.name}</option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label>Control Text Channel</label>
                            <select
                              style={input}
                              value={route?.controlTextChannelId || ""}
                              onChange={(e) => updateRoute(section.key, index, { controlTextChannelId: e.target.value })}
                            >
                              <option value="">Select channel</option>
                              {textChannels.map((c) => (
                                <option key={c.id} value={c.id}>#{c.name}</option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label>Source Text Channels</label>
                            <div style={{ maxHeight: 160, overflowY: "auto", border: "1px solid #5a0000", borderRadius: 8, padding: 8 }}>
                              {textChannels.map((c) => (
                                <label key={`music-src-${index}-${c.id}`} style={{ display: "block", marginBottom: 4 }}>
                                  <input
                                    type="checkbox"
                                    checked={sourceIds.includes(c.id)}
                                    onChange={() => toggleRouteList(section.key, index, "sourceTextChannelIds", c.id)}
                                  />{" "}
                                  #{c.name}
                                </label>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : null}

            {section.key === "eventReactor" && Array.isArray(cfg.customRoutes) && cfg.customRoutes.length ? (
              <div style={{ marginTop: 12 }}>
                <div style={{ color: "#ff9a9a", fontSize: 12, letterSpacing: "0.18em", textTransform: "uppercase" }}>Event Reactor Routes</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 10, marginTop: 8 }}>
                  {cfg.customRoutes.map((route: any, index: number) => (
                    <div key={`event-route-${index}`} style={{ border: "1px solid #4b0000", borderRadius: 10, padding: 10 }}>
                      <div style={{ fontWeight: 800, color: "#ffbdbd", marginBottom: 4 }}>{route?.name || route?.event || `Route ${index + 1}`}</div>
                      <div style={{ color: "#ff9f9f", fontSize: 12, marginBottom: 8 }}>Event: {route?.event || "unknown"}</div>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10 }}>
                        <div>
                          <label>Target Channel</label>
                          <select
                            style={input}
                            value={route?.channelId || ""}
                            onChange={(e) => updateCustomRoute(section.key, index, { channelId: e.target.value })}
                          >
                            <option value="">Select channel</option>
                            {textChannels.map((c) => (
                              <option key={c.id} value={c.id}>#{c.name}</option>
                            ))}
                          </select>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <label style={{ marginTop: 18 }}>
                            <input
                              type="checkbox"
                              checked={route?.enabled !== false}
                              onChange={(e) => updateCustomRoute(section.key, index, { enabled: e.target.checked })}
                            />{" "}
                            Route Enabled
                          </label>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </section>
        );
      })}
    </div>
  );
}
