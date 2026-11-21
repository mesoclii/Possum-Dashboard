import type { NextApiRequest, NextApiResponse } from "next";
import { BOT_API, buildBotApiHeaders, fetchBotApi, readActorUserId, readJsonSafe } from "@/lib/botApi";

export const config = { api: { bodyParser: false } };

async function readRequestBody(req: NextApiRequest): Promise<{ body: any; raw: Buffer }> {
  if (req.body && typeof req.body === "object") {
    const raw = Buffer.from(JSON.stringify(req.body), "utf8");
    return { body: req.body, raw };
  }
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    const part = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += part.length;
    if (size > 2 * 1024 * 1024) throw new Error("Request body is too large.");
    chunks.push(part);
  }
  const raw = Buffer.concat(chunks);
  try { return { body: raw.length ? JSON.parse(raw.toString("utf8")) : {}, raw }; }
  catch { throw new Error("Request body is not valid JSON."); }
}

export function validUndoBotUrl(raw: string): boolean {
  try {
    const url = new URL(raw);
    return url.protocol === "http:" && (url.hostname === "127.0.0.1" || url.hostname === "[::1]") &&
      !url.username && !url.password && url.pathname === "/" && !url.search && !url.hash;
  } catch {
    return false;
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const viewerUserId = await readActorUserId(req);
  let actionForError = "";
  if (!viewerUserId) {
    return res.status(401).json({ success: false, error: "A valid dashboard session is required." });
  }

  try {
    const headers = await buildBotApiHeaders(req);
    if (req.method === "GET") {
      const guildId = String(req.query.guildId || "").trim();
      const format = String(req.query.format || "").trim();
      const exportFlag = String(req.query.export || "").trim();
      const upstream = await fetchBotApi(
        `${BOT_API}/infrastructure?guildId=${encodeURIComponent(guildId)}&format=${encodeURIComponent(format)}&export=${encodeURIComponent(exportFlag)}`,
        { headers, cache: "no-store" }
      );
      return res.status(upstream.status).json(await readJsonSafe(upstream));
    }

    if (req.method === "POST") {
      let parsed: { body: any; raw: Buffer };
      try { parsed = await readRequestBody(req); }
      catch (error: any) { return res.status(400).json({ success: false, error: error?.message || "Invalid request body." }); }
      const body = parsed.body && typeof parsed.body === "object" && !Array.isArray(parsed.body) ? parsed.body : {};
      const postHeaders = await buildBotApiHeaders(req, { json: true });
      const action = String(body.action || "").trim();
      actionForError = action;
      const proof = String(req.headers["x-restore-auth-proof"] || "").trim();
      if (action === "undo-preview" || action === "undo") {
        if (!proof) return res.status(503).json({ success: false, error: "Undo Setup requires a proof from the isolated authorization broker." });
        if (!validUndoBotUrl(BOT_API)) {
          return res.status(503).json({ success: false, error: "Undo Setup requires a direct loopback bot connection." });
        }
        postHeaders["x-restore-auth-proof"] = proof;
      }
      const upstream = await fetchBotApi(`${BOT_API}/infrastructure`, {
        method: "POST",
        headers: postHeaders,
        body: parsed.raw as unknown as BodyInit,
        cache: "no-store",
        redirect: action === "undo-preview" || action === "undo" ? "error" : "follow",
      });
      return res.status(upstream.status).json(await readJsonSafe(upstream));
    }

    return res.status(405).json({ success: false, error: "Method not allowed" });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: actionForError === "undo-preview" || actionForError === "undo" ? "Undo Setup is unavailable." : error?.message || "Bot API unreachable" });
  }
}
