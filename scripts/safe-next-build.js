#!/usr/bin/env node
"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");

const rootDir = path.resolve(__dirname, "..");
const nextBin = path.join(rootDir, "node_modules", "next", "dist", "bin", "next");
const buildDir = path.join(rootDir, ".next");
const rollbackDir = path.join(rootDir, ".next.previous");
const cacheHoldDir = path.join(rootDir, ".next.cache.hold");
const rollbackMetaPath = path.join(rootDir, ".next.rollback.json");
const args = new Set(process.argv.slice(2));

function detectHostMemoryMb() {
  try {
    const total = Number(os.totalmem() || 0);
    if (!Number.isFinite(total) || total <= 0) return 0;
    return Math.floor(total / (1024 * 1024));
  } catch {
    return 0;
  }
}

const hostMemoryMb = detectHostMemoryMb();
const autoVmMode = args.has("--auto") && hostMemoryMb > 0 && hostMemoryMb <= 1536;
const vmMode = args.has("--vm") || autoVmMode;
const ciMode = String(process.env.CI || "").trim().toLowerCase() === "true";
const memoryAttempts = vmMode ? [640, 768, 896] : ciMode ? [4096] : [448];

function log(message) {
  process.stdout.write(`[safe-next-build] ${message}\n`);
}

function removeDir(targetPath) {
  if (!fs.existsSync(targetPath)) return;
  fs.rmSync(targetPath, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
}

function moveDir(fromPath, toPath, options = {}) {
  if (!fs.existsSync(fromPath)) return false;
  const { tolerateBusy = false, label = "path move" } = options;
  try {
    removeDir(toPath);
    fs.renameSync(fromPath, toPath);
    return true;
  } catch (err) {
    const busyCode = err && typeof err === "object" ? String(err.code || "") : "";
    if (tolerateBusy && (busyCode === "EPERM" || busyCode === "EBUSY" || busyCode === "ENOTEMPTY")) {
      log(`Could not complete ${label}; continuing without that move (${busyCode}).`);
      return false;
    }
    throw err;
  }
}

function stashBuildCache(fromBuildDir) {
  const cacheDir = path.join(fromBuildDir, "cache");
  if (!fs.existsSync(cacheDir)) return false;
  return moveDir(cacheDir, cacheHoldDir, { tolerateBusy: true, label: "build-cache capture" });
}

function restoreBuildCache() {
  if (!fs.existsSync(cacheHoldDir)) return false;
  const targetCacheDir = path.join(buildDir, "cache");
  fs.mkdirSync(buildDir, { recursive: true });
  return moveDir(cacheHoldDir, targetCacheDir);
}

if (!fs.existsSync(nextBin)) {
  log("Next.js build binary is missing. Run install before building.");
  process.exit(1);
}

if (hostMemoryMb > 0) {
  log(`Detected host memory: ${hostMemoryMb} MB.${autoVmMode ? " Enabling low-memory VM build mode automatically." : ""}`);
}

const hadCachedBuildData = stashBuildCache(buildDir);
if (hadCachedBuildData) {
  log("Captured existing Next build cache for reuse.");
}

const hadExistingBuild = moveDir(buildDir, rollbackDir, { tolerateBusy: true, label: "rollback build capture" });
if (hadExistingBuild) {
  log(`Moved existing build to ${path.basename(rollbackDir)} for rollback.`);
}

let buildSucceeded = false;
let finalMemoryMb = memoryAttempts[memoryAttempts.length - 1];
let lastStatus = 1;

for (const memoryMb of memoryAttempts) {
  finalMemoryMb = memoryMb;
  const nodeOptions = [process.env.NODE_OPTIONS || "", `--max-old-space-size=${memoryMb}`, "--max-semi-space-size=16"]
    .join(" ")
    .trim();

  const env = {
    ...process.env,
    CI: process.env.CI || "1",
    NEXT_TELEMETRY_DISABLED: "1",
    POSSUM_LOW_MEMORY_BUILD: vmMode ? "1" : "0",
    POSSUM_HOST_MEMORY_MB: hostMemoryMb ? String(hostMemoryMb) : "",
    NODE_OPTIONS: nodeOptions,
  };

  log(`Starting Next build with ${memoryMb} MB heap cap${vmMode ? " (vm mode)" : ""}.`);
  if (restoreBuildCache()) {
    log("Restored Next build cache.");
  }
  const result = spawnSync(process.execPath, [nextBin, "build", "--webpack"], {
    cwd: rootDir,
    stdio: "inherit",
    env,
  });

  if (result.status === 0) {
    buildSucceeded = true;
    break;
  }

  lastStatus = result.status || 1;
  stashBuildCache(buildDir);
  removeDir(buildDir);

  const moreAttemptsRemain = vmMode && memoryMb !== memoryAttempts[memoryAttempts.length - 1];
  if (moreAttemptsRemain) {
    log(`Build failed at ${memoryMb} MB. Retrying with a larger heap cap.`);
  }
}

if (!buildSucceeded) {
  log("Build failed.");
  removeDir(buildDir);
  if (hadExistingBuild) {
    moveDir(rollbackDir, buildDir);
    log("Restored previous .next build.");
  }
  removeDir(cacheHoldDir);
  process.exit(lastStatus);
}

const meta = {
  builtAt: new Date().toISOString(),
  vmMode,
  autoVmMode,
  hostMemoryMb,
  memoryMb: finalMemoryMb,
  rollbackAvailable: fs.existsSync(rollbackDir),
};
fs.writeFileSync(rollbackMetaPath, JSON.stringify(meta, null, 2));
log("Build completed successfully.");
if (meta.rollbackAvailable) {
  log("Previous build kept at .next.previous for rollback.");
}
removeDir(cacheHoldDir);
