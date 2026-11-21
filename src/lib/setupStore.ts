import fs from "fs";
import path from "path";
import crypto from "crypto";

const SETUP_DIR = path.join(process.cwd(), "data", "setup");
const AUDIT_FILE = path.join(SETUP_DIR, "dashboard-audit.ndjson");

function ensureDir() {
  fs.mkdirSync(SETUP_DIR, { recursive: true });
}

export function readStore(fileName: string): Record<string, any> {
  const fp = path.join(SETUP_DIR, fileName);
  try {
    if (!fs.lstatSync(fp).isFile()) throw new Error("Not a regular file");
  } catch (error: any) {
    if (error?.code === "ENOENT") return {};
    throw new Error(`Cannot read setup store: ${fileName}`);
  }
  try {
    const parsed = JSON.parse(fs.readFileSync(fp, "utf8"));
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("Invalid store");
    return parsed;
  } catch {
    throw new Error(`Cannot read setup store: ${fileName}`);
  }
}

export function writeStore(fileName: string, store: Record<string, any>) {
  ensureDir();
  const fp = path.join(SETUP_DIR, fileName);
  const tmp = path.join(SETUP_DIR, `.${fileName}.${crypto.randomBytes(16).toString("hex")}.tmp`);
  try {
    fs.writeFileSync(tmp, JSON.stringify(store, null, 2), { encoding: "utf8", flag: "wx", mode: 0o600 });
    fs.renameSync(tmp, fp);
  } catch (error) {
    try { fs.unlinkSync(tmp); } catch { /* Preserve the write error. */ }
    throw error;
  }
}

export function withSetupStoreLock<T>(callback: () => T): T {
  ensureDir();
  const lock = path.join(SETUP_DIR, ".setup-store.lock");
  try {
    fs.mkdirSync(lock);
  } catch (error: any) {
    if (error?.code === "EEXIST") throw new Error("Setup stores are locked; retry or investigate an interrupted writer.");
    throw error;
  }
  try {
    return callback();
  } finally {
    fs.rmdirSync(lock);
  }
}

export function updateStore<T>(fileName: string, update: (store: Record<string, any>) => T): T {
  return withSetupStoreLock(() => {
    const store = readStore(fileName);
    const result = update(store);
    writeStore(fileName, store);
    return result;
  });
}

export function deepMerge<T>(base: T, patch: any): T {
  if (patch === null || patch === undefined) return base;
  if (Array.isArray(base) || Array.isArray(patch)) return patch as T;
  if (typeof base !== "object" || typeof patch !== "object") return patch as T;

  const out: any = { ...(base as any) };
  for (const [k, v] of Object.entries(patch)) {
    const prev = out[k];
    if (
      v &&
      typeof v === "object" &&
      !Array.isArray(v) &&
      prev &&
      typeof prev === "object" &&
      !Array.isArray(prev)
    ) {
      out[k] = deepMerge(prev, v);
    } else {
      out[k] = v;
    }
  }
  return out as T;
}

export function appendAudit(entry: Record<string, any>) {
  ensureDir();
  const line = JSON.stringify({
    at: new Date().toISOString(),
    ...entry,
  });
  fs.appendFileSync(AUDIT_FILE, line + "\n", "utf8");
}
