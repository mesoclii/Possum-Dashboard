"use client";

import { useEffect, useState } from "react";
import type { CSSProperties, FormEvent } from "react";
import Link from "next/link";
import PublicSquads from "@/components/possum/PublicSquads";

type AccountLink = { label: string; url: string };
type GameStat = { game: string; platform: string; hours: number; progress: string };
type Profile = { nickname: string; game: string; contactHandle: string; discordTag?: string; accounts: AccountLink[]; gameStats: GameStat[] };
const panel: CSSProperties = { border: "1px solid #ff2e75", borderRadius: 16, padding: 20, background: "#21000e" };
const input: CSSProperties = { width: "100%", padding: 10, border: "1px solid #ff2e75", borderRadius: 8, color: "#fff", background: "#16000b" };
const button: CSSProperties = { padding: "10px 16px", borderRadius: 8, border: "1px solid #ff2e75", color: "#fff", background: "#a7003e", cursor: "pointer", fontWeight: 700 };

export default function PublicGamingPage() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);
  const [loggedIn, setLoggedIn] = useState(false);
  const [sessionLoaded, setSessionLoaded] = useState(false);
  const [discordTag, setDiscordTag] = useState("");
  const [shareDiscordTag, setShareDiscordTag] = useState(false);
  const [tab, setTab] = useState<"squads" | "directory">("directory");
  const [ownLoaded, setOwnLoaded] = useState(false);
  const [own, setOwn] = useState<Profile | null>(null);
  const [nickname, setNickname] = useState("");
  const [game, setGame] = useState("");
  const [contactHandle, setContactHandle] = useState("");
  const [accounts, setAccounts] = useState<AccountLink[]>([]);
  const [gameStats, setGameStats] = useState<GameStat[]>([]);
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
    void loadProfiles().catch(() => {
      setUnavailable(true);
      setMessage("Public profiles are unavailable. Please try again later.");
    }).finally(() => setLoading(false));
    void (async () => {
      try {
        const guestResponse = await fetch("/api/public-gaming/guest", { cache: "no-store" });
        if (!guestResponse.ok) throw new Error("Private Gaming Hub session unavailable");
        const sessionResponse = await fetch("/api/auth/session?brief=1", { cache: "no-store" });
        const session = sessionResponse.ok ? await sessionResponse.json() : { loggedIn: false };
        setLoggedIn(Boolean(session.loggedIn));
        setDiscordTag(String(session.user?.username || ""));
        setSessionLoaded(true);
        const response = await fetch("/api/public-gaming?me=1", { cache: "no-store" });
        const data = await response.json();
        if (!response.ok || !data.success) throw new Error();
        setOwn(data.profile);
        setOwnLoaded(true);
        setNickname(data.profile?.nickname || "");
        setGame(data.profile?.game || "");
        setContactHandle(data.profile?.contactHandle || "");
        setAccounts(data.profile?.accounts || []);
        setGameStats(data.profile?.gameStats || []);
        setShareDiscordTag(Boolean(data.profile?.discordTag));
      } catch {
        setMessage("A private Gaming Hub profile could not be opened. Please refresh and try again.");
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
      const response = await fetch("/api/public-gaming", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, nickname, game, contactHandle, accounts, gameStats, consent, shareDiscordTag }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || "Update failed.");
      setOwn(data.profile);
      setOwnLoaded(true);
      setShareDiscordTag(Boolean(data.profile?.discordTag));
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

  const visible = profiles.filter((entry) => `${entry.nickname} ${entry.game} ${entry.contactHandle} ${entry.discordTag || ""} ${entry.accounts.map((item) => item.label).join(" ")} ${entry.gameStats.map((item) => `${item.game} ${item.platform} ${item.progress}`).join(" ")}`.toLowerCase().includes(filter.trim().toLowerCase()));
  return (
    <main style={{ minHeight: "100vh", padding: "32px 16px 70px", color: "#ffe0e8", background: "radial-gradient(ellipse at 85% 0%, #5b082e 0%, transparent 36%), radial-gradient(ellipse at 0% 40%, #3b071f 0%, transparent 40%), #10000b" }}>
      <div style={{ maxWidth: 1380, margin: "auto", display: "grid", gap: 20 }}>
        <header style={{ ...panel, padding: "clamp(22px, 5vw, 48px)", background: "linear-gradient(120deg, #260016 5%, #440920 60%, #17000f)", boxShadow: "0 0 42px #ff00662b" }}>
          <Link href="/" style={{ color: "#ff9ebc" }}>← Possum home</Link>
          <p style={{ color: "#ff79a9", letterSpacing: ".18em", textTransform: "uppercase", fontSize: 12, marginTop: 24 }}>Find your people · play together</p>
          <h1 style={{ color: "#fff2f7", fontSize: "clamp(2.4rem, 7vw, 5rem)", lineHeight: 1.05, margin: "12px 0", fontWeight: 900 }}>Possum <span style={{ color: "#ff3982" }}>Gaming Hub</span></h1>
          <p style={{ maxWidth: 680, color: "#f4b7ce", fontSize: 17 }}>Discover players worldwide and find a squad. The public directory is global; it does not depend on sharing a Discord server with Possum Bot.</p>
          <p style={{ color: "#ffc4d9", fontSize: 14 }}>Anyone can browse. Each player chooses what to publish, and can remove it at any time.</p>
          <p style={{ color: "#ffc4d9", fontSize: 14 }}>Discord is optional. <a href="https://discord.com/download" target="_blank" rel="noreferrer" style={{ color: "#ffd3e1" }}>Get Discord</a> if you want to connect with a Discord community too.</p>
        </header>
        <nav aria-label="Gaming Hub sections" style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
          <button type="button" aria-pressed={tab === "squads"} style={{ ...button, background: tab === "squads" ? "#d40050" : "#290016" }} onClick={() => setTab("squads")}>Find a squad</button>
          <button type="button" aria-pressed={tab === "directory"} style={{ ...button, background: tab === "directory" ? "#d40050" : "#290016" }} onClick={() => setTab("directory")}>Public player directory</button>
        </nav>
        {tab === "squads" && <div style={panel}><PublicSquads profileReady={sessionLoaded} /></div>}
        {tab === "directory" && <>
        <section style={panel} aria-labelledby="public-players">
          <h2 id="public-players" style={{ color: "#fff", fontSize: 24, margin: "0 0 8px" }}>Meet the players</h2>
          <p style={{ color: "#efb4c9", marginBottom: 16 }}>Every profile shown here was shared for the worldwide directory by its owner. You do not need Discord or a shared server. Account links and playtime are self-reported and not independently verified.</p>
          <label htmlFor="public-filter">Filter by nickname, game, username or contact handle</label>
          <input id="public-filter" style={{ ...input, marginTop: 8 }} value={filter} onChange={(event) => setFilter(event.target.value)} />
          {!loading && !unavailable ? <p style={{ color: "#ffb1c8", fontSize: 12 }}>{profiles.length} public player{profiles.length === 1 ? "" : "s"}</p> : null}
          {loading ? <p>Loading profiles…</p> : unavailable ? <p>Public profiles are unavailable.</p> : visible.length ? (
            <ul style={{ padding: 0, listStyle: "none", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 240px), 1fr))", gap: 12, marginTop: 16 }}>
              {visible.map((entry, index) => <li key={`${entry.nickname}-${entry.game}-${index}`} style={{ border: "1px solid #8a2450", borderRadius: 14, padding: 18, background: "linear-gradient(145deg, #39051e, #19000e)" }}><strong style={{ color: "#fff", fontSize: 18 }}>{entry.nickname}</strong>{entry.discordTag ? <div style={{ color: "#ffd0df", fontSize: 13, marginTop: 4 }}>Discord: @{entry.discordTag}</div> : null}<div style={{ color: "#ff81ad", marginTop: 8 }}>Playing: {entry.game}</div>{entry.contactHandle ? <div style={{ color: "#ffd0df", marginTop: 10, overflowWrap: "anywhere" }}>Public contact: {entry.contactHandle}</div> : null}{entry.accounts?.length ? <div style={{ marginTop: 12 }}><strong>Player accounts (self-reported)</strong><ul>{entry.accounts.map((account) => <li key={account.url}><a href={account.url} target="_blank" rel="noreferrer" style={{ color: "#ffc4d9" }}>{account.label}</a></li>)}</ul></div> : null}{entry.gameStats?.length ? <div style={{ marginTop: 12 }}><strong>Game progress (self-reported)</strong>{entry.gameStats.map((stat, statIndex) => <div key={`${stat.game}-${statIndex}`} style={{ marginTop: 6 }}>{stat.game}{stat.platform ? ` · ${stat.platform}` : ""} · {stat.hours} hours{stat.progress ? ` · ${stat.progress}` : ""}</div>)}</div> : null}</li>)}
            </ul>
          ) : <p style={{ ...panel, marginTop: 16, color: "#f4b7ce" }}>{filter ? "No matching public profiles." : "No public profiles yet. Publish an introduction below to get started."}</p>}
          <small>Only profiles with active public consent appear here.</small>
        </section>
        <section style={panel} aria-labelledby="public-sharing">
          <h2 id="public-sharing">Your public player profile</h2>
          <p>Publishing is optional and works without Discord. Your nickname, games, profile links, playtime/progress and optional contact handle are public to everyone online until you revoke them. Manually entered account links and stats are self-reported, not provider-verified. A public contact handle may let anyone contact you; enter only what you want public. Discord sign-in only adds an optional Discord username.</p>
          {!sessionLoaded ? <p role="status">Opening your private profile...</p> : (
            <>
              <p>{!ownLoaded ? "Your sharing status is unavailable." : own ? "Your introduction is currently public." : "You have not published an introduction."}</p>
              <form onSubmit={submit} style={{ display: "grid", gap: 12 }}>
                <label>Public nickname <input style={input} required maxLength={40} value={nickname} onChange={(event) => setNickname(event.target.value)} /></label>
                <label>Game <input style={input} required maxLength={80} value={game} onChange={(event) => setGame(event.target.value)} /></label>
                <label>Public contact handle (optional; visible to everyone) <input style={input} maxLength={80} autoComplete="off" value={contactHandle} onChange={(event) => setContactHandle(event.target.value)} /></label>
                <fieldset style={{ border: "1px solid #8a2450", borderRadius: 10, padding: 12 }}><legend>Gaming accounts (optional, up to 8)</legend>{accounts.map((account, index) => <div key={index} style={{ display: "grid", gridTemplateColumns: "minmax(120px, .4fr) 1fr auto", gap: 8, marginBottom: 8 }}><input aria-label="Platform or account name" style={input} maxLength={40} placeholder="Steam, Epic, Xbox..." value={account.label} onChange={(event) => setAccounts((items) => items.map((item, i) => i === index ? { ...item, label: event.target.value } : item))} /><input aria-label="Public profile URL" style={input} type="url" placeholder="https://... public profile" value={account.url} onChange={(event) => setAccounts((items) => items.map((item, i) => i === index ? { ...item, url: event.target.value } : item))} /><button type="button" style={button} onClick={() => setAccounts((items) => items.filter((_, i) => i !== index))}>Remove</button></div>)}<button type="button" style={button} disabled={accounts.length >= 8} onClick={() => setAccounts((items) => [...items, { label: "", url: "" }])}>Add account link</button></fieldset>
                <fieldset style={{ border: "1px solid #8a2450", borderRadius: 10, padding: 12 }}><legend>Games and progress (optional, up to 20)</legend>{gameStats.map((stat, index) => <div key={index} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(145px, 1fr))", gap: 8, marginBottom: 8 }}><input aria-label="Game title" style={input} maxLength={80} placeholder="Game" value={stat.game} onChange={(event) => setGameStats((items) => items.map((item, i) => i === index ? { ...item, game: event.target.value } : item))} /><input aria-label="Platform" style={input} maxLength={40} placeholder="Platform" value={stat.platform} onChange={(event) => setGameStats((items) => items.map((item, i) => i === index ? { ...item, platform: event.target.value } : item))} /><input aria-label="Hours played" style={input} type="number" min={0} max={100000} step="0.1" placeholder="Hours played" value={stat.hours} onChange={(event) => setGameStats((items) => items.map((item, i) => i === index ? { ...item, hours: Number(event.target.value) } : item))} /><input aria-label="Progress" style={input} maxLength={120} placeholder="Progress / rank" value={stat.progress} onChange={(event) => setGameStats((items) => items.map((item, i) => i === index ? { ...item, progress: event.target.value } : item))} /><button type="button" style={button} onClick={() => setGameStats((items) => items.filter((_, i) => i !== index))}>Remove</button></div>)}<button type="button" style={button} disabled={gameStats.length >= 20} onClick={() => setGameStats((items) => [...items, { game: "", platform: "", hours: 0, progress: "" }])}>Add game progress</button></fieldset>
                <label><input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} /> I explicitly agree to publish this nickname, games, account links, progress and any contact handle above to everyone on the internet until I revoke it.</label>
                {loggedIn ? <label><input type="checkbox" checked={shareDiscordTag} onChange={(event) => setShareDiscordTag(event.target.checked)} /> I separately agree to publish my Discord username {discordTag ? <strong>@{discordTag}</strong> : ""} in the worldwide directory.</label> : <p><a href="/api/auth/discord/login?returnTo=%2Fgaming" style={{ color: "#ff9ebc" }}>Optionally connect Discord to show a verified Discord username</a>. This is not required for a Gaming Hub profile.</p>}
                <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
                  <button type="submit" disabled={busy || !consent || !ownLoaded} style={button}>{own ? "Update public profile" : "Publish public profile"}</button>
                  <button type="button" disabled={busy || !own} style={button} onClick={() => void update("revoke")}>Revoke public sharing</button>
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
