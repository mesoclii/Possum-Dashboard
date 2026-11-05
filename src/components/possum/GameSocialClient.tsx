"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { fetchGuildData, fetchRuntimeEngine, invalidateRuntimeEngines, resolveGuildContext, runRuntimeEngineAction, saveRuntimeEngine } from "@/lib/liveRuntime";

type EngineKey = "gameIdentity" | "privacyConsent" | "presenceFusion" | "playtime" | "squadFinder" | "gameProvider" | "showoff";
type RuntimeRow = Record<string, any>;
type EnginePayload = {
  config?: Record<string, any>;
  summary?: Array<{ label: string; value: string }>;
  details?: Record<string, any>;
  loadError?: string;
};
type GuildChannel = { id: string; name: string; type: number; parentId?: string | null; position?: number };
type GuildRole = { id: string; name: string; position?: number };
type Props = { guildId: string; guildName: string };

const card: CSSProperties = { border: "1px solid rgba(255,0,0,.35)", borderRadius: 12, padding: 14, background: "rgba(90,0,0,.10)", marginBottom: 12 };
const input: CSSProperties = { width: "100%", background: "#070707", border: "1px solid rgba(255,0,0,.45)", color: "#ffd3d3", borderRadius: 10, padding: "10px 12px" };
const button: CSSProperties = { ...input, width: "auto", fontWeight: 800, cursor: "pointer" };
const sectionTitle: CSSProperties = { marginTop: 0, color: "#ff6666", textTransform: "uppercase", letterSpacing: "0.08em" };
const lockedGroup: CSSProperties = { border: 0, padding: 0, margin: 0, minWidth: 0 };
const LINK_PROVIDERS = [
  { value: "apex", label: "Apex Legends" },
  { value: "battlenet", label: "Battle.net" },
  { value: "fortnite", label: "Fortnite" },
  { value: "cod", label: "Call of Duty" },
  { value: "wow", label: "World of Warcraft" },
  { value: "overwatch2", label: "Overwatch 2" },
  { value: "diablo4", label: "Diablo IV" },
  { value: "destiny2", label: "Destiny 2" },
  { value: "valorant", label: "VALORANT" },
  { value: "leagueoflegends", label: "League of Legends" },
  { value: "rocketleague", label: "Rocket League" },
  { value: "gtaonline", label: "GTA Online" },
  { value: "minecraft", label: "Minecraft" },
  { value: "steam", label: "Steam" },
  { value: "xbox", label: "Xbox" },
  { value: "playstation", label: "PlayStation" },
  { value: "nintendo", label: "Nintendo" },
  { value: "epic", label: "Epic Games" },
  { value: "activision", label: "Activision ID" },
  { value: "ea", label: "EA" },
  { value: "riot", label: "Riot" },
  { value: "bungie", label: "Bungie" },
  { value: "ubisoft", label: "Ubisoft Connect" },
  { value: "rockstar", label: "Rockstar Social Club" },
  { value: "custom", label: "Custom / Other" },
];
const STATS_PROVIDERS = LINK_PROVIDERS.filter((entry) => ["apex", "fortnite", "cod", "wow", "overwatch2", "diablo4", "destiny2", "valorant", "leagueoflegends", "rocketleague", "gtaonline", "minecraft", "custom"].includes(entry.value));
const MAP_PROVIDERS = LINK_PROVIDERS.filter((entry) => ["apex", "cod", "overwatch2"].includes(entry.value));
const ADAPTER_PROVIDERS = LINK_PROVIDERS.filter((entry) => ["apex", "fortnite", "cod", "steam", "epic", "xbox", "battlenet", "playstation", "rockstar", "wow", "overwatch2", "diablo4", "destiny2", "valorant", "leagueoflegends", "rocketleague", "gtaonline", "minecraft"].includes(entry.value));
const ROLE_SYNC_GAMES = [
  { key: "apex", label: "Apex Role Map", tiers: ["rookie", "bronze", "silver", "gold", "platinum", "diamond", "master", "predator"] },
  { key: "fortnite", label: "Fortnite Role Map", tiers: ["bronze", "silver", "gold", "platinum", "diamond", "elite", "champion", "unreal"] },
  { key: "cod", label: "CoD Role Map", tiers: ["bronze", "silver", "gold", "platinum", "diamond", "crimson", "iridescent", "top250"] },
  { key: "overwatch2", label: "Overwatch 2 Role Map", tiers: ["bronze", "silver", "gold", "platinum", "diamond", "master", "grandmaster", "champion"] },
  { key: "valorant", label: "VALORANT Role Map", tiers: ["iron", "bronze", "silver", "gold", "platinum", "diamond", "ascendant", "immortal", "radiant"] },
  { key: "leagueoflegends", label: "League Role Map", tiers: ["iron", "bronze", "silver", "gold", "platinum", "emerald", "diamond", "master", "grandmaster", "challenger"] },
  { key: "rocketleague", label: "Rocket League Role Map", tiers: ["bronze", "silver", "gold", "platinum", "diamond", "champion", "grandchampion", "supersoniclegend"] },
];
const TEXT_CHANNEL_TYPES = new Set([0, 5]);
const VISIBILITY = [{ value: "server", label: "Server" }, { value: "private", label: "Private" }, { value: "public", label: "Public" }];
const PLATFORMS = [{ value: "", label: "Any / Unspecified" }, { value: "pc", label: "PC" }, { value: "xbox", label: "Xbox" }, { value: "playstation", label: "PlayStation" }, { value: "switch", label: "Switch" }, { value: "mobile", label: "Mobile" }];
const SOURCES = [{ value: "manual", label: "Manual" }, { value: "estimate", label: "Estimate" }, { value: "public_profile", label: "Public Profile" }, { value: "provider_api", label: "Provider API" }, { value: "staff_verified", label: "Staff Verified" }, { value: "session_verified", label: "Session Verified" }];
const EMPTY_PRIVACY = { shareLinkedIdentities: true, sharePresence: true, shareStats: true, sharePlaytime: true, shareSquads: true, allowShowoffCard: true, allowProviderSync: true, allowRankRoleSync: true, notifyRankChanges: true, notifyLiveFriends: false, watchlistUserIds: [] as string[] };

function normalizePayload(json: any): EnginePayload {
  return { config: json?.config || {}, summary: Array.isArray(json?.summary) ? json.summary : [], details: json?.details && typeof json.details === "object" ? json.details : {} };
}
function getValue(payload: EnginePayload | null | undefined, path: string[], fallback: any) {
  let current: any = payload?.config || {};
  for (const key of path) {
    if (!current || typeof current !== "object") return fallback;
    current = current[key];
  }
  return current === undefined ? fallback : current;
}
function summaryValue(summary: Array<{ label: string; value: string }> | undefined, label: string, fallback = "0") {
  return summary?.find((entry) => entry.label === label)?.value || fallback;
}
function listRows(value: any): RuntimeRow[] { return Array.isArray(value) ? value : []; }
function parseOptionalNumber(value: string) { const parsed = Number(String(value || "").trim()); return Number.isFinite(parsed) ? parsed : undefined; }
function formatRoleMap(value: any) { return Object.entries(value && typeof value === "object" ? value : {}).map(([tier, roleId]) => `${tier}:${roleId || ""}`).join("\n"); }
function parseRoleMap(value: string) { const out: Record<string, string> = {}; for (const line of String(value || "").split(/\r?\n/)) { const [tier, roleId] = line.split(":").map((entry) => String(entry || "").trim()); if (tier) out[tier] = roleId || ""; } return out; }
function parseIdList(value: string) { return [...new Set(String(value || "").split(/[\s,]+/).map((entry) => entry.trim()).filter(Boolean))]; }
function formatIdList(value: any) { return Array.isArray(value) ? value.join(", ") : ""; }
function toggleProviderList(current: string[], value: string) { return current.includes(value) ? current.filter((entry) => entry !== value) : [...current, value]; }
function runtimeCard(label: string, value: string) { return <div style={card}><div style={{ fontSize: 11, textTransform: "uppercase", color: "#ffadad" }}>{label}</div><div style={{ fontSize: 22, fontWeight: 900 }}>{value}</div></div>; }
function channelSupportsMessages(channel: GuildChannel) { return TEXT_CHANNEL_TYPES.has(Number(channel?.type)); }
function formatChannelLabel(channel: GuildChannel, channels: GuildChannel[]) {
  const parent = channel.parentId ? channels.find((entry) => entry.id === channel.parentId) : null;
  return parent?.name ? `${parent.name} / #${channel.name}` : `#${channel.name}`;
}

export default function GameSocialClient({ guildId, guildName }: Props) {
  const context = useMemo(() => resolveGuildContext(), []);
  const viewerUserId = context.userId;
  const [engines, setEngines] = useState<Record<EngineKey, EnginePayload>>({ gameIdentity: {}, privacyConsent: {}, presenceFusion: {}, playtime: {}, squadFinder: {}, gameProvider: {}, showoff: {} });
  const [channels, setChannels] = useState<GuildChannel[]>([]);
  const [roles, setRoles] = useState<GuildRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [loadWarnings, setLoadWarnings] = useState<string[]>([]);
  const [identityForm, setIdentityForm] = useState({ userId: viewerUserId || "", providerKey: "apex", handle: "", platform: "", accountId: "", visibility: "server" });
  const [verificationForm, setVerificationForm] = useState({ userId: viewerUserId || "", providerKey: "apex", platform: "", proofText: "", proofToken: "" });
  const [selfPrivacy, setSelfPrivacy] = useState<any>(EMPTY_PRIVACY);
  const [playtimeForm, setPlaytimeForm] = useState({ userId: viewerUserId || "", game: "", platform: "", providerKey: "", hours: "", sourceKey: "provider_api", notes: "", evidenceUrl: "" });
  const [statsForm, setStatsForm] = useState({ userId: viewerUserId || "", providerKey: "apex", platform: "", rankTier: "", rankLabel: "", rating: "", kills: "", wins: "", kd: "", matches: "", currentMode: "", currentMap: "", sourceKey: "manual" });
  const [mapForm, setMapForm] = useState({ providerKey: "apex", mode: "", currentMap: "", nextMap: "", expiresInMinutes: "", sourceKey: "manual" });
  const [rankSyncForm, setRankSyncForm] = useState({ userId: viewerUserId || "", gameKey: "" });
  const [refreshForm, setRefreshForm] = useState({ userId: viewerUserId || "", providerKey: "apex", platform: "" });

  const loadAll = useCallback(async (targetGuildId: string, quiet = false) => {
    if (!targetGuildId) return;
    try {
      if (!quiet) { setLoading(true); setMessage(""); }
      setLoadWarnings([]);
      const engineKeys: EngineKey[] = ["gameIdentity", "privacyConsent", "presenceFusion", "playtime", "squadFinder", "gameProvider", "showoff"];
      invalidateRuntimeEngines(targetGuildId, engineKeys);
      const results = await Promise.all(engineKeys.map(async (engine) => {
        try {
          return [engine, normalizePayload(await fetchRuntimeEngine(targetGuildId, engine, viewerUserId))] as const;
        } catch (error: any) {
          return [engine, { loadError: error?.message || "Engine settings could not be loaded." }] as const;
        }
      }));
      let guildData: any = {};
      let guildDataError = "";
      try {
        guildData = await fetchGuildData(targetGuildId, viewerUserId);
      } catch (error: any) {
        guildDataError = error?.message || "Discord roles and channels could not be loaded.";
      }
      const next = Object.fromEntries(results) as Record<EngineKey, EnginePayload>;
      const warnings = results
        .filter(([, payload]) => payload.loadError)
        .map(([engine, payload]) => `${engine}: ${payload.loadError}`);
      if (guildDataError) warnings.push(`Guild data: ${guildDataError}`);
      const safeGuildData = (guildData && typeof guildData === "object" ? guildData : {}) as { channels?: GuildChannel[]; roles?: GuildRole[] };
      setEngines(next);
      setChannels(Array.isArray(safeGuildData.channels) ? safeGuildData.channels : []);
      setRoles(Array.isArray(safeGuildData.roles) ? safeGuildData.roles : []);
      setLoadWarnings(warnings);
      const memberState = next.privacyConsent.details?.memberSelfService || next.gameIdentity.details?.memberSelfService || null;
      if (memberState?.privacy) setSelfPrivacy({ ...EMPTY_PRIVACY, ...memberState.privacy, watchlistUserIds: Array.isArray(memberState.privacy.watchlistUserIds) ? memberState.privacy.watchlistUserIds : [] });
    } catch (err: any) {
      setMessage(err?.message || "Failed to load game engines.");
    } finally {
      setLoading(false);
    }
  }, [viewerUserId]);

  useEffect(() => { void loadAll(guildId); }, [guildId, loadAll]);
  useEffect(() => {
    if (!viewerUserId) return;
    setIdentityForm((prev) => ({ ...prev, userId: prev.userId || viewerUserId }));
    setVerificationForm((prev) => ({ ...prev, userId: prev.userId || viewerUserId }));
    setPlaytimeForm((prev) => ({ ...prev, userId: prev.userId || viewerUserId }));
    setStatsForm((prev) => ({ ...prev, userId: prev.userId || viewerUserId }));
    setRankSyncForm((prev) => ({ ...prev, userId: prev.userId || viewerUserId }));
    setRefreshForm((prev) => ({ ...prev, userId: prev.userId || viewerUserId }));
  }, [viewerUserId]);

  function updateConfig(engine: EngineKey, patch: Record<string, unknown>) { if (engines[engine].loadError) { setMessage(`Reload ${engine} before editing its settings.`); return; } setEngines((prev) => ({ ...prev, [engine]: { ...prev[engine], config: { ...(prev[engine].config || {}), ...patch } } })); }
  async function saveConfig(engine: EngineKey, patch: Record<string, unknown>, okLabel: string) { if (engines[engine].loadError) { setMessage(`Reload ${engine} before saving its settings.`); return; } try { setSaving(true); setMessage(""); const json = await saveRuntimeEngine(guildId, engine, patch, viewerUserId); setEngines((prev) => ({ ...prev, [engine]: normalizePayload(json) })); setMessage(okLabel); } catch (err: any) { setMessage(err?.message || "Save failed."); } finally { setSaving(false); } }
  async function runAction(engine: EngineKey, action: string, payload: Record<string, unknown>, okLabel: string) { if (engines[engine].loadError) { setMessage(`Reload ${engine} before running actions.`); return; } try { setSaving(true); setMessage(""); const result: any = await runRuntimeEngineAction(guildId, engine, action, payload, viewerUserId); await loadAll(guildId, true); setMessage(result?.result?.ok === false ? `Not applied: ${String(result.result.reason || result.result.error || "action declined").replace(/_/g, " ")}.` : okLabel); } catch (err: any) { setMessage(err?.message || "Action failed."); } finally { setSaving(false); } }
  const identitySummary = useMemo(() => engines.gameIdentity.summary || [], [engines.gameIdentity]);
  const privacySummary = useMemo(() => engines.privacyConsent.summary || [], [engines.privacyConsent]);
  const presenceSummary = useMemo(() => engines.presenceFusion.summary || [], [engines.presenceFusion]);
  const playtimeSummary = useMemo(() => engines.playtime.summary || [], [engines.playtime]);
  const squadSummary = useMemo(() => engines.squadFinder.summary || [], [engines.squadFinder]);
  const providerSummary = useMemo(() => engines.gameProvider.summary || [], [engines.gameProvider]);
  const showoffSummary = useMemo(() => engines.showoff.summary || [], [engines.showoff]);
  const linkedProfiles = listRows(engines.gameIdentity.details?.linkedProfiles);
  const pendingVerifications = listRows(engines.gameIdentity.details?.pendingVerifications);
  const livePlayers = listRows(engines.presenceFusion.details?.livePlayers);
  const playtimeLeaders = listRows(engines.playtime.details?.leaders);
  const playtimeRecords = listRows(engines.playtime.details?.records);
  const playtimeClaims = listRows(engines.playtime.details?.claims);
  const statRows = listRows(engines.gameProvider.details?.stats);
  const mapRows = listRows(engines.gameProvider.details?.mapRotations);
  const providerCapabilities = listRows(engines.gameProvider.details?.capabilities);
  const launcherReadiness = listRows(engines.gameProvider.details?.launcherReadiness);
  const providerHealth = listRows(engines.gameProvider.details?.syncHealth);
  const authProviders = listRows(engines.gameIdentity.details?.authProviders);
  const showoffRows = listRows(engines.showoff.details?.previews);
  const squadRows = listRows(engines.squadFinder.details?.activeSquads);
  const memberState = engines.privacyConsent.details?.memberSelfService || engines.gameIdentity.details?.memberSelfService || null;
  const viewerScope = String(engines.gameIdentity.details?.viewerScope || engines.playtime.details?.viewerScope || "admin");
  const canManageGaming = viewerScope === "admin";
  const myIdentities = listRows(memberState?.identities);
  const myPendingVerifications = listRows(memberState?.pendingVerifications);
  const myNotifications = listRows(memberState?.notifications);
  const messageChannels = useMemo(() => channels.filter((entry) => channelSupportsMessages(entry)), [channels]);
  const sortedRoles = useMemo(() => [...roles].sort((a, b) => Number(b.position || 0) - Number(a.position || 0) || a.name.localeCompare(b.name)), [roles]);
  const identityAuthIndex = useMemo(() => new Map(myIdentities.map((entry) => [entry.providerKey, entry])), [myIdentities]);
  const currentAuthProvider = useMemo(() => authProviders.find((entry) => entry.key === identityForm.providerKey) || null, [authProviders, identityForm.providerKey]);
  const buildConnectHref = useCallback((providerKey: string, platform = "") => {
    if (!guildId || !viewerUserId) return "";
    const params = new URLSearchParams();
    params.set("guildId", guildId);
    params.set("provider", providerKey);
    params.set("userId", viewerUserId);
    if (platform) params.set("platform", platform);
    return `/api/games/auth/start?${params.toString()}`;
  }, [guildId, viewerUserId]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const providerAuth = String(params.get("providerAuth") || "").trim();
    if (!providerAuth) return;
    const provider = String(params.get("provider") || "").trim();
    const authMessage = String(params.get("authMessage") || "").trim();
    setMessage(authMessage || (providerAuth === "success" ? `${provider || "Provider"} linked successfully.` : `${provider || "Provider"} login failed.`));
    params.delete("providerAuth");
    params.delete("provider");
    params.delete("authMessage");
    const nextUrl = `${window.location.pathname}${params.toString() ? `?${params.toString()}` : ""}${window.location.hash || ""}`;
    window.history.replaceState({}, "", nextUrl);
  }, []);

  return (
    <div style={{ ...card, marginBottom: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        <div>
          <div style={{ fontSize: 24, letterSpacing: "0.16em", textTransform: "uppercase", fontWeight: 900, color: "#ff2f2f" }}>Gaming Hub</div>
          <div style={{ color: "#ff9e9e", marginTop: 4 }}>Guild: {guildName || guildId}</div>
          <div style={{ color: "#ffb7b7", fontSize: 12, marginTop: 8 }}>This stack now covers provider sync, ownership verification, privacy + consent, rank automation, gamer cards, and squad finder.</div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))", gap: 8 }}>
          {runtimeCard("Linked", summaryValue(identitySummary, "Linked Accounts"))}
          {runtimeCard("Verified", summaryValue(identitySummary, "Verified"))}
          {runtimeCard("Privacy", summaryValue(privacySummary, "Profiles"))}
          {runtimeCard("Live", summaryValue(presenceSummary, "Live Players"))}
          {runtimeCard("Hours", summaryValue(playtimeSummary, "Total Hours"))}
          {runtimeCard("Squads", summaryValue(squadSummary, "Open Squads"))}
          {runtimeCard("Stats", summaryValue(providerSummary, "Stats Records"))}
          {runtimeCard("Card", summaryValue(showoffSummary, "Active", "Enabled"))}
        </div>
      </div>
      {message ? <div style={{ marginTop: 10, color: "#ffd27a" }}>{message}</div> : null}
      {loadWarnings.length ? (
        <div role="alert" style={{ ...card, borderColor: "rgba(255,210,122,.45)", color: "#ffd27a" }}>
          Some Gaming Hub data could not be loaded. Failed engines are isolated and cannot be edited or saved until reloaded.
          <ul style={{ marginBottom: 8 }}>{loadWarnings.map((warning) => <li key={warning}>{warning}</li>)}</ul>
          <button type="button" style={button} disabled={loading} onClick={() => void loadAll(guildId)}>Retry loading</button>
        </div>
      ) : null}
      {loading ? <div style={{ marginTop: 10, color: "#ffb7b7" }}>Loading game social engines...</div> : null}
      {!loading ? (
        <>
          <div style={card}>
            <h3 style={sectionTitle}>Member Self-Service</h3>
            <div style={{ color: "#ffb7b7", fontSize: 12, marginBottom: 12 }}>Link your own accounts, request verification, control privacy + consent, and clear your gamer alerts without staff typing raw IDs for you.</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,260px),1fr))", gap: 12 }}>
              <div style={card}>
                <div style={{ fontWeight: 800, marginBottom: 8 }}>My Linked Identity</div>
                <div style={{ display: "grid", gap: 8 }}>
                  <input style={input} value={identityForm.userId} readOnly />
                  <select style={input} value={identityForm.providerKey} onChange={(event) => setIdentityForm((prev) => ({ ...prev, providerKey: event.target.value }))}>{LINK_PROVIDERS.map((entry) => <option key={entry.value} value={entry.value}>{entry.label}</option>)}</select>
                  <input style={input} placeholder="Gamertag / handle" value={identityForm.handle} onChange={(event) => setIdentityForm((prev) => ({ ...prev, handle: event.target.value }))} />
                  <select style={input} value={identityForm.platform} onChange={(event) => setIdentityForm((prev) => ({ ...prev, platform: event.target.value }))}>{PLATFORMS.map((entry) => <option key={entry.value || "any"} value={entry.value}>{entry.label}</option>)}</select>
                  <input style={input} placeholder="Account ID / UID" value={identityForm.accountId} onChange={(event) => setIdentityForm((prev) => ({ ...prev, accountId: event.target.value }))} />
                  <select style={input} value={identityForm.visibility} onChange={(event) => setIdentityForm((prev) => ({ ...prev, visibility: event.target.value }))}>{VISIBILITY.map((entry) => <option key={entry.value} value={entry.value}>{entry.label}</option>)}</select>
                </div>
                <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
                  <button type="button" style={button} disabled={saving} onClick={() => void runAction("gameIdentity", "upsertIdentity", identityForm, "Saved your linked identity.")}>Save My Link</button>
                  <button type="button" style={button} disabled={saving} onClick={() => void runAction("gameIdentity", "removeIdentity", identityForm, "Removed your linked identity.")}>Remove My Link</button>
                  <button type="button" style={button} disabled={saving} onClick={() => void runAction("gameIdentity", "requestVerification", identityForm, "Verification challenge created.")}>Start Verification</button>
                </div>
                <div style={{ marginTop: 12, display: "grid", gap: 8 }}>
                  <div style={{ fontWeight: 800 }}>Provider Login Buttons</div>
                  <div style={{ color: "#ffb3b3", fontSize: 12 }}>
                    Use these when you want button-based login instead of typing handles manually. Steam is live through OpenID. The other providers turn live as soon as their auth env is configured.
                  </div>
                  {currentAuthProvider ? (
                    <div style={{ ...card, marginBottom: 0 }}>
                      <div style={{ fontWeight: 700 }}>{currentAuthProvider.title}</div>
                      <div style={{ color: "#ffb3b3", fontSize: 12, marginTop: 4 }}>{currentAuthProvider.value}</div>
                      <div style={{ color: "#ffb3b3", fontSize: 12, marginTop: 4 }}>
                        {identityAuthIndex.get(identityForm.providerKey)
                          ? `Connected as ${identityAuthIndex.get(identityForm.providerKey)?.handle || "linked account"}`
                          : "No linked account through provider login yet."}
                      </div>
                      <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
                        {currentAuthProvider.ready && viewerUserId ? (
                          <a href={buildConnectHref(identityForm.providerKey, identityForm.platform)} style={{ ...button, textDecoration: "none", textAlign: "center" }}>
                            Connect with {currentAuthProvider.title}
                          </a>
                        ) : (
                          <button type="button" style={button} disabled>
                            Connect unavailable
                          </button>
                        )}
                      </div>
                    </div>
                  ) : null}
                  <div style={{ display: "grid", gap: 8 }}>
                    {authProviders.length ? authProviders.map((entry) => {
                      const linked = identityAuthIndex.get(entry.key);
                      return (
                        <div key={entry.key} style={{ ...card, marginBottom: 0 }}>
                          <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                            <div>
                              <div style={{ fontWeight: 700 }}>{entry.title}</div>
                              <div style={{ color: "#ffb3b3", fontSize: 12 }}>{entry.value}</div>
                              <div style={{ color: "#ffb3b3", fontSize: 12, marginTop: 4 }}>{linked ? `Connected as ${linked.handle}` : "Not linked yet"}</div>
                            </div>
                            {entry.ready && viewerUserId ? (
                              <a href={buildConnectHref(entry.key)} style={{ ...button, textDecoration: "none", textAlign: "center" }}>Connect</a>
                            ) : (
                              <button type="button" style={button} disabled>Unavailable</button>
                            )}
                          </div>
                        </div>
                      );
                    }) : <div style={{ color: "#ffb3b3" }}>No provider login rows available yet.</div>}
                  </div>
                </div>
                <div style={{ marginTop: 12, display: "grid", gap: 8 }}>{myIdentities.length ? myIdentities.map((entry) => <div key={entry.id} style={{ ...card, marginBottom: 0 }}><div style={{ fontWeight: 700 }}>{entry.providerLabel} - {entry.handle}</div><div style={{ color: "#ffb3b3", fontSize: 12 }}>{entry.platformKey ? `${entry.platformLabel} | ` : ""}{entry.verified ? `verified via ${entry.verificationMethod || "verified"}` : entry.verificationState || "unverified"}</div></div>) : <div style={{ color: "#ffb3b3" }}>No personal links saved yet.</div>}</div>
              </div>
              <div style={card}>
                <div style={{ fontWeight: 800, marginBottom: 8 }}>My Privacy + Consent</div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(2,minmax(140px,1fr))", gap: 8 }}>
                  <label><input type="checkbox" checked={Boolean(selfPrivacy.shareLinkedIdentities)} onChange={(event) => setSelfPrivacy((prev: any) => ({ ...prev, shareLinkedIdentities: event.target.checked }))} /> Share links</label>
                  <label><input type="checkbox" checked={Boolean(selfPrivacy.sharePresence)} onChange={(event) => setSelfPrivacy((prev: any) => ({ ...prev, sharePresence: event.target.checked }))} /> Share presence</label>
                  <label><input type="checkbox" checked={Boolean(selfPrivacy.shareStats)} onChange={(event) => setSelfPrivacy((prev: any) => ({ ...prev, shareStats: event.target.checked }))} /> Share stats</label>
                  <label><input type="checkbox" checked={Boolean(selfPrivacy.sharePlaytime)} onChange={(event) => setSelfPrivacy((prev: any) => ({ ...prev, sharePlaytime: event.target.checked }))} /> Share hours</label>
                  <label><input type="checkbox" checked={Boolean(selfPrivacy.shareSquads)} onChange={(event) => setSelfPrivacy((prev: any) => ({ ...prev, shareSquads: event.target.checked }))} /> Share squads</label>
                  <label><input type="checkbox" checked={Boolean(selfPrivacy.allowShowoffCard)} onChange={(event) => setSelfPrivacy((prev: any) => ({ ...prev, allowShowoffCard: event.target.checked }))} /> Allow card</label>
                  <label><input type="checkbox" checked={Boolean(selfPrivacy.allowProviderSync)} onChange={(event) => setSelfPrivacy((prev: any) => ({ ...prev, allowProviderSync: event.target.checked }))} /> Allow provider sync</label>
                  <label><input type="checkbox" checked={Boolean(selfPrivacy.allowRankRoleSync)} onChange={(event) => setSelfPrivacy((prev: any) => ({ ...prev, allowRankRoleSync: event.target.checked }))} /> Allow rank sync</label>
                  <label><input type="checkbox" checked={Boolean(selfPrivacy.notifyRankChanges)} onChange={(event) => setSelfPrivacy((prev: any) => ({ ...prev, notifyRankChanges: event.target.checked }))} /> Rank alerts</label>
                  <label><input type="checkbox" checked={Boolean(selfPrivacy.notifyLiveFriends)} onChange={(event) => setSelfPrivacy((prev: any) => ({ ...prev, notifyLiveFriends: event.target.checked }))} /> Friend-live alerts</label>
                </div>
                <textarea style={{ ...input, minHeight: 90, marginTop: 10 }} placeholder="Watchlist member IDs, comma separated" value={formatIdList(selfPrivacy.watchlistUserIds)} onChange={(event) => setSelfPrivacy((prev: any) => ({ ...prev, watchlistUserIds: parseIdList(event.target.value) }))} />
                <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
                  <button type="button" style={button} disabled={saving} onClick={() => void runAction("privacyConsent", "saveProfile", { userId: viewerUserId, profile: selfPrivacy }, "Saved your privacy + consent profile.")}>Save My Privacy</button>
                  <button type="button" style={button} disabled={saving} onClick={() => void runAction("privacyConsent", "clearNotifications", { userId: viewerUserId }, "Cleared your gamer alerts.")}>Clear My Alerts</button>
                </div>
              </div>
              <div style={card}>
                <div style={{ fontWeight: 800, marginBottom: 8 }}>Verification + Alerts</div>
                <div style={{ color: "#ffb3b3", fontSize: 12, marginBottom: 8 }}>This verifies the accounts linked to your own Discord profile. Staff-only verification stays tucked under the operator override.</div>
                <div style={{ display: "grid", gap: 8 }}>
                  <input style={input} value={verificationForm.userId || viewerUserId || ""} readOnly />
                  <select style={input} value={verificationForm.providerKey} onChange={(event) => setVerificationForm((prev) => ({ ...prev, providerKey: event.target.value }))}>{LINK_PROVIDERS.map((entry) => <option key={entry.value} value={entry.value}>{entry.label}</option>)}</select>
                  <select style={input} value={verificationForm.platform} onChange={(event) => setVerificationForm((prev) => ({ ...prev, platform: event.target.value }))}>{PLATFORMS.map((entry) => <option key={entry.value || "any"} value={entry.value}>{entry.label}</option>)}</select>
                  <input style={input} placeholder="Optional token override" value={verificationForm.proofToken} onChange={(event) => setVerificationForm((prev) => ({ ...prev, proofToken: event.target.value }))} />
                  <textarea style={{ ...input, minHeight: 90 }} placeholder="Paste the proof text that contains your challenge token" value={verificationForm.proofText} onChange={(event) => setVerificationForm((prev) => ({ ...prev, proofText: event.target.value }))} />
                </div>
                <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
                  <button type="button" style={button} disabled={saving} onClick={() => void runAction("gameIdentity", "confirmVerification", { ...verificationForm, userId: viewerUserId || verificationForm.userId }, "Verification confirmed.")}>Confirm My Proof</button>
                </div>
                <details style={{ marginTop: 10 }}>
                  <summary style={{ cursor: "pointer", fontWeight: 800 }}>Operator Override</summary>
                  <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
                    <input style={input} placeholder="Target Discord user ID" value={verificationForm.userId} onChange={(event) => setVerificationForm((prev) => ({ ...prev, userId: event.target.value }))} />
                    <button type="button" style={button} disabled={saving || !canManageGaming} onClick={() => void runAction("gameIdentity", "staffVerify", verificationForm, "Staff verification recorded.")}>Staff Verify</button>
                  </div>
                </details>
                <div style={{ marginTop: 12, display: "grid", gap: 8 }}>{myPendingVerifications.length ? myPendingVerifications.map((entry) => <div key={entry.id} style={{ ...card, marginBottom: 0 }}><div style={{ fontWeight: 700 }}>{String(entry.providerKey || "").toUpperCase()} verification token</div><div style={{ color: "#ffb3b3", fontSize: 12 }}>{entry.token} | expires {entry.expiresAt || "soon"}</div></div>) : <div style={{ color: "#ffb3b3" }}>No pending verification challenges.</div>}{myNotifications.length ? myNotifications.map((entry) => <div key={entry.id} style={{ ...card, marginBottom: 0 }}><div style={{ fontWeight: 700 }}>{entry.title}</div><div style={{ color: "#ffb3b3", fontSize: 12 }}>{entry.detail}</div></div>) : <div style={{ color: "#ffb3b3" }}>No gamer alerts waiting for you.</div>}</div>
              </div>
            </div>
          </div>
          <div style={card}>
            <h3 style={sectionTitle}>Identity + Consent Defaults</h3>
            {!canManageGaming ? <div style={{ color: "#ffb3b3", fontSize: 12, marginBottom: 8 }}>Staff-only settings are read-only in member portal mode.</div> : null}
            <fieldset disabled={!canManageGaming} style={lockedGroup}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4,minmax(160px,1fr))", gap: 10 }}>
              <label><input type="checkbox" checked={Boolean(getValue(engines.gameIdentity, ["enabled"], true))} onChange={(event) => updateConfig("gameIdentity", { enabled: event.target.checked })} /> Identity enabled</label>
              <label><input type="checkbox" checked={Boolean(getValue(engines.gameIdentity, ["allowSelfLink"], true))} onChange={(event) => updateConfig("gameIdentity", { allowSelfLink: event.target.checked })} /> Allow self link</label>
              <input style={input} type="number" placeholder="Max links per member" value={getValue(engines.gameIdentity, ["maxLinksPerMember"], 8)} onChange={(event) => updateConfig("gameIdentity", { maxLinksPerMember: Number(event.target.value || 0) })} />
              <select style={input} value={getValue(engines.gameIdentity, ["defaultVisibility"], "server")} onChange={(event) => updateConfig("gameIdentity", { defaultVisibility: event.target.value })}>{VISIBILITY.map((entry) => <option key={entry.value} value={entry.value}>{entry.label}</option>)}</select>
            </div>
            <div style={{ marginTop: 10 }}>
              <div style={{ color: "#ffb3b3", fontSize: 12, marginBottom: 8 }}>Linkable providers</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,180px),1fr))", gap: 8 }}>
                {LINK_PROVIDERS.map((entry) => {
                  const current = Array.isArray(engines.gameIdentity.config?.allowedProviders) ? engines.gameIdentity.config?.allowedProviders : [];
                  return (
                    <label key={`identity-provider-${entry.value}`} style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <input
                        type="checkbox"
                        checked={current.includes(entry.value)}
                        onChange={() => updateConfig("gameIdentity", { allowedProviders: toggleProviderList(current, entry.value) })}
                      />
                      <span>{entry.label}</span>
                    </label>
                  );
                })}
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,220px),1fr))", gap: 10, marginTop: 10 }}>
              <label><input type="checkbox" checked={Boolean(getValue(engines.privacyConsent, ["enabled"], true))} onChange={(event) => updateConfig("privacyConsent", { enabled: event.target.checked })} /> Privacy engine enabled</label>
              <label><input type="checkbox" checked={Boolean(getValue(engines.privacyConsent, ["memberSelfServiceEnabled"], true))} onChange={(event) => updateConfig("privacyConsent", { memberSelfServiceEnabled: event.target.checked })} /> Member self-service</label>
              <label><input type="checkbox" checked={Boolean(getValue(engines.privacyConsent, ["requireVerifiedIdentityForProviderSync"], true))} onChange={(event) => updateConfig("privacyConsent", { requireVerifiedIdentityForProviderSync: event.target.checked })} /> Verified before sync</label>
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
              <button type="button" style={button} disabled={saving} onClick={() => void saveConfig("gameIdentity", engines.gameIdentity.config || {}, "Saved identity engine settings.")}>Save Identity Engine</button>
              <button type="button" style={button} disabled={saving} onClick={() => void saveConfig("privacyConsent", engines.privacyConsent.config || {}, "Saved privacy + consent defaults.")}>Save Privacy Engine</button>
            </div>
            </fieldset>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,280px),1fr))", gap: 12, marginTop: 12 }}>
              <div style={card}><div style={{ fontWeight: 800, marginBottom: 8 }}>Recent Linked Profiles</div><div style={{ display: "grid", gap: 8 }}>{linkedProfiles.length ? linkedProfiles.map((entry) => <div key={entry.id}><div style={{ fontWeight: 700 }}>{entry.title}</div><div style={{ color: "#ffb3b3", fontSize: 12 }}>{entry.value}</div></div>) : <div style={{ color: "#ffb3b3" }}>No linked identities yet.</div>}</div></div>
              <div style={card}><div style={{ fontWeight: 800, marginBottom: 8 }}>Pending Verification Queue</div><div style={{ display: "grid", gap: 8 }}>{pendingVerifications.length ? pendingVerifications.map((entry) => <div key={entry.id}><div style={{ fontWeight: 700 }}>{entry.title}</div><div style={{ color: "#ffb3b3", fontSize: 12 }}>{entry.value}</div></div>) : <div style={{ color: "#ffb3b3" }}>No pending verification queue.</div>}</div></div>
            </div>
          </div>

          <div style={card}>
            <h3 style={sectionTitle}>Presence Fusion</h3>
            <fieldset disabled={!canManageGaming} style={lockedGroup}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,160px),1fr))", gap: 10 }}>
              <label><input type="checkbox" checked={Boolean(getValue(engines.presenceFusion, ["enabled"], true))} onChange={(event) => updateConfig("presenceFusion", { enabled: event.target.checked })} /> Enabled</label>
              <label><input type="checkbox" checked={Boolean(getValue(engines.presenceFusion, ["captureDiscordPresence"], true))} onChange={(event) => updateConfig("presenceFusion", { captureDiscordPresence: event.target.checked })} /> Capture presence</label>
              <label><input type="checkbox" checked={Boolean(getValue(engines.presenceFusion, ["requireGamingActivity"], true))} onChange={(event) => updateConfig("presenceFusion", { requireGamingActivity: event.target.checked })} /> Gaming only</label>
              <input style={input} type="number" placeholder="Presence window (min)" value={getValue(engines.presenceFusion, ["presenceMaxAgeMinutes"], 180)} onChange={(event) => updateConfig("presenceFusion", { presenceMaxAgeMinutes: Number(event.target.value || 0) })} />
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
              <button type="button" style={button} disabled={saving} onClick={() => void saveConfig("presenceFusion", engines.presenceFusion.config || {}, "Saved presence fusion settings.")}>Save Presence Fusion</button>
              <button type="button" style={button} disabled={saving} onClick={() => void runAction("presenceFusion", "clearPresence", {}, "Cleared cached presence.")}>Clear Presence Cache</button>
              <button type="button" style={button} disabled={saving} onClick={() => void runAction("presenceFusion", "prunePresence", {}, "Pruned stale presence snapshots.")}>Prune Stale Presence</button>
            </div>
            </fieldset>
            <div style={{ marginTop: 12, display: "grid", gap: 8 }}>{livePlayers.length ? livePlayers.map((entry) => <div key={`${entry.userId}-${entry.title}`} style={{ ...card, marginBottom: 0 }}><div style={{ fontWeight: 700 }}>{entry.title}</div><div style={{ color: "#ffb3b3", fontSize: 12 }}>{entry.value}</div></div>) : <div style={{ color: "#ffb3b3" }}>No recent game presence captured.</div>}</div>
          </div>

          <div style={card}>
            <h3 style={sectionTitle}>Game Provider</h3>
            <div style={{ color: "#ffb7b7", fontSize: 12, marginBottom: 12 }}>Manual snapshots still work across the full game stack, while routed provider sync can now be configured for Steam, Epic, Xbox, Battle.net, PlayStation, Rockstar, Apex, Fortnite, CoD, WoW, Overwatch 2, Diablo IV, Destiny 2, Riot titles, Rocket League, GTA Online, Minecraft, and any future bridge you add.</div>
            <fieldset disabled={!canManageGaming} style={lockedGroup}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,160px),1fr))", gap: 10 }}>
              <label><input type="checkbox" checked={Boolean(getValue(engines.gameProvider, ["enabled"], true))} onChange={(event) => updateConfig("gameProvider", { enabled: event.target.checked })} /> Enabled</label>
              <label><input type="checkbox" checked={Boolean(getValue(engines.gameProvider, ["allowManualStats"], true))} onChange={(event) => updateConfig("gameProvider", { allowManualStats: event.target.checked })} /> Manual stats</label>
              <label><input type="checkbox" checked={Boolean(getValue(engines.gameProvider, ["allowManualMapRotation"], true))} onChange={(event) => updateConfig("gameProvider", { allowManualMapRotation: event.target.checked })} /> Manual maps</label>
              <label><input type="checkbox" checked={Boolean(getValue(engines.gameProvider, ["autoSyncRankRoles"], true))} onChange={(event) => updateConfig("gameProvider", { autoSyncRankRoles: event.target.checked })} /> Auto rank sync</label>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4,minmax(160px,1fr))", gap: 10, marginTop: 10 }}>
              <label><input type="checkbox" checked={Boolean(getValue(engines.gameProvider, ["removeOtherRankRoles"], true))} onChange={(event) => updateConfig("gameProvider", { removeOtherRankRoles: event.target.checked })} /> Remove lower roles</label>
              <label><input type="checkbox" checked={Boolean(getValue(engines.gameProvider, ["autoRefreshEnabled"], false))} onChange={(event) => updateConfig("gameProvider", { autoRefreshEnabled: event.target.checked })} /> Scheduled sync</label>
              <label><input type="checkbox" checked={Boolean(getValue(engines.gameProvider, ["notifyRankChanges"], true))} onChange={(event) => updateConfig("gameProvider", { notifyRankChanges: event.target.checked })} /> Rank notices</label>
              <select style={input} value={getValue(engines.gameProvider, ["failoverMode"], "keep_last_snapshot")} onChange={(event) => updateConfig("gameProvider", { failoverMode: event.target.value })}><option value="keep_last_snapshot">Keep last snapshot</option><option value="manual_fallback">Manual fallback</option><option value="disable_provider">Disable failing provider</option></select>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4,minmax(160px,1fr))", gap: 10, marginTop: 10 }}>
              <input style={input} type="number" placeholder="Refresh interval (min)" value={getValue(engines.gameProvider, ["refreshIntervalMinutes"], 30)} onChange={(event) => updateConfig("gameProvider", { refreshIntervalMinutes: Number(event.target.value || 0) })} />
              <input style={input} type="number" placeholder="Max users per cycle" value={getValue(engines.gameProvider, ["maxUsersPerCycle"], 6)} onChange={(event) => updateConfig("gameProvider", { maxUsersPerCycle: Number(event.target.value || 0) })} />
              <input style={input} type="number" placeholder="Stale stats hours" value={getValue(engines.gameProvider, ["staleStatsHours"], 72)} onChange={(event) => updateConfig("gameProvider", { staleStatsHours: Number(event.target.value || 0) })} />
              <input style={input} type="number" placeholder="Stale map hours" value={getValue(engines.gameProvider, ["staleMapHours"], 12)} onChange={(event) => updateConfig("gameProvider", { staleMapHours: Number(event.target.value || 0) })} />
            </div>
            <div style={{ marginTop: 10 }}>
              <select style={input} value={getValue(engines.gameProvider, ["notificationChannelId"], "")} onChange={(event) => updateConfig("gameProvider", { notificationChannelId: event.target.value })}>
                <option value="">Rank change notification channel</option>
                {messageChannels.map((channel) => <option key={channel.id} value={channel.id}>{formatChannelLabel(channel, channels)}</option>)}
              </select>
            </div>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 10 }}>{ADAPTER_PROVIDERS.map((entry) => { const current = Array.isArray(engines.gameProvider.config?.allowedProviders) ? engines.gameProvider.config?.allowedProviders : []; const adapters = engines.gameProvider.config?.externalAdapters || {}; const adapter = adapters[entry.value] || {}; const endpoint = String(adapter.endpointUrl || ""); const builtIn = endpoint.startsWith("builtin://"); return <div key={entry.value} style={{ ...card, marginBottom: 0, minWidth: 260, flex: 1 }}><div style={{ fontWeight: 800, marginBottom: 8 }}>{entry.label} Provider Route</div><label><input type="checkbox" checked={current.includes(entry.value)} onChange={() => updateConfig("gameProvider", { allowedProviders: toggleProviderList(current, entry.value) })} /> Provider enabled</label><label style={{ display: "block", marginTop: 8 }}><input type="checkbox" checked={Boolean(adapter.enabled)} onChange={(event) => updateConfig("gameProvider", { externalAdapters: { ...(engines.gameProvider.config?.externalAdapters || {}), [entry.value]: { ...adapter, enabled: event.target.checked } } })} /> Route enabled</label><div style={{ color: "#ffb3b3", fontSize: 12, marginTop: 8 }}>{builtIn ? "Built-in route selected. Leave it as-is unless you want to point this provider at your own bridge." : "External override route active."}</div><div style={{ display: "grid", gap: 8, marginTop: 8 }}><select style={input} value={builtIn ? "builtin" : "external"} onChange={(event) => updateConfig("gameProvider", { externalAdapters: { ...(engines.gameProvider.config?.externalAdapters || {}), [entry.value]: { ...adapter, mode: event.target.value, endpointUrl: event.target.value === "builtin" ? `builtin://${entry.value}` : "" } } })}><option value="builtin">Built-in route</option><option value="external">External bridge override</option></select><input style={input} placeholder="Bridge endpoint URL override" value={endpoint} onChange={(event) => updateConfig("gameProvider", { externalAdapters: { ...(engines.gameProvider.config?.externalAdapters || {}), [entry.value]: { ...adapter, endpointUrl: event.target.value } } })} /><input style={input} placeholder="Optional adapter API key" value={String(adapter.apiKey || "")} onChange={(event) => updateConfig("gameProvider", { externalAdapters: { ...(engines.gameProvider.config?.externalAdapters || {}), [entry.value]: { ...adapter, apiKey: event.target.value } } })} /><div style={{ display: "grid", gridTemplateColumns: "repeat(2,minmax(120px,1fr))", gap: 8 }}><input style={input} type="number" placeholder="RPM" value={String(adapter.requestsPerMinute ?? 10)} onChange={(event) => updateConfig("gameProvider", { externalAdapters: { ...(engines.gameProvider.config?.externalAdapters || {}), [entry.value]: { ...adapter, requestsPerMinute: Number(event.target.value || 0) } } })} /><input style={input} type="number" placeholder="Cooldown min" value={String(adapter.cooldownMinutes ?? 30)} onChange={(event) => updateConfig("gameProvider", { externalAdapters: { ...(engines.gameProvider.config?.externalAdapters || {}), [entry.value]: { ...adapter, cooldownMinutes: Number(event.target.value || 0) } } })} /></div></div></div>; })}</div>
            <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
              <button type="button" style={button} disabled={saving} onClick={() => void saveConfig("gameProvider", engines.gameProvider.config || {}, "Saved provider engine settings.")}>Save Provider Engine</button>
              <button type="button" style={button} disabled={saving} onClick={() => void runAction("gameProvider", "refreshProvidersNow", {}, "Ran scheduled provider sync now.")}>Run Provider Sync</button>
              <button type="button" style={button} disabled={saving} onClick={() => void runAction("gameProvider", "resetProviderHealth", {}, "Reset provider adapter health.")}>Reset Adapter Health</button>
              <button type="button" style={button} disabled={saving} onClick={() => void runAction("gameProvider", "pruneProviderData", {}, "Pruned stale provider data.")}>Prune Stale Data</button>
            </div>
            </fieldset>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,260px),1fr))", gap: 12, marginTop: 12 }}>
              <div style={card}>
                <div style={{ fontWeight: 800, marginBottom: 8 }}>Stats Snapshot / Import</div>
                <div style={{ color: "#ffb3b3", fontSize: 12, marginBottom: 8 }}>This saves or refreshes your own linked account by default. Staff can open the operator override below when they need to target someone else.</div>
                <div style={{ display: "grid", gap: 8 }}>
                  <input style={input} value={statsForm.userId || viewerUserId || ""} readOnly />
                  <select style={input} value={statsForm.providerKey} onChange={(event) => setStatsForm((prev) => ({ ...prev, providerKey: event.target.value }))}>{STATS_PROVIDERS.map((entry) => <option key={entry.value} value={entry.value}>{entry.label}</option>)}</select>
                  <select style={input} value={statsForm.platform} onChange={(event) => setStatsForm((prev) => ({ ...prev, platform: event.target.value }))}>{PLATFORMS.map((entry) => <option key={entry.value || "any"} value={entry.value}>{entry.label}</option>)}</select>
                  <input style={input} placeholder="Rank tier key" value={statsForm.rankTier} onChange={(event) => setStatsForm((prev) => ({ ...prev, rankTier: event.target.value }))} />
                  <input style={input} placeholder="Rank label" value={statsForm.rankLabel} onChange={(event) => setStatsForm((prev) => ({ ...prev, rankLabel: event.target.value }))} />
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(2,minmax(120px,1fr))", gap: 8 }}><input style={input} placeholder="Rating" value={statsForm.rating} onChange={(event) => setStatsForm((prev) => ({ ...prev, rating: event.target.value }))} /><input style={input} placeholder="Kills" value={statsForm.kills} onChange={(event) => setStatsForm((prev) => ({ ...prev, kills: event.target.value }))} /><input style={input} placeholder="Wins" value={statsForm.wins} onChange={(event) => setStatsForm((prev) => ({ ...prev, wins: event.target.value }))} /><input style={input} placeholder="KD" value={statsForm.kd} onChange={(event) => setStatsForm((prev) => ({ ...prev, kd: event.target.value }))} /></div>
                  <input style={input} placeholder="Matches" value={statsForm.matches} onChange={(event) => setStatsForm((prev) => ({ ...prev, matches: event.target.value }))} />
                  <input style={input} placeholder="Current mode" value={statsForm.currentMode} onChange={(event) => setStatsForm((prev) => ({ ...prev, currentMode: event.target.value }))} />
                  <input style={input} placeholder="Current map" value={statsForm.currentMap} onChange={(event) => setStatsForm((prev) => ({ ...prev, currentMap: event.target.value }))} />
                  <select style={input} value={statsForm.sourceKey} onChange={(event) => setStatsForm((prev) => ({ ...prev, sourceKey: event.target.value }))}>{SOURCES.map((entry) => <option key={entry.value} value={entry.value}>{entry.label}</option>)}</select>
                </div>
                <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
                  <button type="button" style={button} disabled={saving || !canManageGaming} onClick={() => void runAction("gameProvider", "upsertStats", { ...statsForm, userId: statsForm.userId || viewerUserId, rating: parseOptionalNumber(statsForm.rating), kills: parseOptionalNumber(statsForm.kills), wins: parseOptionalNumber(statsForm.wins), kd: parseOptionalNumber(statsForm.kd), matches: parseOptionalNumber(statsForm.matches) }, "Saved provider stats snapshot.")}>Save My Stats</button>
                  <button type="button" style={button} disabled={saving} onClick={() => void runAction("gameProvider", "refreshProviderUser", { ...refreshForm, userId: refreshForm.userId || viewerUserId }, "Requested live provider refresh for your linked account.")}>Refresh My Provider Data</button>
                </div>
                <details style={{ marginTop: 10 }}>
                  <summary style={{ cursor: "pointer", fontWeight: 800 }}>Operator Override</summary>
                  <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
                    <input style={input} placeholder="Target Discord user ID" value={statsForm.userId} onChange={(event) => setStatsForm((prev) => ({ ...prev, userId: event.target.value }))} />
                    <input style={input} placeholder="Refresh target Discord user ID" value={refreshForm.userId} onChange={(event) => setRefreshForm((prev) => ({ ...prev, userId: event.target.value }))} />
                  </div>
                </details>
              </div>
              <div style={card}>
                <div style={{ fontWeight: 800, marginBottom: 8 }}>Map Rotation + Rank Sync</div>
                <div style={{ color: "#ffb3b3", fontSize: 12, marginBottom: 8 }}>Map rotation is guild-wide. Rank sync defaults to your own linked account unless staff opens the operator override.</div>
                <div style={{ display: "grid", gap: 8 }}>
                  <select style={input} value={mapForm.providerKey} onChange={(event) => setMapForm((prev) => ({ ...prev, providerKey: event.target.value }))}>{MAP_PROVIDERS.map((entry) => <option key={entry.value} value={entry.value}>{entry.label}</option>)}</select>
                  <input style={input} placeholder="Mode / queue" value={mapForm.mode} onChange={(event) => setMapForm((prev) => ({ ...prev, mode: event.target.value }))} />
                  <input style={input} placeholder="Current map" value={mapForm.currentMap} onChange={(event) => setMapForm((prev) => ({ ...prev, currentMap: event.target.value }))} />
                  <input style={input} placeholder="Next map" value={mapForm.nextMap} onChange={(event) => setMapForm((prev) => ({ ...prev, nextMap: event.target.value }))} />
                  <input style={input} placeholder="Expires in minutes" value={mapForm.expiresInMinutes} onChange={(event) => setMapForm((prev) => ({ ...prev, expiresInMinutes: event.target.value }))} />
                  <select style={input} value={mapForm.sourceKey} onChange={(event) => setMapForm((prev) => ({ ...prev, sourceKey: event.target.value }))}>{SOURCES.map((entry) => <option key={entry.value} value={entry.value}>{entry.label}</option>)}</select>
                  <input style={input} value={rankSyncForm.userId || viewerUserId || ""} readOnly />
                  <select style={input} value={rankSyncForm.gameKey} onChange={(event) => setRankSyncForm((prev) => ({ ...prev, gameKey: event.target.value }))}><option value="">All games</option>{ROLE_SYNC_GAMES.map((entry) => <option key={entry.key} value={entry.key}>{entry.label.replace(" Role Map", "")}</option>)}</select>
                  <select style={input} value={refreshForm.providerKey} onChange={(event) => setRefreshForm((prev) => ({ ...prev, providerKey: event.target.value }))}>{ADAPTER_PROVIDERS.map((entry) => <option key={entry.value} value={entry.value}>{entry.label}</option>)}</select>
                  <select style={input} value={refreshForm.platform} onChange={(event) => setRefreshForm((prev) => ({ ...prev, platform: event.target.value }))}>{PLATFORMS.map((entry) => <option key={entry.value || "any"} value={entry.value}>{entry.label}</option>)}</select>
                </div>
                <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
                  <button type="button" style={button} disabled={saving || !canManageGaming} onClick={() => void runAction("gameProvider", "setMapRotation", { ...mapForm, expiresInMinutes: parseOptionalNumber(mapForm.expiresInMinutes) }, "Saved map rotation snapshot.")}>Save Map</button>
                  <button type="button" style={button} disabled={saving} onClick={() => void runAction("gameProvider", "syncRankRoles", { ...rankSyncForm, userId: rankSyncForm.userId || viewerUserId }, "Rank role sync requested.")}>Sync My Roles</button>
                </div>
                <details style={{ marginTop: 10 }}>
                  <summary style={{ cursor: "pointer", fontWeight: 800 }}>Operator Override</summary>
                  <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
                    <input style={input} placeholder="Target Discord user ID" value={rankSyncForm.userId} onChange={(event) => setRankSyncForm((prev) => ({ ...prev, userId: event.target.value }))} />
                    <input style={input} placeholder="Refresh target Discord user ID" value={refreshForm.userId} onChange={(event) => setRefreshForm((prev) => ({ ...prev, userId: event.target.value }))} />
                  </div>
                </details>
              </div>
            </div>
            <fieldset disabled={!canManageGaming} style={lockedGroup}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,260px),1fr))", gap: 12, marginTop: 12 }}>
              {ROLE_SYNC_GAMES.map((entry) => {
                const roleMap = getValue(engines.gameProvider, ["rankRoleSync", entry.key], {});
                return (
                  <div key={entry.key} style={card}>
                    <div style={{ fontWeight: 800, marginBottom: 8 }}>{entry.label}</div>
                    <div style={{ display: "grid", gap: 8 }}>
                      {entry.tiers.map((tier) => (
                        <label key={`${entry.key}-${tier}`} style={{ display: "grid", gap: 4 }}>
                          <span style={{ color: "#ffb3b3", fontSize: 12, textTransform: "uppercase", letterSpacing: "0.06em" }}>{tier}</span>
                          <select
                            style={input}
                            value={String(roleMap?.[tier] || "")}
                            onChange={(event) => updateConfig("gameProvider", {
                              rankRoleSync: {
                                ...(engines.gameProvider.config?.rankRoleSync || {}),
                                [entry.key]: {
                                  ...(engines.gameProvider.config?.rankRoleSync?.[entry.key] || {}),
                                  [tier]: event.target.value,
                                },
                              },
                            })}
                          >
                            <option value="">No synced role</option>
                            {sortedRoles.map((role) => <option key={role.id} value={role.id}>@{role.name}</option>)}
                          </select>
                        </label>
                      ))}
                    </div>
                    <details style={{ marginTop: 10 }}>
                      <summary style={{ cursor: "pointer", fontWeight: 800 }}>Raw ID map</summary>
                      <textarea
                        style={{ ...input, minHeight: 120, marginTop: 10 }}
                        value={formatRoleMap(roleMap)}
                        onChange={(event) => updateConfig("gameProvider", {
                          rankRoleSync: {
                            ...(engines.gameProvider.config?.rankRoleSync || {}),
                            [entry.key]: parseRoleMap(event.target.value),
                          },
                        })}
                      />
                    </details>
                  </div>
                );
              })}
            </div>
            </fieldset>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,280px),1fr))", gap: 12, marginTop: 12 }}>
              <div style={card}><div style={{ fontWeight: 800, marginBottom: 8 }}>Launcher Readiness</div><div style={{ color: "#ffb3b3", fontSize: 12, marginBottom: 8 }}>This is the live-readiness check for Steam, Epic, Xbox, Battle.net, PlayStation, and Rockstar. `endpoint ready` means the bot has a route to call. `missing bridge` means the dashboard is wired, but the bot still needs a real upstream endpoint or bridge URL in env.</div><div style={{ display: "grid", gap: 8 }}>{launcherReadiness.length ? launcherReadiness.map((entry) => <div key={entry.title} style={{ ...card, marginBottom: 0 }}><div style={{ fontWeight: 700 }}>{entry.title}</div><div style={{ color: "#ffb3b3", fontSize: 12 }}>{entry.value}</div></div>) : <div style={{ color: "#ffb3b3" }}>No launcher readiness rows yet.</div>}</div></div>
              <div style={card}><div style={{ fontWeight: 800, marginBottom: 8 }}>Adapter Health</div><div style={{ display: "grid", gap: 8 }}>{providerHealth.length ? providerHealth.map((entry) => <div key={entry.key} style={{ ...card, marginBottom: 0 }}><div style={{ fontWeight: 700 }}>{entry.title}</div><div style={{ color: "#ffb3b3", fontSize: 12 }}>{entry.value}</div></div>) : <div style={{ color: "#ffb3b3" }}>No adapter health data yet.</div>}</div></div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,280px),1fr))", gap: 12, marginTop: 12 }}>
              <div style={card}><div style={{ fontWeight: 800, marginBottom: 8 }}>Provider Capabilities</div><div style={{ display: "grid", gap: 8 }}>{providerCapabilities.length ? providerCapabilities.map((entry) => <div key={entry.key} style={{ ...card, marginBottom: 0 }}><div style={{ fontWeight: 700 }}>{entry.title}</div><div style={{ color: "#ffb3b3", fontSize: 12 }}>{entry.value}</div></div>) : <div style={{ color: "#ffb3b3" }}>No provider capability rows found.</div>}</div></div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,280px),1fr))", gap: 12, marginTop: 12 }}>
              <div style={{ display: "grid", gap: 8 }}>{statRows.length ? statRows.map((entry) => <div key={entry.id || entry.title} style={{ ...card, marginBottom: 0 }}><div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}><div><div style={{ fontWeight: 700 }}>{entry.title}</div><div style={{ color: "#ffb3b3", fontSize: 12 }}>{entry.value}</div></div>{entry.id && canManageGaming ? <button type="button" style={button} disabled={saving} onClick={() => void runAction("gameProvider", "removeStats", { recordId: entry.id }, "Removed provider stats snapshot.")}>Remove</button> : null}</div></div>) : <div style={{ color: "#ffb3b3" }}>No game stats snapshots recorded.</div>}</div>
              <div style={{ display: "grid", gap: 8 }}>{mapRows.length ? mapRows.map((entry) => <div key={entry.id || entry.title} style={{ ...card, marginBottom: 0 }}><div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}><div><div style={{ fontWeight: 700 }}>{entry.title}</div><div style={{ color: "#ffb3b3", fontSize: 12 }}>{entry.value}</div></div>{entry.id && canManageGaming ? <button type="button" style={button} disabled={saving} onClick={() => void runAction("gameProvider", "removeMapRotation", { recordId: entry.id }, "Removed map rotation snapshot.")}>Remove</button> : null}</div></div>) : <div style={{ color: "#ffb3b3" }}>No map rotation snapshots recorded.</div>}</div>
            </div>
          </div>

          <div style={card}>
            <h3 style={sectionTitle}>Playtime</h3>
            {!canManageGaming ? <div style={{ color: "#ffb3b3", fontSize: 12, marginBottom: 10 }}>Member portal mode: you can submit evidence and view your own gaming data. Staff controls are hidden.</div> : null}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4,minmax(160px,1fr))", gap: 10 }}>
              <label><input type="checkbox" disabled={!canManageGaming} checked={Boolean(getValue(engines.playtime, ["enabled"], true))} onChange={(event) => updateConfig("playtime", { enabled: event.target.checked })} /> Enabled</label>
              <label><input type="checkbox" disabled={!canManageGaming} checked={Boolean(getValue(engines.playtime, ["allowManualEntries"], true))} onChange={(event) => updateConfig("playtime", { allowManualEntries: event.target.checked })} /> Manual entries</label>
              <label><input type="checkbox" disabled={!canManageGaming} checked={Boolean(getValue(engines.playtime, ["autoSessionTracking"], true))} onChange={(event) => updateConfig("playtime", { autoSessionTracking: event.target.checked })} /> Auto session tracking</label>
              <input style={input} disabled={!canManageGaming} type="number" placeholder="Session minimum (minutes)" value={getValue(engines.playtime, ["sessionMinMinutes"], 5)} onChange={(event) => updateConfig("playtime", { sessionMinMinutes: Number(event.target.value || 0) })} />
              <select style={input} disabled={!canManageGaming} value={getValue(engines.playtime, ["defaultSource"], "provider_api")} onChange={(event) => updateConfig("playtime", { defaultSource: event.target.value })}>{SOURCES.map((entry) => <option key={entry.value} value={entry.value}>{entry.label}</option>)}</select>
              <input style={input} disabled={!canManageGaming} type="number" placeholder="Max hours per record" value={getValue(engines.playtime, ["maxHoursPerRecord"], 50000)} onChange={(event) => updateConfig("playtime", { maxHoursPerRecord: Number(event.target.value || 0) })} />
              <input style={input} disabled={!canManageGaming} placeholder="Member allowed sources (csv)" value={formatIdList(getValue(engines.playtime, ["memberAllowedSources"], []))} onChange={(event) => updateConfig("playtime", { memberAllowedSources: parseIdList(event.target.value) })} />
              <input style={input} disabled={!canManageGaming} placeholder="Trusted sources (csv)" value={formatIdList(getValue(engines.playtime, ["trustedSources"], []))} onChange={(event) => updateConfig("playtime", { trustedSources: parseIdList(event.target.value) })} />
              <input style={input} disabled={!canManageGaming} placeholder="Achievement sources (csv)" value={formatIdList(getValue(engines.playtime, ["achievementEligibleSources"], []))} onChange={(event) => updateConfig("playtime", { achievementEligibleSources: parseIdList(event.target.value) })} />
            </div>
            {canManageGaming ? <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
              <button type="button" style={button} disabled={saving} onClick={() => void saveConfig("playtime", engines.playtime.config || {}, "Saved playtime engine settings.")}>Save Playtime Engine</button>
            </div> : null}

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,260px),1fr))", gap: 12, marginTop: 12 }}>
              <div style={card}>
                <div style={{ fontWeight: 800, marginBottom: 8 }}>Evidence Submission</div>
                <div style={{ color: "#ffb3b3", fontSize: 12, marginBottom: 8 }}>
                  Members should submit screenshot proof here. Staff can approve the claim so hours are added as `staff_verified`.
                </div>
                <div style={{ display: "grid", gap: 8 }}>
                  <input style={input} value={playtimeForm.userId || viewerUserId || ""} readOnly />
                  <input style={input} placeholder="Game title" value={playtimeForm.game} onChange={(event) => setPlaytimeForm((prev) => ({ ...prev, game: event.target.value }))} />
                  <select style={input} value={playtimeForm.platform} onChange={(event) => setPlaytimeForm((prev) => ({ ...prev, platform: event.target.value }))}>{PLATFORMS.map((entry) => <option key={entry.value || "any"} value={entry.value}>{entry.label}</option>)}</select>
                  <select style={input} value={playtimeForm.providerKey} onChange={(event) => setPlaytimeForm((prev) => ({ ...prev, providerKey: event.target.value }))}><option value="">Any provider</option>{LINK_PROVIDERS.map((entry) => <option key={entry.value} value={entry.value}>{entry.label}</option>)}</select>
                  <input style={input} type="number" placeholder="Claimed hours" value={playtimeForm.hours} onChange={(event) => setPlaytimeForm((prev) => ({ ...prev, hours: event.target.value }))} />
                  <input style={input} placeholder="Evidence image URL" value={playtimeForm.evidenceUrl} onChange={(event) => setPlaytimeForm((prev) => ({ ...prev, evidenceUrl: event.target.value }))} />
                  <input style={input} placeholder="Notes" value={playtimeForm.notes} onChange={(event) => setPlaytimeForm((prev) => ({ ...prev, notes: event.target.value }))} />
                </div>
                <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
                  <button type="button" style={button} disabled={saving} onClick={() => void runAction("playtime", "submitEvidence", { userId: playtimeForm.userId || viewerUserId, game: playtimeForm.game, platform: playtimeForm.platform, providerKey: playtimeForm.providerKey, claimedHours: Number(playtimeForm.hours || 0), evidenceUrl: playtimeForm.evidenceUrl, notes: playtimeForm.notes }, "Submitted playtime evidence for staff review.")}>Submit Evidence</button>
                </div>
                {canManageGaming ? <details style={{ marginTop: 10 }}>
                  <summary style={{ cursor: "pointer", fontWeight: 800 }}>Staff Direct Record</summary>
                  <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
                    <select style={input} value={playtimeForm.sourceKey} onChange={(event) => setPlaytimeForm((prev) => ({ ...prev, sourceKey: event.target.value }))}>{SOURCES.map((entry) => <option key={entry.value} value={entry.value}>{entry.label}</option>)}</select>
                    <input style={input} placeholder="Target Discord user ID" value={playtimeForm.userId} onChange={(event) => setPlaytimeForm((prev) => ({ ...prev, userId: event.target.value }))} />
                    <button type="button" style={button} disabled={saving} onClick={() => void runAction("playtime", "recordHours", { ...playtimeForm, userId: playtimeForm.userId || viewerUserId, providerKey: playtimeForm.providerKey, hours: Number(playtimeForm.hours || 0), mergeMode: "set" }, "Playtime record saved.")}>Staff Record Hours</button>
                  </div>
                </details> : null}
              </div>

              <div style={card}>
                <div style={{ fontWeight: 800, marginBottom: 8 }}>Top Recorded Hours</div>
                <div style={{ display: "grid", gap: 8 }}>
                  {playtimeLeaders.length ? playtimeLeaders.map((entry) => <div key={`${entry.userId}-${entry.rank}`}><div style={{ fontWeight: 700 }}>#{entry.rank} {entry.name}</div><div style={{ color: "#ffb3b3", fontSize: 12 }}>{entry.value}</div></div>) : <div style={{ color: "#ffb3b3" }}>No recorded hours yet.</div>}
                </div>
              </div>
            </div>

            <div style={{ marginTop: 12, display: "grid", gap: 8 }}>
              {playtimeClaims.length ? playtimeClaims.map((entry) => <div key={entry.id} style={{ ...card, marginBottom: 0 }}><div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}><div><div style={{ fontWeight: 700 }}>{entry.title}</div><div style={{ color: "#ffb3b3", fontSize: 12 }}>{entry.value}</div></div>{entry.status === "pending" && canManageGaming ? <div style={{ display: "flex", gap: 8 }}><button type="button" style={button} disabled={saving} onClick={() => void runAction("playtime", "reviewEvidence", { claimId: entry.id, decision: "approved" }, "Approved playtime evidence claim.")}>Approve</button><button type="button" style={button} disabled={saving} onClick={() => void runAction("playtime", "reviewEvidence", { claimId: entry.id, decision: "rejected" }, "Rejected playtime evidence claim.")}>Reject</button></div> : null}</div></div>) : <div style={{ color: "#ffb3b3" }}>No pending evidence claims.</div>}
            </div>

            <div style={{ marginTop: 12, display: "grid", gap: 8 }}>
              {playtimeRecords.length ? playtimeRecords.map((entry) => <div key={entry.id} style={{ ...card, marginBottom: 0 }}><div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}><div><div style={{ fontWeight: 700 }}>{entry.title}</div><div style={{ color: "#ffb3b3", fontSize: 12 }}>{entry.value}</div></div>{canManageGaming ? <button type="button" style={button} disabled={saving} onClick={() => void runAction("playtime", "removeRecord", { recordId: entry.id }, "Playtime record removed.")}>Remove</button> : null}</div></div>) : <div style={{ color: "#ffb3b3" }}>No playtime records yet.</div>}
            </div>
          </div>

          <div style={card}><h3 style={sectionTitle}>Showoff Card</h3><fieldset disabled={!canManageGaming} style={lockedGroup}><div style={{ display: "grid", gridTemplateColumns: "repeat(4,minmax(160px,1fr))", gap: 10 }}><label><input type="checkbox" checked={Boolean(getValue(engines.showoff, ["enabled"], true))} onChange={(event) => updateConfig("showoff", { enabled: event.target.checked })} /> Enabled</label><label><input type="checkbox" checked={Boolean(getValue(engines.showoff, ["includeLinks"], true))} onChange={(event) => updateConfig("showoff", { includeLinks: event.target.checked })} /> Links</label><label><input type="checkbox" checked={Boolean(getValue(engines.showoff, ["includePresence"], true))} onChange={(event) => updateConfig("showoff", { includePresence: event.target.checked })} /> Presence</label><label><input type="checkbox" checked={Boolean(getValue(engines.showoff, ["includeStats"], true))} onChange={(event) => updateConfig("showoff", { includeStats: event.target.checked })} /> Stats</label></div><div style={{ display: "grid", gridTemplateColumns: "repeat(4,minmax(160px,1fr))", gap: 10, marginTop: 10 }}><label><input type="checkbox" checked={Boolean(getValue(engines.showoff, ["includePlaytime"], true))} onChange={(event) => updateConfig("showoff", { includePlaytime: event.target.checked })} /> Playtime</label><input style={input} placeholder="Accent color" value={getValue(engines.showoff, ["accentColor"], "#b91c1c")} onChange={(event) => updateConfig("showoff", { accentColor: event.target.value })} /><input style={input} placeholder="Card title" value={getValue(engines.showoff, ["cardTitle"], "{{user}} Gamer Card")} onChange={(event) => updateConfig("showoff", { cardTitle: event.target.value })} /><input style={input} placeholder="Headline" value={getValue(engines.showoff, ["headline"], "Unified game profile card")} onChange={(event) => updateConfig("showoff", { headline: event.target.value })} /></div><div style={{ marginTop: 10 }}><input style={input} placeholder="Notes" value={getValue(engines.showoff, ["notes"], "")} onChange={(event) => updateConfig("showoff", { notes: event.target.value })} /></div><div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}><button type="button" style={button} disabled={saving} onClick={() => void saveConfig("showoff", engines.showoff.config || {}, "Saved showoff card settings.")}>Save Showoff Engine</button></div></fieldset><div style={{ marginTop: 12, display: "grid", gap: 8 }}>{showoffRows.length ? showoffRows.map((entry, index) => <div key={`${entry.userId || entry.title}-${index}`} style={{ ...card, marginBottom: 0 }}><div style={{ fontWeight: 700 }}>{entry.title}</div><div style={{ color: "#ffb3b3", fontSize: 12 }}>{entry.value}</div></div>) : <div style={{ color: "#ffb3b3" }}>No preview candidates yet.</div>}</div></div>

          <div style={card}><h3 style={sectionTitle}>Squad Finder</h3><fieldset disabled={!canManageGaming} style={lockedGroup}><div style={{ display: "grid", gridTemplateColumns: "repeat(4,minmax(160px,1fr))", gap: 10 }}><label><input type="checkbox" checked={Boolean(getValue(engines.squadFinder, ["enabled"], true))} onChange={(event) => updateConfig("squadFinder", { enabled: event.target.checked })} /> Enabled</label><label><input type="checkbox" checked={Boolean(getValue(engines.squadFinder, ["autoCreateThread"], true))} onChange={(event) => updateConfig("squadFinder", { autoCreateThread: event.target.checked })} /> Auto thread</label><select style={input} value={getValue(engines.squadFinder, ["defaultChannelId"], "")} onChange={(event) => updateConfig("squadFinder", { defaultChannelId: event.target.value })}><option value="">Default LFG channel</option>{messageChannels.map((channel) => <option key={channel.id} value={channel.id}>{formatChannelLabel(channel, channels)}</option>)}</select><input style={input} type="number" placeholder="Default TTL (hours)" value={getValue(engines.squadFinder, ["defaultTtlHours"], 6)} onChange={(event) => updateConfig("squadFinder", { defaultTtlHours: Number(event.target.value || 0) })} /></div><div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}><button type="button" style={button} disabled={saving} onClick={() => void saveConfig("squadFinder", engines.squadFinder.config || {}, "Saved squad finder settings.")}>Save Squad Finder</button><button type="button" style={button} disabled={saving} onClick={() => void runAction("squadFinder", "closeAllSessions", {}, "Closed all active squad sessions.")}>Close All Sessions</button></div></fieldset><div style={{ marginTop: 12, display: "grid", gap: 8 }}>{squadRows.length ? squadRows.map((entry) => <div key={entry.sessionId} style={{ ...card, marginBottom: 0 }}><div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}><div><div style={{ fontWeight: 700 }}>{entry.title}</div><div style={{ color: "#ffb3b3", fontSize: 12 }}>{entry.value}</div></div><button type="button" style={button} disabled={saving || !canManageGaming} onClick={() => void runAction("squadFinder", "closeSession", { sessionId: entry.sessionId }, "Squad session closed.")}>Close</button></div></div>) : <div style={{ color: "#ffb3b3" }}>No active squad sessions.</div>}</div></div>
        </>
      ) : null}
    </div>
  );
}
