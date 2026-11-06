"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import { resolveGuildContext, fetchRuntimeEngine, saveRuntimeEngine, fetchGuildData, runRuntimeEngineAction } from "@/lib/liveRuntime";

type RuntimePayload = {
  config?: Record<string, any>;
  summary?: Array<{ label: string; value: string }>;
  details?: Record<string, Array<{ rank?: number; name?: string; title?: string; value: string }>>;
};

type Role = { id: string; name: string; position?: number };
type Channel = { id: string; name: string; type?: number | string };

const card: CSSProperties = {
  border: "1px solid #5f0000",
  borderRadius: 12,
  padding: 14,
  background: "rgba(120,0,0,0.08)",
  marginBottom: 12,
};

function boundedInt(value: unknown, fallback: number, min: number, max: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(min, Math.min(max, Math.floor(parsed))) : fallback;
}

const input: CSSProperties = {
  width: "100%",
  background: "#0a0a0a",
  color: "#ffd0d0",
  border: "1px solid #7f0000",
  borderRadius: 8,
  padding: "10px 12px",
};

export default function LeaderboardClient() {
  const [guildId, setGuildId] = useState("");
  const [guildName, setGuildName] = useState("");
  const [runtime, setRuntime] = useState<RuntimePayload>({});
  const [roles, setRoles] = useState<Role[]>([]);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const resolved = resolveGuildContext();
    setGuildId(resolved.guildId);
    setGuildName(resolved.guildName);
  }, []);

  async function loadAll(targetGuildId: string) {
    if (!targetGuildId) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      setMessage("");
      const [runtimeJson, guildJson] = await Promise.all([
        fetchRuntimeEngine(targetGuildId, "inviteTracker"),
        fetchGuildData(targetGuildId),
      ]);
      setRuntime({
        config: runtimeJson?.config || {},
        summary: Array.isArray(runtimeJson?.summary) ? runtimeJson.summary : [],
        details: runtimeJson?.details && typeof runtimeJson.details === "object" ? runtimeJson.details : {},
      });
      setRoles(Array.isArray(guildJson.roles) ? guildJson.roles : []);
      setChannels(Array.isArray(guildJson.channels) ? guildJson.channels : []);
    } catch (err: any) {
      setMessage(err?.message || "Failed to load invite tracker runtime.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadAll(guildId);
  }, [guildId]);

  async function saveAll() {
    if (!guildId) return;
    try {
      setSaving(true);
      setMessage("");
      const config = {
        ...(runtime.config || {}),
        stayDays: boundedInt(runtime.config?.stayDays, 7, 0, 3650),
        minAccountAgeDays: boundedInt(runtime.config?.minAccountAgeDays, 3, 0, 3650),
        recruiterThreshold: boundedInt(runtime.config?.recruiterThreshold, 10, 0, 1_000_000),
      };
      const json = await saveRuntimeEngine(guildId, "inviteTracker", config);
      setRuntime({
        config: json?.config || config,
        summary: Array.isArray(json?.summary) ? json.summary : [],
        details: json?.details && typeof json.details === "object" ? json.details : {},
      });
      setMessage("Saved invite tracker runtime.");
    } catch (err: any) {
      setMessage(err?.message || "Save failed.");
    } finally {
      setSaving(false);
    }
  }

  async function refreshCache() {
    if (!guildId) return;
    try {
      setSaving(true);
      setMessage("");
      await runRuntimeEngineAction(guildId, "inviteTracker", "refreshCache");
      await loadAll(guildId);
      setMessage("Invite cache refreshed from Discord.");
    } catch (err: any) {
      setMessage(err?.message || "Refresh failed.");
    } finally {
      setSaving(false);
    }
  }

  const textChannels = channels.filter((channel) => Number(channel.type) === 0 || Number(channel.type) === 5);
  const leaderboardRows = Array.isArray(runtime?.details?.leaderboard) ? runtime.details!.leaderboard! : [];

  if (!guildId && !loading) {
    return <div style={{ color: "#ffb3b3", padding: 20 }}>Missing guildId. Open from `/guilds` first.</div>;
  }

  return (
    <div style={{ color: "#ff5c5c", padding: 18, maxWidth: 1280 }}>
      <div style={card}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <div>
            <h1 style={{ margin: 0, letterSpacing: "0.12em", textTransform: "uppercase" }}>Invite Leaderboard</h1>
            <div style={{ color: "#ff9f9f", marginTop: 6 }}>Guild: {guildName || guildId}</div>
            <div style={{ color: "#ffb5b5", fontSize: 12, marginTop: 8 }}>
              This page now edits the live `inviteTracker` engine. The old reward-tier leaderboard config was dashboard-only and did not affect bot runtime.
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button type="button" disabled={saving} onClick={() => void refreshCache()} style={{ ...input, width: "auto", cursor: "pointer", fontWeight: 900 }}>
              Refresh Invite Cache
            </button>
            <button type="button" disabled={saving} onClick={() => void saveAll()} style={{ ...input, width: "auto", cursor: "pointer", fontWeight: 900 }}>
              {saving ? "Saving..." : "Save Invite Tracker"}
            </button>
          </div>
        </div>
        {message ? <div style={{ color: "#ffb3f0", marginTop: 10 }}>{message}</div> : null}
      </div>

      {loading ? <div style={card}>Loading invite tracker runtime...</div> : null}

      {!loading ? (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 10, marginBottom: 12 }}>
            {(runtime.summary || []).map((row) => (
              <div key={row.label} style={card}>
                <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.08em", color: "#ffadad" }}>{row.label}</div>
                <div style={{ marginTop: 6, fontSize: 22, fontWeight: 900, color: "#fff" }}>{row.value}</div>
              </div>
            ))}
          </div>

          <div style={card}>
            <h3 style={{ marginTop: 0, color: "#ff6666", textTransform: "uppercase", letterSpacing: "0.08em" }}>Live Invite Rules</h3>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,minmax(180px,1fr))", gap: 10 }}>
              <label><input type="checkbox" checked={Boolean(runtime.config?.enabled)} onChange={(event) => setRuntime((prev) => ({ ...prev, config: { ...(prev.config || {}), enabled: event.target.checked } }))} /> Engine enabled</label>
              <label><input type="checkbox" checked={Boolean(runtime.config?.removeVipOnDrop)} onChange={(event) => setRuntime((prev) => ({ ...prev, config: { ...(prev.config || {}), removeVipOnDrop: event.target.checked } }))} /> Remove VIP when inviter drops</label>
              <div><label>Stay days</label><input style={input} type="number" min={0} max={3650} step={1} value={boundedInt(runtime.config?.stayDays, 7, 0, 3650)} onChange={(event) => setRuntime((prev) => ({ ...prev, config: { ...(prev.config || {}), stayDays: boundedInt(event.target.value, 7, 0, 3650) } }))} /></div>
              <div><label>Min account age days</label><input style={input} type="number" min={0} max={3650} step={1} value={boundedInt(runtime.config?.minAccountAgeDays, 3, 0, 3650)} onChange={(event) => setRuntime((prev) => ({ ...prev, config: { ...(prev.config || {}), minAccountAgeDays: boundedInt(event.target.value, 3, 0, 3650) } }))} /></div>
              <div><label>Recruiter threshold</label><input style={input} type="number" min={0} max={1_000_000} step={1} value={boundedInt(runtime.config?.recruiterThreshold, 10, 0, 1_000_000)} onChange={(event) => setRuntime((prev) => ({ ...prev, config: { ...(prev.config || {}), recruiterThreshold: boundedInt(event.target.value, 10, 0, 1_000_000) } }))} /></div>
              <div>
                <label>Join Log Channel</label>
                <select style={input} value={String(runtime.config?.joinLogChannelId || "")} onChange={(event) => setRuntime((prev) => ({ ...prev, config: { ...(prev.config || {}), joinLogChannelId: event.target.value } }))}>
                  <option value="">None</option>
                  {textChannels.map((channel) => <option key={channel.id} value={channel.id}>#{channel.name}</option>)}
                </select>
              </div>
              <div>
                <label>Leave Log Channel</label>
                <select style={input} value={String(runtime.config?.leaveLogChannelId || "")} onChange={(event) => setRuntime((prev) => ({ ...prev, config: { ...(prev.config || {}), leaveLogChannelId: event.target.value } }))}>
                  <option value="">None</option>
                  {textChannels.map((channel) => <option key={channel.id} value={channel.id}>#{channel.name}</option>)}
                </select>
              </div>
              <div>
                <label>Shared Fallback Log Channel</label>
                <select style={input} value={String(runtime.config?.logChannelId || "")} onChange={(event) => setRuntime((prev) => ({ ...prev, config: { ...(prev.config || {}), logChannelId: event.target.value } }))}>
                  <option value="">None</option>
                  {textChannels.map((channel) => <option key={channel.id} value={channel.id}>#{channel.name}</option>)}
                </select>
              </div>
              <div>
                <label>Recruiter role</label>
                <select style={input} value={String(runtime.config?.recruiterRoleId || "")} onChange={(event) => setRuntime((prev) => ({ ...prev, config: { ...(prev.config || {}), recruiterRoleId: event.target.value } }))}>
                  <option value="">None</option>
                  {roles.map((role) => <option key={role.id} value={role.id}>@{role.name}</option>)}
                </select>
              </div>
              <div>
                <label>Recruited role</label>
                <select style={input} value={String(runtime.config?.recruitedRoleId || "")} onChange={(event) => setRuntime((prev) => ({ ...prev, config: { ...(prev.config || {}), recruitedRoleId: event.target.value } }))}>
                  <option value="">None</option>
                  {roles.map((role) => <option key={role.id} value={role.id}>@{role.name}</option>)}
                </select>
              </div>
              <div>
                <label>VIP role</label>
                <select style={input} value={String(runtime.config?.vipRoleId || "")} onChange={(event) => setRuntime((prev) => ({ ...prev, config: { ...(prev.config || {}), vipRoleId: event.target.value } }))}>
                  <option value="">None</option>
                  {roles.map((role) => <option key={role.id} value={role.id}>@{role.name}</option>)}
                </select>
              </div>
            </div>
          </div>

          <div style={card}>
            <h3 style={{ marginTop: 0, color: "#ff6666", textTransform: "uppercase", letterSpacing: "0.08em" }}>Live Leaderboard</h3>
            {leaderboardRows.length ? leaderboardRows.map((row) => (
              <div key={`${row.rank || 0}_${row.name || row.title || "row"}`} style={{ borderTop: "1px solid #3a0000", paddingTop: 10, marginTop: 10 }}>
                <div style={{ fontWeight: 900 }}>{row.rank ? `#${row.rank} ` : ""}{row.name || row.title}</div>
                <div style={{ color: "#ffb3b3", fontSize: 12 }}>{row.value}</div>
              </div>
            )) : <div style={{ color: "#ffb3b3" }}>No invite leaderboard data stored yet.</div>}
          </div>

          <div style={card}>
            <Link href={`/dashboard/slash-commands?guildId=${encodeURIComponent(guildId)}`} style={{ ...input, width: "auto", textDecoration: "none", fontWeight: 800 }}>
              Manage `/invite` and overlapping built-in commands
            </Link>
          </div>
        </>
      ) : null}
    </div>
  );
}
