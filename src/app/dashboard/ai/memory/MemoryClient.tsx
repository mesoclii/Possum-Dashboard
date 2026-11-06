"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { resolveGuildContext, fetchRuntimeEngine, saveRuntimeEngine, runRuntimeEngineAction } from "@/lib/liveRuntime";

type RuntimeSummary = { label: string; value: string };
type RuntimeDetail = { title?: string; value?: string; rank?: number; name?: string };
type RuntimePayload = {
  config?: Record<string, any>;
  summary?: RuntimeSummary[];
  details?: Record<string, RuntimeDetail[]>;
};

const shell: CSSProperties = { color: "#ffd0d0", padding: 20, maxWidth: 1240 };
const card: CSSProperties = {
  border: "1px solid #6f0000",
  borderRadius: 12,
  background: "rgba(120,0,0,0.08)",
  padding: 14,
  marginBottom: 14,
};
const input: CSSProperties = {
  width: "100%",
  padding: 10,
  background: "#0a0a0a",
  border: "1px solid #7a0000",
  color: "#ffd7d7",
  borderRadius: 8,
};
const button: CSSProperties = {
  ...input,
  width: "auto",
  cursor: "pointer",
  fontWeight: 800,
  textTransform: "uppercase",
  letterSpacing: "0.06em",
};

function summaryValue(summary: RuntimeSummary[], label: string) {
  return summary.find((entry) => entry.label === label)?.value || "0";
}

export default function MemoryClient() {
  const [guildId, setGuildId] = useState("");
  const [guildName, setGuildName] = useState("");
  const [runtime, setRuntime] = useState<RuntimePayload>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const config = useMemo(() => ({
    learningEnabled: runtime?.config?.learningEnabled !== false,
    knowledgeStoreEnabled: runtime?.config?.knowledgeStoreEnabled !== false,
    profileVisibility: String(runtime?.config?.profileVisibility || "full"),
    adaptiveReplyFrequency: Number(runtime?.config?.adaptiveReplyFrequency ?? 0.22),
    toneBank: String(runtime?.config?.toneBank || "saviors"),
    personalityLabel: String(runtime?.config?.personalityLabel || "saviors"),
  }), [runtime]);

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
      const json = await fetchRuntimeEngine(targetGuildId, "runtimeRouter");
      setRuntime({
        config: json?.config || {},
        summary: Array.isArray(json?.summary) ? json.summary : [],
        details: json?.details && typeof json.details === "object" ? json.details : {},
      });
    } catch (err: any) {
      setMessage(err?.message || "Failed to load AI memory runtime.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadAll(guildId);
  }, [guildId]);

  async function savePatch(patch: Record<string, unknown>, successLabel: string) {
    if (!guildId) return;
    try {
      setSaving(true);
      setMessage("");
      const json = await saveRuntimeEngine(guildId, "runtimeRouter", patch);
      setRuntime({
        config: json?.config || {},
        summary: Array.isArray(json?.summary) ? json.summary : [],
        details: json?.details && typeof json.details === "object" ? json.details : {},
      });
      setMessage(successLabel);
    } catch (err: any) {
      setMessage(err?.message || "Save failed.");
    } finally {
      setSaving(false);
    }
  }

  async function runAction(action: string, okLabel: string) {
    if (!guildId) return;
    try {
      setSaving(true);
      setMessage("");
      await runRuntimeEngineAction(guildId, "runtimeRouter", action);
      await loadAll(guildId);
      setMessage(okLabel);
    } catch (err: any) {
      setMessage(err?.message || "Action failed.");
    } finally {
      setSaving(false);
    }
  }

  const runtimeMemory = Array.isArray(runtime?.details?.runtimeMemory) ? runtime.details.runtimeMemory : [];
  const topTopics = Array.isArray(runtime?.details?.topTopics) ? runtime.details.topTopics : [];
  const knowledgeSamples = Array.isArray(runtime?.details?.knowledgeSamples) ? runtime.details.knowledgeSamples : [];

  if (!guildId && !loading) {
    return <div style={{ color: "#ff8585", padding: 20 }}>Missing guildId. Open from `/guilds` first.</div>;
  }

  return (
    <div style={shell}>
      <div style={card}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <div>
            <h1 style={{ margin: 0, color: "#ff4a4a", letterSpacing: "0.12em", textTransform: "uppercase" }}>Memory + Context</h1>
            <div style={{ color: "#ff9f9f", marginTop: 6 }}>Guild: {guildName || guildId}</div>
            <div style={{ color: "#ffb7b7", fontSize: 12, marginTop: 6 }}>
              This page now edits the live adaptive runtime memory controls instead of a dead dashboard-only config file.
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Link href={`/dashboard/ai/learning?guildId=${encodeURIComponent(guildId)}`} style={button}>Open Possum AI</Link>
            <button type="button" disabled={saving} style={button} onClick={() => void savePatch(config, "Saved AI memory runtime.")}>
              {saving ? "Saving..." : "Save Memory"}
            </button>
          </div>
        </div>
        {message ? <div style={{ marginTop: 10, color: "#ffb3f0" }}>{message}</div> : null}
      </div>

      {loading ? <div style={card}>Loading AI memory runtime...</div> : null}

      {!loading ? (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 10, marginBottom: 14 }}>
            {[
              ["Adaptive Runtime", summaryValue(runtime.summary || [], "Adaptive Runtime")],
              ["Persona Runtime", summaryValue(runtime.summary || [], "Persona Runtime")],
              ["Learned Users", summaryValue(runtime.summary || [], "Learned Users")],
              ["Learned Channels", summaryValue(runtime.summary || [], "Learned Channels")],
              ["Knowledge Items", summaryValue(runtime.summary || [], "Knowledge Items")],
            ].map(([label, value]) => (
              <div key={label} style={card}>
                <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.08em", color: "#ffadad" }}>{label}</div>
                <div style={{ marginTop: 6, fontSize: 22, fontWeight: 900, color: "#fff" }}>{value}</div>
              </div>
            ))}
          </div>

          <div style={card}>
            <h3 style={{ marginTop: 0, color: "#ff6666", textTransform: "uppercase", letterSpacing: "0.08em" }}>Live Controls</h3>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2,minmax(220px,1fr))", gap: 10 }}>
              <label><input type="checkbox" checked={config.learningEnabled} onChange={(event) => setRuntime((prev) => ({ ...prev, config: { ...(prev.config || {}), learningEnabled: event.target.checked } }))} /> Learning writes enabled</label>
              <label><input type="checkbox" checked={config.knowledgeStoreEnabled} onChange={(event) => setRuntime((prev) => ({ ...prev, config: { ...(prev.config || {}), knowledgeStoreEnabled: event.target.checked } }))} /> Knowledge store enabled</label>
              <div>
                <label>Profile visibility</label>
                <select style={input} value={config.profileVisibility} onChange={(event) => setRuntime((prev) => ({ ...prev, config: { ...(prev.config || {}), profileVisibility: event.target.value } }))}>
                  <option value="full">full</option>
                  <option value="limited">limited</option>
                  <option value="hidden">hidden</option>
                </select>
              </div>
              <div>
                <label>Adaptive reply frequency</label>
                <input
                  style={input}
                  type="number"
                  min={0}
                  max={1}
                  step={0.01}
                  value={config.adaptiveReplyFrequency}
                  onChange={(event) => setRuntime((prev) => ({ ...prev, config: { ...(prev.config || {}), adaptiveReplyFrequency: Number(event.target.value || 0) } }))}
                />
              </div>
              <div>
                <label>Tone bank</label>
                <input style={input} value={config.toneBank} onChange={(event) => setRuntime((prev) => ({ ...prev, config: { ...(prev.config || {}), toneBank: event.target.value } }))} />
              </div>
              <div>
                <label>Personality label</label>
                <input style={input} value={config.personalityLabel} onChange={(event) => setRuntime((prev) => ({ ...prev, config: { ...(prev.config || {}), personalityLabel: event.target.value } }))} />
              </div>
            </div>
          </div>

          <div style={card}>
            <h3 style={{ marginTop: 0, color: "#ff6666", textTransform: "uppercase", letterSpacing: "0.08em" }}>Runtime Memory</h3>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 10 }}>
              {runtimeMemory.map((row) => (
                <div key={row.title} style={{ border: "1px solid #4f0000", borderRadius: 10, padding: 10, background: "#110000" }}>
                  <div style={{ color: "#ffb3b3", fontSize: 12 }}>{row.title}</div>
                  <div style={{ marginTop: 4, fontWeight: 800 }}>{row.value}</div>
                </div>
              ))}
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
              <button type="button" disabled={saving} style={button} onClick={() => void runAction("clearReplyMemory", "Cleared in-memory adaptive reply cache.")}>Clear Reply Memory</button>
              <button type="button" disabled={saving} style={button} onClick={() => void runAction("wipeKnowledge", "Deleted stored knowledge for this guild.")}>Wipe Knowledge</button>
              <button type="button" disabled={saving} style={button} onClick={() => void runAction("wipeProfiles", "Deleted learned user/channel profiles for this guild.")}>Wipe Profiles</button>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <div style={card}>
              <h3 style={{ marginTop: 0, color: "#ff6666", textTransform: "uppercase", letterSpacing: "0.08em" }}>Top Topics</h3>
              {topTopics.length ? topTopics.map((row) => (
                <div key={`${row.rank || 0}_${row.name || row.title || "topic"}`} style={{ padding: "8px 0", borderBottom: "1px solid #3a0000" }}>
                  <div style={{ fontWeight: 800 }}>{row.name || row.title}</div>
                  <div style={{ color: "#ffb3b3", fontSize: 12 }}>{row.value}</div>
                </div>
              )) : <div style={{ color: "#ffb3b3" }}>No learned topics recorded yet.</div>}
            </div>

            <div style={card}>
              <h3 style={{ marginTop: 0, color: "#ff6666", textTransform: "uppercase", letterSpacing: "0.08em" }}>Knowledge Samples</h3>
              {knowledgeSamples.length ? knowledgeSamples.map((row) => (
                <div key={`${row.title}_${row.value}`} style={{ padding: "8px 0", borderBottom: "1px solid #3a0000" }}>
                  <div style={{ fontWeight: 800 }}>{row.title}</div>
                  <div style={{ color: "#ffb3b3", fontSize: 12 }}>{row.value}</div>
                </div>
              )) : <div style={{ color: "#ffb3b3" }}>No stored knowledge samples for this guild yet.</div>}
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
