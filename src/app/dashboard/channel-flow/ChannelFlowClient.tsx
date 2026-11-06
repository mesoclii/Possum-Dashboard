"use client";

import { useMemo, useState } from "react";
import ConfigJsonEditor from "@/components/possum/ConfigJsonEditor";
import EngineInsights from "@/components/possum/EngineInsights";
import { useGuildEngineEditor } from "@/components/possum/useGuildEngineEditor";

type CounterChannel = {
  id?: string;
  enabled?: boolean;
  channelId?: string;
  metric?: string;
  template?: string;
};

type ChannelFlowConfig = {
  active: boolean;
  counters: {
    enabled: boolean;
    refreshMinutes: number;
    channels: CounterChannel[];
  };
  rooms: {
    enabled: boolean;
    lobbyChannelId: string;
    categoryId: string;
    nameTemplate: string;
    ownerControlLevel: "off" | "basic" | "manage" | "moderate";
    userLimit: number;
    bitrate: number;
    cleanupDelaySeconds: number;
    inheritPermissions: boolean;
  };
  notes: string;
};

type Channel = { id: string; name: string; type?: number | string };

const DEFAULT_CONFIG: ChannelFlowConfig = {
  active: false,
  counters: {
    enabled: false,
    refreshMinutes: 15,
    channels: [],
  },
  rooms: {
    enabled: false,
    lobbyChannelId: "",
    categoryId: "",
    nameTemplate: "{{displayName}} Lounge",
    ownerControlLevel: "manage",
    userLimit: 0,
    bitrate: 64000,
    cleanupDelaySeconds: 12,
    inheritPermissions: true,
  },
  notes: "",
};

const shell: React.CSSProperties = { color: "#ffd0d0", padding: 18, maxWidth: 1280 };
const card: React.CSSProperties = { border: "1px solid #6a0000", borderRadius: 12, background: "rgba(120,0,0,0.10)", padding: 14, marginBottom: 12 };
const input: React.CSSProperties = { width: "100%", padding: "10px 12px", background: "#0b0b0b", color: "#ffd8d8", border: "1px solid #7a0000", borderRadius: 8 };
const button: React.CSSProperties = { ...input, width: "auto", cursor: "pointer", fontWeight: 800 };
const micro: React.CSSProperties = { fontSize: 12, color: "#ffb2b2", lineHeight: 1.6 };

function makeId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function createCounter(): CounterChannel {
  return {
    id: makeId("counter"),
    enabled: true,
    channelId: "",
    metric: "members_total",
    template: "Members: {{count}}",
  };
}

function labelForChannel(channels: Channel[], channelId: string) {
  const found = channels.find((entry) => entry.id === channelId);
  return found ? `#${found.name}` : (channelId || "Not set");
}

export default function ChannelFlowClient() {
  const {
    guildId,
    guildName,
    config: cfg,
    setConfig: setCfg,
    channels,
    summary,
    details,
    loading,
    saving,
    message,
    save,
    runAction,
  } = useGuildEngineEditor<ChannelFlowConfig>("channelFlow", DEFAULT_CONFIG);

  const [selectedCounterIndex, setSelectedCounterIndex] = useState(0);
  const channelList = useMemo(() => channels as Channel[], [channels]);
  const voiceChannels = useMemo(
    () => channelList.filter((channel) => Number(channel?.type) === 2 || Number(channel?.type) === 13 || /voice|stage/i.test(String(channel?.type || ""))),
    [channelList]
  );
  const categoryChannels = useMemo(
    () => channelList.filter((channel) => Number(channel?.type) === 4 || /category/i.test(String(channel?.type || ""))),
    [channelList]
  );
  const textChannels = useMemo(
    () => channelList.filter((channel) => Number(channel?.type) === 0 || Number(channel?.type) === 5 || /text/i.test(String(channel?.type || ""))),
    [channelList]
  );
  const activeCounterIndex = cfg.counters.channels.length ? Math.max(0, Math.min(selectedCounterIndex, cfg.counters.channels.length - 1)) : -1;
  const activeCounter = activeCounterIndex >= 0 ? cfg.counters.channels[activeCounterIndex] : null;

  function updateCounter(index: number, patch: Partial<CounterChannel>) {
    setCfg((prev) => {
      const next = [...prev.counters.channels];
      next[index] = { ...next[index], ...patch };
      return {
        ...prev,
        counters: {
          ...prev.counters,
          channels: next,
        },
      };
    });
  }

  function removeCounter(index: number) {
    setCfg((prev) => ({
      ...prev,
      counters: {
        ...prev.counters,
        channels: prev.counters.channels.filter((_, counterIndex) => counterIndex !== index),
      },
    }));
    setSelectedCounterIndex((prev) => Math.max(0, prev > index ? prev - 1 : prev === index ? index - 1 : prev));
  }

  if (!guildId) return <div style={{ ...shell, color: "#ff8a8a" }}>Missing guildId. Open from /guilds first.</div>;

  return (
    <div style={shell}>
      <h1 style={{ margin: 0, color: "#ff4444", letterSpacing: "0.12em", textTransform: "uppercase" }}>Channel Flow</h1>
      <div style={{ color: "#ff9c9c", marginTop: 6 }}>Guild: {guildName || guildId}</div>
      <div style={{ color: "#ffb0b0", fontSize: 12, marginTop: 4 }}>
        This engine handles live counters and room-flow voice creation without changing your current command or moderation logic.
      </div>
      {message ? <div style={{ color: "#ffb3f0", marginTop: 8 }}>{message}</div> : null}

      {loading ? (
        <div style={card}>Loading Channel Flow...</div>
      ) : (
        <>
          <EngineInsights summary={summary} details={details} showDetails />

          <section id="rooms" style={card}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 12, alignItems: "end" }}>
              <label><input type="checkbox" checked={cfg.active} onChange={(e) => setCfg((prev) => ({ ...prev, active: e.target.checked }))} /> Channel Flow Active</label>
              <label><input type="checkbox" checked={cfg.counters.enabled} onChange={(e) => setCfg((prev) => ({ ...prev, counters: { ...prev.counters, enabled: e.target.checked } }))} /> Live Counters Enabled</label>
              <label><input type="checkbox" checked={cfg.rooms.enabled} onChange={(e) => setCfg((prev) => ({ ...prev, rooms: { ...prev.rooms, enabled: e.target.checked } }))} /> Room Flow Enabled</label>
              <div>
                <div style={{ marginBottom: 6 }}>Refresh Minutes</div>
                <input style={input} type="number" min={1} value={cfg.counters.refreshMinutes} onChange={(e) => setCfg((prev) => ({ ...prev, counters: { ...prev.counters, refreshMinutes: Number(e.target.value || 1) } }))} />
              </div>
            </div>
            <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 12 }}>
              <div>
                <div style={{ marginBottom: 6 }}>Lobby Voice Channel</div>
                <select style={input} value={cfg.rooms.lobbyChannelId} onChange={(e) => setCfg((prev) => ({ ...prev, rooms: { ...prev.rooms, lobbyChannelId: e.target.value } }))}>
                  <option value="">Select voice channel</option>
                  {voiceChannels.map((channel) => <option key={channel.id} value={channel.id}>#{channel.name}</option>)}
                </select>
              </div>
              <div>
                <div style={{ marginBottom: 6 }}>Category</div>
                <select style={input} value={cfg.rooms.categoryId} onChange={(e) => setCfg((prev) => ({ ...prev, rooms: { ...prev.rooms, categoryId: e.target.value } }))}>
                  <option value="">No category override</option>
                  {categoryChannels.map((channel) => <option key={channel.id} value={channel.id}>{channel.name}</option>)}
                </select>
              </div>
              <div>
                <div style={{ marginBottom: 6 }}>Room Name Template</div>
                <input style={input} value={cfg.rooms.nameTemplate} onChange={(e) => setCfg((prev) => ({ ...prev, rooms: { ...prev.rooms, nameTemplate: e.target.value } }))} />
              </div>
              <div>
                <div style={{ marginBottom: 6 }}>Owner Control Level</div>
                <select style={input} value={cfg.rooms.ownerControlLevel} onChange={(e) => setCfg((prev) => ({ ...prev, rooms: { ...prev.rooms, ownerControlLevel: e.target.value as ChannelFlowConfig["rooms"]["ownerControlLevel"] } }))}>
                  <option value="off">Off</option>
                  <option value="basic">Basic</option>
                  <option value="manage">Manage</option>
                  <option value="moderate">Moderate</option>
                </select>
              </div>
              <div>
                <div style={{ marginBottom: 6 }}>Cleanup Delay (sec)</div>
                <input style={input} type="number" min={0} max={300} value={cfg.rooms.cleanupDelaySeconds} onChange={(e) => setCfg((prev) => ({ ...prev, rooms: { ...prev.rooms, cleanupDelaySeconds: Number(e.target.value || 0) } }))} />
              </div>
              <div>
                <div style={{ marginBottom: 6 }}>User Limit</div>
                <input style={input} type="number" min={0} max={99} value={cfg.rooms.userLimit} onChange={(e) => setCfg((prev) => ({ ...prev, rooms: { ...prev.rooms, userLimit: Number(e.target.value || 0) } }))} />
              </div>
              <div>
                <div style={{ marginBottom: 6 }}>Bitrate</div>
                <input style={input} type="number" min={8000} max={96000} step={1000} value={cfg.rooms.bitrate} onChange={(e) => setCfg((prev) => ({ ...prev, rooms: { ...prev.rooms, bitrate: Number(e.target.value || 64000) } }))} />
              </div>
            </div>
            <div style={{ marginTop: 12 }}>
              <label><input type="checkbox" checked={cfg.rooms.inheritPermissions} onChange={(e) => setCfg((prev) => ({ ...prev, rooms: { ...prev.rooms, inheritPermissions: e.target.checked } }))} /> Inherit category permissions</label>
            </div>
            <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button type="button" style={button} onClick={() => setCfg((prev) => ({ ...prev, rooms: { ...prev.rooms, nameTemplate: "{{displayName}} Lounge" } }))}>Member Lounge</button>
              <button type="button" style={button} onClick={() => setCfg((prev) => ({ ...prev, rooms: { ...prev.rooms, nameTemplate: "{{username}} Control Room" } }))}>Control Room</button>
              <button type="button" style={button} onClick={() => setCfg((prev) => ({ ...prev, rooms: { ...prev.rooms, nameTemplate: "{{guildName}} | {{displayName}}" } }))}>Guild Prefix</button>
            </div>
            <div style={{ marginTop: 12 }}>
              <div style={{ marginBottom: 6 }}>Operator Notes</div>
              <textarea style={{ ...input, minHeight: 90 }} value={cfg.notes} onChange={(e) => setCfg((prev) => ({ ...prev, notes: e.target.value }))} />
            </div>
          </section>

          <section id="counters" style={card}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              <div>
                <div style={{ fontWeight: 800 }}>Live Counters</div>
                <div style={micro}>Build the counter channels here and keep the runtime shape stable underneath.</div>
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button type="button" style={button} onClick={() => { setCfg((prev) => ({ ...prev, counters: { ...prev.counters, channels: [...prev.counters.channels, createCounter()] } })); setSelectedCounterIndex(cfg.counters.channels.length); }}>Add Counter</button>
                <button type="button" style={button} disabled={saving} onClick={() => void runAction("refreshCounters")}>Refresh Counters</button>
                <button type="button" style={button} disabled={saving} onClick={() => void runAction("pruneRooms")}>Prune Empty Rooms</button>
              </div>
            </div>
            <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "320px minmax(0,1fr)", gap: 14 }}>
              <div style={{ display: "grid", gap: 8, alignContent: "start" }}>
                {cfg.counters.channels.length ? cfg.counters.channels.map((entry, index) => (
                  <button key={entry.id || index} type="button" style={{ ...button, textAlign: "left", width: "100%", borderColor: index === activeCounterIndex ? "#ff6b6b" : "#7a0000" }} onClick={() => setSelectedCounterIndex(index)}>
                    <div style={{ fontWeight: 800 }}>{entry.template || entry.metric || entry.id || `Counter ${index + 1}`}</div>
                    <div style={micro}>{labelForChannel(channelList, String(entry.channelId || ""))} | {entry.enabled === false ? "disabled" : "enabled"}</div>
                  </button>
                )) : <div style={micro}>No counter channels configured yet.</div>}
              </div>
              {activeCounter ? (
                <div style={{ display: "grid", gap: 12 }}>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 12 }}>
                    <div>
                      <div style={{ marginBottom: 6 }}>Target Channel</div>
                      <select style={input} value={String(activeCounter.channelId || "")} onChange={(e) => updateCounter(activeCounterIndex, { channelId: e.target.value })}>
                        <option value="">Select text channel</option>
                        {textChannels.map((channel) => <option key={channel.id} value={channel.id}>#{channel.name}</option>)}
                      </select>
                    </div>
                    <div>
                      <div style={{ marginBottom: 6 }}>Metric</div>
                      <select style={input} value={String(activeCounter.metric || "members_total")} onChange={(e) => updateCounter(activeCounterIndex, { metric: e.target.value })}>
                        <option value="members_total">Total Members</option>
                        <option value="members_humans">Human Members</option>
                        <option value="members_bots">Bot Members</option>
                        <option value="roles_total">Total Roles</option>
                        <option value="channels_total">Total Channels</option>
                        <option value="voice_active">Voice Users</option>
                      </select>
                    </div>
                    <label><input type="checkbox" checked={activeCounter.enabled !== false} onChange={(e) => updateCounter(activeCounterIndex, { enabled: e.target.checked })} /> Enabled</label>
                  </div>
                  <div>
                    <div style={{ marginBottom: 6 }}>Channel Name Template</div>
                    <input style={input} value={String(activeCounter.template || "")} onChange={(e) => updateCounter(activeCounterIndex, { template: e.target.value })} />
                  </div>
                  <div style={micro}>Use <code>{"{{count}}"}</code>, <code>{"{{metric}}"}</code>, and <code>{"{{guildName}}"}</code> in counter names.</div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <button type="button" style={button} onClick={() => updateCounter(activeCounterIndex, { template: "Members: {{count}}" })}>Member Count</button>
                    <button type="button" style={button} onClick={() => updateCounter(activeCounterIndex, { template: "Voice Live: {{count}}" })}>Voice Live</button>
                    <button type="button" style={button} onClick={() => updateCounter(activeCounterIndex, { template: "{{guildName}} | {{count}}" })}>Guild Prefix</button>
                    <button type="button" style={button} onClick={() => removeCounter(activeCounterIndex)}>Remove Counter</button>
                  </div>
                </div>
              ) : (
                <div style={{ ...micro, alignSelf: "center" }}>Select a counter to edit it, or add a new counter.</div>
              )}
            </div>
          </section>

          <section id="room-snapshot" style={card}>
            <div style={{ fontWeight: 800, marginBottom: 8 }}>Room Flow Snapshot</div>
            <div style={{ border: "1px solid #742222", borderRadius: 8, padding: 10 }}>
              <div style={{ fontWeight: 700 }}>{cfg.rooms.nameTemplate || "{{displayName}} Lounge"}</div>
              <div style={micro}>Lobby: {labelForChannel(channelList, cfg.rooms.lobbyChannelId)}</div>
              <div style={micro}>Category: {labelForChannel(channelList, cfg.rooms.categoryId)}</div>
              <div style={micro}>Cleanup: {cfg.rooms.cleanupDelaySeconds}s | Limit: {cfg.rooms.userLimit || "open"} | Owner Control: {cfg.rooms.ownerControlLevel}</div>
            </div>
          </section>

          <section style={{ ...card, display: "flex", justifyContent: "flex-end" }}>
            <button type="button" style={button} disabled={saving} onClick={() => void save()}>{saving ? "Saving..." : "Save Channel Flow"}</button>
          </section>

          <ConfigJsonEditor
            title="Advanced Channel Flow Config"
            value={cfg}
            disabled={saving}
            onApply={(next) => setCfg({ ...DEFAULT_CONFIG, ...(next as ChannelFlowConfig) })}
          />
        </>
      )}
    </div>
  );
}
