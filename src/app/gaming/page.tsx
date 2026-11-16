"use client";

import { useEffect, useState } from "react";
import type { CSSProperties, FormEvent } from "react";
import Link from "next/link";
import GameSocialClient from "@/components/possum/GameSocialClient";
import PublicSquads from "@/components/possum/PublicSquads";

type Profile = { nickname: string; game: string; contactHandle: string };
type Guild = { id: string; name: string };
const panel: CSSProperties = { border: "1px solid #ff2e75", borderRadius: 16, padding: 20, background: "#21000e" };
const input: CSSProperties = { width: "100%", padding: 10, border: "1px solid #ff2e75", borderRadius: 8, color: "#fff", background: "#16000b" };
const button: CSSProperties = { padding: "10px 16px", borderRadius: 8, border: "1px solid #ff2e75", color: "#fff", background: "#a7003e", cursor: "pointer", fontWeight: 700 };

export default function PublicGamingPage() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);
  const [loggedIn, setLoggedIn] = useState(false);
  const [sessionLoaded, setSessionLoaded] = useState(false);
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
        const sessionResponse = await fetch("/api/auth/session?brief=1", { cache: "no-store" });
        if (!sessionResponse.ok) throw new Error("Session unavailable");
        const session = await sessionResponse.json();
        if (!session.loggedIn) return;
        const sessionUserId = String(session.user?.id || "");
        if (!sessionUserId) throw new Error("Session unavailable");
        setLoggedIn(true);
        setUserId(sessionUserId);
        setGuildLoading(true);
        setSessionLoaded(true);
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
        const response = await fetch("/api/public-gaming?me=1", { cache: "no-store" });
        const data = await response.json();
        if (!response.ok || !data.success) throw new Error();
        setOwn(data.profile);
        setOwnLoaded(true);
        setNickname(data.profile?.nickname || "");
        setGame(data.profile?.game || "");
        setContactHandle(data.profile?.contactHandle || "");
      } catch {
        setMessage("Your session or public sharing status could not be loaded. Please refresh and try again.");
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
        body: JSON.stringify({ action, nickname, game, contactHandle, consent }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || "Update failed.");
      setOwn(data.profile);
      setOwnLoaded(true);
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

  const visible = profiles.filter((entry) => `${entry.nickname} ${entry.game} ${entry.contactHandle}`.toLowerCase().includes(filter.trim().toLowerCase()));
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
        {tab === "squads" && <div style={panel}><PublicSquads loggedIn={loggedIn} /></div>}
        {tab === "community" && <section style={panel} aria-labelledby="community-hub">
          <h2 id="community-hub" style={{ fontSize: 24, margin: "0 0 8px", color: "#fff" }}>Your gaming community</h2>
          <p style={{ color: "#efb4c9" }}>Profiles, linked accounts, stats, live players and squad finder use the same tools as your Discord server.</p>
          {!sessionLoaded ? <p role="status">Checking your session…</p> : !loggedIn ? (
            <a href="/api/auth/discord/login?returnTo=%2Fgaming" style={{ ...button, display: "inline-block", textDecoration: "none" }}>Sign in with Discord</a>
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
              {visible.map((entry, index) => <li key={`${entry.nickname}-${entry.game}-${index}`} style={{ border: "1px solid #8a2450", borderRadius: 14, padding: 18, background: "linear-gradient(145deg, #39051e, #19000e)" }}><strong style={{ color: "#fff", fontSize: 18 }}>{entry.nickname}</strong><div style={{ color: "#ff81ad", marginTop: 8 }}>{entry.game}</div>{entry.contactHandle ? <div style={{ color: "#ffd0df", marginTop: 10, overflowWrap: "anywhere" }}>Public contact: {entry.contactHandle}</div> : null}</li>)}
            </ul>
          ) : <p style={{ ...panel, marginTop: 16, color: "#f4b7ce" }}>{filter ? "No matching public profiles." : "No public profiles yet. Publish an introduction below to get started."}</p>}
          <small>Up to 200 published profiles are shown.</small>
        </section>
        <section style={panel} aria-labelledby="public-sharing">
          <h2 id="public-sharing">Your public introduction</h2>
          <p>Publishing is optional and separate from Discord server privacy. Your nickname, game and optional contact handle are public to everyone online until you revoke them. A contact handle may identify you or allow anyone to contact you; enter only what you want to share publicly. Nothing is imported from Discord or your private profiles.</p>
          {!loggedIn ? <a href="/api/auth/discord/login?returnTo=%2Fgaming" style={{ color: "#ff9ebc" }}>Sign in with Discord to publish or revoke your introduction</a> : (
            <>
              <p>{!ownLoaded ? "Your sharing status is unavailable." : own ? "Your introduction is currently public." : "You have not published an introduction."}</p>
              <form onSubmit={submit} style={{ display: "grid", gap: 12 }}>
                <label>Public nickname <input style={input} required maxLength={40} value={nickname} onChange={(event) => setNickname(event.target.value)} /></label>
                <label>Game <input style={input} required maxLength={80} value={game} onChange={(event) => setGame(event.target.value)} /></label>
                <label>Public contact handle (optional; visible to everyone) <input style={input} maxLength={80} autoComplete="off" value={contactHandle} onChange={(event) => setContactHandle(event.target.value)} /></label>
                <label><input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} /> I explicitly agree to publish this nickname, game and any contact handle entered above to everyone on the internet until I revoke it.</label>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
                  <button type="submit" disabled={busy || !consent || !ownLoaded} style={button}>{own ? "Update public introduction" : "Publish introduction"}</button>
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
