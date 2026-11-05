/* eslint-disable @next/next/no-img-element */
"use client";

import Link from "next/link";
import type { CSSProperties, ChangeEvent } from "react";
import { useMemo, useState } from "react";
import EngineInsights from "@/components/possum/EngineInsights";
import { useGuildEngineEditor } from "@/components/possum/useGuildEngineEditor";
import { buildDashboardHref } from "@/lib/dashboardContext";

type AvatarPreset = {
  url: string;
  label?: string;
};

type PersonaConfig = {
  enabled: boolean;
  guildNickname: string;
  botName: string;
  webhookName: string;
  webhookAvatarUrl: string;
  guildAvatarUrl: string;
  botAvatarUrl: string;
  avatarLibrary: AvatarPreset[];
  useWebhookPersona: boolean;
  customBotEnabled: boolean;
  dmAuthority: string;
  guildMessageAuthority: string;
  featureRouting: Record<string, string>;
  dmFeatureRouting: Record<string, string>;
  showSetupSupportText: boolean;
  setupSupportText: string;
  customBotNickname: string;
  customBotStatus: string;
  customBotActivityType: string;
  customBotActivityText: string;
  customBotClientId: string;
  customBotRedirectUri: string;
  customBotToken: string;
  customBotClientSecret: string;
  customBotHasToken: boolean;
  customBotHasClientSecret: boolean;
  customBotClearToken: boolean;
  customBotClearClientSecret: boolean;
  customBotIntentsConfirmed: boolean;
  customBotOauthGrantDisabledConfirmed: boolean;
  customBotRedirectConfiguredConfirmed: boolean;
  profileBannerUrl: string;
  activityType: string;
  activityText: string;
  status: string;
};

const DEFAULT_CFG: PersonaConfig = {
  enabled: true,
  guildNickname: "",
  botName: "",
  webhookName: "",
  webhookAvatarUrl: "",
  guildAvatarUrl: "",
  botAvatarUrl: "",
  avatarLibrary: [],
  useWebhookPersona: false,
  customBotEnabled: false,
  dmAuthority: "custom",
  guildMessageAuthority: "custom",
  featureRouting: {},
  dmFeatureRouting: {},
  showSetupSupportText: true,
  setupSupportText: "Need help with setup? Message the developer for direct setup assistance.",
  customBotNickname: "",
  customBotStatus: "",
  customBotActivityType: "LISTENING",
  customBotActivityText: "",
  customBotClientId: "",
  customBotRedirectUri: "",
  customBotToken: "",
  customBotClientSecret: "",
  customBotHasToken: false,
  customBotHasClientSecret: false,
  customBotClearToken: false,
  customBotClearClientSecret: false,
  customBotIntentsConfirmed: false,
  customBotOauthGrantDisabledConfirmed: false,
  customBotRedirectConfiguredConfirmed: false,
  profileBannerUrl: "",
  activityType: "LISTENING",
  activityText: "/help",
  status: "online",
};

const MAX_AVATAR_UPLOAD_BYTES = 2_000_000;

const GUILD_ROUTE_FEATURES: Array<{ key: string; label: string }> = [
  { key: "chat", label: "Chat replies (people talking to the bot)" },
  { key: "crew", label: "Crew posts and cards" },
  { key: "games", label: "Games, gamer cards and playtime" },
  { key: "birthdays", label: "Birthday and radio posts" },
  { key: "community", label: "Community studio and lookups" },
  { key: "moderation", label: "Moderation panels" },
];

const DM_ROUTE_FEATURES: Array<{ key: string; label: string }> = [
  { key: "giveaways", label: "Giveaway DMs" },
  { key: "moderation", label: "Moderation notice DMs" },
  { key: "onboarding", label: "Onboarding DMs" },
  { key: "verification", label: "Verification DMs" },
  { key: "progression", label: "Progression and achievement DMs" },
  { key: "loyalty", label: "Loyalty DMs" },
  { key: "crew", label: "Crew invite DMs" },
  { key: "games", label: "Game connect DMs" },
  { key: "birthdays", label: "Birthday DMs" },
  { key: "automation", label: "Automation DMs" },
  { key: "activity", label: "Activity warning DMs" },
  { key: "governance", label: "Governance DMs" },
  { key: "notices", label: "System notice DMs" },
];

function sanitizeRouting(raw: unknown, allowed: string[]): Record<string, string> {
  const output: Record<string, string> = {};
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return output;
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    const lane = String(value || "").trim().toLowerCase();
    if (allowed.includes(lane)) output[key] = lane;
  }
  return output;
}

function isImageSource(value: unknown) {
  const text = String(value || "").trim();
  return /^https?:\/\//i.test(text) || /^data:image\/[a-z0-9.+-]+;base64,/i.test(text);
}

function safePreviewUrl(value: unknown) {
  const text = String(value || "").trim();
  return isImageSource(text) ? text : "";
}

function normalizeAvatarLibrary(raw: unknown): AvatarPreset[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const output: AvatarPreset[] = [];
  for (const entry of raw) {
    const row = entry && typeof entry === "object" ? (entry as Record<string, unknown>) : {};
    const url = safePreviewUrl(row.url || row.imageUrl || "");
    if (!url) continue;
    const key = url.slice(0, 512).toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    output.push({
      url,
      label: String(row.label || row.name || "").trim().slice(0, 120),
    });
    if (output.length >= 24) break;
  }
  return output;
}

function sanitizeConfig(rawCfg: Partial<PersonaConfig> | null | undefined): PersonaConfig {
  const src = rawCfg && typeof rawCfg === "object" ? rawCfg : {};
  const liveBotAvatarUrl = String(src.botAvatarUrl ?? src.guildAvatarUrl ?? "");
  return {
    enabled: src.enabled !== false,
    guildNickname: String(src.guildNickname || ""),
    botName: String(src.botName || ""),
    webhookName: String(src.webhookName || ""),
    webhookAvatarUrl: String(src.webhookAvatarUrl || ""),
    guildAvatarUrl: liveBotAvatarUrl,
    botAvatarUrl: liveBotAvatarUrl,
    avatarLibrary: normalizeAvatarLibrary(src.avatarLibrary),
    useWebhookPersona: Boolean(src.useWebhookPersona),
    customBotEnabled: Boolean(src.customBotEnabled),
    dmAuthority: String(src.dmAuthority || "custom"),
    guildMessageAuthority: String(src.guildMessageAuthority || "custom"),
    featureRouting: sanitizeRouting(src.featureRouting, ["main", "webhook", "custom"]),
    dmFeatureRouting: sanitizeRouting(src.dmFeatureRouting, ["main", "custom"]),
    showSetupSupportText: src.showSetupSupportText !== false,
    setupSupportText: String(src.setupSupportText || "Need help with setup? Message the developer for direct setup assistance."),
    customBotNickname: String(src.customBotNickname || ""),
    customBotStatus: String(src.customBotStatus || ""),
    customBotActivityType: String(src.customBotActivityType || "LISTENING"),
    customBotActivityText: String(src.customBotActivityText || ""),
    customBotClientId: String(src.customBotClientId || ""),
    customBotRedirectUri: String(src.customBotRedirectUri || ""),
    customBotToken: String(src.customBotToken || ""),
    customBotClientSecret: String(src.customBotClientSecret || ""),
    customBotHasToken: Boolean(src.customBotHasToken),
    customBotHasClientSecret: Boolean(src.customBotHasClientSecret),
    customBotClearToken: Boolean(src.customBotClearToken),
    customBotClearClientSecret: Boolean(src.customBotClearClientSecret),
    customBotIntentsConfirmed: Boolean(src.customBotIntentsConfirmed),
    customBotOauthGrantDisabledConfirmed: Boolean(src.customBotOauthGrantDisabledConfirmed),
    customBotRedirectConfiguredConfirmed: Boolean(src.customBotRedirectConfiguredConfirmed),
    profileBannerUrl: String(src.profileBannerUrl || ""),
    activityType: String(src.activityType || "LISTENING"),
    activityText: String(src.activityText || "/help"),
    status: String(src.status || "online"),
  };
}

async function fileToDataUrl(file: File) {
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Image load failed."));
    reader.readAsDataURL(file);
  });
}

const wrap: CSSProperties = { color: "#ffd0d0", maxWidth: 1320 };
const card: CSSProperties = {
  border: "1px solid rgba(255,0,0,.36)",
  borderRadius: 12,
  padding: 14,
  background: "rgba(100,0,0,.10)",
  marginBottom: 12,
};
const input: CSSProperties = {
  width: "100%",
  background: "#0a0a0a",
  border: "1px solid rgba(255,0,0,.45)",
  color: "#ffd5d5",
  borderRadius: 8,
  padding: "12px 14px",
  fontSize: 15,
  lineHeight: 1.45,
  minHeight: 44,
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
};
const subAction: CSSProperties = {
  ...action,
  padding: "8px 10px",
  fontSize: 12,
};
const hint: CSSProperties = {
  color: "#ffb5b5",
  fontSize: 13,
  lineHeight: 1.7,
};

function previewName(cfg: PersonaConfig, botUser?: { globalName?: string; username?: string } | null) {
  return String(
    cfg.guildNickname ||
    cfg.botName ||
    botUser?.globalName ||
    botUser?.username ||
    "Possum"
  ).trim();
}

function extractRuntimeValue(rows: Array<{ title?: string; value?: string }>, title: string) {
  return rows.find((row) => String(row.title || "").trim().toLowerCase() === title.toLowerCase())?.value || "";
}

function buildMainBotPatch(cfg: PersonaConfig): Partial<PersonaConfig> {
  return {
    enabled: cfg.enabled,
    guildNickname: cfg.guildNickname,
    botName: cfg.botName,
    guildAvatarUrl: cfg.botAvatarUrl,
    botAvatarUrl: cfg.botAvatarUrl,
    profileBannerUrl: cfg.profileBannerUrl,
    activityType: cfg.activityType,
    activityText: cfg.activityText,
    status: cfg.status,
  };
}

function buildWebhookPatch(cfg: PersonaConfig): Partial<PersonaConfig> {
  return {
    enabled: cfg.enabled,
    useWebhookPersona: cfg.useWebhookPersona,
    webhookName: cfg.webhookName,
    webhookAvatarUrl: cfg.webhookAvatarUrl,
    avatarLibrary: cfg.avatarLibrary,
  };
}

function buildCustomBotPatch(cfg: PersonaConfig): Partial<PersonaConfig> {
  return {
    enabled: cfg.enabled,
    customBotEnabled: cfg.customBotEnabled,
    dmAuthority: cfg.dmAuthority,
    guildMessageAuthority: cfg.guildMessageAuthority,
    featureRouting: cfg.featureRouting,
    dmFeatureRouting: cfg.dmFeatureRouting,
    showSetupSupportText: cfg.showSetupSupportText,
    setupSupportText: cfg.setupSupportText,
    customBotNickname: cfg.customBotNickname,
    customBotStatus: cfg.customBotStatus,
    customBotActivityType: cfg.customBotActivityType,
    customBotActivityText: cfg.customBotActivityText,
    customBotClientId: cfg.customBotClientId,
    customBotRedirectUri: cfg.customBotRedirectUri,
    customBotToken: cfg.customBotToken,
    customBotClientSecret: cfg.customBotClientSecret,
    customBotClearToken: cfg.customBotClearToken,
    customBotClearClientSecret: cfg.customBotClearClientSecret,
    customBotIntentsConfirmed: cfg.customBotIntentsConfirmed,
    customBotOauthGrantDisabledConfirmed: cfg.customBotOauthGrantDisabledConfirmed,
    customBotRedirectConfiguredConfirmed: cfg.customBotRedirectConfiguredConfirmed,
  };
}

export default function BotPersonalizerClient() {
  const {
    guildId,
    guildName,
    config: rawCfg,
    setConfig: setCfg,
    botUser,
    summary,
    details,
    loading,
    saving,
    message,
    save,
    runAction,
  } = useGuildEngineEditor<PersonaConfig>("botPersonalizer", DEFAULT_CFG);

  const cfg = useMemo(() => sanitizeConfig(rawCfg), [rawCfg]);
  const possumAiHref = buildDashboardHref("/dashboard/ai/learning");
  const customBotRuntimeRows = Array.isArray((details as any)?.customBotRuntime) ? ((details as any).customBotRuntime as Array<{ title?: string; value?: string }>) : [];
  const standardPreviewName = String(cfg.guildNickname || botUser?.globalName || botUser?.username || "Possum").trim();
  const standardPreviewAvatar = safePreviewUrl(cfg.botAvatarUrl) || safePreviewUrl((botUser as any)?.avatarUrl || "");
  const webhookPreviewAvatar = safePreviewUrl(cfg.webhookAvatarUrl);
  const webhookPreviewName = String(cfg.webhookName || previewName(cfg, botUser) || "Possum").trim();
  const runtimeIdentity = extractRuntimeValue(customBotRuntimeRows, "Bot Identity");
  const runtimeState = extractRuntimeValue(customBotRuntimeRows, "Runtime State");
  const customBotPreviewName = String(cfg.customBotNickname || runtimeIdentity.split("(")[0] || "Custom Token Bot").trim();
  const [avatarPreviewFailedFor, setAvatarPreviewFailedFor] = useState("");
  const [mainAvatarPreviewFailedFor, setMainAvatarPreviewFailedFor] = useState("");
  const [avatarLibraryLabel, setAvatarLibraryLabel] = useState("");
  const [avatarLibraryMessage, setAvatarLibraryMessage] = useState("");
  const avatarPreviewFailed = Boolean(webhookPreviewAvatar && avatarPreviewFailedFor === webhookPreviewAvatar);
  const mainAvatarPreviewFailed = Boolean(cfg.botAvatarUrl && mainAvatarPreviewFailedFor === cfg.botAvatarUrl);
  const effectiveStandardPreviewAvatar = mainAvatarPreviewFailed ? safePreviewUrl((botUser as any)?.avatarUrl || "") : standardPreviewAvatar;
  const effectivePreviewAvatar = avatarPreviewFailed ? "" : webhookPreviewAvatar;

  function updateCfg(patch: Partial<PersonaConfig>) {
    setCfg((prev) => sanitizeConfig({ ...(prev || {}), ...patch }));
  }

  function setAvatarSource(url: string, notice: string) {
    updateCfg({ webhookAvatarUrl: url });
    setAvatarPreviewFailedFor("");
    setAvatarLibraryMessage(notice);
  }

  function setMainBotAvatarSource(url: string, notice: string) {
    updateCfg({ guildAvatarUrl: url, botAvatarUrl: url });
    setMainAvatarPreviewFailedFor("");
    setAvatarLibraryMessage(notice);
  }

  function setBothAvatarSources(url: string, notice: string) {
    updateCfg({ webhookAvatarUrl: url, guildAvatarUrl: url, botAvatarUrl: url });
    setAvatarPreviewFailedFor("");
    setMainAvatarPreviewFailedFor("");
    setAvatarLibraryMessage(notice);
  }

  function saveAvatarToLibrary(url: string, preferredLabel = "") {
    const source = safePreviewUrl(url);
    if (!source) {
      setAvatarLibraryMessage("Webhook avatar source must be an image URL or an uploaded image.");
      return;
    }
    setCfg((prev) => {
      const current = sanitizeConfig(prev);
      const existing = current.avatarLibrary.find((entry) => entry.url === source);
      const label = String(preferredLabel || avatarLibraryLabel || existing?.label || "").trim().slice(0, 120);
      return sanitizeConfig({
        ...current,
        webhookAvatarUrl: source,
        avatarLibrary: normalizeAvatarLibrary([
          { url: source, label },
          ...current.avatarLibrary.filter((entry) => entry.url !== source),
        ]),
      });
    });
    setAvatarLibraryLabel("");
    setAvatarPreviewFailedFor("");
    setAvatarLibraryMessage("Saved avatar added for this guild and selected for webhook replies.");
  }

  function removeSavedAvatar(url: string) {
    setCfg((prev) => {
      const current = sanitizeConfig(prev);
      return sanitizeConfig({
        ...current,
        webhookAvatarUrl: current.webhookAvatarUrl === url ? "" : current.webhookAvatarUrl,
        guildAvatarUrl: current.botAvatarUrl === url ? "" : current.botAvatarUrl,
        botAvatarUrl: current.botAvatarUrl === url ? "" : current.botAvatarUrl,
        avatarLibrary: current.avatarLibrary.filter((entry) => entry.url !== url),
      });
    });
    setAvatarLibraryMessage("Saved avatar removed.");
  }

  async function handleAvatarUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!String(file.type || "").toLowerCase().startsWith("image/")) {
      setAvatarLibraryMessage("Please upload an image file.");
      return;
    }
    if (file.size > MAX_AVATAR_UPLOAD_BYTES) {
      setAvatarLibraryMessage("Saved avatar upload is too large. Keep it under 2 MB.");
      return;
    }
    try {
      const dataUrl = await fileToDataUrl(file);
      const fileLabel = String(file.name || "").replace(/\.[^.]+$/, "");
      saveAvatarToLibrary(dataUrl, avatarLibraryLabel || fileLabel);
    } catch (err: any) {
      setAvatarLibraryMessage(err?.message || "Avatar upload failed.");
    }
  }

  async function saveGuildPersonalizer() {
    await save(cfg);
  }

  async function saveAndApplyMainBotIdentity() {
    const result = await runAction("applyProfile", {
      scope: "main",
      patch: buildMainBotPatch(cfg),
    });
    if (!result) return;
    setMainAvatarPreviewFailedFor("");
    setAvatarPreviewFailedFor("");
  }

  async function saveAndDeployWebhookIdentity() {
    const webhookPatch = sanitizeConfig({
      ...cfg,
      useWebhookPersona: true,
      guildMessageAuthority: "webhook",
    });
    const result = await runAction("applyProfile", {
      scope: "webhook",
      patch: buildWebhookPatch(webhookPatch),
    });
    if (!result) return;
    updateCfg({ useWebhookPersona: true, guildMessageAuthority: "webhook" });
    setAvatarPreviewFailedFor("");
  }

  async function saveAndDeployCustomBot() {
    const customPatch = sanitizeConfig({
      ...cfg,
      customBotEnabled: true,
      dmAuthority: "custom",
    });
    const result = await runAction("refreshCustomBot", {
      patch: buildCustomBotPatch(customPatch),
    });
    if (!result) return;
    updateCfg({ customBotEnabled: true, dmAuthority: "custom" });
  }

  if (!guildId) {
    return <div style={{ color: "#ff8585", padding: 20 }}>Missing guildId. Open from /guilds first.</div>;
  }

  return (
    <div style={wrap}>
      <div style={card}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
          <div>
            <h1 style={{ marginTop: 0, color: "#ff4a4a", letterSpacing: "0.12em", textTransform: "uppercase" }}>
              Bot Personalizer
            </h1>
            <div style={{ color: "#ff9f9f", marginBottom: 8 }}>Guild: {guildName || guildId}</div>
            <div style={{ color: "#ffb5b5", fontSize: 12, maxWidth: 760 }}>
              This page is <b>guild-scoped</b> and manages <b>three separate identity lanes</b>:
              <br />- Main Possum: the shared bot account, with an optional guild nickname and an optional live bot avatar override for this server
              <br />- Webhook lane: per-guild name/avatar styling for supported webhook-backed sends
              <br />- Custom Token Bot: an optional dedicated bot application for this guild, with its own real app identity plus optional guild nickname/presence overrides
              <br /><br />
              The standard bot lane, webhook lane, and custom token bot lane stay separate on purpose so they do not stomp each other.
              <br /><br />
              If you want both side by side, that is supported: save the custom token bot first, then choose runtime authority so DMs and guild sends are
              owned by the lane you actually want.
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button type="button" onClick={() => void saveAndApplyMainBotIdentity()} disabled={saving} style={action}>
              {saving ? "Applying..." : "Save + Apply Main Bot"}
            </button>
            <button type="button" onClick={() => void saveAndDeployWebhookIdentity()} disabled={saving} style={action}>
              {saving ? "Deploying..." : "Save + Deploy Webhook"}
            </button>
            <button type="button" onClick={() => void saveAndDeployCustomBot()} disabled={saving} style={action}>
              {saving ? "Deploying..." : "Save + Deploy Custom Bot"}
            </button>
            <button type="button" onClick={() => void saveGuildPersonalizer()} disabled={saving} style={action}>
              {saving ? "Saving..." : "Save Personalizer"}
            </button>
          </div>
        </div>
        {message ? <div style={{ color: "#ffd27a", marginTop: 10 }}>{message}</div> : null}
      </div>

      {loading ? <div style={card}>Loading bot personalization...</div> : null}

      {!loading ? (
        <>
          <EngineInsights summary={summary} details={details} />

          <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1.2fr) minmax(320px,0.8fr)", gap: 12 }}>
            <section style={card}>
              <h3 style={{ marginTop: 0, color: "#ff6666", letterSpacing: "0.08em", textTransform: "uppercase" }}>
                Basics
              </h3>
              <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginBottom: 12 }}>
                <label><input type="checkbox" checked={cfg.enabled} onChange={(e) => updateCfg({ enabled: e.target.checked })} /> Personalizer enabled</label>
                <label><input type="checkbox" checked={cfg.useWebhookPersona} onChange={(e) => updateCfg({ useWebhookPersona: e.target.checked })} /> Use webhook identity</label>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))", gap: 12 }}>
                <div>
                  <label>Main bot nickname in this guild</label>
                  <input
                    style={input}
                    value={cfg.guildNickname || ""}
                    onChange={(e) => updateCfg({ guildNickname: e.target.value })}
                    placeholder="Possum"
                  />
                </div>
                <div>
                  <label>Legacy fallback label</label>
                  <input
                    style={input}
                    value={cfg.botName || ""}
                    onChange={(e) => updateCfg({ botName: e.target.value })}
                    placeholder="Possum"
                  />
                </div>
                <div>
                  <label>Webhook chat name</label>
                  <input
                    style={input}
                    value={cfg.webhookName || ""}
                    onChange={(e) => updateCfg({ webhookName: e.target.value })}
                    placeholder="Possum"
                  />
                </div>
                <div>
                  <label>Webhook avatar source</label>
                  <input
                    style={input}
                    value={cfg.webhookAvatarUrl || ""}
                    onChange={(e) => updateCfg({ webhookAvatarUrl: e.target.value })}
                    placeholder="https://... or leave blank for no custom webhook avatar"
                  />
                </div>
                <div style={{ gridColumn: "1 / -1" }}>
                  <label>Live bot avatar override</label>
                  <input
                    style={input}
                    value={cfg.botAvatarUrl || ""}
                    onChange={(e) => updateCfg({ guildAvatarUrl: e.target.value, botAvatarUrl: e.target.value })}
                    placeholder="https://... or upload from the saved avatar library below"
                  />
                  <div style={{ ...hint, marginTop: 6 }}>
                    This affects only the Shared bot account avatar inside this guild. It does not change webhook replies, other servers, or DM avatar identity.
                  </div>
                </div>
              </div>

              <div style={{ ...card, marginBottom: 0, marginTop: 12, background: "rgba(20, 2, 2, 0.72)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
                  <div>
                    <div style={{ fontWeight: 900, color: "#ff8b8b", letterSpacing: "0.06em", textTransform: "uppercase" }}>
                      Optional Custom Bot Application
                    </div>
                    <div style={hint}>
                      Keep the shared Possum personalizer exactly as it is now, or add a dedicated Discord bot application for this guild if you want the final
                      layer: separate DM name/avatar identity like MEE6 custom bot mode.
                    </div>
                  </div>
                  <label style={{ fontWeight: 800 }}>
                    <input
                      type="checkbox"
                      checked={cfg.customBotEnabled}
                      onChange={(e) => updateCfg({ customBotEnabled: e.target.checked })}
                    />{" "}
                    Enable custom bot app
                  </label>
                </div>

                <div
                  style={{
                    marginTop: 12,
                    border: "1px solid rgba(255,0,0,.28)",
                    borderRadius: 12,
                    padding: 12,
                    background: "rgba(0,0,0,.28)",
                  }}
                >
                  <div style={{ fontWeight: 900, color: "#ffd0d0", marginBottom: 10 }}>
                    Set up your Possum Custom Bot
                  </div>
                  <div style={hint}>
                    This is optional. If you leave it off, the current shared-bot personalizer keeps working exactly like it does now.
                    If you turn it on, this guild can attach its own dedicated Discord bot application for full DM/server identity separation.
                    The saved setup stays with this guild, so if the companion bot leaves and you re-invite it later, you do not need to rebuild the page from scratch.
                  </div>

                  <div style={{ ...card, marginTop: 12, marginBottom: 0, background: "rgba(18, 0, 0, 0.78)" }}>
                    <div style={{ fontWeight: 900, color: "#ff8b8b", letterSpacing: "0.06em", textTransform: "uppercase" }}>
                      Runtime Authority
                    </div>
                    <div style={hint}>
                      Pick which runtime owns DMs and which runtime owns supported guild-channel sends. If you want branded DMs, set up the Custom Token Bot first,
                      then choose it as DM authority. If setup gets sticky, message the developer and setup help can be done with you directly.
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))", gap: 12, marginTop: 12 }}>
                      <div>
                        <label>DM authority</label>
                        <select
                          style={input}
                          value={cfg.dmAuthority || "custom"}
                          onChange={(e) => updateCfg({ dmAuthority: e.target.value })}
                        >
                          <option value="custom">Custom Token Bot</option>
                          <option value="main">Main Possum</option>
                        </select>
                        <div style={{ ...hint, marginTop: 6 }}>
                          DMs include onboarding, verification, giveaways, moderation notices, economy DMs, achievements DMs, progression DMs, and other private guild-routed sends.
                        </div>
                      </div>
                      <div>
                        <label>Guild message authority</label>
                        <select
                          style={input}
                          value={cfg.guildMessageAuthority || "custom"}
                          onChange={(e) => updateCfg({ guildMessageAuthority: e.target.value })}
                        >
                          <option value="custom">Custom Token Bot</option>
                          <option value="webhook">Shared Possum Webhook</option>
                          <option value="main">Main Possum</option>
                        </select>
                        <div style={{ ...hint, marginTop: 6 }}>
                          Use Shared Possum Webhook if you want the shared bot styling in channels but the custom token bot handling DMs.
                        </div>
                      </div>
                      <div style={{ gridColumn: "1 / -1" }}>
                        <label style={{ fontWeight: 800 }}>
                          <input
                            type="checkbox"
                            checked={cfg.showSetupSupportText}
                            onChange={(e) => updateCfg({ showSetupSupportText: e.target.checked })}
                          />{" "}
                          Show setup help note
                        </label>
                        <textarea
                          style={{ ...input, minHeight: 92, marginTop: 8, resize: "vertical" as const }}
                          value={cfg.setupSupportText || ""}
                          onChange={(e) => updateCfg({ setupSupportText: e.target.value })}
                          placeholder="Need help with setup? Message the developer for direct setup assistance."
                        />
                        <div style={{ ...hint, marginTop: 6 }}>
                          Guardrail: do not overlap onboarding, verification, security, economy, progression, moderation, or logging ownership across both bots. Pick one authority per protected system.
                        </div>
                      </div>
                      <div style={{ gridColumn: "1 / -1" }}>
                        <div style={{ fontWeight: 900, color: "#ff8b8b", letterSpacing: "0.06em", textTransform: "uppercase" }}>
                          Per-feature routing
                        </div>
                        <div style={hint}>
                          Send individual parts of Possum through a different identity. Each feature uses exactly one lane, and anything left on
                          &quot;Guild default&quot; follows the dropdowns above. If a lane is not set up, that feature falls back to Main Possum.
                        </div>
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))", gap: 12, marginTop: 10 }}>
                          {GUILD_ROUTE_FEATURES.map((feature) => (
                            <div key={`guild-${feature.key}`}>
                              <label>{feature.label}</label>
                              <select
                                style={input}
                                value={cfg.featureRouting[feature.key] || ""}
                                onChange={(e) => {
                                  const next = { ...cfg.featureRouting };
                                  if (e.target.value) next[feature.key] = e.target.value;
                                  else delete next[feature.key];
                                  updateCfg({ featureRouting: next });
                                }}
                              >
                                <option value="">Guild default</option>
                                <option value="main">Main Possum</option>
                                <option value="webhook">Shared Possum Webhook</option>
                                <option value="custom">Custom Token Bot</option>
                              </select>
                            </div>
                          ))}
                          {DM_ROUTE_FEATURES.map((feature) => (
                            <div key={`dm-${feature.key}`}>
                              <label>{feature.label}</label>
                              <select
                                style={input}
                                value={cfg.dmFeatureRouting[feature.key] || ""}
                                onChange={(e) => {
                                  const next = { ...cfg.dmFeatureRouting };
                                  if (e.target.value) next[feature.key] = e.target.value;
                                  else delete next[feature.key];
                                  updateCfg({ dmFeatureRouting: next });
                                }}
                              >
                                <option value="">DM default</option>
                                <option value="main">Main Possum</option>
                                <option value="custom">Custom Token Bot</option>
                              </select>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div style={{ ...card, marginTop: 12, marginBottom: 0, background: "rgba(18, 0, 0, 0.78)" }}>
                    <div style={{ fontWeight: 900, color: "#ff8b8b", letterSpacing: "0.06em", textTransform: "uppercase" }}>
                      Custom Bot Identity
                    </div>
                    <div style={hint}>
                      This lane is fully separate from the main Possum bot and the webhook lane. Leave these blank if you want the dedicated bot to keep its
                      own native app identity from Discord Developer Portal.
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))", gap: 12, marginTop: 12 }}>
                      <div>
                        <label>Custom bot nickname in this guild</label>
                        <input
                          style={input}
                          value={cfg.customBotNickname || ""}
                          onChange={(e) => updateCfg({ customBotNickname: e.target.value })}
                          placeholder="Leave blank to keep app default"
                        />
                      </div>
                      <div>
                        <label>Custom bot status</label>
                        <select
                          style={input}
                          value={cfg.customBotStatus || ""}
                          onChange={(e) => updateCfg({ customBotStatus: e.target.value })}
                        >
                          <option value="">Use app default</option>
                          <option value="online">online</option>
                          <option value="idle">idle</option>
                          <option value="dnd">dnd</option>
                          <option value="invisible">invisible</option>
                        </select>
                      </div>
                      <div>
                        <label>Custom bot activity type</label>
                        <select
                          style={input}
                          value={cfg.customBotActivityType || "LISTENING"}
                          onChange={(e) => updateCfg({ customBotActivityType: e.target.value })}
                        >
                          <option value="PLAYING">PLAYING</option>
                          <option value="LISTENING">LISTENING</option>
                          <option value="WATCHING">WATCHING</option>
                          <option value="COMPETING">COMPETING</option>
                          <option value="STREAMING">STREAMING</option>
                        </select>
                      </div>
                      <div>
                        <label>Custom bot activity text</label>
                        <input
                          style={input}
                          value={cfg.customBotActivityText || ""}
                          onChange={(e) => updateCfg({ customBotActivityText: e.target.value })}
                          placeholder="Leave blank to keep app default"
                        />
                      </div>
                    </div>
                    <div style={{ ...hint, marginTop: 8 }}>
                      The custom token bot keeps its own real avatar and app name. The only override here is the optional guild nickname and optional presence for that companion bot.
                    </div>
                  </div>

                  <div style={{ ...card, marginTop: 12, marginBottom: 0, background: "rgba(18, 0, 0, 0.78)" }}>
                    <div style={{ fontWeight: 900, color: "#ff8b8b", letterSpacing: "0.06em", textTransform: "uppercase" }}>
                      Custom Bot Health
                    </div>
                    <div style={hint}>
                      This panel shows whether the dedicated bot can actually log in, whether it is in the guild, and which fast fixes matter right now.
                    </div>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
                      <button
                        type="button"
                        style={subAction}
                        disabled={saving}
                        onClick={() => void runAction("startCustomBot")}
                      >
                        Start Check
                      </button>
                      <button
                        type="button"
                        style={subAction}
                        disabled={saving}
                        onClick={() => void runAction("refreshCustomBot")}
                      >
                        Refresh Runtime
                      </button>
                      <button
                        type="button"
                        style={subAction}
                        disabled={saving}
                        onClick={() => void runAction("stopCustomBot")}
                      >
                        Stop Runtime
                      </button>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 10, marginTop: 12 }}>
                      {customBotRuntimeRows.length ? customBotRuntimeRows.map((row, index) => (
                        <div
                          key={`${row.title || "runtime"}_${index}`}
                          style={{
                            border: "1px solid rgba(255,0,0,.24)",
                            borderRadius: 10,
                            padding: 12,
                            background: "rgba(0,0,0,.24)",
                          }}
                        >
                          <div style={{ color: "#ff9b9b", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.08em" }}>
                            {row.title || `State ${index + 1}`}
                          </div>
                          <div style={{ color: "#ffd7d7", fontSize: 13, lineHeight: 1.6, marginTop: 8 }}>
                            {row.value || "No runtime data yet."}
                          </div>
                        </div>
                      )) : (
                        <div style={{ ...hint, gridColumn: "1 / -1" }}>
                          No dedicated runtime data yet. Save the config, then run a start or refresh check.
                        </div>
                      )}
                    </div>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))", gap: 12, marginTop: 12 }}>
                    <label><input type="checkbox" checked={cfg.customBotIntentsConfirmed} onChange={(e) => updateCfg({ customBotIntentsConfirmed: e.target.checked })} /> Required intents are enabled: Presence, Server Members, Message Content</label>
                    <label><input type="checkbox" checked={cfg.customBotOauthGrantDisabledConfirmed} onChange={(e) => updateCfg({ customBotOauthGrantDisabledConfirmed: e.target.checked })} /> &quot;Requires OAuth2 Code Grant&quot; is disabled in the Discord Developer Portal</label>
                    <label><input type="checkbox" checked={cfg.customBotRedirectConfiguredConfirmed} onChange={(e) => updateCfg({ customBotRedirectConfiguredConfirmed: e.target.checked })} /> The correct redirect URI is added in OAuth2 settings</label>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))", gap: 12, marginTop: 12 }}>
                    <div>
                      <label>Custom bot client ID</label>
                      <input
                        style={input}
                        value={cfg.customBotClientId || ""}
                        onChange={(e) => updateCfg({ customBotClientId: e.target.value })}
                        placeholder="Discord application client ID"
                      />
                    </div>
                    <div>
                      <label>Custom bot redirect URI</label>
                      <input
                        style={input}
                        value={cfg.customBotRedirectUri || ""}
                        onChange={(e) => updateCfg({ customBotRedirectUri: e.target.value })}
                        placeholder="https://your-domain/api/auth/custom-bot/callback"
                      />
                    </div>
                    <div>
                      <label>Custom bot client secret</label>
                      <input
                        style={input}
                        type="password"
                        value={cfg.customBotClientSecret || ""}
                        onChange={(e) => updateCfg({ customBotClientSecret: e.target.value, customBotClearClientSecret: false })}
                        placeholder={cfg.customBotHasClientSecret ? "Stored securely. Enter a new secret to rotate it." : "Enter OAuth2 client secret"}
                      />
                      <div style={{ ...hint, marginTop: 6 }}>
                        {cfg.customBotHasClientSecret ? "A client secret is already stored securely for this guild." : "No client secret stored yet."}
                      </div>
                    </div>
                    <div>
                      <label>Custom bot token</label>
                      <input
                        style={input}
                        type="password"
                        value={cfg.customBotToken || ""}
                        onChange={(e) => updateCfg({ customBotToken: e.target.value, customBotClearToken: false })}
                        placeholder={cfg.customBotHasToken ? "Stored securely. Enter a new token to rotate it." : "Enter dedicated bot token"}
                      />
                      <div style={{ ...hint, marginTop: 6 }}>
                        {cfg.customBotHasToken ? "A bot token is already stored securely for this guild." : "No bot token stored yet."}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
                    <button
                      type="button"
                      style={subAction}
                      onClick={() => updateCfg({ customBotClearClientSecret: !cfg.customBotClearClientSecret, customBotClientSecret: "" })}
                    >
                      {cfg.customBotClearClientSecret ? "Client Secret Will Be Cleared" : "Clear Stored Client Secret"}
                    </button>
                    <button
                      type="button"
                      style={subAction}
                      onClick={() => updateCfg({ customBotClearToken: !cfg.customBotClearToken, customBotToken: "" })}
                    >
                      {cfg.customBotClearToken ? "Bot Token Will Be Cleared" : "Clear Stored Bot Token"}
                    </button>
                  </div>

                  <div style={{ ...hint, marginTop: 12 }}>
                    Stored credentials are kept out of the normal guild config payload and are not sent back to the dashboard after save. Blank fields do not
                    erase existing stored secrets unless you use the clear buttons above.
                  </div>
                </div>
              </div>

              <div style={{ ...card, marginBottom: 0, marginTop: 12, background: "rgba(22, 3, 3, 0.7)" }}>
                <div style={{ fontWeight: 900, color: "#ff8b8b", letterSpacing: "0.06em", textTransform: "uppercase" }}>
                  Main Possum Global Presence
                </div>
                <div style={hint}>
                  These controls belong only to the main Possum runtime. They never rename the custom token bot and they do not change webhook avatar styling.
                  The shared bot can now carry a guild-only avatar here without touching the webhook lane or the custom token bot lane.
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))", gap: 12, marginTop: 12 }}>
                  <div>
                    <label>Profile banner URL</label>
                    <input
                      style={input}
                      value={cfg.profileBannerUrl || ""}
                      onChange={(e) => updateCfg({ profileBannerUrl: e.target.value })}
                      placeholder="https://... optional shared bot banner"
                    />
                  </div>
                  <div>
                    <label>Main Possum status</label>
                    <select
                      style={input}
                      value={cfg.status || "online"}
                      onChange={(e) => updateCfg({ status: e.target.value })}
                    >
                      <option value="online">online</option>
                      <option value="idle">idle</option>
                      <option value="dnd">dnd</option>
                      <option value="invisible">invisible</option>
                    </select>
                  </div>
                  <div>
                    <label>Main Possum activity type</label>
                    <select
                      style={input}
                      value={cfg.activityType || "LISTENING"}
                      onChange={(e) => updateCfg({ activityType: e.target.value })}
                    >
                      <option value="PLAYING">PLAYING</option>
                      <option value="LISTENING">LISTENING</option>
                      <option value="WATCHING">WATCHING</option>
                      <option value="COMPETING">COMPETING</option>
                      <option value="STREAMING">STREAMING</option>
                    </select>
                  </div>
                  <div style={{ gridColumn: "1 / -1" }}>
                    <label>Main Possum activity text</label>
                    <input
                      style={input}
                      value={cfg.activityText || ""}
                      onChange={(e) => updateCfg({ activityText: e.target.value })}
                      placeholder="/help"
                    />
                  </div>
                </div>
              </div>

              <div style={{ ...card, marginBottom: 0, marginTop: 12, background: "rgba(25, 0, 0, 0.45)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
                  <div>
                    <div style={{ fontWeight: 900, color: "#ff8b8b", letterSpacing: "0.06em", textTransform: "uppercase" }}>
                      Saved Avatar Library
                    </div>
                    <div style={hint}>
                      Save per-guild avatar art here and reuse it instead of pasting links every time. Webhook replies use only these saved guild avatars
                      or the direct live bot avatar override above.
                      The shared bot account avatar can also use one of these saved avatars as a live guild override in this server.
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <button
                      type="button"
                      style={subAction}
                      onClick={() => {
                        updateCfg({ guildAvatarUrl: "", botAvatarUrl: "" });
                        setMainAvatarPreviewFailedFor("");
                        setAvatarLibraryMessage("Bot avatar override cleared. Save + Apply Main Bot to return this guild to the default shared avatar.");
                      }}
                    >
                      Clear Bot Avatar Override
                    </button>
                    <button
                      type="button"
                      style={subAction}
                      onClick={() => {
                        updateCfg({ webhookAvatarUrl: "" });
                        setAvatarPreviewFailedFor("");
                        setAvatarLibraryMessage("Webhook replies will clear the guild-specific avatar until you choose a custom source again.");
                      }}
                    >
                      Reset Webhook Avatar
                    </button>
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "minmax(220px,1fr) auto", gap: 12, marginTop: 12, alignItems: "end" }}>
                  <div>
                    <label>Saved avatar label</label>
                    <input
                      style={input}
                      value={avatarLibraryLabel}
                      onChange={(e) => setAvatarLibraryLabel(e.target.value)}
                      placeholder="Server default, Halloween, VIP, ..."
                    />
                  </div>
                  <button
                    type="button"
                    style={subAction}
                    onClick={() => saveAvatarToLibrary(cfg.webhookAvatarUrl)}
                  >
                    Save Current Source
                  </button>
                </div>

                <div style={{ marginTop: 12 }}>
                  <label>Upload saved avatar</label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(event) => void handleAvatarUpload(event)}
                    style={{ ...input, padding: 8 }}
                  />
                </div>

                {avatarLibraryMessage ? <div style={{ color: "#ffd27a", marginTop: 10 }}>{avatarLibraryMessage}</div> : null}

                <div style={{ marginTop: 14 }}>
                  <div style={{ fontWeight: 800, marginBottom: 8, color: "#ffb5b5" }}>
                    Saved avatars for {guildName || guildId}
                  </div>
                  {cfg.avatarLibrary.length ? (
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 12 }}>
                      {cfg.avatarLibrary.map((entry, index) => {
                        const selected = String(entry.url || "").trim() === String(cfg.webhookAvatarUrl || "").trim();
                        const src = safePreviewUrl(entry.url);
                        return (
                          <div
                            key={`${index}-${entry.label || "avatar"}`}
                            style={{
                              border: `1px solid ${selected ? "#ff7a7a" : "rgba(255,0,0,.28)"}`,
                              borderRadius: 12,
                              overflow: "hidden",
                              background: "rgba(18, 0, 0, 0.72)",
                            }}
                          >
                            <div style={{ aspectRatio: "1 / 1", background: "linear-gradient(135deg, #511111 0%, #160808 100%)" }}>
                              {src ? (
                                <img
                                  src={src}
                                  alt={entry.label || `Saved avatar ${index + 1}`}
                                  style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                                />
                              ) : null}
                            </div>
                            <div style={{ padding: 10 }}>
                              <div style={{ fontWeight: 800, color: "#ffe2e2" }}>{entry.label || `Saved Avatar ${index + 1}`}</div>
                              <div style={hint}>
                                {selected
                                  ? "Selected for webhook replies in this guild."
                                  : "Saved and ready to reuse."}
                              </div>
                              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
                                <button
                                  type="button"
                                  style={subAction}
                                  onClick={() => setMainBotAvatarSource(entry.url, "Saved avatar selected for the live bot avatar override in this guild. Use Save + Apply Main Bot to push it live.")}
                                >
                                  {String(entry.url || "").trim() === String(cfg.botAvatarUrl || "").trim() ? "Bot Selected" : "Use For Bot"}
                                </button>
                                <button
                                  type="button"
                                  style={subAction}
                                  onClick={() => setAvatarSource(entry.url, "Saved avatar selected for webhook replies.")}
                                >
                                  {selected ? "Webhook Selected" : "Use For Webhook"}
                                </button>
                                <button
                                  type="button"
                                  style={subAction}
                                  onClick={() => setBothAvatarSources(entry.url, "Saved avatar selected for both the live bot override and webhook replies.")}
                                >
                                  Use For Both
                                </button>
                                <button
                                  type="button"
                                  style={subAction}
                                  onClick={() => removeSavedAvatar(entry.url)}
                                >
                                  Remove
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div style={hint}>No saved avatars yet. Upload one or save the current chat avatar source.</div>
                  )}
                </div>
              </div>
            </section>

            <aside style={card}>
              <h3 style={{ marginTop: 0, color: "#ff6666", letterSpacing: "0.08em", textTransform: "uppercase" }}>
                Mode Preview
              </h3>
              <div style={{ display: "grid", gap: 12 }}>
                <div style={{ border: "1px solid #510000", borderRadius: 12, background: "#140909", padding: 14 }}>
                  <div style={{ color: "#ff9b9b", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.08em" }}>Bot Standard</div>
                  <div style={{ display: "flex", gap: 12, alignItems: "center", marginTop: 10 }}>
                    <div style={{ width: 58, height: 58, borderRadius: 999, overflow: "hidden", background: "linear-gradient(135deg, #661111 0%, #240000 100%)", display: "grid", placeItems: "center", flexShrink: 0 }}>
                      {effectiveStandardPreviewAvatar ? (
                        <img
                          src={effectiveStandardPreviewAvatar}
                          alt="Bot avatar preview"
                          referrerPolicy="no-referrer"
                          onError={() => {
                            if (cfg.botAvatarUrl && effectiveStandardPreviewAvatar === cfg.botAvatarUrl) {
                              setMainAvatarPreviewFailedFor(cfg.botAvatarUrl);
                            }
                          }}
                          style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                        />
                      ) : (
                        <span style={{ fontSize: 22, fontWeight: 900, color: "#ffd2d2" }}>{(standardPreviewName || "P").slice(0, 1).toUpperCase()}</span>
                      )}
                    </div>
                    <div>
                      <div style={{ fontSize: 20, fontWeight: 900 }}>{standardPreviewName}</div>
                      <div style={{ color: "#ffb5b5", fontSize: 12, marginTop: 6 }}>
                        {cfg.botAvatarUrl
                          ? "Main Possum will use this live bot avatar override in this server after you save and apply. Webhook replies still keep their own avatar lane."
                          : "Main Possum uses its default Shared bot account avatar here until you set a live bot avatar override above."}
                      </div>
                    </div>
                  </div>
                </div>

                <div style={{ border: "1px solid #510000", borderRadius: 12, background: "#140909", padding: 14 }}>
                  <div style={{ color: "#ff9b9b", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.08em" }}>Webhook Lane</div>
                  <div style={{ display: "flex", gap: 12, alignItems: "center", marginTop: 10 }}>
                    <div style={{ width: 58, height: 58, borderRadius: 999, overflow: "hidden", background: "linear-gradient(135deg, #661111 0%, #240000 100%)", display: "grid", placeItems: "center", flexShrink: 0 }}>
                      {effectivePreviewAvatar ? (
                        <img
                          src={effectivePreviewAvatar}
                          alt="Webhook avatar preview"
                          referrerPolicy="no-referrer"
                          onError={() => {
                            if (webhookPreviewAvatar && effectivePreviewAvatar === webhookPreviewAvatar) {
                              setAvatarPreviewFailedFor(webhookPreviewAvatar);
                            }
                          }}
                          style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                        />
                      ) : (
                        <span style={{ fontSize: 22, fontWeight: 900, color: "#ffd2d2" }}>{(webhookPreviewName || "W").slice(0, 1).toUpperCase()}</span>
                      )}
                    </div>
                    <div>
                      <div style={{ fontSize: 20, fontWeight: 900 }}>{webhookPreviewName}</div>
                      <div style={{ color: "#ffb5b5", fontSize: 12, marginTop: 6 }}>
                        {cfg.useWebhookPersona
                          ? effectivePreviewAvatar
                            ? "Webhook posts will use this guild-specific avatar where supported."
                            : "Webhook mode is on, but no guild-specific webhook avatar is set yet."
                          : "Webhook mode is off right now."}
                      </div>
                    </div>
                  </div>
                </div>

                <div style={{ border: "1px solid #510000", borderRadius: 12, background: "#140909", padding: 14 }}>
                  <div style={{ color: "#ff9b9b", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.08em" }}>Custom Token Bot</div>
                  <div style={{ display: "flex", gap: 12, alignItems: "center", marginTop: 10 }}>
                    <div style={{ width: 58, height: 58, borderRadius: 999, overflow: "hidden", background: "linear-gradient(135deg, #661111 0%, #240000 100%)", display: "grid", placeItems: "center", flexShrink: 0 }}>
                      <span style={{ fontSize: 22, fontWeight: 900, color: "#ffd2d2" }}>{(customBotPreviewName || "C").slice(0, 1).toUpperCase()}</span>
                    </div>
                    <div>
                      <div style={{ fontSize: 20, fontWeight: 900 }}>{customBotPreviewName || "Custom Token Bot"}</div>
                      <div style={{ color: "#ffb5b5", fontSize: 12, marginTop: 6 }}>
                        Uses the dedicated bot application&apos;s real avatar and app identity. Optional guild nickname/presence overrides live in the custom bot lane above.
                      </div>
                      <div style={{ color: "#ff9797", fontSize: 11, marginTop: 6 }}>
                        Runtime: {runtimeState || "No runtime data yet."}
                      </div>
                    </div>
                  </div>
                </div>

                {avatarPreviewFailed ? (
                  <div style={{ color: "#ffb0b0", fontSize: 11 }}>
                    The webhook preview image could not be loaded. Fix or replace the broken image link before applying.
                  </div>
                ) : null}
                {mainAvatarPreviewFailed ? (
                  <div style={{ color: "#ffb0b0", fontSize: 11 }}>
                    The live bot avatar preview could not be loaded. Fix or replace the broken image link before applying.
                  </div>
                ) : null}
              </div>
            </aside>
          </div>

          <section style={card}>
            <h3 style={{ marginTop: 0, color: "#ff6666", letterSpacing: "0.08em", textTransform: "uppercase" }}>
              Possum AI Link
            </h3>
            <div style={{ color: "#ffb5b5", fontSize: 12, maxWidth: 920 }}>
              Bot Personalizer handles the three delivery lanes above: main Possum nickname/presence, webhook identity, and the optional custom token bot.
              Possum AI stays focused on guild backstory, memory, and knowledge banks.
            </div>
            <div style={{ marginTop: 12 }}>
              <Link href={possumAiHref} style={{ ...action, textDecoration: "none" }}>
                Open Possum AI
              </Link>
            </div>
          </section>

          <section style={card}>
            <h3 style={{ marginTop: 0, color: "#ff6666", letterSpacing: "0.08em", textTransform: "uppercase" }}>
              Possum AI Backstory
            </h3>
            <div style={{ color: "#ffb5b5", fontSize: 12, maxWidth: 860, lineHeight: 1.7 }}>
              Guild backstory is no longer edited here. It belongs to the free Possum AI path so each server can tune its own adaptive identity without
              tying that behavior to Persona AI or paid provider controls.
            </div>
            <div style={{ marginTop: 12 }}>
              <Link href={possumAiHref} style={{ ...action, textDecoration: "none" }}>
                Edit Backstory In Possum AI
              </Link>
            </div>
          </section>
        </>
      ) : null}
    </div>
  );
}
