#!/usr/bin/env node
"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawn } = require("child_process");

const rootDir = path.resolve(__dirname, "..");
const nextBin = path.join(rootDir, "node_modules", "next", "dist", "bin", "next");
const buildDir = path.join(rootDir, ".next");
const stagingDir = path.join(rootDir, ".next.building");
const rollbackDir = path.join(rootDir, ".next.previous");
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
const memoryAttempts = vmMode ? [640] : ciMode ? [4096] : [448];

let activeChild = null;
let receivedSignal = "";

function log(message) {
  process.stdout.write(`[safe-next-build] ${message}\n`);
}

function signalExitCode(signal) {
  return signal === "SIGINT" ? 130 : signal === "SIGTERM" ? 143 : 1;
}

function signalChild(child, signal) {
  if (!child) return;
  try {
    if (process.platform !== "win32" && child.pid) {
      process.kill(-child.pid, signal);
    } else {
      child.kill(signal);
    }
  } catch {
    try {
      child.kill(signal);
    } catch {}
  }
}

function forwardSignal(signal) {
  if (receivedSignal) return;
  receivedSignal = signal;
  log(`Received ${signal}; stopping the active Next.js build.`);
  signalChild(activeChild, signal);
}

process.on("SIGINT", () => forwardSignal("SIGINT"));
process.on("SIGTERM", () => forwardSignal("SIGTERM"));

function removeDir(targetPath) {
  if (!fs.existsSync(targetPath)) return;
  fs.rmSync(targetPath, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
}

function seedBuildCache() {
  const source = path.join(buildDir, "cache");
  if (!fs.existsSync(source)) {
    log("No existing Next.js build cache found; this build will create one.");
    return;
  }
  fs.cpSync(source, path.join(stagingDir, "cache"), { recursive: true, force: true });
  log("Reusing the existing Next.js build cache.");
}

function snapshotBuildConfig() {
  return ["next-env.d.ts", "tsconfig.json"].map((name) => {
    const filePath = path.join(rootDir, name);
    return {
      filePath,
      content: fs.existsSync(filePath) ? fs.readFileSync(filePath) : null,
    };
  });
}

function restoreBuildConfig(snapshot) {
  for (const { filePath, content } of snapshot) {
    if (content === null) {
      if (fs.existsSync(filePath)) fs.rmSync(filePath);
    } else {
      fs.writeFileSync(filePath, content);
    }
  }
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

function runNextBuild(env) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [nextBin, "build", "--webpack"], {
      cwd: rootDir,
      stdio: "inherit",
      env,
      detached: process.platform !== "win32",
    });
    activeChild = child;

    child.once("error", (error) => {
      if (activeChild === child) activeChild = null;
      reject(error);
    });

    child.once("close", (code, signal) => {
      if (activeChild === child) activeChild = null;
      resolve({
        status: Number.isInteger(code) ? code : signalExitCode(signal),
        signal: signal || null,
      });
    });

    if (receivedSignal) signalChild(child, receivedSignal);
  });
}

function promoteStagedBuild() {
  removeDir(rollbackDir);
  const hadExistingBuild = moveDir(buildDir, rollbackDir);
  try {
    if (!moveDir(stagingDir, buildDir)) {
      throw new Error("Staged Next build is missing and cannot be promoted.");
    }
  } catch (error) {
    if (hadExistingBuild && !fs.existsSync(buildDir)) {
      moveDir(rollbackDir, buildDir);
      log("Restored previous .next build after promotion failed.");
    }
    throw error;
  }
}

async function main() {
  if (!fs.existsSync(nextBin)) {
    log("Next.js build binary is missing. Run install before building.");
    process.exitCode = 1;
    return;
  }

  if (hostMemoryMb > 0) {
    log(`Detected host memory: ${hostMemoryMb} MB.${autoVmMode ? " Enabling low-memory VM build mode automatically." : ""}`);
  }

  removeDir(stagingDir);
  seedBuildCache();
  const buildConfigSnapshot = snapshotBuildConfig();

  let buildSucceeded = false;
  let finalMemoryMb = memoryAttempts[memoryAttempts.length - 1];
  let lastStatus = 1;

  try {
    for (const memoryMb of memoryAttempts) {
      if (receivedSignal) break;
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
        POSSUM_NEXT_DIST_DIR: path.basename(stagingDir),
        NODE_OPTIONS: nodeOptions,
      };

      log(`Starting Next build with ${memoryMb} MB heap cap${vmMode ? " (vm mode)" : ""}.`);
      const result = await runNextBuild(env);
      restoreBuildConfig(buildConfigSnapshot);
      if (receivedSignal || result.signal) break;

      if (result.status === 0) {
        const buildIdPath = path.join(stagingDir, "BUILD_ID");
        if (!fs.existsSync(buildIdPath) || !fs.readFileSync(buildIdPath, "utf8").trim()) {
          throw new Error("Next build succeeded but the staged BUILD_ID is missing.");
        }
        buildSucceeded = true;
        break;
      }

      lastStatus = result.status || 1;
      removeDir(stagingDir);

      const moreAttemptsRemain = vmMode && memoryMb !== memoryAttempts[memoryAttempts.length - 1];
      if (moreAttemptsRemain) {
        log(`Build failed at ${memoryMb} MB. Retrying with a larger heap cap.`);
      }
    }
  } catch (error) {
    restoreBuildConfig(buildConfigSnapshot);
    lastStatus = 1;
    log(`Build runner failed: ${error?.stack || String(error)}`);
  }

  if (receivedSignal) {
    log(`Build cancelled by ${receivedSignal}; keeping the current production build.`);
    removeDir(stagingDir);
    process.exitCode = signalExitCode(receivedSignal);
    return;
  }

  if (!buildSucceeded) {
    log("Build failed.");
    removeDir(stagingDir);
    process.exitCode = lastStatus;
    return;
  }

  try {
    promoteStagedBuild();
  } catch (error) {
    removeDir(stagingDir);
    throw error;
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
}

main().catch((error) => {
  log(`Unexpected build runner failure: ${error?.stack || String(error)}`);
  process.exitCode = 1;
});
