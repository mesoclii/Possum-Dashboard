"use client";

import { useEffect, useState } from "react";
import EngineContractPanel from "@/components/possum/EngineContractPanel";
import EngineInsights from "@/components/possum/EngineInsights";
import ProgressionStackShell from "@/components/possum/ProgressionStackShell";
import { fetchGuildData, fetchRuntimeEngine, saveRuntimeEngine } from "@/lib/liveRuntime";

type Channel = { id: string; name: string; type?: number | string };
type Role = { id: string; name: string; position?: number };
type SummaryItem = { label: string; value: string };
type DetailItem = { rank?: number; name?: string; title?: string; value: string };
type Details = Record<string, DetailItem[] | { title: string; value: string } | null | undefined>;

type LoyaltyConfig = {
  active: boolean;
  timezone: string;
  announceChannelId: string;
  heistExemptRoleId: string;
  heistExemptDays: number;
  yearRewardRoleId: string;
  yearRewardDays: number;
  notes: string;
};

const EMPTY: LoyaltyConfig = {
  active: true,
  timezone: "America/Los_Angeles",
  announceChannelId: "",
  heistExemptRoleId: "",
  heistExemptDays: 7,
  yearRewardRoleId: "",
  yearRewardDays: 30,
  notes: "",
};

function getGuildId() {
  if (typeof window === "undefined") return "";
  const q = new URLSearchParams(window.location.search).get("guildId") || "";
  const s = localStorage.getItem("activeGuildId") || "";
  const id = (q || s).trim();
  if (id) localStorage.setItem("activeGuildId", id);
  return id;
}

const box: React.CSSProperties = { border: "1px solid #5f0000", borderRadius: 12, padding: 14, background: "rgba(120,0,0,0.10)" };
const input: React.CSSProperties = { width: "100%", background: "#0a0a0a", color: "#ffd0d0", border: "1px solid #7f0000", borderRadius: 8, padding: "10px 12px" };

export default function LoyaltyEngineClient() {
  const [guildId, setGuildId] = useState("");
  const [cfg, setCfg] = useState<LoyaltyConfig>(EMPTY);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [summary, setSummary] = useState<SummaryItem[]>([]);
  const [details, setDetails] = useState<Details>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => setGuildId(getGuildId()), []);

  useEffect(() => {
    if (!guildId) { setLoading(false); return; }
    (async () => {
      setLoading(true);
      setMsg("");
      try {
        const [guildJson, runtimeJson] = await Promise.all([
          fetchGuildData(guildId),
          fetchRuntimeEngine(guildId, "loyalty"),
        ]);
        setCfg({ ...EMPTY, ...(runtimeJson?.config || {}) });
        setChannels((Array.isArray(guildJson?.channels) ? guildJson.channels : []).filter((c: any) => Number(c?.type) === 0));
        setRoles((Array.isArray(guildJson?.roles) ? guildJson.roles : []).sort((a: Role, b: Role) => Number(b.position || 0) - Number(a.position || 0)));
        setSummary(Array.isArray(runtimeJson?.summary) ? runtimeJson.summary : []);
        setDetails(runtimeJson?.details && typeof runtimeJson.details === "object" ? runtimeJson.details : {});
      } catch (e: any) {
        setMsg(e?.message || "Failed to load loyalty config.");
      } finally {
        setLoading(false);
      }
    })();
  }, [guildId]);

  async function save() {
    if (!guildId) return;
    setSaving(true);
    setMsg("");
    try {
      new Intl.DateTimeFormat("en-US", { timeZone: String(cfg.timezone || "").trim() });
      const normalized = {
        ...cfg,
        heistExemptDays: Math.max(1, Math.min(3650, Math.floor(Number(cfg.heistExemptDays) || 7))),
        yearRewardDays: Math.max(1, Math.min(3650, Math.floor(Number(cfg.yearRewardDays) || 30))),
      };
      const json = await saveRuntimeEngine(guildId, "loyalty", normalized as unknown as Record<string, unknown>);
      setCfg({ ...EMPTY, ...(json?.config || normalized) });
      setSummary(Array.isArray(json?.summary) ? json.summary : []);
      setDetails(json?.details && typeof json.details === "object" ? json.details : {});
      setMsg("Loyalty engine settings saved.");
    } catch (e: any) {
      setMsg(e?.message || "Save failed.");
    } finally {
      setSaving(false);
    }
  }

  if (!guildId) return <div style={{ color: "#ff8080", padding: 24 }}>Missing guildId. Open from /guilds first.</div>;

  return (
    <div style={{ color: "#ffd0d0", padding: 18, maxWidth: 1200 }}>
      <ProgressionStackShell
        activeKey="loyalty"
        title="Loyalty Engine"
        subtitle="Long-tail retention layer tied into VIP, progression bonus value, birthday/radio recognition, and member reward timing."
      />
      <EngineContractPanel
        engineKey="loyalty"
        intro="Loyalty is the retention layer for the progression family. It should reward tenure and steady participation without replacing XP, achievements, or prestige as the main advancement loop."
        related={[
          { label: "VIP", route: "/dashboard/vip", reason: "VIP lifecycle and loyalty benefits should stay aligned instead of creating conflicting long-term perks" },
          { label: "Radio", route: "/dashboard/economy/radio-birthday", reason: "birthday recognition is part of the same long-tail member appreciation surface" },
          { label: "Prestige", route: "/dashboard/prestige", reason: "prestige carry-forward value should not overpower loyalty retention rewards" },
        ]}
      />
      <div style={{ color: "#ff9999", marginTop: -2, marginBottom: 12 }}>Guild: {typeof window !== 'undefined' ? (localStorage.getItem('activeGuildName') || guildId) : guildId}</div>
      <div style={{ color: "#ffb0b0", fontSize: 12, marginBottom: 12 }}>VIP is a separate engine. This page configures loyalty milestone behavior surfaced for VIP + loyalty flow.</div>
      {msg ? <div style={{ marginBottom: 10, color: "#ffd27a" }}>{msg}</div> : null}

      {loading ? <div>Loading...</div> : (
        <div style={{ display: "grid", gap: 12 }}>
          <EngineInsights summary={summary} details={details} />
          <section style={box}>
            <label><input type="checkbox" checked={cfg.active} onChange={(e) => setCfg((p) => ({ ...p, active: e.target.checked }))} /> Loyalty Processing Enabled</label>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 10 }}>
              <div><div>Timezone</div><input style={input} value={cfg.timezone} onChange={(e) => setCfg((p) => ({ ...p, timezone: e.target.value }))} placeholder="America/Los_Angeles" /></div>
              <div><div>Announce Channel</div><select style={input} value={cfg.announceChannelId || ""} onChange={(e) => setCfg((p) => ({ ...p, announceChannelId: e.target.value }))}><option value="">Select channel</option>{channels.map((c) => <option key={c.id} value={c.id}>#{c.name}</option>)}</select></div>
              <div><div>Heist Exempt Role</div><select style={input} value={cfg.heistExemptRoleId || ""} onChange={(e) => setCfg((p) => ({ ...p, heistExemptRoleId: e.target.value }))}><option value="">Select role</option>{roles.map((role) => <option key={role.id} value={role.id}>@{role.name}</option>)}</select></div>
              <div><div>Heist Exempt Days</div><input style={input} type="number" min={1} max={3650} step={1} value={cfg.heistExemptDays} onChange={(e) => setCfg((p) => ({ ...p, heistExemptDays: Math.max(1, Math.min(3650, Math.floor(Number(e.target.value) || 1))) }))} /></div>
              <div><div>Year Reward Role</div><select style={input} value={cfg.yearRewardRoleId || ""} onChange={(e) => setCfg((p) => ({ ...p, yearRewardRoleId: e.target.value }))}><option value="">Select role</option>{roles.map((role) => <option key={role.id} value={role.id}>@{role.name}</option>)}</select></div>
              <div><div>Year Reward Days</div><input style={input} type="number" min={1} max={3650} step={1} value={cfg.yearRewardDays} onChange={(e) => setCfg((p) => ({ ...p, yearRewardDays: Math.max(1, Math.min(3650, Math.floor(Number(e.target.value) || 1))) }))} /></div>
            </div>
            <div style={{ marginTop: 10 }}>
              <div>Notes</div>
              <textarea style={{ ...input, minHeight: 100 }} value={cfg.notes} onChange={(e) => setCfg((p) => ({ ...p, notes: e.target.value }))} />
            </div>
          </section>

          <button onClick={save} disabled={saving} style={{ ...input, width: "auto", cursor: "pointer", fontWeight: 900 }}>
            {saving ? "Saving..." : "Save Loyalty"}
          </button>
        </div>
      )}
    </div>
  );
}
