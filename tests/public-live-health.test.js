"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");

function load(file) {
  const source = fs.readFileSync(path.join(__dirname, "..", "src", ...file.split("/")), "utf8");
  const js = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const mod = { exports: {} };
  new Function("require", "module", "exports", js)(require, mod, mod.exports);
  return mod.exports;
}

const { buildPublicLiveHealthSnapshot } = load("lib/publicLiveHealth.ts");

function healthySample(now) {
  const timestamp = new Date(now - 15_000).toISOString();
  return {
    agent: { lastTickAt: timestamp },
    http: {
      bot: { ok: true, checkedAt: now - 15_000, discordReady: true, databaseReady: true },
      dashboard: { ok: true, checkedAt: now - 15_000 },
      bridge: { ok: true, checkedAt: now - 15_000 },
    },
  };
}

test("live public health reports only fresh Ops Agent probes", () => {
  const now = 1_800_000_000_000;
  const result = buildPublicLiveHealthSnapshot(healthySample(now), now);
  assert.equal(result.status, "online");
  assert.equal(result.freshness, "fresh");
  assert.equal(result.checkedAt, new Date(now - 15_000).toISOString());
  assert.deepEqual(result.checks.map((check) => check.status), ["online", "online", "online", "online"]);
  assert.equal(JSON.stringify(result).includes("memoryBytes"), false);
});

test("a stale monitoring sample becomes unknown instead of staying online", () => {
  const now = 1_800_000_000_000;
  const stale = healthySample(now);
  stale.agent.lastTickAt = new Date(now - 120_000).toISOString();
  const result = buildPublicLiveHealthSnapshot(stale, now);
  assert.equal(result.status, "unknown");
  assert.equal(result.freshness, "stale");
  assert.ok(result.checks.every((check) => check.status === "unknown"));
});

test("failed probes and partial Bot readiness are reported as offline or degraded", () => {
  const now = 1_800_000_000_000;
  const unavailable = healthySample(now);
  unavailable.http.dashboard.ok = false;
  assert.equal(buildPublicLiveHealthSnapshot(unavailable, now).status, "offline");

  const degraded = healthySample(now);
  degraded.http.bot.databaseReady = false;
  const result = buildPublicLiveHealthSnapshot(degraded, now);
  assert.equal(result.status, "degraded");
  assert.equal(result.checks[0].status, "degraded");
});

test("missing Ops Agent data never produces an online status", () => {
  const result = buildPublicLiveHealthSnapshot(null, 1_800_000_000_000);
  assert.equal(result.status, "unknown");
  assert.equal(result.freshness, "unavailable");
  assert.ok(result.checks.every((check) => check.status === "unknown"));
});
