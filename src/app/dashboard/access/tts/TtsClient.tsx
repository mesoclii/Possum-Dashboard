"use client";

import { useMemo } from "react";
import EngineInsights from "@/components/possum/EngineInsights";
import OperatorLogPanel from "@/components/possum/OperatorLogPanel";
import { useGuildEngineEditor } from "@/components/possum/useGuildEngineEditor";

type TtsRoute = {
  id: string;
  name: string;
  enabled: boolean;
  slot?: number;
  sourceChannelId: string;
  sourceChannelIds: string[];
  voiceChannelId: string;
  voiceKey: string;
  priority: number;
  volume: number;
  maxCharsPerMessage: number | null;
  requirePrefix: boolean | null;
  prefix: string;
  useSpeakerFallback: boolean;
  notes: string;
};

type TtsConfig = {
  enabled: boolean;
  commandEnabled: boolean;
  defaultVoice: string;
  maxCharsPerMessage: number;
  maxQueue: number;
  allowedChannelIds: string[];
  blockedChannelIds: string[];
  allowedRoleIds: string[];
  voiceChannelOnly: boolean;
  requirePrefix: boolean;
  prefix: string;
  autoRouteEnabled: boolean;
  autoTextChannelId: string | null;
  autoVoiceChannelId: string | null;
  autoUseSpeakerChannel: boolean;
  routes: TtsRoute[];
};

const DEFAULT_ROUTE: TtsRoute = {
  id: "",
  name: "New Route",
  enabled: true,
  sourceChannelId: "",
  sourceChannelIds: [],
  voiceChannelId: "",
  voiceKey: "female",
  priority: 100,
  volume: 100,
  maxCharsPerMessage: null,
  requirePrefix: false,
  prefix: "",
  useSpeakerFallback: true,
  notes: "",
};

const DEFAULT_CONFIG: TtsConfig = {
  enabled: false,
  commandEnabled: true,
  defaultVoice: "female",
  maxCharsPerMessage: 300,
  maxQueue: 6,
  allowedChannelIds: [],
  blockedChannelIds: [],
  allowedRoleIds: [],
  voiceChannelOnly: false,
  requirePrefix: false,
  prefix: "",
  autoRouteEnabled: true,
  autoTextChannelId: null,
  autoVoiceChannelId: null,
  autoUseSpeakerChannel: true,
  routes: [],
};

const shell: React.CSSProperties = { color: "#ffd0d0", maxWidth: 1360, padding: 16 };
const card: React.CSSProperties = { border: "1px solid #5a0000", borderRadius: 12, padding: 16, background: "rgba(90,0,0,0.12)", marginBottom: 14 };
const input: React.CSSProperties = { width: "100%", padding: "10px 12px", background: "#0b0b0b", color: "#ffd1d1", border: "1px solid #6f0000", borderRadius: 8 };

function toggle(list: string[], id: string) {
  const set = new Set(list || []);
  if (set.has(id)) set.delete(id);
  else set.add(id);
  return Array.from(set);
}

function routeId() {
  return `route_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeRoute(route: Partial<TtsRoute>, index: number): TtsRoute {
  const sourceChannelIds = Array.isArray(route.sourceChannelIds)
    ? route.sourceChannelIds.map((id) => String(id || "").trim()).filter(Boolean)
    : [];
  const legacySource = String(route.sourceChannelId || "").trim();
  const maxCharsValue = route.maxCharsPerMessage as number | string | null | undefined;
  if (legacySource && !sourceChannelIds.includes(legacySource)) {
    sourceChannelIds.unshift(legacySource);
  }

  return {
    ...DEFAULT_ROUTE,
    ...route,
    id: String(route.id || routeId()),
    name: String(route.name || `Route ${index + 1}`).trim() || `Route ${index + 1}`,
    sourceChannelId: sourceChannelIds[0] || "",
    sourceChannelIds,
    voiceChannelId: String(route.voiceChannelId || "").trim(),
    voiceKey: String(route.voiceKey || DEFAULT_ROUTE.voiceKey).trim() || DEFAULT_ROUTE.voiceKey,
    priority: Math.max(0, Number(route.priority ?? DEFAULT_ROUTE.priority)),
    volume: Math.min(200, Math.max(1, Number(route.volume ?? DEFAULT_ROUTE.volume))),
    maxCharsPerMessage:
      maxCharsValue === null || maxCharsValue === undefined || maxCharsValue === ""
        ? null
        : Math.max(1, Number(maxCharsValue)),
    requirePrefix:
      route.requirePrefix === null || route.requirePrefix === undefined
        ? null
        : Boolean(route.requirePrefix),
    prefix: String(route.prefix || "").trim(),
    useSpeakerFallback: route.useSpeakerFallback !== false,
    notes: String(route.notes || "").trim(),
  };
}

function normalizeConfig(raw: Partial<TtsConfig> | TtsConfig): TtsConfig {
  const next = { ...DEFAULT_CONFIG, ...(raw || {}) };
  return {
    ...next,
    allowedChannelIds: Array.isArray(next.allowedChannelIds) ? next.allowedChannelIds.map(String) : [],
    blockedChannelIds: Array.isArray(next.blockedChannelIds) ? next.blockedChannelIds.map(String) : [],
    allowedRoleIds: Array.isArray(next.allowedRoleIds) ? next.allowedRoleIds.map(String) : [],
    autoTextChannelId: next.autoTextChannelId ? String(next.autoTextChannelId) : null,
    autoVoiceChannelId: next.autoVoiceChannelId ? String(next.autoVoiceChannelId) : null,
    routes: Array.isArray(next.routes)
      ? next.routes.map((route, index) => normalizeRoute(route, index))
      : [],
  };
}

function prefixModeValue(value: boolean | null) {
  if (value === null || value === undefined) return "inherit";
  return value ? "required" : "off";
}

export default function TtsAccessPage() {
  const {
    guildId,
    guildName,
    config: rawCfg,
    setConfig: setCfg,
    roles,
    channels,
    summary,
    details,
    loading,
    saving,
    message,
    save,
    runAction,
  } = useGuildEngineEditor<TtsConfig>("tts", DEFAULT_CONFIG);

  const cfg = useMemo(() => normalizeConfig(rawCfg), [rawCfg]);
  const textChannels = useMemo(
    () => channels.filter((c) => Number(c?.type) === 0 || Number(c?.type) === 5 || String(c?.type || "").toLowerCase().includes("text")),
    [channels]
  );
  const voiceChannels = useMemo(
    () => channels.filter((c) => Number(c?.type) === 2 || Number(c?.type) === 13 || String(c?.type || "").toLowerCase().includes("voice") || String(c?.type || "").toLowerCase().includes("stage")),
    [channels]
  );

  function updateRoute(index: number, patch: Partial<TtsRoute>) {
    const next = [...cfg.routes];
    next[index] = normalizeRoute({ ...next[index], ...patch }, index);
    setCfg((prev) => ({ ...normalizeConfig(prev), routes: next }));
  }

  function toggleRouteSource(index: number, channelId: string) {
    const current = cfg.routes[index];
    const sourceChannelIds = toggle(current.sourceChannelIds, channelId);
    updateRoute(index, {
      sourceChannelIds,
      sourceChannelId: sourceChannelIds[0] || "",
    });
  }

  function addRoute() {
    setCfg((prev) => {
      const next = normalizeConfig(prev);
      return {
        ...next,
        routes: [...next.routes, normalizeRoute({ id: routeId(), name: `Route ${next.routes.length + 1}`, voiceKey: next.defaultVoice }, next.routes.length)],
      };
    });
  }

  function removeRoute(index: number) {
    setCfg((prev) => {
      const next = normalizeConfig(prev);
      return {
        ...next,
        routes: next.routes.filter((_, currentIndex) => currentIndex !== index),
      };
    });
  }

  if (!guildId) return <div style={shell}>Missing guildId. Open from /guilds first.</div>;

  return (
    <div style={shell}>
      <h1 style={{ marginTop: 0, color: "#ff4444", textTransform: "uppercase", letterSpacing: "0.14em" }}>TTS Engine</h1>
      <div style={{ color: "#ff9999" }}>Guild: {guildName || guildId}</div>
      <div style={{ color: "#ffb0b0", fontSize: 12, marginTop: 4 }}>
        Full per-guild TTS routing. Every route can bind its own text lanes, voice destination, voice preset, volume, priority, and prefix behavior. Explicit routes speak without a prefix unless you turn one on for that route.
      </div>
      {message ? <div style={{ color: "#ffb3f0", marginTop: 8 }}>{message}</div> : null}

      {loading ? (
        <div style={{ ...card, marginTop: 12 }}>Loading TTS...</div>
      ) : (
        <>
          <EngineInsights summary={summary} details={details} showDetails />
          <OperatorLogPanel guildId={guildId} engine="tts" title="TTS Operator Logs" />

          <div style={{ ...card, marginTop: 12 }}>
            <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
              <label><input type="checkbox" checked={cfg.enabled} onChange={(e) => setCfg((p) => ({ ...normalizeConfig(p), enabled: e.target.checked }))} /> Engine Enabled</label>
              <label><input type="checkbox" checked={cfg.commandEnabled} onChange={(e) => setCfg((p) => ({ ...normalizeConfig(p), commandEnabled: e.target.checked }))} /> Slash Command Enabled</label>
              <label><input type="checkbox" checked={cfg.voiceChannelOnly} onChange={(e) => setCfg((p) => ({ ...normalizeConfig(p), voiceChannelOnly: e.target.checked }))} /> Voice Channel Required</label>
              <label><input type="checkbox" checked={cfg.requirePrefix} onChange={(e) => setCfg((p) => ({ ...normalizeConfig(p), requirePrefix: e.target.checked }))} /> Global Prefix Required</label>
              <label><input type="checkbox" checked={cfg.autoRouteEnabled} onChange={(e) => setCfg((p) => ({ ...normalizeConfig(p), autoRouteEnabled: e.target.checked }))} /> Auto Route Fallback</label>
              <label><input type="checkbox" checked={cfg.autoUseSpeakerChannel} onChange={(e) => setCfg((p) => ({ ...normalizeConfig(p), autoUseSpeakerChannel: e.target.checked }))} /> Use Speaker Voice Fallback</label>
            </div>
          </div>

          <div style={card}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 12 }}>
              <div>
                <div style={{ marginBottom: 6 }}>Default Voice</div>
                <input style={input} value={cfg.defaultVoice} onChange={(e) => setCfg((p) => ({ ...normalizeConfig(p), defaultVoice: e.target.value }))} />
              </div>
              <div>
                <div style={{ marginBottom: 6 }}>Global Prefix</div>
                <input style={input} value={cfg.prefix} onChange={(e) => setCfg((p) => ({ ...normalizeConfig(p), prefix: e.target.value }))} />
              </div>
              <div>
                <div style={{ marginBottom: 6 }}>Max Characters Per Message</div>
                <input style={input} type="number" min={1} value={cfg.maxCharsPerMessage} onChange={(e) => setCfg((p) => ({ ...normalizeConfig(p), maxCharsPerMessage: Number(e.target.value || 0) }))} />
              </div>
              <div>
                <div style={{ marginBottom: 6 }}>Max Queue Per Voice Session</div>
                <input style={input} type="number" min={1} value={cfg.maxQueue} onChange={(e) => setCfg((p) => ({ ...normalizeConfig(p), maxQueue: Number(e.target.value || 0) }))} />
              </div>
              <div>
                <div style={{ marginBottom: 6 }}>Auto Text Route Channel</div>
                <select style={input} value={cfg.autoTextChannelId || ""} onChange={(e) => setCfg((p) => ({ ...normalizeConfig(p), autoTextChannelId: e.target.value || null }))}>
                  <option value="">Use speaker message channel</option>
                  {textChannels.map((channel) => <option key={channel.id} value={channel.id}>#{channel.name}</option>)}
                </select>
              </div>
              <div>
                <div style={{ marginBottom: 6 }}>Auto Voice Route Channel</div>
                <select style={input} value={cfg.autoVoiceChannelId || ""} onChange={(e) => setCfg((p) => ({ ...normalizeConfig(p), autoVoiceChannelId: e.target.value || null }))}>
                  <option value="">Use current speaker voice channel</option>
                  {voiceChannels.map((channel) => <option key={channel.id} value={channel.id}>{channel.name}</option>)}
                </select>
              </div>
            </div>
          </div>

          <div style={card}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 10 }}>
              <div>
                <div style={{ color: "#ffb3b3", fontSize: 12, letterSpacing: "0.08em", textTransform: "uppercase" }}>Dynamic Routes</div>
                <div style={{ color: "#ff9c9c", fontSize: 12 }}>Each route can target its own voice channel and multiple source text channels.</div>
              </div>
              <button onClick={addRoute} style={{ ...input, width: "auto", cursor: "pointer", fontWeight: 900 }}>+ Add Route</button>
            </div>

            {cfg.routes.length ? cfg.routes.map((route, index) => (
              <div key={route.id} style={{ border: "1px solid #4d0000", borderRadius: 12, padding: 14, marginBottom: 12, background: "#120000" }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center", marginBottom: 12 }}>
                  <div style={{ color: "#ff6666", fontWeight: 900, letterSpacing: "0.08em", textTransform: "uppercase" }}>
                    Route {index + 1}
                  </div>
                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                    <label><input type="checkbox" checked={route.enabled} onChange={(e) => updateRoute(index, { enabled: e.target.checked })} /> Enabled</label>
                    <button onClick={() => removeRoute(index)} style={{ ...input, width: "auto", cursor: "pointer", borderColor: "#a00000", color: "#ff8a8a" }}>Remove Route</button>
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 12 }}>
                  <div>
                    <div style={{ marginBottom: 6 }}>Route Name</div>
                    <input style={input} value={route.name} onChange={(e) => updateRoute(index, { name: e.target.value })} />
                  </div>
                  <div>
                    <div style={{ marginBottom: 6 }}>Voice Preset</div>
                    <input style={input} value={route.voiceKey} onChange={(e) => updateRoute(index, { voiceKey: e.target.value })} />
                  </div>
                  <div>
                    <div style={{ marginBottom: 6 }}>Target Voice Channel</div>
                    <select style={input} value={route.voiceChannelId} onChange={(e) => updateRoute(index, { voiceChannelId: e.target.value })}>
                      <option value="">Select voice channel</option>
                      {voiceChannels.map((channel) => <option key={channel.id} value={channel.id}>{channel.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <div style={{ marginBottom: 6 }}>Priority</div>
                    <input style={input} type="number" min={0} value={route.priority} onChange={(e) => updateRoute(index, { priority: Number(e.target.value || 0) })} />
                  </div>
                  <div>
                    <div style={{ marginBottom: 6 }}>Volume (%)</div>
                    <input style={input} type="number" min={1} max={200} value={route.volume} onChange={(e) => updateRoute(index, { volume: Number(e.target.value || 0) })} />
                  </div>
                  <div>
                    <div style={{ marginBottom: 6 }}>Route Max Characters</div>
                    <input
                      style={input}
                      type="number"
                      min={1}
                      value={route.maxCharsPerMessage ?? ""}
                      onChange={(e) => updateRoute(index, { maxCharsPerMessage: e.target.value ? Number(e.target.value) : null })}
                      placeholder="Inherit global"
                    />
                  </div>
                  <div>
                    <div style={{ marginBottom: 6 }}>Prefix Mode</div>
                    <select
                      style={input}
                      value={prefixModeValue(route.requirePrefix)}
                      onChange={(e) => updateRoute(index, { requirePrefix: e.target.value === "inherit" ? null : e.target.value === "required" })}
                    >
                      <option value="inherit">Inherit Global</option>
                      <option value="required">Require Prefix</option>
                      <option value="off">No Prefix</option>
                    </select>
                  </div>
                  <div>
                    <div style={{ marginBottom: 6 }}>Route Prefix</div>
                    <input style={input} value={route.prefix} onChange={(e) => updateRoute(index, { prefix: e.target.value })} placeholder="Use global prefix" />
                  </div>
                </div>

                <div style={{ marginTop: 12 }}>
                  <label><input type="checkbox" checked={route.useSpeakerFallback} onChange={(e) => updateRoute(index, { useSpeakerFallback: e.target.checked })} /> Allow speaker voice-channel fallback if target voice channel is unavailable</label>
                </div>

                <div style={{ marginTop: 14 }}>
                  <div style={{ color: "#ffb3b3", fontSize: 12, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 8 }}>Source Text Channels</div>
                  <div style={{ maxHeight: 180, overflowY: "auto", border: "1px solid #500000", borderRadius: 8, padding: 8 }}>
                    {textChannels.map((channel) => (
                      <label key={`${route.id}_${channel.id}`} style={{ display: "block", marginBottom: 4 }}>
                        <input type="checkbox" checked={route.sourceChannelIds.includes(channel.id)} onChange={() => toggleRouteSource(index, channel.id)} /> #{channel.name}
                      </label>
                    ))}
                  </div>
                </div>

                <div style={{ marginTop: 12 }}>
                  <div style={{ marginBottom: 6 }}>Route Notes</div>
                  <textarea style={{ ...input, minHeight: 84 }} value={route.notes} onChange={(e) => updateRoute(index, { notes: e.target.value })} />
                </div>
              </div>
            )) : (
              <div style={{ color: "#ff9f9f", fontSize: 12 }}>No routes yet. Add a route here or let auto-route create one from the first live message flow.</div>
            )}
          </div>

          <div style={card}>
            <div style={{ color: "#ffb3b3", fontSize: 12, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 8 }}>Allowed Channels</div>
            <div style={{ maxHeight: 220, overflowY: "auto", border: "1px solid #500000", borderRadius: 8, padding: 8 }}>
              {textChannels.map((channel) => (
                <label key={`allow_${channel.id}`} style={{ display: "block", marginBottom: 4 }}>
                  <input
                    type="checkbox"
                    checked={cfg.allowedChannelIds.includes(channel.id)}
                    onChange={() =>
                      setCfg((p) => {
                        const next = normalizeConfig(p);
                        return {
                          ...next,
                          allowedChannelIds: toggle(next.allowedChannelIds, channel.id),
                          blockedChannelIds: next.blockedChannelIds.filter((id) => id !== channel.id),
                        };
                      })
                    }
                  /> #{channel.name}
                </label>
              ))}
            </div>
          </div>

          <div style={card}>
            <div style={{ color: "#ffb3b3", fontSize: 12, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 8 }}>Blocked Channels</div>
            <div style={{ maxHeight: 220, overflowY: "auto", border: "1px solid #500000", borderRadius: 8, padding: 8 }}>
              {textChannels.map((channel) => (
                <label key={`block_${channel.id}`} style={{ display: "block", marginBottom: 4 }}>
                  <input
                    type="checkbox"
                    checked={cfg.blockedChannelIds.includes(channel.id)}
                    onChange={() =>
                      setCfg((p) => {
                        const next = normalizeConfig(p);
                        return {
                          ...next,
                          blockedChannelIds: toggle(next.blockedChannelIds, channel.id),
                          allowedChannelIds: next.allowedChannelIds.filter((id) => id !== channel.id),
                        };
                      })
                    }
                  /> #{channel.name}
                </label>
              ))}
            </div>
          </div>

          <div style={card}>
            <div style={{ color: "#ffb3b3", fontSize: 12, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 8 }}>Allowed Roles</div>
            <div style={{ maxHeight: 220, overflowY: "auto", border: "1px solid #500000", borderRadius: 8, padding: 8 }}>
              {roles.map((role) => (
                <label key={`role_${role.id}`} style={{ display: "block", marginBottom: 4 }}>
                  <input type="checkbox" checked={cfg.allowedRoleIds.includes(role.id)} onChange={() => setCfg((p) => ({ ...normalizeConfig(p), allowedRoleIds: toggle(normalizeConfig(p).allowedRoleIds, role.id) }))} /> @{role.name}
                </label>
              ))}
            </div>
          </div>

          <div style={{ ...card, display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button onClick={() => save(normalizeConfig(cfg))} disabled={saving} style={{ ...input, width: "auto", cursor: "pointer", fontWeight: 900 }}>
              {saving ? "Saving..." : "Save TTS"}
            </button>
            <button onClick={() => void runAction("emergencyOff")} disabled={saving} style={{ ...input, width: "auto", cursor: "pointer", borderColor: "#a00000", color: "#ff8a8a" }}>
              Emergency Off
            </button>
          </div>
        </>
      )}
    </div>
  );
}
