"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { resolveGuildContext } from "@/lib/liveRuntime";

type Episode = { id: string; title: string; state: string; published: boolean };
type Control = { state: string; missingConsent: number; isAdmin: boolean; hostRoles: string[]; episodes: Episode[]; accessConfig: { channelId: string; roleId: string } | null };
type Channel = { id: string; name: string; type: number | string };
type Role = { id: string; name: string; managed: boolean; permissions: string };

const card: CSSProperties = { background: "rgba(80, 0, 20, 0.18)", border: "1px solid #6d1834", borderRadius: 12, padding: 20, marginTop: 16 };
const field: CSSProperties = { display: "block", width: "100%", marginTop: 6, background: "#120912", border: "1px solid #83304b", borderRadius: 8, color: "#ffe5ee", padding: "10px 12px" };
const button: CSSProperties = { background: "#a81946", border: "1px solid #e94876", borderRadius: 8, color: "#fff", cursor: "pointer", padding: "10px 14px", fontWeight: 600 };
const secondaryButton: CSSProperties = { ...button, background: "#25101b", borderColor: "#82314d" };
const muted: CSSProperties = { color: "#d7aebc", lineHeight: 1.5 };

export default function PodcastControlClient({ initialGuildId = "" }: { initialGuildId?: string }) {
  const [guildId, setGuildId] = useState("");
  const [control, setControl] = useState<Control | null>(null);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [guildRoles, setGuildRoles] = useState<Role[]>([]);
  const [selectedHostRoles, setSelectedHostRoles] = useState<string[]>([]);
  const [title, setTitle] = useState("");
  const [panelTextChannel, setPanelTextChannel] = useState("");
  const [panelVoiceChannel, setPanelVoiceChannel] = useState("");
  const [panelRole, setPanelRole] = useState("");
  const [error, setError] = useState("");
  const [loadError, setLoadError] = useState("");
  const [directoryError, setDirectoryError] = useState("");
  const [directoryLoading, setDirectoryLoading] = useState(false);
  const [directoryReady, setDirectoryReady] = useState(false);
  const [directoryVersion, setDirectoryVersion] = useState(0);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const initializedHosts = useRef("");
  const activeGuild = useRef("");

  useEffect(() => { setGuildId(initialGuildId || resolveGuildContext().guildId); }, [initialGuildId]);
  const load = useCallback(async () => {
    if (!guildId) return;
    try {
      const response = await fetch(`/api/podcast/${guildId}/control`, { cache: "no-store" });
      const body = await response.json();
      if (!response.ok || !body.success) throw new Error(body.error || "Podcast controls are unavailable.");
      if (activeGuild.current !== guildId) return;
      setControl(body);
      if (initializedHosts.current !== guildId) {
        setSelectedHostRoles(body.hostRoles);
        initializedHosts.current = guildId;
      }
      setLoadError("");
    } catch (reason) {
      if (activeGuild.current === guildId) setLoadError(reason instanceof Error ? reason.message : "Podcast controls are unavailable.");
    }
  }, [guildId]);
  useEffect(() => {
    activeGuild.current = guildId;
    setControl(null);
    setDirectoryReady(false);
    setChannels([]);
    setGuildRoles([]);
    setPanelTextChannel("");
    setPanelVoiceChannel("");
    setPanelRole("");
    void load();
    const timer = window.setInterval(() => { if (document.visibilityState === "visible") void load(); }, 10_000);
    return () => { activeGuild.current = ""; window.clearInterval(timer); };
  }, [guildId, load]);

  useEffect(() => {
    if (!guildId || !control?.isAdmin) return;
    const controller = new AbortController();
    async function loadDirectory() {
      setDirectoryLoading(true);
      setDirectoryReady(false);
      setDirectoryError("");
      try {
        const response = await fetch(`/api/bot/guild-data?guildId=${encodeURIComponent(guildId)}`, { cache: "no-store", signal: controller.signal });
        const body = await response.json();
        if (!response.ok || !body.success || !Array.isArray(body.channels) || !Array.isArray(body.roles)) {
          throw new Error(body.error || "Could not load this server's channels and roles.");
        }
        setChannels(body.channels);
        setGuildRoles(body.roles);
        setDirectoryReady(true);
      } catch (reason) {
        if (!controller.signal.aborted) {
          setChannels([]);
          setGuildRoles([]);
          setDirectoryError(reason instanceof Error ? reason.message : "Could not load this server's channels and roles.");
        }
      } finally {
        if (!controller.signal.aborted) setDirectoryLoading(false);
      }
    }
    void loadDirectory();
    return () => controller.abort();
  }, [guildId, control?.isAdmin, directoryVersion]);

  async function send(path: "control" | "publication", body: object) {
    try {
      setBusy(true);
      setError("");
      setMessage("");
      const response = await fetch(`/api/podcast/${guildId}/${path}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || "Podcast action failed.");
      await load();
      if ("action" in body && body.action === "accessPanel") {
        setMessage("Access panel posted. Members can agree or revoke access in the selected text channel.");
        setDirectoryVersion((value) => value + 1);
      } else if ("action" in body && body.action === "hostRoles") {
        setMessage("Podcast host roles saved.");
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Podcast action failed.");
    } finally {
      setBusy(false);
    }
  }

  if (!guildId) return <p>Select a server before opening podcast controls.</p>;
  const textChannels = channels.filter((channel) => Number(channel.type) === 0 || Number(channel.type) === 5);
  const voiceChannels = channels.filter((channel) => Number(channel.type) === 2);
  const selectableRoles = guildRoles.filter((role) => role.id !== guildId && !role.managed);
  const accessRoles = selectableRoles.filter((role) => role.permissions === "0");
  const unavailableHostRoles = selectedHostRoles.filter((id) => !selectableRoles.some((role) => role.id === id));
  const existing = control?.accessConfig;

  return (
    <main style={{ maxWidth: 1000, padding: 24, color: "#ffe5ee" }}>
      <h1 style={{ fontSize: 28, fontWeight: 750, margin: 0 }}>Podcast Studio</h1>
      <p style={muted}>Record together, stream live, and publish episodes when you are ready.</p>
      <div style={{ ...card, borderColor: "#b95743" }}>
        <strong>Consent comes first</strong>
        <p style={{ ...muted, marginBottom: 0 }}>Everyone in the voice channel must use <code>/podcast consent</code>. A new participant or withdrawn consent pauses capture. Live audio is public; recordings stay private until published.</p>
      </div>
      {loadError ? <p role="alert" style={{ color: "#ff9aa8" }}>{loadError}</p> : null}
      {error ? <p role="alert" style={{ color: "#ff9aa8" }}>{error}</p> : null}
      {message ? <p role="status" style={{ color: "#b6edc4" }}>{message}</p> : null}
      <section style={card}>
        <h2 style={{ fontSize: 20, marginTop: 0 }}>Recording</h2>
        <p>Status: <strong>{control?.state || "loading"}</strong>{control?.missingConsent ? ` · ${control.missingConsent} awaiting consent` : ""}</p>
        <p><a href={`/podcasts/${guildId}`} style={{ color: "#ff83aa" }}>Public listening page</a> · <a href={`/api/podcast/${guildId}/feed.xml`} style={{ color: "#ff83aa" }}>RSS feed</a></p>
        <label>Episode title <input style={field} maxLength={150} value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Name your episode" /></label>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 16 }}>
          <button type="button" style={secondaryButton} disabled={busy || !control} onClick={() => void send("control", { action: "prepare" })}>Prepare in my voice channel</button>
          <button type="button" style={button} disabled={busy || !control} onClick={() => void send("control", { action: "start", title })}>Start / resume</button>
          <button type="button" style={secondaryButton} disabled={busy || !control} onClick={() => void send("control", { action: "stop" })}>Stop and save privately</button>
        </div>
      </section>
      {control?.isAdmin ? (
        <>
          <section style={card}>
            <h2 style={{ fontSize: 20, marginTop: 0 }}>Podcast access panel</h2>
            <p style={muted}>Choose where members agree to access your podcast voice channel. Access is not recording consent. Other channel overrides and administrators may still allow access.</p>
            {directoryLoading ? <p role="status">Loading server channels and roles...</p> : null}
            {directoryError ? <p role="alert">{directoryError} <button type="button" style={secondaryButton} onClick={() => setDirectoryVersion((value) => value + 1)}>Retry</button></p> : null}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))", gap: 14 }}>
              <label>Panel text channel
                <select style={field} value={panelTextChannel} onChange={(event) => setPanelTextChannel(event.target.value)} disabled={!directoryReady}>
                  <option value="">Select a text channel</option>
                  {textChannels.map((channel) => <option key={channel.id} value={channel.id}>#{channel.name}</option>)}
                </select>
              </label>
              <label>Podcast voice channel
                <select style={field} value={existing?.channelId || panelVoiceChannel} onChange={(event) => setPanelVoiceChannel(event.target.value)} disabled={!!existing || !directoryReady}>
                  <option value="">Create a new voice channel</option>
                  {existing && !voiceChannels.some((channel) => channel.id === existing.channelId) ? <option value={existing.channelId}>Configured channel ({existing.channelId})</option> : null}
                  {voiceChannels.map((channel) => <option key={channel.id} value={channel.id}>{channel.name}</option>)}
                </select>
              </label>
              <label>Dedicated access role
                <select style={field} value={existing?.roleId || panelRole} onChange={(event) => setPanelRole(event.target.value)} disabled={!!existing || !directoryReady}>
                  <option value="">Create a new access role</option>
                  {existing && !accessRoles.some((role) => role.id === existing.roleId) ? <option value={existing.roleId}>Configured role ({existing.roleId})</option> : null}
                  {accessRoles.map((role) => <option key={role.id} value={role.id}>@{role.name}</option>)}
                </select>
              </label>
            </div>
            <p style={muted}>{existing ? "Reposting uses the configured channel and role." : "Only dedicated roles with no server-wide permissions are listed. Selecting an existing voice channel changes its permission overwrites."}</p>
            <button type="button" style={button} disabled={busy || !directoryReady || !panelTextChannel} onClick={() => void send("control", {
              action: "accessPanel", textChannelId: panelTextChannel,
              channelId: existing?.channelId || panelVoiceChannel, roleId: existing?.roleId || panelRole,
            })}>Set up and post panel</button>
          </section>
          <section style={card}>
            <h2 style={{ fontSize: 20, marginTop: 0 }}>Host roles</h2>
            <p style={muted}>Select the roles allowed to prepare and manage podcasts. Server administrators can always host.</p>
            {directoryError ? <p>Server roles are unavailable. Retry loading them above.</p> : null}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 8 }}>
              {unavailableHostRoles.map((id) => (
                <label key={id}>
                  <input type="checkbox" checked disabled={!directoryReady} onChange={() => setSelectedHostRoles((current) => current.filter((value) => value !== id))} /> Unavailable role ({id})
                </label>
              ))}
              {selectableRoles.map((role) => (
                <label key={role.id}>
                  <input type="checkbox" checked={selectedHostRoles.includes(role.id)} disabled={!directoryReady} onChange={(event) => {
                    setSelectedHostRoles((current) => event.target.checked ? [...current, role.id] : current.filter((id) => id !== role.id));
                  }} /> @{role.name}
                </label>
              ))}
            </div>
            {directoryReady && unavailableHostRoles.length ? <p style={muted}>Remove unavailable roles before saving.</p> : null}
            <button type="button" style={{ ...button, marginTop: 16 }} disabled={busy || !directoryReady || unavailableHostRoles.length > 0} onClick={() => void send("control", { action: "hostRoles", roleIds: selectedHostRoles })}>Save host roles</button>
          </section>
        </>
      ) : null}
      <section style={card}>
        <h2 style={{ fontSize: 20, marginTop: 0 }}>Episodes</h2>
        {control && control.episodes.length === 0 ? <p style={muted}>Your saved episodes will appear here.</p> : null}
        {(control?.episodes || []).map((episode) => (
          <div key={episode.id} style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: 8, padding: "10px 0" }}>
            <span><strong>{episode.title}</strong> · {episode.state} · {episode.published ? "public" : "private"}</span>
            <button type="button" style={secondaryButton} disabled={busy || (episode.state !== "completed" && !episode.published)} onClick={() => void send("publication", { episodeId: episode.id, published: !episode.published })}>
              {episode.published ? "Make private" : "Publish"}
            </button>
          </div>
        ))}
      </section>
    </main>
  );
}
