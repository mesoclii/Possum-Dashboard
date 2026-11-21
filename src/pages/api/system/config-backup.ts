import type { NextApiRequest, NextApiResponse } from "next";
import crypto from "node:crypto";
import { appendAudit } from "@/lib/setupStore";
import { fetchDiscordGuilds, fetchDiscordUser, hasGuildManageAccess } from "@/lib/discordOAuth";
import { DASHBOARD_SESSION_COOKIE, readDashboardSessionValue } from "@/lib/session";
import { BOT_API, buildBotApiHeaders, fetchBotApi, readJsonSafe } from "@/lib/botApi";
import {
  captureDashboardSettingsBackup,
  deletePrivateDashboardBackup,
  getPrivateDashboardBackup,
  listPrivateDashboardBackups,
  previewDashboardSettingsRestore,
  restoreDashboardSettings,
  savePrivateDashboardBackup,
  validateDashboardSettingsBackup,
} from "@/lib/dashboardConfigBackup";

export const config = { api: { bodyParser: { sizeLimit: "9mb" } } };

const FULL_BACKUP_KIND = "possum-dashboard-full-configuration";
const FULL_BACKUP_VERSION = 1;
const MAX_FULL_BACKUP_BYTES = 8 * 1024 * 1024;
const FULL_PREVIEW_TTL_MS = 5 * 60 * 1000;
const MAX_FULL_PREVIEWS = 128;
const fullPreviews = new Map<string, {
  guildId: string; actorId: string; targetDigest: string; botToken: string; dashboardToken: string;
  recovery: Record<string, any>; expiresAt: number;
}>();

type FullBackup = { kind: typeof FULL_BACKUP_KIND; version: number; guildId: string; name: string; createdAt: string; bot: any; dashboard: any };

function reply(res: NextApiResponse, status: number, body: Record<string, unknown>) {
  res.setHeader("Cache-Control", "private, no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");
  return res.status(status).json(body);
}

function isObject(value: unknown): value is Record<string, any> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function digest(value: unknown) {
  return crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function configuredRestoreStaff(userId: string) {
  const allowed = [
    process.env.MASTER_OWNER_USER_ID, process.env.CONTROL_OWNER_USER_ID, process.env.OWNER_USER_ID,
    process.env.OWNER_USER_IDS, process.env.BOT_OWNER_USER_ID, process.env.BOT_OWNER_ID,
    process.env.SUPERUSER_USER_ID, process.env.DASHBOARD_RESTORE_STAFF_USER_IDS,
  ].flatMap((value) => String(value || "").split(",").map((entry) => entry.trim()))
    .filter((entry) => /^\d{16,20}$/.test(entry));
  return allowed.includes(userId);
}

async function authenticateGuild(req: NextApiRequest, guildId: string, restore: boolean) {
  const session = await readDashboardSessionValue(req.cookies[DASHBOARD_SESSION_COOKIE]);
  if (!session?.user?.id || !session.accessToken) return { status: 401 as const, error: "A valid dashboard session is required." };
  const actorId = String(session.user.id);
  try {
    const user = await fetchDiscordUser(session.accessToken);
    if (!user?.id || user.id !== actorId) return { status: 401 as const, error: "Dashboard session does not match the Discord account." };
    const guilds = await fetchDiscordGuilds(session.accessToken);
    if (!Array.isArray(guilds)) throw new Error("Invalid Discord response");
    const guild = guilds.find((entry) => entry?.id === guildId);
    const globalStaff = configuredRestoreStaff(actorId);
    const isGuildOwner = guild?.owner === true;
    const canManage = Boolean(guild && hasGuildManageAccess(guild));
    if (restore && !isGuildOwner && !globalStaff) return { status: 403 as const, error: "Restore is limited to this Discord server's owner or the configured Possum owner/development team." };
    if (!restore && !canManage && !globalStaff) return { status: 403 as const, error: "Guild administrator access is required." };
    if (restore && !globalStaff && !isGuildOwner) return { status: 403 as const, error: "Discord server owner access is required." };
    return { status: 200 as const, actorId, session, guild, globalStaff };
  } catch (error: any) {
    if (error?.status === 403) return { status: 403 as const, error: error.message };
    return { status: 503 as const, error: "Cannot verify Discord guild access right now." };
  }
}

function validateFullBackup(value: unknown, guildId: string): asserts value is FullBackup {
  if (!isObject(value) || value.kind !== FULL_BACKUP_KIND || value.version !== FULL_BACKUP_VERSION || value.guildId !== guildId ||
      !/^\d{16,20}$/.test(guildId) || typeof value.name !== "string" || value.name.length > 100 ||
      typeof value.createdAt !== "string" || !Number.isFinite(Date.parse(value.createdAt)) ||
      !isObject(value.bot) || !isObject(value.dashboard)) throw new Error("Invalid or incompatible full dashboard backup.");
  validateDashboardSettingsBackup(value.dashboard, guildId);
  if (Buffer.byteLength(JSON.stringify(value), "utf8") > MAX_FULL_BACKUP_BYTES) throw new Error("Full dashboard backup exceeds the 8 MiB limit.");
}

async function callBot(req: NextApiRequest, session: { accessToken: string }, actorId: string, body: Record<string, unknown>) {
  const headers = await buildBotApiHeaders(req, { json: true });
  headers["x-restore-discord-token"] = session.accessToken;
  const upstream = await fetchBotApi(`${BOT_API.replace(/\/$/, "")}/engine-config-backups`, {
    method: "POST", headers, body: JSON.stringify(body), cache: "no-store", redirect: "error",
  });
  const data = await readJsonSafe(upstream);
  if (!upstream.ok || data?.success !== true) {
    const error = new Error(String(data?.error || "Bot configuration service is unavailable."));
    (error as any).status = upstream.status;
    (error as any).data = data;
    throw error;
  }
  return data;
}

function sameOrigin(req: NextApiRequest) {
  const origin = String(req.headers.origin || "");
  if (!origin) return false;
  try {
    const parsed = new URL(origin);
    const forwardedHost = String(req.headers["x-forwarded-host"] || req.headers.host || "").split(",")[0].trim();
    const forwardedProto = String(req.headers["x-forwarded-proto"] || (process.env.NODE_ENV === "production" ? "https" : "http")).split(",")[0].trim();
    return parsed.host.toLowerCase() === forwardedHost.toLowerCase() && parsed.protocol === `${forwardedProto}:`;
  } catch { return false; }
}

function purgeFullPreviews() {
  const now = Date.now();
  for (const [token, preview] of fullPreviews) if (preview.expiresAt <= now) fullPreviews.delete(token);
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader("Cache-Control", "private, no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");
  if (req.method !== "GET" && req.method !== "POST") return reply(res, 405, { success: false, error: "Method not allowed" });
  const queryGuild = req.query.guildId;
  const bodyGuild = req.body?.guildId;
  if ((queryGuild !== undefined && typeof queryGuild !== "string") || (bodyGuild !== undefined && typeof bodyGuild !== "string") ||
      (queryGuild && bodyGuild && queryGuild !== bodyGuild)) return reply(res, 400, { success: false, error: "Conflicting guildId values." });
  const guildId = String(queryGuild || bodyGuild || "").trim();
  if (!/^\d{16,20}$/.test(guildId)) return reply(res, 400, { success: false, error: "Valid guildId required." });

  const action = req.method === "GET" ? String(req.query.action || "export") : String(req.body?.action || "").trim().toLowerCase();
  const restoreAction = action === "preview" || action === "restore";
  if (req.method === "POST" && !sameOrigin(req)) return reply(res, 403, { success: false, error: "Same-origin request required." });

  let auth;
  try { auth = await authenticateGuild(req, guildId, restoreAction); }
  catch { return reply(res, 503, { success: false, error: "Dashboard session verification unavailable." }); }
  if (auth.status !== 200) return reply(res, auth.status, { success: false, error: auth.error });

  try {
    if (req.method === "GET") {
      if (action === "list") return reply(res, 200, { success: true, backups: listPrivateDashboardBackups(guildId) });
      if (action === "download") {
        const entry = getPrivateDashboardBackup(guildId, String(req.query.backupId || ""));
        return entry ? reply(res, 200, { success: true, backup: entry.backup }) : reply(res, 404, { success: false, error: "Backup not found." });
      }
      if (action !== "export") return reply(res, 400, { success: false, error: "Invalid action." });
      const backup = captureDashboardSettingsBackup(guildId, String(req.query.name || ""), auth.actorId);
      return reply(res, 200, { success: true, guildId, backup });
    }

    const body = isObject(req.body) ? req.body : {};
    if (action === "save") {
      validateFullBackup(body.backup, guildId);
      return reply(res, 200, { success: true, savedBackup: savePrivateDashboardBackup(guildId, body.backup) });
    }
    if (action === "delete") {
      if (!auth.globalStaff && auth.guild?.owner !== true) return reply(res, 403, { success: false, error: "Only the server owner or configured Possum owner/development team can delete server backups." });
      const deleted = deletePrivateDashboardBackup(guildId, String(body.backupId || ""));
      return deleted ? reply(res, 200, { success: true }) : reply(res, 404, { success: false, error: "Backup not found." });
    }
    if (action === "preview") {
      const snapshot = body.backup;
      validateFullBackup(snapshot, guildId);
      purgeFullPreviews();
      if (fullPreviews.size >= MAX_FULL_PREVIEWS) return reply(res, 429, { success: false, error: "Too many pending full restore previews." });
      const botPreview = await callBot(req, auth.session, auth.actorId, { guildId, action: "full-preview", snapshot: snapshot.bot });
      const dashboardPreview = previewDashboardSettingsRestore(guildId, auth.actorId, snapshot.dashboard);
      const token = crypto.randomUUID();
      const recovery = {
        kind: FULL_BACKUP_KIND, version: FULL_BACKUP_VERSION, id: crypto.randomUUID(), guildId,
        name: "Pre-restore recovery", createdAt: new Date().toISOString(),
        bot: botPreview.recovery, dashboard: dashboardPreview.recovery,
      };
      fullPreviews.set(token, {
        guildId, actorId: auth.actorId, targetDigest: digest(snapshot),
        botToken: botPreview.token, dashboardToken: dashboardPreview.token,
        recovery, expiresAt: Date.now() + FULL_PREVIEW_TTL_MS,
      });
      return reply(res, 200, { success: true, token, expiresAt: new Date(Date.now() + FULL_PREVIEW_TTL_MS).toISOString(),
        recovery, changedEngines: botPreview.changedEngines, changedFeatures: botPreview.changedFeatures,
        changedDashboardFiles: dashboardPreview.changedFiles, changedDatabaseSettings: botPreview.changedDashboardSettings || [],
      });
    }
    if (action === "restore") {
      if (body.confirm !== true || body.recoveryDownloaded !== true || typeof body.previewToken !== "string") {
        return reply(res, 400, { success: false, error: "Confirm the preview and download the complete recovery backup before restoring." });
      }
      const pending = fullPreviews.get(body.previewToken);
      fullPreviews.delete(body.previewToken);
      if (!pending || pending.expiresAt <= Date.now() || pending.guildId !== guildId || pending.actorId !== auth.actorId) {
        return reply(res, 409, { success: false, code: "FULL_PREVIEW_INVALID", error: "The full restore preview expired or belongs to another server or user." });
      }
      const snapshot = body.backup;
      validateFullBackup(snapshot, guildId);
      if (pending.targetDigest !== digest(snapshot)) return reply(res, 409, { success: false, code: "FULL_PREVIEW_INVALID", error: "The selected backup changed after preview. Preview it again." });

      const dashboardResult = restoreDashboardSettings(guildId, auth.actorId, snapshot.dashboard, pending.dashboardToken);
      if (!dashboardResult.success) return reply(res, 409, { success: false, code: "DASHBOARD_SETTINGS_CHANGED", error: "Dashboard settings changed after preview; no settings were restored. Preview again." });
      try {
        const botResult = await callBot(req, auth.session, auth.actorId, {
          guildId, action: "full-restore", snapshot: snapshot.bot, previewToken: pending.botToken,
          confirm: true, recoveryDownloaded: true,
        });
        appendAudit({ guildId, area: "backup-restore", action: "full-restore", actorUserId: auth.actorId,
          dashboardFiles: dashboardResult.applied.length, botEngines: botResult.appliedEngines?.length || 0 });
        return reply(res, 200, { success: true, dashboardFiles: dashboardResult.applied, bot: botResult,
          warning: "Dashboard-managed settings, selected bot configuration, feature gates and saved flow definitions were restored. Discord channels/roles, member/game records, and execution history are not changed." });
      } catch (error: any) {
        let dashboardRollback = "failed";
        try {
          const rollbackPreview = previewDashboardSettingsRestore(guildId, auth.actorId, pending.recovery.dashboard);
          const rollback = restoreDashboardSettings(guildId, auth.actorId, pending.recovery.dashboard, rollbackPreview.token);
          dashboardRollback = rollback.success ? "restored" : "settings-changed";
        } catch { dashboardRollback = "failed"; }
        const upstreamStatus = Number(error?.status || 503);
        return reply(res, 503, { success: false, code: "FULL_RESTORE_PARTIAL_OUTCOME", retryable: false,
          dashboardRollback, error: "The bot restore did not complete cleanly. Dashboard settings rollback was attempted; preserve the recovery download and compare both services before retrying.",
          detail: upstreamStatus === 409 ? "Bot settings changed after preview." : undefined });
      }
    }
    if (action === "validate") {
      validateFullBackup(body.backup, guildId);
      const botCheck = await callBot(req, auth.session, auth.actorId, { guildId, action: "validate", snapshot: body.backup.bot });
      return reply(res, 200, { success: true, ...botCheck, valid: true, coverage: "dashboard setup files, guild routing/roles, automation/custom-command definitions, bot engines and feature gates; excludes runtime/member histories" });
    }
    if (action === "compare") {
      validateFullBackup(body.backup, guildId);
      const [botCompare, currentDashboard] = await Promise.all([
        callBot(req, auth.session, auth.actorId, { guildId, action: "compare", snapshot: body.backup.bot }),
        Promise.resolve(captureDashboardSettingsBackup(guildId, "Current dashboard settings", auth.actorId)),
      ]);
      const changedDashboardFiles = Object.keys(body.backup.dashboard.files).filter((file) =>
        digest(body.backup.dashboard.files[file as keyof typeof body.backup.dashboard.files]) !== digest(currentDashboard.files[file as keyof typeof currentDashboard.files]));
      return reply(res, 200, { success: true, ...botCompare, changedDashboardFiles });
    }
    return reply(res, 400, { success: false, error: "Invalid action." });
  } catch (error: any) {
    const message = String(error?.message || "Configuration backup service unavailable.");
    const status = Number(error?.status || 0);
    return reply(res, status >= 400 && status < 600 ? status : 400, { success: false, error: message });
  }
}
