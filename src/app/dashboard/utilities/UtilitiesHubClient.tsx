"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { buildDashboardHref } from "@/lib/dashboardContext";
import { fetchRuntimeEngine, resolveGuildContext, saveRuntimeEngine } from "@/lib/liveRuntime";

type RuntimePayload = { config?: Record<string, any>; summary?: Array<{ label?: string; value?: string }> };
type JedConfig = { enabled?: boolean };
type SearchAnythingConfig = {
  enabled?: boolean;
  providers?: Array<{ enabled?: boolean }>;
};
type CommunityStudioConfig = {
  active?: boolean;
  bulletinsEnabled?: boolean;
  pollsEnabled?: boolean;
  remindersEnabled?: boolean;
  lookup?: { enabled?: boolean };
  polls?: Array<Record<string, unknown>>;
  reminders?: Array<Record<string, unknown>>;
};
type ChannelFlowConfig = {
  active?: boolean;
  counters?: { enabled?: boolean; channels?: Array<Record<string, unknown>> };
  rooms?: { enabled?: boolean; lobbyChannelId?: string };
};
type ReviewConfig = {
  enabled?: boolean;
  reviewChannelId?: string;
  panelChannelId?: string;
  panelMessageId?: string;
};

const shell: React.CSSProperties = { color: "#ffd0d0", padding: 18, maxWidth: 1380 };
const hero: React.CSSProperties = { border: "1px solid #6a0000", borderRadius: 14, background: "rgba(90,0,0,0.12)", padding: 16, marginBottom: 14 };
const grid: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(250px,1fr))", gap: 12 };
const cardStyle: React.CSSProperties = { border: "1px solid #6a0000", borderRadius: 12, background: "rgba(120,0,0,0.10)", padding: 14, display: "grid", gap: 10 };
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

function safeBool(value: unknown, fallback = false) {
  return typeof value === "boolean" ? value : fallback;
}

function countEnabledRows(list: unknown) {
  return Array.isArray(list) ? list.filter((entry) => entry && typeof entry === "object" && (entry as Record<string, unknown>).enabled !== false).length : 0;
}

function computeStudioActive(config: CommunityStudioConfig) {
  return Boolean(
    safeBool(config.bulletinsEnabled, true) ||
    safeBool(config.pollsEnabled, true) ||
    safeBool(config.remindersEnabled, true) ||
    safeBool(config.lookup?.enabled, true)
  );
}

function computeFlowActive(config: ChannelFlowConfig) {
  return Boolean(safeBool(config.counters?.enabled, false) || safeBool(config.rooms?.enabled, false));
}

export default function UtilitiesHubClient() {
  const [guildId, setGuildId] = useState("");
  const [guildName, setGuildName] = useState("");
  const [jed, setJed] = useState<JedConfig>({});
  const [searchAnything, setSearchAnything] = useState<SearchAnythingConfig>({});
  const [communityStudio, setCommunityStudio] = useState<CommunityStudioConfig>({});
  const [channelFlow, setChannelFlow] = useState<ChannelFlowConfig>({});
  const [reviews, setReviews] = useState<ReviewConfig>({});
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState("");
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
      const [jedJson, searchJson, studioJson, flowJson, reviewJson] = await Promise.all([
        fetchRuntimeEngine(targetGuildId, "jed"),
        fetchRuntimeEngine(targetGuildId, "searchAnything"),
        fetchRuntimeEngine(targetGuildId, "communityStudio"),
        fetchRuntimeEngine(targetGuildId, "channelFlow"),
        fetchRuntimeEngine(targetGuildId, "reviews"),
      ]);
      setJed((jedJson as RuntimePayload)?.config || {});
      setSearchAnything((searchJson as RuntimePayload)?.config || {});
      setCommunityStudio((studioJson as RuntimePayload)?.config || {});
      setChannelFlow((flowJson as RuntimePayload)?.config || {});
      setReviews((reviewJson as RuntimePayload)?.config || {});
    } catch (err: any) {
      setMessage(err?.message || "Failed to load utilities.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadAll(guildId);
  }, [guildId]);

  const saveJed = useCallback(async (nextEnabled: boolean) => {
    if (!guildId) return;
    try {
      setSavingKey("jed");
      setMessage("");
      const json = await saveRuntimeEngine(guildId, "jed", { enabled: nextEnabled });
      setJed((json as RuntimePayload)?.config || {});
      setMessage(`Jed ${nextEnabled ? "enabled" : "disabled"} for this guild.`);
    } catch (err: any) {
      setMessage(err?.message || "Failed to update Jed.");
    } finally {
      setSavingKey("");
    }
  }, [guildId]);

  const saveStudioFlag = useCallback(async (flag: "pollsEnabled" | "remindersEnabled", nextValue: boolean) => {
    if (!guildId) return;
    try {
      setSavingKey(flag);
      setMessage("");
      const nextConfig: CommunityStudioConfig = {
        ...communityStudio,
        [flag]: nextValue,
      };
      nextConfig.active = computeStudioActive(nextConfig);
      const json = await saveRuntimeEngine(guildId, "communityStudio", nextConfig as Record<string, unknown>);
      setCommunityStudio((json as RuntimePayload)?.config || nextConfig);
      setMessage(`${flag === "pollsEnabled" ? "Polls" : "Reminders"} ${nextValue ? "enabled" : "disabled"} for this guild.`);
    } catch (err: any) {
      setMessage(err?.message || "Failed to update Community Studio.");
    } finally {
      setSavingKey("");
    }
  }, [communityStudio, guildId]);

  const saveSearchAnything = useCallback(async (nextValue: boolean) => {
    if (!guildId) return;
    try {
      setSavingKey("search-anything");
      setMessage("");
      const nextConfig = { ...searchAnything, enabled: nextValue };
      const json = await saveRuntimeEngine(guildId, "searchAnything", nextConfig as Record<string, unknown>);
      setSearchAnything((json as RuntimePayload)?.config || nextConfig);
      setMessage(`Search Anything ${nextValue ? "enabled" : "disabled"} for this guild.`);
    } catch (err: any) {
      setMessage(err?.message || "Failed to update Search Anything.");
    } finally {
      setSavingKey("");
    }
  }, [guildId, searchAnything]);

  const saveFlowFlag = useCallback(async (section: "counters" | "rooms", nextValue: boolean) => {
    if (!guildId) return;
    try {
      setSavingKey(section);
      setMessage("");
      const nextConfig: ChannelFlowConfig = {
        ...channelFlow,
        [section]: {
          ...(channelFlow[section] || {}),
          enabled: nextValue,
        },
      };
      nextConfig.active = computeFlowActive(nextConfig);
      const json = await saveRuntimeEngine(guildId, "channelFlow", nextConfig as Record<string, unknown>);
      setChannelFlow((json as RuntimePayload)?.config || nextConfig);
      setMessage(`${section === "counters" ? "Statistics Channels" : "Temporary Channels"} ${nextValue ? "enabled" : "disabled"} for this guild.`);
    } catch (err: any) {
      setMessage(err?.message || "Failed to update Channel Flow.");
    } finally {
      setSavingKey("");
    }
  }, [channelFlow, guildId]);

  const saveReviews = useCallback(async (nextValue: boolean) => {
    if (!guildId) return;
    try {
      setSavingKey("reviews");
      setMessage("");
      const nextConfig = { ...reviews, enabled: nextValue };
      const json = await saveRuntimeEngine(guildId, "reviews", nextConfig as Record<string, unknown>);
      setReviews((json as RuntimePayload)?.config || nextConfig);
      setMessage(`Reviews ${nextValue ? "enabled" : "disabled"} for this guild.`);
    } catch (err: any) {
      setMessage(err?.message || "Failed to update Reviews.");
    } finally {
      setSavingKey("");
    }
  }, [guildId, reviews]);

  const cards = useMemo(() => {
    const jedOn = safeBool(jed.enabled, false);
    const searchOn = safeBool(searchAnything.enabled, false);
    const searchProviderCount = Array.isArray(searchAnything.providers)
      ? searchAnything.providers.filter((entry) => entry?.enabled !== false).length
      : 0;
    const reviewsOn = safeBool(reviews.enabled, true);
    const pollsOn = safeBool(communityStudio.active, false) && safeBool(communityStudio.pollsEnabled, true);
    const remindersOn = safeBool(communityStudio.active, false) && safeBool(communityStudio.remindersEnabled, true);
    const countersOn = safeBool(channelFlow.active, false) && safeBool(channelFlow.counters?.enabled, false);
    const roomsOn = safeBool(channelFlow.active, false) && safeBool(channelFlow.rooms?.enabled, false);

    return [
      {
        key: "jed",
        title: "Emojis + Assets",
        status: jedOn,
        summary: "Sticker, emoji, gif, and asset stealing stays on your separate Jed engine.",
        detail: "Use this for server emotes, stickers, and gif grabs without touching moderation.",
        countText: "Open the Jed engine for source rules and deploy behavior.",
        onToggle: () => void saveJed(!jedOn),
        href: buildDashboardHref("/dashboard/jed"),
      },
      {
        key: "help",
        title: "Help",
        status: true,
        summary: "Live slash help already exists and reads the real command catalog.",
        detail: "Use Slash Commands to control what the help surface exposes per guild.",
        countText: "Native help stays available even if you keep custom commands separate.",
        href: buildDashboardHref("/dashboard/slash-commands"),
        goLabel: "Open Help",
      },
      {
        key: "reviews",
        title: "Reviews",
        status: reviewsOn,
        summary: "Deploy a full rating panel with star buttons, review modal, and configurable panel art.",
        detail: "This uses the dedicated review engine instead of a fake shell. Panel channel, review channel, thumbnail, background, and button emojis are all editable.",
        countText: reviews.panelChannelId ? `Panel deploy target saved${reviews.reviewChannelId ? " and review archive channel set." : "."}` : "Pick a panel channel and deploy the review board.",
        onToggle: () => void saveReviews(!reviewsOn),
        href: buildDashboardHref("/dashboard/reviews"),
      },
      {
        key: "pollsEnabled",
        title: "Polls",
        status: pollsOn,
        summary: "Pulse polls, artwork, multivote rules, and deploy-now controls.",
        detail: "This toggles the poll layer inside Community Studio without touching reminders or lookup.",
        countText: `${countEnabledRows(communityStudio.polls)} saved poll layout${countEnabledRows(communityStudio.polls) === 1 ? "" : "s"}.`,
        onToggle: () => void saveStudioFlag("pollsEnabled", !pollsOn),
        href: buildDashboardHref("/dashboard/community-studio#polls"),
      },
      {
        key: "send-embed",
        title: "Embed Messages",
        status: true,
        summary: "Styled embeds are now available in both !Command Studio and Automation Studio.",
        detail: "Use SEND_EMBED for announcement cards, rule cards, and formatted auto-responses.",
        countText: "No raw JSON needed for normal embed actions anymore.",
        href: buildDashboardHref("/dashboard/commands"),
        extraHref: buildDashboardHref("/dashboard/automations/studio"),
        goLabel: "Command Studio",
        extraLabel: "Automation Studio",
      },
      {
        key: "search-anything",
        title: "Search Anything",
        status: searchOn,
        summary: "Provider-routed search links now live on the bot through the real Search Anything engine.",
        detail: "Use this for YouTube, Twitch, anime, wiki, meme, Reddit, and general web search without leaning on fake placeholder cards.",
        countText: `${searchProviderCount} enabled search route${searchProviderCount === 1 ? "" : "s"} available to /search.`,
        onToggle: () => void saveSearchAnything(!searchOn),
        href: buildDashboardHref("/dashboard/search-anything"),
      },
      {
        key: "remindersEnabled",
        title: "Reminders",
        status: remindersOn,
        summary: "Recurring channel reminders, fire-now testing, and history resets.",
        detail: "This toggles the reminder loop without disturbing polls or lookup cards.",
        countText: `${countEnabledRows(communityStudio.reminders)} saved reminder loop${countEnabledRows(communityStudio.reminders) === 1 ? "" : "s"}.`,
        onToggle: () => void saveStudioFlag("remindersEnabled", !remindersOn),
        href: buildDashboardHref("/dashboard/community-studio#reminders"),
      },
      {
        key: "counters",
        title: "Statistics Channels",
        status: countersOn,
        summary: "Live server counters backed by your existing Channel Flow engine.",
        detail: "Rename channels with member counts, voice totals, and other live metrics.",
        countText: `${countEnabledRows(channelFlow.counters?.channels)} configured counter channel${countEnabledRows(channelFlow.counters?.channels) === 1 ? "" : "s"}.`,
        onToggle: () => void saveFlowFlag("counters", !countersOn),
        href: buildDashboardHref("/dashboard/channel-flow#counters"),
      },
      {
        key: "rooms",
        title: "Temporary Channels",
        status: roomsOn,
        summary: "Lobby-based temporary voice channels backed by Channel Flow.",
        detail: "Members join the lobby, get their own room, and it cleans itself up when empty.",
        countText: channelFlow.rooms?.lobbyChannelId ? "Lobby channel is already assigned." : "Pick a lobby voice channel to finish setup.",
        onToggle: () => void saveFlowFlag("rooms", !roomsOn),
        href: buildDashboardHref("/dashboard/channel-flow#rooms"),
      },
    ];
  }, [channelFlow, communityStudio, jed, reviews, saveFlowFlag, saveJed, saveReviews, saveSearchAnything, saveStudioFlag, searchAnything]);

  if (!guildId && !loading) {
    return <div style={{ ...shell, color: "#ff8a8a" }}>Missing guildId. Open from `/guilds` first.</div>;
  }

  return (
    <div style={shell}>
      <section style={hero}>
        <h1 style={{ margin: 0, color: "#ff4444", letterSpacing: "0.12em", textTransform: "uppercase" }}>Utilities</h1>
        <div style={{ color: "#ff9c9c", marginTop: 6 }}>Guild: {guildName || guildId}</div>
        <div style={{ ...micro, marginTop: 6 }}>
          This is the MEE6-style utility board rebuilt on top of your own engines. Jed stays separate, Community Studio owns polls and reminders, Channel Flow owns counter channels and temp rooms, and SEND_EMBED now lives in your automation/command stack.
        </div>
        {message ? <div style={{ color: "#ffb3f0", marginTop: 10 }}>{message}</div> : null}
      </section>

      {loading ? (
        <section style={hero}>Loading utilities...</section>
      ) : (
        <div style={grid}>
          {cards.map((card) => (
            <section key={card.key} style={cardStyle}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "start" }}>
                <div>
                  <div style={{ fontSize: 18, fontWeight: 900, color: "#ffdede" }}>{card.title}</div>
                  <div style={{ ...micro, marginTop: 6 }}>{card.summary}</div>
                </div>
                <span style={pill(card.status)}>{card.status ? "Active" : "Off"}</span>
              </div>

              <div style={micro}>{card.detail}</div>
              <div style={{ fontSize: 12, color: "#ffcfcf" }}>{card.countText}</div>

              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {card.onToggle ? (
                  <button
                    type="button"
                    style={button}
                    disabled={savingKey === card.key}
                    onClick={card.onToggle}
                  >
                    {savingKey === card.key ? "Saving..." : card.status ? "Turn Off" : "Turn On"}
                  </button>
                ) : null}

                {card.href ? (
                  <Link href={buildDashboardHref(card.href)} style={linkButton}>
                    {card.goLabel || "Open"}
                  </Link>
                ) : null}

                {card.extraHref ? (
                  <Link href={buildDashboardHref(card.extraHref)} style={linkButton}>
                    {card.extraLabel || "Open"}
                  </Link>
                ) : null}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
