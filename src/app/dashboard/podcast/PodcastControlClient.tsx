"use client";

import { useCallback, useEffect, useState } from "react";
import { resolveGuildContext } from "@/lib/liveRuntime";

type Episode = { id: string; title: string; state: string; published: boolean };
type Control = { state: string; missingConsent: number; isAdmin: boolean; hostRoles: string[]; episodes: Episode[]; accessConfig: { channelId: string; roleId: string } | null };

export default function PodcastControlClient({ initialGuildId = "" }: { initialGuildId?: string }) {
  const [guildId, setGuildId] = useState("");
  const [control, setControl] = useState<Control | null>(null);
  const [title, setTitle] = useState("");
  const [roles, setRoles] = useState("");
  const [panelTextChannel, setPanelTextChannel] = useState("");
  const [panelVoiceChannel, setPanelVoiceChannel] = useState("");
  const [panelRole, setPanelRole] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => { setGuildId(initialGuildId || resolveGuildContext().guildId); }, [initialGuildId]);
  const load = useCallback(async () => {
    if (!guildId) return;
    try {
      const response = await fetch(`/api/podcast/${guildId}/control`, { cache: "no-store" });
      const body = await response.json();
      if (!response.ok || !body.success) throw new Error(body.error || "Podcast controls are unavailable.");
      setControl(body);
      setError("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Podcast controls are unavailable.");
    }
  }, [guildId]);
  useEffect(() => {
    void load();
    const timer = window.setInterval(() => { if (document.visibilityState === "visible") void load(); }, 10_000);
    return () => window.clearInterval(timer);
  }, [load]);

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
        setMessage(`Access panel posted. Voice channel ID: ${result.channelId}; access role ID: ${result.roleId}.`);
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Podcast action failed.");
    } finally {
      setBusy(false);
    }
  }

  if (!guildId) return <p>Select a server before opening podcast controls.</p>;
  return (
    <main style={{ maxWidth: 900, padding: 24, color: "#ffd3d3" }}>
      <h1>Podcast studio</h1>
      <p>Every voice participant must consent in Discord with <code>/podcast consent</code>. A new participant or withdrawn consent pauses capture. Live audio is public; recordings stay private until published.</p>
      {error ? <p role="alert">{error}</p> : null}
      {message ? <p role="status">{message}</p> : null}
      <p>Status: {control?.state || "loading"}{control?.missingConsent ? ` · ${control.missingConsent} awaiting consent` : ""}</p>
      <p><a href={`/podcasts/${guildId}`}>Public listening page</a> · <a href={`/api/podcast/${guildId}/feed.xml`}>RSS feed</a></p>
      <label>Episode title <input maxLength={150} value={title} onChange={(event) => setTitle(event.target.value)} /></label>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 12 }}>
        <button disabled={busy} onClick={() => void send("control", { action: "prepare" })}>Prepare in my voice channel</button>
        <button disabled={busy} onClick={() => void send("control", { action: "start", title })}>Start / resume</button>
        <button disabled={busy} onClick={() => void send("control", { action: "stop" })}>Stop and save privately</button>
      </div>
      {control?.isAdmin ? (
        <>
        <section>
          <h2>Podcast access panel</h2>
          <p>Post an agreement panel and grant a dedicated access role. Channel access is not recording consent. Existing channel overrides and administrators can still permit access; review the voice channel permissions.</p>
          {control.accessConfig ? <p>Configured voice channel: {control.accessConfig.channelId}; access role: {control.accessConfig.roleId}. Leave those fields blank to reuse them when reposting.</p> : null}
          <div><label>Panel text channel ID <input value={panelTextChannel} onChange={(event) => setPanelTextChannel(event.target.value)} /></label></div>
          <div><label>Voice channel ID (optional) <input value={panelVoiceChannel} onChange={(event) => setPanelVoiceChannel(event.target.value)} /></label></div>
          <div><label>Dedicated access role ID (optional) <input value={panelRole} onChange={(event) => setPanelRole(event.target.value)} /></label></div>
          <p>For a new setup, leave the voice channel or role blank to create it. Setting up an existing voice channel changes its permission overwrites.</p>
          <button disabled={busy || !panelTextChannel.trim()} onClick={() => void send("control", {
            action: "accessPanel",
            textChannelId: panelTextChannel.trim(),
            channelId: panelVoiceChannel.trim() || control.accessConfig?.channelId || "",
            roleId: panelRole.trim() || control.accessConfig?.roleId || "",
          })}>Set up and post panel</button>
        </section>
        <section>
          <h2>Host roles</h2>
          <p>Current role IDs: {control.hostRoles.join(", ") || "none"}</p>
          <label>Replacement role IDs, separated by commas <input value={roles} onChange={(event) => setRoles(event.target.value)} /></label>
          <button disabled={busy} onClick={() => void send("control", { action: "hostRoles", roleIds: roles.split(/[,\s]+/).filter(Boolean) })}>Save host roles</button>
        </section>
        </>
      ) : null}
      <h2>Episodes</h2>
      {(control?.episodes || []).map((episode) => (
        <div key={episode.id} style={{ marginBottom: 12 }}>
          <strong>{episode.title}</strong> · {episode.state} · {episode.published ? "public" : "private"}
          <button disabled={busy || (episode.state !== "completed" && !episode.published)} onClick={() => void send("publication", { episodeId: episode.id, published: !episode.published })}>
            {episode.published ? "Make private" : "Publish"}
          </button>
        </div>
      ))}
    </main>
  );
}
