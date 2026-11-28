"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");

function load(file, mocks) {
  const source = fs.readFileSync(path.join(__dirname, "..", "src", ...file.split("/")), "utf8");
  const js = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const mod = { exports: {} };
  new Function("require", "module", "exports", js)(
    (name) => Object.prototype.hasOwnProperty.call(mocks, name) ? mocks[name] : require(name),
    mod,
    mod.exports,
  );
  return mod.exports;
}

test("public status route keeps owner reports separate from live checks", async () => {
  const ownerReport = { overall: "online", updatedAt: "2026-03-11T00:30:41.358Z", services: [] };
  const liveHealth = { status: "unknown", freshness: "unavailable", checks: [] };
  const calls = [];
  const route = load("app/api/status/route.ts", {
    "next/server": { NextResponse: { json: (body, init) => ({ body, init }) } },
    "@/lib/dashboardOwner": { isDashboardControlOwner: () => false },
    "@/lib/session": { DASHBOARD_SESSION_COOKIE: "session", readDashboardSessionValue: async () => null },
    "@/lib/dashboardAudit": { auditDashboardEvent: async () => {} },
    "@/lib/publicStatusStore": { readPublicStatus: () => ownerReport, writePublicStatus: () => ownerReport },
    "@/lib/opsProxy": { callAgent: async (options) => { calls.push(options); return { ok: false, status: 503 }; } },
    "@/lib/publicLiveHealth": { buildPublicLiveHealthSnapshot: (sample) => sample === null ? liveHealth : { status: "online" } },
  });

  const response = await route.GET();
  assert.deepEqual(calls, [{ path: "/v1/overview", timeoutMs: 1_500 }]);
  assert.equal(response.body.success, true);
  assert.equal(response.body.status, ownerReport);
  assert.equal(response.body.liveHealth, liveHealth);
  assert.equal(response.init.headers["cache-control"], "no-store");
});
