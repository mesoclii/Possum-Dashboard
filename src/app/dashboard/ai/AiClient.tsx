"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { buildDashboardHref } from "@/lib/dashboardContext";
import { useDashboardSessionState } from "@/components/possum/useDashboardSessionState";

type GuildChannel = {
  id: string;
  name: string;
  type?: number | string;
};

type AiRuntimeConfig = {
  personaAiEnabled: boolean;
  adaptiveAiEnabled: boolean;
  personaOnlyChannelIds: string[];
  personaKeywordTriggers: string[];
};

type Card = {
  title: string;
  href: string;
  description: string;
  note: string;
  creatorOnly?: boolean;
};

const cards: Card[] = [
  {
    title: "Possum AI",
    href: "/dashboard/ai/learning",
    description: "Handcrafted adaptive assistant, bot knowledge base, learning writes, routing, and synthesis.",
    note: "This is the primary non-persona message path.",
  },
  {
    title: "Persona AI",
    href: "/dashboard/ai/persona",
    description: "LLM persona roster, access, triggers, photos, and /persona runtime.",
    note: "This only handles persona-routed messages.",
  },
  {
    title: "OpenAI Platform",
    href: "/dashboard/ai/openai-platform",
    description: "Provider, model, and hosted platform surface.",
    note: "Separated from Possum AI and the local persona roster.",
    creatorOnly: true,
  },
  {
    title: "AI Billing",
    href: "/dashboard/ai/billing",
    description: "AI credit balance, usage per persona, buying credits, spending limits and auto-purchase.",
    note: "Per-server wallet. Needs Manage Server.",
  },
  {
    title: "Memory + Context",
    href: "/dashboard/ai/memory",
    description: "Context retention, anti-repeat, and memory controls.",
    note: "Use after the two AI paths are routed correctly.",
  },
  {
    title: "Tone + Style",
    href: "/dashboard/ai/tone",
    description: "Tone routing and style controls.",
    note: "Keeps style separate from provider and persona setup.",
  },
];

const DEFAULT_CONFIG: AiRuntimeConfig = {
  personaAiEnabled: false,
  adaptiveAiEnabled: false,
  personaOnlyChannelIds: [],
  personaKeywordTriggers: ["persona", "character"],
};

const wrap: CSSProperties = { color: "#ffd0d0", maxWidth: 1320 };
const card: CSSProperties = {
  border: "1px solid rgba(255,0,0,.36)",
  borderRadius: 12,
  padding: 14,
  background: "rgba(100,0,0,.10)",
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
  background: "#0a0a0a",
  border: "1px solid rgba(255,0,0,.45)",
  color: "#ffd5d5",
  borderRadius: 8,
  padding: "10px 12px",
};

function resolveGuild() {
  if (typeof window === "undefined") return { guildId: "", guildName: "" };
  const params = new URLSearchParams(window.location.search);
  const guildId = (params.get("guildId") || localStorage.getItem("activeGuildId") || "").trim();
  const guildName = (localStorage.getItem("activeGuildName") || guildId).trim();
  if (guildId) localStorage.setItem("activeGuildId", guildId);
  return { guildId, guildName };
}

function normalizeKeywords(input: string): string[] {
  return [...new Set(
    String(input || "")
      .split(/[,\n]+/)
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean)
  )];
}

function isTextLike(channel: GuildChannel) {
  const value = String(channel?.type ?? "").toLowerCase();
  if (!value) return true;
  return value.includes("text") || value === "0";
}

export default function AiClient() {
  const { isMasterOwner } = useDashboardSessionState();
  const [guildId, setGuildId] = useState("");
  const [guildName, setGuildName] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [config, setConfig] = useState<AiRuntimeConfig>(DEFAULT_CONFIG);
  const [channels, setChannels] = useState<GuildChannel[]>([]);
  const [keywordInput, setKeywordInput] = useState(DEFAULT_CONFIG.personaKeywordTriggers.join(", "));

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
        setMessage("");

        const [dashRes, guildRes] = await Promise.all([
          fetch(`/api/bot/dashboard-config?guildId=${encodeURIComponent(resolved.guildId)}`, { cache: "no-store" }),
          fetch(`/api/bot/guild-data?guildId=${encodeURIComponent(resolved.guildId)}`, { cache: "no-store" }),
        ]);

        const dashJson = await dashRes.json().catch(() => ({}));
        const guildJson = await guildRes.json().catch(() => ({}));
        if (!dashRes.ok || dashJson?.success === false) {
          throw new Error(dashJson?.error || "Failed to load AI control.");
        }

        const runtime = dashJson?.config?.aiRuntime || {};
        const nextConfig: AiRuntimeConfig = {
          personaAiEnabled: Boolean(
            typeof runtime?.personaAiEnabled === "boolean"
              ? runtime.personaAiEnabled
              : dashJson?.config?.features?.personaAiEnabled
          ),
          adaptiveAiEnabled: Boolean(
            typeof runtime?.adaptiveAiEnabled === "boolean"
              ? runtime.adaptiveAiEnabled
              : dashJson?.config?.features?.adaptiveAiEnabled
          ),
          personaOnlyChannelIds: Array.isArray(runtime?.personaOnlyChannelIds)
            ? runtime.personaOnlyChannelIds.filter(Boolean)
            : [],
          personaKeywordTriggers: Array.isArray(runtime?.personaKeywordTriggers) && runtime.personaKeywordTriggers.length
            ? runtime.personaKeywordTriggers.filter(Boolean)
            : DEFAULT_CONFIG.personaKeywordTriggers,
        };

        setConfig(nextConfig);
        setKeywordInput(nextConfig.personaKeywordTriggers.join(", "));
        const nextChannels = Array.isArray(guildJson?.channels) ? guildJson.channels.filter(isTextLike) : [];
        setChannels(nextChannels);
      } catch (err: any) {
        setMessage(err?.message || "Failed to load AI control.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const selectedChannelNames = useMemo(() => {
    const byId = new Map(channels.map((channel) => [channel.id, channel.name]));
    return config.personaOnlyChannelIds.map((id) => byId.get(id) || id);
  }, [channels, config.personaOnlyChannelIds]);
  const visibleCards = useMemo(() => cards.filter((entry) => !entry.creatorOnly || isMasterOwner), [isMasterOwner]);

  async function saveRuntime(patch: Partial<AiRuntimeConfig>, successMessage: string) {
    if (!guildId) return;
    setSaving(true);
    setMessage("");
    try {
      const res = await fetch("/api/bot/engine-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          guildId,
          engine: "aiRuntime",
          patch,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json?.success === false) {
        throw new Error(json?.error || "Failed to save AI runtime.");
      }
      setConfig((prev) => ({ ...prev, ...patch }));
      setMessage(successMessage);
    } catch (err: any) {
      setMessage(err?.message || "Failed to save AI runtime.");
    } finally {
      setSaving(false);
    }
  }

  async function toggleChannel(channelId: string) {
    const nextIds = config.personaOnlyChannelIds.includes(channelId)
      ? config.personaOnlyChannelIds.filter((id) => id !== channelId)
      : [...config.personaOnlyChannelIds, channelId];
    await saveRuntime({ personaOnlyChannelIds: nextIds }, "Persona-only channels updated.");
  }

  async function saveKeywords() {
    const keywords = normalizeKeywords(keywordInput);
    await saveRuntime(
      { personaKeywordTriggers: keywords.length ? keywords : DEFAULT_CONFIG.personaKeywordTriggers },
      "Persona routing keywords updated."
    );
  }

  if (!guildId) {
    return <div style={{ color: "#ff8585", padding: 20 }}>Missing guildId. Open from /guilds first.</div>;
  }

  return (
    <div style={wrap}>
      <section style={{ ...card, marginBottom: 12 }}>
            <h1 style={{ margin: 0, color: "#ff4a4a", letterSpacing: "0.12em", textTransform: "uppercase" }}>
              AI Routing
            </h1>
        <div style={{ color: "#ff9f9f", marginTop: 8 }}>Guild: {guildName || guildId}</div>
        <div style={{ color: "#ffb5b5", fontSize: 12, marginTop: 8, maxWidth: 900 }}>
              The AI stack is split by what it actually is. Possum AI owns the adaptive homemade path and knowledge base.
              Persona AI owns the premium hosted persona roster. Persona-triggered messages stay on the persona path, and all
              other eligible adaptive traffic stays on the Possum AI path. Guild backstory belongs to Possum AI, not Persona AI.
            </div>
        {message ? <div style={{ color: "#ffb3f0", marginTop: 10 }}>{message}</div> : null}
      </section>

      <section style={{ ...card, marginBottom: 12 }}>
        <div style={{ color: "#ff9c9c", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>
          Archived Modules
        </div>
        <div style={{ color: "#ffbdbd", fontSize: 12 }}>
          `ai-core` and `ai-characters` are now treated as archived scaffolding, not live handlers. The active adaptive path is
          the Possum AI runtime, and the active model path is the Persona AI / OpenAI platform split.
        </div>
      </section>

      {loading ? <div style={card}>Loading AI routing...</div> : null}

      {!loading ? (
        <>
          <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 10, marginBottom: 12 }}>
            <div style={card}>
              <div style={{ color: "#ff9c9c", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.08em" }}>Possum AI</div>
              <div style={{ color: "#ffdada", fontSize: 18, fontWeight: 800, marginTop: 6 }}>
                {config.adaptiveAiEnabled ? "Enabled" : "Disabled"}
              </div>
              <button
                type="button"
                onClick={() => void saveRuntime({ adaptiveAiEnabled: !config.adaptiveAiEnabled }, `Possum AI ${config.adaptiveAiEnabled ? "disabled" : "enabled"}.`)}
                disabled={saving}
                style={{ ...action, marginTop: 10 }}
              >
                {config.adaptiveAiEnabled ? "Turn Off" : "Turn On"}
              </button>
            </div>

            <div style={card}>
              <div style={{ color: "#ff9c9c", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.08em" }}>Persona AI</div>
              <div style={{ color: "#ffdada", fontSize: 18, fontWeight: 800, marginTop: 6 }}>
                {config.personaAiEnabled ? "Enabled" : "Disabled"}
              </div>
              <button
                type="button"
                onClick={() => void saveRuntime({ personaAiEnabled: !config.personaAiEnabled }, `Persona AI ${config.personaAiEnabled ? "disabled" : "enabled"}.`)}
                disabled={saving}
                style={{ ...action, marginTop: 10 }}
              >
                {config.personaAiEnabled ? "Turn Off" : "Turn On"}
              </button>
            </div>

            <div style={card}>
              <div style={{ color: "#ff9c9c", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.08em" }}>Routing Lock</div>
              <div style={{ color: "#ffdada", fontSize: 18, fontWeight: 800, marginTop: 6 }}>
                Exclusive
              </div>
              <div style={{ color: "#ffbdbd", fontSize: 12, marginTop: 8 }}>
                Persona-triggered messages never fall through into Possum AI. The old shared AI master flag is no longer
                the deciding route control.
              </div>
            </div>
          </section>

          <section style={{ ...card, marginBottom: 12 }}>
            <div style={{ color: "#ff9c9c", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>
              Persona Routing
            </div>
            <div style={{ color: "#ffbdbd", fontSize: 12, marginBottom: 12 }}>
              Persona messages are claimed only by persona-only channels or by mentioning the bot together with a persona keyword or persona roster match.
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(320px,0.9fr)", gap: 12 }}>
              <div>
                <label>Persona keywords</label>
                <input
                  style={input}
                  value={keywordInput}
                  onChange={(e) => setKeywordInput(e.target.value)}
                  placeholder="persona, character"
                />
                <button type="button" onClick={() => void saveKeywords()} disabled={saving} style={{ ...action, marginTop: 10 }}>
                  Save Keywords
                </button>
              </div>

              <div>
                <div style={{ marginBottom: 8 }}>Persona-only channels</div>
                <div style={{ maxHeight: 230, overflow: "auto", border: "1px solid rgba(255,0,0,.24)", borderRadius: 10, padding: 10 }}>
                  {channels.length ? channels.map((channel) => (
                    <label key={channel.id} style={{ display: "block", marginBottom: 8, fontSize: 13 }}>
                      <input
                        type="checkbox"
                        checked={config.personaOnlyChannelIds.includes(channel.id)}
                        onChange={() => void toggleChannel(channel.id)}
                        disabled={saving}
                      />{" "}
                      #{channel.name}
                    </label>
                  )) : (
                    <div style={{ color: "#ffbdbd", fontSize: 12 }}>No text channels available.</div>
                  )}
                </div>
              </div>
            </div>
            <div style={{ color: "#ff9c9c", fontSize: 12, marginTop: 10 }}>
              Active persona-only channels: {selectedChannelNames.length ? selectedChannelNames.join(", ") : "None"}
            </div>
          </section>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))", gap: 12 }}>
            {visibleCards.map((entry) => (
              <section key={entry.href} style={card}>
                <div style={{ color: "#ff6666", fontSize: 13, fontWeight: 900, letterSpacing: "0.08em", textTransform: "uppercase" }}>
                  {entry.title}
                </div>
                <div style={{ color: "#ffdada", fontSize: 14, marginTop: 8 }}>{entry.description}</div>
                <div style={{ color: "#ffb5b5", fontSize: 12, marginTop: 8 }}>{entry.note}</div>
                <div style={{ marginTop: 14 }}>
                  <Link href={buildDashboardHref(entry.href)} style={action}>
                    Open
                  </Link>
                </div>
              </section>
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}
