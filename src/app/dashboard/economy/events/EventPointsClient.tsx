"use client";

import { useMemo, useState } from "react";
import type { CSSProperties } from "react";
import EngineInsights from "@/components/possum/EngineInsights";
import { useGuildEngineEditor } from "@/components/possum/useGuildEngineEditor";

type HouseConfig = {
  id: string;
  label: string;
  emoji: string;
  roleId: string;
  colorHex: string;
};

type TaskConfig = {
  id: string;
  label: string;
  emoji: string;
  points: number;
  currency: number;
  description: string;
};

type Config = {
  enabled: boolean;
  currencyName: string;
  currencyEmoji: string;
  groupLabelSingular: string;
  groupLabelPlural: string;
  eventChannelId: string;
  announceChannelId: string;
  logChannelId: string;
  scoreboardChannelId: string;
  broadcastAwardAnnouncements: boolean;
  linkToEconomy: boolean;
  economyCoinsPerCurrency: number;
  boardColorHex: string;
  boardTitleTemplate: string;
  boardDescriptionTemplate: string;
  awardAnnouncementTemplate: string;
  closeAnnouncementTemplate: string;
  boardImageUrl: string;
  boardThumbnailUrl: string;
  defaultEventImageUrl: string;
  defaultEventThumbnailUrl: string;
  houses: HouseConfig[];
  taskTemplates: TaskConfig[];
  notes: string;
};

type RuntimeRow = {
  id?: string;
  eventId?: string;
  title?: string;
  name?: string;
  value?: string;
  status?: string;
};

const DEFAULTS: Config = {
  enabled: false,
  currencyName: "Crowns",
  currencyEmoji: "\uD83D\uDC51",
  groupLabelSingular: "House",
  groupLabelPlural: "Houses",
  eventChannelId: "",
  announceChannelId: "",
  logChannelId: "",
  scoreboardChannelId: "",
  broadcastAwardAnnouncements: false,
  linkToEconomy: false,
  economyCoinsPerCurrency: 0,
  boardColorHex: "#ff4a4a",
  boardTitleTemplate: "{eventTitle} - {groupLabelPlural} Standings",
  boardDescriptionTemplate: "{eventDescription}\n\n{groupStandings}",
  awardAnnouncementTemplate: "{groupEmoji} {groupName} earned **{points}** points and **{currency} {currencyEmoji} {currencyName}** for {reason}.",
  closeAnnouncementTemplate: "{eventTitle} is complete. {winnerLine}",
  boardImageUrl: "",
  boardThumbnailUrl: "",
  defaultEventImageUrl: "",
  defaultEventThumbnailUrl: "",
  houses: [
    { id: "house_1", label: "House One", emoji: "\uD83D\uDFE5", roleId: "", colorHex: "#ff4a4a" },
    { id: "house_2", label: "House Two", emoji: "\uD83D\uDFE6", roleId: "", colorHex: "#53a7ff" },
    { id: "house_3", label: "House Three", emoji: "\uD83D\uDFE9", roleId: "", colorHex: "#57d17a" },
    { id: "house_4", label: "House Four", emoji: "\uD83D\uDFE8", roleId: "", colorHex: "#ffd057" },
  ],
  taskTemplates: [
    { id: "task_complete", label: "Task Complete", emoji: "\u2705", points: 10, currency: 5, description: "Default event task reward." },
    { id: "bonus_round", label: "Bonus Round", emoji: "\u2B50", points: 20, currency: 10, description: "Bonus event reward." },
    { id: "final_push", label: "Final Push", emoji: "\uD83C\uDFC1", points: 30, currency: 15, description: "Late-round comeback reward." },
  ],
  notes: "",
};

const box: CSSProperties = {
  border: "1px solid #5f0000",
  borderRadius: 12,
  padding: 14,
  background: "rgba(120,0,0,0.10)",
  marginBottom: 12,
};

const input: CSSProperties = {
  width: "100%",
  padding: 10,
  borderRadius: 8,
  border: "1px solid #6f0000",
  background: "#0a0a0a",
  color: "#ffd7d7",
};

function readSnowflake(value: string) {
  const match = String(value || "").match(/\d{16,20}/);
  return match ? match[0] : "";
}

function makeGroupEntry(index: number, singularLabel = "House"): HouseConfig {
  return {
    id: `house_${index + 1}`,
    label: `${singularLabel} ${index + 1}`,
    emoji: "\uD83D\uDFE5",
    roleId: "",
    colorHex: "#ff4a4a",
  };
}

export default function EventPointsClient() {
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
  } = useGuildEngineEditor<Config>("eventPoints", DEFAULTS);

  const cfg = useMemo(() => {
    const source = rawCfg || {};
    return {
      ...DEFAULTS,
      ...source,
      houses: Array.isArray(source.houses) ? source.houses.slice(0, 25) : DEFAULTS.houses,
      taskTemplates: Array.isArray(source.taskTemplates) ? source.taskTemplates.slice(0, 25) : DEFAULTS.taskTemplates,
    };
  }, [rawCfg]);
  const textChannels = useMemo(
    () => channels.filter((c) => Number(c?.type) === 0 || Number(c?.type) === 5 || String(c?.type || "").toLowerCase().includes("text")),
    [channels]
  );
  const activeEvents = useMemo(() => (Array.isArray((details as any)?.activeEvents) ? ((details as any).activeEvents as RuntimeRow[]) : []), [details]);
  const houseRows = useMemo(() => (Array.isArray((details as any)?.houses) ? ((details as any).houses as RuntimeRow[]) : []), [details]);
  const balanceRows = useMemo(() => (Array.isArray((details as any)?.memberBalances) ? ((details as any).memberBalances as RuntimeRow[]) : []), [details]);
  const recentAwardRows = useMemo(() => (Array.isArray((details as any)?.recentAwards) ? ((details as any).recentAwards as RuntimeRow[]) : []), [details]);
  const groupLabelSingular = String(cfg.groupLabelSingular || "House").trim() || "House";
  const groupLabelPlural = String(cfg.groupLabelPlural || "Houses").trim() || "Houses";
  const groupLabelSingularLower = groupLabelSingular.toLowerCase();
  const groupLabelPluralLower = groupLabelPlural.toLowerCase();

  const [createForm, setCreateForm] = useState({
    title: "Friday Event Night",
    description: "Track each team as they finish event tasks.",
    channelId: "",
    imageUrl: "",
    thumbnailUrl: "",
  });
  const [awardForm, setAwardForm] = useState({
    eventId: "",
    houseId: "",
    taskId: "",
    points: "10",
    currency: "5",
    reason: "Task complete",
    memberUserId: "",
  });
  const selectedEventId = awardForm.eventId || String(activeEvents[0]?.eventId || activeEvents[0]?.id || "");
  const selectedHouseId = awardForm.houseId || String(cfg.houses[0]?.id || "");

  function updateHouse(index: number, patch: Partial<HouseConfig>) {
    const next = cfg.houses.map((entry, entryIndex) => (entryIndex === index ? { ...entry, ...patch } : entry));
    setCfg({ ...cfg, houses: next });
  }

  function addHouse() {
    if (cfg.houses.length >= 25) return;
    const next = [...cfg.houses, makeGroupEntry(cfg.houses.length, groupLabelSingular)];
    setCfg({ ...cfg, houses: next });
  }

  function removeHouse(index: number) {
    const next = cfg.houses.filter((_, entryIndex) => entryIndex !== index);
    setCfg({ ...cfg, houses: next.length ? next : [makeGroupEntry(0, groupLabelSingular)] });
  }

  function updateTask(index: number, patch: Partial<TaskConfig>) {
    const next = cfg.taskTemplates.map((entry, entryIndex) => (entryIndex === index ? { ...entry, ...patch } : entry));
    setCfg({ ...cfg, taskTemplates: next });
  }

  function addTask() {
    if (cfg.taskTemplates.length >= 25) return;
    const next = [...cfg.taskTemplates, { id: `task_${cfg.taskTemplates.length + 1}`, label: `Task ${cfg.taskTemplates.length + 1}`, emoji: "\u2705", points: 10, currency: 5, description: "" }];
    setCfg({ ...cfg, taskTemplates: next });
  }

  function removeTask(index: number) {
    const next = cfg.taskTemplates.filter((_, entryIndex) => entryIndex !== index);
    setCfg({ ...cfg, taskTemplates: next.length ? next : DEFAULTS.taskTemplates });
  }

  function clampInteger(value: unknown, min: number, max: number, fallback = min) {
    const number = Number(value);
    return Number.isFinite(number) ? Math.min(max, Math.max(min, Math.floor(number))) : fallback;
  }

  function normalizedConfig() {
    return {
      ...cfg,
      economyCoinsPerCurrency: Math.min(1_000_000, Math.max(0, Number.isFinite(Number(cfg.economyCoinsPerCurrency)) ? Number(cfg.economyCoinsPerCurrency) : 0)),
      houses: cfg.houses.slice(0, 25),
      taskTemplates: cfg.taskTemplates.slice(0, 25).map((task) => ({
        ...task,
        points: clampInteger(task.points, 0, 1_000_000_000),
        currency: clampInteger(task.currency, 0, 1_000_000_000),
      })),
    };
  }

  async function createEvent() {
    const result = await runAction("createEvent", createForm);
    if (result?.ok) {
      setCreateForm((prev) => ({ ...prev, title: "", description: "", imageUrl: "", thumbnailUrl: "" }));
    }
  }

  async function awardTask() {
    await runAction("awardTask", {
      eventId: selectedEventId,
      houseId: selectedHouseId,
      taskId: awardForm.taskId,
      memberUserId: readSnowflake(awardForm.memberUserId),
      reason: awardForm.reason,
    });
  }

  async function awardCustom() {
    await runAction("awardCustom", {
      eventId: selectedEventId,
      houseId: selectedHouseId,
      points: Number(awardForm.points || 0),
      currency: Number(awardForm.currency || 0),
      memberUserId: readSnowflake(awardForm.memberUserId),
      reason: awardForm.reason,
    });
  }

  if (!guildId) return <div style={{ color: "#ff8a8a", padding: 20 }}>Missing guildId. Open from /guilds.</div>;
  if (loading) return <div style={{ color: "#ff8a8a", padding: 20 }}>Loading event points...</div>;

  return (
    <div style={{ color: "#ffb3b3", padding: 14, maxWidth: 1400 }}>
      <h1 style={{ marginTop: 0, color: "#ff3b3b", letterSpacing: "0.08em", textTransform: "uppercase" }}>Event Points Studio</h1>
      <p style={{ marginTop: 0 }}>Guild: {guildName || guildId}</p>
      <p style={{ color: "#ffb7b7", marginTop: -4, lineHeight: 1.6 }}>
        This is a separate per-guild event currency and scoring engine for {groupLabelPluralLower}. It stays separate from the main economy,
        but can mirror rewards into economy coins when you want the two systems tied together.
      </p>
      {message ? <div style={{ color: "#ffb3f0", marginBottom: 8 }}>{message}</div> : null}
      {!cfg.enabled ? <div style={{ ...box, color: "#ffb3f0" }}>Enable Event points in Core Controls before creating events or awarding points.</div> : null}

      <EngineInsights summary={summary} details={details} showDetails />

      <div style={box}>
        <h3 style={{ marginTop: 0, color: "#ff4444" }}>Core Controls</h3>
        <label><input type="checkbox" checked={cfg.enabled} onChange={(e) => setCfg({ ...cfg, enabled: e.target.checked })} /> Event points enabled</label><br />
        <label><input type="checkbox" checked={cfg.broadcastAwardAnnouncements} onChange={(e) => setCfg({ ...cfg, broadcastAwardAnnouncements: e.target.checked })} /> Broadcast award announcements</label><br />
        <label><input type="checkbox" checked={cfg.linkToEconomy} onChange={(e) => setCfg({ ...cfg, linkToEconomy: e.target.checked })} /> Mirror member event currency into economy</label>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(180px, 1fr))", gap: 10, marginTop: 10 }}>
          <div>
            <label>Currency name</label>
            <input style={input} value={cfg.currencyName} onChange={(e) => setCfg({ ...cfg, currencyName: e.target.value })} />
          </div>
          <div>
            <label>Currency emoji</label>
            <input style={input} value={cfg.currencyEmoji} onChange={(e) => setCfg({ ...cfg, currencyEmoji: e.target.value })} />
          </div>
          <div>
            <label>{groupLabelSingular} label</label>
            <input style={input} value={cfg.groupLabelSingular} onChange={(e) => setCfg({ ...cfg, groupLabelSingular: e.target.value })} />
          </div>
          <div>
            <label>{groupLabelPlural} label</label>
            <input style={input} value={cfg.groupLabelPlural} onChange={(e) => setCfg({ ...cfg, groupLabelPlural: e.target.value })} />
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(180px, 1fr))", gap: 10, marginTop: 10 }}>
          <div>
            <label>Economy coins per currency</label>
            <input style={input} type="number" value={cfg.economyCoinsPerCurrency} onChange={(e) => setCfg({ ...cfg, economyCoinsPerCurrency: Number(e.target.value || 0) })} />
          </div>
          <div>
            <label>Board color</label>
            <input style={input} value={cfg.boardColorHex} onChange={(e) => setCfg({ ...cfg, boardColorHex: e.target.value })} />
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(180px, 1fr))", gap: 10, marginTop: 10 }}>
          <div>
            <label>Default event channel</label>
            <select style={input} value={cfg.eventChannelId} onChange={(e) => setCfg({ ...cfg, eventChannelId: e.target.value })}>
              <option value="">Select channel</option>
              {textChannels.map((c) => <option key={c.id} value={c.id}>#{c.name}</option>)}
            </select>
          </div>
          <div>
            <label>Announcement channel</label>
            <select style={input} value={cfg.announceChannelId} onChange={(e) => setCfg({ ...cfg, announceChannelId: e.target.value })}>
              <option value="">Select channel</option>
              {textChannels.map((c) => <option key={c.id} value={c.id}>#{c.name}</option>)}
            </select>
          </div>
          <div>
            <label>Log channel</label>
            <select style={input} value={cfg.logChannelId} onChange={(e) => setCfg({ ...cfg, logChannelId: e.target.value })}>
              <option value="">Select channel</option>
              {textChannels.map((c) => <option key={c.id} value={c.id}>#{c.name}</option>)}
            </select>
          </div>
          <div>
            <label>Scoreboard channel</label>
            <select style={input} value={cfg.scoreboardChannelId} onChange={(e) => setCfg({ ...cfg, scoreboardChannelId: e.target.value })}>
              <option value="">Select channel</option>
              {textChannels.map((c) => <option key={c.id} value={c.id}>#{c.name}</option>)}
            </select>
          </div>
        </div>
      </div>

      <div style={box}>
        <h3 style={{ marginTop: 0, color: "#ff4444" }}>Images and Copy</h3>
        <div style={{ color: "#ffb7b7", marginBottom: 10, lineHeight: 1.6 }}>
          Tokens: <code>{`{eventTitle}`}</code>, <code>{`{eventDescription}`}</code>, <code>{`{houseStandings}`}</code>, <code>{`{groupStandings}`}</code>, <code>{`{currencyName}`}</code>, <code>{`{currencyEmoji}`}</code>, <code>{`{winnerLine}`}</code>, <code>{`{houseName}`}</code>, <code>{`{houseEmoji}`}</code>, <code>{`{groupName}`}</code>, <code>{`{groupEmoji}`}</code>, <code>{`{groupLabelSingular}`}</code>, <code>{`{groupLabelPlural}`}</code>, <code>{`{points}`}</code>, <code>{`{currency}`}</code>, <code>{`{reason}`}</code>.
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(260px, 1fr))", gap: 10 }}>
          <div>
            <label>Board title template</label>
            <input style={input} value={cfg.boardTitleTemplate} onChange={(e) => setCfg({ ...cfg, boardTitleTemplate: e.target.value })} />
          </div>
          <div>
            <label>Close announcement</label>
            <input style={input} value={cfg.closeAnnouncementTemplate} onChange={(e) => setCfg({ ...cfg, closeAnnouncementTemplate: e.target.value })} />
          </div>
          <div style={{ gridColumn: "1 / -1" }}>
            <label>Board description template</label>
            <textarea style={{ ...input, minHeight: 120 }} value={cfg.boardDescriptionTemplate} onChange={(e) => setCfg({ ...cfg, boardDescriptionTemplate: e.target.value })} />
          </div>
          <div style={{ gridColumn: "1 / -1" }}>
            <label>Award announcement template</label>
            <textarea style={{ ...input, minHeight: 120 }} value={cfg.awardAnnouncementTemplate} onChange={(e) => setCfg({ ...cfg, awardAnnouncementTemplate: e.target.value })} />
          </div>
          <div>
            <label>Board image URL</label>
            <input style={input} value={cfg.boardImageUrl} onChange={(e) => setCfg({ ...cfg, boardImageUrl: e.target.value })} />
          </div>
          <div>
            <label>Board thumbnail URL</label>
            <input style={input} value={cfg.boardThumbnailUrl} onChange={(e) => setCfg({ ...cfg, boardThumbnailUrl: e.target.value })} />
          </div>
          <div>
            <label>Default event image URL</label>
            <input style={input} value={cfg.defaultEventImageUrl} onChange={(e) => setCfg({ ...cfg, defaultEventImageUrl: e.target.value })} />
          </div>
          <div>
            <label>Default event thumbnail URL</label>
            <input style={input} value={cfg.defaultEventThumbnailUrl} onChange={(e) => setCfg({ ...cfg, defaultEventThumbnailUrl: e.target.value })} />
          </div>
        </div>
      </div>

      <div style={box}>
        <h3 style={{ marginTop: 0, color: "#ff4444" }}>{groupLabelPlural}</h3>
        <div style={{ display: "grid", gap: 10 }}>
          {cfg.houses.map((house, index) => (
            <div key={house.id || `house-${index}`} style={{ border: "1px solid #530000", borderRadius: 10, padding: 10 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 0.6fr 1fr 0.7fr auto", gap: 10, alignItems: "end" }}>
                <div>
                  <label>{groupLabelSingular} name</label>
                  <input style={input} value={house.label} onChange={(e) => updateHouse(index, { label: e.target.value })} />
                </div>
                <div>
                  <label>Emoji</label>
                  <input style={input} value={house.emoji} onChange={(e) => updateHouse(index, { emoji: e.target.value })} />
                </div>
                <div>
                  <label>{groupLabelSingular} role</label>
                  <select style={input} value={house.roleId} onChange={(e) => updateHouse(index, { roleId: e.target.value })}>
                    <option value="">No role</option>
                    {roles.map((role) => <option key={role.id} value={role.id}>@{role.name}</option>)}
                  </select>
                </div>
                <div>
                  <label>Color</label>
                  <input style={input} value={house.colorHex} onChange={(e) => updateHouse(index, { colorHex: e.target.value })} />
                </div>
                <button type="button" style={{ ...input, width: "auto", cursor: "pointer", fontWeight: 800 }} onClick={() => removeHouse(index)}>Remove</button>
              </div>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 10 }}>
          <button type="button" style={{ ...input, width: "auto", cursor: "pointer", fontWeight: 800 }} disabled={cfg.houses.length >= 25} onClick={addHouse}>Add {groupLabelSingular}</button>
        </div>
      </div>

      <div style={box}>
        <h3 style={{ marginTop: 0, color: "#ff4444" }}>Task Templates</h3>
        <div style={{ display: "grid", gap: 10 }}>
          {cfg.taskTemplates.map((task, index) => (
            <div key={task.id || `task-${index}`} style={{ border: "1px solid #530000", borderRadius: 10, padding: 10 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 0.5fr 0.5fr 0.5fr auto", gap: 10, alignItems: "end" }}>
                <div>
                  <label>Task label</label>
                  <input style={input} value={task.label} onChange={(e) => updateTask(index, { label: e.target.value })} />
                </div>
                <div>
                  <label>Emoji</label>
                  <input style={input} value={task.emoji} onChange={(e) => updateTask(index, { emoji: e.target.value })} />
                </div>
                <div>
                  <label>Points</label>
                  <input style={input} type="number" value={task.points} onChange={(e) => updateTask(index, { points: Number(e.target.value || 0) })} />
                </div>
                <div>
                  <label>Currency</label>
                  <input style={input} type="number" value={task.currency} onChange={(e) => updateTask(index, { currency: Number(e.target.value || 0) })} />
                </div>
                <button type="button" style={{ ...input, width: "auto", cursor: "pointer", fontWeight: 800 }} onClick={() => removeTask(index)}>Remove</button>
              </div>
              <div style={{ marginTop: 10 }}>
                <label>Description</label>
                <textarea style={{ ...input, minHeight: 70 }} value={task.description} onChange={(e) => updateTask(index, { description: e.target.value })} />
              </div>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 10 }}>
          <button type="button" style={{ ...input, width: "auto", cursor: "pointer", fontWeight: 800 }} disabled={cfg.taskTemplates.length >= 25} onClick={addTask}>Add Task Template</button>
        </div>
      </div>

      <div style={box}>
        <h3 style={{ marginTop: 0, color: "#ff4444" }}>Create Event</h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(260px, 1fr))", gap: 10 }}>
          <div>
            <label>Event title</label>
            <input style={input} value={createForm.title} onChange={(e) => setCreateForm((prev) => ({ ...prev, title: e.target.value }))} />
          </div>
          <div>
            <label>Event channel</label>
            <select style={input} value={createForm.channelId} onChange={(e) => setCreateForm((prev) => ({ ...prev, channelId: e.target.value }))}>
              <option value="">Use default event/board channel</option>
              {textChannels.map((c) => <option key={c.id} value={c.id}>#{c.name}</option>)}
            </select>
          </div>
          <div style={{ gridColumn: "1 / -1" }}>
            <label>Description</label>
            <textarea style={{ ...input, minHeight: 100 }} value={createForm.description} onChange={(e) => setCreateForm((prev) => ({ ...prev, description: e.target.value }))} />
          </div>
          <div>
            <label>Image URL</label>
            <input style={input} value={createForm.imageUrl} onChange={(e) => setCreateForm((prev) => ({ ...prev, imageUrl: e.target.value }))} />
          </div>
          <div>
            <label>Thumbnail URL</label>
            <input style={input} value={createForm.thumbnailUrl} onChange={(e) => setCreateForm((prev) => ({ ...prev, thumbnailUrl: e.target.value }))} />
          </div>
        </div>
        <div style={{ marginTop: 10 }}>
          <button type="button" style={{ ...input, width: "auto", cursor: "pointer", fontWeight: 900 }} disabled={saving || !cfg.enabled} onClick={() => void createEvent()}>
            {saving ? "Working..." : "Create Event"}
          </button>
        </div>
      </div>

      <div style={box}>
        <h3 style={{ marginTop: 0, color: "#ff4444" }}>Award {groupLabelPlural}</h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(220px, 1fr))", gap: 10 }}>
          <div>
            <label>Event</label>
            <select style={input} value={selectedEventId} onChange={(e) => setAwardForm((prev) => ({ ...prev, eventId: e.target.value }))}>
              <option value="">Select event</option>
              {activeEvents.map((event) => <option key={String(event.eventId || event.id)} value={String(event.eventId || event.id)}>{event.title || event.name || event.id}</option>)}
            </select>
          </div>
          <div>
            <label>{groupLabelSingular}</label>
            <select style={input} value={selectedHouseId} onChange={(e) => setAwardForm((prev) => ({ ...prev, houseId: e.target.value }))}>
              <option value="">Select {groupLabelSingularLower}</option>
              {cfg.houses.map((house) => <option key={house.id} value={house.id}>{house.emoji} {house.label}</option>)}
            </select>
          </div>
          <div>
            <label>Task template</label>
            <select style={input} value={awardForm.taskId} onChange={(e) => setAwardForm((prev) => ({ ...prev, taskId: e.target.value }))}>
              <option value="">Select task</option>
              {cfg.taskTemplates.map((task) => <option key={task.id} value={task.id}>{task.emoji} {task.label}</option>)}
            </select>
          </div>
          <div>
            <label>Custom points</label>
            <input style={input} type="number" value={awardForm.points} onChange={(e) => setAwardForm((prev) => ({ ...prev, points: e.target.value }))} />
          </div>
          <div>
            <label>Custom currency</label>
            <input style={input} type="number" value={awardForm.currency} onChange={(e) => setAwardForm((prev) => ({ ...prev, currency: e.target.value }))} />
          </div>
          <div>
            <label>Member reward (optional)</label>
            <input style={input} value={awardForm.memberUserId} onChange={(e) => setAwardForm((prev) => ({ ...prev, memberUserId: e.target.value }))} placeholder="User ID or mention" />
          </div>
          <div style={{ gridColumn: "1 / -1" }}>
            <label>Reason</label>
            <input style={input} value={awardForm.reason} onChange={(e) => setAwardForm((prev) => ({ ...prev, reason: e.target.value }))} />
          </div>
        </div>
        <div style={{ display: "flex", gap: 10, marginTop: 10, flexWrap: "wrap" }}>
          <button type="button" style={{ ...input, width: "auto", cursor: "pointer", fontWeight: 900 }} disabled={saving || !cfg.enabled || !awardForm.taskId} onClick={() => void awardTask()}>
            Award Task Template
          </button>
          <button type="button" style={{ ...input, width: "auto", cursor: "pointer", fontWeight: 900 }} disabled={saving || !cfg.enabled} onClick={() => void awardCustom()}>
            Award Custom {groupLabelSingular}
          </button>
        </div>
      </div>

      <div style={box}>
        <h3 style={{ marginTop: 0, color: "#ff4444" }}>Live Events</h3>
        <div style={{ display: "grid", gap: 10 }}>
          {activeEvents.length ? activeEvents.map((event) => {
            const eventId = String(event.eventId || event.id || "");
            const closed = String(event.status || "").toLowerCase() === "closed";
            return (
              <div key={eventId} style={{ border: "1px solid #530000", borderRadius: 10, padding: 12 }}>
                <div style={{ fontWeight: 900, color: "#ffe0e0" }}>{event.title || event.name || "Event"}</div>
                <div style={{ color: "#ffb3b3", fontSize: 12, marginTop: 4 }}>{event.value}</div>
                <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
                  <button type="button" style={{ ...input, width: "auto", cursor: "pointer", fontWeight: 800 }} disabled={saving} onClick={() => void runAction("publishEvent", { eventId })}>Publish / Refresh Board</button>
                  <button type="button" style={{ ...input, width: "auto", cursor: "pointer", fontWeight: 800 }} disabled={saving || closed} onClick={() => void runAction("closeEvent", { eventId })}>Close</button>
                  <button type="button" style={{ ...input, width: "auto", cursor: "pointer", fontWeight: 800 }} disabled={saving || !closed} onClick={() => void runAction("reopenEvent", { eventId })}>Reopen</button>
                  <button type="button" style={{ ...input, width: "auto", cursor: "pointer", fontWeight: 800 }} disabled={saving} onClick={() => void runAction("deleteEvent", { eventId })}>Delete</button>
                </div>
              </div>
            );
          }) : <div style={{ color: "#ffb7b7" }}>No event runtime stored yet.</div>}
        </div>
      </div>

      <div style={box}>
        <h3 style={{ marginTop: 0, color: "#ff4444" }}>Notes</h3>
        <textarea style={{ ...input, minHeight: 90 }} value={cfg.notes} onChange={(e) => setCfg({ ...cfg, notes: e.target.value })} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(260px, 1fr))", gap: 12 }}>
        <div style={box}>
          <h3 style={{ marginTop: 0, color: "#ff4444" }}>Current {groupLabelPlural} Totals</h3>
          {houseRows.length ? houseRows.map((row) => (
            <div key={String(row.id || row.title)} style={{ padding: "8px 0", borderTop: "1px solid #330000" }}>
              <div style={{ fontWeight: 800 }}>{row.name || row.title}</div>
              <div style={{ color: "#ffb3b3", fontSize: 12 }}>{row.value}</div>
            </div>
          )) : <div style={{ color: "#ffb3b3" }}>No {groupLabelPluralLower} totals recorded yet.</div>}
        </div>
        <div style={box}>
          <h3 style={{ marginTop: 0, color: "#ff4444" }}>Member Currency Leaders</h3>
          {balanceRows.length ? balanceRows.map((row) => (
            <div key={String(row.id || row.title)} style={{ padding: "8px 0", borderTop: "1px solid #330000" }}>
              <div style={{ fontWeight: 800 }}>{row.name || row.title}</div>
              <div style={{ color: "#ffb3b3", fontSize: 12 }}>{row.value}</div>
            </div>
          )) : <div style={{ color: "#ffb3b3" }}>No member balances yet.</div>}
        </div>
      </div>

      <div style={box}>
        <h3 style={{ marginTop: 0, color: "#ff4444" }}>Recent Awards</h3>
        {recentAwardRows.length ? recentAwardRows.map((row) => (
          <div key={String(row.id || row.title)} style={{ padding: "8px 0", borderTop: "1px solid #330000" }}>
            <div style={{ fontWeight: 800 }}>{row.title || row.name}</div>
            <div style={{ color: "#ffb3b3", fontSize: 12 }}>{row.value}</div>
          </div>
        )) : <div style={{ color: "#ffb3b3" }}>No awards logged yet.</div>}
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
        <button onClick={() => save(normalizedConfig())} disabled={saving} style={{ ...input, width: "auto", cursor: "pointer", fontWeight: 900 }}>
          {saving ? "Saving..." : "Save Event Points"}
        </button>
      </div>
    </div>
  );
}
