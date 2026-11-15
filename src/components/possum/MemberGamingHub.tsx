"use client";

import { useEffect, useMemo, useState } from "react";
import type { CSSProperties, FormEvent, ReactNode } from "react";
import { possum } from "@/styles/possumTheme";

type Payload = {
  config?: Record<string, any>;
  summary?: Array<{ label: string; value: string }>;
  details?: Record<string, any>;
  loadError?: string;
};

type EngineMap = Record<string, Payload>;
type EngineKey = "gameIdentity" | "privacyConsent" | "presenceFusion" | "playtime" | "squadFinder" | "gameProvider" | "showoff" | "searchAnything";
type Props = {
  guildId: string;
  guildName: string;
  viewerUserId: string;
  engines: EngineMap;
  loading: boolean;
  saving: boolean;
  message: string;
  warnings: string[];
  adminHref?: string;
  onReload: () => void;
  onAction: (engine: EngineKey, action: string, payload: Record<string, unknown>, success: string) => Promise<any>;
  buildConnectHref: (providerKey: string, platform?: string) => string;
};

const colors = {
  page: "#000000",
  panel: "rgba(10, 0, 0, .94)",
  panelSoft: "rgba(20, 0, 0, .82)",
  line: possum.border,
  text: "#ffd3d3",
  muted: "#ff9e9e",
  accent: "#ff2e75",
  accentSoft: "rgba(255, 46, 117, .16)",
  warning: "#ff4a4a",
};

const panel: CSSProperties = {
  border: `1px solid ${colors.line}`,
  borderRadius: 16,
  padding: 18,
  background: colors.panel,
  boxShadow: possum.glowSoft,
};

const field: CSSProperties = {
  width: "100%",
  color: colors.text,
  background: "#070707",
  border: `1px solid ${colors.line}`,
  borderRadius: 10,
  padding: "11px 12px",
};

const button: CSSProperties = {
  border: `1px solid ${colors.line}`,
  borderRadius: 10,
  padding: "10px 13px",
  color: colors.text,
  background: colors.panelSoft,
  fontWeight: 700,
  cursor: "pointer",
};

const tabs = [
  ["overview", "Overview"],
  ["players", "Players"],
  ["profile", "My Profile"],
  ["stats", "Statistics"],
  ["alerts", "Social Alerts"],
  ["search", "Search Anything"],
] as const;

const PRIVACY_TOGGLES = [
  "shareLinkedIdentities",
  "sharePresence",
  "shareStats",
  "sharePlaytime",
  "shareSquads",
  "allowShowoffCard",
  "notifyLiveFriends",
] as const;

const EMPTY_PRIVACY: Record<string, any> = {};

function rows(value: any): any[] {
  return Array.isArray(value) ? value : [];
}

function getSummary(payload: Payload | undefined, label: string, fallback = "0") {
  return payload?.summary?.find((entry) => entry.label === label)?.value || fallback;
}

function formatDuration(minutes: number) {
  const total = Math.max(0, Math.floor(minutes));
  const hours = Math.floor(total / 60);
  const mins = total % 60;
  if (hours >= 24) return `${Math.floor(hours / 24)}d ${hours % 24}h`;
  if (hours) return `${hours}h ${mins}m`;
  return `${mins}m`;
}

function elapsedSince(value: string, now: number) {
  const started = Date.parse(value || "");
  return Number.isFinite(started) && started <= now ? formatDuration((now - started) / 60000) : "";
}

function listItems(value: any, separators: RegExp) {
  const values = Array.isArray(value) ? value : String(value || "").split(separators);
  return values.map((entry) => String(entry || "").trim()).filter(Boolean);
}

function normalizeProviderKey(value: any) {
  const key = String(value || "").trim().toLowerCase();
  if (["microsoft", "microsoftaccount", "minecraft"].includes(key)) return "xbox";
  if (["wow", "overwatch2", "diablo4"].includes(key)) return "battlenet";
  if (["fortnite", "rocketleague"].includes(key)) return "epic";
  if (key === "destiny2") return "bungie";
  return key;
}

function Card({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return <section style={{ ...panel, ...style }}>{children}</section>;
}

function Heading({ children, detail }: { children: ReactNode; detail?: string }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <h2 style={{ margin: 0, fontSize: 18, color: colors.text }}>{children}</h2>
      {detail ? <div style={{ marginTop: 5, color: colors.muted, fontSize: 13 }}>{detail}</div> : null}
    </div>
  );
}

function Empty({ children }: { children: ReactNode }) {
  return <div style={{ padding: "18px 4px", color: colors.muted, fontSize: 14 }}>{children}</div>;
}

export default function MemberGamingHub({
  guildId,
  guildName,
  viewerUserId,
  engines,
  loading,
  saving,
  message,
  warnings,
  adminHref,
  onReload,
  onAction,
  buildConnectHref,
}: Props) {
  const identity = engines.gameIdentity || {};
  const memberState = identity.details?.memberSelfService || engines.privacyConsent?.details?.memberSelfService || {};
  const privacy = memberState.privacy || EMPTY_PRIVACY;
  const searchConfig = engines.searchAnything?.config || {};
  const [activeTab, setActiveTab] = useState<(typeof tabs)[number][0]>("overview");
  const [now, setNow] = useState(0);
  const [gameFilter, setGameFilter] = useState("");
  const [platformFilter, setPlatformFilter] = useState("");
  const [favoriteGames, setFavoriteGames] = useState(() => listItems(privacy.favoriteGames, /[,;\n]+/));
  const [favoriteGameInput, setFavoriteGameInput] = useState("");
  const [lookingForTeam, setLookingForTeam] = useState(() => Boolean(privacy.lookingForTeam));
  const [privacyValues, setPrivacyValues] = useState<Record<string, boolean>>(() => Object.fromEntries(
    PRIVACY_TOGGLES.map((key) => [key, Boolean(privacy[key])]),
  ));
  const [watchlistUserIds, setWatchlistUserIds] = useState(() => listItems(privacy.watchlistUserIds, /[,;\s]+/));
  const [watchlistInput, setWatchlistInput] = useState("");
  const [manualAccountInputs, setManualAccountInputs] = useState<Record<string, string>>({});
  const [profileInputError, setProfileInputError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchProvider, setSearchProvider] = useState(() => String(searchConfig.defaultProvider || ""));
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [psnOnlineId, setPsnOnlineId] = useState("");
  const [squadForm, setSquadForm] = useState({ game: "", mode: "", platform: "", neededCount: 2, note: "" });

  const players = rows(identity.details?.players);
  const livePlayers = rows(engines.presenceFusion?.details?.livePlayers);
  const sessions = rows(engines.presenceFusion?.details?.sessions);
  const ownSessions = sessions.filter((entry) => String(entry.userId) === viewerUserId);
  const ownIdentities = rows(memberState.identities);
  const notifications = rows(memberState.notifications);
  const providers = rows(identity.details?.authProviders);
  const providerCatalog = rows(identity.details?.providers);
  const stats = rows(engines.gameProvider?.details?.stats);
  const playtimeRecords = rows(engines.playtime?.details?.records);
  const squads = rows(engines.squadFinder?.details?.activeSquads);
  const enabledSearchProviders = rows(searchConfig.providers).filter((entry) => entry.enabled !== false);
  const viewer = identity.details?.viewer || {};
  const totalHours = getSummary(engines.playtime, "Total Hours", "0");

  function accountProviderKeyFor(value: any) {
    const key = normalizeProviderKey(value);
    const catalogEntry = providerCatalog.find((entry) => normalizeProviderKey(entry.key) === key);
    return normalizeProviderKey(catalogEntry?.accountProviderKey || key);
  }

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30_000);
    const initialTimer = window.setTimeout(() => setNow(Date.now()), 0);
    return () => {
      window.clearInterval(timer);
      window.clearTimeout(initialTimer);
    };
  }, []);

  const gameOptions = [...new Set(players.flatMap((player) => [
    ...(player.currentGame ? [player.currentGame] : []),
    ...rows(player.favoriteGames),
  ]))].sort((a, b) => String(a).localeCompare(String(b)));
  const platformOptions = [...new Set(players.flatMap((player) => rows(player.platforms)))].sort();
  const visiblePlayers = players.filter((player) => {
    const gameMatches = !gameFilter ||
      String(player.currentGame || "").toLowerCase() === gameFilter.toLowerCase() ||
      rows(player.favoriteGames).some((game) => String(game).toLowerCase() === gameFilter.toLowerCase());
    const platformMatches = !platformFilter || rows(player.platforms).includes(platformFilter);
    return gameMatches && platformMatches;
  });

  const topGames = useMemo(() => {
    const totals = new Map<string, number>();
    for (const record of playtimeRecords) {
      const label = String(record.gameLabel || record.title || "").replace(/^.* - /, "");
      if (!label) continue;
      totals.set(label, (totals.get(label) || 0) + Number(record.hours || 0));
    }
    return [...totals.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
  }, [playtimeRecords]);
  const topPlatforms = useMemo(() => {
    const totals = new Map<string, number>();
    for (const record of playtimeRecords) {
      const label = String(record.platformLabel || "").trim();
      if (label) totals.set(label, (totals.get(label) || 0) + Number(record.hours || 0));
    }
    return [...totals.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4);
  }, [playtimeRecords]);

  const sevenDaySessions = useMemo(() => {
    const cutoff = now - 7 * 24 * 60 * 60 * 1000;
    return ownSessions.filter((session) => Date.parse(session.endedAt || "") >= cutoff);
  }, [ownSessions, now]);
  const weeklyTrend = useMemo(() => Array.from({ length: 7 }, (_, index) => {
    const date = new Date(now);
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() - (6 - index));
    const nextDate = new Date(date);
    nextDate.setDate(nextDate.getDate() + 1);
    const daySessions = ownSessions.filter((session) => {
      const endedAt = Date.parse(session.endedAt || "");
      return endedAt >= date.getTime() && endedAt < nextDate.getTime();
    });
    return {
      label: date.toLocaleDateString(undefined, { weekday: "short" }),
      count: daySessions.length,
      minutes: daySessions.reduce((sum, session) => sum + Number(session.durationMinutes || 0), 0),
    };
  }), [ownSessions, now]);

  function addFavoriteGame(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const game = favoriteGameInput.trim().replace(/\s+/g, " ");
    if (!game) {
      setProfileInputError("Enter a game name before adding it.");
      return;
    }
    if (favoriteGames.some((entry) => entry.toLowerCase() === game.toLowerCase())) {
      setProfileInputError("That game is already in your favorites.");
      return;
    }
    if (favoriteGames.length >= 12) {
      setProfileInputError("You can save up to 12 favorite games.");
      return;
    }
    setFavoriteGames((current) => [...current, game.slice(0, 80)]);
    setFavoriteGameInput("");
    setProfileInputError("");
  }

  function addWatchedMember(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const userId = watchlistInput.trim();
    if (!/^\d{17,20}$/.test(userId)) {
      setProfileInputError("Enter a Discord user ID that is 17 to 20 digits long.");
      return;
    }
    if (watchlistUserIds.includes(userId)) {
      setProfileInputError("That Discord user ID is already on your list.");
      return;
    }
    if (watchlistUserIds.length >= 25) {
      setProfileInputError("You can watch up to 25 Discord members.");
      return;
    }
    setWatchlistUserIds((current) => [...current, userId]);
    setWatchlistInput("");
    setProfileInputError("");
  }

  async function saveManualAccount(providerKey: string, providerTitle: string) {
    const handle = String(manualAccountInputs[providerKey] || "").trim();
    if (!handle) return;
    const result = await onAction("gameIdentity", "upsertIdentity", {
      providerKey,
      handle,
      visibility: "server",
    }, `Saved your ${providerTitle} profile link.`);
    if (result) {
      setManualAccountInputs((current) => ({ ...current, [providerKey]: "" }));
    }
  }

  async function linkPlaystation() {
    const onlineId = psnOnlineId.trim();
    if (!onlineId) return;
    const result = await onAction("gameIdentity", "upsertIdentity", {
      providerKey: "playstation",
      handle: onlineId,
    }, "PlayStation account linked.");
    if (result) setPsnOnlineId("");
  }

  async function saveProfile() {
    await onAction("privacyConsent", "saveProfile", {
      profile: {
        ...privacy,
        ...privacyValues,
        favoriteGames: [...new Set(favoriteGames.map((value) => value.trim()).filter(Boolean))].slice(0, 12),
        lookingForTeam,
        watchlistUserIds: [...new Set(watchlistUserIds)].slice(0, 25),
      },
    }, "Saved your gaming profile.");
  }

  async function search() {
    const result = await onAction("searchAnything", "previewQuery", {
      query: searchQuery,
      providerKey: searchProvider || String(searchConfig.defaultProvider || ""),
    }, "Search results are ready.");
    const data = result?.result || result;
    setSearchResults(rows(data?.quickLinks).length ? data.quickLinks : data?.url ? [{
      key: data.providerKey,
      label: data.providerLabel || "Search results",
      url: data.url,
    }] : []);
  }

  async function createSquad(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = await onAction("squadFinder", "createSession", squadForm, "Your squad listing is live.");
    if (result) setSquadForm({ game: "", mode: "", platform: "", neededCount: 2, note: "" });
  }

  function isInSquad(squad: any) {
    return rows(squad.members).some((member) => String(member.userId) === viewerUserId);
  }

  function renderOverview() {
    return (
      <div style={{ display: "grid", gap: 14 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,150px),1fr))", gap: 12 }}>
          {[
            ["Playing now", String(livePlayers.length)],
            ["Open squads", String(squads.length)],
            ["Tracked hours", totalHours],
            ["Linked accounts", String(ownIdentities.length)],
          ].map(([label, value]) => (
            <Card key={label} style={{ padding: 16, background: colors.panelSoft }}>
              <div style={{ color: colors.muted, fontSize: 12 }}>{label}</div>
              <div style={{ color: colors.accent, fontWeight: 900, fontSize: 25, marginTop: 5 }}>{value}</div>
            </Card>
          ))}
        </div>
        <Card>
          <Heading detail="Discord activity as observed by Possum Bot. Durations use real tracked timestamps.">
            Live gaming activity
          </Heading>
          {livePlayers.length ? (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,260px),1fr))", gap: 10 }}>
              {livePlayers.map((player) => {
                const elapsed = elapsedSince(String(player.startedAt || ""), now);
                return (
                  <div key={player.userId} style={{ ...panel, padding: 14, background: colors.panelSoft }}>
                    <div style={{ fontWeight: 800 }}>{player.title}</div>
                    <div style={{ color: colors.accent, fontSize: 16, marginTop: 5 }}>Playing {player.gameLabel || player.value.split(" | ")[0]}</div>
                    <div style={{ color: colors.muted, fontSize: 12, marginTop: 5 }}>
                      {elapsed
                        ? player.startedAtSource === "discord_activity"
                          ? `Playing for ${elapsed} · activity started ${new Date(player.startedAt).toLocaleTimeString()}`
                          : `Observed playing for ${elapsed} · tracked since ${new Date(player.startedAt).toLocaleTimeString()}`
                        : "Start time unavailable"}
                    </div>
                    {player.activityDetails || player.activityState ? (
                      <div style={{ color: colors.muted, fontSize: 12, marginTop: 5 }}>{[player.activityDetails, player.activityState].filter(Boolean).join(" · ")}</div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          ) : <Empty>No members are currently visible as gaming. Activity only appears when Discord reports it and privacy allows sharing.</Empty>}
        </Card>
        <Card>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
            <Heading detail="Find active listings and join a community squad.">Looking for a group</Heading>
            <button type="button" style={button} onClick={() => setActiveTab("players")}>Find players</button>
          </div>
          {squads.length ? (
            <div style={{ display: "grid", gap: 8 }}>
              {squads.slice(0, 4).map((squad) => (
                <div key={squad.sessionId} style={{ padding: 12, border: `1px solid ${colors.line}`, borderRadius: 12 }}>
                  <strong>{squad.title}</strong>
                  <div style={{ color: colors.muted, fontSize: 13, marginTop: 4 }}>{squad.value}</div>
                  <button type="button" style={{ ...button, marginTop: 9 }} disabled={saving} onClick={() => setActiveTab("players")}>View squad</button>
                </div>
              ))}
            </div>
          ) : <Empty>No open squad listings right now. Start one from Players.</Empty>}
        </Card>
      </div>
    );
  }

  function renderPlayers() {
    return (
      <div style={{ display: "grid", gap: 14 }}>
        <Card>
          <Heading detail="Discover members by live game, saved interests, and platform. Profiles respect each member&apos;s privacy settings.">
            Player discovery
          </Heading>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,190px),1fr))", gap: 9, marginBottom: 12 }}>
            <select style={field} value={gameFilter} onChange={(event) => setGameFilter(event.target.value)}>
              <option value="">All games</option>
              {gameOptions.map((game) => <option key={game} value={game}>{game}</option>)}
            </select>
            <select style={field} value={platformFilter} onChange={(event) => setPlatformFilter(event.target.value)}>
              <option value="">All platforms</option>
              {platformOptions.map((platform) => <option key={platform} value={platform}>{platform}</option>)}
            </select>
          </div>
          {visiblePlayers.length ? (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,270px),1fr))", gap: 10 }}>
              {visiblePlayers.map((player) => (
                <div key={player.userId} style={{ ...panel, padding: 14, background: colors.panelSoft }}>
                  <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                    {player.avatarUrl ? <img src={player.avatarUrl} alt="" width={42} height={42} style={{ borderRadius: "50%", objectFit: "cover" }} /> : <div aria-hidden="true" style={{ width: 42, height: 42, borderRadius: "50%", display: "grid", placeItems: "center", background: colors.accentSoft, color: colors.accent, fontWeight: 800 }}>{String(player.name || "?").slice(0, 1).toUpperCase()}</div>}
                    <div>
                      <div style={{ fontWeight: 800 }}>{player.name}</div>
                      {player.isPlaying ? <div style={{ color: colors.accent, fontSize: 12 }}>Playing {player.currentGame}</div> : player.lookingForTeam ? <div style={{ color: colors.warning, fontSize: 12 }}>Looking for teammates</div> : null}
                    </div>
                  </div>
                  {rows(player.favoriteGames).length ? <div style={{ color: colors.muted, marginTop: 9, fontSize: 13 }}>Games: {player.favoriteGames.join(", ")}</div> : null}
                  {rows(player.platforms).length ? <div style={{ color: colors.muted, marginTop: 5, fontSize: 12 }}>Platforms: {player.platforms.join(", ")}</div> : null}
                  {player.totalHours !== null && player.totalHours !== undefined ? <div style={{ color: colors.muted, marginTop: 5, fontSize: 12 }}>Tracked playtime: {Number(player.totalHours).toFixed(1)}h</div> : null}
                  {player.lastSeenGamingAt && !player.isPlaying ? <div style={{ color: colors.muted, marginTop: 5, fontSize: 12 }}>Last seen gaming: {new Date(player.lastSeenGamingAt).toLocaleString()}</div> : null}
                </div>
              ))}
            </div>
          ) : <Empty>No discoverable gaming profiles match those filters yet.</Empty>}
        </Card>

        <Card>
          <Heading detail="Create a listing in the server&apos;s configured Squad Finder channel.">Find teammates</Heading>
          <form onSubmit={(event) => void createSquad(event)} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,190px),1fr))", gap: 9 }}>
            <input required style={field} maxLength={80} placeholder="Game" value={squadForm.game} onChange={(event) => setSquadForm((prev) => ({ ...prev, game: event.target.value }))} />
            <input style={field} maxLength={60} placeholder="Mode / queue (optional)" value={squadForm.mode} onChange={(event) => setSquadForm((prev) => ({ ...prev, mode: event.target.value }))} />
            <select style={field} value={squadForm.platform} onChange={(event) => setSquadForm((prev) => ({ ...prev, platform: event.target.value }))}>
              <option value="">Any platform</option>
              <option value="pc">PC</option><option value="xbox">Xbox</option><option value="playstation">PlayStation</option><option value="switch">Switch</option><option value="mobile">Mobile</option>
            </select>
            <select style={field} value={squadForm.neededCount} onChange={(event) => setSquadForm((prev) => ({ ...prev, neededCount: Number(event.target.value) }))}>
              {[1, 2, 3, 4, 5].map((count) => <option key={count} value={count}>Need {count} teammate{count === 1 ? "" : "s"}</option>)}
            </select>
            <input style={field} maxLength={240} placeholder="Short note (optional)" value={squadForm.note} onChange={(event) => setSquadForm((prev) => ({ ...prev, note: event.target.value }))} />
            <button type="submit" style={{ ...button, color: colors.page, background: colors.accent, borderColor: colors.accent }} disabled={saving || !squadForm.game.trim()}>Post squad listing</button>
          </form>
        </Card>

        <Card>
          <Heading detail="Active member-created listings that match community privacy settings.">Open squads</Heading>
          {squads.length ? (
            <div style={{ display: "grid", gap: 9 }}>
              {squads.map((squad) => {
                const joined = isInSquad(squad);
                const isOwner = String(squad.ownerId) === viewerUserId;
                return (
                  <div key={squad.sessionId} style={{ border: `1px solid ${colors.line}`, borderRadius: 12, padding: 13 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                      <div><strong>{squad.title}</strong><div style={{ color: colors.muted, fontSize: 13, marginTop: 4 }}>{squad.value}</div></div>
                      <div style={{ display: "flex", gap: 7, alignItems: "start" }}>
                        {isOwner ? <button type="button" style={button} disabled={saving} onClick={() => void onAction("squadFinder", "closeOwnedSession", { sessionId: squad.sessionId }, "Closed your squad listing.")}>Close listing</button> : null}
                        {!isOwner ? <button type="button" style={button} disabled={saving || (!joined && Number(squad.members?.length || 0) >= Number(squad.capacity || 0))} onClick={() => void onAction("squadFinder", joined ? "leaveSession" : "joinSession", { sessionId: squad.sessionId }, joined ? "Left the squad." : "Joined the squad.")}>{joined ? "Leave" : "Join"}</button> : null}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : <Empty>No open squads match your server&apos;s current setup.</Empty>}
        </Card>
      </div>
    );
  }

  function renderProfile() {
    return (
      <div style={{ display: "grid", gap: 14 }}>
        <Card>
          <div style={{ display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap" }}>
            {viewer.avatarUrl ? <img src={viewer.avatarUrl} alt="" width={64} height={64} style={{ borderRadius: "50%", objectFit: "cover" }} /> : null}
            <div>
              <h2 style={{ margin: 0 }}>{viewer.name || "My gaming profile"}</h2>
              <div style={{ color: colors.muted, marginTop: 4 }}>{guildName || guildId} · Discord member</div>
              <div style={{ color: colors.accent, marginTop: 4 }}>{viewer.isPlaying ? `Playing ${viewer.currentGame}` : "Not currently reported as gaming"}</div>
            </div>
          </div>
        </Card>
        <Card>
          <Heading detail="Connect through each platform's existing secure sign-in. Account actions are scoped to your Discord user.">Linked accounts</Heading>
          <div style={{ display: "grid", gap: 8 }}>
            {providers.map((provider) => {
              const providerKey = normalizeProviderKey(provider.key);
              const linked = ownIdentities.find((entry) => accountProviderKeyFor(entry.providerKey) === providerKey);
              return (
                <div key={provider.key} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap", padding: 12, border: `1px solid ${colors.line}`, borderRadius: 12 }}>
                  <div>
                    <strong>{provider.title}</strong>
                    <div style={{ color: linked ? colors.accent : colors.muted, fontSize: 12, marginTop: 3 }}>
                      {linked ? "Linked" : provider.ready ? "Not linked" : provider.manualOnly ? "Manual profile link available" : "Provider sign-in setup required"}
                    </div>
                    {!linked && provider.mode !== "psn_service" && (!provider.ready || provider.manualOnly) ? (
                      <div style={{ color: colors.muted, fontSize: 12, marginTop: 3 }}>Manual profile links do not authenticate or enable provider sync.</div>
                    ) : null}
                  </div>
                  {linked ? (
                    <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
                      {provider.ready && provider.mode === "psn_service" ? (
                        <button type="button" style={button} disabled={saving} onClick={() => void onAction("gameProvider", "refreshProviderUser", { providerKey: linked.providerKey, platform: linked.platformKey }, "Refreshed your PlayStation connection.")}>Refresh connection</button>
                      ) : provider.ready ? (
                        <a href={buildConnectHref(provider.key)} style={{ ...button, textDecoration: "none" }}>Refresh connection</a>
                      ) : null}
                      <button type="button" style={button} disabled={saving} onClick={() => void onAction("gameIdentity", "removeIdentity", { providerKey: linked.providerKey, platform: linked.platformKey }, "Disconnected your linked account.")}>Disconnect</button>
                    </div>
                  ) : provider.mode === "psn_service" ? (
                    provider.ready ? (
                      <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
                        <input style={{ ...field, width: 190 }} aria-label="PlayStation Online ID" placeholder="PlayStation Online ID" value={psnOnlineId} onChange={(event) => setPsnOnlineId(event.target.value)} />
                        <button type="button" style={button} disabled={saving || !psnOnlineId.trim()} onClick={() => void linkPlaystation()}>Link PlayStation</button>
                      </div>
                    ) : <span style={{ color: colors.muted, fontSize: 12 }}>PlayStation service setup is required.</span>
                  ) : provider.ready ? (
                    <a href={buildConnectHref(provider.key)} style={{ ...button, textDecoration: "none" }}>Connect</a>
                  ) : (
                    <form onSubmit={(event) => { event.preventDefault(); void saveManualAccount(provider.key, provider.title); }} style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
                      <input
                        style={{ ...field, width: 210 }}
                        maxLength={120}
                        aria-label={`${provider.title} account name or ID`}
                        placeholder="Account name or ID"
                        value={manualAccountInputs[provider.key] || ""}
                        onChange={(event) => setManualAccountInputs((current) => ({ ...current, [provider.key]: event.target.value }))}
                      />
                      <button type="submit" style={button} disabled={saving || !String(manualAccountInputs[provider.key] || "").trim()}>Save profile link</button>
                    </form>
                  )}
                </div>
              );
            })}
            {!providers.length ? <Empty>No platform account options are currently available.</Empty> : null}
          </div>
        </Card>
        <Card>
          <Heading detail="Choose what you share with other members. Private account credentials are never displayed here.">Profile and privacy</Heading>
          <div style={{ marginBottom: 14 }}>
            <label htmlFor="favorite-game-input">Favorite games</label>
            <form onSubmit={addFavoriteGame} style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) auto", gap: 8, marginTop: 6 }}>
              <input id="favorite-game-input" style={field} maxLength={80} value={favoriteGameInput} onChange={(event) => setFavoriteGameInput(event.target.value)} placeholder="Add one game" />
              <button type="submit" style={button} disabled={favoriteGames.length >= 12 || !favoriteGameInput.trim()}>Add game</button>
            </form>
            <div style={{ display: "flex", gap: 7, flexWrap: "wrap", marginTop: 8 }}>
              {favoriteGames.map((game) => (
                <div key={game} style={{ display: "flex", gap: 8, alignItems: "center", padding: "6px 9px", border: `1px solid ${colors.line}`, borderRadius: 10, background: colors.panelSoft }}>
                  <span>{game}</span>
                  <button type="button" style={{ ...button, padding: "3px 7px" }} aria-label={`Remove ${game} from favorite games`} onClick={() => setFavoriteGames((current) => current.filter((entry) => entry !== game))}>Remove</button>
                </div>
              ))}
              {!favoriteGames.length ? <span style={{ color: colors.muted, fontSize: 12 }}>No favorite games added yet.</span> : null}
            </div>
          </div>
          <div style={{ marginBottom: 14 }}>
            <label htmlFor="watchlist-user-input">Watched Discord member IDs for personal live alerts</label>
            <form onSubmit={addWatchedMember} style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) auto", gap: 8, marginTop: 6 }}>
              <input id="watchlist-user-input" style={field} inputMode="numeric" maxLength={20} value={watchlistInput} onChange={(event) => setWatchlistInput(event.target.value)} placeholder="Add one Discord user ID" />
              <button type="submit" style={button} disabled={watchlistUserIds.length >= 25 || !watchlistInput.trim()}>Add member</button>
            </form>
            <div style={{ display: "grid", gap: 7, marginTop: 8 }}>
              {watchlistUserIds.map((userId) => (
                <div key={userId} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, padding: "8px 10px", border: `1px solid ${colors.line}`, borderRadius: 10, background: colors.panelSoft }}>
                  <span>{userId}</span>
                  <button type="button" style={{ ...button, padding: "5px 8px" }} aria-label={`Remove watched Discord member ${userId}`} onClick={() => setWatchlistUserIds((current) => current.filter((entry) => entry !== userId))}>Remove</button>
                </div>
              ))}
              {!watchlistUserIds.length ? <span style={{ color: colors.muted, fontSize: 12 }}>No members on your alert list yet.</span> : null}
            </div>
          </div>
          {profileInputError ? <div role="alert" style={{ color: colors.warning, marginBottom: 10 }}>{profileInputError}</div> : null}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,210px),1fr))", gap: 8 }}>
            {[
              ["shareLinkedIdentities", "Share linked accounts"],
              ["sharePresence", "Share gaming activity"],
              ["shareStats", "Share favorites and stats"],
              ["sharePlaytime", "Share tracked playtime"],
              ["shareSquads", "Share squad activity"],
              ["allowShowoffCard", "Allow gamer profile card"],
              ["lookingForTeam", "Show that I want teammates"],
              ["notifyLiveFriends", "Alert me when watched players go live"],
            ].map(([key, label]) => (
              <label key={key} style={{ display: "flex", gap: 8, alignItems: "center", padding: 10, border: `1px solid ${colors.line}`, borderRadius: 10 }}>
                <input type="checkbox" checked={key === "lookingForTeam" ? lookingForTeam : Boolean(privacyValues[key])} onChange={(event) => key === "lookingForTeam" ? setLookingForTeam(event.target.checked) : setPrivacyValues((prev) => ({ ...prev, [key]: event.target.checked }))} />
                {label}
              </label>
            ))}
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
            <button type="button" style={{ ...button, color: colors.page, background: colors.accent }} disabled={saving} onClick={() => void saveProfile()}>Save profile</button>
            <button type="button" style={button} disabled={saving} onClick={() => void onAction("privacyConsent", "clearNotifications", {}, "Cleared your personal alerts.")}>Clear my alerts</button>
          </div>
        </Card>
      </div>
    );
  }

  function renderStats() {
    return (
      <div style={{ display: "grid", gap: 14 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,170px),1fr))", gap: 12 }}>
          <Card><div style={{ color: colors.muted, fontSize: 12 }}>Tracked playtime</div><div style={{ color: colors.accent, fontWeight: 900, fontSize: 24, marginTop: 6 }}>{totalHours}h</div></Card>
          <Card><div style={{ color: colors.muted, fontSize: 12 }}>Recorded sessions</div><div style={{ color: colors.accent, fontWeight: 900, fontSize: 24, marginTop: 6 }}>{ownSessions.length}</div></Card>
          <Card><div style={{ color: colors.muted, fontSize: 12 }}>This week</div><div style={{ color: colors.accent, fontWeight: 900, fontSize: 24, marginTop: 6 }}>{sevenDaySessions.length} sessions</div></Card>
        </div>
        <Card>
          <Heading detail="Only recorded hours from linked providers and Discord-observed sessions are counted.">Most-played games</Heading>
          {topGames.length ? <div style={{ display: "grid", gap: 8 }}>{topGames.map(([game, hours]) => <div key={game} style={{ display: "flex", justifyContent: "space-between", gap: 10, padding: 10, background: colors.panelSoft, borderRadius: 9 }}><span>{game}</span><strong>{hours.toFixed(1)}h</strong></div>)}</div> : <Empty>No tracked playtime records yet.</Empty>}
        </Card>
        <Card>
          <Heading detail="Daily totals from your recorded Discord gaming sessions.">Activity trends · last 7 days</Heading>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7,minmax(0,1fr))", gap: 7, alignItems: "end", minHeight: 112 }}>
            {weeklyTrend.map((day) => {
              const maxMinutes = Math.max(1, ...weeklyTrend.map((entry) => entry.minutes));
              const height = day.minutes ? Math.max(6, (day.minutes / maxMinutes) * 70) : 3;
              return <div key={day.label} style={{ display: "grid", justifyItems: "center", gap: 5 }} title={`${day.count} sessions, ${formatDuration(day.minutes)}`}><div style={{ height, width: "100%", maxWidth: 42, borderRadius: 7, background: day.minutes ? colors.accent : colors.line }} /><span style={{ color: colors.muted, fontSize: 11 }}>{day.label}</span></div>;
            })}
          </div>
          {topPlatforms.length ? <div style={{ color: colors.muted, fontSize: 13, marginTop: 12 }}>Favorite platforms by tracked hours: {topPlatforms.map(([platform, hours]) => `${platform} (${hours.toFixed(1)}h)`).join(" · ")}</div> : null}
        </Card>
        <Card>
          <Heading detail="Session start and end times are recorded from Discord presence events. Short sessions appear here even when below the playtime-credit threshold.">Recent gaming sessions</Heading>
          {ownSessions.length ? <div style={{ display: "grid", gap: 8 }}>{ownSessions.slice(0, 30).map((session) => <div key={session.id} style={{ padding: 11, background: colors.panelSoft, borderRadius: 9 }}><div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}><strong>{session.gameLabel}</strong><span style={{ color: colors.accent }}>{formatDuration(Number(session.durationMinutes || 0))}</span></div><div style={{ color: colors.muted, fontSize: 12, marginTop: 4 }}>{new Date(session.startedAt).toLocaleString()} – {new Date(session.endedAt).toLocaleString()}</div></div>)}</div> : <Empty>No completed gaming sessions have been tracked for your profile yet.</Empty>}
        </Card>
        <Card>
          <Heading detail="Provider snapshots are shown only when the linked game service supplied them.">Game statistics</Heading>
          {stats.length ? <div style={{ display: "grid", gap: 8 }}>{stats.map((entry, index) => <div key={entry.id || `${entry.title}-${index}`} style={{ padding: 10, background: colors.panelSoft, borderRadius: 9 }}><strong>{entry.title}</strong><div style={{ color: colors.muted, fontSize: 12, marginTop: 4 }}>{entry.value}</div></div>)}</div> : <Empty>No game-stat snapshots are available yet.</Empty>}
        </Card>
      </div>
    );
  }

  function renderAlerts() {
    return (
      <Card>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", gap: 12, flexWrap: "wrap" }}>
          <Heading detail="Personal gaming notices for your Discord account. Server-wide relay settings remain staff-only.">Social Alerts</Heading>
          <button type="button" style={button} disabled={saving || !notifications.length} onClick={() => void onAction("privacyConsent", "clearNotifications", {}, "Cleared your personal alerts.")}>Clear alerts</button>
        </div>
        {notifications.length ? <div style={{ display: "grid", gap: 8 }}>{notifications.map((entry, index) => <div key={entry.id || `${entry.title}-${index}`} style={{ padding: 12, border: `1px solid ${colors.line}`, borderRadius: 10 }}><strong>{entry.title}</strong><div style={{ color: colors.muted, marginTop: 5, fontSize: 13 }}>{entry.detail}</div>{entry.createdAt ? <div style={{ color: colors.muted, marginTop: 5, fontSize: 11 }}>{new Date(entry.createdAt).toLocaleString()}</div> : null}</div>)}</div> : <Empty>You have no gaming alerts right now.</Empty>}
      </Card>
    );
  }

  function renderSearch() {
    return (
      <Card>
        <Heading detail="Search with providers enabled by this server. Results open on the provider&apos;s live search page.">Search Anything</Heading>
        {!searchConfig.enabled ? <Empty>Search Anything has not been enabled by this server&apos;s administrators yet.</Empty> : enabledSearchProviders.length ? (
          <>
            <label style={{ display: "block", marginBottom: 10 }}>
              Search provider
              <select style={{ ...field, marginTop: 6 }} value={searchProvider || String(searchConfig.defaultProvider || "")} onChange={(event) => setSearchProvider(event.target.value)}>
                {enabledSearchProviders.map((provider) => <option key={provider.key} value={provider.key}>{provider.label}</option>)}
              </select>
            </label>
            <label style={{ display: "block", marginBottom: 10 }}>
              What are you looking for?
              <input style={{ ...field, marginTop: 6 }} maxLength={180} value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void search(); }} placeholder="Games, guides, communities, and more" />
            </label>
            <button type="button" style={{ ...button, color: colors.page, background: colors.accent }} disabled={saving || !searchQuery.trim()} onClick={() => void search()}>{saving ? "Searching..." : "Search"}</button>
            {searchResults.length ? <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 14 }}>{searchResults.map((result) => <a key={result.key || result.url} href={result.url} target="_blank" rel="noreferrer" style={{ ...button, textDecoration: "none" }}>{result.label || "Open results"}</a>)}</div> : null}
          </>
        ) : <Empty>No search providers are enabled for this server yet.</Empty>}
      </Card>
    );
  }

  const content = {
    overview: renderOverview,
    players: renderPlayers,
    profile: renderProfile,
    stats: renderStats,
    alerts: renderAlerts,
    search: renderSearch,
  }[activeTab];

  return (
    <div style={{ color: colors.text, width: "100%", minWidth: 0, display: "grid", gap: 14 }}>
      <header style={{ ...panel, padding: "22px clamp(16px, 3vw, 30px)", background: "radial-gradient(ellipse at 85% 0%, rgba(255,0,0,.16), transparent 42%), linear-gradient(135deg, #050000, #100000 70%, #1a0000)" }}>
        <div style={{ color: colors.accent, fontSize: 11, letterSpacing: ".18em", textTransform: "uppercase", fontWeight: 800 }}>Possum community</div>
        <h1 style={{ margin: "8px 0 4px", fontSize: "clamp(25px, 5vw, 38px)", letterSpacing: "-.03em" }}>Gaming Hub</h1>
        <div style={{ color: colors.muted }}>{guildName || guildId} · players, profiles, sessions, and teams</div>
        {viewer.name ? <div style={{ color: colors.text, marginTop: 10 }}>Welcome back, {viewer.name}</div> : null}
        {adminHref ? <a href={adminHref} style={{ display: "inline-block", marginTop: 12, color: colors.accent, fontSize: 13, fontWeight: 700 }}>Server gaming settings</a> : null}
      </header>

      <nav aria-label="Gaming Hub sections" style={{ display: "flex", gap: 7, overflowX: "auto", padding: "2px 0 5px" }}>
        {tabs.map(([key, label]) => (
          <button key={key} type="button" role="tab" aria-selected={activeTab === key} style={{ ...button, whiteSpace: "nowrap", borderColor: activeTab === key ? colors.accent : colors.line, background: activeTab === key ? colors.accentSoft : colors.panel }} onClick={() => setActiveTab(key)}>{label}</button>
        ))}
      </nav>

      {message ? <div role="status" style={{ padding: "10px 13px", borderRadius: 10, border: `1px solid ${colors.line}`, color: colors.accent }}>{message}</div> : null}
      {warnings.length ? <div role="alert" style={{ ...panel, color: colors.warning }}>Some hub data could not be loaded: {warnings.join(" · ")} <button type="button" style={{ ...button, marginLeft: 8 }} disabled={loading} onClick={onReload}>Retry</button></div> : null}
      {loading ? <Card><Empty>Loading your gaming community…</Empty></Card> : content()}
    </div>
  );
}
