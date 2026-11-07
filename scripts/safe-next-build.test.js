"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawn } = require("node:child_process");
const { setTimeout: delay } = require("node:timers/promises");
const { test } = require("node:test");

test("SIGTERM stops the Next build process and restores the previous production build", async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "safe-next-build-"));
  const scriptsDir = path.join(root, "scripts");
  const nextBin = path.join(root, "node_modules", "next", "dist", "bin", "next");
  const buildDir = path.join(root, ".next");
  const startedFile = path.join(root, "build-started");
  const runnerPath = path.join(scriptsDir, "safe-next-build.js");

  fs.mkdirSync(scriptsDir, { recursive: true });
  fs.mkdirSync(path.dirname(nextBin), { recursive: true });
  fs.mkdirSync(buildDir, { recursive: true });
  fs.copyFileSync(path.join(__dirname, "safe-next-build.js"), runnerPath);
  fs.writeFileSync(path.join(buildDir, "production.marker"), "previous production build");
  fs.writeFileSync(nextBin, [
    '"use strict";',
    'const fs = require("node:fs");',
    'const path = require("node:path");',
    'fs.mkdirSync(path.join(process.cwd(), ".next"), { recursive: true });',
    'fs.writeFileSync(path.join(process.cwd(), ".next", "partial.marker"), "partial build");',
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

    runner.kill("SIGTERM");
    const result = await Promise.race([
      exited,
      delay(5000).then(() => { throw new Error("build wrapper did not exit after SIGTERM"); }),
    ]);

    assert.equal(result.code, 143);
    assert.equal(fs.readFileSync(path.join(buildDir, "production.marker"), "utf8"), "previous production build");
    assert.equal(fs.existsSync(path.join(buildDir, "partial.marker")), false);
    assert.equal(fs.existsSync(path.join(root, ".next.previous")), false);
  } finally {
    if (runner && runner.exitCode === null && runner.signalCode === null) {
      runner.kill("SIGKILL");
    }
    fs.rmSync(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  }
});
