"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const root = path.resolve(__dirname, "..");
const buildDir = path.join(root, ".next");
const rollbackDir = path.join(root, ".next.previous");
const failedDir = path.join(root, `.next.failed.${Date.now()}`);
const ecosystem = path.join(root, "ecosystem.config.cjs");

function run(command, args, label) {
  process.stdout.write(`[possum-deploy] ${label}\n`);
  const result = spawnSync(command, args, {
    cwd: root,
    stdio: "inherit",
    env: { ...process.env, NEXT_TELEMETRY_DISABLED: "1" }
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`${label} failed with exit code ${result.status ?? "unknown"}`);
  }
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForDashboard(timeoutMs = 30000) {
  const deadline = Date.now() + timeoutMs;
  let lastStatus = "not checked";
  while (Date.now() < deadline) {
    try {
      const response = await fetch("http://127.0.0.1:3000/api/status", {
        signal: AbortSignal.timeout(3000),
        cache: "no-store"
      });
      lastStatus = `HTTP ${response.status}`;
      if (response.ok) return true;
    } catch (error) {
      lastStatus = String(error?.message || error);
    }
    await wait(1500);
  }
  process.stderr.write(`[possum-deploy] Dashboard did not become healthy: ${lastStatus}\n`);
  return false;
}

function restorePreviousBuild() {
  if (!fs.existsSync(rollbackDir)) {
    process.stderr.write("[possum-deploy] No .next.previous build exists; automatic rollback is unavailable.\n");
    return false;
  }
  if (fs.existsSync(buildDir)) fs.renameSync(buildDir, failedDir);
  fs.renameSync(rollbackDir, buildDir);
  process.stdout.write("[possum-deploy] Restored the previous .next build.\n");
  return true;
}

async function main() {
  if (!fs.existsSync(ecosystem)) throw new Error("ecosystem.config.cjs is missing.");
  if (!fs.existsSync(path.join(root, "node_modules", "next", "dist", "bin", "next"))) {
    throw new Error("Next.js is not installed. Run npm ci before deploying.");
  }

  run(process.platform === "win32" ? "npm.cmd" : "npm", ["run", "build"], "Building dashboard");
  const buildId = path.join(buildDir, "BUILD_ID");
  if (!fs.existsSync(buildId) || !fs.readFileSync(buildId, "utf8").trim()) {
    throw new Error("Build command returned success but .next/BUILD_ID is missing. PM2 was not touched.");
  }

  try {
    run("pm2", ["reload", ecosystem, "--only", "possum-dashboard", "--update-env"], "Reloading dashboard through its PM2 ecosystem config");
    if (await waitForDashboard()) {
      process.stdout.write("[possum-deploy] Dashboard build and health check succeeded.\\n");
      return;
    }
    throw new Error("New dashboard build failed its post-reload health check.");
  } catch (deployError) {
    if (!restorePreviousBuild()) throw deployError;
    try {
      run("pm2", ["reload", ecosystem, "--only", "possum-dashboard", "--update-env"], "Reloading previous dashboard build");
      if (await waitForDashboard()) {
        throw new Error(`Deployment rejected: ${deployError.message} Previous build restored and responding.`);
      }
      throw new Error("Previous build was restored but did not pass the health check.");
    } catch (rollbackError) {
      throw new Error(`Deployment failed: ${deployError.message} Rollback result: ${rollbackError.message}`);
    }
  }
}

main().catch((error) => {
  process.stderr.write(`[possum-deploy] ${error.message}\n`);
  process.exitCode = 1;
});
