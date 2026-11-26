"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { CSSProperties, FormEvent } from "react";

type Member = { nickname: string; contact: string };
type Listing = {
  id: string;
  game: string;
  mode: string;
  platform: string;
  note: string;
  capacity: number;
  expiresAt: string;
  members: Member[];
  isHost?: boolean;
  isMember?: boolean;
};

const field: CSSProperties = { width: "100%", padding: 10, border: "1px solid #d62b6d", borderRadius: 9, color: "#fff", background: "#16000b" };
const button: CSSProperties = { padding: "10px 15px", borderRadius: 9, border: "1px solid #ff3982", color: "#fff", background: "#a7003e", cursor: "pointer", fontWeight: 700 };
const card: CSSProperties = { padding: 18, border: "1px solid #802346", borderRadius: 14, background: "#1d0010" };

export default function PublicSquads({ profileReady }: { profileReady: boolean }) {
  const [listings, setListings] = useState<Listing[]>([]);
  const [mine, setMine] = useState<Listing[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [previousCursors, setPreviousCursors] = useState<(string | null)[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const requestId = useRef(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState("");
  const [joinId, setJoinId] = useState("");
  const [joinName, setJoinName] = useState("");
  const [joinContact, setJoinContact] = useState("");
  const [joinConsent, setJoinConsent] = useState(false);
  const [postConsent, setPostConsent] = useState(false);
  const [form, setForm] = useState({ nickname: "", contact: "", game: "", mode: "", platform: "", note: "", capacity: 4 });

  const refresh = useCallback(async () => {
    const request = ++requestId.current;
    const [publicResult, ownResult] = await Promise.allSettled([
      (async () => {
      const url = cursor ? `/api/public-lfg?cursor=${encodeURIComponent(cursor)}` : "/api/public-lfg";
      const response = await fetch(url, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok || !data.success || !Array.isArray(data.listings) || (data.nextCursor !== null && (typeof data.nextCursor !== "string" || !data.nextCursor))) {
        throw new Error(data.error || "Public squads are unavailable.");
      }
      return { listings: data.listings as Listing[], nextCursor: data.nextCursor as string | null };
      })(),
      (async () => {
        if (!profileReady) return [] as Listing[];
        const response = await fetch("/api/public-lfg?me=1", { cache: "no-store" });
        const data = await response.json();
        if (!response.ok || !data.success || !Array.isArray(data.listings)) throw new Error(data.error || "Your squad memberships could not be loaded.");
        return data.listings as Listing[];
      })(),
    ]);
    if (request !== requestId.current) return;
    if (publicResult.status === "fulfilled") {
      setListings(publicResult.value.listings);
      setNextCursor(publicResult.value.nextCursor);
    } else {
      setListings([]);
      setNextCursor(null);
    }
    if (ownResult.status === "fulfilled") setMine(ownResult.value);
    else setMine([]);
    if (publicResult.status === "rejected") throw publicResult.reason;
    if (ownResult.status === "rejected") throw ownResult.reason;
  }, [profileReady, cursor]);

  useEffect(() => {
    let active = true;
    const load = () => void refresh().then(() => { if (active) setError(""); }).catch((failure) => {
      if (active) {
        setError(failure instanceof Error ? failure.message : "Public squads are unavailable.");
      }
    }).finally(() => { if (active) setLoading(false); });
    load();
    const timer = window.setInterval(load, 15000);
    window.addEventListener("focus", load);
    return () => { active = false; window.clearInterval(timer); window.removeEventListener("focus", load); };
  }, [refresh]);

  async function act(payload: Record<string, unknown>, success: string) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/public-lfg", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || "Your squad request failed.");
      setNotice(success);
      setJoinId("");
      setJoinConsent(false);
      setPostConsent(false);
      await refresh();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Your squad request failed.");
    } finally {
      setBusy(false);
    }
  }

  function post(event: FormEvent) {
    event.preventDefault();
    void act({ action: "post", ...form, consent: postConsent }, "Your public squad is live.");
  }

  function join(event: FormEvent) {
    event.preventDefault();
    void act({ action: "join", id: joinId, nickname: joinName, contact: joinContact, consent: joinConsent }, "You joined the public squad.");
  }

  const allListings = [...mine.filter((own) => !listings.some((entry) => entry.id === own.id)), ...listings];
  const visible = allListings.filter((entry) => `${entry.game} ${entry.mode} ${entry.platform} ${entry.note}`.toLowerCase().includes(filter.trim().toLowerCase()));
  return (
    <section style={{ display: "grid", gap: 18 }} aria-labelledby="public-squads-heading">
      <div>
        <h2 id="public-squads-heading" style={{ fontSize: 24, color: "#fff", marginBottom: 8 }}>Find your next squad</h2>
        <p>These are public web listings across communities, separate from Discord server squads. They expire after 24 hours.</p>
        <p>Everything you enter here, including your contact handle, is visible to anyone online. Only share what you want public.</p>
      </div>
      {error && <p role="alert">{error}</p>}
      {notice && <p role="status">{notice}</p>}
      {!profileReady && <p role="status">Opening a private profile so you can post, join and manage squads without Discord...</p>}
      <label>Search this page of squads <input style={field} value={filter} onChange={(event) => setFilter(event.target.value)} placeholder="Try Fortnite, duos or PC" /></label>
      {loading ? <p role="status">Loading squads…</p> : visible.length ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 270px), 1fr))", gap: 12 }}>
          {visible.map((listing) => {
            const membership = mine.find((entry) => entry.id === listing.id);
            return <article key={listing.id} style={card}>
              <div style={{ color: "#ff81ad", fontSize: 12, fontWeight: 800, textTransform: "uppercase" }}>{listing.platform || "Any platform"} · {listing.members.length}/{listing.capacity} players</div>
              <h3 style={{ fontSize: 20, color: "#fff", margin: "8px 0" }}>{listing.game}</h3>
              {listing.mode && <p>{listing.mode}</p>}
              {listing.note && <p>{listing.note}</p>}
              <ul style={{ paddingLeft: 20 }}>{listing.members.map((member, index) => <li key={`${member.nickname}-${index}`}>{member.nickname}{member.contact ? ` — ${member.contact}` : ""}</li>)}</ul>
              {profileReady && membership?.isHost ? <button style={button} disabled={busy} onClick={() => void act({ action: "close", id: listing.id }, "Squad closed.")}>Close squad</button>
                : profileReady && membership?.isMember ? <button style={button} disabled={busy} onClick={() => void act({ action: "leave", id: listing.id }, "You left the squad.")}>Leave squad</button>
                  : profileReady ? <button style={button} disabled={busy || listing.members.length >= listing.capacity} onClick={() => { setJoinId(listing.id); setJoinConsent(false); }}>Join squad</button>
                    : null}
            </article>;
          })}
        </div>
      ) : !error ? <p>{filter ? "No squads match your search." : "No public squads yet. Be the first to start one."}</p> : null}
      {(previousCursors.length > 0 || nextCursor) && <div style={{ display: "flex", gap: 10 }}>
        {previousCursors.length > 0 && <button type="button" style={button} onClick={() => { setCursor(previousCursors[previousCursors.length - 1]); setPreviousCursors(previousCursors.slice(0, -1)); }}>Previous squads</button>}
        {nextCursor && <button type="button" style={button} onClick={() => { setPreviousCursors([...previousCursors, cursor]); setCursor(nextCursor); }}>More squads</button>}
      </div>}
      {profileReady && joinId && <form onSubmit={join} style={{ ...card, display: "grid", gap: 12 }}>
        <h3 style={{ margin: 0 }}>Join this squad</h3>
        <label>Public nickname <input style={field} required maxLength={40} value={joinName} onChange={(event) => setJoinName(event.target.value)} /></label>
        <label>Public contact handle (optional) <input style={field} maxLength={80} value={joinContact} onChange={(event) => setJoinContact(event.target.value)} /></label>
        <label><input type="checkbox" checked={joinConsent} onChange={(event) => setJoinConsent(event.target.checked)} /> I agree to publish these details with this squad to everyone online.</label>
        <div style={{ display: "flex", gap: 10 }}><button style={button} disabled={busy || !joinConsent}>Confirm join</button><button type="button" style={button} onClick={() => setJoinId("")}>Cancel</button></div>
      </form>}
      {profileReady && <form onSubmit={post} style={{ ...card, display: "grid", gap: 12 }}>
        <h3 style={{ margin: 0 }}>Start a public squad</h3>
        <label>Game <input style={field} required maxLength={80} value={form.game} onChange={(event) => setForm({ ...form, game: event.target.value })} /></label>
        <label>Mode or queue <input style={field} maxLength={60} value={form.mode} onChange={(event) => setForm({ ...form, mode: event.target.value })} /></label>
        <label>Platform <input style={field} maxLength={40} value={form.platform} onChange={(event) => setForm({ ...form, platform: event.target.value })} /></label>
        <label>Short note <input style={field} maxLength={240} value={form.note} onChange={(event) => setForm({ ...form, note: event.target.value })} /></label>
        <label>Squad size <input style={field} type="number" min={2} max={20} required value={form.capacity} onChange={(event) => setForm({ ...form, capacity: Number(event.target.value) })} /></label>
        <label>Your public nickname <input style={field} required maxLength={40} value={form.nickname} onChange={(event) => setForm({ ...form, nickname: event.target.value })} /></label>
        <label>Your public contact handle <input style={field} required maxLength={80} value={form.contact} onChange={(event) => setForm({ ...form, contact: event.target.value })} /></label>
        <label><input type="checkbox" checked={postConsent} onChange={(event) => setPostConsent(event.target.checked)} /> I agree to publish all of these details to everyone online.</label>
        <div><button style={button} disabled={busy || !postConsent}>Post public squad</button></div>
      </form>}
    </section>
  );
}
