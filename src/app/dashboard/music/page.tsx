/* eslint-disable @next/next/no-img-element */
"use client";

import { useMemo } from "react";
import type { CSSProperties, ChangeEvent } from "react";
import EngineInsights from "@/components/possum/EngineInsights";
import OperatorLogPanel from "@/components/possum/OperatorLogPanel";
import { useGuildEngineEditor } from "@/components/possum/useGuildEngineEditor";

type MusicLibraryTrack = {
  id: string;
  title: string;
  artist: string;
  url: string;
  artworkUrl: string;
  provider: string;
  aliases: string[];
};

type MusicRoute = {
  id: string;
  name: string;
  enabled: boolean;
  sourceTextChannelIds: string[];
  targetVoiceChannelId: string;
  controlTextChannelId: string;
  allowSlashPlay: boolean;
  captureMessages: boolean;
  djRoleIds: string[];
  defaultVolume: number;
  maxQueueSize: number;
  sourceProviders: string[];
  allowCrossProviderFallback: boolean;
  notes: string;
  bannerUrl: string;
  audioOverride: {
    qualityPreset?: string;
    targetBitrateKbps?: number;
    sampleRateHz?: number;
    channels?: number;
    normalizeLoudness?: boolean;
    enableDither?: boolean;
  };
};

type MusicCfg = {
  enabled: boolean;
  legalNotice: string;
  premiumRequired: boolean;
  billable: boolean;
  monetizationAllowed: boolean;
  policyTag: string;
  maxRoutesPerGuild: number;
  maxActiveSessionsPerGuild: number;
  allowBridgeMode: boolean;
  maxBridgedRoutesPerSource: number;
  defaultVolume: number;
  idleDisconnectMinutes: number;
  autoLeaveIfAloneSeconds: number;
  maxQueueSizePerRoute: number;
  maxTrackMinutes: number;
  maxUrlLength: number;
  enqueueCooldownPerUserMs: number;
  djRoleIds: string[];
  sourcePolicy: {
    mode: "allowlist" | "blocklist";
    allowedDomains: string[];
    blockedDomains: string[];
    allowedProviders: string[];
    defaultProvider: string;
    requireHttps: boolean;
  };
  searchProvider: {
    enabled: boolean;
    endpointUrl: string;
    authHeader: string;
    bearerToken: string;
    queryParam: string;
    resultLimit: number;
    timeoutMs: number;
  };
  ytDlp: {
    enabled: boolean;
    binaryPath: string;
    timeoutMs: number;
    searchProvider: "youtube" | "soundcloud";
    searchResultCount: number;
    allowMediaPageUrls: boolean;
  };
  audio: {
    qualityPreset: "low" | "balanced" | "high" | "ultra";
    targetBitrateKbps: number;
    sampleRateHz: number;
    channels: 1 | 2;
    normalizeLoudness: boolean;
    enableDither: boolean;
  };
  adSafeMode: {
    enabled: boolean;
    deadLogChannelId: string;
    suppressPublicStatus: boolean;
    rejectAdSupportedSources: boolean;
    strictSourceAllowlist: boolean;
  };
  panelDeploy: {
    enabled: boolean;
    channelId: string;
    messageId: string;
    title: string;
    description: string;
    bannerUrl: string;
    showRouteSelector: boolean;
    footerText: string;
  };
  library: MusicLibraryTrack[];
  routes: MusicRoute[];
};

const PROVIDER_OPTIONS = [
  { id: "direct_url", label: "Direct Audio URLs", hint: "MP3, stream, and raw audio links." },
  { id: "local_library", label: "Local Library Aliases", hint: "Tracks you hard-wire into this guild." },
  { id: "self_hosted_search", label: "Self-Hosted Search", hint: "Your own API search endpoint." },
  { id: "yt_dlp_search", label: "Built-In Song Search", hint: "Song-name lookup through yt-dlp." },
  { id: "yt_dlp_media", label: "Supported Media Page URLs", hint: "YouTube/SoundCloud-style page links resolved by yt-dlp." },
] as const;
const QUALITY_PRESETS = ["low", "balanced", "high", "ultra"] as const;
const TEXT_CHANNEL_TYPES = new Set(["0", "5", "10", "11", "12", "15", "16", "guildtext", "guildannouncement", "announcement", "publicthread", "privatethread", "announcementthread", "forum", "media"]);
const VOICE_CHANNEL_TYPES = new Set(["2", "13", "guildvoice", "guildstagevoice", "voice", "stagevoice"]);
const CATEGORY_CHANNEL_TYPES = new Set(["4", "guildcategory", "category"]);

const EMPTY: MusicCfg = {
  enabled: true,
  legalNotice: "This music engine is permanently free and excluded from paid plans. Possum Bot will not profit from this feature.",
  premiumRequired: false,
  billable: false,
  monetizationAllowed: false,
  policyTag: "always_free_non_profit",
  maxRoutesPerGuild: 6,
  maxActiveSessionsPerGuild: 4,
  allowBridgeMode: false,
  maxBridgedRoutesPerSource: 2,
  defaultVolume: 80,
  idleDisconnectMinutes: 10,
  autoLeaveIfAloneSeconds: 60,
  maxQueueSizePerRoute: 100,
  maxTrackMinutes: 180,
  maxUrlLength: 2048,
  enqueueCooldownPerUserMs: 2500,
  djRoleIds: [],
  sourcePolicy: {
    mode: "allowlist",
    allowedDomains: [],
    blockedDomains: [],
    allowedProviders: ["direct_url", "local_library", "self_hosted_search", "yt_dlp_search", "yt_dlp_media"],
    defaultProvider: "local_library",
    requireHttps: true,
  },
  searchProvider: {
    enabled: false,
    endpointUrl: "",
    authHeader: "Authorization",
    bearerToken: "",
    queryParam: "q",
    resultLimit: 5,
    timeoutMs: 8000,
  },
  ytDlp: {
    enabled: true,
    binaryPath: "",
    timeoutMs: 20000,
    searchProvider: "youtube",
    searchResultCount: 5,
    allowMediaPageUrls: true,
  },
  audio: {
    qualityPreset: "balanced",
    targetBitrateKbps: 128,
    sampleRateHz: 48000,
    channels: 2,
    normalizeLoudness: false,
    enableDither: false,
  },
  adSafeMode: {
    enabled: true,
    deadLogChannelId: "",
    suppressPublicStatus: false,
    rejectAdSupportedSources: true,
    strictSourceAllowlist: false,
  },
  panelDeploy: {
    enabled: false,
    channelId: "",
    messageId: "",
    title: "Possum Music Control",
    description: "Use /music to route direct audio streams and library aliases into the configured voice routes.",
    bannerUrl: "",
    showRouteSelector: true,
    footerText: "Music stays permanently free and excluded from paid plans.",
  },
  library: [],
  routes: [],
};

const box: CSSProperties = {
  border: "1px solid #5f0000",
  borderRadius: 14,
  padding: 16,
  background: "linear-gradient(180deg, rgba(120,0,0,0.12), rgba(0,0,0,0.72))",
  marginBottom: 14,
};

const input: CSSProperties = {
  width: "100%",
  background: "#0a0a0a",
  color: "#ffd0d0",
  border: "1px solid #7f0000",
  borderRadius: 10,
  padding: "10px 12px",
};

const button: CSSProperties = {
  ...input,
  width: "auto",
  cursor: "pointer",
  fontWeight: 900,
  textTransform: "uppercase",
  letterSpacing: "0.06em",
};

const label: CSSProperties = {
  color: "#ffb9b9",
  fontSize: 12,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  marginBottom: 6,
};

function toggle(list: string[], id: string) {
  const set = new Set(list || []);
  if (set.has(id)) set.delete(id);
  else set.add(id);
  return Array.from(set);
}

function lines(value: string) {
  return value.split(/\r?\n+/).map((item) => item.trim()).filter(Boolean);
}

function aliases(value: string) {
  return value.split(",").map((item) => item.trim()).filter(Boolean);
}

async function fileToDataUrl(file: File) {
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Image load failed."));
    reader.readAsDataURL(file);
  });
}

function newTrack(index: number): MusicLibraryTrack {
  const id = `library-${index + 1}`;
  return { id, title: `Library Track ${index + 1}`, artist: "", url: "", artworkUrl: "", provider: "local_library", aliases: [id] };
}

function newRoute(index: number, cfg: MusicCfg): MusicRoute {
  return {
    id: `route-${index + 1}`,
    name: `Music Route ${index + 1}`,
    enabled: true,
    sourceTextChannelIds: [],
    targetVoiceChannelId: "",
    controlTextChannelId: "",
    allowSlashPlay: true,
    captureMessages: true,
    djRoleIds: [],
    defaultVolume: cfg.defaultVolume,
    maxQueueSize: cfg.maxQueueSizePerRoute,
    sourceProviders: PROVIDER_OPTIONS.map((provider) => provider.id),
    allowCrossProviderFallback: false,
    notes: "",
    bannerUrl: "",
    audioOverride: {
      qualityPreset: cfg.audio.qualityPreset,
      targetBitrateKbps: cfg.audio.targetBitrateKbps,
      sampleRateHz: cfg.audio.sampleRateHz,
      channels: cfg.audio.channels,
      normalizeLoudness: cfg.audio.normalizeLoudness,
      enableDither: cfg.audio.enableDither,
    },
  };
}

function normalizeChannelType(value: number | string | undefined) {
  return String(value ?? "").trim().toLowerCase();
}

function isCategoryChannel(channel: { type?: number | string }) {
  return CATEGORY_CHANNEL_TYPES.has(normalizeChannelType(channel?.type));
}

function isVoiceSelectable(channel: { type?: number | string }) {
  return VOICE_CHANNEL_TYPES.has(normalizeChannelType(channel?.type));
}

function isTextSelectable(channel: { type?: number | string }) {
  return TEXT_CHANNEL_TYPES.has(normalizeChannelType(channel?.type));
}

export default function MusicEnginePage() {
  const { guildId, guildName, config: cfg, setConfig: setCfg, channels, roles, summary, details, loading, saving, message, save, runAction } =
    useGuildEngineEditor<MusicCfg>("music", EMPTY);
  const musicActive = summary.find((item) => item.label === "Active")?.value === "Enabled";
  const featureGate = summary.find((item) => item.label === "Guild Feature Gate")?.value || "Unknown";

  const selectableChannels = useMemo(() => channels.filter((channel) => !isCategoryChannel(channel)), [channels]);
  const textChannels = useMemo(() => {
    const filtered = selectableChannels.filter((channel) => isTextSelectable(channel));
    return filtered.length ? filtered : selectableChannels.filter((channel) => !isVoiceSelectable(channel));
  }, [selectableChannels]);
  const voiceChannels = useMemo(() => selectableChannels.filter((channel) => isVoiceSelectable(channel)), [selectableChannels]);

  const updateRoute = (index: number, patch: Partial<MusicRoute>) =>
    setCfg((prev) => ({ ...prev, routes: prev.routes.map((route, routeIndex) => (routeIndex === index ? { ...route, ...patch } : route)) }));

  const updateLibrary = (index: number, patch: Partial<MusicLibraryTrack>) =>
    setCfg((prev) => ({ ...prev, library: prev.library.map((track, trackIndex) => (trackIndex === index ? { ...track, ...patch } : track)) }));

  const uploadLibraryArt = async (event: ChangeEvent<HTMLInputElement>, index: number) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const dataUrl = await fileToDataUrl(file).catch(() => "");
    if (dataUrl) updateLibrary(index, { artworkUrl: dataUrl });
    event.target.value = "";
  };

  const uploadRouteBanner = async (event: ChangeEvent<HTMLInputElement>, index: number) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const dataUrl = await fileToDataUrl(file).catch(() => "");
    if (dataUrl) updateRoute(index, { bannerUrl: dataUrl });
    event.target.value = "";
  };

  const uploadPanelBanner = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const dataUrl = await fileToDataUrl(file).catch(() => "");
    if (dataUrl) {
      setCfg((prev) => ({ ...prev, panelDeploy: { ...prev.panelDeploy, bannerUrl: dataUrl } }));
    }
    event.target.value = "";
  };

  if (!guildId) return <div style={{ color: "#ff8080", padding: 24 }}>Missing guildId. Open from /guilds first.</div>;

  return (
    <div style={{ color: "#ffd0d0", padding: 18, maxWidth: 1500 }}>
      <h1 style={{ margin: 0, color: "#ff4444", letterSpacing: "0.12em", textTransform: "uppercase" }}>Music Engine</h1>
      <div style={{ color: "#ff9999", marginTop: 6, marginBottom: 12 }}>Guild: {guildName || guildId}</div>
      <div style={{ color: "#ffb8b8", lineHeight: 1.7, maxWidth: 1100, marginBottom: 12 }}>
        {cfg.legalNotice}
        <br />
        This page edits the live guild music runtime: route-based voice sessions, source-channel capture, DJ access, local library aliases,
        route banners, self-hosted search routing, live panel controls, and the audio profile used by every route.
      </div>
      {message ? <div style={{ marginBottom: 10, color: "#ffb3f0" }}>{message}</div> : null}
      {loading ? (
        <div style={box}>Loading...</div>
      ) : (
        <>
          <EngineInsights summary={summary} details={details} />
          <OperatorLogPanel guildId={guildId} engine="music" title="Music Operator Logs" />

          <section style={{ ...box, marginTop: 12 }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 14 }}>
              <div>
                <div style={label}>Engine State</div>
                <label style={{ display: "inline-flex", gap: 8, alignItems: "center", color: "#ffdcdc", fontWeight: 700 }}>
                  <input type="checkbox" checked={cfg.enabled} onChange={(e) => setCfg((prev) => ({ ...prev, enabled: e.target.checked }))} />
                  Enabled
                </label>
                <div style={{ color: featureGate === "Enabled" ? "#ffb3f0" : "#ffb3f0", fontSize: 12, marginTop: 6 }}>
                  Guild feature access: {featureGate}
                </div>
              </div>
              {[
                ["maxRoutesPerGuild", "Max Routes", 1, 20],
                ["maxActiveSessionsPerGuild", "Max Active Sessions", 1, 12],
                ["maxBridgedRoutesPerSource", "Max Bridged Routes", 1, 8],
                ["defaultVolume", "Default Volume", 1, 200],
                ["idleDisconnectMinutes", "Idle Disconnect (min)", 0, 120],
                ["autoLeaveIfAloneSeconds", "Leave If Alone (sec)", 0, 600],
                ["maxQueueSizePerRoute", "Max Queue Per Route", 1, 250],
                ["maxTrackMinutes", "Max Track Minutes", 1, 720],
                ["maxUrlLength", "Max URL Length", 256, 4096],
                ["enqueueCooldownPerUserMs", "Enqueue Cooldown (ms)", 0, 600000],
              ].map(([key, text, min, max]) => (
                <div key={key}>
                  <div style={label}>{text}</div>
                  <input
                    style={input}
                    type="number"
                    min={min}
                    max={max}
                    value={Number(cfg[key as keyof MusicCfg] || 0)}
                    onChange={(e) => setCfg((prev) => ({ ...prev, [key]: Number(e.target.value || min) }))}
                  />
                </div>
              ))}
            </div>
            <div style={{ display: "flex", gap: 18, flexWrap: "wrap", marginTop: 14 }}>
              <label style={{ display: "inline-flex", gap: 8, alignItems: "center", color: "#ffdcdc", fontWeight: 700 }}>
                <input type="checkbox" checked={cfg.allowBridgeMode} onChange={(e) => setCfg((prev) => ({ ...prev, allowBridgeMode: e.target.checked }))} />
                Allow bridge mode
              </label>
              <label style={{ display: "inline-flex", gap: 8, alignItems: "center", color: "#ffbaba" }}>
                One source channel can feed multiple target routes when this is on.
              </label>
            </div>
          </section>

          <section style={box}>
            <div style={{ color: "#ffb3b3", fontSize: 12, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 10 }}>
              Source Policy + Audio Profile
            </div>
            {!textChannels.length || !voiceChannels.length ? (
              <div style={{ marginBottom: 14, color: "#ffb3f0", lineHeight: 1.7 }}>
                Guild channel data is still syncing. Text channels found: {textChannels.length}. Voice channels found: {voiceChannels.length}. If you just created or renamed channels,
                save once and reload this page in a few seconds.
              </div>
            ) : null}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))", gap: 14 }}>
              <div>
                <div style={label}>Source Policy</div>
                <select style={input} value={cfg.sourcePolicy.mode} onChange={(e) => setCfg((prev) => ({ ...prev, sourcePolicy: { ...prev.sourcePolicy, mode: e.target.value as "allowlist" | "blocklist" } }))}>
                  <option value="allowlist">Allowlist</option>
                  <option value="blocklist">Blocklist</option>
                </select>
              </div>
              <div>
                <div style={label}>Default Provider</div>
                <select style={input} value={cfg.sourcePolicy.defaultProvider} onChange={(e) => setCfg((prev) => ({ ...prev, sourcePolicy: { ...prev.sourcePolicy, defaultProvider: e.target.value } }))}>
                  <option value="local_library">Local Library</option>
                  <option value="direct_url">Direct URL</option>
                  <option value="yt_dlp_search">Built-In Song Search</option>
                  <option value="yt_dlp_media">Supported Media Page URL</option>
                  <option value="self_hosted_search">Self-Hosted Search</option>
                </select>
              </div>
              <div>
                <div style={label}>Quality Preset</div>
                <select style={input} value={cfg.audio.qualityPreset} onChange={(e) => setCfg((prev) => ({ ...prev, audio: { ...prev.audio, qualityPreset: e.target.value as MusicCfg["audio"]["qualityPreset"] } }))}>
                  {QUALITY_PRESETS.map((preset) => (
                    <option key={preset} value={preset}>
                      {preset}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <div style={label}>Bitrate (kbps)</div>
                <input style={input} type="number" min={64} max={320} value={cfg.audio.targetBitrateKbps} onChange={(e) => setCfg((prev) => ({ ...prev, audio: { ...prev.audio, targetBitrateKbps: Number(e.target.value || 64) } }))} />
              </div>
              <div>
                <div style={label}>Sample Rate</div>
                <input style={input} type="number" min={22050} max={48000} value={cfg.audio.sampleRateHz} onChange={(e) => setCfg((prev) => ({ ...prev, audio: { ...prev.audio, sampleRateHz: Number(e.target.value || 22050) } }))} />
              </div>
              <div>
                <div style={label}>Channels</div>
                <select style={input} value={cfg.audio.channels} onChange={(e) => setCfg((prev) => ({ ...prev, audio: { ...prev.audio, channels: Number(e.target.value || 2) as 1 | 2 } }))}>
                  <option value={1}>Mono</option>
                  <option value={2}>Stereo</option>
                </select>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(320px,1fr))", gap: 14, marginTop: 14 }}>
              <div>
                <div style={label}>Allowed Domains (one per line)</div>
                <textarea style={{ ...input, minHeight: 110 }} value={cfg.sourcePolicy.allowedDomains.join("\n")} onChange={(e) => setCfg((prev) => ({ ...prev, sourcePolicy: { ...prev.sourcePolicy, allowedDomains: lines(e.target.value) } }))} />
              </div>
              <div>
                <div style={label}>Blocked Domains (one per line)</div>
                <textarea style={{ ...input, minHeight: 110 }} value={cfg.sourcePolicy.blockedDomains.join("\n")} onChange={(e) => setCfg((prev) => ({ ...prev, sourcePolicy: { ...prev.sourcePolicy, blockedDomains: lines(e.target.value) } }))} />
              </div>
              <div>
                <div style={label}>Dead Log Channel</div>
                <select style={input} value={cfg.adSafeMode.deadLogChannelId} onChange={(e) => setCfg((prev) => ({ ...prev, adSafeMode: { ...prev.adSafeMode, deadLogChannelId: e.target.value } }))}>
                  <option value="">Not set</option>
                  {textChannels.map((channel) => (
                    <option key={channel.id} value={channel.id}>
                      #{channel.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))", gap: 14, marginTop: 14 }}>
              <div>
                <div style={label}>Allowed Providers</div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 10 }}>
                  {PROVIDER_OPTIONS.map((provider) => (
                    <label key={provider.id} style={{ display: "block", border: "1px solid #500000", borderRadius: 10, padding: 10, color: "#ffdcdc" }}>
                      <div style={{ fontWeight: 800 }}>
                        <input type="checkbox" checked={cfg.sourcePolicy.allowedProviders.includes(provider.id)} onChange={() => setCfg((prev) => ({ ...prev, sourcePolicy: { ...prev.sourcePolicy, allowedProviders: toggle(prev.sourcePolicy.allowedProviders, provider.id) } }))} />{" "}
                        {provider.label}
                      </div>
                      <div style={{ fontSize: 12, color: "#ffb8b8", marginTop: 4 }}>{provider.hint}</div>
                    </label>
                  ))}
                </div>
              </div>
              {[
                ["requireHttps", "Require HTTPS"],
                ["normalizeLoudness", "Normalize Loudness"],
                ["enableDither", "Enable Dither"],
                ["enabled", "Ad-Safe Mode"],
                ["suppressPublicStatus", "Suppress Public Status"],
                ["rejectAdSupportedSources", "Reject Ad-Supported Sources"],
                ["strictSourceAllowlist", "Strict Source Allowlist"],
              ].map(([key, text]) => (
                <label key={key} style={{ display: "inline-flex", gap: 8, alignItems: "center", color: "#ffdcdc", fontWeight: 700 }}>
                  <input
                    type="checkbox"
                    checked={
                      key === "requireHttps" ? cfg.sourcePolicy.requireHttps :
                      key === "normalizeLoudness" ? cfg.audio.normalizeLoudness :
                      key === "enableDither" ? cfg.audio.enableDither :
                      Boolean(cfg.adSafeMode[key as keyof MusicCfg["adSafeMode"]])
                    }
                    onChange={(e) => {
                      const checked = e.target.checked;
                      if (key === "requireHttps") setCfg((prev) => ({ ...prev, sourcePolicy: { ...prev.sourcePolicy, requireHttps: checked } }));
                      else if (key === "normalizeLoudness") setCfg((prev) => ({ ...prev, audio: { ...prev.audio, normalizeLoudness: checked } }));
                      else if (key === "enableDither") setCfg((prev) => ({ ...prev, audio: { ...prev.audio, enableDither: checked } }));
                      else setCfg((prev) => ({ ...prev, adSafeMode: { ...prev.adSafeMode, [key]: checked } }));
                    }}
                  />
                  {text}
                </label>
              ))}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))", gap: 14, marginTop: 14 }}>
              <label style={{ display: "inline-flex", gap: 8, alignItems: "center", color: "#ffdcdc", fontWeight: 700 }}>
                <input type="checkbox" checked={cfg.ytDlp.enabled} onChange={(e) => setCfg((prev) => ({ ...prev, ytDlp: { ...prev.ytDlp, enabled: e.target.checked } }))} />
                Built-In Search Enabled
              </label>
              <div>
                <div style={label}>Built-In Search Provider</div>
                <select style={input} value={cfg.ytDlp.searchProvider} onChange={(e) => setCfg((prev) => ({ ...prev, ytDlp: { ...prev.ytDlp, searchProvider: e.target.value as "youtube" | "soundcloud" } }))}>
                  <option value="youtube">YouTube</option>
                  <option value="soundcloud">SoundCloud</option>
                </select>
              </div>
              <div>
                <div style={label}>Built-In Search Results</div>
                <input style={input} type="number" min={1} max={10} value={cfg.ytDlp.searchResultCount} onChange={(e) => setCfg((prev) => ({ ...prev, ytDlp: { ...prev.ytDlp, searchResultCount: Number(e.target.value || 1) } }))} />
              </div>
              <div>
                <div style={label}>yt-dlp Timeout (ms)</div>
                <input style={input} type="number" min={3000} max={60000} value={cfg.ytDlp.timeoutMs} onChange={(e) => setCfg((prev) => ({ ...prev, ytDlp: { ...prev.ytDlp, timeoutMs: Number(e.target.value || 3000) } }))} />
              </div>
              <div>
                <div style={label}>yt-dlp Binary Path</div>
                <input style={input} value={cfg.ytDlp.binaryPath} onChange={(e) => setCfg((prev) => ({ ...prev, ytDlp: { ...prev.ytDlp, binaryPath: e.target.value } }))} placeholder="/usr/local/bin/yt-dlp" />
              </div>
              <label style={{ display: "inline-flex", gap: 8, alignItems: "center", color: "#ffdcdc", fontWeight: 700 }}>
                <input type="checkbox" checked={cfg.searchProvider.enabled} onChange={(e) => setCfg((prev) => ({ ...prev, searchProvider: { ...prev.searchProvider, enabled: e.target.checked } }))} />
                Self-Hosted Search Enabled
              </label>
              <label style={{ display: "inline-flex", gap: 8, alignItems: "center", color: "#ffdcdc", fontWeight: 700 }}>
                <input type="checkbox" checked={cfg.ytDlp.allowMediaPageUrls} onChange={(e) => setCfg((prev) => ({ ...prev, ytDlp: { ...prev.ytDlp, allowMediaPageUrls: e.target.checked } }))} />
                Allow Media Page URLs
              </label>
              <div>
                <div style={label}>Search Endpoint URL</div>
                <input style={input} value={cfg.searchProvider.endpointUrl} onChange={(e) => setCfg((prev) => ({ ...prev, searchProvider: { ...prev.searchProvider, endpointUrl: e.target.value } }))} placeholder="https://your-host/api/search" />
              </div>
              <div>
                <div style={label}>Auth Header</div>
                <input style={input} value={cfg.searchProvider.authHeader} onChange={(e) => setCfg((prev) => ({ ...prev, searchProvider: { ...prev.searchProvider, authHeader: e.target.value } }))} />
              </div>
              <div>
                <div style={label}>Bearer Token</div>
                <input style={input} value={cfg.searchProvider.bearerToken} onChange={(e) => setCfg((prev) => ({ ...prev, searchProvider: { ...prev.searchProvider, bearerToken: e.target.value } }))} />
              </div>
              <div>
                <div style={label}>Query Param</div>
                <input style={input} value={cfg.searchProvider.queryParam} onChange={(e) => setCfg((prev) => ({ ...prev, searchProvider: { ...prev.searchProvider, queryParam: e.target.value } }))} />
              </div>
              <div>
                <div style={label}>Result Limit</div>
                <input style={input} type="number" min={1} max={25} value={cfg.searchProvider.resultLimit} onChange={(e) => setCfg((prev) => ({ ...prev, searchProvider: { ...prev.searchProvider, resultLimit: Number(e.target.value || 1) } }))} />
              </div>
              <div>
                <div style={label}>Timeout (ms)</div>
                <input style={input} type="number" min={1000} max={30000} value={cfg.searchProvider.timeoutMs} onChange={(e) => setCfg((prev) => ({ ...prev, searchProvider: { ...prev.searchProvider, timeoutMs: Number(e.target.value || 1000) } }))} />
              </div>
            </div>
            <div style={{ marginTop: 14, color: "#ffb8b8", lineHeight: 1.7 }}>
              Built-in search is the Rythm-style song-name lookup. If YouTube starts rate-limiting your VM, switch the built-in provider above to SoundCloud or keep using direct stream URLs and library aliases.
            </div>
          </section>

          <section style={box}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap", marginBottom: 10 }}>
              <div>
                <div style={{ color: "#ffb3b3", fontSize: 12, letterSpacing: "0.08em", textTransform: "uppercase" }}>Panel Deploy</div>
                <div style={{ color: "#ffb8b8", fontSize: 12, lineHeight: 1.6 }}>
                  Deploy a persistent music control board into the configured text channel. This is the shared public entry point for the per-route music setup.
                </div>
              </div>
              <button onClick={() => void runAction("deployPanel")} style={button} disabled={saving}>
                Deploy Music Panel
              </button>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))", gap: 14 }}>
              <div>
                <div style={label}>Panel State</div>
                <label style={{ display: "inline-flex", gap: 8, alignItems: "center", color: "#ffdcdc", fontWeight: 700 }}>
                  <input type="checkbox" checked={cfg.panelDeploy.enabled} onChange={(e) => setCfg((prev) => ({ ...prev, panelDeploy: { ...prev.panelDeploy, enabled: e.target.checked } }))} />
                  Enabled
                </label>
              </div>
              <div>
                <div style={label}>Deploy Channel</div>
                <select style={input} value={cfg.panelDeploy.channelId} onChange={(e) => setCfg((prev) => ({ ...prev, panelDeploy: { ...prev.panelDeploy, channelId: e.target.value } }))}>
                  <option value="">Not set</option>
                  {textChannels.map((channel) => (
                    <option key={channel.id} value={channel.id}>
                      #{channel.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <div style={label}>Panel Message ID</div>
                <input style={input} value={cfg.panelDeploy.messageId} onChange={(e) => setCfg((prev) => ({ ...prev, panelDeploy: { ...prev.panelDeploy, messageId: e.target.value } }))} />
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(320px,1fr))", gap: 14, marginTop: 14 }}>
              <div>
                <div style={label}>Panel Title</div>
                <input style={input} value={cfg.panelDeploy.title} onChange={(e) => setCfg((prev) => ({ ...prev, panelDeploy: { ...prev.panelDeploy, title: e.target.value } }))} />
              </div>
              <div>
                <div style={label}>Panel Banner URL</div>
                <input style={input} value={cfg.panelDeploy.bannerUrl} onChange={(e) => setCfg((prev) => ({ ...prev, panelDeploy: { ...prev.panelDeploy, bannerUrl: e.target.value } }))} placeholder="https://..." />
                <div style={{ marginTop: 8 }}>
                  <input type="file" accept="image/*" onChange={(e) => void uploadPanelBanner(e)} />
                </div>
              </div>
            </div>
            <div style={{ marginTop: 14 }}>
              <div style={label}>Panel Description</div>
              <textarea style={{ ...input, minHeight: 90 }} value={cfg.panelDeploy.description} onChange={(e) => setCfg((prev) => ({ ...prev, panelDeploy: { ...prev.panelDeploy, description: e.target.value } }))} />
            </div>
            <div style={{ marginTop: 14 }}>
              <div style={label}>Panel Footer</div>
              <input style={input} value={cfg.panelDeploy.footerText} onChange={(e) => setCfg((prev) => ({ ...prev, panelDeploy: { ...prev.panelDeploy, footerText: e.target.value } }))} />
            </div>
            <div style={{ marginTop: 14 }}>
              <label style={{ display: "inline-flex", gap: 8, alignItems: "center", color: "#ffdcdc", fontWeight: 700 }}>
                <input type="checkbox" checked={cfg.panelDeploy.showRouteSelector} onChange={(e) => setCfg((prev) => ({ ...prev, panelDeploy: { ...prev.panelDeploy, showRouteSelector: e.target.checked } }))} />
                Show live route selector and control buttons on the deployed panel
              </label>
            </div>
          </section>

          <section style={box}>
            <div style={{ color: "#ffb3b3", fontSize: 12, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 10 }}>DJ Access</div>
            <div style={{ maxHeight: 240, overflowY: "auto", border: "1px solid #500000", borderRadius: 10, padding: 10 }}>
              {roles.map((role) => (
                <label key={role.id} style={{ display: "block", marginBottom: 6, color: "#ffdcdc" }}>
                  <input type="checkbox" checked={cfg.djRoleIds.includes(role.id)} onChange={() => setCfg((prev) => ({ ...prev, djRoleIds: toggle(prev.djRoleIds, role.id) }))} /> @{role.name}
                </label>
              ))}
            </div>
          </section>

          <section style={box}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap", marginBottom: 10 }}>
              <div>
                <div style={{ color: "#ffb3b3", fontSize: 12, letterSpacing: "0.08em", textTransform: "uppercase" }}>Library Aliases</div>
                <div style={{ color: "#ffb8b8", fontSize: 12, lineHeight: 1.6 }}>Configured aliases can be queued by title or alias from source channels or <code>/music play</code>.</div>
              </div>
              <button onClick={() => setCfg((prev) => ({ ...prev, library: [...prev.library, newTrack(prev.library.length)] }))} style={button} disabled={saving}>
                Add Library Track
              </button>
            </div>
            {cfg.library.length ? (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(320px,1fr))", gap: 14 }}>
                {cfg.library.map((track, index) => (
                  <div key={`${track.id}_${index}`} style={{ border: "1px solid #460000", borderRadius: 12, padding: 14, background: "rgba(18,0,0,0.78)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", marginBottom: 10 }}>
                      <div style={{ color: "#ff5a5a", fontWeight: 900, textTransform: "uppercase", letterSpacing: "0.08em" }}>Track {index + 1}</div>
                      <button onClick={() => setCfg((prev) => ({ ...prev, library: prev.library.filter((_, trackIndex) => trackIndex !== index) }))} style={button} disabled={saving}>
                        Remove
                      </button>
                    </div>
                    <div style={label}>ID</div>
                    <input style={input} value={track.id} onChange={(e) => updateLibrary(index, { id: e.target.value })} />
                    <div style={{ ...label, marginTop: 12 }}>Title</div>
                    <input style={input} value={track.title} onChange={(e) => updateLibrary(index, { title: e.target.value })} />
                    <div style={{ ...label, marginTop: 12 }}>Artist</div>
                    <input style={input} value={track.artist} onChange={(e) => updateLibrary(index, { artist: e.target.value })} />
                    <div style={{ ...label, marginTop: 12 }}>Direct Audio URL</div>
                    <input style={input} value={track.url} onChange={(e) => updateLibrary(index, { url: e.target.value })} placeholder="https://..." />
                    <div style={{ ...label, marginTop: 12 }}>Aliases (comma-separated)</div>
                    <input style={input} value={track.aliases.join(", ")} onChange={(e) => updateLibrary(index, { aliases: aliases(e.target.value) })} />
                    <div style={{ ...label, marginTop: 12 }}>Artwork URL</div>
                    <input style={input} value={track.artworkUrl} onChange={(e) => updateLibrary(index, { artworkUrl: e.target.value })} placeholder="https://..." />
                    <div style={{ marginTop: 8 }}>
                      <input type="file" accept="image/*" onChange={(e) => void uploadLibraryArt(e, index)} />
                    </div>
                    {track.artworkUrl ? <div style={{ marginTop: 10, border: "1px solid #460000", borderRadius: 12, overflow: "hidden" }}><img src={track.artworkUrl} alt={track.title || `Track ${index + 1}`} style={{ width: "100%", display: "block", maxHeight: 160, objectFit: "cover" }} /></div> : null}
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ color: "#ffb8b8" }}>No local library tracks configured yet.</div>
            )}
          </section>

          <section style={box}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap", marginBottom: 10 }}>
              <div>
                <div style={{ color: "#ffb3b3", fontSize: 12, letterSpacing: "0.08em", textTransform: "uppercase" }}>Routes</div>
                <div style={{ color: "#ffb8b8", fontSize: 12, lineHeight: 1.6 }}>Each route is its own live session with its own queue, voice target, source capture, DJ access, and banner art.</div>
              </div>
              <button onClick={() => setCfg((prev) => ({ ...prev, routes: [...prev.routes, newRoute(prev.routes.length, prev)] }))} style={button} disabled={saving}>
                Add Route
              </button>
            </div>
            {cfg.routes.length ? cfg.routes.map((route, index) => (
              <div key={`${route.id}_${index}`} style={{ border: "1px solid #460000", borderRadius: 12, padding: 16, background: "rgba(18,0,0,0.78)", marginBottom: 14 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap", marginBottom: 12 }}>
                  <div style={{ color: "#ff5a5a", fontWeight: 900, textTransform: "uppercase", letterSpacing: "0.08em" }}>{route.name || `Route ${index + 1}`}</div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <button onClick={() => void runAction(`stopRoute:${route.id}`)} style={button} disabled={saving}>Stop Live Route</button>
                    <button onClick={() => setCfg((prev) => ({ ...prev, routes: prev.routes.filter((_, routeIndex) => routeIndex !== index) }))} style={button} disabled={saving}>Remove Route</button>
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))", gap: 14 }}>
                  <div>
                    <div style={label}>Route ID</div>
                    <input style={input} value={route.id} onChange={(e) => updateRoute(index, { id: e.target.value })} />
                  </div>
                  <div>
                    <div style={label}>Display Name</div>
                    <input style={input} value={route.name} onChange={(e) => updateRoute(index, { name: e.target.value })} />
                  </div>
                  <div>
                    <div style={label}>Target Voice Channel</div>
                    <select style={input} value={route.targetVoiceChannelId} onChange={(e) => updateRoute(index, { targetVoiceChannelId: e.target.value })}>
                      <option value="">Not set</option>
                      {voiceChannels.map((channel) => <option key={channel.id} value={channel.id}>{channel.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <div style={label}>Control Text Channel</div>
                    <select style={input} value={route.controlTextChannelId} onChange={(e) => updateRoute(index, { controlTextChannelId: e.target.value })}>
                      <option value="">Auto / source channel</option>
                      {textChannels.map((channel) => <option key={channel.id} value={channel.id}>#{channel.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <div style={label}>Default Volume</div>
                    <input style={input} type="number" min={1} max={200} value={route.defaultVolume} onChange={(e) => updateRoute(index, { defaultVolume: Number(e.target.value || 1) })} />
                  </div>
                  <div>
                    <div style={label}>Max Queue</div>
                    <input style={input} type="number" min={1} max={250} value={route.maxQueueSize} onChange={(e) => updateRoute(index, { maxQueueSize: Number(e.target.value || 1) })} />
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))", gap: 14, marginTop: 14 }}>
                  {[
                    ["enabled", "Route Enabled"],
                    ["allowSlashPlay", "Allow Slash Play"],
                    ["captureMessages", "Capture Source Messages"],
                    ["allowCrossProviderFallback", "Allow Cross-Provider Fallback"],
                  ].map(([key, text]) => (
                    <label key={key} style={{ display: "inline-flex", gap: 8, alignItems: "center", color: "#ffdcdc", fontWeight: 700 }}>
                      <input type="checkbox" checked={Boolean(route[key as keyof MusicRoute])} onChange={(e) => updateRoute(index, { [key]: e.target.checked } as Partial<MusicRoute>)} />
                      {text}
                    </label>
                  ))}
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(320px,1fr))", gap: 14, marginTop: 14 }}>
                  <div>
                    <div style={label}>Source Text Channels</div>
                    <div style={{ maxHeight: 220, overflowY: "auto", border: "1px solid #500000", borderRadius: 10, padding: 10 }}>
                      {textChannels.map((channel) => (
                        <label key={channel.id} style={{ display: "block", marginBottom: 6, color: "#ffdcdc" }}>
                          <input type="checkbox" checked={route.sourceTextChannelIds.includes(channel.id)} onChange={() => updateRoute(index, { sourceTextChannelIds: toggle(route.sourceTextChannelIds, channel.id) })} /> #{channel.name}
                        </label>
                      ))}
                    </div>
                  </div>
                  <div>
                    <div style={label}>Route DJ Roles</div>
                    <div style={{ maxHeight: 220, overflowY: "auto", border: "1px solid #500000", borderRadius: 10, padding: 10 }}>
                      {roles.map((role) => (
                        <label key={role.id} style={{ display: "block", marginBottom: 6, color: "#ffdcdc" }}>
                          <input type="checkbox" checked={route.djRoleIds.includes(role.id)} onChange={() => updateRoute(index, { djRoleIds: toggle(route.djRoleIds, role.id) })} /> @{role.name}
                        </label>
                      ))}
                    </div>
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))", gap: 14, marginTop: 14 }}>
                  <div>
                    <div style={label}>Allowed Providers</div>
                    <div style={{ border: "1px solid #500000", borderRadius: 10, padding: 10 }}>
                      {PROVIDER_OPTIONS.map((provider) => (
                        <label key={provider.id} style={{ display: "block", marginBottom: 6, color: "#ffdcdc" }}>
                          <input type="checkbox" checked={route.sourceProviders.includes(provider.id)} onChange={() => updateRoute(index, { sourceProviders: toggle(route.sourceProviders, provider.id) })} /> {provider.label}
                        </label>
                      ))}
                    </div>
                  </div>
                  <div>
                    <div style={label}>Route Banner URL</div>
                    <input style={input} value={route.bannerUrl} onChange={(e) => updateRoute(index, { bannerUrl: e.target.value })} placeholder="https://..." />
                    <div style={{ marginTop: 8 }}>
                      <input type="file" accept="image/*" onChange={(e) => void uploadRouteBanner(e, index)} />
                    </div>
                    {route.bannerUrl ? <div style={{ marginTop: 10, border: "1px solid #460000", borderRadius: 12, overflow: "hidden" }}><img src={route.bannerUrl} alt={route.name || route.id} style={{ width: "100%", display: "block", maxHeight: 160, objectFit: "cover" }} /></div> : null}
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 14, marginTop: 14 }}>
                  <div>
                    <div style={label}>Override Quality</div>
                    <select style={input} value={route.audioOverride.qualityPreset || cfg.audio.qualityPreset} onChange={(e) => updateRoute(index, { audioOverride: { ...route.audioOverride, qualityPreset: e.target.value } })}>
                      {QUALITY_PRESETS.map((preset) => <option key={preset} value={preset}>{preset}</option>)}
                    </select>
                  </div>
                  <div>
                    <div style={label}>Override Bitrate</div>
                    <input style={input} type="number" min={64} max={320} value={route.audioOverride.targetBitrateKbps ?? cfg.audio.targetBitrateKbps} onChange={(e) => updateRoute(index, { audioOverride: { ...route.audioOverride, targetBitrateKbps: Number(e.target.value || 64) } })} />
                  </div>
                  <div>
                    <div style={label}>Override Sample Rate</div>
                    <input style={input} type="number" min={22050} max={48000} value={route.audioOverride.sampleRateHz ?? cfg.audio.sampleRateHz} onChange={(e) => updateRoute(index, { audioOverride: { ...route.audioOverride, sampleRateHz: Number(e.target.value || 22050) } })} />
                  </div>
                  <div>
                    <div style={label}>Override Channels</div>
                    <select style={input} value={route.audioOverride.channels ?? cfg.audio.channels} onChange={(e) => updateRoute(index, { audioOverride: { ...route.audioOverride, channels: Number(e.target.value || 2) as 1 | 2 } })}>
                      <option value={1}>Mono</option>
                      <option value={2}>Stereo</option>
                    </select>
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))", gap: 14, marginTop: 14 }}>
                  {[
                    ["normalizeLoudness", "Normalize Loudness"],
                    ["enableDither", "Enable Dither"],
                  ].map(([key, text]) => (
                    <label key={key} style={{ display: "inline-flex", gap: 8, alignItems: "center", color: "#ffdcdc", fontWeight: 700 }}>
                      <input type="checkbox" checked={Boolean(route.audioOverride[key as keyof MusicRoute["audioOverride"]])} onChange={(e) => updateRoute(index, { audioOverride: { ...route.audioOverride, [key]: e.target.checked } })} />
                      {text}
                    </label>
                  ))}
                </div>

                <div style={{ marginTop: 14 }}>
                  <div style={label}>Route Notes</div>
                  <textarea style={{ ...input, minHeight: 90 }} value={route.notes} onChange={(e) => updateRoute(index, { notes: e.target.value })} />
                </div>
              </div>
            )) : <div style={{ color: "#ffb8b8" }}>No routes configured yet.</div>}
          </section>

          <section style={{ ...box, display: "flex", justifyContent: "space-between", gap: 14, alignItems: "center", flexWrap: "wrap" }}>
            <div style={{ color: "#ffb8b8", lineHeight: 1.6, maxWidth: 820 }}>
              Music stays free forever. This page writes directly into the bot engine config so route sessions, source capture, library aliases,
              and DJ rules stay per guild instead of sharing one global player. Use the availability control to enable or disable both the engine
              and the guild feature gate together.
            </div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button onClick={() => void runAction(musicActive ? "disable" : "enable")} disabled={saving} style={button}>
                {musicActive ? "Disable Music" : "Enable Music"}
              </button>
              <button onClick={() => void runAction("stopAll")} disabled={saving} style={button}>Stop All Sessions</button>
              <button onClick={() => void save()} disabled={saving} style={button}>{saving ? "Saving..." : "Save Music"}</button>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
