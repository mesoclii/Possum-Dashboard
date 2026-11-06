"use client";

import { useState } from "react";
import ConfigJsonEditor from "@/components/possum/ConfigJsonEditor";
import EngineInsights from "@/components/possum/EngineInsights";
import { useGuildEngineEditor } from "@/components/possum/useGuildEngineEditor";

type EventCfg = {
  active: boolean;
  listeners: {
    messageCreate: boolean;
    interactionCreate: boolean;
    guildMemberAdd: boolean;
    guildMemberRemove: boolean;
    messageDelete: boolean;
    messageUpdate: boolean;
  };
  retries: { enabled: boolean; maxRetries: number; baseDelayMs: number };
  deadLetter: { enabled: boolean; maxAgeHours: number; channelId: string };
  customRoutes: EventRoute[];
  notes: string;
};

type EventRoute = {
  id?: string;
  name?: string;
  event?: string;
  channelId?: string;
  enabled?: boolean;
  message?: string;
  embedTitle?: string;
  embedDescription?: string;
};

type Channel = { id: string; name: string; type?: number | string };

const EMPTY: EventCfg = {
  active: true,
  listeners: {
    messageCreate: true,
    interactionCreate: true,
    guildMemberAdd: true,
    guildMemberRemove: true,
    messageDelete: true,
    messageUpdate: true,
  },
  retries: { enabled: true, maxRetries: 2, baseDelayMs: 250 },
  deadLetter: { enabled: true, maxAgeHours: 24, channelId: "" },
  customRoutes: [],
  notes: "",
};

const LISTENER_OPTIONS: Array<{ key: keyof EventCfg["listeners"]; label: string; hint: string }> = [
  { key: "messageCreate", label: "New chat messages", hint: "Watch normal text chat activity." },
  { key: "interactionCreate", label: "Slash commands and buttons", hint: "Watch bot commands, buttons, and menu clicks." },
  { key: "guildMemberAdd", label: "Members joining", hint: "Watch join events." },
  { key: "guildMemberRemove", label: "Members leaving", hint: "Watch leave or kick events." },
  { key: "messageDelete", label: "Deleted messages", hint: "Watch deleted chat messages." },
  { key: "messageUpdate", label: "Edited messages", hint: "Watch edited chat messages." },
];

const ROUTE_EVENT_OPTIONS = LISTENER_OPTIONS.map((option) => ({
  value: option.key,
  label: option.label,
}));

const box: React.CSSProperties = {
  border: "1px solid #5f0000",
  borderRadius: 12,
  padding: 14,
  background: "rgba(120,0,0,0.10)",
};
const input: React.CSSProperties = {
  width: "100%",
  background: "#0a0a0a",
  color: "#ffd0d0",
  border: "1px solid #7f0000",
  borderRadius: 8,
  padding: "10px 12px",
};
const action: React.CSSProperties = {
  ...input,
  width: "auto",
  cursor: "pointer",
  fontWeight: 900,
};

function createRoute(): EventRoute {
  return {
    id: `route_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    name: "",
    event: "messageCreate",
    channelId: "",
    enabled: true,
    message: "",
    embedTitle: "",
    embedDescription: "",
  };
}

function normalizeRoutes(input: unknown): EventRoute[] {
  if (!Array.isArray(input)) return [];
  return input
    .filter((route) => route && typeof route === "object")
    .map((route, index) => ({
      id: String((route as EventRoute).id || `route_${index + 1}`),
      name: String((route as EventRoute).name || ""),
      event: String((route as EventRoute).event || "messageCreate"),
      channelId: String((route as EventRoute).channelId || ""),
      enabled: (route as EventRoute).enabled !== false,
      message: String((route as EventRoute).message || ""),
      embedTitle: String((route as EventRoute).embedTitle || ""),
      embedDescription: String((route as EventRoute).embedDescription || ""),
    }));
}

export default function EventReactorPage() {
  const {
    guildId,
    guildName,
    config: cfg,
    setConfig: setCfg,
    channels,
    summary,
    loading,
    saving,
    message,
    save,
    runAction,
  } = useGuildEngineEditor<EventCfg>("eventReactor", EMPTY);

  const [routesJson, setRoutesJson] = useState("[]");
  const [jsonError, setJsonError] = useState("");

  const textChannels = (channels as Channel[]).filter((channel) => Number(channel?.type) === 0 || Number(channel?.type) === 5);

  function updateRoute(index: number, patch: Partial<EventRoute>) {
    setCfg((prev) => {
      const nextRoutes = normalizeRoutes(prev.customRoutes);
      if (!nextRoutes[index]) return prev;
      nextRoutes[index] = { ...nextRoutes[index], ...patch };
      return { ...prev, customRoutes: nextRoutes };
    });
  }

  function removeRoute(index: number) {
    setCfg((prev) => ({
      ...prev,
      customRoutes: normalizeRoutes(prev.customRoutes).filter((_, routeIndex) => routeIndex !== index),
    }));
  }

  function addRoute() {
    setCfg((prev) => ({
      ...prev,
      customRoutes: [...normalizeRoutes(prev.customRoutes), createRoute()],
    }));
  }

  async function savePage() {
    await save({ ...cfg, customRoutes: normalizeRoutes(cfg.customRoutes) });
  }

  async function applyJsonRoutes() {
    try {
      const parsed: unknown = routesJson.trim() ? JSON.parse(routesJson) : [];
      if (!Array.isArray(parsed)) {
        setJsonError("Routes JSON must be a list, like [ { ... } ].");
        return;
      }
      setCfg((prev) => ({ ...prev, customRoutes: normalizeRoutes(parsed) }));
      setJsonError("");
    } catch (err) {
      setJsonError(`That JSON isn't valid: ${err instanceof Error ? err.message : "parse error"}`);
    }
  }

  if (!guildId) return <div style={{ color: "#ff8080", padding: 24 }}>Missing guildId. Open from /guilds first.</div>;

  return (
    <div style={{ color: "#ffd0d0", padding: 18, maxWidth: 1200 }}>
      <h1 style={{ margin: 0, color: "#ff4444", letterSpacing: "0.12em", textTransform: "uppercase" }}>Event Alerts + Recovery</h1>
      <div style={{ color: "#ff9999", marginTop: 6, marginBottom: 12 }}>Guild: {guildName || guildId}</div>
      <div style={{ ...box, marginBottom: 12, lineHeight: 1.7, color: "#ffbdbd" }}>
        This page controls what Discord activity the bot watches here, where failed jobs get sent, and any extra alert posts you want it to make.
      </div>
      {message ? <div style={{ marginBottom: 10, color: "#ffb3f0" }}>{message}</div> : null}

      {loading ? (
        <div>Loading...</div>
      ) : (
        <div style={{ display: "grid", gap: 12 }}>
          <EngineInsights summary={summary} details={{}} />

          <section style={box}>
            <div style={{ color: "#ffbdbd", fontSize: 12, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10 }}>
              Main Switch
            </div>
            <label style={{ display: "block", color: "#ffdcdc", fontWeight: 800 }}>
              <input type="checkbox" checked={cfg.active} onChange={(e) => setCfg((prev) => ({ ...prev, active: e.target.checked }))} />{" "}
              Turn event alerts on for this guild
            </label>
            <div style={{ color: "#ffbdbd", fontSize: 12, marginTop: 8 }}>
              If this is off, the bot ignores these extra event-alert rules for this server.
            </div>
          </section>

          <section style={box}>
            <div style={{ color: "#ffbdbd", fontSize: 12, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10 }}>
              What Should The Bot Watch?
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))", gap: 12 }}>
              {LISTENER_OPTIONS.map((option) => (
                <label key={option.key} style={{ display: "block", border: "1px solid #4b0000", borderRadius: 10, padding: 12, background: "#120000" }}>
                  <input
                    type="checkbox"
                    checked={cfg.listeners[option.key]}
                    onChange={(e) =>
                      setCfg((prev) => ({
                        ...prev,
                        listeners: { ...prev.listeners, [option.key]: e.target.checked },
                      }))
                    }
                  />{" "}
                  <strong>{option.label}</strong>
                  <div style={{ color: "#ffbdbd", fontSize: 12, marginTop: 8 }}>{option.hint}</div>
                </label>
              ))}
            </div>
          </section>

          <section style={box}>
            <div style={{ color: "#ffbdbd", fontSize: 12, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10 }}>
              Failed Job Handling
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))", gap: 12 }}>
              <label style={{ display: "block", color: "#ffdcdc", fontWeight: 700 }}>
                <input
                  type="checkbox"
                  checked={cfg.retries.enabled}
                  onChange={(e) => setCfg((prev) => ({ ...prev, retries: { ...prev.retries, enabled: e.target.checked } }))}
                />{" "}
                Retry failed jobs
                <div style={{ color: "#ffbdbd", fontSize: 12, fontWeight: 500, marginTop: 8 }}>
                  Good default for a small VM. This gives the job another shot before it gets marked as failed.
                </div>
              </label>
              <label style={{ display: "block", color: "#ffdcdc", fontWeight: 700 }}>
                <input
                  type="checkbox"
                  checked={cfg.deadLetter.enabled}
                  onChange={(e) => setCfg((prev) => ({ ...prev, deadLetter: { ...prev.deadLetter, enabled: e.target.checked } }))}
                />{" "}
                Save failed jobs to a log channel
                <div style={{ color: "#ffbdbd", fontSize: 12, fontWeight: 500, marginTop: 8 }}>
                  Useful when you want a recovery inbox instead of silent failures.
                </div>
              </label>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 10, marginTop: 12 }}>
              <div>
                <div>Retry attempts</div>
                <input
                  style={input}
                  type="number"
                  min={0}
                  value={cfg.retries.maxRetries}
                  onChange={(e) => setCfg((prev) => ({ ...prev, retries: { ...prev.retries, maxRetries: Number(e.target.value || 0) } }))}
                />
              </div>
              <div>
                <div>Delay between retries (ms)</div>
                <input
                  style={input}
                  type="number"
                  min={0}
                  value={cfg.retries.baseDelayMs}
                  onChange={(e) => setCfg((prev) => ({ ...prev, retries: { ...prev.retries, baseDelayMs: Number(e.target.value || 0) } }))}
                />
              </div>
              <div>
                <div>Keep failed jobs for this many hours</div>
                <input
                  style={input}
                  type="number"
                  min={1}
                  value={cfg.deadLetter.maxAgeHours}
                  onChange={(e) => setCfg((prev) => ({ ...prev, deadLetter: { ...prev.deadLetter, maxAgeHours: Number(e.target.value || 0) } }))}
                />
              </div>
              <div>
                <div>Failed jobs channel</div>
                <select style={input} value={cfg.deadLetter.channelId || ""} onChange={(e) => setCfg((prev) => ({ ...prev, deadLetter: { ...prev.deadLetter, channelId: e.target.value } }))}>
                  <option value="">Select channel</option>
                  {textChannels.map((channel) => (
                    <option key={channel.id} value={channel.id}>
                      #{channel.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div style={{ marginTop: 12 }}>
              <div>Notes for your staff</div>
              <textarea style={{ ...input, minHeight: 80 }} value={cfg.notes || ""} onChange={(e) => setCfg((prev) => ({ ...prev, notes: e.target.value }))} />
            </div>
          </section>

          <section style={box}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 10 }}>
              <div>
                <div style={{ fontWeight: 800 }}>Extra alert posts</div>
                <div style={{ color: "#ffbdbd", fontSize: 12 }}>
                  Optional. Use these if you want the bot to send a custom message when a certain event happens.
                </div>
              </div>
              <button onClick={addRoute} style={action}>Add Alert Route</button>
            </div>

            <div style={{ display: "grid", gap: 10 }}>
              {normalizeRoutes(cfg.customRoutes).length ? normalizeRoutes(cfg.customRoutes).map((route, index) => (
                <div key={route.id || index} style={{ border: "1px solid #4b0000", borderRadius: 10, padding: 12, background: "#120000" }}>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 10 }}>
                    <div>
                      <div>Alert name</div>
                      <input style={input} value={route.name || ""} onChange={(e) => updateRoute(index, { name: e.target.value })} placeholder="Join alert, deleted message alert..." />
                    </div>
                    <div>
                      <div>When this happens</div>
                      <select style={input} value={route.event || "messageCreate"} onChange={(e) => updateRoute(index, { event: e.target.value })}>
                        {ROUTE_EVENT_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <div>Post in this channel</div>
                      <select style={input} value={route.channelId || ""} onChange={(e) => updateRoute(index, { channelId: e.target.value })}>
                        <option value="">Select channel</option>
                        {textChannels.map((channel) => (
                          <option key={channel.id} value={channel.id}>#{channel.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))", gap: 10, marginTop: 10 }}>
                    <div style={{ gridColumn: "1 / -1" }}>
                      <div>Message text</div>
                      <textarea
                        style={{ ...input, minHeight: 70 }}
                        value={route.message || ""}
                        onChange={(e) => updateRoute(index, { message: e.target.value })}
                        placeholder="Use {{userId}}, {{channelId}}, {{event}}, or {{content}} if you want."
                      />
                    </div>
                    <div>
                      <div>Embed title</div>
                      <input style={input} value={route.embedTitle || ""} onChange={(e) => updateRoute(index, { embedTitle: e.target.value })} />
                    </div>
                    <div>
                      <div>Embed body</div>
                      <textarea style={{ ...input, minHeight: 70 }} value={route.embedDescription || ""} onChange={(e) => updateRoute(index, { embedDescription: e.target.value })} />
                    </div>
                  </div>

                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap", marginTop: 10 }}>
                    <label style={{ color: "#ffdcdc", fontWeight: 700 }}>
                      <input type="checkbox" checked={route.enabled !== false} onChange={(e) => updateRoute(index, { enabled: e.target.checked })} /> Route enabled
                    </label>
                    <button onClick={() => removeRoute(index)} style={action}>Remove Route</button>
                  </div>
                </div>
              )) : (
                <div style={{ color: "#ffbdbd", fontSize: 13 }}>No extra alert routes yet. Add one only if you want custom posts for a specific event.</div>
              )}
            </div>
          </section>

          <section style={box}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              <div>
                <div style={{ fontWeight: 800 }}>Recovery tools</div>
                <div style={{ color: "#ffbdbd", fontSize: 12 }}>
                  Use this if the failed-jobs inbox is full of old noise and you want a clean slate.
                </div>
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button onClick={() => void runAction("clearFailures")} style={action}>Clear Failed Jobs</button>
                <button onClick={() => void savePage()} disabled={saving} style={action}>
                  {saving ? "Saving..." : "Save Event Alerts"}
                </button>
              </div>
            </div>
          </section>

          <details style={box}>
            <summary style={{ cursor: "pointer", fontWeight: 800, color: "#ffdada" }}>Advanced JSON editor</summary>
            <div style={{ color: "#ffbdbd", fontSize: 12, marginTop: 10, marginBottom: 8 }}>
              Only use this if you want to paste raw route JSON. The simple editor above is the safer option.
            </div>
            <textarea style={{ ...input, minHeight: 180 }} value={routesJson} onChange={(e) => setRoutesJson(e.target.value)} />
            <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
              <button onClick={() => setRoutesJson(JSON.stringify(cfg.customRoutes || [], null, 2))} style={action}>Copy Current Routes Into JSON</button>
              <button onClick={() => void applyJsonRoutes()} style={action}>Load JSON Into Editor</button>
            </div>
            {jsonError ? <div style={{ color: "#ff8080", fontSize: 12, marginTop: 8 }}>{jsonError}</div> : null}
            <div style={{ marginTop: 12 }}>
              <ConfigJsonEditor
                title="Full Event Alerts Config"
                value={cfg}
                disabled={saving}
                onApply={(next) => setCfg({ ...EMPTY, ...(next as EventCfg) })}
              />
            </div>
          </details>
        </div>
      )}
    </div>
  );
}
