"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");

function load(file, mocks = {}) {
  const source = fs.readFileSync(path.join(__dirname, "..", "src", ...file.split("/")), "utf8");
  const js = ts.transpileModule(source, {
    compilerOptions: { testModule: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const mod = { exports: {} };
  new Function("require", "module", "exports", js)(
    (name) => Object.prototype.hasOwnProperty.call(mocks, name) ? mocks[name] : require(name),
    mod, mod.exports
  );
  return mod.exports;
}

test("metrics route allows bounded large history while other operations remain capped", async () => {
  const proxy = load("lib/opsProxy.ts", {
    "@/lib/session": { DASHBOARD_SESSION_COOKIE: "session", readDashboardSessionValue: async () => ({ user: { id: "owner" } }) },
    "@/lib/dashboardOwner": { isDashboardControlOwner: () => true },
  });
  const handler = load("pages/api/ops/metrics.ts", { "@/lib/opsProxy": proxy }).default;
  const originalFetch = global.fetch;
  const originalToken = process.env.OPS_AGENT_TOKEN;
  process.env.OPS_AGENT_TOKEN = "x".repeat(32);
  let payload = JSON.stringify({ success: true, data: "x".repeat(2500000) });
  global.fetch = async () => new Response(payload, { status: 200 });
  const res = () => ({
    statusCode: 200, setHeader() {}, status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  });
  try {
    const result = res();
    await handler({ method: "GET", cookies: {}, query: { resolution: "raw", limit: "2000" } }, result);
    assert.equal(result.statusCode, 200);
    assert.equal(result.body.data.length, 2500000);
    assert.equal((await proxy.callAgent({ path: "/v1/overview" })).error, "Operations agent response exceeded the size limit.");

    payload = JSON.stringify({ success: true, data: "x".repeat(8 * 1024 * 1024) });
    const tooLarge = res();
    await handler({ method: "GET", cookies: {}, query: {} }, tooLarge);
    assert.equal(tooLarge.statusCode, 502);
    assert.equal(tooLarge.body.error, "Operations agent response exceeded the size limit.");
  } finally {
    global.fetch = originalFetch;
    if (originalToken === undefined) delete process.env.OPS_AGENT_TOKEN;
    else process.env.OPS_AGENT_TOKEN = originalToken;
  }
});

test("resource history requests a full day of five-minute averages and reports failures", async () => {
  const metrics = load("lib/opsMetrics.ts");
  const samples = [
    { ts: 1, metrics: { "host.cpu.usagePct": { avg: 0 }, "host.memory.usedPct": { avg: 45 }, "host.memory.swapUsedPct": { avg: null }, "host.disk.root.usedPct": { avg: 70 } } },
    { ts: 86400000, metrics: { "host.cpu.usagePct": { avg: 23 } } },
  ];
  assert.deepEqual(metrics.aggregateResourceSamples(samples).map((sample) => sample.host), [
    { cpu: { usagePct: 0 }, memory: { usedPct: 45, swapUsedPct: null }, disk: { root: { usedPct: 70 } } },
    { cpu: { usagePct: 23 }, memory: { usedPct: null, swapUsedPct: null }, disk: { root: { usedPct: null } } },
  ]);
  assert.deepEqual(metrics.aggregateResourceSamples([null, { ts: "bad" }]), []);

  const states = [];
  const effects = [];
  let index = 0;
  const originalFetch = global.fetch;
  let failing = false;
  const paths = [];
  global.fetch = async (url) => {
    paths.push(url);
    if (url.startsWith("/api/ops/metrics")) {
      if (failing) return { ok: false, status: 502, json: async () => { throw new Error("HTML"); } };
      return { ok: true, status: 200, json: async () => ({ success: true, data: samples }) };
    }
    return { ok: true, status: 200, json: async () => ({ success: true, data: {} }) };
  };
  try {
    const Component = load("app/dashboard/operations/OperationsClient.tsx", {
      "@/lib/opsMetrics": metrics,
      "react/jsx-runtime": { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) },
      react: {
        useState(value) { const i = index++; states[i] = value; return [value, (next) => { states[i] = next; }]; },
        useRef(value) { return { current: value }; },
        useCallback(fn) { return fn; },
        useMemo(fn) { return fn(); },
        useEffect(fn) { effects.push(fn); },
      },
    }).default;
    Component();
    effects[0]();
    await new Promise((resolve) => setImmediate(resolve));
    assert.ok(paths.includes("/api/ops/metrics?resolution=5m&rangeMs=86400000&limit=300"));
    assert.equal(states[4].length, 2);
    assert.equal(states[5], null);
    failing = true;
    effects[0]();
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(states[4].length, 2);
    assert.match(states[5], /unavailable/);
  } finally {
    global.fetch = originalFetch;
  }
});
