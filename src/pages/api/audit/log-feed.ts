import type { NextApiRequest, NextApiResponse } from "next";
import fs from "fs";
import path from "path";
import { DASHBOARD_SESSION_COOKIE, readDashboardSessionValue } from "@/lib/session";

const PM2_DIR = process.env.PM2_LOG_DIR || "/home/ubuntu/.pm2/logs";

// Bounded read: the previous implementation loaded the entire file into memory on
// every request, which could exhaust the dashboard heap on a large PM2 log.
const MAX_TAIL_BYTES = 256 * 1024;

const DEFAULT_MAP: Record<string, string[]> = {
  "bot-out": [
    String(process.env.POSSUM_BOT_OUT_LOG || "").trim(),
    String(process.env.BOT_OUT_LOG_FILE || "").trim(),
    "possum-bot-out.log"
  ],
  "bot-error": [
    String(process.env.POSSUM_BOT_ERROR_LOG || "").trim(),
    String(process.env.BOT_ERROR_LOG_FILE || "").trim(),
    "possum-bot-error.log"
  ],
  "dash-out": [
    String(process.env.POSSUM_DASH_OUT_LOG || "").trim(),
    "possum-dashboard-out.log"
  ],
  "dash-error": [
    String(process.env.POSSUM_DASH_ERROR_LOG || "").trim(),
    "possum-dashboard-error.log"
  ]
};

function resolveFile(kind: string): string {
  const candidates = (DEFAULT_MAP[kind] || DEFAULT_MAP["dash-error"]).filter(Boolean);

  for (const f of candidates) {
    const full = path.join(PM2_DIR, f);
    if (fs.existsSync(full)) return f;
  }

  try {
    const files = fs.readdirSync(PM2_DIR);
    const suffix = kind === "bot-out"
      ? "-bot-out.log"
      : kind === "bot-error"
      ? "-bot-error.log"
      : kind === "dash-out"
      ? "-dashboard-out.log"
      : "-dashboard-error.log";
    const matched = files.find((name) => name.endsWith(suffix));
    if (matched) return matched;
  } catch {
    // ignore and use fallback
  }

  return candidates[0] || "possum-dashboard-error.log";
}

/**
 * Reads only the last MAX_TAIL_BYTES of a log file and returns the trailing
 * complete lines, so memory use is capped no matter how large the file is.
 */
function readTailLines(filePath: string, maxLines: number): string[] {
  const stat = fs.statSync(filePath);
  if (stat.size === 0) return [];

  const start = Math.max(0, stat.size - MAX_TAIL_BYTES);
  const length = stat.size - start;
  const buffer = Buffer.allocUnsafe(length);

  const fd = fs.openSync(filePath, "r");
  let bytesRead = 0;
  try {
    bytesRead = fs.readSync(fd, buffer, 0, length, start);
  } finally {
    fs.closeSync(fd);
  }

  const text = buffer.toString("utf8", 0, bytesRead);
  const lines = text.split(/\r?\n/).filter(Boolean);

  // When we started mid-file the first line is partial; drop it.
  if (start > 0 && lines.length) lines.shift();

  return lines.slice(-maxLines);
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ success: false, error: "Method not allowed" });
  }

  // The log viewer belongs to the existing System Health surface, so any signed-in
  // dashboard user keeps access. What changes is that anonymous callers can no
  // longer read server logs: this is a session requirement, not a new creator
  // restriction, so no existing user loses functionality.
  const session = await readDashboardSessionValue(req.cookies[DASHBOARD_SESSION_COOKIE]);
  const userId = String(session?.user?.id || "").trim();

  if (!userId) {
    return res.status(401).json({ success: false, error: "Authentication required" });
  }

  res.setHeader("cache-control", "private, no-store");

  const kind = String(req.query.kind || "dash-error").trim();
  const lines = Math.max(20, Math.min(2000, Number(req.query.lines || 200)));
  const file = resolveFile(kind);
  const fp = path.join(PM2_DIR, file);

  if (!fs.existsSync(fp)) {
    return res.status(200).json({ success: true, kind, file: fp, lines: [] });
  }

  try {
    const arr = readTailLines(fp, lines);
    return res.status(200).json({
      success: true,
      kind,
      file: fp,
      count: arr.length,
      lines: arr
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return res.status(500).json({ success: false, error: `Unable to read log: ${message}` });
  }
}
