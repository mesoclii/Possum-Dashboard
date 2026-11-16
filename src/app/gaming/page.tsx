"use client";

import { useEffect, useState } from "react";
import type { CSSProperties, FormEvent } from "react";
import Link from "next/link";

type Profile = { nickname: string; game: string; contactHandle: string };
const panel: CSSProperties = { border: "1px solid #ff2e75", borderRadius: 16, padding: 20, background: "#21000e" };
const input: CSSProperties = { width: "100%", padding: 10, border: "1px solid #ff2e75", borderRadius: 8, color: "#fff", background: "#16000b" };
const button: CSSProperties = { padding: "10px 16px", borderRadius: 8, border: "1px solid #ff2e75", color: "#fff", background: "#a7003e", cursor: "pointer", fontWeight: 700 };

export default function PublicGamingPage() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);
  const [loggedIn, setLoggedIn] = useState(false);
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
    void (async () => {
      try {
        await loadProfiles();
      } catch {
        setUnavailable(true);
        setMessage("Public profiles are unavailable. Please try again later.");
      } finally {
        setLoading(false);
      }
      try {
        const session = await fetch("/api/auth/session?brief=1", { cache: "no-store" }).then((response) => response.json());
        if (!session.loggedIn) return;
        setLoggedIn(true);
        const response = await fetch("/api/public-gaming?me=1", { cache: "no-store" });
        const data = await response.json();
        if (!response.ok || !data.success) throw new Error();
        setOwn(data.profile);
        setOwnLoaded(true);
        setNickname(data.profile?.nickname || "");
        setGame(data.profile?.game || "");
        setContactHandle(data.profile?.contactHandle || "");
      } catch {
        setMessage("Your public sharing status could not be loaded.");
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
    <main style={{ minHeight: "100vh", padding: "32px 16px", color: "#ffe0e8", background: "#17000b" }}>
      <div style={{ maxWidth: 1000, margin: "auto", display: "grid", gap: 20 }}>
        <header>
          <Link href="/" style={{ color: "#ff9ebc" }}>← Possum home</Link>
          <h1 style={{ color: "#ff2e75", fontSize: "clamp(2rem, 6vw, 3.5rem)", marginBottom: 8 }}>Public Gaming Hub</h1>
          <p>Browse public player introductions without a Discord account.</p>
          <p>Only profiles separately published here are shown. Discord server profiles, activity, squads, roles and linked accounts are never imported.</p>
          <Link href="/dashboard/games" style={{ color: "#ff9ebc" }}>Open the Discord member Gaming Hub →</Link>
        </header>
        <section style={panel} aria-labelledby="public-players">
          <h2 id="public-players">Public players</h2>
          <label htmlFor="public-filter">Filter by nickname, game or contact handle</label>
          <input id="public-filter" style={{ ...input, marginTop: 8 }} value={filter} onChange={(event) => setFilter(event.target.value)} />
          {loading ? <p>Loading profiles…</p> : unavailable ? <p>Public profiles are unavailable.</p> : visible.length ? (
            <ul style={{ padding: 0, listStyle: "none", display: "grid", gap: 10 }}>
              {visible.map((entry, index) => <li key={`${entry.nickname}-${entry.game}-${index}`} style={{ borderBottom: "1px solid #742343", padding: "10px 0" }}><strong>{entry.nickname}</strong> · {entry.game}{entry.contactHandle ? <div>Public contact: {entry.contactHandle}</div> : null}</li>)}
            </ul>
          ) : <p>{filter ? "No matching public profiles." : "No public profiles are available yet."}</p>}
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
        {message && <p role="status">{message}</p>}
      </div>
    </main>
  );
}
