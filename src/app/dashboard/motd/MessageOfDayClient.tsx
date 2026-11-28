"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import GuildEmojiField from "@/components/possum/GuildEmojiField";
import { PossumCard } from "@/components/possum/PossumCard";
import { useGuildEngineEditor } from "@/components/possum/useGuildEngineEditor";

type QueueEntry = {
  id: string;
  date: string;
  time: string;
  timezone?: string;
  channelId: string;
  title: string;
  content: string;
  imageUrl: string;
  mentionRoleIds: string[];
  repeatEveryMinutes: number;
  repeatCount: number;
  status?: "scheduled" | "sending" | "failed" | "uncertain";
  nextAt?: string;
  sentCount?: number;
  lastError?: string;
};

type WeeklyReminder = {
  enabled: boolean;
  channelId: string;
  roleIds: string[];
  dayOfWeek: number;
  time: string;
  lastStatus?: "" | "sending" | "sent" | "failed" | "uncertain";
  lastError?: string;
  lastSentAt?: string;
};

type Config = {
  enabled: boolean;
  timezone: string;
  minIntervalMinutes: number;
  schedule: unknown[];
  queue: QueueEntry[];
  panelChannelId: string;
  weeklyReminder: WeeklyReminder;
  history: Array<{ postedAt: string; title?: string; channelId?: string; status?: string; error?: string }>;
};

const DEFAULT_WEEKLY_REMINDER: WeeklyReminder = {
  enabled: false,
  channelId: "",
  roleIds: [],
  dayOfWeek: 1,
  time: "09:00",
};

const DEFAULTS: Config = {
  enabled: false,
  timezone: "",
  minIntervalMinutes: 60,
  schedule: [],
  queue: [],
  panelChannelId: "",
  weeklyReminder: DEFAULT_WEEKLY_REMINDER,
  history: [],
};

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const subscribeToTimezone = () => () => {};
const getDeviceTimezone = () => Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
const getServerTimezone = () => "UTC";

const COMMON_TIMEZONES = [
  "America/Los_Angeles", "America/Denver", "America/Chicago", "America/New_York",
  "America/Toronto", "America/Vancouver", "America/Mexico_City", "America/Sao_Paulo",
  "Europe/London", "Europe/Dublin", "Europe/Paris", "Europe/Berlin", "Europe/Rome",
  "Europe/Athens", "Africa/Johannesburg", "Asia/Dubai", "Asia/Kolkata", "Asia/Singapore",
  "Asia/Tokyo", "Australia/Sydney", "Pacific/Auckland", "UTC",
];

const fieldClass = "mt-1 min-h-11 w-full rounded-lg border border-pink-900/60 bg-black/60 px-3 py-2 text-sm text-pink-50 outline-none focus:border-pink-500";
const buttonClass = "inline-flex min-h-10 items-center justify-center rounded-lg border border-pink-700/70 bg-pink-950/60 px-4 py-2 text-sm font-black uppercase text-pink-100 hover:border-pink-400 disabled:cursor-not-allowed disabled:opacity-50";
const primaryClass = "inline-flex min-h-10 items-center justify-center rounded-lg border border-pink-500 bg-gradient-to-r from-pink-600 to-rose-600 px-4 py-2 text-sm font-black uppercase text-white shadow-[0_0_20px_#ff2d7840] hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50";

function isTextChannel(channel: any) {
  return Number(channel?.type) === 0 || Number(channel?.type) === 5 || String(channel?.type || "").toLowerCase().includes("text");
}

function localDateForTimezone(date: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date);
  const part = (name: string) => parts.find((value) => value.type === name)?.value || "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

function makeBlankEntry(timezone: string): QueueEntry {
  return {
    id: "", date: timezone ? localDateForTimezone(new Date(), timezone) : "", time: "09:00",
    timezone, channelId: "", title: "", content: "", imageUrl: "", mentionRoleIds: [],
    repeatEveryMinutes: 360, repeatCount: 0,
  };
}

function createQueueEntryId() {
  return `motd-${globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`}`;
}

export default function MessageOfDayClient() {
  const editor = useGuildEngineEditor<Config>("messageOfDay", DEFAULTS);
  const deviceTimezone = useSyncExternalStore(subscribeToTimezone, getDeviceTimezone, getServerTimezone);
  const [draft, setDraft] = useState<QueueEntry>(() => makeBlankEntry(""));
  const [editingId, setEditingId] = useState("");
  const [panelDraft, setPanelDraft] = useState<{ guildId: string; channelId: string } | null>(null);
  const [weeklyReminderDraft, setWeeklyReminderDraft] = useState<{ guildId: string; value: WeeklyReminder } | null>(null);

  const cfg = useMemo<Config>(() => {
    const raw = (editor.config || {}) as Partial<Config>;
    return {
      ...DEFAULTS,
      ...raw,
      queue: Array.isArray(raw.queue) ? raw.queue : [],
      schedule: Array.isArray(raw.schedule) ? raw.schedule : [],
      weeklyReminder: { ...DEFAULT_WEEKLY_REMINDER, ...(raw.weeklyReminder || {}), roleIds: Array.isArray(raw.weeklyReminder?.roleIds) ? raw.weeklyReminder.roleIds : [] },
      history: Array.isArray(raw.history) ? raw.history : [],
    };
  }, [editor.config]);
  const timezone = cfg.timezone || deviceTimezone;
  const displayDate = draft.date || (timezone ? localDateForTimezone(new Date(), timezone) : "");
  const scheduledDraft = { ...draft, date: displayDate };
  const panelChannelId = panelDraft?.guildId === editor.guildId ? panelDraft.channelId : cfg.panelChannelId || "";
  const weeklyReminder = weeklyReminderDraft?.guildId === editor.guildId ? weeklyReminderDraft.value : cfg.weeklyReminder;
  const channels = useMemo(() => editor.channels.filter(isTextChannel), [editor.channels]);
  const timezoneOptions = useMemo(() => [...new Set([timezone, deviceTimezone, ...COMMON_TIMEZONES])].filter(Boolean), [timezone, deviceTimezone]);
  const queue = useMemo(() => [...cfg.queue].sort((a, b) => {
    const aa = a.nextAt || `${a.date}T${a.time}`;
    const bb = b.nextAt || `${b.date}T${b.time}`;
    return aa.localeCompare(bb);
  }), [cfg.queue]);

  function patchDraft(patch: Partial<QueueEntry>) {
    setDraft((current) => ({ ...current, ...patch }));
  }

  function resetDraft() {
    setDraft(makeBlankEntry(timezone));
    setEditingId("");
  }

  function toggleRole(roleId: string) {
    setDraft((current) => {
      const selected = current.mentionRoleIds.includes(roleId);
      if (!selected && current.mentionRoleIds.length >= 10) return current;
      return { ...current, mentionRoleIds: selected ? current.mentionRoleIds.filter((id) => id !== roleId) : [...current.mentionRoleIds, roleId] };
    });
  }

  async function scheduleEntry() {
    if (!scheduledDraft.date || !scheduledDraft.time || !scheduledDraft.channelId || (!scheduledDraft.content.trim() && !scheduledDraft.title.trim() && !scheduledDraft.imageUrl.trim())) return;
    const id = editingId || createQueueEntryId();
    const next = { ...scheduledDraft, timezone, id, status: "scheduled" as const };
    const nextQueue = editingId ? cfg.queue.map((entry) => entry.id === editingId ? next : entry) : [...cfg.queue, next];
    const result = await editor.runAction("saveQueue", { config: { timezone, minIntervalMinutes: cfg.minIntervalMinutes, queue: nextQueue } });
    if (result?.ok) resetDraft();
  }

  async function postNow() {
    if (!draft.channelId || (!draft.content.trim() && !draft.title.trim() && !draft.imageUrl.trim())) return;
    const result = await editor.runAction("postNow", { timezone, entry: { ...draft, timezone } });
    if (result?.ok) resetDraft();
  }

  async function removeQueueEntry(entry: QueueEntry) {
    const nextQueue = cfg.queue.filter((item) => item.id !== entry.id);
    await editor.runAction("saveQueue", { config: { timezone, minIntervalMinutes: cfg.minIntervalMinutes, queue: nextQueue } });
  }

  function editQueueEntry(entry: QueueEntry) {
    if (entry.status === "sending" || entry.status === "uncertain") return;
    setEditingId(entry.id);
    setDraft({ ...entry, status: undefined, lastError: "" });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function savePanelDestination() {
    const result = await editor.runAction("savePanel", { channelId: panelChannelId });
    if (result?.ok) setPanelDraft(null);
  }

  async function publishPanel() {
    if (!panelChannelId) return;
    await editor.runAction("deployPanel", { channelId: panelChannelId });
  }

  function updateWeeklyReminder(update: Partial<WeeklyReminder> | ((current: WeeklyReminder) => WeeklyReminder)) {
    const current = weeklyReminder;
    const value = typeof update === "function" ? update(current) : { ...current, ...update };
    setWeeklyReminderDraft({ guildId: editor.guildId, value });
  }

  function toggleReminderRole(roleId: string) {
    updateWeeklyReminder((current) => {
      const selected = current.roleIds.includes(roleId);
      if (!selected && current.roleIds.length >= 10) return current;
      return { ...current, roleIds: selected ? current.roleIds.filter((id) => id !== roleId) : [...current.roleIds, roleId] };
    });
  }

  async function saveWeeklyReminder() {
    const result = await editor.runAction("saveWeeklyReminder", { config: { timezone, weeklyReminder } });
    if (result?.ok) setWeeklyReminderDraft(null);
  }

  const canSubmit = Boolean(scheduledDraft.date && scheduledDraft.time && scheduledDraft.channelId && (scheduledDraft.content.trim() || scheduledDraft.title.trim() || scheduledDraft.imageUrl.trim()));

  return (
    <main className="mx-auto max-w-6xl space-y-4 px-4 py-6 pb-24 text-pink-50 sm:px-6">
      <PossumCard title="Server communication" description="One dated composer · automatic delivery · no repeated weekday forms">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-3xl font-black uppercase tracking-wide text-pink-400 sm:text-4xl">Message of the Day</h1>
            <p className="mt-2 text-sm text-pink-100/75">Write today’s post or schedule a future day. The dated queue runs in order and keeps the existing weekly schedule data untouched.</p>
          </div>
          <div className="rounded-lg border border-pink-900/60 bg-black/35 px-3 py-2 text-sm">Server: <strong>{editor.guildName || "Select a server"}</strong></div>
        </div>
      </PossumCard>

      <PossumCard title={editingId ? "Edit scheduled message" : "Compose one message"} description="Choose its destination, day, mentions, and optional repost interval">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="text-xs font-bold uppercase tracking-wide text-pink-200">Post date<input className={fieldClass} type="date" value={displayDate} onChange={(event) => patchDraft({ date: event.target.value })} /></label>
          <label className="text-xs font-bold uppercase tracking-wide text-pink-200">Post time<input className={fieldClass} type="time" value={draft.time} onChange={(event) => patchDraft({ time: event.target.value })} /></label>
          <label className="text-xs font-bold uppercase tracking-wide text-pink-200">Timezone<select className={fieldClass} value={timezone} onChange={(event) => editor.setConfig({ ...cfg, timezone: event.target.value })}>{timezoneOptions.map((zone) => <option key={zone} value={zone}>{zone}{zone === deviceTimezone ? " · device" : ""}</option>)}</select></label>
          <label className="text-xs font-bold uppercase tracking-wide text-pink-200">Post channel<select className={fieldClass} value={draft.channelId} onChange={(event) => patchDraft({ channelId: event.target.value })}><option value="">Choose a text channel</option>{channels.map((channel) => <option key={channel.id} value={channel.id}>#{channel.name}</option>)}</select></label>
        </div>

        <div className="mt-3 grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(230px,.48fr)]">
          <div className="space-y-3">
            <label className="block text-xs font-bold uppercase tracking-wide text-pink-200">Title (optional)<input className={fieldClass} maxLength={256} value={draft.title} onChange={(event) => patchDraft({ title: event.target.value })} placeholder="A short heading for the post" /></label>
            <label className="block text-xs font-bold uppercase tracking-wide text-pink-200">Message<GuildEmojiField emojis={editor.emojis} onInsert={(content) => patchDraft({ content })} loading={editor.loading}><textarea className={`${fieldClass} min-h-36 resize-y`} maxLength={1900} value={draft.content} onChange={(event) => patchDraft({ content: event.target.value })} placeholder="Write the message. Choose a server emoji below to insert it at the cursor." /></GuildEmojiField></label>
            <label className="block text-xs font-bold uppercase tracking-wide text-pink-200">Image URL (optional)<input className={fieldClass} type="url" value={draft.imageUrl} onChange={(event) => patchDraft({ imageUrl: event.target.value })} placeholder="https://…" /></label>
          </div>

          <div className="space-y-3">
            <fieldset className="rounded-lg border border-pink-900/50 bg-black/25 p-3">
              <legend className="px-1 text-xs font-black uppercase tracking-wide text-pink-300">Ping roles · up to 10</legend>
              <div className="max-h-64 space-y-1 overflow-auto pr-1">
                {editor.roles.filter((role) => role.id !== editor.guildId).map((role) => <label key={role.id} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-pink-950/40"><input type="checkbox" checked={draft.mentionRoleIds.includes(role.id)} disabled={!draft.mentionRoleIds.includes(role.id) && draft.mentionRoleIds.length >= 10} onChange={() => toggleRole(role.id)} /><span>{role.name}</span></label>)}
                {!editor.roles.length ? <p className="text-sm text-pink-100/60">No roles loaded for this server.</p> : null}
              </div>
            </fieldset>

            <fieldset className="rounded-lg border border-pink-900/50 bg-black/25 p-3">
              <legend className="px-1 text-xs font-black uppercase tracking-wide text-pink-300">Repeat this post (optional)</legend>
              <div className="grid grid-cols-2 gap-2">
                <label className="text-xs text-pink-100/75">Extra repeats<input className={fieldClass} type="number" min={0} max={24} value={draft.repeatCount} onChange={(event) => patchDraft({ repeatCount: Number(event.target.value) })} /></label>
                <label className="text-xs text-pink-100/75">Hours apart<input className={fieldClass} type="number" min={1} max={168} value={Math.max(1, Math.round(draft.repeatEveryMinutes / 60))} onChange={(event) => patchDraft({ repeatEveryMinutes: Number(event.target.value) * 60 })} /></label>
              </div>
              <p className="mt-2 text-xs text-pink-100/55">Each repost uses the same channel, message, image, and role mentions. Posts are checked for overlaps.</p>
            </fieldset>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-pink-900/50 pt-4">
          <button type="button" className={primaryClass} disabled={!canSubmit || editor.saving || editor.loading || !editor.guildId} onClick={() => void scheduleEntry()}>{editor.saving ? "Saving…" : editingId ? "Save this day" : "Schedule for this day"}</button>
          <button type="button" className={buttonClass} disabled={!canSubmit || editor.saving || editor.loading || !editor.guildId} onClick={() => void postNow()}>Post now</button>
          {editingId ? <button type="button" className={buttonClass} disabled={editor.saving} onClick={resetDraft}>Cancel edit</button> : null}
          <label className="ml-auto flex items-center gap-2 text-xs text-pink-100/75">Minimum gap between posts (minutes)<input className="w-24 rounded-md border border-pink-900/60 bg-black/60 px-2 py-2 text-sm" type="number" min={15} max={1440} value={cfg.minIntervalMinutes} onChange={(event) => editor.setConfig({ ...cfg, minIntervalMinutes: Number(event.target.value) })} /></label>
        </div>
        {editor.message ? <p role="status" className="mt-3 rounded-lg border border-pink-900/50 bg-black/25 px-3 py-2 text-sm text-pink-100">{editor.message}</p> : null}
      </PossumCard>

      <PossumCard title={`Upcoming queue · ${queue.length}`} description="One compact chronological list for today and future dates">
        {queue.length ? <div className="divide-y divide-pink-900/50">
          {queue.map((entry) => {
            const channelName = channels.find((channel) => channel.id === entry.channelId)?.name || "Saved channel";
            const status = entry.status || "scheduled";
            return <article key={entry.id} className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2"><strong>{entry.title || "Message of the Day"}</strong><span className="rounded-full border border-pink-900/60 px-2 py-0.5 text-[10px] font-black uppercase text-pink-200">{status}</span></div>
                <p className="mt-1 text-xs text-pink-100/65">{entry.date} · {entry.time} {entry.timezone || timezone} · #{channelName}{entry.mentionRoleIds?.length ? ` · ${entry.mentionRoleIds.length} role pings` : ""}{entry.repeatCount ? ` · ${entry.repeatCount} repeats every ${Math.round(entry.repeatEveryMinutes / 60)}h` : ""}</p>
                <p className="mt-1 line-clamp-2 text-sm text-pink-100/80">{entry.content || "Image post"}</p>
                {entry.lastError ? <p className="mt-1 text-xs text-red-300">{entry.lastError}</p> : null}
              </div>
              <div className="flex gap-2"><button type="button" className={buttonClass} disabled={status === "sending" || status === "uncertain" || editor.saving} onClick={() => editQueueEntry(entry)}>Edit</button><button type="button" className={buttonClass} disabled={status === "sending" || editor.saving} onClick={() => void removeQueueEntry(entry)}>Remove</button></div>
            </article>;
          })}
        </div> : <p className="text-sm text-pink-100/65">Nothing is scheduled. Use the composer above to add the next day’s post.</p>}
      </PossumCard>

      <PossumCard title="Persistent Discord panel" description="Keep one interactive MOTD panel in a server channel and refresh that same panel as staff update it">
        <div className="grid gap-3 sm:grid-cols-[minmax(220px,1fr)_auto_auto] sm:items-end">
          <label className="text-xs font-bold uppercase tracking-wide text-pink-200">Panel channel<select className={fieldClass} value={panelChannelId} onChange={(event) => setPanelDraft({ guildId: editor.guildId, channelId: event.target.value })}><option value="">Choose a text channel</option>{channels.map((channel) => <option key={channel.id} value={channel.id}>#{channel.name}</option>)}</select></label>
          <button type="button" className={buttonClass} disabled={!panelChannelId || editor.saving || editor.loading} onClick={() => void savePanelDestination()}>Save panel channel</button>
          <button type="button" className={primaryClass} disabled={!panelChannelId || editor.saving || editor.loading} onClick={() => void publishPanel()}>Post / refresh panel</button>
        </div>
        <p className="mt-2 text-xs text-pink-100/60">Possum updates the existing panel message in place when it can find it. It does not publish or overwrite a scheduled post.</p>
      </PossumCard>

      <PossumCard title="Weekly staff reminder" description="Nudge staff once if no recurring, scheduled, or delivered Message of the Day exists during the current week">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="flex min-h-11 items-center gap-2 rounded-lg border border-pink-900/60 bg-black/35 px-3 text-sm font-bold text-pink-100 sm:col-span-2 lg:col-span-4">
            <input type="checkbox" checked={weeklyReminder.enabled} onChange={(event) => updateWeeklyReminder({ enabled: event.target.checked })} />
            Enable the weekly reminder
          </label>
          <label className="text-xs font-bold uppercase tracking-wide text-pink-200">Staff channel<select className={fieldClass} value={weeklyReminder.channelId} disabled={!weeklyReminder.enabled} onChange={(event) => updateWeeklyReminder({ channelId: event.target.value })}><option value="">Choose a staff text channel</option>{channels.map((channel) => <option key={channel.id} value={channel.id}>#{channel.name}</option>)}</select></label>
          <label className="text-xs font-bold uppercase tracking-wide text-pink-200">Reminder day<select className={fieldClass} value={weeklyReminder.dayOfWeek} disabled={!weeklyReminder.enabled} onChange={(event) => updateWeeklyReminder({ dayOfWeek: Number(event.target.value) })}>{WEEKDAYS.map((day, index) => <option key={day} value={index}>{day}</option>)}</select></label>
          <label className="text-xs font-bold uppercase tracking-wide text-pink-200">Reminder time<input className={fieldClass} type="time" value={weeklyReminder.time} disabled={!weeklyReminder.enabled} onChange={(event) => updateWeeklyReminder({ time: event.target.value })} /></label>
          <label className="text-xs font-bold uppercase tracking-wide text-pink-200">Timezone<select className={fieldClass} value={timezone} onChange={(event) => editor.setConfig({ ...cfg, timezone: event.target.value })}>{timezoneOptions.map((zone) => <option key={zone} value={zone}>{zone}{zone === deviceTimezone ? " · device" : ""}</option>)}</select></label>
        </div>
        <fieldset disabled={!weeklyReminder.enabled} className="mt-3 rounded-lg border border-pink-900/50 bg-black/25 p-3 disabled:opacity-60">
          <legend className="px-1 text-xs font-black uppercase tracking-wide text-pink-300">Staff role pings · optional · up to 10</legend>
          <div className="grid max-h-40 gap-1 overflow-auto sm:grid-cols-2 lg:grid-cols-3">
            {editor.roles.filter((role) => role.id !== editor.guildId).map((role) => <label key={role.id} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-pink-950/40"><input type="checkbox" checked={weeklyReminder.roleIds.includes(role.id)} disabled={!weeklyReminder.roleIds.includes(role.id) && weeklyReminder.roleIds.length >= 10} onChange={() => toggleReminderRole(role.id)} /><span>{role.name}</span></label>)}
            {!editor.roles.length ? <p className="text-sm text-pink-100/60">No roles loaded. The reminder can still post in the selected staff channel without pinging a role.</p> : null}
          </div>
        </fieldset>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button type="button" className={primaryClass} disabled={editor.saving || editor.loading || !editor.guildId || (weeklyReminder.enabled && !weeklyReminder.channelId)} onClick={() => void saveWeeklyReminder()}>{editor.saving ? "Saving…" : "Save weekly reminder"}</button>
          <span className="text-xs text-pink-100/60">The reminder uses the timezone above and will not send when an MOTD is already set for that week.</span>
        </div>
        {cfg.weeklyReminder.lastStatus ? <p className={`mt-3 rounded-lg border px-3 py-2 text-sm ${cfg.weeklyReminder.lastStatus === "failed" || cfg.weeklyReminder.lastStatus === "uncertain" ? "border-red-700/60 bg-red-950/25 text-red-200" : "border-pink-900/50 bg-black/25 text-pink-100"}`} role="status">
          Last reminder: {cfg.weeklyReminder.lastStatus}{cfg.weeklyReminder.lastSentAt ? ` · ${new Date(cfg.weeklyReminder.lastSentAt).toLocaleString()}` : ""}{cfg.weeklyReminder.lastError ? ` · ${cfg.weeklyReminder.lastError}` : ""}
        </p> : null}
      </PossumCard>

      <PossumCard title="Recent posts" description="Delivery history for scheduled and immediate messages">
        {cfg.history.length ? <div className="divide-y divide-pink-900/50">{cfg.history.slice(0, 12).map((entry, index) => <div key={`${entry.postedAt}-${index}`} className="flex flex-wrap justify-between gap-2 py-2 text-sm first:pt-0"><span>{entry.title || "Message of the Day"}</span><span className={entry.status === "failed" ? "text-red-300" : "text-pink-100/60"}>{entry.status === "failed" ? `Failed: ${entry.error || "send failed"}` : new Date(entry.postedAt).toLocaleString()}</span></div>)}</div> : <p className="text-sm text-pink-100/60">No posts recorded yet.</p>}
      </PossumCard>
    </main>
  );
}
