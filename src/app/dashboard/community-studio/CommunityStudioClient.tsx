/* eslint-disable @next/next/no-img-element */
"use client";

import { useMemo, useState } from "react";
import ConfigJsonEditor from "@/components/possum/ConfigJsonEditor";
import EngineInsights from "@/components/possum/EngineInsights";
import { useGuildEngineEditor } from "@/components/possum/useGuildEngineEditor";

type Channel = { id: string; name: string; type?: number | string };
type Role = { id: string; name: string };

type StudioImage = { url: string; label?: string };
type Bulletin = {
  id: string;
  enabled: boolean;
  name: string;
  channelId: string;
  title: string;
  body: string;
  footer: string;
  color: string;
  imageUrl: string;
  thumbnailUrl: string;
  mentionRoleId: string;
  pingEveryone: boolean;
};
type PollOption = { id: string; label: string; emoji: string };
type Poll = {
  id: string;
  enabled: boolean;
  name: string;
  channelId: string;
  question: string;
  description: string;
  color: string;
  imageUrl: string;
  multiVote: boolean;
  closeAfterHours: number;
  options: PollOption[];
};
type Reminder = {
  id: string;
  enabled: boolean;
  name: string;
  channelId: string;
  title: string;
  message: string;
  color: string;
  imageUrl: string;
  timezone: string;
  scheduleType: "hourly" | "daily" | "weekly" | "monthly";
  minute: number;
  hour: number;
  dayOfWeek: number;
  dayOfMonth: number;
};
type LookupEntry = {
  id: string;
  enabled: boolean;
  key: string;
  aliases: string[];
  title: string;
  body: string;
  url: string;
  color: string;
  imageUrl: string;
};

type CommunityStudioConfig = {
  active: boolean;
  styleName: string;
  imageLibrary: StudioImage[];
  bulletinsEnabled: boolean;
  pollsEnabled: boolean;
  remindersEnabled: boolean;
  bulletins: Bulletin[];
  polls: Poll[];
  reminders: Reminder[];
  lookup: { enabled: boolean; prefix: string };
  lookupEntries: LookupEntry[];
  notes: string;
};

const DEFAULT_CONFIG: CommunityStudioConfig = {
  active: false,
  styleName: "Operator Canvas",
  imageLibrary: [],
  bulletinsEnabled: true,
  pollsEnabled: true,
  remindersEnabled: true,
  bulletins: [],
  polls: [],
  reminders: [],
  lookup: { enabled: true, prefix: "?lookup" },
  lookupEntries: [],
  notes: "",
};

const shell: React.CSSProperties = { color: "#ffd0d0", padding: 18, maxWidth: 1380 };
const card: React.CSSProperties = { border: "1px solid #6a0000", borderRadius: 12, background: "rgba(120,0,0,0.10)", padding: 14, marginBottom: 12 };
const input: React.CSSProperties = { width: "100%", padding: "10px 12px", background: "#0b0b0b", color: "#ffd8d8", border: "1px solid #7a0000", borderRadius: 8 };
const button: React.CSSProperties = { ...input, width: "auto", cursor: "pointer", fontWeight: 800 };
const micro: React.CSSProperties = { fontSize: 12, color: "#ffb2b2", lineHeight: 1.6 };

function makeId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function safePreviewUrl(value: unknown) {
  const text = String(value || "").trim();
  return /^https?:\/\//i.test(text) ? text : "";
}

function createBulletin(): Bulletin {
  return {
    id: makeId("bulletin"),
    enabled: true,
    name: "New Bulletin",
    channelId: "",
    title: "",
    body: "",
    footer: "",
    color: "#ff5a5a",
    imageUrl: "",
    thumbnailUrl: "",
    mentionRoleId: "",
    pingEveryone: false,
  };
}

function createPoll(): Poll {
  return {
    id: makeId("poll"),
    enabled: true,
    name: "New Poll",
    channelId: "",
    question: "",
    description: "",
    color: "#ff7a4f",
    imageUrl: "",
    multiVote: false,
    closeAfterHours: 24,
    options: [
      { id: "option_1", label: "Option 1", emoji: "" },
      { id: "option_2", label: "Option 2", emoji: "" },
    ],
  };
}

function createReminder(): Reminder {
  return {
    id: makeId("reminder"),
    enabled: true,
    name: "New Reminder",
    channelId: "",
    title: "",
    message: "",
    color: "#ffad66",
    imageUrl: "",
    timezone: "America/Los_Angeles",
    scheduleType: "daily",
    minute: 0,
    hour: 9,
    dayOfWeek: 1,
    dayOfMonth: 1,
  };
}

function createLookupEntry(): LookupEntry {
  return {
    id: makeId("lookup"),
    enabled: true,
    key: "new-entry",
    aliases: [],
    title: "",
    body: "",
    url: "",
    color: "#72c8ff",
    imageUrl: "",
  };
}

function normalizeImages(raw: unknown): StudioImage[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  return raw.flatMap((entry): StudioImage[] => {
      const row = entry && typeof entry === "object" ? (entry as Record<string, unknown>) : {};
      const url = safePreviewUrl(row.url || row.imageUrl || "");
      if (!url || seen.has(url)) return [];
      seen.add(url);
      return [{
        url,
        label: String(row.label || row.name || "").trim().slice(0, 120),
      }];
    });
}

function normalizeOptions(raw: unknown): PollOption[] {
  if (!Array.isArray(raw)) return createPoll().options;
  const options = raw
    .map((entry, index) => {
      const row = entry && typeof entry === "object" ? (entry as Record<string, unknown>) : {};
      return {
        id: String(row.id || `option_${index + 1}`).trim() || `option_${index + 1}`,
        label: String(row.label || row.name || `Option ${index + 1}`).trim(),
        emoji: String(row.emoji || "").trim(),
      };
    })
    .filter((entry) => entry.label)
    .slice(0, 5);
  return options.length >= 2 ? options : createPoll().options;
}

function normalizeConfig(raw: Partial<CommunityStudioConfig> | null | undefined): CommunityStudioConfig {
  const next = raw || {};
  return {
    ...DEFAULT_CONFIG,
    ...next,
    active: next.active === true,
    styleName: String(next.styleName || DEFAULT_CONFIG.styleName).trim() || DEFAULT_CONFIG.styleName,
    imageLibrary: normalizeImages(next.imageLibrary),
    bulletinsEnabled: next.bulletinsEnabled !== false,
    pollsEnabled: next.pollsEnabled !== false,
    remindersEnabled: next.remindersEnabled !== false,
    bulletins: Array.isArray(next.bulletins)
      ? next.bulletins.map((entry, index) => ({
          ...createBulletin(),
          ...(entry || {}),
          id: String(entry?.id || `bulletin_${index + 1}`).trim() || `bulletin_${index + 1}`,
          enabled: entry?.enabled !== false,
          name: String(entry?.name || `Bulletin ${index + 1}`).trim() || `Bulletin ${index + 1}`,
          channelId: String(entry?.channelId || "").trim(),
          title: String(entry?.title || entry?.name || "").trim(),
          body: String(entry?.body || "").trim(),
          footer: String(entry?.footer || "").trim(),
          color: String(entry?.color || "#ff5a5a").trim() || "#ff5a5a",
          imageUrl: String(entry?.imageUrl || "").trim(),
          thumbnailUrl: String(entry?.thumbnailUrl || "").trim(),
          mentionRoleId: String(entry?.mentionRoleId || "").trim(),
          pingEveryone: entry?.pingEveryone === true,
        }))
      : [],
    polls: Array.isArray(next.polls)
      ? next.polls.map((entry, index) => ({
          ...createPoll(),
          ...(entry || {}),
          id: String(entry?.id || `poll_${index + 1}`).trim() || `poll_${index + 1}`,
          enabled: entry?.enabled !== false,
          name: String(entry?.name || `Poll ${index + 1}`).trim() || `Poll ${index + 1}`,
          channelId: String(entry?.channelId || "").trim(),
          question: String(entry?.question || entry?.name || "").trim(),
          description: String(entry?.description || "").trim(),
          color: String(entry?.color || "#ff7a4f").trim() || "#ff7a4f",
          imageUrl: String(entry?.imageUrl || "").trim(),
          multiVote: entry?.multiVote === true,
          closeAfterHours: clamp(Number(entry?.closeAfterHours || 0) || 0, 0, 720),
          options: normalizeOptions(entry?.options),
        }))
      : [],
    reminders: Array.isArray(next.reminders)
      ? next.reminders.map((entry, index) => {
          const scheduleType = String(entry?.scheduleType || "daily").trim().toLowerCase();
          return {
            ...createReminder(),
            ...(entry || {}),
            id: String(entry?.id || `reminder_${index + 1}`).trim() || `reminder_${index + 1}`,
            enabled: entry?.enabled !== false,
            name: String(entry?.name || `Reminder ${index + 1}`).trim() || `Reminder ${index + 1}`,
            channelId: String(entry?.channelId || "").trim(),
            title: String(entry?.title || entry?.name || "").trim(),
            message: String(entry?.message || "").trim(),
            color: String(entry?.color || "#ffad66").trim() || "#ffad66",
            imageUrl: String(entry?.imageUrl || "").trim(),
            timezone: String(entry?.timezone || "America/Los_Angeles").trim() || "America/Los_Angeles",
            scheduleType: scheduleType === "hourly" || scheduleType === "weekly" || scheduleType === "monthly" ? scheduleType : "daily",
            minute: clamp(Number(entry?.minute || 0) || 0, 0, 59),
            hour: clamp(Number(entry?.hour || 9) || 9, 0, 23),
            dayOfWeek: clamp(Number(entry?.dayOfWeek || 1) || 1, 0, 6),
            dayOfMonth: clamp(Number(entry?.dayOfMonth || 1) || 1, 1, 31),
          };
        })
      : [],
    lookup: {
      ...DEFAULT_CONFIG.lookup,
      ...(next.lookup || {}),
      enabled: next.lookup?.enabled !== false,
      prefix: String(next.lookup?.prefix || DEFAULT_CONFIG.lookup.prefix).trim() || DEFAULT_CONFIG.lookup.prefix,
    },
    lookupEntries: Array.isArray(next.lookupEntries)
      ? next.lookupEntries.map((entry, index) => ({
          ...createLookupEntry(),
          ...(entry || {}),
          id: String(entry?.id || `lookup_${index + 1}`).trim() || `lookup_${index + 1}`,
          enabled: entry?.enabled !== false,
          key: (String(entry?.key || entry?.title || `entry-${index + 1}`).trim() || `entry-${index + 1}`).toLowerCase().replace(/\s+/g, "-"),
          aliases: Array.isArray(entry?.aliases) ? entry.aliases.map((value) => String(value || "").trim().toLowerCase()).filter(Boolean) : [],
          title: String(entry?.title || entry?.key || "").trim(),
          body: String(entry?.body || "").trim(),
          url: String(entry?.url || "").trim(),
          color: String(entry?.color || "#72c8ff").trim() || "#72c8ff",
          imageUrl: String(entry?.imageUrl || "").trim(),
        }))
      : [],
    notes: String(next.notes || "").trim(),
  };
}

function clampIndex(index: number, size: number) {
  if (!size) return -1;
  return Math.max(0, Math.min(index, size - 1));
}

function channelLabel(channels: Channel[], channelId: string) {
  const found = channels.find((entry) => entry.id === channelId);
  return found ? `#${found.name}` : (channelId || "Not set");
}

function roleLabel(roles: Role[], roleId: string) {
  const found = roles.find((entry) => entry.id === roleId);
  return found ? `@${found.name}` : "No role ping";
}

function tileStyle(selected: boolean): React.CSSProperties {
  return {
    border: selected ? "1px solid #ff6b6b" : "1px solid #5f0000",
    borderRadius: 12,
    padding: 10,
    background: selected ? "rgba(255,70,70,0.12)" : "rgba(120,0,0,0.05)",
    color: "#ffd7d7",
    cursor: "pointer",
    textAlign: "left",
  };
}

function ImagePicker({
  library,
  selectedUrl,
  onSelect,
}: {
  library: StudioImage[];
  selectedUrl: string;
  onSelect: (url: string) => void;
}) {
  if (!library.length) return <div style={micro}>No saved studio images yet.</div>;
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))", gap: 10 }}>
      <button type="button" style={tileStyle(!selectedUrl)} onClick={() => onSelect("")}>
        <div style={{ display: "grid", placeItems: "center", height: 88, borderRadius: 8, border: "1px dashed #5f0000" }}>No Image</div>
        <div style={{ marginTop: 8, fontWeight: 700 }}>Clear image</div>
        <div style={micro}>{!selectedUrl ? "Selected" : "Use text-only"}</div>
      </button>
      {library.map((image) => {
        const selected = image.url === selectedUrl;
        return (
          <button key={image.url} type="button" style={tileStyle(selected)} onClick={() => onSelect(image.url)}>
            <div style={{ width: "100%", height: 88, overflow: "hidden", borderRadius: 8, border: "1px solid #220000", background: "#090909" }}>
              <img src={image.url} alt={image.label || "Studio image"} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            </div>
            <div style={{ marginTop: 8, fontWeight: 700 }}>{image.label || "Saved image"}</div>
            <div style={micro}>{selected ? "Selected" : "Use this image"}</div>
          </button>
        );
      })}
    </div>
  );
}

function SectionCard({
  title,
  subtitle,
  selected,
  onClick,
}: {
  title: string;
  subtitle: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button type="button" style={tileStyle(selected)} onClick={onClick}>
      <div style={{ fontWeight: 800 }}>{title}</div>
      <div style={{ ...micro, marginTop: 4 }}>{subtitle}</div>
    </button>
  );
}

export default function CommunityStudioClient() {
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
  } = useGuildEngineEditor<CommunityStudioConfig>("communityStudio", DEFAULT_CONFIG);

  const cfg = useMemo(() => normalizeConfig(rawCfg), [rawCfg]);
  const [localMsg, setLocalMsg] = useState("");
  const [bulletinIndex, setBulletinIndex] = useState(0);
  const [pollIndex, setPollIndex] = useState(0);
  const [reminderIndex, setReminderIndex] = useState(0);
  const [lookupIndex, setLookupIndex] = useState(0);
  const [newImageUrl, setNewImageUrl] = useState("");
  const [newImageLabel, setNewImageLabel] = useState("");

  const channelList = useMemo(() => channels as Channel[], [channels]);
  const roleList = useMemo(() => roles as Role[], [roles]);
  const textChannels = useMemo(
    () => channelList.filter((channel) => Number(channel?.type) === 0 || Number(channel?.type) === 5 || String(channel?.type || "").toLowerCase().includes("text")),
    [channelList]
  );

  const activeBulletinIndex = clampIndex(bulletinIndex, cfg.bulletins.length);
  const activePollIndex = clampIndex(pollIndex, cfg.polls.length);
  const activeReminderIndex = clampIndex(reminderIndex, cfg.reminders.length);
  const activeLookupIndex = clampIndex(lookupIndex, cfg.lookupEntries.length);
  const activeBulletin = activeBulletinIndex >= 0 ? cfg.bulletins[activeBulletinIndex] : null;
  const activePoll = activePollIndex >= 0 ? cfg.polls[activePollIndex] : null;
  const activeReminder = activeReminderIndex >= 0 ? cfg.reminders[activeReminderIndex] : null;
  const activeLookup = activeLookupIndex >= 0 ? cfg.lookupEntries[activeLookupIndex] : null;
  const visibleMessage = localMsg || message;

  function replaceListItem<K extends "bulletins" | "polls" | "reminders" | "lookupEntries">(
    key: K,
    index: number,
    nextValue: CommunityStudioConfig[K][number]
  ) {
    setCfg((prev) => {
      const next = normalizeConfig(prev);
      const items = [...next[key]];
      items[index] = nextValue;
      return { ...next, [key]: items };
    });
  }

  function removeListItem(key: "bulletins" | "polls" | "reminders" | "lookupEntries", index: number) {
    setCfg((prev) => {
      const next = normalizeConfig(prev);
      return {
        ...next,
        [key]: next[key].filter((_, itemIndex) => itemIndex !== index),
      };
    });
  }

  async function saveStudio(nextConfig: CommunityStudioConfig = cfg) {
    setLocalMsg("");
    const normalized = normalizeConfig(nextConfig);
    setCfg(normalized);
    await save(normalized);
  }

  function addLibraryImage() {
    const url = safePreviewUrl(newImageUrl);
    if (!url) {
      setLocalMsg("Add a full image URL starting with http or https.");
      return;
    }
    if (cfg.imageLibrary.some((image) => image.url === url)) {
      setLocalMsg("That image is already saved.");
      return;
    }
    setCfg((prev) => {
      const next = normalizeConfig(prev);
      return {
        ...next,
        imageLibrary: [...next.imageLibrary, { url, label: newImageLabel.trim() }],
      };
    });
    setNewImageUrl("");
    setNewImageLabel("");
    setLocalMsg("Saved image added. Save Community Studio to persist it.");
  }

  function removeLibraryImage(url: string) {
    setCfg((prev) => {
      const next = normalizeConfig(prev);
      return {
        ...next,
        imageLibrary: next.imageLibrary.filter((image) => image.url !== url),
      };
    });
    setLocalMsg("");
  }

  if (!guildId) return <div style={{ ...shell, color: "#ff8a8a" }}>Missing guildId. Open from /guilds first.</div>;

  return (
    <div style={shell}>
      <h1 style={{ margin: 0, color: "#ff4444", letterSpacing: "0.12em", textTransform: "uppercase" }}>Community Studio</h1>
      <div style={{ color: "#ff9c9c", marginTop: 6 }}>Guild: {guildName || guildId}</div>
      <div style={{ color: "#ffb0b0", fontSize: 12, marginTop: 4 }}>
        Build distinct server bulletins, pulse polls, lookup cards, and reminder loops without copying another dashboard&apos;s flow.
      </div>
      {visibleMessage ? <div style={{ color: "#ffb3f0", marginTop: 8 }}>{visibleMessage}</div> : null}

      {loading ? (
        <div style={card}>Loading Community Studio...</div>
      ) : (
        <>
          <EngineInsights summary={summary} details={details} showDetails />

          <section id="images" style={card}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 12, alignItems: "end" }}>
              <label><input type="checkbox" checked={cfg.active} onChange={(e) => setCfg((prev) => ({ ...normalizeConfig(prev), active: e.target.checked }))} /> Community Studio Active</label>
              <label><input type="checkbox" checked={cfg.bulletinsEnabled} onChange={(e) => setCfg((prev) => ({ ...normalizeConfig(prev), bulletinsEnabled: e.target.checked }))} /> Bulletins Enabled</label>
              <label><input type="checkbox" checked={cfg.pollsEnabled} onChange={(e) => setCfg((prev) => ({ ...normalizeConfig(prev), pollsEnabled: e.target.checked }))} /> Pulse Polls Enabled</label>
              <label><input type="checkbox" checked={cfg.remindersEnabled} onChange={(e) => setCfg((prev) => ({ ...normalizeConfig(prev), remindersEnabled: e.target.checked }))} /> Reminder Loop Enabled</label>
              <label><input type="checkbox" checked={cfg.lookup.enabled} onChange={(e) => setCfg((prev) => ({ ...normalizeConfig(prev), lookup: { ...normalizeConfig(prev).lookup, enabled: e.target.checked } }))} /> Lookup Replies Enabled</label>
              <div>
                <div style={{ marginBottom: 6 }}>Style Name</div>
                <input style={input} value={cfg.styleName} onChange={(e) => setCfg((prev) => ({ ...normalizeConfig(prev), styleName: e.target.value }))} />
              </div>
              <div>
                <div style={{ marginBottom: 6 }}>Lookup Prefix</div>
                <input style={input} value={cfg.lookup.prefix} onChange={(e) => setCfg((prev) => ({ ...normalizeConfig(prev), lookup: { ...normalizeConfig(prev).lookup, prefix: e.target.value } }))} />
              </div>
            </div>
            <div style={{ marginTop: 12 }}>
              <div style={{ marginBottom: 6 }}>Operator Notes</div>
              <textarea style={{ ...input, minHeight: 80 }} value={cfg.notes} onChange={(e) => setCfg((prev) => ({ ...normalizeConfig(prev), notes: e.target.value }))} />
            </div>
          </section>

          <section id="bulletins" style={card}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
              <div>
                <div style={{ fontWeight: 800 }}>Saved Studio Images</div>
                <div style={micro}>These images can be picked for bulletins, polls, reminders, and lookup cards without re-pasting URLs.</div>
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <input style={{ ...input, width: 260 }} placeholder="https://image-url" value={newImageUrl} onChange={(e) => setNewImageUrl(e.target.value)} />
                <input style={{ ...input, width: 180 }} placeholder="Label" value={newImageLabel} onChange={(e) => setNewImageLabel(e.target.value)} />
                <button type="button" style={button} onClick={addLibraryImage}>Add Saved Image</button>
              </div>
            </div>
            <div style={{ ...micro, marginTop: 12 }}>
              {cfg.imageLibrary.length ? `${cfg.imageLibrary.length} saved studio image${cfg.imageLibrary.length === 1 ? "" : "s"} ready to reuse.` : "No saved studio images yet."}
            </div>
            {cfg.imageLibrary.length ? (
              <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 10 }}>
                {cfg.imageLibrary.map((image) => (
                  <div key={image.url} style={{ border: "1px solid #5f0000", borderRadius: 10, padding: 10 }}>
                    <div style={{ width: "100%", height: 84, overflow: "hidden", borderRadius: 8, border: "1px solid #220000" }}>
                      <img src={image.url} alt={image.label || "Saved studio image"} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    </div>
                    <div style={{ marginTop: 8, fontWeight: 700 }}>{image.label || "Saved image"}</div>
                    <div style={micro}>{image.url}</div>
                    <button type="button" style={{ ...button, marginTop: 8 }} onClick={() => removeLibraryImage(image.url)}>Remove</button>
                  </div>
                ))}
              </div>
            ) : null}
          </section>

          <section id="bulletins" style={card}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
              <div>
                <div style={{ fontWeight: 800 }}>Bulletins</div>
                <div style={micro}>Operator announcements with role pings, thumbnails, and full-width artwork.</div>
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button type="button" style={button} disabled={!cfg.bulletinsEnabled} onClick={() => { setCfg((prev) => ({ ...normalizeConfig(prev), bulletins: [...normalizeConfig(prev).bulletins, createBulletin()] })); setBulletinIndex(cfg.bulletins.length); }}>Add Bulletin</button>
                <button type="button" style={button} disabled={saving || !activeBulletin || !cfg.bulletinsEnabled} onClick={() => activeBulletin ? void runAction("deployBulletin", { bulletinId: activeBulletin.id }) : undefined}>Deploy Now</button>
                <button type="button" style={button} disabled={!activeBulletin} onClick={() => { if (activeBulletin) { removeListItem("bulletins", activeBulletinIndex); setBulletinIndex((prev) => Math.max(0, prev - 1)); } }}>Remove</button>
              </div>
            </div>
            {!cfg.bulletinsEnabled ? <div style={{ ...micro, marginTop: 8 }}>Bulletins are paused for this guild. Saved bulletin rows stay intact until you turn them back on.</div> : null}
            <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "320px minmax(0,1fr)", gap: 14 }}>
              <div style={{ display: "grid", gap: 8, alignContent: "start" }}>
                {cfg.bulletins.length ? cfg.bulletins.map((entry, index) => (
                  <SectionCard
                    key={entry.id}
                    title={entry.name || `Bulletin ${index + 1}`}
                    subtitle={`${channelLabel(channelList, entry.channelId)} | ${entry.enabled ? "live" : "paused"} | ${entry.imageUrl ? "art" : "text"}`}
                    selected={index === activeBulletinIndex}
                    onClick={() => setBulletinIndex(index)}
                  />
                )) : <div style={micro}>No bulletin surfaces yet.</div>}
              </div>
              {activeBulletin ? (
                <div style={{ display: "grid", gap: 12 }}>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 12 }}>
                    <div>
                      <div style={{ marginBottom: 6 }}>Internal Name</div>
                      <input style={input} value={activeBulletin.name} onChange={(e) => replaceListItem("bulletins", activeBulletinIndex, { ...activeBulletin, name: e.target.value })} />
                    </div>
                    <div>
                      <div style={{ marginBottom: 6 }}>Channel</div>
                      <select style={input} value={activeBulletin.channelId} onChange={(e) => replaceListItem("bulletins", activeBulletinIndex, { ...activeBulletin, channelId: e.target.value })}>
                        <option value="">Select text channel</option>
                        {textChannels.map((channel) => <option key={channel.id} value={channel.id}>#{channel.name}</option>)}
                      </select>
                    </div>
                    <div>
                      <div style={{ marginBottom: 6 }}>Color</div>
                      <input style={input} value={activeBulletin.color} onChange={(e) => replaceListItem("bulletins", activeBulletinIndex, { ...activeBulletin, color: e.target.value })} />
                    </div>
                    <div>
                      <div style={{ marginBottom: 6 }}>Mention Role</div>
                      <select style={input} value={activeBulletin.mentionRoleId} onChange={(e) => replaceListItem("bulletins", activeBulletinIndex, { ...activeBulletin, mentionRoleId: e.target.value })}>
                        <option value="">No role ping</option>
                        {roleList.map((role) => <option key={role.id} value={role.id}>@{role.name}</option>)}
                      </select>
                    </div>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 12 }}>
                    <label><input type="checkbox" checked={activeBulletin.enabled} onChange={(e) => replaceListItem("bulletins", activeBulletinIndex, { ...activeBulletin, enabled: e.target.checked })} /> Enabled</label>
                    <label><input type="checkbox" checked={activeBulletin.pingEveryone} onChange={(e) => replaceListItem("bulletins", activeBulletinIndex, { ...activeBulletin, pingEveryone: e.target.checked })} /> Allow @everyone ping</label>
                    <div style={micro}>Current ping target: {roleLabel(roleList, activeBulletin.mentionRoleId)}</div>
                  </div>
                  <div>
                    <div style={{ marginBottom: 6 }}>Title</div>
                    <input style={input} value={activeBulletin.title} onChange={(e) => replaceListItem("bulletins", activeBulletinIndex, { ...activeBulletin, title: e.target.value })} />
                  </div>
                  <div>
                    <div style={{ marginBottom: 6 }}>Body</div>
                    <textarea style={{ ...input, minHeight: 110 }} value={activeBulletin.body} onChange={(e) => replaceListItem("bulletins", activeBulletinIndex, { ...activeBulletin, body: e.target.value })} />
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 12 }}>
                    <div>
                      <div style={{ marginBottom: 6 }}>Footer</div>
                      <input style={input} value={activeBulletin.footer} onChange={(e) => replaceListItem("bulletins", activeBulletinIndex, { ...activeBulletin, footer: e.target.value })} />
                    </div>
                    <div>
                      <div style={{ marginBottom: 6 }}>Thumbnail URL</div>
                      <input style={input} value={activeBulletin.thumbnailUrl} onChange={(e) => replaceListItem("bulletins", activeBulletinIndex, { ...activeBulletin, thumbnailUrl: e.target.value })} />
                    </div>
                  </div>
                  <div>
                    <div style={{ marginBottom: 6 }}>Hero Image URL</div>
                    <input style={input} value={activeBulletin.imageUrl} onChange={(e) => replaceListItem("bulletins", activeBulletinIndex, { ...activeBulletin, imageUrl: e.target.value })} />
                  </div>
                  <ImagePicker library={cfg.imageLibrary} selectedUrl={activeBulletin.imageUrl} onSelect={(url) => replaceListItem("bulletins", activeBulletinIndex, { ...activeBulletin, imageUrl: url })} />
                </div>
              ) : null}
            </div>
          </section>

          <section id="polls" style={card}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
              <div>
                <div style={{ fontWeight: 800 }}>Pulse Polls</div>
                <div style={micro}>Interactive vote drops with artwork, multivote rules, and deploy-now control.</div>
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button type="button" style={button} disabled={!cfg.pollsEnabled} onClick={() => { setCfg((prev) => ({ ...normalizeConfig(prev), polls: [...normalizeConfig(prev).polls, createPoll()] })); setPollIndex(cfg.polls.length); }}>Add Poll</button>
                <button type="button" style={button} disabled={saving || !activePoll || !cfg.pollsEnabled} onClick={() => activePoll ? void runAction("deployPoll", { pollId: activePoll.id }) : undefined}>Deploy Poll</button>
                <button type="button" style={button} disabled={!activePoll} onClick={() => { if (activePoll) { removeListItem("polls", activePollIndex); setPollIndex((prev) => Math.max(0, prev - 1)); } }}>Remove</button>
              </div>
            </div>
            {!cfg.pollsEnabled ? <div style={{ ...micro, marginTop: 8 }}>Pulse Polls are paused for this guild. Saved poll layouts stay ready until you turn them back on.</div> : null}
            <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "320px minmax(0,1fr)", gap: 14 }}>
              <div style={{ display: "grid", gap: 8, alignContent: "start" }}>
                {cfg.polls.length ? cfg.polls.map((entry, index) => (
                  <SectionCard
                    key={entry.id}
                    title={entry.name || `Poll ${index + 1}`}
                    subtitle={`${channelLabel(channelList, entry.channelId)} | ${entry.options.length} options | ${entry.imageUrl ? "art" : "text"}`}
                    selected={index === activePollIndex}
                    onClick={() => setPollIndex(index)}
                  />
                )) : <div style={micro}>No poll surfaces yet.</div>}
              </div>
              {activePoll ? (
                <div style={{ display: "grid", gap: 12 }}>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 12 }}>
                    <div>
                      <div style={{ marginBottom: 6 }}>Internal Name</div>
                      <input style={input} value={activePoll.name} onChange={(e) => replaceListItem("polls", activePollIndex, { ...activePoll, name: e.target.value })} />
                    </div>
                    <div>
                      <div style={{ marginBottom: 6 }}>Channel</div>
                      <select style={input} value={activePoll.channelId} onChange={(e) => replaceListItem("polls", activePollIndex, { ...activePoll, channelId: e.target.value })}>
                        <option value="">Select text channel</option>
                        {textChannels.map((channel) => <option key={channel.id} value={channel.id}>#{channel.name}</option>)}
                      </select>
                    </div>
                    <div>
                      <div style={{ marginBottom: 6 }}>Color</div>
                      <input style={input} value={activePoll.color} onChange={(e) => replaceListItem("polls", activePollIndex, { ...activePoll, color: e.target.value })} />
                    </div>
                    <div>
                      <div style={{ marginBottom: 6 }}>Close After Hours</div>
                      <input style={input} type="number" min={0} max={720} value={activePoll.closeAfterHours} onChange={(e) => replaceListItem("polls", activePollIndex, { ...activePoll, closeAfterHours: clamp(Number(e.target.value || 0), 0, 720) })} />
                    </div>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 12 }}>
                    <label><input type="checkbox" checked={activePoll.enabled} onChange={(e) => replaceListItem("polls", activePollIndex, { ...activePoll, enabled: e.target.checked })} /> Enabled</label>
                    <label><input type="checkbox" checked={activePoll.multiVote} onChange={(e) => replaceListItem("polls", activePollIndex, { ...activePoll, multiVote: e.target.checked })} /> Allow Multiple Votes</label>
                  </div>
                  <div>
                    <div style={{ marginBottom: 6 }}>Question</div>
                    <input style={input} value={activePoll.question} onChange={(e) => replaceListItem("polls", activePollIndex, { ...activePoll, question: e.target.value })} />
                  </div>
                  <div>
                    <div style={{ marginBottom: 6 }}>Description</div>
                    <textarea style={{ ...input, minHeight: 100 }} value={activePoll.description} onChange={(e) => replaceListItem("polls", activePollIndex, { ...activePoll, description: e.target.value })} />
                  </div>
                  <div>
                    <div style={{ marginBottom: 8, fontWeight: 700 }}>Poll Options</div>
                    <div style={{ display: "grid", gap: 10 }}>
                      {activePoll.options.map((option, optionIndex) => (
                        <div key={option.id} style={{ display: "grid", gridTemplateColumns: "120px minmax(0,1fr) auto", gap: 10, alignItems: "center" }}>
                          <input style={input} placeholder="Emoji" value={option.emoji} onChange={(e) => replaceListItem("polls", activePollIndex, { ...activePoll, options: activePoll.options.map((entry, entryIndex) => entryIndex === optionIndex ? { ...entry, emoji: e.target.value } : entry) })} />
                          <input style={input} placeholder={`Option ${optionIndex + 1}`} value={option.label} onChange={(e) => replaceListItem("polls", activePollIndex, { ...activePoll, options: activePoll.options.map((entry, entryIndex) => entryIndex === optionIndex ? { ...entry, label: e.target.value } : entry) })} />
                          <button
                            type="button"
                            style={button}
                            disabled={activePoll.options.length <= 2}
                            onClick={() => replaceListItem("polls", activePollIndex, { ...activePoll, options: activePoll.options.filter((_, entryIndex) => entryIndex !== optionIndex) })}
                          >
                            Remove
                          </button>
                        </div>
                      ))}
                    </div>
                    <button
                      type="button"
                      style={{ ...button, marginTop: 10 }}
                      disabled={activePoll.options.length >= 5}
                      onClick={() => replaceListItem("polls", activePollIndex, { ...activePoll, options: [...activePoll.options, { id: makeId("option"), label: `Option ${activePoll.options.length + 1}`, emoji: "" }] })}
                    >
                      Add Option
                    </button>
                  </div>
                  <div>
                    <div style={{ marginBottom: 6 }}>Hero Image URL</div>
                    <input style={input} value={activePoll.imageUrl} onChange={(e) => replaceListItem("polls", activePollIndex, { ...activePoll, imageUrl: e.target.value })} />
                  </div>
                  <ImagePicker library={cfg.imageLibrary} selectedUrl={activePoll.imageUrl} onSelect={(url) => replaceListItem("polls", activePollIndex, { ...activePoll, imageUrl: url })} />
                </div>
              ) : null}
            </div>
          </section>

          <section id="reminders" style={card}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
              <div>
                <div style={{ fontWeight: 800 }}>Reminder Loop</div>
                <div style={micro}>Time-based posts with direct fire-now and history reset controls.</div>
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button type="button" style={button} disabled={!cfg.remindersEnabled} onClick={() => { setCfg((prev) => ({ ...normalizeConfig(prev), reminders: [...normalizeConfig(prev).reminders, createReminder()] })); setReminderIndex(cfg.reminders.length); }}>Add Reminder</button>
                <button type="button" style={button} disabled={saving || !activeReminder || !cfg.remindersEnabled} onClick={() => activeReminder ? void runAction("sendReminderNow", { reminderId: activeReminder.id }) : undefined}>Send Now</button>
                <button type="button" style={button} disabled={saving || !cfg.remindersEnabled} onClick={() => void runAction("clearReminderHistory")}>Clear History</button>
                <button type="button" style={button} disabled={!activeReminder} onClick={() => { if (activeReminder) { removeListItem("reminders", activeReminderIndex); setReminderIndex((prev) => Math.max(0, prev - 1)); } }}>Remove</button>
              </div>
            </div>
            {!cfg.remindersEnabled ? <div style={{ ...micro, marginTop: 8 }}>Reminder Loop is paused for this guild. Saved schedule rows stay ready until you turn it back on.</div> : null}
            <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "320px minmax(0,1fr)", gap: 14 }}>
              <div style={{ display: "grid", gap: 8, alignContent: "start" }}>
                {cfg.reminders.length ? cfg.reminders.map((entry, index) => (
                  <SectionCard
                    key={entry.id}
                    title={entry.name || `Reminder ${index + 1}`}
                    subtitle={`${channelLabel(channelList, entry.channelId)} | ${entry.scheduleType} | ${entry.imageUrl ? "art" : "text"}`}
                    selected={index === activeReminderIndex}
                    onClick={() => setReminderIndex(index)}
                  />
                )) : <div style={micro}>No reminder loops yet.</div>}
              </div>
              {activeReminder ? (
                <div style={{ display: "grid", gap: 12 }}>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 12 }}>
                    <div>
                      <div style={{ marginBottom: 6 }}>Internal Name</div>
                      <input style={input} value={activeReminder.name} onChange={(e) => replaceListItem("reminders", activeReminderIndex, { ...activeReminder, name: e.target.value })} />
                    </div>
                    <div>
                      <div style={{ marginBottom: 6 }}>Channel</div>
                      <select style={input} value={activeReminder.channelId} onChange={(e) => replaceListItem("reminders", activeReminderIndex, { ...activeReminder, channelId: e.target.value })}>
                        <option value="">Select text channel</option>
                        {textChannels.map((channel) => <option key={channel.id} value={channel.id}>#{channel.name}</option>)}
                      </select>
                    </div>
                    <div>
                      <div style={{ marginBottom: 6 }}>Color</div>
                      <input style={input} value={activeReminder.color} onChange={(e) => replaceListItem("reminders", activeReminderIndex, { ...activeReminder, color: e.target.value })} />
                    </div>
                    <div>
                      <div style={{ marginBottom: 6 }}>Timezone</div>
                      <input style={input} value={activeReminder.timezone} onChange={(e) => replaceListItem("reminders", activeReminderIndex, { ...activeReminder, timezone: e.target.value })} />
                    </div>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 12 }}>
                    <label><input type="checkbox" checked={activeReminder.enabled} onChange={(e) => replaceListItem("reminders", activeReminderIndex, { ...activeReminder, enabled: e.target.checked })} /> Enabled</label>
                    <div>
                      <div style={{ marginBottom: 6 }}>Schedule Type</div>
                      <select style={input} value={activeReminder.scheduleType} onChange={(e) => replaceListItem("reminders", activeReminderIndex, { ...activeReminder, scheduleType: e.target.value as Reminder["scheduleType"] })}>
                        <option value="hourly">Hourly</option>
                        <option value="daily">Daily</option>
                        <option value="weekly">Weekly</option>
                        <option value="monthly">Monthly</option>
                      </select>
                    </div>
                    <div>
                      <div style={{ marginBottom: 6 }}>Minute</div>
                      <input style={input} type="number" min={0} max={59} value={activeReminder.minute} onChange={(e) => replaceListItem("reminders", activeReminderIndex, { ...activeReminder, minute: clamp(Number(e.target.value || 0), 0, 59) })} />
                    </div>
                    <div>
                      <div style={{ marginBottom: 6 }}>Hour</div>
                      <input style={input} type="number" min={0} max={23} value={activeReminder.hour} onChange={(e) => replaceListItem("reminders", activeReminderIndex, { ...activeReminder, hour: clamp(Number(e.target.value || 0), 0, 23) })} />
                    </div>
                    <div>
                      <div style={{ marginBottom: 6 }}>Day Of Week</div>
                      <input style={input} type="number" min={0} max={6} value={activeReminder.dayOfWeek} onChange={(e) => replaceListItem("reminders", activeReminderIndex, { ...activeReminder, dayOfWeek: clamp(Number(e.target.value || 0), 0, 6) })} />
                    </div>
                    <div>
                      <div style={{ marginBottom: 6 }}>Day Of Month</div>
                      <input style={input} type="number" min={1} max={31} value={activeReminder.dayOfMonth} onChange={(e) => replaceListItem("reminders", activeReminderIndex, { ...activeReminder, dayOfMonth: clamp(Number(e.target.value || 1), 1, 31) })} />
                    </div>
                  </div>
                  <div>
                    <div style={{ marginBottom: 6 }}>Title</div>
                    <input style={input} value={activeReminder.title} onChange={(e) => replaceListItem("reminders", activeReminderIndex, { ...activeReminder, title: e.target.value })} />
                  </div>
                  <div>
                    <div style={{ marginBottom: 6 }}>Message</div>
                    <textarea style={{ ...input, minHeight: 110 }} value={activeReminder.message} onChange={(e) => replaceListItem("reminders", activeReminderIndex, { ...activeReminder, message: e.target.value })} />
                  </div>
                  <div>
                    <div style={{ marginBottom: 6 }}>Hero Image URL</div>
                    <input style={input} value={activeReminder.imageUrl} onChange={(e) => replaceListItem("reminders", activeReminderIndex, { ...activeReminder, imageUrl: e.target.value })} />
                  </div>
                  <ImagePicker library={cfg.imageLibrary} selectedUrl={activeReminder.imageUrl} onSelect={(url) => replaceListItem("reminders", activeReminderIndex, { ...activeReminder, imageUrl: url })} />
                </div>
              ) : null}
            </div>
          </section>

          <section id="lookup" style={card}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
              <div>
                <div style={{ fontWeight: 800 }}>Lookup Cards</div>
                <div style={micro}>Quick answer cards with aliases, links, and optional artwork.</div>
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button type="button" style={button} onClick={() => { setCfg((prev) => ({ ...normalizeConfig(prev), lookupEntries: [...normalizeConfig(prev).lookupEntries, createLookupEntry()] })); setLookupIndex(cfg.lookupEntries.length); }}>Add Lookup Card</button>
                <button type="button" style={button} disabled={!activeLookup} onClick={() => { if (activeLookup) { removeListItem("lookupEntries", activeLookupIndex); setLookupIndex((prev) => Math.max(0, prev - 1)); } }}>Remove</button>
              </div>
            </div>
            <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "320px minmax(0,1fr)", gap: 14 }}>
              <div style={{ display: "grid", gap: 8, alignContent: "start" }}>
                {cfg.lookupEntries.length ? cfg.lookupEntries.map((entry, index) => (
                  <SectionCard
                    key={entry.id}
                    title={entry.title || entry.key || `Entry ${index + 1}`}
                    subtitle={`${entry.aliases.length} aliases | ${entry.imageUrl ? "art" : "text"} | ${entry.enabled ? "live" : "paused"}`}
                    selected={index === activeLookupIndex}
                    onClick={() => setLookupIndex(index)}
                  />
                )) : <div style={micro}>No lookup cards yet.</div>}
              </div>
              {activeLookup ? (
                <div style={{ display: "grid", gap: 12 }}>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 12 }}>
                    <div>
                      <div style={{ marginBottom: 6 }}>Key</div>
                      <input style={input} value={activeLookup.key} onChange={(e) => replaceListItem("lookupEntries", activeLookupIndex, { ...activeLookup, key: e.target.value.toLowerCase().replace(/\s+/g, "-") })} />
                    </div>
                    <div>
                      <div style={{ marginBottom: 6 }}>Color</div>
                      <input style={input} value={activeLookup.color} onChange={(e) => replaceListItem("lookupEntries", activeLookupIndex, { ...activeLookup, color: e.target.value })} />
                    </div>
                    <label><input type="checkbox" checked={activeLookup.enabled} onChange={(e) => replaceListItem("lookupEntries", activeLookupIndex, { ...activeLookup, enabled: e.target.checked })} /> Enabled</label>
                  </div>
                  <div>
                    <div style={{ marginBottom: 6 }}>Title</div>
                    <input style={input} value={activeLookup.title} onChange={(e) => replaceListItem("lookupEntries", activeLookupIndex, { ...activeLookup, title: e.target.value })} />
                  </div>
                  <div>
                    <div style={{ marginBottom: 6 }}>Aliases (comma separated)</div>
                    <input style={input} value={activeLookup.aliases.join(", ")} onChange={(e) => replaceListItem("lookupEntries", activeLookupIndex, { ...activeLookup, aliases: e.target.value.split(",").map((value) => value.trim().toLowerCase()).filter(Boolean) })} />
                  </div>
                  <div>
                    <div style={{ marginBottom: 6 }}>Body</div>
                    <textarea style={{ ...input, minHeight: 110 }} value={activeLookup.body} onChange={(e) => replaceListItem("lookupEntries", activeLookupIndex, { ...activeLookup, body: e.target.value })} />
                  </div>
                  <div>
                    <div style={{ marginBottom: 6 }}>Link URL</div>
                    <input style={input} value={activeLookup.url} onChange={(e) => replaceListItem("lookupEntries", activeLookupIndex, { ...activeLookup, url: e.target.value })} />
                  </div>
                  <div>
                    <div style={{ marginBottom: 6 }}>Image URL</div>
                    <input style={input} value={activeLookup.imageUrl} onChange={(e) => replaceListItem("lookupEntries", activeLookupIndex, { ...activeLookup, imageUrl: e.target.value })} />
                  </div>
                  <ImagePicker library={cfg.imageLibrary} selectedUrl={activeLookup.imageUrl} onSelect={(url) => replaceListItem("lookupEntries", activeLookupIndex, { ...activeLookup, imageUrl: url })} />
                </div>
              ) : null}
            </div>
          </section>

          <section style={{ ...card, display: "flex", justifyContent: "flex-end" }}>
            <button type="button" style={button} disabled={saving} onClick={() => void saveStudio()}>
              {saving ? "Saving..." : "Save Community Studio"}
            </button>
          </section>

          <ConfigJsonEditor
            title="Advanced Community Studio Config"
            value={cfg}
            disabled={saving}
            onApply={(next) => setCfg(normalizeConfig(next as CommunityStudioConfig))}
          />
        </>
      )}
    </div>
  );
}
