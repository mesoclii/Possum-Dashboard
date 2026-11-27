"use client";

import { useMemo } from "react";
import type { CSSProperties } from "react";
import { useGuildEngineEditor } from "@/components/possum/useGuildEngineEditor";

type DaySlot = {
  id: string;
  dayOfWeek: number;
  enabled: boolean;
  time: string;
  channelId: string;
  title: string;
  content: string;
  imageUrl: string;
  mentionRoleIds: string[];
  lastSentAt?: string;
  lastError?: string;
};
type Config = {
  enabled: boolean;
  timezone: string;
  minIntervalMinutes: number;
  schedule: DaySlot[];
  history: Array<{ postedAt: string; dayOfWeek: number; title?: string; channelId?: string; status?: string; error?: string }>;
};

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const EMPTY_WEEK: DaySlot[] = DAYS.map((_, dayOfWeek) => ({
  id: `weekday-${dayOfWeek}`, dayOfWeek, enabled: false, time: "09:00", channelId: "", title: "", content: "", imageUrl: "", mentionRoleIds: [],
}));
const DEFAULTS: Config = { enabled: false, timezone: "UTC", minIntervalMinutes: 15, schedule: EMPTY_WEEK, history: [] };

const card: CSSProperties = { border: "1px solid #65122e", borderRadius: 14, background: "rgba(80,0,25,.18)", padding: 18, marginBottom: 14 };
const field: CSSProperties = { width: "100%", minWidth: 0, padding: 10, borderRadius: 8, border: "1px solid #7a1737", background: "#10070b", color: "#ffe0e9" };
const button: CSSProperties = { border: "1px solid #d22a64", borderRadius: 9, background: "#300b19", color: "#ffe3eb", padding: "9px 13px", cursor: "pointer", fontWeight: 700 };

function channelType(channel: any) {
  return Number(channel?.type) === 0 || Number(channel?.type) === 5 || String(channel?.type || "").toLowerCase().includes("text");
}

export default function MessageOfDayClient() {
  const editor = useGuildEngineEditor<Config>("messageOfDay", DEFAULTS);
  const cfg = useMemo<Config>(() => ({
    ...DEFAULTS,
    ...(editor.config || {}),
    schedule: Array.isArray((editor.config as any)?.schedule) && (editor.config as any).schedule.length === 7
      ? (editor.config as any).schedule.map((row: DaySlot, i: number) => ({ ...EMPTY_WEEK[i], ...row }))
      : EMPTY_WEEK,
    history: Array.isArray((editor.config as any)?.history) ? (editor.config as any).history : [],
  }), [editor.config]);
  const channels = useMemo(() => editor.channels.filter(channelType), [editor.channels]);

  function updateConfig(patch: Partial<Config>) {
    editor.setConfig({ ...cfg, ...patch });
  }
  function updateDay(index: number, patch: Partial<DaySlot>) {
    const schedule = cfg.schedule.map((row, i) => i === index ? { ...row, ...patch } : row);
    updateConfig({ schedule });
  }
  function insertEmoji(index: number, emoji: any) {
    const value = emoji?.animated
      ? `<a:${emoji.name}:${emoji.id}>`
      : `<:${emoji?.name || "emoji"}:${emoji?.id || ""}>`;
    updateDay(index, { content: `${cfg.schedule[index].content || ""}${cfg.schedule[index].content ? " " : ""}${value}` });
  }
  async function saveSchedule() {
    await editor.runAction("saveSchedule", { config: cfg });
  }
  async function publishDayNow(dayOfWeek: number) {
    const saved = await editor.runAction("saveSchedule", { config: cfg });
    if (saved) await editor.runAction("publishNow", { dayOfWeek });
  }

  return (
    <main style={{ maxWidth: 1320, margin: "0 auto", padding: "26px clamp(16px, 3vw, 42px) 70px", color: "#ffe0e9" }}>
      <header style={{ ...card, padding: "26px clamp(18px, 3vw, 36px)" }}>
        <div style={{ color: "#ff78a6", letterSpacing: ".18em", fontSize: 12, fontWeight: 800 }}>SERVER COMMUNICATION</div>
        <h1 style={{ color: "#ff4f8e", fontSize: "clamp(30px, 4vw, 48px)", margin: "8px 0" }}>Message of the Day</h1>
        <p style={{ margin: 0, lineHeight: 1.6 }}>Build a full week of server announcements. Each day has its own post time, channel, message, optional image, and role mentions. The WoW Groups MOTD remains separate.</p>
        <p style={{ color: "#f4a7bf", marginBottom: 0 }}>Server: <strong>{editor.guildName || "Select a server"}</strong></p>
      </header>

      <section style={card}>
        <h2 style={{ marginTop: 0 }}>Weekly schedule</h2>
        <div style={{ display: "grid", gridTemplateColumns: "minmax(240px, 1fr) minmax(170px, .6fr) minmax(160px, .5fr)", gap: 14, alignItems: "end" }}>
          <label>Schedule timezone<input style={{ ...field, display: "block", marginTop: 6 }} value={cfg.timezone} onChange={(e) => updateConfig({ timezone: e.target.value })} placeholder="America/Los_Angeles" /></label>
          <label>Minimum time between posts (minutes)<input style={{ ...field, display: "block", marginTop: 6 }} type="number" min={15} max={1440} value={cfg.minIntervalMinutes} onChange={(e) => updateConfig({ minIntervalMinutes: Number(e.target.value) })} /></label>
          <label style={{ display: "flex", alignItems: "center", gap: 9, padding: 10 }}><input type="checkbox" checked={cfg.enabled} onChange={(e) => updateConfig({ enabled: e.target.checked })} /> Enable weekly schedule</label>
        </div>
        <p style={{ color: "#d9a8b7", lineHeight: 1.5 }}>Time slots repeat weekly in the selected timezone. Posts must be at least the chosen interval apart, including across Sunday and Monday. Discord mentions are limited to the roles selected in that day’s row.</p>
      </section>

      {cfg.schedule.map((day, index) => (
        <section key={day.id || day.dayOfWeek} style={card}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <h2 style={{ margin: 0 }}>{DAYS[day.dayOfWeek]}</h2>
            <label style={{ display: "flex", alignItems: "center", gap: 8 }}><input type="checkbox" checked={day.enabled} onChange={(e) => updateDay(index, { enabled: e.target.checked })} /> Schedule this day</label>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "minmax(150px, .45fr) minmax(240px, 1fr)", gap: 12, marginTop: 14 }}>
            <label>Post time<input style={{ ...field, display: "block", marginTop: 6 }} type="time" value={day.time} onChange={(e) => updateDay(index, { time: e.target.value })} /></label>
            <label>Post channel<select style={{ ...field, display: "block", marginTop: 6 }} value={day.channelId} onChange={(e) => updateDay(index, { channelId: e.target.value })}><option value="">Choose a text channel</option>{channels.map((channel) => <option key={channel.id} value={channel.id}>#{channel.name}</option>)}</select></label>
          </div>
          <label style={{ display: "block", marginTop: 12 }}>Message title (optional)<input style={{ ...field, display: "block", marginTop: 6 }} maxLength={256} value={day.title} onChange={(e) => updateDay(index, { title: e.target.value })} placeholder="This appears above the post" /></label>
          <label style={{ display: "block", marginTop: 12 }}>Message<textarea style={{ ...field, display: "block", marginTop: 6, minHeight: 112, resize: "vertical" }} maxLength={2000} value={day.content} onChange={(e) => updateDay(index, { content: e.target.value })} placeholder="Write the announcement. Unicode emoji and Discord custom emoji markup are supported." /></label>
          {editor.emojis.length > 0 && <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8, alignItems: "center" }}><span style={{ color: "#d9a8b7", fontSize: 13 }}>Insert server emoji:</span>{editor.emojis.slice(0, 24).map((emoji: any) => <button key={emoji.id} type="button" title={`Insert :${emoji.name}:`} onClick={() => insertEmoji(index, emoji)} style={{ ...button, padding: "4px 8px", fontSize: 12 }}>{emoji.name}</button>)}</div>}
          <label style={{ display: "block", marginTop: 12 }}>Image URL (optional; HTTPS)<input style={{ ...field, display: "block", marginTop: 6 }} type="url" value={day.imageUrl} onChange={(e) => updateDay(index, { imageUrl: e.target.value })} placeholder="https://example.com/announcement-image.png" /></label>
          <fieldset style={{ border: "1px solid #65122e", borderRadius: 9, margin: "14px 0 0", padding: 12 }}><legend>Role mentions (optional)</legend>
            {editor.roles.length === 0 ? <span style={{ color: "#d9a8b7" }}>No server roles loaded.</span> : <div style={{ display: "flex", flexWrap: "wrap", gap: "8px 16px" }}>{editor.roles.filter((role) => role.id !== editor.guildId).map((role) => <label key={role.id} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><input type="checkbox" checked={day.mentionRoleIds.includes(role.id)} onChange={() => updateDay(index, { mentionRoleIds: day.mentionRoleIds.includes(role.id) ? day.mentionRoleIds.filter((id) => id !== role.id) : [...day.mentionRoleIds, role.id].slice(0, 10) })} />{role.name}</label>)}</div>}
          </fieldset>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap", marginTop: 12 }}>
            <span style={{ color: day.lastError ? "#ff8b8b" : "#d9a8b7", fontSize: 13 }}>{day.lastError ? `Last send failed: ${day.lastError}` : day.lastSentAt ? `Last posted ${new Date(day.lastSentAt).toLocaleString()}` : "No post sent yet"}</span>
            <button type="button" style={button} disabled={editor.saving || !editor.guildId} onClick={() => void publishDayNow(day.dayOfWeek)}>Save &amp; publish now</button>
          </div>
        </section>
      ))}

      <section style={{ ...card, position: "sticky", bottom: 10, zIndex: 2, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", boxShadow: "0 8px 30px #0009" }}>
        <button type="button" style={{ ...button, background: "linear-gradient(100deg,#ff4f8e,#d5005f)", padding: "12px 18px" }} disabled={editor.saving || editor.loading || !editor.guildId} onClick={() => void saveSchedule()}>{editor.saving ? "Saving…" : "Save weekly schedule"}</button>
        <button type="button" style={button} disabled={editor.loading || editor.saving} onClick={() => void editor.reload()}>Reload</button>
        {editor.message && <span role="status">{editor.message}</span>}
      </section>

      <section style={card}>
        <h2 style={{ marginTop: 0 }}>Recent posts</h2>
        {cfg.history.length ? cfg.history.slice(0, 12).map((entry, index) => <div key={`${entry.postedAt}-${index}`} style={{ borderTop: "1px solid #451326", padding: "10px 0", display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}><span>{DAYS[entry.dayOfWeek] || "Post"} · {entry.title || "Message of the Day"}</span><span>{entry.status === "failed" ? `Failed: ${entry.error || "send failed"}` : new Date(entry.postedAt).toLocaleString()}</span></div>) : <p style={{ color: "#d9a8b7" }}>No scheduled posts yet.</p>}
      </section>
    </main>
  );
}
