"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type CSSProperties } from "react";
import AiTabs from "@/components/possum/AiTabs";
import { useDashboardSessionState } from "@/components/possum/useDashboardSessionState";
import { buildDashboardHref } from "@/lib/dashboardContext";

type Access = { allowedRoles: string[]; allowedChannels: string[]; blockedChannels: string[]; allowDMs: boolean };
type Persona = {
  slug: string;
  name: string;
  enabled: boolean;
  bio: string;
  style: string;
  systemRules: string;
  triggers: string[];
  imageUrl: string;
  mentionRequired: boolean;
  access: Access;
  model: { temperature: number; maxTokens: number };
};
type Shared = { slug: string; name: string; enabled: boolean; bio: string };
type Named = { id: string; name: string; type?: number };

const BLANK: Persona = {
  slug: "",
  name: "",
  enabled: true,
  bio: "",
  style: "",
  systemRules: "",
  triggers: [],
  imageUrl: "",
  mentionRequired: true,
  access: { allowedRoles: [], allowedChannels: [], blockedChannels: [], allowDMs: false },
  model: { temperature: 0.8, maxTokens: 280 },
};

const wrap: CSSProperties = { color: "#ffd0d0", maxWidth: 1320 };
const card: CSSProperties = {
  border: "1px solid rgba(255,0,0,.36)",
  borderRadius: 12,
  padding: 14,
  background: "rgba(100,0,0,.10)",
  marginBottom: 12,
};
const action: CSSProperties = {
  border: "1px solid #7a0000",
  borderRadius: 10,
  background: "#130707",
  color: "#ffd7d7",
  padding: "10px 12px",
  fontWeight: 800,
  letterSpacing: "0.06em",
  textTransform: "uppercase",
  cursor: "pointer",
  textDecoration: "none",
};
const input: CSSProperties = {
  width: "100%",
  background: "#0b0505",
  border: "1px solid #5a0000",
  borderRadius: 8,
  color: "#ffe0e0",
  padding: "8px 10px",
  fontSize: 13,
  boxSizing: "border-box",
};
const label: CSSProperties = { color: "#ff9c9c", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4, display: "block" };
const hint: CSSProperties = { color: "#ffbdbd", fontSize: 11, marginTop: 3 };

function resolveGuild() {
  if (typeof window === "undefined") return { guildId: "", guildName: "" };
  const params = new URLSearchParams(window.location.search);
  const guildId = (params.get("guildId") || localStorage.getItem("activeGuildId") || "").trim();
  const guildName = (localStorage.getItem("activeGuildName") || guildId).trim();
  if (guildId) localStorage.setItem("activeGuildId", guildId);
  return { guildId, guildName };
}

async function api(path: string, body?: unknown) {
  const res = await fetch(path, {
    method: body === undefined ? "GET" : "POST",
    headers: body === undefined ? undefined : { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: "no-store",
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json?.success === false) throw new Error(json?.error || "Request failed.");
  return json;
}

function MultiPick({ items, value, onChange, empty }: { items: Named[]; value: string[]; onChange: (v: string[]) => void; empty: string }) {
  const [q, setQ] = useState("");
  const shown = items.filter((i) => i.name.toLowerCase().includes(q.toLowerCase()));
  const toggle = (id: string) => onChange(value.includes(id) ? value.filter((v) => v !== id) : [...value, id]);
  return (
    <div>
      <input style={{ ...input, marginBottom: 6 }} placeholder="Search..." value={q} onChange={(e) => setQ(e.target.value)} />
      <div style={{ maxHeight: 140, overflowY: "auto", border: "1px solid #3a0000", borderRadius: 8, padding: 6 }}>
        {shown.length ? (
          shown.map((i) => (
            <label key={i.id} style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 12, padding: "2px 0", cursor: "pointer" }}>
              <input type="checkbox" checked={value.includes(i.id)} onChange={() => toggle(i.id)} />
              {i.name}
            </label>
          ))
        ) : (
          <div style={hint}>{empty}</div>
        )}
      </div>
      <div style={hint}>{value.length ? `${value.length} selected` : "None selected = everyone / everywhere"}</div>
    </div>
  );
}

export default function PersonaClient() {
  const { isMasterOwner } = useDashboardSessionState();
  const [guildId, setGuildId] = useState("");
  const [guildName, setGuildName] = useState("");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [personaEnabled, setPersonaEnabled] = useState(false);
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [shared, setShared] = useState<Shared[]>([]);
  const [settings, setSettings] = useState({ autoReplyEnabled: false, mentionOnly: true });
  const [roles, setRoles] = useState<Named[]>([]);
  const [channels, setChannels] = useState<Named[]>([]);
  const [draft, setDraft] = useState<Persona | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testPrompt, setTestPrompt] = useState("");
  const [testReply, setTestReply] = useState("");
  const [testing, setTesting] = useState(false);
  const [onlyChannels, setOnlyChannels] = useState<string[]>([]);
  const [keywordInput, setKeywordInput] = useState("");
  const [ctlSaving, setCtlSaving] = useState(false);

  const textChannels = useMemo(() => channels.filter((c) => [0, 5].includes(Number(c.type || 0))), [channels]);

  async function reload(gid: string) {
    const json = await api(`/api/ai-personas/list?guildId=${encodeURIComponent(gid)}`);
    setPersonas(json.personas || []);
    setShared(json.sharedPersonas || []);
    setSettings(json.settings || { autoReplyEnabled: false, mentionOnly: true });
  }

  useEffect(() => {
    const resolved = resolveGuild();
    setGuildId(resolved.guildId);
    setGuildName(resolved.guildName);
    if (!resolved.guildId) {
      setLoading(false);
      return;
    }
    (async () => {
      try {
        setLoading(true);
        await reload(resolved.guildId);
        const [dashRes, dataRes] = await Promise.all([
          fetch(`/api/bot/dashboard-config?guildId=${encodeURIComponent(resolved.guildId)}`, { cache: "no-store" }),
          fetch(`/api/bot/guild-data?guildId=${encodeURIComponent(resolved.guildId)}`, { cache: "no-store" }),
        ]);
        const dash = await dashRes.json().catch(() => ({}));
        const data = await dataRes.json().catch(() => ({}));
        const rt = dash?.config?.aiRuntime || {};
        setPersonaEnabled(Boolean(rt.personaAiEnabled ?? dash?.config?.features?.personaAiEnabled));
        setOnlyChannels(Array.isArray(rt.personaOnlyChannelIds) ? rt.personaOnlyChannelIds.filter(Boolean) : []);
        setKeywordInput(Array.isArray(rt.personaKeywordTriggers) ? rt.personaKeywordTriggers.join(", ") : "");
        setRoles(Array.isArray(data?.roles) ? data.roles : []);
        setChannels(Array.isArray(data?.channels) ? data.channels : []);
      } catch (err: any) {
        setMessage(err?.message || "Failed to load personas.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function saveRuntime(patch: Record<string, unknown>, ok: string) {
    try {
      setCtlSaving(true);
      setMessage("");
      await api("/api/bot/engine-config", { guildId, engine: "aiRuntime", patch });
      if (typeof patch.personaAiEnabled === "boolean") setPersonaEnabled(patch.personaAiEnabled);
      if (Array.isArray(patch.personaOnlyChannelIds)) setOnlyChannels(patch.personaOnlyChannelIds as string[]);
      setMessage(ok);
    } catch (err: any) {
      setMessage(err?.message || "Could not save.");
    } finally {
      setCtlSaving(false);
    }
  }

  async function saveSettings(patch: { autoReplyEnabled?: boolean; mentionOnly?: boolean }, ok: string) {
    try {
      setCtlSaving(true);
      setMessage("");
      const json = await api("/api/ai-personas/settings", { guildId, ...patch });
      setSettings(json.settings);
      setMessage(ok);
    } catch (err: any) {
      setMessage(err?.message || "Could not save.");
    } finally {
      setCtlSaving(false);
    }
  }

  function edit(p: Persona | null) {
    setTestReply("");
    setTestPrompt("");
    setMessage("");
    if (p) {
      setDraft(JSON.parse(JSON.stringify(p)));
      setIsNew(false);
    } else {
      setDraft(JSON.parse(JSON.stringify(BLANK)));
      setIsNew(true);
    }
  }

  const set = (patch: Partial<Persona>) => setDraft((d) => (d ? { ...d, ...patch } : d));
  const setAccess = (patch: Partial<Access>) => setDraft((d) => (d ? { ...d, access: { ...d.access, ...patch } } : d));

  async function save() {
    if (!draft) return;
    try {
      setSaving(true);
      setMessage("");
      const json = await api("/api/ai-personas/save", { guildId, persona: draft });
      await reload(guildId);
      setDraft(json.persona);
      setIsNew(false);
      setMessage(json.created ? "Persona created." : "Persona saved.");
    } catch (err: any) {
      setMessage(err?.message || "Could not save.");
    } finally {
      setSaving(false);
    }
  }

  async function remove(slug: string) {
    if (!window.confirm(`Delete persona "${slug}"? This cannot be undone.`)) return;
    try {
      await api("/api/ai-personas/delete", { guildId, slug });
      await reload(guildId);
      setDraft(null);
      setMessage("Persona deleted.");
    } catch (err: any) {
      setMessage(err?.message || "Could not delete.");
    }
  }

  async function runTest() {
    if (!draft || isNew) return;
    try {
      setTesting(true);
      setTestReply("");
      const json = await api("/api/ai-personas/test", { guildId, slug: draft.slug, prompt: testPrompt });
      setTestReply(json.reply);
    } catch (err: any) {
      setTestReply(`Error: ${err?.message || "Test failed."}`);
    } finally {
      setTesting(false);
    }
  }

  if (!guildId) {
    return <div style={{ color: "#ff8585", padding: 20 }}>Missing guildId. Open from /guilds first.</div>;
  }

  return (
    <div style={wrap}>
      <AiTabs current="persona" />

      <section style={card}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
          <div>
            <h1 style={{ margin: 0, color: "#ff4a4a", letterSpacing: "0.12em", textTransform: "uppercase" }}>Persona Engine</h1>
            <div style={{ color: "#ff9f9f", marginTop: 8 }}>Guild: {guildName || guildId}</div>
            <div style={{ color: "#ffb5b5", fontSize: 12, marginTop: 8, maxWidth: 880 }}>
              Create your own characters for this server. Each persona has its own identity, voice, triggers, access rules and model settings,
              and only exists in this server. Replies use this server&apos;s AI credits. Persona AI is separate from Possum AI.
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Link href={buildDashboardHref("/dashboard/ai/billing")} style={action}>AI Billing</Link>
            <Link href={buildDashboardHref("/dashboard/bot-personalizer")} style={action}>Bot Personalizer</Link>
            <Link href={buildDashboardHref("/dashboard/ai/learning")} style={action}>Possum AI</Link>
            {isMasterOwner ? <Link href={buildDashboardHref("/dashboard/ai/openai-platform")} style={action}>Creator AI Platform</Link> : null}
          </div>
        </div>
        {message ? <div style={{ color: "#ffb3f0", marginTop: 10 }}>{message}</div> : null}
      </section>

      {loading ? <div style={card}>Loading personas...</div> : null}

      {!loading ? (
        <>
          <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 10, marginBottom: 12 }}>
            {[
              ["Persona Runtime", personaEnabled ? "Enabled" : "Disabled"],
              ["Auto Reply", settings.autoReplyEnabled ? "On" : "Off"],
              ["Mention Mode", settings.mentionOnly ? "Mention Only" : "Triggers Allowed"],
              ["Your Personas", String(personas.length)],
            ].map(([k, v]) => (
              <div key={k} style={card}>
                <div style={{ color: "#ff9c9c", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.08em" }}>{k}</div>
                <div style={{ color: "#ffdada", fontSize: 18, fontWeight: 800, marginTop: 6 }}>{v}</div>
              </div>
            ))}
          </section>
          <section style={card}>
            <div style={{ color: "#ff4a4a", fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 10 }}>Runtime controls</div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
              <button style={{ ...action, borderColor: personaEnabled ? "#ff2bd6" : "#aa0000" }} disabled={ctlSaving} onClick={() => saveRuntime({ personaAiEnabled: !personaEnabled }, personaEnabled ? "Persona AI turned off." : "Persona AI turned on.")}>
                Persona AI: {personaEnabled ? "On (click to turn off)" : "Off (click to turn on)"}
              </button>
              <button style={{ ...action, borderColor: settings.autoReplyEnabled ? "#ff2bd6" : "#aa0000" }} disabled={ctlSaving} onClick={() => saveSettings({ autoReplyEnabled: !settings.autoReplyEnabled }, settings.autoReplyEnabled ? "Auto reply off." : "Auto reply on.")}>
                Auto reply: {settings.autoReplyEnabled ? "On" : "Off"}
              </button>
              <button style={action} disabled={ctlSaving} onClick={() => saveSettings({ mentionOnly: !settings.mentionOnly }, settings.mentionOnly ? "Triggers allowed without an @mention." : "Mention required.")}>
                Mention: {settings.mentionOnly ? "Required" : "Optional"}
              </button>
            </div>
            {!personaEnabled || !settings.autoReplyEnabled ? (
              <div style={{ color: "#ffb3f0", fontSize: 12, marginBottom: 10 }}>
                Personas only reply when both Persona AI and Auto reply are On for this server.
              </div>
            ) : null}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))", gap: 12 }}>
              <div>
                <span style={label}>Server-wide keywords (comma separated)</span>
                <input style={input} value={keywordInput} onChange={(e) => setKeywordInput(e.target.value)} placeholder="e.g. possum, hey bot" />
                <button
                  style={{ ...action, marginTop: 6, padding: "6px 10px", fontSize: 11 }}
                  disabled={ctlSaving}
                  onClick={() => saveRuntime({ personaKeywordTriggers: keywordInput.split(",").map((k) => k.trim().toLowerCase()).filter(Boolean) }, "Keywords saved.")}
                >
                  Save keywords
                </button>
                <div style={hint}>Words that wake a persona when someone @mentions the bot.</div>
              </div>
              <div>
                <span style={label}>Persona-only channels (replies without @mention)</span>
                <MultiPick items={textChannels} value={onlyChannels} onChange={(v) => void saveRuntime({ personaOnlyChannelIds: v }, "Persona-only channels updated.")} empty="No channels loaded." />
              </div>
            </div>
          </section>

          <section style={{ display: "grid", gridTemplateColumns: "minmax(240px,320px) 1fr", gap: 12, alignItems: "start" }}>
            <div style={card}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <span style={{ ...label, marginBottom: 0 }}>Your roster</span>
                <button style={{ ...action, padding: "6px 10px", fontSize: 11 }} onClick={() => edit(null)}>+ New persona</button>
              </div>
              {personas.length ? (
                personas.map((p) => (
                  <div
                    key={p.slug}
                    onClick={() => edit(p)}
                    style={{
                      padding: "8px 10px",
                      borderTop: "1px solid #330000",
                      cursor: "pointer",
                      background: draft && !isNew && draft.slug === p.slug ? "rgba(255,0,0,.12)" : "transparent",
                    }}
                  >
                    <div style={{ color: "#ffdcdc", fontWeight: 700 }}>
                      {p.name} <span style={{ color: "#ff9c9c", fontWeight: 400 }}>({p.slug})</span>
                    </div>
                    <div style={hint}>{p.enabled ? "Enabled" : "Disabled"} · {p.triggers.length} triggers · {p.mentionRequired ? "mention required" : "mention optional"}</div>
                  </div>
                ))
              ) : (
                <div style={hint}>No personas yet. Click &quot;New persona&quot; to create your first character.</div>
              )}
              {shared.length ? (
                <div style={{ marginTop: 12 }}>
                  <span style={label}>Shared with all servers (read-only)</span>
                  {shared.map((p) => (
                    <div key={p.slug} style={{ ...hint, padding: "3px 0" }}>{p.name} ({p.slug})</div>
                  ))}
                </div>
              ) : null}
            </div>

            <div style={card}>
              {!draft ? (
                <div style={hint}>Select a persona to edit, or create a new one.</div>
              ) : (
                <div style={{ display: "grid", gap: 12 }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                    <div>
                      <span style={label}>Key (lowercase, no spaces)</span>
                      <input style={input} value={draft.slug} disabled={!isNew} maxLength={30} onChange={(e) => set({ slug: e.target.value })} placeholder="e.g. giveawayer" />
                      {!isNew ? <div style={hint}>The key cannot be changed after creation.</div> : null}
                    </div>
                    <div>
                      <span style={label}>Display name</span>
                      <input style={input} value={draft.name} maxLength={60} onChange={(e) => set({ name: e.target.value })} placeholder="e.g. The Giveawayer" />
                    </div>
                  </div>
                  <div>
                    <span style={label}>Bio (who they are)</span>
                    <textarea style={{ ...input, minHeight: 60 }} value={draft.bio} maxLength={600} onChange={(e) => set({ bio: e.target.value })} />
                  </div>
                  <div>
                    <span style={label}>Style (how they talk)</span>
                    <textarea style={{ ...input, minHeight: 60 }} value={draft.style} maxLength={700} onChange={(e) => set({ style: e.target.value })} />
                  </div>
                  <div>
                    <span style={label}>System rules (hard limits and behavior)</span>
                    <textarea style={{ ...input, minHeight: 80 }} value={draft.systemRules} maxLength={900} onChange={(e) => set({ systemRules: e.target.value })} />
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                    <div>
                      <span style={label}>Trigger words (comma separated)</span>
                      <input
                        style={input}
                        value={draft.triggers.join(", ")}
                        onChange={(e) => set({ triggers: e.target.value.split(",").map((t) => t.trim()).filter(Boolean) })}
                      />
                    </div>
                    <div>
                      <span style={label}>Photo URL (https)</span>
                      <input style={input} value={draft.imageUrl} maxLength={500} onChange={(e) => set({ imageUrl: e.target.value })} placeholder="https://..." />
                    </div>
                  </div>
                  {draft.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={draft.imageUrl} alt="" style={{ width: 72, height: 72, borderRadius: 12, objectFit: "cover", border: "1px solid #5a0000" }} />
                  ) : null}

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                    <div>
                      <span style={label}>Creativity (temperature): {draft.model.temperature.toFixed(2)}</span>
                      <input type="range" min={0.1} max={1.5} step={0.05} value={draft.model.temperature} style={{ width: "100%" }} onChange={(e) => set({ model: { ...draft.model, temperature: Number(e.target.value) } })} />
                      <div style={hint}>Lower is more predictable, higher is more creative.</div>
                    </div>
                    <div>
                      <span style={label}>Max reply length (tokens): {draft.model.maxTokens}</span>
                      <input type="range" min={80} max={700} step={10} value={draft.model.maxTokens} style={{ width: "100%" }} onChange={(e) => set({ model: { ...draft.model, maxTokens: Number(e.target.value) } })} />
                      <div style={hint}>Longer replies cost more credits.</div>
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: 18, flexWrap: "wrap" }}>
                    <label style={{ fontSize: 13 }}><input type="checkbox" checked={draft.enabled} onChange={(e) => set({ enabled: e.target.checked })} /> Enabled</label>
                    <label style={{ fontSize: 13 }}><input type="checkbox" checked={draft.mentionRequired} onChange={(e) => set({ mentionRequired: e.target.checked })} /> Require @mention</label>
                    <label style={{ fontSize: 13 }}><input type="checkbox" checked={draft.access.allowDMs} onChange={(e) => setAccess({ allowDMs: e.target.checked })} /> Allow DMs</label>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 10 }}>
                    <div><span style={label}>Allowed roles</span><MultiPick items={roles} value={draft.access.allowedRoles} onChange={(v) => setAccess({ allowedRoles: v })} empty="No roles loaded." /></div>
                    <div><span style={label}>Allowed channels</span><MultiPick items={textChannels} value={draft.access.allowedChannels} onChange={(v) => setAccess({ allowedChannels: v })} empty="No channels loaded." /></div>
                    <div><span style={label}>Blocked channels</span><MultiPick items={textChannels} value={draft.access.blockedChannels} onChange={(v) => setAccess({ blockedChannels: v })} empty="No channels loaded." /></div>
                  </div>

                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <button style={action} disabled={saving} onClick={save}>{saving ? "Saving..." : isNew ? "Create persona" : "Save changes"}</button>
                    {!isNew ? <button style={{ ...action, borderColor: "#aa0000" }} onClick={() => remove(draft.slug)}>Delete</button> : null}
                    <button style={action} onClick={() => setDraft(null)}>Close</button>
                  </div>

                  {!isNew ? (
                    <div style={{ borderTop: "1px solid #330000", paddingTop: 10 }}>
                      <span style={label}>Test prompt (uses this server&apos;s AI credits)</span>
                      <div style={{ display: "flex", gap: 8 }}>
                        <input style={input} value={testPrompt} maxLength={300} onChange={(e) => setTestPrompt(e.target.value)} placeholder="Say something to this persona..." />
                        <button style={action} disabled={testing || !testPrompt.trim()} onClick={runTest}>{testing ? "..." : "Test"}</button>
                      </div>
                      <div style={hint}>Save your changes first. The test uses the last saved version.</div>
                      {testReply ? <div style={{ marginTop: 8, padding: 10, border: "1px solid #3a0000", borderRadius: 8, fontSize: 13, whiteSpace: "pre-wrap" }}>{testReply}</div> : null}
                    </div>
                  ) : null}
                </div>
              )}
            </div>
          </section>
        </>
      ) : null}
    </div>
  );
}
