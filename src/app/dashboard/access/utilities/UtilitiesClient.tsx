"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import {
  fetchDashboardConfig,
  fetchGuildData,
  fetchRuntimeEngine,
  resolveGuildContext,
  runRuntimeEngineAction,
  saveDashboardConfig,
  saveRuntimeEngine,
} from "@/lib/liveRuntime";

type GuildRole = { id: string; name: string; position?: number };
type GuildChannel = { id: string; name: string; type?: number | string };
type RuntimePayload = { config?: Record<string, any>; summary?: Array<{ label?: string; value?: string }> };
type EngineKey = "store" | "tickets" | "selfroles" | "botPersonalizer" | "tts" | "radio" | "loyalty";
type RuntimeMap = Record<EngineKey, RuntimePayload>;

const box: CSSProperties = { border: "1px solid #5f0000", borderRadius: 12, padding: 14, background: "rgba(120,0,0,0.10)", marginBottom: 14 };
const input: CSSProperties = { width: "100%", padding: 10, borderRadius: 8, border: "1px solid #6f0000", background: "#0a0a0a", color: "#ffd6d6" };
const action: CSSProperties = { ...input, width: "auto", cursor: "pointer", fontWeight: 900, textTransform: "uppercase", letterSpacing: "0.06em" };

const DEFAULT_RUNTIME: RuntimeMap = {
  store: { config: {} },
  tickets: { config: {} },
  selfroles: { config: {} },
  botPersonalizer: { config: {} },
  tts: { config: {} },
  radio: { config: {} },
  loyalty: { config: {} },
};

const engineKeys: EngineKey[] = ["store", "tickets", "selfroles", "botPersonalizer", "tts", "radio", "loyalty"];

function toggleId(list: string[], id: string) {
  return list.includes(id) ? list.filter((value) => value !== id) : [...list, id];
}

function summaryText(payload?: RuntimePayload) {
  const items = Array.isArray(payload?.summary) ? payload.summary.slice(0, 4) : [];
  return items.length ? items.map((item) => `${String(item.label || "State")}: ${String(item.value || "-")}`).join(" | ") : "Live runtime connected.";
}

function RoleChips({ label, roles, selected, onToggle }: { label: string; roles: GuildRole[]; selected: string[]; onToggle: (roleId: string) => void }) {
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

export default function UtilitiesClient() {
  const [guildId, setGuildId] = useState("");
  const [guildName, setGuildName] = useState("");
  const [channels, setChannels] = useState<GuildChannel[]>([]);
  const [roles, setRoles] = useState<GuildRole[]>([]);
  const [dashboardConfig, setDashboardConfig] = useState<Record<string, any>>({});
  const [runtime, setRuntime] = useState<RuntimeMap>(DEFAULT_RUNTIME);
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
        const [guildJson, dashboardJson, ...runtimeJson] = await Promise.all([
          fetchGuildData(targetGuildId),
          fetchDashboardConfig(targetGuildId),
          ...engineKeys.map((engine) => fetchRuntimeEngine(targetGuildId, engine)),
        ]);
        setChannels(Array.isArray(guildJson.channels) ? guildJson.channels : []);
        setRoles(Array.isArray(guildJson.roles) ? guildJson.roles : []);
        setDashboardConfig(dashboardJson || {});
        setRuntime({
          store: runtimeJson[0] || { config: {} },
          tickets: runtimeJson[1] || { config: {} },
          selfroles: runtimeJson[2] || { config: {} },
          botPersonalizer: runtimeJson[3] || { config: {} },
          tts: runtimeJson[4] || { config: {} },
          radio: runtimeJson[5] || { config: {} },
          loyalty: runtimeJson[6] || { config: {} },
        });
      } catch (err: any) {
        setMessage(err?.message || "Failed to load live utility engines.");
      } finally {
        setLoading(false);
      }
    }
    void loadAll(guildId);
  }, [guildId]);

  function setEngineConfig(engine: EngineKey, updater: (current: Record<string, any>) => Record<string, any>) {
    setRuntime((prev) => ({ ...prev, [engine]: { ...(prev[engine] || { config: {} }), config: updater((prev[engine]?.config as Record<string, any>) || {}) } }));
  }

  async function saveEngine(engine: EngineKey, okLabel: string) {
    if (!guildId) return;
    try {
      setSaving(true);
      setMessage("");
      const json = await saveRuntimeEngine(guildId, engine, (runtime[engine]?.config as Record<string, unknown>) || {});
      setRuntime((prev) => ({ ...prev, [engine]: json as RuntimePayload }));
      setMessage(okLabel);
    } catch (err: any) {
      setMessage(err?.message || "Save failed.");
    } finally {
      setSaving(false);
    }
  }

  async function runAction(engine: EngineKey, actionName: string, okLabel: string) {
    if (!guildId) return;
    try {
      setSaving(true);
      setMessage("");
      await runRuntimeEngineAction(guildId, engine, actionName);
      const refreshed = await fetchRuntimeEngine(guildId, engine);
      setRuntime((prev) => ({ ...prev, [engine]: refreshed as RuntimePayload }));
      setMessage(okLabel);
    } catch (err: any) {
      setMessage(err?.message || "Action failed.");
    } finally {
      setSaving(false);
    }
  }

  async function saveFeaturePatch(patch: Record<string, boolean>, okLabel: string) {
    if (!guildId) return;
    try {
      setSaving(true);
      setMessage("");
      await saveDashboardConfig(guildId, { features: patch });
      setDashboardConfig((prev) => ({ ...prev, features: { ...(prev.features || {}), ...patch } }));
      setMessage(okLabel);
    } catch (err: any) {
      setMessage(err?.message || "Feature gate save failed.");
    } finally {
      setSaving(false);
    }
  }

  const textChannels = useMemo(() => channels.filter((channel) => Number(channel.type) === 0 || Number(channel.type) === 5), [channels]);
  const categoryChannels = useMemo(() => channels.filter((channel) => Number(channel.type) === 4), [channels]);
  const voiceChannels = useMemo(() => channels.filter((channel) => Number(channel.type) === 2 || Number(channel.type) === 13), [channels]);

  const store = (runtime.store?.config as Record<string, any>) || {};
  const tickets = (runtime.tickets?.config as Record<string, any>) || {};
  const selfroles = (runtime.selfroles?.config as Record<string, any>) || {};
  const botPersonalizer = (runtime.botPersonalizer?.config as Record<string, any>) || {};
  const tts = (runtime.tts?.config as Record<string, any>) || {};
  const radio = (runtime.radio?.config as Record<string, any>) || {};
  const loyalty = (runtime.loyalty?.config as Record<string, any>) || {};

  if (!guildId && !loading) return <div style={{ color: "#ff8080", padding: 24 }}>Missing guildId. Open from `/guilds` first.</div>;

  return (
    <div style={{ color: "#ff5c5c", padding: 20, maxWidth: 1320 }}>
      <div style={box}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
          <div>
            <h1 style={{ marginTop: 0, letterSpacing: "0.14em", textTransform: "uppercase" }}>Utilities Runtime</h1>
            <p style={{ marginTop: 6 }}>Guild: {guildName || guildId}</p>
            <div style={{ color: "#ffb3b3", fontSize: 12 }}>This page now edits the live utility engines the bot actually runs. No utility shadow file remains here.</div>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Link href={`/dashboard/channels?guildId=${encodeURIComponent(guildId)}`} style={{ ...action, textDecoration: "none" }}>Channels</Link>
            <Link href={`/dashboard/slash-commands?guildId=${encodeURIComponent(guildId)}`} style={{ ...action, textDecoration: "none" }}>Slash Commands</Link>
          </div>
        </div>
        {message ? <div style={{ marginTop: 10, color: "#ffb3f0" }}>{message}</div> : null}
      </div>

      {loading ? <div style={box}>Loading utility engines...</div> : null}

      {!loading ? (
        <>
          <div style={box}>
            <h3 style={{ marginTop: 0, color: "#ff4444" }}>Feature Gates</h3>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,minmax(180px,1fr))", gap: 10 }}>
              <label><input type="checkbox" checked={Boolean(dashboardConfig?.features?.economyEnabled)} onChange={(event) => void saveFeaturePatch({ economyEnabled: event.target.checked }, `Economy feature ${event.target.checked ? "enabled" : "disabled"}.`)} /> Economy</label>
              <label><input type="checkbox" checked={Boolean(dashboardConfig?.features?.ttsEnabled)} onChange={(event) => void saveFeaturePatch({ ttsEnabled: event.target.checked }, `TTS feature ${event.target.checked ? "enabled" : "disabled"}.`)} /> TTS</label>
              <label><input type="checkbox" checked={Boolean(dashboardConfig?.features?.birthdayEnabled)} onChange={(event) => void saveFeaturePatch({ birthdayEnabled: event.target.checked }, `Radio birthday feature ${event.target.checked ? "enabled" : "disabled"}.`)} /> Radio</label>
            </div>
          </div>

          <div style={box}>
            <h3 style={{ marginTop: 0, color: "#ff4444" }}>Store</h3>
            <div style={{ color: "#ffb3b3", fontSize: 12, marginBottom: 10 }}>{summaryText(runtime.store)}</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,minmax(180px,1fr))", gap: 10 }}>
              <label><input type="checkbox" checked={Boolean(store.active)} onChange={(event) => setEngineConfig("store", (current) => ({ ...current, active: event.target.checked }))} /> Active</label>
              <label><input type="checkbox" checked={Boolean(store.panel?.enabled)} onChange={(event) => setEngineConfig("store", (current) => ({ ...current, panel: { ...(current.panel || {}), enabled: event.target.checked } }))} /> Panel Enabled</label>
              <label><input type="checkbox" checked={Boolean(store.policies?.requireStaffApproval)} onChange={(event) => setEngineConfig("store", (current) => ({ ...current, policies: { ...(current.policies || {}), requireStaffApproval: event.target.checked } }))} /> Staff Approval</label>
              <div>
                <label>Panel channel</label>
                <select style={input} value={String(store.panel?.channelId || "")} onChange={(event) => setEngineConfig("store", (current) => ({ ...current, panel: { ...(current.panel || {}), channelId: event.target.value } }))}>
                  <option value="">Select channel</option>
                  {textChannels.map((channel) => <option key={channel.id} value={channel.id}>#{channel.name}</option>)}
                </select>
              </div>
              <div>
                <label>Panel title</label>
                <input style={input} value={String(store.panel?.title || "")} onChange={(event) => setEngineConfig("store", (current) => ({ ...current, panel: { ...(current.panel || {}), title: event.target.value } }))} />
              </div>
              <div>
                <label>Log channel</label>
                <select style={input} value={String(store.policies?.logChannelId || "")} onChange={(event) => setEngineConfig("store", (current) => ({ ...current, policies: { ...(current.policies || {}), logChannelId: event.target.value } }))}>
                  <option value="">Select channel</option>
                  {textChannels.map((channel) => <option key={channel.id} value={channel.id}>#{channel.name}</option>)}
                </select>
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
              <button type="button" disabled={saving} style={action} onClick={() => void saveEngine("store", "Saved live store runtime.")}>Save Store</button>
              <Link href={`/dashboard/economy/store?guildId=${encodeURIComponent(guildId)}`} style={{ ...action, textDecoration: "none" }}>Open Store Studio</Link>
            </div>
          </div>

          <div style={box}>
            <h3 style={{ marginTop: 0, color: "#ff4444" }}>Tickets + Selfroles</h3>
            <div style={{ color: "#ffb3b3", fontSize: 12, marginBottom: 10 }}>{summaryText(runtime.tickets)} | {summaryText(runtime.selfroles)}</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,320px),1fr))", gap: 14 }}>
              <div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,220px),1fr))", gap: 10 }}>
                  <label><input type="checkbox" checked={Boolean(tickets.active)} onChange={(event) => setEngineConfig("tickets", (current) => ({ ...current, active: event.target.checked }))} /> Tickets Active</label>
                  <label><input type="checkbox" checked={Boolean(tickets.singleLogMode)} onChange={(event) => setEngineConfig("tickets", (current) => ({ ...current, singleLogMode: event.target.checked }))} /> Single Log Mode</label>
                  <div>
                    <label>Panel channel</label>
                    <select style={input} value={String(tickets.panelChannelId || "")} onChange={(event) => setEngineConfig("tickets", (current) => ({ ...current, panelChannelId: event.target.value }))}>
                      <option value="">Select channel</option>
                      {textChannels.map((channel) => <option key={channel.id} value={channel.id}>#{channel.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label>Transcript log</label>
                    <select style={input} value={String(tickets.transcriptLogId || "")} onChange={(event) => setEngineConfig("tickets", (current) => ({ ...current, transcriptLogId: event.target.value }))}>
                      <option value="">Select channel</option>
                      {textChannels.map((channel) => <option key={channel.id} value={channel.id}>#{channel.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label>Open category</label>
                    <select style={input} value={String(tickets.openCategoryId || "")} onChange={(event) => setEngineConfig("tickets", (current) => ({ ...current, openCategoryId: event.target.value }))}>
                      <option value="">Select category</option>
                      {categoryChannels.map((channel) => <option key={channel.id} value={channel.id}>{channel.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label>Closed category</label>
                    <select style={input} value={String(tickets.closedCategoryId || "")} onChange={(event) => setEngineConfig("tickets", (current) => ({ ...current, closedCategoryId: event.target.value }))}>
                      <option value="">Select category</option>
                      {categoryChannels.map((channel) => <option key={channel.id} value={channel.id}>{channel.name}</option>)}
                    </select>
                  </div>
                </div>
                <RoleChips label="Staff roles" roles={roles} selected={Array.isArray(tickets.staffRoleIds) ? tickets.staffRoleIds : []} onToggle={(roleId) => setEngineConfig("tickets", (current) => ({ ...current, staffRoleIds: toggleId(Array.isArray(current.staffRoleIds) ? current.staffRoleIds : [], roleId) }))} />
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
                  <button type="button" disabled={saving} style={action} onClick={() => void saveEngine("tickets", "Saved live tickets runtime.")}>Save Tickets</button>
                  <button type="button" disabled={saving} style={action} onClick={() => void runAction("tickets", "deployPanel", "Deployed tickets panel.")}>Deploy Panel</button>
                </div>
              </div>
              <div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,220px),1fr))", gap: 10 }}>
                  <label><input type="checkbox" checked={Boolean(selfroles.active)} onChange={(event) => setEngineConfig("selfroles", (current) => ({ ...current, active: event.target.checked }))} /> Selfroles Active</label>
                  <label><input type="checkbox" checked={Boolean(selfroles.requireVerification)} onChange={(event) => setEngineConfig("selfroles", (current) => ({ ...current, requireVerification: event.target.checked }))} /> Require Verification</label>
                  <div>
                    <label>Verification role</label>
                    <select style={input} value={String(selfroles.verificationRoleId || "")} onChange={(event) => setEngineConfig("selfroles", (current) => ({ ...current, verificationRoleId: event.target.value }))}>
                      <option value="">Select role</option>
                      {roles.map((role) => <option key={role.id} value={role.id}>@{role.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label>Log channel</label>
                    <select style={input} value={String(selfroles.logChannelId || "")} onChange={(event) => setEngineConfig("selfroles", (current) => ({ ...current, logChannelId: event.target.value }))}>
                      <option value="">Select channel</option>
                      {textChannels.map((channel) => <option key={channel.id} value={channel.id}>#{channel.name}</option>)}
                    </select>
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
                  <button type="button" disabled={saving} style={action} onClick={() => void saveEngine("selfroles", "Saved live selfroles runtime.")}>Save Selfroles</button>
                  <button type="button" disabled={saving} style={action} onClick={() => void runAction("selfroles", "deployPanels", "Deployed selfroles panels.")}>Deploy Panels</button>
                </div>
              </div>
            </div>
          </div>

          <div style={box}>
            <h3 style={{ marginTop: 0, color: "#ff4444" }}>Bot Personalizer + TTS</h3>
            <div style={{ color: "#ffb3b3", fontSize: 12, marginBottom: 10 }}>{summaryText(runtime.botPersonalizer)} | {summaryText(runtime.tts)}</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <label><input type="checkbox" checked={Boolean(botPersonalizer.enabled)} onChange={(event) => setEngineConfig("botPersonalizer", (current) => ({ ...current, enabled: event.target.checked }))} /> Personalizer Enabled</label>
                  <label><input type="checkbox" checked={Boolean(botPersonalizer.useWebhookPersona)} onChange={(event) => setEngineConfig("botPersonalizer", (current) => ({ ...current, useWebhookPersona: event.target.checked }))} /> Webhook Identity</label>
                  <div>
                    <label>Guild nickname</label>
                    <input style={input} value={String(botPersonalizer.guildNickname || "")} onChange={(event) => setEngineConfig("botPersonalizer", (current) => ({ ...current, guildNickname: event.target.value }))} />
                  </div>
                  <div>
                    <label>Webhook name</label>
                    <input style={input} value={String(botPersonalizer.webhookName || "")} onChange={(event) => setEngineConfig("botPersonalizer", (current) => ({ ...current, webhookName: event.target.value }))} />
                  </div>
                  <div>
                    <label>Status</label>
                    <select style={input} value={String(botPersonalizer.status || "online")} onChange={(event) => setEngineConfig("botPersonalizer", (current) => ({ ...current, status: event.target.value }))}>
                      <option value="online">Online</option>
                      <option value="idle">Idle</option>
                      <option value="dnd">Do Not Disturb</option>
                      <option value="invisible">Invisible</option>
                    </select>
                  </div>
                  <div>
                    <label>Activity type</label>
                    <select style={input} value={String(botPersonalizer.activityType || "LISTENING")} onChange={(event) => setEngineConfig("botPersonalizer", (current) => ({ ...current, activityType: event.target.value }))}>
                      <option value="PLAYING">Playing</option>
                      <option value="LISTENING">Listening</option>
                      <option value="WATCHING">Watching</option>
                      <option value="COMPETING">Competing</option>
                      <option value="STREAMING">Streaming</option>
                    </select>
                  </div>
                  <div style={{ gridColumn: "1 / -1" }}>
                    <label>Activity text</label>
                    <input style={input} value={String(botPersonalizer.activityText || "")} onChange={(event) => setEngineConfig("botPersonalizer", (current) => ({ ...current, activityText: event.target.value }))} />
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
                  <button type="button" disabled={saving} style={action} onClick={() => void saveEngine("botPersonalizer", "Saved live bot personalizer runtime.")}>Save Personalizer</button>
                  <button type="button" disabled={saving} style={action} onClick={() => void runAction("botPersonalizer", "applyProfile", "Applied bot profile live.")}>Apply Live</button>
                  <Link href={`/dashboard/bot-personalizer?guildId=${encodeURIComponent(guildId)}`} style={{ ...action, textDecoration: "none" }}>Open Personalizer</Link>
                </div>
              </div>

              <div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <label><input type="checkbox" checked={Boolean(tts.enabled)} onChange={(event) => setEngineConfig("tts", (current) => ({ ...current, enabled: event.target.checked }))} /> TTS Enabled</label>
                  <label><input type="checkbox" checked={Boolean(tts.commandEnabled)} onChange={(event) => setEngineConfig("tts", (current) => ({ ...current, commandEnabled: event.target.checked }))} /> Command Enabled</label>
                  <label><input type="checkbox" checked={Boolean(tts.autoRouteEnabled)} onChange={(event) => setEngineConfig("tts", (current) => ({ ...current, autoRouteEnabled: event.target.checked }))} /> Auto Route</label>
                  <label><input type="checkbox" checked={Boolean(tts.voiceChannelOnly)} onChange={(event) => setEngineConfig("tts", (current) => ({ ...current, voiceChannelOnly: event.target.checked }))} /> Voice Only</label>
                  <div>
                    <label>Default voice</label>
                    <input style={input} value={String(tts.defaultVoice || "female")} onChange={(event) => setEngineConfig("tts", (current) => ({ ...current, defaultVoice: event.target.value }))} />
                  </div>
                  <div>
                    <label>Max chars</label>
                    <input style={input} type="number" value={Number(tts.maxCharsPerMessage || 0)} onChange={(event) => setEngineConfig("tts", (current) => ({ ...current, maxCharsPerMessage: Number(event.target.value || 0) }))} />
                  </div>
                  <div>
                    <label>Auto text channel</label>
                    <select style={input} value={String(tts.autoTextChannelId || "")} onChange={(event) => setEngineConfig("tts", (current) => ({ ...current, autoTextChannelId: event.target.value }))}>
                      <option value="">Select channel</option>
                      {textChannels.map((channel) => <option key={channel.id} value={channel.id}>#{channel.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label>Auto voice channel</label>
                    <select style={input} value={String(tts.autoVoiceChannelId || "")} onChange={(event) => setEngineConfig("tts", (current) => ({ ...current, autoVoiceChannelId: event.target.value }))}>
                      <option value="">Select channel</option>
                      {voiceChannels.map((channel) => <option key={channel.id} value={channel.id}>{channel.name}</option>)}
                    </select>
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
                  <button type="button" disabled={saving} style={action} onClick={() => void saveEngine("tts", "Saved live TTS runtime.")}>Save TTS</button>
                  <Link href={`/dashboard/tts?guildId=${encodeURIComponent(guildId)}`} style={{ ...action, textDecoration: "none" }}>Open TTS</Link>
                </div>
              </div>
            </div>
          </div>

          <div style={box}>
            <h3 style={{ marginTop: 0, color: "#ff4444" }}>Radio + Loyalty</h3>
            <div style={{ color: "#ffb3b3", fontSize: 12, marginBottom: 10 }}>{summaryText(runtime.radio)} | {summaryText(runtime.loyalty)}</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <label><input type="checkbox" checked={Boolean(radio.active)} onChange={(event) => setEngineConfig("radio", (current) => ({ ...current, active: event.target.checked }))} /> Engine Active</label>
                  <label><input type="checkbox" checked={Boolean(radio.birthday?.enabled)} onChange={(event) => setEngineConfig("radio", (current) => ({ ...current, birthday: { ...(current.birthday || {}), enabled: event.target.checked } }))} /> Birthday Enabled</label>
                  <div>
                    <label>Birthday role</label>
                    <select style={input} value={String(radio.birthday?.roleId || "")} onChange={(event) => setEngineConfig("radio", (current) => ({ ...current, birthday: { ...(current.birthday || {}), roleId: event.target.value } }))}>
                      <option value="">Select role</option>
                      {roles.map((role) => <option key={role.id} value={role.id}>@{role.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label>Broadcast channel</label>
                    <select style={input} value={String(radio.birthday?.broadcastChannelId || "")} onChange={(event) => setEngineConfig("radio", (current) => ({ ...current, birthday: { ...(current.birthday || {}), broadcastChannelId: event.target.value } }))}>
                      <option value="">Select channel</option>
                      {textChannels.map((channel) => <option key={channel.id} value={channel.id}>#{channel.name}</option>)}
                    </select>
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
                  <button type="button" disabled={saving} style={action} onClick={() => void saveEngine("radio", "Saved live radio/birthday runtime.")}>Save Radio</button>
                  <Link href={`/dashboard/economy/radio-birthday?guildId=${encodeURIComponent(guildId)}`} style={{ ...action, textDecoration: "none" }}>Open Radio Birthday</Link>
                </div>
              </div>

              <div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <label><input type="checkbox" checked={Boolean(loyalty.active)} onChange={(event) => setEngineConfig("loyalty", (current) => ({ ...current, active: event.target.checked }))} /> Loyalty Active</label>
                  <div>
                    <label>Timezone</label>
                    <input style={input} value={String(loyalty.timezone || "America/Los_Angeles")} onChange={(event) => setEngineConfig("loyalty", (current) => ({ ...current, timezone: event.target.value }))} />
                  </div>
                  <div>
                    <label>Announce channel</label>
                    <select style={input} value={String(loyalty.announceChannelId || "")} onChange={(event) => setEngineConfig("loyalty", (current) => ({ ...current, announceChannelId: event.target.value }))}>
                      <option value="">Select channel</option>
                      {textChannels.map((channel) => <option key={channel.id} value={channel.id}>#{channel.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label>Heist exempt role</label>
                    <select style={input} value={String(loyalty.heistExemptRoleId || "")} onChange={(event) => setEngineConfig("loyalty", (current) => ({ ...current, heistExemptRoleId: event.target.value }))}>
                      <option value="">Select role</option>
                      {roles.map((role) => <option key={role.id} value={role.id}>@{role.name}</option>)}
                    </select>
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
                  <button type="button" disabled={saving} style={action} onClick={() => void saveEngine("loyalty", "Saved live loyalty runtime.")}>Save Loyalty</button>
                  <button type="button" disabled={saving} style={action} onClick={() => void runAction("loyalty", "syncMembers", "Queued loyalty member sync.")}>Sync Members</button>
                  <button type="button" disabled={saving} style={action} onClick={() => void runAction("loyalty", "processRewards", "Processed loyalty rewards.")}>Process Rewards</button>
                </div>
              </div>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
