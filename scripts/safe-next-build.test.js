"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawn } = require("node:child_process");
const { setTimeout: delay } = require("node:timers/promises");
const { test } = require("node:test");

test("successful build promotes staged output and keeps the previous build for rollback", async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "safe-next-build-"));
  const scriptsDir = path.join(root, "scripts");
  const nextBin = path.join(root, "node_modules", "next", "dist", "bin", "next");
  const buildDir = path.join(root, ".next");
  const runnerPath = path.join(scriptsDir, "safe-next-build.js");
  const nextEnvPath = path.join(root, "next-env.d.ts");
  const tsconfigPath = path.join(root, "tsconfig.json");

  fs.mkdirSync(scriptsDir, { recursive: true });
  fs.mkdirSync(path.dirname(nextBin), { recursive: true });
  fs.mkdirSync(buildDir, { recursive: true });
  fs.mkdirSync(path.join(buildDir, "cache", "webpack"), { recursive: true });
  fs.writeFileSync(path.join(buildDir, "production.marker"), "previous production build");
  fs.writeFileSync(path.join(buildDir, "cache", "webpack", "cache.marker"), "existing webpack cache");
  fs.writeFileSync(nextEnvPath, "original next env");
  fs.writeFileSync(tsconfigPath, "original tsconfig");
  fs.copyFileSync(path.join(__dirname, "safe-next-build.js"), runnerPath);
  fs.writeFileSync(nextBin, [
    '"use strict";',
    'const fs = require("node:fs");',
    'const path = require("node:path");',
    'const distDir = path.join(process.cwd(), process.env.POSSUM_NEXT_DIST_DIR || ".next");',
    'fs.mkdirSync(distDir, { recursive: true });',
    'const cacheMarker = path.join(distDir, "cache", "webpack", "cache.marker");',
    'if (fs.existsSync(cacheMarker)) fs.writeFileSync(path.join(distDir, "cache-reused.marker"), "reused");',
    'fs.writeFileSync(path.join(distDir, "BUILD_ID"), "new-build");',
    'fs.writeFileSync(path.join(process.cwd(), "next-env.d.ts"), "generated next env");',
    'fs.writeFileSync(path.join(process.cwd(), "tsconfig.json"), "generated tsconfig");',
    "",
  ].join("\n"));

  try {
    const result = await new Promise((resolve, reject) => {
      const runner = spawn(process.execPath, [runnerPath, "--vm"], { cwd: root, stdio: "ignore" });
      runner.once("error", reject);
      runner.once("exit", (code, signal) => resolve({ code, signal }));
      setTimeout(() => {
        if (runner.exitCode === null && runner.signalCode === null) runner.kill("SIGKILL");
      }, 10000).unref();
    });

    assert.deepEqual(result, { code: 0, signal: null });
    assert.equal(fs.readFileSync(path.join(buildDir, "BUILD_ID"), "utf8"), "new-build");
    assert.equal(fs.readFileSync(path.join(buildDir, "cache-reused.marker"), "utf8"), "reused");
    assert.equal(fs.readFileSync(path.join(buildDir, "cache", "webpack", "cache.marker"), "utf8"), "existing webpack cache");
    assert.equal(fs.readFileSync(path.join(root, ".next.previous", "production.marker"), "utf8"), "previous production build");
    assert.equal(fs.readFileSync(nextEnvPath, "utf8"), "original next env");
    assert.equal(fs.readFileSync(tsconfigPath, "utf8"), "original tsconfig");
    assert.equal(fs.existsSync(path.join(root, ".next.building")), false);
  } finally {
    fs.rmSync(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  }
});

test("SIGTERM stops the Next build process and keeps the previous production build active", {
  skip: process.platform === "win32" ? "Process signal handling is POSIX-specific" : false,
}, async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "safe-next-build-"));
  const scriptsDir = path.join(root, "scripts");
  const nextBin = path.join(root, "node_modules", "next", "dist", "bin", "next");
  const buildDir = path.join(root, ".next");
  const stagingDir = path.join(root, ".next.building");
  const startedFile = path.join(root, "build-started");
  const runnerPath = path.join(scriptsDir, "safe-next-build.js");
  const nextEnvPath = path.join(root, "next-env.d.ts");
  const tsconfigPath = path.join(root, "tsconfig.json");

  fs.mkdirSync(scriptsDir, { recursive: true });
  fs.mkdirSync(path.dirname(nextBin), { recursive: true });
  fs.mkdirSync(buildDir, { recursive: true });
  fs.writeFileSync(nextEnvPath, "original next env");
  fs.writeFileSync(tsconfigPath, "original tsconfig");
  fs.copyFileSync(path.join(__dirname, "safe-next-build.js"), runnerPath);
  fs.writeFileSync(path.join(buildDir, "production.marker"), "previous production build");
  fs.writeFileSync(nextBin, [
    '"use strict";',
    'const fs = require("node:fs");',
    'const path = require("node:path");',
    'const distDir = process.env.POSSUM_NEXT_DIST_DIR || ".next";',
    'fs.mkdirSync(path.join(process.cwd(), distDir), { recursive: true });',
    'fs.writeFileSync(path.join(process.cwd(), distDir, "partial.marker"), "partial build");',
    'fs.writeFileSync(path.join(process.cwd(), "next-env.d.ts"), "generated next env");',
    'fs.writeFileSync(path.join(process.cwd(), "tsconfig.json"), "generated tsconfig");',
    'fs.writeFileSync(process.env.SAFE_BUILD_STARTED_FILE, String(process.pid));',
    'setInterval(() => {}, 1000);',
    "",
  ].join("\n"));

  let runner;
  try {
    runner = spawn(process.execPath, [runnerPath, "--vm"], {
      cwd: root,
      env: { ...process.env, SAFE_BUILD_STARTED_FILE: startedFile },
      stdio: "ignore",
    });

    const exited = new Promise((resolve, reject) => {
      runner.once("error", reject);
      runner.once("exit", (code, signal) => resolve({ code, signal }));
    });

    let started = false;
    for (let attempt = 0; attempt < 100; attempt += 1) {
      if (fs.existsSync(startedFile)) {
        started = true;
        break;
      }
      if (runner.exitCode !== null) break;
      await delay(50);
    }
    assert.equal(started, true, "the fake Next build should start");
    assert.equal(fs.readFileSync(path.join(buildDir, "production.marker"), "utf8"), "previous production build");
    assert.equal(fs.existsSync(path.join(stagingDir, "partial.marker")), true);

    runner.kill("SIGTERM");
    const result = await Promise.race([
      exited,
      delay(5000).then(() => { throw new Error("build wrapper did not exit after SIGTERM"); }),
    ]);

    assert.equal(result.code, 143);
    assert.equal(fs.readFileSync(path.join(buildDir, "production.marker"), "utf8"), "previous production build");
    assert.equal(fs.existsSync(path.join(buildDir, "partial.marker")), false);
    assert.equal(fs.existsSync(stagingDir), false);
    assert.equal(fs.readFileSync(nextEnvPath, "utf8"), "original next env");
    assert.equal(fs.readFileSync(tsconfigPath, "utf8"), "original tsconfig");
    assert.equal(fs.existsSync(path.join(root, ".next.previous")), false);
  } finally {
    if (runner && runner.exitCode === null && runner.signalCode === null) {
      runner.kill("SIGKILL");
    }
    fs.rmSync(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  }
});
