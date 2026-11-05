"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import { resolveGuildContext, fetchRuntimeEngine, saveRuntimeEngine } from "@/lib/liveRuntime";

type EnginePayload = {
  config?: Record<string, any>;
  summary?: Array<{ label: string; value: string }>;
};

const card: CSSProperties = {
  border: "1px solid rgba(255,0,0,.35)",
  borderRadius: 12,
  padding: 14,
  background: "rgba(90,0,0,.10)",
  marginBottom: 12,
};

const input: CSSProperties = {
  width: "100%",
  background: "#070707",
  border: "1px solid rgba(255,0,0,.45)",
  color: "#ffd3d3",
  borderRadius: 10,
  padding: "10px 12px",
};

export default function FunModesClient() {
  const [guildId, setGuildId] = useState("");
  const [guildName, setGuildName] = useState("");
  const [range, setRange] = useState<EnginePayload>({});
  const [truthDare, setTruthDare] = useState<EnginePayload>({});
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
      const [rangeJson, truthJson] = await Promise.all([
        fetchRuntimeEngine(targetGuildId, "range"),
        fetchRuntimeEngine(targetGuildId, "truthDare"),
      ]);
      setRange({ config: rangeJson?.config || {}, summary: Array.isArray(rangeJson?.summary) ? rangeJson.summary : [] });
      setTruthDare({ config: truthJson?.config || {}, summary: Array.isArray(truthJson?.summary) ? truthJson.summary : [] });
    } catch (err: any) {
      setMessage(err?.message || "Failed to load fun-mode engines.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadAll(guildId);
  }, [guildId]);

  async function saveEngine(engine: "range" | "truthDare", patch: Record<string, unknown>, okLabel: string) {
    if (!guildId) return;
    try {
      setSaving(true);
      setMessage("");
      const json = await saveRuntimeEngine(guildId, engine, patch);
      if (engine === "range") {
        setRange({ config: json?.config || {}, summary: Array.isArray(json?.summary) ? json.summary : [] });
      } else {
        setTruthDare({ config: json?.config || {}, summary: Array.isArray(json?.summary) ? json.summary : [] });
      }
      setMessage(okLabel);
    } catch (err: any) {
      setMessage(err?.message || "Save failed.");
    } finally {
      setSaving(false);
    }
  }

  if (!guildId && !loading) {
    return <div style={{ color: "#ff6b6b", padding: 24 }}>Missing guildId. Open from `/guilds` first.</div>;
  }

  return (
    <div style={{ maxWidth: 1200, color: "#ffcaca" }}>
      <div style={card}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
          <div>
            <h1 style={{ margin: 0, letterSpacing: "0.12em", textTransform: "uppercase", color: "#ff2f2f" }}>Fun Modes</h1>
            <div style={{ color: "#ff9e9e", marginTop: 4 }}>Guild: {guildName || guildId}</div>
            <div style={{ color: "#ffb7b7", fontSize: 12, marginTop: 8 }}>
              This page now maps to the live `range` and `truthDare` engines. The old gun-game/carol shadow config has been removed because those fields were not wired to bot runtime.
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Link href={`/dashboard/range?guildId=${encodeURIComponent(guildId)}`} style={{ ...input, width: "auto", textDecoration: "none", fontWeight: 800 }}>Open Range</Link>
            <Link href={`/dashboard/truthdare?guildId=${encodeURIComponent(guildId)}`} style={{ ...input, width: "auto", textDecoration: "none", fontWeight: 800 }}>Open Truth / Dare</Link>
            <Link href={`/dashboard/achievements?guildId=${encodeURIComponent(guildId)}`} style={{ ...input, width: "auto", textDecoration: "none", fontWeight: 800 }}>Open Carol / Achievements</Link>
          </div>
        </div>
        {message ? <div style={{ marginTop: 10, color: "#ffd27a" }}>{message}</div> : null}
      </div>

      {loading ? <div style={card}>Loading fun-mode engines...</div> : null}

      {!loading ? (
        <>
          <section style={card}>
            <h3 style={{ marginTop: 0, color: "#ff6666", textTransform: "uppercase", letterSpacing: "0.08em" }}>Range</h3>
            <div style={{ color: "#ffb3b3", fontSize: 12, marginBottom: 10 }}>
              {(range.summary || []).map((row) => `${row.label}: ${row.value}`).join(" | ")}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,minmax(180px,1fr))", gap: 10 }}>
              <label><input type="checkbox" checked={Boolean(range.config?.enabled)} onChange={(event) => void saveEngine("range", { enabled: event.target.checked }, `Range ${event.target.checked ? "enabled" : "disabled"}.`)} /> Enabled</label>
              <div><label>Winning points</label><input style={input} type="number" value={range.config?.winningPoints ?? 150} onChange={(event) => setRange((prev) => ({ ...prev, config: { ...(prev.config || {}), winningPoints: Number(event.target.value || 0) } }))} /></div>
              <div><label>Shoot cooldown ms</label><input style={input} type="number" value={range.config?.shootCooldownMs ?? 2000} onChange={(event) => setRange((prev) => ({ ...prev, config: { ...(prev.config || {}), shootCooldownMs: Number(event.target.value || 0) } }))} /></div>
            </div>
            <div style={{ marginTop: 10 }}>
              <label>Default weapon</label>
              <input style={input} value={String(range.config?.defaultWeapon || "rifle")} onChange={(event) => setRange((prev) => ({ ...prev, config: { ...(prev.config || {}), defaultWeapon: event.target.value } }))} />
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
              <button type="button" disabled={saving} style={{ ...input, width: "auto", fontWeight: 800, cursor: "pointer" }} onClick={() => void saveEngine("range", range.config || {}, "Saved Range runtime.")}>Save Range</button>
              <Link href={`/dashboard/range?guildId=${encodeURIComponent(guildId)}`} style={{ ...input, width: "auto", textDecoration: "none", fontWeight: 800 }}>Open Full Range Console</Link>
            </div>
          </section>

          <section style={card}>
            <h3 style={{ marginTop: 0, color: "#ff6666", textTransform: "uppercase", letterSpacing: "0.08em" }}>Truth / Dare</h3>
            <div style={{ color: "#ffb3b3", fontSize: 12, marginBottom: 10 }}>
              {(truthDare.summary || []).map((row) => `${row.label}: ${row.value}`).join(" | ")}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,minmax(180px,1fr))", gap: 10 }}>
              <label><input type="checkbox" checked={Boolean(truthDare.config?.enabled)} onChange={(event) => void saveEngine("truthDare", { enabled: event.target.checked }, `Truth / Dare ${event.target.checked ? "enabled" : "disabled"}.`)} /> Enabled</label>
              <label><input type="checkbox" checked={truthDare.config?.builtInTruthEnabled !== false} onChange={(event) => setTruthDare((prev) => ({ ...prev, config: { ...(prev.config || {}), builtInTruthEnabled: event.target.checked } }))} /> Built-in truths</label>
              <label><input type="checkbox" checked={truthDare.config?.builtInDareEnabled !== false} onChange={(event) => setTruthDare((prev) => ({ ...prev, config: { ...(prev.config || {}), builtInDareEnabled: event.target.checked } }))} /> Built-in dares</label>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,minmax(180px,1fr))", gap: 10, marginTop: 10 }}>
              <div><label>Min bet</label><input style={input} type="number" value={truthDare.config?.minBet ?? 0} onChange={(event) => setTruthDare((prev) => ({ ...prev, config: { ...(prev.config || {}), minBet: Number(event.target.value || 0) } }))} /></div>
              <div><label>Max bet</label><input style={input} type="number" value={truthDare.config?.maxBet ?? 50000} onChange={(event) => setTruthDare((prev) => ({ ...prev, config: { ...(prev.config || {}), maxBet: Number(event.target.value || 0) } }))} /></div>
              <label><input type="checkbox" checked={Boolean(truthDare.config?.generatedEnabled ?? true)} onChange={(event) => setTruthDare((prev) => ({ ...prev, config: { ...(prev.config || {}), generatedEnabled: event.target.checked } }))} /> Generated prompts</label>
            </div>
            <div style={{ marginTop: 10 }}>
              <label>Prompt channel</label>
              <input style={input} value={String(truthDare.config?.channelId || "")} onChange={(event) => setTruthDare((prev) => ({ ...prev, config: { ...(prev.config || {}), channelId: event.target.value } }))} placeholder="Channel ID" />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 10 }}>
              <div>
                <label>Additional truth prompts</label>
                <textarea style={{ ...input, minHeight: 100 }} value={String(truthDare.config?.truthPool || "")} onChange={(event) => setTruthDare((prev) => ({ ...prev, config: { ...(prev.config || {}), truthPool: event.target.value } }))} />
              </div>
              <div>
                <label>Additional dare prompts</label>
                <textarea style={{ ...input, minHeight: 100 }} value={String(truthDare.config?.darePool || "")} onChange={(event) => setTruthDare((prev) => ({ ...prev, config: { ...(prev.config || {}), darePool: event.target.value } }))} />
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
              <button type="button" disabled={saving} style={{ ...input, width: "auto", fontWeight: 800, cursor: "pointer" }} onClick={() => void saveEngine("truthDare", truthDare.config || {}, "Saved Truth / Dare runtime.")}>Save Truth / Dare</button>
              <Link href={`/dashboard/truthdare?guildId=${encodeURIComponent(guildId)}`} style={{ ...input, width: "auto", textDecoration: "none", fontWeight: 800 }}>Open Full Truth / Dare Console</Link>
            </div>
          </section>

          <section style={card}>
            <h3 style={{ marginTop: 0, color: "#ff6666", textTransform: "uppercase", letterSpacing: "0.08em" }}>Carol Note</h3>
            <div style={{ color: "#ffcccc" }}>
              Carol is not a standalone guild-config engine in this bot. It rides the live achievements/runtime definitions and command handling.
              Use the achievements surface for Carol-related runtime visibility instead of editing dead dashboard-only fields.
            </div>
          </section>
        </>
      ) : null}
    </div>
  );
}
