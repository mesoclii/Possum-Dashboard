import type { NextApiRequest, NextApiResponse } from "next";
import { BOT_API, buildBotApiHeaders, readActorUserId } from "@/lib/botApi";
import { getDashboardPublicOrigin } from "@/lib/dashboardUrl";

type Episode = {
  id: string;
  title: string;
  publishedAt: string;
  durationSeconds: number;
  bytes: number;
};

function escapeXml(value: unknown) {
  return String(value ?? "").replace(/[<>&"']/g, (character) => ({
    "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&apos;",
  })[character] || character);
}

function validEpisodeId(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const guildId = String(req.query.guildId || "");
  const parts = Array.isArray(req.query.path) ? req.query.path : [];
  if (!/^\d{16,20}$/.test(guildId)) return res.status(400).json({ success: false, error: "Invalid server ID." });
  const path = parts.join("/");
  const isFeed = path === "feed.xml";
  const isLive = path === "live";
  const isEpisodes = path === "episodes";
  const isAudio = parts.length === 3 && parts[0] === "episodes" && validEpisodeId(parts[1]) && parts[2] === "audio";
  const isPreview = parts.length === 3 && parts[0] === "episodes" && validEpisodeId(parts[1]) && parts[2] === "preview";
  const isEdit = parts.length === 3 && parts[0] === "episodes" && validEpisodeId(parts[1]) && parts[2] === "edit";
  const isReview = parts.length === 3 && parts[0] === "episodes" && validEpisodeId(parts[1]) && parts[2] === "review";
  const isControl = path === "control";
  const isPublication = path === "publication";
  if (!isFeed && !isLive && !isEpisodes && !isAudio && !isPreview && !isEdit && !isReview && !isControl && !isPublication) {
    return res.status(404).json({ success: false, error: "Podcast route not found." });
  }
  if ((!isControl && !isPublication && !isEdit && !isReview && req.method !== "GET") ||
      (isControl && !["GET", "POST"].includes(String(req.method))) ||
      ((isPublication || isEdit || isReview) && req.method !== "POST")) {
    return res.status(405).json({ success: false, error: "Method not allowed." });
  }
  if (req.method === "POST" && !/^application\/json(?:\s*;|$)/i.test(String(req.headers["content-type"] || ""))) {
    return res.status(415).json({ success: false, error: "JSON content is required." });
  }
  const token = String(process.env.DASHBOARD_API_TOKEN || "").trim();
  if (!token) return res.status(503).json({ success: false, error: "Podcast service is not configured." });
  let headers: Record<string, string> = { "x-dashboard-token": token };
  if (isControl || isPublication || isPreview || isEdit || isReview) {
    if (!await readActorUserId(req)) return res.status(401).json({ success: false, error: "Sign in to manage podcasts." });
    headers = await buildBotApiHeaders(req, { json: req.method === "POST" });
  }
  if ((isAudio || isPreview) && typeof req.headers.range === "string") headers.range = req.headers.range;
  const upstreamPath = isFeed ? "episodes" : path;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), isEdit ? 250_000 : 15_000);
  res.once("close", () => controller.abort());
  try {
    const response = await fetch(`${BOT_API}/podcast/${guildId}/${upstreamPath}`, {
      method: req.method,
      headers,
      body: req.method === "POST" ? JSON.stringify(req.body || {}) : undefined,
      signal: controller.signal,
      cache: "no-store",
    });
    clearTimeout(timeout);
    res.setHeader("Cache-Control", "no-store, no-transform");
    if (isFeed && response.ok) {
      const body = await response.json() as { episodes?: Episode[] };
      const origin = getDashboardPublicOrigin();
      if (!/^https:\/\//i.test(origin)) {
        return res.status(503).json({ success: false, error: "A public HTTPS dashboard URL is required for podcast feeds." });
      }
      const podcastPath = `/podcasts/${guildId}`;
      const items = (body.episodes || []).map((episode) => {
        if (!validEpisodeId(episode.id) || !Number.isFinite(episode.bytes) || !Number.isFinite(Date.parse(episode.publishedAt))) {
          throw new Error("Published episode metadata is invalid.");
        }
        const audio = `${origin}/api/podcast/${guildId}/episodes/${episode.id}/audio`;
        return `<item><title>${escapeXml(episode.title)}</title><guid isPermaLink="false">${escapeXml(episode.id)}</guid><pubDate>${new Date(episode.publishedAt).toUTCString()}</pubDate><enclosure url="${escapeXml(audio)}" length="${episode.bytes}" type="audio/mpeg"/></item>`;
      }).join("");
      res.setHeader("Content-Type", "application/rss+xml; charset=utf-8");
      return res.status(200).send(`<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>Possum Podcast</title><link>${escapeXml(origin + podcastPath)}</link><description>Published episodes from this server's Possum Podcast.</description>${items}</channel></rss>`);
    }
    res.status(response.status);
    for (const name of ["content-type", "content-length", "content-range", "accept-ranges"]) {
      const value = response.headers.get(name);
      if (value) res.setHeader(name, value);
    }
    if (!response.body) return res.end();
    const reader = response.body.getReader();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!res.write(Buffer.from(value))) {
        await new Promise<void>((resolve, reject) => {
          const cleanup = () => { res.off("drain", onDrain); res.off("close", onClose); };
          const onDrain = () => { cleanup(); resolve(); };
          const onClose = () => { cleanup(); reject(new Error("Podcast listener disconnected.")); };
          res.once("drain", onDrain);
          res.once("close", onClose);
        });
      }
    }
    return res.end();
  } catch (error) {
    clearTimeout(timeout);
    if (res.destroyed) return;
    console.error("[Podcast] Dashboard proxy failed:", error);
    if (res.headersSent) return res.destroy();
    return res.status(502).json({ success: false, error: "Podcast service is unavailable." });
  }
}
