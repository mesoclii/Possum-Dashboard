import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { appendAudit, withSetupStoreLock } from "@/lib/setupStore";

export const DASHBOARD_CONFIG_BACKUP_KIND = "possum-dashboard-settings";
export const DASHBOARD_CONFIG_BACKUP_VERSION = 2;
export const DASHBOARD_CONFIG_BACKUP_FILES = [
  "audit-trail-config.json", "runtime-safety.json", "economy-command-config.json",
  "games-config.json", "heist-ops-config.json", "leaderboard-config.json",
  "progression-config.json", "radio-birthday-config.json", "security-automation-studio.json",
  "security-policy-config.json", "selfroles-config.json", "settings-config.json", "store-config.json",
] as const;

const SETUP_DIR = path.join(process.cwd(), "data", "setup");
const PRIVATE_BACKUPS_FILE = "private-config-backups.json";
const MAX_BACKUP_BYTES = 4 * 1024 * 1024;
const MAX_SAVED_BACKUPS_PER_GUILD = 5;
const MAX_SAVED_BACKUPS_BYTES = 40 * 1024 * 1024;
const PREVIEW_TTL_MS = 5 * 60 * 1000;
const MAX_PREVIEWS = 128;
const previews = new Map<string, { guildId: string; actorId: string; targetDigest: string; currentDigest: string; recovery: DashboardSettingsBackup; expiresAt: number }>();

type JsonObject = Record<string, unknown>;
export type DashboardSettingsBackup = {
  kind: typeof DASHBOARD_CONFIG_BACKUP_KIND;
  version: typeof DASHBOARD_CONFIG_BACKUP_VERSION;
  guildId: string;
  name: string;
  createdAt: string;
  actorUserId: string;
  files: Record<(typeof DASHBOARD_CONFIG_BACKUP_FILES)[number], { present: boolean; value?: JsonObject }>;
};

function isObject(value: unknown): value is JsonObject {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function safeJson(value: unknown, depth = 0, seen = 0): number {
  if (depth > 30 || seen > 50_000) throw new Error("Backup configuration is too complex.");
  if (value === null || typeof value === "string" || typeof value === "boolean") return seen + 1;
  if (typeof value === "number" && Number.isFinite(value)) return seen + 1;
  if (Array.isArray(value)) return value.reduce((count, child) => safeJson(child, depth + 1, count), seen + 1);
  if (!isObject(value)) throw new Error("Backup contains a non-JSON value.");
  let count = seen + 1;
  for (const [key, child] of Object.entries(value)) {
    if (["__proto__", "prototype", "constructor"].includes(key)) throw new Error("Backup contains an unsafe property.");
    count = safeJson(child, depth + 1, count);
  }
  return count;
}

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (isObject(value)) return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(",")}}`;
  return JSON.stringify(value);
}

function digest(value: unknown): string {
  return crypto.createHash("sha256").update(canonical(value)).digest("hex");
}

function readStore(file: string): JsonObject {
  const target = path.join(SETUP_DIR, file);
  try {
    const stat = fs.lstatSync(target);
    if (!stat.isFile() || stat.isSymbolicLink()) throw new Error(`Unsafe dashboard configuration store: ${file}`);
  } catch (error: any) {
    if (error?.code === "ENOENT") return {};
    throw error;
  }
  let parsed: unknown;
  try { parsed = JSON.parse(fs.readFileSync(target, "utf8")); }
  catch { throw new Error(`Cannot read dashboard configuration store: ${file}`); }
  if (!isObject(parsed)) throw new Error(`Invalid dashboard configuration store: ${file}`);
  safeJson(parsed);
  return parsed;
}

function writeAtomic(file: string, value: JsonObject) {
  fs.mkdirSync(SETUP_DIR, { recursive: true, mode: 0o700 });
  const destination = path.join(SETUP_DIR, file);
  const temporary = path.join(SETUP_DIR, `.${file}.${crypto.randomBytes(16).toString("hex")}.tmp`);
  try {
    fs.writeFileSync(temporary, JSON.stringify(value, null, 2), { encoding: "utf8", flag: "wx", mode: 0o600 });
    fs.renameSync(temporary, destination);
    if (process.platform !== "win32") fs.chmodSync(destination, 0o600);
  } catch (error) {
    try { fs.unlinkSync(temporary); } catch { /* Preserve the write error. */ }
    throw error;
  }
}

function captureFiles(guildId: string) {
  const result = {} as DashboardSettingsBackup["files"];
  for (const file of DASHBOARD_CONFIG_BACKUP_FILES) {
    const store = readStore(file);
    const value = store[guildId];
    if (value === undefined) result[file] = { present: false };
    else {
      if (!isObject(value)) throw new Error(`Invalid guild entry in dashboard store: ${file}`);
      result[file] = { present: true, value };
    }
  }
  return result;
}

export function captureDashboardSettingsBackup(guildId: string, name = "", actorUserId = ""): DashboardSettingsBackup {
  if (!/^\d{16,20}$/.test(guildId)) throw new Error("Valid server ID required.");
  return withSetupStoreLock(() => {
    const backup: DashboardSettingsBackup = {
      kind: DASHBOARD_CONFIG_BACKUP_KIND,
      version: DASHBOARD_CONFIG_BACKUP_VERSION,
      guildId,
      name: String(name || "").trim().slice(0, 100) || `Dashboard settings ${new Date().toISOString()}`,
      createdAt: new Date().toISOString(),
      actorUserId: /^\d{16,20}$/.test(actorUserId) ? actorUserId : "",
      files: captureFiles(guildId),
    };
    validateDashboardSettingsBackup(backup, guildId);
    return backup;
  });
}

export function validateDashboardSettingsBackup(value: unknown, guildId: string): asserts value is DashboardSettingsBackup {
  if (!isObject(value) || value.kind !== DASHBOARD_CONFIG_BACKUP_KIND || value.version !== DASHBOARD_CONFIG_BACKUP_VERSION ||
      value.guildId !== guildId || !/^\d{16,20}$/.test(guildId) || typeof value.name !== "string" || value.name.length > 100 ||
      typeof value.createdAt !== "string" || !Number.isFinite(Date.parse(value.createdAt)) ||
      typeof value.actorUserId !== "string" || value.actorUserId.length > 20 || !isObject(value.files)) {
    throw new Error("Invalid or incompatible dashboard settings backup.");
  }
  const keys = Object.keys(value.files);
  if (keys.length !== DASHBOARD_CONFIG_BACKUP_FILES.length || keys.some((key) => !(DASHBOARD_CONFIG_BACKUP_FILES as readonly string[]).includes(key))) {
    throw new Error("Dashboard settings backup does not contain the complete supported store set.");
  }
  for (const file of DASHBOARD_CONFIG_BACKUP_FILES) {
    const entry = value.files[file];
    if (!isObject(entry) || typeof entry.present !== "boolean" ||
        (entry.present && !isObject(entry.value)) || (!entry.present && Object.hasOwn(entry, "value"))) {
      throw new Error(`Invalid dashboard settings backup entry: ${file}`);
    }
  }
  safeJson(value.files);
  if (Buffer.byteLength(JSON.stringify(value), "utf8") > MAX_BACKUP_BYTES) throw new Error("Full dashboard backup exceeds the 4 MiB limit.");
}

function purgePreviews() {
  const now = Date.now();
  for (const [token, preview] of previews) if (preview.expiresAt <= now) previews.delete(token);
}

export function previewDashboardSettingsRestore(guildId: string, actorId: string, target: unknown) {
  validateDashboardSettingsBackup(target, guildId);
  if (!/^\d{16,20}$/.test(actorId)) throw new Error("Authenticated user required.");
  purgePreviews();
  if (previews.size >= MAX_PREVIEWS) throw new Error("Too many pending previews. Retry later.");
  const recovery = captureDashboardSettingsBackup(guildId, "Pre-restore dashboard recovery", actorId);
  const token = crypto.randomUUID();
  previews.set(token, {
    guildId, actorId, targetDigest: digest(target.files), currentDigest: digest(recovery.files), recovery,
    expiresAt: Date.now() + PREVIEW_TTL_MS,
  });
  const changedFiles = DASHBOARD_CONFIG_BACKUP_FILES.filter((file) => digest(target.files[file]) !== digest(recovery.files[file]));
  return { token, expiresAt: new Date(Date.now() + PREVIEW_TTL_MS).toISOString(), recovery, changedFiles };
}

export function restoreDashboardSettings(guildId: string, actorId: string, target: unknown, token: string):
  { success: true; applied: string[] } | { success: false; reason: "preview-invalid" | "settings-changed" } {
  validateDashboardSettingsBackup(target, guildId);
  const pending = previews.get(token);
  previews.delete(token);
  if (!pending || pending.expiresAt <= Date.now() || pending.guildId !== guildId || pending.actorId !== actorId || pending.targetDigest !== digest(target.files)) {
    return { success: false, reason: "preview-invalid" as const };
  }
  return withSetupStoreLock(() => {
    const currentFiles = captureFiles(guildId);
    if (digest(currentFiles) !== pending.currentDigest) return { success: false, reason: "settings-changed" as const };
    const originalStores = new Map<string, JsonObject>();
    const nextStores = new Map<string, JsonObject>();
    for (const file of DASHBOARD_CONFIG_BACKUP_FILES) {
      const store = readStore(file);
      originalStores.set(file, store);
      const next = { ...store };
      const entry = target.files[file];
      if (entry.present) next[guildId] = entry.value!;
      else delete next[guildId];
      nextStores.set(file, next);
    }
    const applied: string[] = [];
    try {
      for (const file of DASHBOARD_CONFIG_BACKUP_FILES) {
        writeAtomic(file, nextStores.get(file)!);
        applied.push(file);
      }
    } catch (error) {
      let rollbackFailed = false;
      for (const file of applied.reverse()) {
        try { writeAtomic(file, originalStores.get(file)!); } catch { rollbackFailed = true; }
      }
      if (rollbackFailed) {
        const failure = new Error("Dashboard settings restore failed and rollback was incomplete. Preserve the downloaded recovery backup and contact the operator.");
        (failure as any).code = "DASHBOARD_RESTORE_PARTIAL";
        throw failure;
      }
      throw error;
    }
    appendAudit({ guildId, area: "backup-restore", action: "restore", actorUserId: actorId, count: applied.length });
    return { success: true, applied };
  });
}

type SavedStore = { version: 1; backups: Record<string, { id: string; guildId: string; createdAt: string; name: string; bytes: number; engineCount: number; featureCount: number; backup: unknown }> };
function readPrivateBackupStore(): SavedStore {
  const file = path.join(SETUP_DIR, PRIVATE_BACKUPS_FILE);
  try {
    const stat = fs.lstatSync(file);
    if (!stat.isFile() || stat.isSymbolicLink()) throw new Error("Unsafe private configuration backup store.");
    const parsed = JSON.parse(fs.readFileSync(file, "utf8"));
    if (!isObject(parsed) || parsed.version !== 1 || !isObject(parsed.backups)) throw new Error("Private configuration backup store is invalid; existing backups were not changed.");
    return parsed as SavedStore;
  } catch (error: any) {
    if (error?.code === "ENOENT") return { version: 1, backups: {} };
    throw error;
  }
}

export function savePrivateDashboardBackup(guildId: string, backup: unknown) {
  if (!isObject(backup) || backup.guildId !== guildId || typeof backup.kind !== "string") throw new Error("Invalid full dashboard backup.");
  const encoded = JSON.stringify(backup);
  if (Buffer.byteLength(encoded, "utf8") > MAX_BACKUP_BYTES) throw new Error("Full dashboard backup exceeds the 4 MiB limit.");
  return withSetupStoreLock(() => {
    const store = readPrivateBackupStore();
    const entries = Object.values(store.backups).filter((entry) => entry.guildId === guildId);
    if (entries.length >= MAX_SAVED_BACKUPS_PER_GUILD) throw new Error(`This server already has ${MAX_SAVED_BACKUPS_PER_GUILD} private backups.`);
    const bytes = Object.values(store.backups).reduce((sum, entry) => sum + Buffer.byteLength(JSON.stringify(entry.backup), "utf8"), 0);
    if (bytes + Buffer.byteLength(encoded, "utf8") > MAX_SAVED_BACKUPS_BYTES) throw new Error("Private dashboard backup storage is full (40 MiB). Download and remove an older copy.");
    const id = String((backup as any).id || "");
    if (!/^[a-zA-Z0-9_-]{8,120}$/.test(id)) throw new Error("Full backup has an invalid ID.");
    const name = String((backup as any).name || "Dashboard backup").slice(0, 100);
    const engineCount = Object.keys((backup as any).bot?.config || {}).length;
    const featureCount = Object.keys((backup as any).bot?.features || {}).length;
    store.backups[id] = { id, guildId, name, createdAt: new Date().toISOString(), bytes: Buffer.byteLength(encoded, "utf8"), engineCount, featureCount, backup };
    writeAtomic(PRIVATE_BACKUPS_FILE, store as unknown as JsonObject);
    return { id, guildId, name, createdAt: store.backups[id].createdAt, bytes: store.backups[id].bytes, engineCount, featureCount };
  });
}

export function listPrivateDashboardBackups(guildId: string) {
  return withSetupStoreLock(() => Object.values(readPrivateBackupStore().backups)
    .filter((entry) => entry.guildId === guildId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map(({ backup: _backup, ...meta }) => meta));
}

export function getPrivateDashboardBackup(guildId: string, id: string) {
  return withSetupStoreLock(() => {
    const entry = readPrivateBackupStore().backups[id];
    return entry?.guildId === guildId ? entry : null;
  });
}

export function deletePrivateDashboardBackup(guildId: string, id: string) {
  return withSetupStoreLock(() => {
    const store = readPrivateBackupStore();
    if (store.backups[id]?.guildId !== guildId) return false;
    delete store.backups[id];
    writeAtomic(PRIVATE_BACKUPS_FILE, store as unknown as JsonObject);
    return true;
  });
}
