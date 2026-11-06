"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { buildDashboardHref } from "@/lib/dashboardContext";
import { fetchRuntimeEngine, resolveGuildContext, runRuntimeEngineAction, saveRuntimeEngine } from "@/lib/liveRuntime";

type SignalSource = {
  id?: string;
  enabled?: boolean;
  label?: string;
  provider?: string;
  channelId?: string;
  feedUrl?: string;
  sourceRef?: string;
  resourceType?: string;
  bridgeBaseUrl?: string;
  resolvedFeedUrl?: string;
  color?: string;
  pingRoleId?: string;
  postAsEmbed?: boolean;
  includeSummary?: boolean;
  footerText?: string;
  imageUrl?: string;
  maxItemsPerCheck?: number;
  pollMinutes?: number;
};

type SignalRelayConfig = {
  active?: boolean;
  pollIntervalMinutes?: number;
  sourceDefaults?: {
    color?: string;
    mentionRoleId?: string;
    includeSummary?: boolean;
    postAsEmbed?: boolean;
    footerText?: string;
  };
  sources?: SignalSource[];
  notes?: string;
};

type RuntimePayload = { config?: Record<string, any> };

const shell: React.CSSProperties = { color: "#ffd0d0", padding: 18, maxWidth: 1380 };
const hero: React.CSSProperties = { border: "1px solid #6a0000", borderRadius: 14, background: "rgba(90,0,0,0.12)", padding: 16, marginBottom: 14 };
const grid: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(250px,1fr))", gap: 12 };
const card: React.CSSProperties = { border: "1px solid #6a0000", borderRadius: 12, background: "rgba(120,0,0,0.10)", padding: 14, display: "grid", gap: 10 };
const button: React.CSSProperties = { border: "1px solid #8a0000", borderRadius: 10, background: "rgba(255,0,0,0.10)", color: "#ffd8d8", padding: "10px 12px", cursor: "pointer", fontWeight: 800 };
const linkButton: React.CSSProperties = { ...button, display: "inline-flex", alignItems: "center", justifyContent: "center", textDecoration: "none" };
const pill = (active: boolean): React.CSSProperties => ({
  border: active ? "1px solid #1f9d55" : "1px solid #8a0000",
  borderRadius: 999,
  background: active ? "rgba(16,120,80,0.18)" : "rgba(120,0,0,0.16)",
  color: active ? "#a7f3d0" : "#ffb4b4",
  padding: "4px 10px",
  fontSize: 11,
  fontWeight: 900,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
});
const micro: React.CSSProperties = { fontSize: 12, color: "#ffb2b2", lineHeight: 1.6 };

const PROVIDERS = [
  { key: "rss", label: "RSS Feeds", detail: "General blogs, updates, changelogs, and site feeds.", anchor: "#sources" },
  { key: "podcast", label: "Podcast Alerts", detail: "Podcast episode drops using RSS-compatible feeds.", anchor: "#sources" },
  { key: "youtube", label: "YouTube Alerts", detail: "Creator video drops through the same relay engine.", anchor: "#sources" },
  { key: "twitch", label: "Twitch Alerts", detail: "Live stream notifications using creator handles and built-in bridge routes.", anchor: "#sources" },
  { key: "tiktok", label: "TikTok Alerts", detail: "Creator upload notices using provider-aware route resolution.", anchor: "#sources" },
  { key: "x", label: "X Alerts", detail: "Post alerts using account handles or direct feed overrides.", anchor: "#sources" },
  { key: "bluesky", label: "Bluesky Alerts", detail: "Bluesky notices using profile handles through Signal Relay.", anchor: "#sources" },
  { key: "reddit", label: "Reddit Alerts", detail: "Subreddit and topic feeds dispatched into server channels.", anchor: "#sources" },
  { key: "instagram", label: "Instagram Alerts", detail: "Image-post notices through the relay source list.", anchor: "#sources" },
  { key: "kick", label: "Kick Alerts", detail: "Stream notices routed with the same signal source engine.", anchor: "#sources" },
] as const;

function createSource(provider: string): SignalSource {
  const label = PROVIDERS.find((entry) => entry.key === provider)?.label || provider.toUpperCase();
  return {
    id: `source_${provider}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    enabled: true,
    label,
    provider,
    channelId: "",
    feedUrl: "",
    sourceRef: "",
    resourceType: provider === "reddit" ? "subreddit" : provider === "youtube" ? "handle" : provider === "rss" || provider === "podcast" ? "feed" : "handle",
    bridgeBaseUrl: "https://rsshub.app",
    color: provider === "youtube" ? "#ff3838" : provider === "twitch" ? "#7c3aed" : "#4fd1c5",
    pingRoleId: "",
    postAsEmbed: true,
    includeSummary: provider !== "twitch",
    footerText: "Signal Relay",
    imageUrl: "",
    maxItemsPerCheck: 1,
    pollMinutes: provider === "youtube" ? 15 : provider === "twitch" ? 5 : 30,
  };
}

function normalizeConfig(input: SignalRelayConfig): SignalRelayConfig {
  return {
    active: input?.active === true,
    pollIntervalMinutes: Number(input?.pollIntervalMinutes || 15) || 15,
    sourceDefaults: {
      color: String(input?.sourceDefaults?.color || "#4fd1c5"),
      mentionRoleId: String(input?.sourceDefaults?.mentionRoleId || ""),
      includeSummary: input?.sourceDefaults?.includeSummary !== false,
      postAsEmbed: input?.sourceDefaults?.postAsEmbed !== false,
      footerText: String(input?.sourceDefaults?.footerText || "Signal Relay"),
    },
    sources: Array.isArray(input?.sources) ? input.sources : [],
    notes: String(input?.notes || ""),
  };
}

export default function SocialAlertsClient() {
  const [guildId, setGuildId] = useState("");
  const [guildName, setGuildName] = useState("");
  const [config, setConfig] = useState<SignalRelayConfig>({ sources: [] });
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    const resolved = resolveGuildContext();
    setGuildId(resolved.guildId);
    setGuildName(resolved.guildName);
  }, []);

  async function loadConfig(targetGuildId: string) {
    if (!targetGuildId) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      setMessage("");
      const json = await fetchRuntimeEngine(targetGuildId, "signalRelay");
      setConfig(normalizeConfig(((json as RuntimePayload)?.config || {}) as SignalRelayConfig));
    } catch (err: any) {
      setMessage(err?.message || "Failed to load Social Alerts.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadConfig(guildId);
  }, [guildId]);

  async function toggleProvider(provider: string, nextValue: boolean) {
    if (!guildId) return;
    try {
      setSavingKey(provider);
      setMessage("");
      const current = normalizeConfig(config);
      let sources = Array.isArray(current.sources) ? [...current.sources] : [];
      const matching = sources.filter((source) => String(source.provider || "").toLowerCase() === provider);

      if (nextValue) {
        if (!matching.length) {
          sources.push(createSource(provider));
        } else {
          sources = sources.map((source) => (
            String(source.provider || "").toLowerCase() === provider
              ? { ...source, enabled: true }
              : source
          ));
        }
      } else if (matching.length) {
        sources = sources.map((source) => (
          String(source.provider || "").toLowerCase() === provider
            ? { ...source, enabled: false }
            : source
        ));
      }

      const active = sources.some((source) => source.enabled !== false);
      const nextConfig = { ...current, active, sources };
      const json = await saveRuntimeEngine(guildId, "signalRelay", nextConfig as Record<string, unknown>);
      setConfig(normalizeConfig(((json as RuntimePayload)?.config || nextConfig) as SignalRelayConfig));
      setMessage(`${PROVIDERS.find((entry) => entry.key === provider)?.label || provider} ${nextValue ? "enabled" : "disabled"} for this guild.`);
    } catch (err: any) {
      setMessage(err?.message || "Failed to update provider.");
    } finally {
      setSavingKey("");
    }
  }

  async function runProvider(provider: string) {
    if (!guildId) return;
    const firstEnabled = (config.sources || []).find((source) => String(source.provider || "").toLowerCase() === provider && source.enabled !== false);
    if (!firstEnabled?.id) return;
    try {
      setSavingKey(`run:${provider}`);
      setMessage("");
      const result: any = await runRuntimeEngineAction(guildId, "signalRelay", "checkNow", { sourceId: firstEnabled.id });
      const posted = Number(result?.result?.posted ?? result?.posted ?? 0);
      const label = PROVIDERS.find((entry) => entry.key === provider)?.label || provider;
      setMessage(posted > 0 ? `${label} check finished. Posted ${posted} new alert${posted === 1 ? "" : "s"}.` : `${label} check finished. Nothing new to post.`);
    } catch (err: any) {
      setMessage(err?.message || "Provider check failed.");
    } finally {
      setSavingKey("");
    }
  }

  const cards = useMemo(() => (
    PROVIDERS.map((provider) => {
      const sources = (config.sources || []).filter((source) => String(source.provider || "").toLowerCase() === provider.key);
      const enabledCount = sources.filter((source) => source.enabled !== false).length;
      const configuredCount = sources.filter((source) => (String(source.feedUrl || "").trim() || String(source.sourceRef || "").trim()) && String(source.channelId || "").trim()).length;
      return {
        ...provider,
        active: enabledCount > 0,
        enabledCount,
        configuredCount,
        href: buildDashboardHref(`/dashboard/signal-relay${provider.anchor}`),
      };
    })
  ), [config.sources]);

  if (!guildId && !loading) {
    return <div style={{ ...shell, color: "#ff8a8a" }}>Missing guildId. Open from `/guilds` first.</div>;
  }

  return (
    <div style={shell}>
      <section style={hero}>
        <h1 style={{ margin: 0, color: "#ff4444", letterSpacing: "0.12em", textTransform: "uppercase" }}>Social Alerts</h1>
        <div style={{ color: "#ff9c9c", marginTop: 6 }}>Guild: {guildName || guildId}</div>
        <div style={{ ...micro, marginTop: 6 }}>
          This recreates the social-alert grid without splitting your bot into ten throwaway engines. RSS, podcast, YouTube, Twitch, TikTok, X, Bluesky, Reddit, Instagram, and Kick all stay under Signal Relay, but provider cards now map to real provider-aware routes instead of dead feed-only copy.
        </div>
        {message ? <div style={{ color: "#ffb3f0", marginTop: 10 }}>{message}</div> : null}
      </section>

      {loading ? (
        <section style={hero}>Loading social alerts...</section>
      ) : (
        <div style={grid}>
          {cards.map((cardDef) => (
            <section key={cardDef.key} style={card}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "start" }}>
                <div>
                  <div style={{ fontSize: 18, fontWeight: 900, color: "#ffdede" }}>{cardDef.label}</div>
                  <div style={{ ...micro, marginTop: 6 }}>{cardDef.detail}</div>
                </div>
                <span style={pill(cardDef.active)}>{cardDef.active ? "Active" : "Off"}</span>
              </div>

              <div style={micro}>
                {cardDef.enabledCount
                  ? `${cardDef.enabledCount} enabled source${cardDef.enabledCount === 1 ? "" : "s"} live for this provider.`
                  : "No enabled sources for this provider yet."}
              </div>
              <div style={{ fontSize: 12, color: "#ffcfcf" }}>
                {cardDef.configuredCount
                  ? `${cardDef.configuredCount} source${cardDef.configuredCount === 1 ? "" : "s"} already have both a channel and provider route.`
                  : "Enable the provider, then finish the handle / route details and channel inside Signal Relay."}
              </div>

              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button
                  type="button"
                  style={button}
                  disabled={savingKey === cardDef.key}
                  onClick={() => void toggleProvider(cardDef.key, !cardDef.active)}
                >
                  {savingKey === cardDef.key ? "Saving..." : cardDef.active ? "Turn Off" : "Turn On"}
                </button>

                <button
                  type="button"
                  style={button}
                  disabled={savingKey === `run:${cardDef.key}` || !cardDef.active}
                  onClick={() => void runProvider(cardDef.key)}
                >
                  {savingKey === `run:${cardDef.key}` ? "Running..." : "Run Check"}
                </button>

                <Link href={buildDashboardHref(cardDef.href)} style={linkButton}>
                  Open Signal Relay
                </Link>
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
