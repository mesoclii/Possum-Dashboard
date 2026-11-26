"use client";

import { useEffect, useState } from "react";
import type { CSSProperties, FormEvent } from "react";
import Link from "next/link";
import GameSocialClient from "@/components/possum/GameSocialClient";
import PublicSquads from "@/components/possum/PublicSquads";

type AccountLink = { label: string; url: string; verified?: boolean; provider?: string };
type GameStat = { game: string; platform: string; hours: string; progress: string };
type PublicGameStat = { game: string; platform: string; hours: number; progress: string };
type Profile = { nickname: string; game: string; contactHandle: string; accounts: AccountLink[]; gameStats: PublicGameStat[] };
type VerifiedAccount = { provider: string; label: string; url: string; verified: true };
type Guild = { id: string; name: string };
const providerNames: Record<string, string> = { twitch: "Twitch", youtube: "YouTube", reddit: "Reddit", x: "X", tiktok: "TikTok", steam: "Steam", battlenet: "Battle.net", epic: "Epic Games", xbox: "Xbox", bungie: "Bungie" };
const panel: CSSProperties = { border: "1px solid #ff2e75", borderRadius: 16, padding: 20, background: "#21000e" };
const input: CSSProperties = { width: "100%", padding: 10, border: "1px solid #ff2e75", borderRadius: 8, color: "#fff", background: "#16000b" };
const button: CSSProperties = { padding: "10px 16px", borderRadius: 8, border: "1px solid #ff2e75", color: "#fff", background: "#a7003e", cursor: "pointer", fontWeight: 700 };

export default function PublicGamingPage() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);
  const [loggedIn, setLoggedIn] = useState(false);
  const [sessionLoaded, setSessionLoaded] = useState(false);
  const [guestReady, setGuestReady] = useState(false);
  const [userId, setUserId] = useState("");
  const [guilds, setGuilds] = useState<Guild[]>([]);
  const [guildId, setGuildId] = useState("");
  const [guildLoading, setGuildLoading] = useState(false);
  const [guildError, setGuildError] = useState("");
  const [tab, setTab] = useState<"community" | "squads" | "directory">("community");
  const [ownLoaded, setOwnLoaded] = useState(false);
  const [own, setOwn] = useState<Profile | null>(null);
  const [nickname, setNickname] = useState("");
  const [game, setGame] = useState("");
  const [contactHandle, setContactHandle] = useState("");
  const [accountLinks, setAccountLinks] = useState<AccountLink[]>([]);
  const [verifiedAccounts, setVerifiedAccounts] = useState<VerifiedAccount[]>([]);
  const [linkedProviders, setLinkedProviders] = useState<string[]>([]);
  const [linkedAccountsConsent, setLinkedAccountsConsent] = useState(false);
  const [gameStats, setGameStats] = useState<GameStat[]>([{ game: "", platform: "", hours: "", progress: "" }]);
  const [filter, setFilter] = useState("");
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function loadProfiles() {
    const response = await fetch("/api/public-gaming", { cache: "no-store" });
    const data = await response.json();
    if (!response.ok || !data.success) throw new Error(data.error || "Public profiles are unavailable.");
    setProfiles(data.profiles);
  }

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("tab") === "squads") setTab("squads");
    const query = new URLSearchParams(window.location.search);
    const providerAuth = query.get("providerAuth");
    if (providerAuth) {
      setMessage(query.get("authMessage") || `${providerNames[query.get("provider") || ""] || "Provider"} ${providerAuth === "success" ? "linked and verified" : "linking failed"}.`);
      query.delete("providerAuth");
      query.delete("provider");
      query.delete("authMessage");
      window.history.replaceState({}, "", `${window.location.pathname}${query.toString() ? `?${query}` : ""}${window.location.hash}`);
    }
    void loadProfiles().catch(() => {
      setUnavailable(true);
      setMessage("Public profiles are unavailable. Please try again later.");
    }).finally(() => setLoading(false));
    void (async () => {
      let discordUserId = "";
      try {
        const sessionResponse = await fetch("/api/auth/session?brief=1", { cache: "no-store" });
        const session = sessionResponse.ok ? await sessionResponse.json() : null;
        if (session?.loggedIn) {
          discordUserId = String(session.user?.id || "");
          setLoggedIn(Boolean(discordUserId));
          setUserId(discordUserId);
        }
      } catch {}

      if (discordUserId) {
        setGuildLoading(true);
        try {
          const guildResponse = await fetch("/api/guilds/installed", { cache: "no-store" });
          const guildData = await guildResponse.json();
          if (!guildResponse.ok || !guildData.success) throw new Error(guildData.error || "Could not load your communities.");
          const available: Guild[] = (Array.isArray(guildData.guilds) ? guildData.guilds : [])
            .filter((entry: Guild) => typeof entry?.id === "string" && typeof entry?.name === "string")
            .map((entry: Guild) => ({ id: entry.id, name: entry.name }));
          setGuilds(available);
          const previous = window.localStorage.getItem("activeGuildId");
          setGuildId(available.find((entry) => entry.id === previous)?.id || available[0]?.id || "");
        } catch (error) {
          setGuildError(error instanceof Error ? error.message : "Could not load your communities.");
        } finally {
          setGuildLoading(false);
        }
      }

      try {
        if (!discordUserId) await fetch("/api/personal-social/guest", { cache: "no-store" });
        const response = await fetch("/api/public-gaming?me=1", { cache: "no-store" });
        const data = await response.json();
        if (!response.ok || !data.success) throw new Error(data.error || "Your public Gaming Hub profile is unavailable.");
        const linkedResponse = await fetch("/api/public-gaming/linked-accounts", { cache: "no-store" });
        const linkedData = linkedResponse.ok ? await linkedResponse.json() : { accounts: [] };
        const linked = Array.isArray(linkedData.accounts) ? linkedData.accounts.filter((entry: any) => entry?.verified === true && typeof entry.provider === "string") : [];
        setVerifiedAccounts(linked);
        setOwn(data.profile);
        setOwnLoaded(true);
        setGuestReady(true);
        setNickname(data.profile?.nickname || "");
        setGame(data.profile?.game || "");
        setContactHandle(data.profile?.contactHandle || "");
        const publishedVerified = (data.profile?.accounts || []).filter((entry: AccountLink) => entry.verified && linked.some((account: VerifiedAccount) => account.provider === entry.provider && account.url === entry.url));
        setLinkedProviders(publishedVerified.map((entry: AccountLink) => entry.provider!));
        setLinkedAccountsConsent(publishedVerified.length > 0);
        setAccountLinks((data.profile?.accounts || []).filter((entry: AccountLink) => !entry.verified || !linked.some((account: VerifiedAccount) => account.provider === entry.provider && account.url === entry.url)));
        setGameStats(Array.isArray(data.profile?.gameStats) && data.profile.gameStats.length
          ? data.profile.gameStats.map((entry: PublicGameStat) => ({ ...entry, hours: String(entry.hours) }))
          : [{ game: "", platform: "", hours: "", progress: "" }]);
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Your public Gaming Hub profile is unavailable.");
      } finally {
        setSessionLoaded(true);
      }
    })();
  }, []);

  useEffect(() => {
    const refresh = () => {
      void loadProfiles().then(() => setUnavailable(false)).catch(() => {
        setProfiles([]);
        setUnavailable(true);
      });
    };
    const timer = window.setInterval(refresh, 15000);
    window.addEventListener("focus", refresh);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", refresh);
    };
  }, []);

  async function update(action: "publish" | "revoke") {
    setBusy(true);
    setMessage("");
    try {
      const publicGameStats = gameStats.filter((entry) => entry.game.trim()).map((entry) => ({
        game: entry.game,
        platform: entry.platform,
        hours: Number(entry.hours || 0),
        progress: entry.progress,
      }));
      const response = await fetch("/api/public-gaming", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action, nickname, game, contactHandle, accounts: accountLinks, gameStats: publicGameStats, consent,
          linkedProviders: action === "publish" ? linkedProviders : [],
          linkedAccountsConsent: action === "publish" && linkedAccountsConsent,
        }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || "Update failed.");
      setOwn(data.profile);
      setOwnLoaded(true);
      const savedAccounts = action === "revoke" || !Array.isArray(data.profile?.accounts) ? [] : data.profile.accounts;
      setAccountLinks(savedAccounts.filter((entry: AccountLink) => !entry.verified));
      setLinkedProviders(savedAccounts.filter((entry: AccountLink) => entry.verified && typeof entry.provider === "string").map((entry: AccountLink) => entry.provider!));
      setLinkedAccountsConsent(action === "publish" && savedAccounts.some((entry: AccountLink) => entry.verified));
      setGameStats(action === "revoke" || !Array.isArray(data.profile?.gameStats) || !data.profile.gameStats.length
        ? [{ game: "", platform: "", hours: "", progress: "" }]
        : data.profile.gameStats.map((entry: PublicGameStat) => ({ ...entry, hours: String(entry.hours) })));
      setConsent(false);
      if (action === "revoke") setContactHandle("");
      setMessage(action === "revoke" ? "Public sharing revoked." : "Your public profile is published.");
      try {
        await loadProfiles();
        setUnavailable(false);
      } catch {
        setProfiles([]);
        setUnavailable(true);
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Update failed.");
    } finally {
      setBusy(false);
    }
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    void update("publish");
  }

  function updateAccountLink(index: number, field: keyof AccountLink, value: string) {
    setAccountLinks((current) => current.map((entry, entryIndex) => entryIndex === index ? { ...entry, [field]: value } : entry));
  }

  function updateGameStat(index: number, field: keyof GameStat, value: string) {
    setGameStats((current) => current.map((entry, entryIndex) => entryIndex === index ? { ...entry, [field]: value } : entry));
  }

  const visible = profiles.filter((entry) => `${entry.nickname} ${entry.game} ${entry.contactHandle} ${entry.accounts.map((account) => `${account.label} ${account.url}`).join(" ")} ${(entry.gameStats || []).map((stat) => `${stat.game} ${stat.platform} ${stat.hours} ${stat.progress}`).join(" ")}`.toLowerCase().includes(filter.trim().toLowerCase()));
  return (
    <main style={{ minHeight: "100vh", padding: "32px 16px 70px", color: "#ffe0e8", background: "radial-gradient(ellipse at 85% 0%, #5b082e 0%, transparent 36%), radial-gradient(ellipse at 0% 40%, #3b071f 0%, transparent 40%), #10000b" }}>
      <div style={{ maxWidth: 1380, margin: "auto", display: "grid", gap: 20 }}>
        <header style={{ ...panel, padding: "clamp(22px, 5vw, 48px)", background: "linear-gradient(120deg, #260016 5%, #440920 60%, #17000f)", boxShadow: "0 0 42px #ff00662b" }}>
          <Link href="/" style={{ color: "#ff9ebc" }}>← Possum home</Link>
          <p style={{ color: "#ff79a9", letterSpacing: ".18em", textTransform: "uppercase", fontSize: 12, marginTop: 24 }}>Find your people · play together</p>
          <h1 style={{ color: "#fff2f7", fontSize: "clamp(2.4rem, 7vw, 5rem)", lineHeight: 1.05, margin: "12px 0", fontWeight: 900 }}>Possum <span style={{ color: "#ff3982" }}>Gaming Hub</span></h1>
          <p style={{ maxWidth: 680, color: "#f4b7ce", fontSize: 17 }}>Discover players, find a squad, and bring your gaming community together.</p>
          <p style={{ color: "#ffc4d9", fontSize: 14 }}>Public introductions are opt-in. Server activity stays within its authorized community.</p>
        </header>
        <nav aria-label="Gaming Hub sections" style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
          <button type="button" aria-pressed={tab === "community"} style={{ ...button, background: tab === "community" ? "#d40050" : "#290016" }} onClick={() => setTab("community")}>Your gaming community</button>
          <button type="button" aria-pressed={tab === "squads"} style={{ ...button, background: tab === "squads" ? "#d40050" : "#290016" }} onClick={() => setTab("squads")}>Find a squad</button>
          <button type="button" aria-pressed={tab === "directory"} style={{ ...button, background: tab === "directory" ? "#d40050" : "#290016" }} onClick={() => setTab("directory")}>Public player directory</button>
        </nav>
        <section style={panel} aria-labelledby="discord-community">
          <h2 id="discord-community">Play your way</h2>
          <p>Create a public gaming profile, add your gamer tags and account links, share your game hours and progress, and find a squad without signing in to Discord. Discord is optional for people who also want activity from their server community.</p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
            <a href="https://discord.com/app" target="_blank" rel="noopener noreferrer" style={{ ...button, display: "inline-block", textDecoration: "none" }}>Use Discord in your browser</a>
            <a href="https://discord.com/download" target="_blank" rel="noopener noreferrer" style={{ ...button, display: "inline-block", textDecoration: "none" }}>Download Discord</a>
            <a href="/api/auth/discord/invite" style={{ ...button, display: "inline-block", textDecoration: "none" }}>Add Possum Bot to a server</a>
          </div>
        </section>
        {tab === "squads" && !loggedIn && !guestReady ? <section style={panel} role="status">Preparing your private Gaming Hub profile…</section> : null}
        {tab === "squads" && (loggedIn || guestReady) && <div style={panel}><PublicSquads loggedIn /></div>}
        {tab === "community" && <section style={panel} aria-labelledby="community-hub">
          <h2 id="community-hub" style={{ fontSize: 24, margin: "0 0 8px", color: "#fff" }}>Your gaming community</h2>
          <p style={{ color: "#efb4c9" }}>Public profiles, manually added gamer tags, self-reported playtime and progress, and public squads work without Discord. Sign in only if you also want private activity from a Discord community you belong to.</p>
          {!sessionLoaded ? <p role="status">Checking your session…</p> : !loggedIn ? (
            <div style={{ display: "grid", gap: 10 }}>
              <p>Public profiles, account links, reported game progress, and squads work without Discord. Discord sign-in is optional and only adds activity from a server where you are a member.</p>
              <button type="button" style={{ ...button, justifySelf: "start" }} onClick={() => setTab("directory")}>Set up your public gamer profile</button>
              <a href="/api/auth/discord/login?returnTo=%2Fgaming" style={{ color: "#ff9ebc" }}>Optionally connect Discord for server activity</a>
            </div>
          ) : guildLoading ? <p role="status">Finding your communities…</p> : guildError ? (
            <p role="alert">{guildError} Refresh the page to retry.</p>
          ) : !guilds.length ? (
            <p>No accessible communities were found. Join a Discord server with Possum Bot to use its Gaming Hub.</p>
          ) : (
            <>
              <label htmlFor="gaming-community" style={{ display: "block", marginBottom: 8 }}>Choose a community</label>
              <select id="gaming-community" style={{ ...input, maxWidth: 480, marginBottom: 20 }} value={guildId} onChange={(event) => setGuildId(event.target.value)}>
                {guilds.map((guild) => <option value={guild.id} key={guild.id}>{guild.name}</option>)}
              </select>
              {guildId && <GameSocialClient key={`${guildId}:${userId}`} guildId={guildId} guildName={guilds.find((guild) => guild.id === guildId)?.name || ""} mode="member" authenticatedUserId={userId} />}
            </>
          )}
        </section>}
        {tab === "directory" && <>
        <section style={panel} aria-labelledby="public-players">
          <h2 id="public-players" style={{ color: "#fff", fontSize: 24, margin: "0 0 8px" }}>Meet the players</h2>
          <p style={{ color: "#efb4c9", marginBottom: 16 }}>Explore introductions shared by players across the community.</p>
          <label htmlFor="public-filter">Filter by nickname, game or contact handle</label>
          <input id="public-filter" style={{ ...input, marginTop: 8 }} value={filter} onChange={(event) => setFilter(event.target.value)} />
          {loading ? <p>Loading profiles…</p> : unavailable ? <p>Public profiles are unavailable.</p> : visible.length ? (
            <ul style={{ padding: 0, listStyle: "none", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 240px), 1fr))", gap: 12, marginTop: 16 }}>
              {visible.map((entry, index) => <li key={`${entry.nickname}-${entry.game}-${index}`} style={{ border: "1px solid #8a2450", borderRadius: 14, padding: 18, background: "linear-gradient(145deg, #39051e, #19000e)" }}><strong style={{ color: "#fff", fontSize: 18 }}>{entry.nickname}</strong><div style={{ color: "#ff81ad", marginTop: 8 }}>{entry.game}</div>{entry.contactHandle ? <div style={{ color: "#ffd0df", marginTop: 10, overflowWrap: "anywhere" }}>Public contact: {entry.contactHandle}</div> : null}{entry.accounts.length ? <div style={{ display: "grid", gap: 6, marginTop: 12 }}><strong style={{ color: "#ffd0df", fontSize: 13 }}>Player accounts</strong>{entry.accounts.map((account, accountIndex) => <span key={`${account.label}-${accountIndex}`} style={{ color: "#ff9ebc", overflowWrap: "anywhere" }}>{account.url ? <a href={account.url} target="_blank" rel="noopener noreferrer" style={{ color: "inherit" }}>{account.label}</a> : account.label}{account.verified ? ` · Verified ${providerNames[account.provider || ""] || "provider"}` : " · self-reported"}</span>)}</div> : null}</li>)}
            </ul>
          ) : <p style={{ ...panel, marginTop: 16, color: "#f4b7ce" }}>{filter ? "No matching public profiles." : "No public profiles yet. Publish an introduction below to get started."}</p>}
          {visible.some((entry) => entry.gameStats?.length) && <div style={{ marginTop: 18 }}>
            <h3 style={{ color: "#fff" }}>Games, hours and progress</h3>
            <ul style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 240px), 1fr))", gap: 10, listStyle: "none", padding: 0 }}>
              {visible.flatMap((entry, profileIndex) => (entry.gameStats || []).map((stat, statIndex) => <li key={profileIndex + "-" + statIndex} style={{ border: "1px solid #8a2450", borderRadius: 12, padding: 14, background: "#19000e" }}>
                <strong>{entry.nickname}</strong><div style={{ color: "#ff81ad", marginTop: 6 }}>{stat.game}{stat.platform ? " · " + stat.platform : ""}</div>
                <div>{stat.hours} hours · self-reported</div>{stat.progress ? <div>{stat.progress}</div> : null}
              </li>))}
            </ul>
          </div>}
          <small>Up to 200 published profiles are shown.</small>
        </section>
        <section style={panel} aria-labelledby="public-sharing">
          <h2 id="public-sharing">Your public gaming profile</h2>
          <p>Publishing is optional and separate from Discord. Your nickname, featured game, contact handle, account links and game progress are visible to everyone online until you revoke them. Account links and progress are self-reported, not provider-verified. This browser keeps the private key to manage your profile; clearing its site data removes your access to it.</p>
          {!ownLoaded ? <p role="status">Preparing your private profile on this browser…</p> : (
            <>
              <p>{!ownLoaded ? "Your sharing status is unavailable." : own ? "Your introduction is currently public." : "You have not published an introduction."}</p>
              <form onSubmit={submit} style={{ display: "grid", gap: 12 }}>
                <label>Public nickname <input style={input} required maxLength={40} value={nickname} onChange={(event) => setNickname(event.target.value)} /></label>
                <label>Game <input style={input} required maxLength={80} value={game} onChange={(event) => setGame(event.target.value)} /></label>
                <label>Public contact handle (optional; visible to everyone) <input style={input} maxLength={80} autoComplete="off" value={contactHandle} onChange={(event) => setContactHandle(event.target.value)} /></label>
                <div style={{ display: "grid", gap: 10 }}>
                  <div><strong>Games, hours and progress</strong><p style={{ margin: "4px 0 0", color: "#efb4c9" }}>Add the games you want other players to see. Hours and progress are your own entries.</p></div>
                  {gameStats.map((stat, index) => <div key={index} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 180px), 1fr)) auto", gap: 8, alignItems: "end" }}>
                    <label>Game <input style={input} required={Boolean(stat.game || stat.hours || stat.platform || stat.progress)} maxLength={80} value={stat.game} onChange={(event) => updateGameStat(index, "game", event.target.value)} /></label>
                    <label>Platform <input style={input} maxLength={40} value={stat.platform} onChange={(event) => updateGameStat(index, "platform", event.target.value)} /></label>
                    <label>Hours played <input style={input} type="number" min={0} max={100000} step="0.1" required={Boolean(stat.game)} value={stat.hours} onChange={(event) => updateGameStat(index, "hours", event.target.value)} /></label>
                    <label>Progress or stats <input style={input} maxLength={120} value={stat.progress} onChange={(event) => updateGameStat(index, "progress", event.target.value)} /></label>
                    <button type="button" disabled={busy || gameStats.length <= 1} style={button} onClick={() => setGameStats((current) => current.filter((_, entryIndex) => entryIndex !== index))}>Remove</button>
                  </div>)}
                  <button type="button" disabled={busy || gameStats.length >= 20} style={{ ...button, justifySelf: "start" }} onClick={() => setGameStats((current) => [...current, { game: "", platform: "", hours: "", progress: "" }])}>Add a game</button>
                </div>
                <div style={{ display: "grid", gap: 10 }}>
                  <div><strong>Link your gaming and social accounts</strong><p style={{ margin: "4px 0 0", color: "#efb4c9" }}>Verify supported accounts with their provider, without Discord. Verification does not import private stats. Choose separately which verified names and links to publish.</p></div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>{["steam", "epic", "battlenet", "xbox", "bungie"].map((provider) => <a key={provider} href={`/api/games/auth/guest/start?provider=${provider}`} style={{ ...button, display: "inline-block", textDecoration: "none" }}>Connect {providerNames[provider]}</a>)}</div>
                  <div><a href="/personal-social" style={{ color: "#ffc4d9" }}>Connect Twitch, YouTube, Reddit, X or TikTok</a> · Discord is optional.</div>
                  {verifiedAccounts.length ? <div style={{ display: "grid", gap: 6 }}><strong>Choose verified accounts to publish</strong>{verifiedAccounts.map((account) => <label key={account.provider}><input type="checkbox" checked={linkedProviders.includes(account.provider)} onChange={(event) => { if (event.target.checked && accountLinks.length + linkedProviders.length >= 8) { setMessage("A public profile can include up to 8 account links total."); return; } setLinkedProviders((current) => event.target.checked ? [...current, account.provider] : current.filter((provider) => provider !== account.provider)); setLinkedAccountsConsent(false); }} /> Publish verified {providerNames[account.provider] || account.provider} account: {account.label}</label>)}{linkedProviders.length > 0 ? <label><input type="checkbox" checked={linkedAccountsConsent} onChange={(event) => setLinkedAccountsConsent(event.target.checked)} /> I specifically agree to publish the selected verified account names and links to everyone online.</label> : null}</div> : <p>No verified accounts linked yet. You can connect providers above or add public URLs manually.</p>}
                  {accountLinks.map((account, index) => <div key={index} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 220px), 1fr)) auto", gap: 8, alignItems: "end" }}>
                    <label>Platform or account name <input style={input} required maxLength={40} value={account.label} onChange={(event) => updateAccountLink(index, "label", event.target.value)} /></label>
                    <label>Public profile URL <input style={input} required type="url" maxLength={300} placeholder="https://…" value={account.url} onChange={(event) => updateAccountLink(index, "url", event.target.value)} /></label>
                    <button type="button" disabled={busy} style={button} onClick={() => setAccountLinks((current) => current.filter((_, entryIndex) => entryIndex !== index))}>Remove</button>
                  </div>)}
                  <button type="button" disabled={busy || accountLinks.length + linkedProviders.length >= 8} style={{ ...button, justifySelf: "start" }} onClick={() => setAccountLinks((current) => [...current, { label: "", url: "" }])}>Add account link</button>
                </div>
                <label><input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} /> I explicitly agree to publish the profile, account links and game details entered above to everyone online until I revoke sharing.</label>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
                  <button type="submit" disabled={busy || !consent || !ownLoaded || (linkedProviders.length > 0 && !linkedAccountsConsent)} style={button}>{own ? "Update public introduction" : "Publish introduction"}</button>
                  <button type="button" disabled={busy} style={button} onClick={() => void update("revoke")}>Revoke public sharing</button>
                </div>
              </form>
            </>
          )}
        </section>
        </>}
        {message && <p role="status">{message}</p>}
      </div>
    </main>
  );
}
