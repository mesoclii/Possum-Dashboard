"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { fetchGuildData, resolveGuildContext } from "@/lib/liveRuntime";

type AutomationItem = {
  id: string;
  name: string;
  description?: string | null;
  status?: string | null;
  enabled?: boolean;
  triggerType?: string;
  triggerConfig?: Record<string, unknown> | null;
  runLimitPerMin?: number;
  maxActions?: number;
  timeoutMs?: number;
  updatedAt?: string;
  publishedAt?: string | null;
};

type AutomationBlock = {
  kind: "CONDITION" | "ACTION";
  type: string;
  config?: Record<string, unknown>;
  order?: number;
  groupId?: string | null;
  groupOp?: "AND" | "OR" | null;
  negate?: boolean;
};

type AutomationDetail = AutomationItem & { blocks?: AutomationBlock[] };
type ExecutionLog = { id?: string; status?: string; reason?: string | null; error?: string | null; durationMs?: number; eventType?: string; createdAt?: string };
type GuildChannel = { id: string; name: string; type?: number | string };
type GuildRole = { id: string; name: string; position?: number };

const box: CSSProperties = { border: "1px solid #650000", borderRadius: 12, padding: 16, marginBottom: 14, background: "rgba(100,0,0,0.10)" };
const input: CSSProperties = { width: "100%", padding: "10px 12px", background: "#0b0b0b", border: "1px solid #700000", color: "#ffd7d7", borderRadius: 8 };
const action: CSSProperties = { ...input, width: "auto", cursor: "pointer", fontWeight: 900, textTransform: "uppercase", letterSpacing: "0.06em" };

function firstIdFromResponse(payload: unknown) {
  if (payload && typeof payload === "object") {
    const record = payload as Record<string, unknown>;
    return String(record.id || record.automationId || "").trim();
  }
  return "";
}

function formatTime(value?: string | null) {
  if (!value) return "Never";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Never";
  return date.toLocaleString();
}

function buildPreset(name: string, channels: GuildChannel[], roles: GuildRole[]) {
  const firstText = channels.find((channel) => Number(channel.type) === 0 || Number(channel.type) === 5)?.id || "";
  const firstRole = roles[0]?.id || "";

  if (name === "join_intake") {
    return {
      meta: {
        name: "Security Join Intake",
        description: "Log and route new joins through a live automation.",
        status: "DRAFT",
        enabled: true,
        triggerType: "MEMBER_JOIN",
        triggerConfig: {},
        runLimitPerMin: 30,
        maxActions: 4,
        timeoutMs: 3000,
      },
      blocks: [
        { kind: "ACTION", type: "SEND_MESSAGE", config: { channelId: firstText, content: "Security intake: <@{{userId}}> joined {{guildName}}." }, order: 0 },
      ] as AutomationBlock[],
    };
  }

  if (name === "link_watch") {
    return {
      meta: {
        name: "Security Link Watch",
        description: "Detect watched invite/link patterns and apply a live security role or reply.",
        status: "DRAFT",
        enabled: true,
        triggerType: "MESSAGE_CREATE",
        triggerConfig: { channels: [], keywords: [] },
        runLimitPerMin: 60,
        maxActions: 4,
        timeoutMs: 3000,
      },
      blocks: [
        { kind: "CONDITION", type: "MESSAGE_CONTAINS", config: { value: "discord.gg" }, order: 0, groupId: "main", groupOp: "AND" },
        { kind: "ACTION", type: "ADD_ROLE", config: { roleId: firstRole }, order: 1 },
        { kind: "ACTION", type: "REPLY", config: { content: "Security watch triggered. Staff review requested.", ephemeral: false }, order: 2 },
      ] as AutomationBlock[],
    };
  }

  return {
    meta: {
      name: "Security Incident Thread",
      description: "Open an incident thread from a live message trigger.",
      status: "DRAFT",
      enabled: true,
      triggerType: "MESSAGE_CREATE",
      triggerConfig: { channels: [], keywords: [] },
      runLimitPerMin: 20,
      maxActions: 4,
      timeoutMs: 3000,
    },
    blocks: [
      { kind: "CONDITION", type: "MESSAGE_STARTS_WITH", config: { value: "!incident" }, order: 0, groupId: "main", groupOp: "AND" },
      { kind: "ACTION", type: "CREATE_THREAD", config: { name: "Incident - {{userId}}", autoArchiveDuration: 1440 }, order: 1 },
      { kind: "ACTION", type: "SEND_MESSAGE", config: { channelId: firstText, content: "Security incident thread opened for <@{{userId}}>." }, order: 2 },
    ] as AutomationBlock[],
  };
}

export default function AutomationStudioClient() {
  const [guildId, setGuildId] = useState("");
  const [guildName, setGuildName] = useState("");
  const [channels, setChannels] = useState<GuildChannel[]>([]);
  const [roles, setRoles] = useState<GuildRole[]>([]);
  const [items, setItems] = useState<AutomationItem[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [detail, setDetail] = useState<AutomationDetail | null>(null);
  const [logs, setLogs] = useState<ExecutionLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const resolved = resolveGuildContext();
    setGuildId(resolved.guildId);
    setGuildName(resolved.guildName);
  }, []);

  const loadList = useCallback(async (targetGuildId: string, keepSelection = true, preferredId = "") => {
    if (!targetGuildId) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      setMessage("");
      const [automationsRes, guildJson] = await Promise.all([
        fetch(`/api/bot/automations?guildId=${encodeURIComponent(targetGuildId)}`, { cache: "no-store" }),
        fetchGuildData(targetGuildId),
      ]);
      const automationsJson = await automationsRes.json().catch(() => ([]));
      const nextItems = Array.isArray(automationsJson?.automations) ? automationsJson.automations : Array.isArray(automationsJson) ? automationsJson : [];
      setItems(nextItems);
      setChannels(Array.isArray(guildJson.channels) ? guildJson.channels : []);
      setRoles(Array.isArray(guildJson.roles) ? guildJson.roles : []);

      const preferred = preferredId && nextItems.some((item: AutomationItem) => item.id === preferredId) ? preferredId : "";
      const nextSelected = preferred || (keepSelection && selectedId && nextItems.some((item: AutomationItem) => item.id === selectedId)
        ? selectedId
        : String(nextItems[0]?.id || ""));
      setSelectedId(nextSelected);
      if (nextSelected) {
        await loadDetail(nextSelected);
      } else {
        setDetail(null);
        setLogs([]);
      }
    } catch (err: any) {
      setMessage(err?.message || "Failed to load security automation runtime.");
    } finally {
      setLoading(false);
    }
  }, [selectedId]);

  async function loadDetail(id: string) {
    if (!id) return;
    const [detailRes, logsRes] = await Promise.all([
      fetch(`/api/bot/automation/${encodeURIComponent(id)}`, { cache: "no-store" }),
      fetch(`/api/bot/automation/${encodeURIComponent(id)}/logs`, { cache: "no-store" }),
    ]);
    const detailJson = await detailRes.json().catch(() => ({}));
    const logsJson = await logsRes.json().catch(() => ([]));
    if (!detailRes.ok) throw new Error(detailJson?.error || "Failed to load automation detail.");
    setDetail(detailJson as AutomationDetail);
    setLogs(Array.isArray(logsJson?.logs) ? logsJson.logs : Array.isArray(logsJson) ? logsJson : []);
  }

  useEffect(() => {
    void loadList(guildId, false);
  }, [guildId, loadList]);

  async function saveMeta(patch: Partial<AutomationItem>, okLabel: string) {
    if (!selectedId) return;
    try {
      setSaving(true);
      setMessage("");
      const res = await fetch(`/api/bot/automation/${encodeURIComponent(selectedId)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || "Save failed.");
      await loadList(guildId);
      setMessage(okLabel);
    } catch (err: any) {
      setMessage(err?.message || "Save failed.");
    } finally {
      setSaving(false);
    }
  }

  async function publishSelected() {
    if (!selectedId) return;
    try {
      setSaving(true);
      setMessage("");
      const res = await fetch(`/api/bot/automation/${encodeURIComponent(selectedId)}/publish`, { method: "POST" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || "Publish failed.");
      await loadList(guildId);
      setMessage("Published live security automation.");
    } catch (err: any) {
      setMessage(err?.message || "Publish failed.");
    } finally {
      setSaving(false);
    }
  }

  async function createPreset(presetName: string, okLabel: string) {
    if (!guildId) return;
    try {
      setSaving(true);
      setMessage("");
      const preset = buildPreset(presetName, channels, roles);
      const createRes = await fetch("/api/bot/automations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ guildId, createdBy: "dashboard", version: 1, ...preset.meta }),
      });
      const createJson = await createRes.json().catch(() => ({}));
      if (!createRes.ok) throw new Error(createJson?.error || "Failed to create automation.");
      const automationId = firstIdFromResponse(createJson);
      if (!automationId) throw new Error("Create succeeded but automation id was missing.");
      const blockRes = await fetch(`/api/bot/automation/${encodeURIComponent(automationId)}/blocks`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ blocks: preset.blocks }),
      });
      const blockJson = await blockRes.json().catch(() => ({}));
      if (!blockRes.ok) throw new Error(blockJson?.error || "Failed to save automation blocks.");
      setSelectedId(automationId);
      await loadList(guildId, false, automationId);
      setMessage(okLabel);
    } catch (err: any) {
      setMessage(err?.message || "Preset creation failed.");
    } finally {
      setSaving(false);
    }
  }

  const publishedCount = useMemo(() => items.filter((item) => item.status === "PUBLISHED" || item.publishedAt).length, [items]);
  const enabledCount = useMemo(() => items.filter((item) => item.enabled !== false).length, [items]);

  if (!guildId && !loading) return <div style={{ color: "#ff8585", padding: 20 }}>Missing guildId. Open from `/guilds` first.</div>;

  return (
    <div style={{ color: "#ff5a5a", maxWidth: 1320 }}>
      <div style={box}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
          <div>
            <h1 style={{ margin: 0, textTransform: "uppercase", letterSpacing: "0.14em" }}>Security Automation</h1>
            <p style={{ margin: "6px 0 0" }}>Guild: {guildName || guildId}</p>
            <div style={{ color: "#ffb3b3", fontSize: 12 }}>
              This surface now uses the live bot automation runtime. Moderator/security enforcement stays in the security engines; this page manages notification, routing, and role-thread workflows.
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Link href={`/dashboard/automations/studio?guildId=${encodeURIComponent(guildId)}`} style={{ ...action, textDecoration: "none" }}>Full Studio</Link>
            <Link href={`/dashboard/security?guildId=${encodeURIComponent(guildId)}`} style={{ ...action, textDecoration: "none" }}>Security Hub</Link>
          </div>
        </div>
        {message ? <div style={{ marginTop: 10, color: "#ffb3f0" }}>{message}</div> : null}
      </div>

      {loading ? <div style={box}>Loading security automations...</div> : null}

      {!loading ? (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4,minmax(180px,1fr))", gap: 10, marginBottom: 14 }}>
            <div style={box}><div style={{ fontSize: 12, color: "#ffb5b5" }}>Automations</div><div style={{ fontSize: 28, fontWeight: 900 }}>{items.length}</div></div>
            <div style={box}><div style={{ fontSize: 12, color: "#ffb5b5" }}>Enabled</div><div style={{ fontSize: 28, fontWeight: 900 }}>{enabledCount}</div></div>
            <div style={box}><div style={{ fontSize: 12, color: "#ffb5b5" }}>Published</div><div style={{ fontSize: 28, fontWeight: 900 }}>{publishedCount}</div></div>
            <div style={box}><div style={{ fontSize: 12, color: "#ffb5b5" }}>Recent Logs</div><div style={{ fontSize: 28, fontWeight: 900 }}>{logs.length}</div></div>
          </div>

          <div style={box}>
            <h3 style={{ marginTop: 0, color: "#ff4444" }}>Quick Presets</h3>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button type="button" disabled={saving} style={action} onClick={() => void createPreset("join_intake", "Created join intake preset.")}>Join Intake</button>
              <button type="button" disabled={saving} style={action} onClick={() => void createPreset("link_watch", "Created link watch preset.")}>Link Watch</button>
              <button type="button" disabled={saving} style={action} onClick={() => void createPreset("incident_thread", "Created incident thread preset.")}>Incident Thread</button>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "minmax(320px,0.9fr) minmax(0,1.1fr)", gap: 14 }}>
            <div style={box}>
              <h3 style={{ marginTop: 0, color: "#ff4444" }}>Live Automations</h3>
              <div style={{ display: "grid", gap: 8 }}>
                {items.length === 0 ? <div style={{ color: "#ffb3b3" }}>No live automations for this guild yet.</div> : items.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setSelectedId(item.id);
                      void loadDetail(item.id);
                    }}
                    style={{
                      textAlign: "left",
                      padding: 12,
                      borderRadius: 10,
                      border: item.id === selectedId ? "1px solid #ff5555" : "1px solid #4f0000",
                      background: item.id === selectedId ? "rgba(255,0,0,0.14)" : "#130000",
                      color: "#ffd6d6",
                      cursor: "pointer",
                    }}
                  >
                    <div style={{ fontWeight: 900 }}>{item.name || item.id}</div>
                    <div style={{ fontSize: 12, color: "#ffb3b3" }}>{item.triggerType || "No trigger"} | {item.enabled === false ? "Disabled" : "Enabled"} | {item.status || "DRAFT"}</div>
                  </button>
                ))}
              </div>
            </div>

            <div style={box}>
              <h3 style={{ marginTop: 0, color: "#ff4444" }}>Selected Automation</h3>
              {!detail ? <div style={{ color: "#ffb3b3" }}>Select an automation to inspect its live runtime and logs.</div> : (
                <>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                    <div>
                      <label>Name</label>
                      <input style={input} value={String(detail.name || "")} onChange={(event) => setDetail((prev) => (prev ? { ...prev, name: event.target.value } : prev))} />
                    </div>
                    <div>
                      <label>Trigger</label>
                      <input style={input} readOnly value={String(detail.triggerType || "")} />
                    </div>
                    <div style={{ gridColumn: "1 / -1" }}>
                      <label>Description</label>
                      <textarea style={{ ...input, minHeight: 90 }} value={String(detail.description || "")} onChange={(event) => setDetail((prev) => (prev ? { ...prev, description: event.target.value } : prev))} />
                    </div>
                    <label><input type="checkbox" checked={detail.enabled !== false} onChange={(event) => setDetail((prev) => (prev ? { ...prev, enabled: event.target.checked } : prev))} /> Enabled</label>
                    <div>
                      <label>Status</label>
                      <input style={input} readOnly value={String(detail.status || "DRAFT")} />
                    </div>
                    <div>
                      <label>Run limit / min</label>
                      <input style={input} type="number" value={Number(detail.runLimitPerMin || 30)} onChange={(event) => setDetail((prev) => (prev ? { ...prev, runLimitPerMin: Number(event.target.value || 0) } : prev))} />
                    </div>
                    <div>
                      <label>Max actions</label>
                      <input style={input} type="number" value={Number(detail.maxActions || 25)} onChange={(event) => setDetail((prev) => (prev ? { ...prev, maxActions: Number(event.target.value || 0) } : prev))} />
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
                    <button type="button" disabled={saving} style={action} onClick={() => void saveMeta({ name: detail.name, description: detail.description, enabled: detail.enabled, runLimitPerMin: detail.runLimitPerMin, maxActions: detail.maxActions }, "Saved live automation metadata.")}>Save Meta</button>
                    <button type="button" disabled={saving} style={action} onClick={() => void publishSelected()}>Publish</button>
                    <Link href={`/dashboard/automations/studio?guildId=${encodeURIComponent(guildId)}&automationId=${encodeURIComponent(detail.id)}`} style={{ ...action, textDecoration: "none" }}>Open In Studio</Link>
                  </div>

                  <div style={{ marginTop: 14 }}>
                    <div style={{ color: "#ffb5b5", fontSize: 12, marginBottom: 6 }}>Live blocks</div>
                    <div style={{ display: "grid", gap: 8 }}>
                      {Array.isArray(detail.blocks) && detail.blocks.length ? detail.blocks.map((block, index) => (
                        <div key={`${block.kind}_${block.type}_${index}`} style={{ border: "1px solid #4f0000", borderRadius: 10, padding: 10, background: "#100000" }}>
                          <div style={{ fontWeight: 900 }}>{block.kind} - {block.type}</div>
                          <div style={{ fontSize: 12, color: "#ffb3b3" }}>{JSON.stringify(block.config || {})}</div>
                        </div>
                      )) : <div style={{ color: "#ffb3b3" }}>No blocks saved yet.</div>}
                    </div>
                  </div>

                  <div style={{ marginTop: 14 }}>
                    <div style={{ color: "#ffb5b5", fontSize: 12, marginBottom: 6 }}>Recent execution logs</div>
                    <div style={{ display: "grid", gap: 8 }}>
                      {logs.length ? logs.slice(0, 10).map((row) => (
                        <div key={String(row.id || `${row.eventType}_${row.createdAt}`)} style={{ border: "1px solid #4f0000", borderRadius: 10, padding: 10, background: "#100000" }}>
                          <div style={{ fontWeight: 900 }}>{String(row.eventType || "EVENT")} - {String(row.status || "UNKNOWN")}</div>
                          <div style={{ fontSize: 12, color: "#ffb3b3" }}>{String(row.reason || row.error || "No error")} | {Number(row.durationMs || 0)}ms | {formatTime(row.createdAt)}</div>
                        </div>
                      )) : <div style={{ color: "#ffb3b3" }}>No execution logs for this automation yet.</div>}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
