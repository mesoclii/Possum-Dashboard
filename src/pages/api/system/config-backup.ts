import type { NextApiRequest, NextApiResponse } from "next";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { appendAudit, deepMerge, withSetupStoreLock } from "@/lib/setupStore";
import { requirePremiumAccess } from "@/lib/premiumGuard";
import { fetchDiscordGuilds, fetchDiscordUser, hasGuildManageAccess } from "@/lib/discordOAuth";
import { DASHBOARD_SESSION_COOKIE, readDashboardSessionValue } from "@/lib/session";

const SETUP_DIR = path.join(process.cwd(), "data", "setup");
const FILES = [
  "audit-trail-config.json", "runtime-safety.json", "economy-command-config.json",
  "games-config.json", "heist-ops-config.json", "leaderboard-config.json",
  "progression-config.json", "radio-birthday-config.json", "security-automation-studio.json",
  "security-policy-config.json", "selfroles-config.json", "settings-config.json", "store-config.json",
] as const;
const ALLOWED = new Set<string>(FILES);

function isObject(value: unknown): value is Record<string, any> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function safeKeys(value: unknown): boolean {
  if (Array.isArray(value)) return value.every(safeKeys);
  if (!isObject(value)) return true;
  return Object.entries(value).every(([key, child]) =>
    !["__proto__", "prototype", "constructor"].includes(key) && safeKeys(child));
}

function readStore(file: string): Record<string, any> {
  const fp = path.join(SETUP_DIR, file);
  try {
    if (!fs.lstatSync(fp).isFile()) throw new Error("Not a regular file");
  } catch (error: any) {
    if (error?.code === "ENOENT") return {};
    throw new Error(`Cannot read setup store: ${file}`);
  }
  try {
    const parsed: unknown = JSON.parse(fs.readFileSync(fp, "utf8"));
    if (!isObject(parsed) || !safeKeys(parsed)) throw new Error("Invalid store");
    return parsed;
  } catch {
    throw new Error(`Cannot read setup store: ${file}`);
  }
}

function writeAtomic(file: string, value: Record<string, any>) {
  fs.mkdirSync(SETUP_DIR, { recursive: true });
  const destination = path.join(SETUP_DIR, file);
  const temporary = path.join(SETUP_DIR, `.${file}.${crypto.randomBytes(16).toString("hex")}.tmp`);
  try {
    fs.writeFileSync(temporary, JSON.stringify(value, null, 2), { encoding: "utf8", flag: "wx", mode: 0o600 });
    fs.renameSync(temporary, destination);
  } catch (error) {
    try { fs.unlinkSync(temporary); } catch { /* Preserve the write error. */ }
    throw error;
  }
}

function validatePayload(payload: unknown, guildId: string): string | null {
  if (!isObject(payload) || payload.guildId !== guildId || !isObject(payload.files)) {
    return "Backup must identify the target guild and contain a files object.";
  }
  for (const [file, value] of Object.entries(payload.files)) {
    if (!ALLOWED.has(file) || !isObject(value) || !safeKeys(value)) return `Invalid backup file or configuration: ${file}`;
  }
  return null;
}

// Not exposed until the dashboard's session trust boundary is isolated.
export function restoreConfigBackup(guildId: string, payload: any, mode: "merge" | "replace") {
  const invalid = validatePayload(payload, guildId);
  if (invalid) return { success: false, applied: [] as string[], error: invalid };
  const applied: string[] = [];
  try {
    return withSetupStoreLock(() => {
      const pending: Array<[string, Record<string, any>]> = [];
      for (const [file, cfg] of Object.entries(payload.files)) {
        const store = readStore(file);
        if (mode === "merge" && Object.hasOwn(store, guildId) && !isObject(store[guildId])) {
          throw new Error(`Invalid guild configuration in setup store: ${file}`);
        }
        store[guildId] = mode === "replace" ? cfg : deepMerge(store[guildId] || {}, cfg);
        pending.push([file, store]);
      }
      for (const [file, store] of pending) {
        writeAtomic(file, store);
        applied.push(file);
      }
      appendAudit({ guildId, area: "backup-restore", action: "import", mode, count: applied.length });
      return { success: true, applied };
    });
  } catch (error: any) {
    return { success: false, applied, error: applied.length
      ? "Restore failed; listed files were applied. Verify the audit log and retry carefully."
      : error?.message || "Restore failed before any files were applied." };
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET" && req.method !== "POST") return res.status(405).json({ success: false, error: "Method not allowed" });
  const queryGuild = req.query.guildId;
  const bodyGuild = req.body?.guildId;
  if ((queryGuild !== undefined && typeof queryGuild !== "string") ||
      (bodyGuild !== undefined && typeof bodyGuild !== "string") ||
      (queryGuild && bodyGuild && queryGuild !== bodyGuild)) {
    return res.status(400).json({ success: false, error: "Conflicting guildId values." });
  }
  const guildId = String(queryGuild || bodyGuild || "").trim();
  if (!/^\d{16,20}$/.test(guildId)) return res.status(400).json({ success: false, error: "Valid guildId required." });

  let session;
  try { session = await readDashboardSessionValue(req.cookies[DASHBOARD_SESSION_COOKIE]); }
  catch { return res.status(503).json({ success: false, error: "Dashboard session verification unavailable." }); }
  if (!session?.user?.id || !session.accessToken) return res.status(401).json({ success: false, error: "A valid dashboard session is required." });
  try {
    const user = await fetchDiscordUser(session.accessToken);
    if (!user?.id || user.id !== session.user.id) {
      return res.status(401).json({ success: false, error: "Dashboard session does not match the Discord account." });
    }
    const guilds = await fetchDiscordGuilds(session.accessToken);
    if (!Array.isArray(guilds)) throw new Error("Invalid Discord response");
    if (!guilds.some((guild) => guild?.id === guildId && hasGuildManageAccess(guild))) {
      return res.status(403).json({ success: false, error: "Guild administrator access is required." });
    }
  } catch {
    return res.status(503).json({ success: false, error: "Cannot verify guild administrator access with Discord." });
  }
  const allowed = await requirePremiumAccess(req, res, guildId, "config-backup");
  if (allowed !== true) return allowed;

  if (req.method === "GET") {
    try {
      const files = withSetupStoreLock(() => {
        const result: Record<string, any> = {};
        for (const file of FILES) {
          const store = readStore(file);
          if (Object.hasOwn(store, guildId)) {
            if (!isObject(store[guildId]) || !safeKeys(store[guildId])) throw new Error(`Invalid guild configuration in setup store: ${file}`);
            result[file] = store[guildId];
          }
        }
        return result;
      });
      res.setHeader("Cache-Control", "no-store");
      return res.status(200).json({ success: true, guildId, backup: { guildId, capturedAt: new Date().toISOString(), files } });
    } catch (error: any) {
      return res.status(500).json({ success: false, error: error.message || "Cannot read setup stores." });
    }
  }

  const invalid = validatePayload(req.body?.payload, guildId);
  if (invalid) return res.status(400).json({ success: false, error: invalid });
  if (req.body?.mode !== undefined && !["merge", "replace"].includes(req.body.mode)) {
    return res.status(400).json({ success: false, error: "Invalid restore mode." });
  }
  return res.status(503).json({ success: false, error: "Restore is disabled until dashboard sessions are isolated and all setup-store writers are verified to use the lock." });
}
