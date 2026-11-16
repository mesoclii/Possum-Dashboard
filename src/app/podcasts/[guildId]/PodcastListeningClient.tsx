"use client";

import { useEffect, useState } from "react";

type Episode = { id: string; title: string; publishedAt: string };

export default function PodcastListeningClient({ guildId }: { guildId: string }) {
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [error, setError] = useState("");
  const base = `/api/podcast/${encodeURIComponent(guildId)}`;

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const response = await fetch(`${base}/episodes`, { cache: "no-store" });
        const body = await response.json();
        if (!response.ok || !body.success) throw new Error(body.error || "Episodes are unavailable.");
        if (active) { setEpisodes(body.episodes); setError(""); }
      } catch (reason) {
        if (active) setError(reason instanceof Error ? reason.message : "Episodes are unavailable.");
      }
    }
    void load();
    const timer = window.setInterval(() => { if (document.visibilityState === "visible") void load(); }, 30_000);
    return () => { active = false; window.clearInterval(timer); };
  }, [base]);

  return (
    <main style={{ maxWidth: 850, margin: "auto", padding: 24, color: "#ffd3d3" }}>
      <h1>Possum Podcast</h1>
      <p>Listen live or play a published episode. Live audio pauses when a participant withdraws consent or someone joins.</p>
      <h2>Listen live</h2>
      <audio controls preload="none" src={`${base}/live`} />
      <p>If the live stream pauses, press play again after the host resumes.</p>
      <p><a href={`${base}/feed.xml`}>Subscribe to the podcast RSS feed</a></p>
      <p><a href={`/podcasts/${encodeURIComponent(guildId)}/studio`}>Podcast host studio</a></p>
      <h2>Published episodes</h2>
      {error ? <p role="alert">{error}</p> : null}
      {!error && !episodes.length ? <p>No episodes have been published yet.</p> : null}
      {episodes.map((episode) => (
        <section key={episode.id} style={{ marginBottom: 20 }}>
          <h3>{episode.title}</h3>
          <p>Published {new Date(episode.publishedAt).toLocaleDateString()}</p>
          <audio controls preload="none" src={`${base}/episodes/${episode.id}/audio`} />
        </section>
      ))}
    </main>
  );
}
