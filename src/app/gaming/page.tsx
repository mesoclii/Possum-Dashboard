"use client";

import { useEffect, useState } from "react";
import type { CSSProperties, FormEvent } from "react";
import Link from "next/link";
import PublicSquads from "@/components/possum/PublicSquads";

type Profile = { nickname: string; game: string; contactHandle: string; discordTag?: string };
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
        setLoggedIn(true);
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
        setShareDiscordTag(Boolean(data.profile?.discordTag));
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
        body: JSON.stringify({ action, nickname, game, contactHandle, consent, shareDiscordTag }),
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

  const visible = profiles.filter((entry) => `${entry.nickname} ${entry.game} ${entry.contactHandle} ${entry.discordTag || ""}`.toLowerCase().includes(filter.trim().toLowerCase()));
  return (
    <main style={{ minHeight: "100vh", padding: "32px 16px 70px", color: "#ffe0e8", background: "radial-gradient(ellipse at 85% 0%, #5b082e 0%, transparent 36%), radial-gradient(ellipse at 0% 40%, #3b071f 0%, transparent 40%), #10000b" }}>
      <div style={{ maxWidth: 1380, margin: "auto", display: "grid", gap: 20 }}>
        <header style={{ ...panel, padding: "clamp(22px, 5vw, 48px)", background: "linear-gradient(120deg, #260016 5%, #440920 60%, #17000f)", boxShadow: "0 0 42px #ff00662b" }}>
          <Link href="/" style={{ color: "#ff9ebc" }}>← Possum home</Link>
          <p style={{ color: "#ff79a9", letterSpacing: ".18em", textTransform: "uppercase", fontSize: 12, marginTop: 24 }}>Find your people · play together</p>
          <h1 style={{ color: "#fff2f7", fontSize: "clamp(2.4rem, 7vw, 5rem)", lineHeight: 1.05, margin: "12px 0", fontWeight: 900 }}>Possum <span style={{ color: "#ff3982" }}>Gaming Hub</span></h1>
          <p style={{ maxWidth: 680, color: "#f4b7ce", fontSize: 17 }}>Discover players worldwide and find a squad. The public directory is global; it does not depend on sharing a Discord server with Possum Bot.</p>
          <p style={{ color: "#ffc4d9", fontSize: 14 }}>Anyone can browse. Each player chooses what to publish, and can remove it at any time.</p>
        </header>
        <nav aria-label="Gaming Hub sections" style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
          <button type="button" aria-pressed={tab === "squads"} style={{ ...button, background: tab === "squads" ? "#d40050" : "#290016" }} onClick={() => setTab("squads")}>Find a squad</button>
          <button type="button" aria-pressed={tab === "directory"} style={{ ...button, background: tab === "directory" ? "#d40050" : "#290016" }} onClick={() => setTab("directory")}>Public player directory</button>
        </nav>
        {tab === "squads" && <div style={panel}><PublicSquads loggedIn={loggedIn} /></div>}
        {tab === "directory" && <>
        <section style={panel} aria-labelledby="public-players">
          <h2 id="public-players" style={{ color: "#fff", fontSize: 24, margin: "0 0 8px" }}>Meet the players</h2>
          <p style={{ color: "#efb4c9", marginBottom: 16 }}>Every profile shown here was shared for the worldwide directory by its owner. You do not need to share a server with them.</p>
          <label htmlFor="public-filter">Filter by nickname, game, username or contact handle</label>
          <input id="public-filter" style={{ ...input, marginTop: 8 }} value={filter} onChange={(event) => setFilter(event.target.value)} />
          {!loading && !unavailable ? <p style={{ color: "#ffb1c8", fontSize: 12 }}>{profiles.length} public player{profiles.length === 1 ? "" : "s"}</p> : null}
          {loading ? <p>Loading profiles…</p> : unavailable ? <p>Public profiles are unavailable.</p> : visible.length ? (
            <ul style={{ padding: 0, listStyle: "none", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 240px), 1fr))", gap: 12, marginTop: 16 }}>
              {visible.map((entry, index) => <li key={`${entry.nickname}-${entry.game}-${index}`} style={{ border: "1px solid #8a2450", borderRadius: 14, padding: 18, background: "linear-gradient(145deg, #39051e, #19000e)" }}><strong style={{ color: "#fff", fontSize: 18 }}>{entry.nickname}</strong>{entry.discordTag ? <div style={{ color: "#ffd0df", fontSize: 13, marginTop: 4 }}>@{entry.discordTag}</div> : null}<div style={{ color: "#ff81ad", marginTop: 8 }}>{entry.game}</div>{entry.contactHandle ? <div style={{ color: "#ffd0df", marginTop: 10, overflowWrap: "anywhere" }}>Public contact: {entry.contactHandle}</div> : null}</li>)}
            </ul>
          ) : <p style={{ ...panel, marginTop: 16, color: "#f4b7ce" }}>{filter ? "No matching public profiles." : "No public profiles yet. Publish an introduction below to get started."}</p>}
          <small>Only profiles with active public consent appear here.</small>
        </section>
        <section style={panel} aria-labelledby="public-sharing">
          <h2 id="public-sharing">Your public introduction</h2>
          <p>Publishing is optional and works without joining any Discord server. Your nickname, game and optional contact handle are public to everyone online until you revoke them. Your Discord username stays private unless you separately opt in below. A public contact handle may identify you or allow anyone to contact you; enter only what you want to share online.</p>
          {!loggedIn ? <a href="/api/auth/discord/login?returnTo=%2Fgaming" style={{ color: "#ff9ebc" }}>Sign in with Discord to publish or revoke your introduction</a> : (
            <>
              <p>{!ownLoaded ? "Your sharing status is unavailable." : own ? "Your introduction is currently public." : "You have not published an introduction."}</p>
              <form onSubmit={submit} style={{ display: "grid", gap: 12 }}>
                <label>Public nickname <input style={input} required maxLength={40} value={nickname} onChange={(event) => setNickname(event.target.value)} /></label>
                <label>Game <input style={input} required maxLength={80} value={game} onChange={(event) => setGame(event.target.value)} /></label>
                <label>Public contact handle (optional; visible to everyone) <input style={input} maxLength={80} autoComplete="off" value={contactHandle} onChange={(event) => setContactHandle(event.target.value)} /></label>
                <label><input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} /> I explicitly agree to publish this nickname, game and any contact handle entered above to everyone on the internet until I revoke it.</label>
                <label><input type="checkbox" checked={shareDiscordTag} disabled={!discordTag} onChange={(event) => setShareDiscordTag(event.target.checked)} /> I separately agree to publish my Discord username {discordTag ? <strong>@{discordTag}</strong> : "(unavailable)"} in the worldwide directory.</label>
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
