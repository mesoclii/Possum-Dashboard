"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");

function loadTs(file, mocks, jsx = false) {
  const source = fs.readFileSync(path.join(__dirname, "..", file), "utf8");
  const js = ts.transpileModule(source, { compilerOptions: {
    testModule: ts.ModuleKind.CommonJS, jsx: jsx ? ts.JsxEmit.ReactJSX : undefined,
  } }).outputText;
  const mod = { exports: {} };
  new Function("require", "module", "exports", js)((name) => {
    if (Object.hasOwn(mocks, name)) return mocks[name];
    return require(name);
  }, mod, mod.exports);
  return mod.exports;
}

test("backup proxy forwards downloads and file checks only with a session and propagates denials", async () => {
  const forwarded = [];
  const forwardedHeaders = [];
  const audits = [];
  let allowed = true;
  const oldRedirect = process.env.DISCORD_REDIRECT_URI;
  process.env.DISCORD_REDIRECT_URI = "https://dashboard.example.test/callback";
  const mocks = {
    "@/lib/botApi": {
      BOT_API: "http://127.0.0.1:3001",
      buildBotApiHeaders: async (req) => {
        if (!req.session) throw new Error("session required");
        return { "x-dashboard-user-id": req.session };
      },
      fetchBotApi: async (_url, init) => {
        forwarded.push(JSON.parse(init.body));
        forwardedHeaders.push(init.headers);
        return { ok: allowed, status: allowed ? 200 : 403 };
      },
      readJsonSafe: async () => allowed ? { success: true, backup: { id: "snapshot", guildId: "123" } } : { success: false, error: "Insufficient permissions" },
    },
    "@/lib/dashboardAudit": { auditDashboardEvent: async (event) => audits.push(event) },
    "@/lib/rateLimiter": { enforceDashboardRateLimit: async () => {}, isRateLimitError: () => false },
    "@/lib/session": {
      DASHBOARD_SESSION_COOKIE: "session",
      readDashboardSessionValue: async (value) => value === "valid" ? { user: { id: "actor" }, accessToken: "oauth-secret" } : null,
    },
  };
  const handler = loadTs("src/pages/api/bot/engine-config-backups.ts", mocks).default;
  const response = () => ({
    code: 200, headers: {}, setHeader(name, value) { this.headers[name] = value; },
    status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; },
  });
  let res = response();
  await handler({ method: "POST", headers: {}, body: { guildId: "123", action: "download" } }, res);
  assert.equal(forwarded.length, 0);
  res = response();
  await handler({ method: "POST", headers: {}, session: "actor", cookies: { session: "valid" }, body: { guildId: "123", action: "download" } }, res);
  assert.equal(res.code, 200);
  assert.equal(res.headers["Cache-Control"], "private, no-store");
  assert.equal(forwarded[0].action, "download");
  const snapshot = { guildId: "other", config: { secret: "not-in-audit" } };
  allowed = false;
  res = response();
  await handler({ method: "POST", headers: {}, session: "actor", cookies: { session: "valid" }, body: { guildId: "123", action: "validate", snapshot } }, res);
  assert.equal(res.code, 403);
  assert.deepEqual(forwarded[1].snapshot, snapshot);
  assert.equal(JSON.stringify(audits).includes("not-in-audit"), false);
  allowed = true;
  const featureRequest = {
    method: "POST", session: "actor", cookies: { session: "valid" },
    headers: { origin: "https://dashboard.example.test", "content-type": "application/json" },
    body: { guildId: "123", action: "features-preview", snapshot },
  };
  res = response();
  await handler({ ...featureRequest, headers: { ...featureRequest.headers, origin: "https://other.example.test" } }, res);
  assert.equal(res.code, 403);
  assert.equal(forwarded.length, 2);
  res = response();
  await handler({ ...featureRequest, cookies: {} }, res);
  assert.equal(res.code, 401);
  assert.equal(forwarded.length, 2);
  res = response();
  await handler(featureRequest, res);
  assert.equal(res.code, 200);
  assert.equal(forwardedHeaders[2]["x-restore-discord-token"], "oauth-secret");
  assert.equal(JSON.stringify(audits).includes("oauth-secret"), false);
  if (oldRedirect === undefined) delete process.env.DISCORD_REDIRECT_URI;
  else process.env.DISCORD_REDIRECT_URI = oldRedirect;
});

test.skip("legacy component mock expects the retired engine-only backup UI", async () => {
  const state = [];
  let cursor = 0;
  const react = {
    useState(initial) {
      const index = cursor++;
      if (!(index in state)) state[index] = typeof initial === "function" ? initial() : initial;
      return [state[index], (value) => { state[index] = value; }];
    },
    useCallback(fn) { return fn; },
    useEffect() {},
  };
  const jsx = { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) };
  const component = loadTs("src/app/dashboard/system-health/backups/BackupsClient.tsx", {
    react, "react/jsx-runtime": jsx,
  }, true).default;
  const original = { window: global.window, document: global.document, localStorage: global.localStorage, fetch: global.fetch,
    create: URL.createObjectURL, revoke: URL.revokeObjectURL };
  const requests = [];
  let downloaded;
  const snapshot = { id: "backup-id", guildId: "123456789012345678", config: {}, features: {} };
  try {
    global.window = { location: { search: "?guildId=123456789012345678" }, setTimeout() {}, confirm: () => true };
    global.localStorage = { getItem: () => "", setItem() {} };
    global.document = { createElement: () => ({ click() {} }) };
    URL.createObjectURL = (blob) => { downloaded = blob; return "blob:test"; };
    URL.revokeObjectURL = () => {};
    global.fetch = async (_url, init) => {
      const body = JSON.parse(init.body);
      requests.push(body);
      return { ok: true, json: async () => {
        if (body.action === "download") return { success: true, backup: snapshot };
        if (body.action === "features-preview") return {
          success: true, token: "preview", changedFeatures: ["musicEnabled"],
          recovery: { kind: "guild-feature-settings", version: 1, guildId: snapshot.guildId, features: { musicEnabled: false } },
        };
        if (body.action === "features-restore") return { success: true, warning: "Only feature toggles were restored." };
        return { success: true, backup: { id: snapshot.id }, restoreAvailable: false,
          semantic: { coverage: "incomplete", featureBooleanTypesChecked: true, engines: [], issues: [] },
          ...(body.action === "compare" ? {
            changedEngines: ["music"], changedFeatures: ["musicEnabled"],
            changedEngineFields: [{ engine: "music", fields: ["enabled", "Other settings"] }],
          } : {}) };
      } };
    };
    const render = () => { cursor = 0; return component(); };
    function find(node, predicate) {
      if (!node || typeof node !== "object") return null;
      if (predicate(node)) return node;
      for (const child of [node.props?.children].flat(Infinity)) {
        const found = find(child, predicate);
        if (found) return found;
      }
      return null;
    }
    let tree = render();
    find(tree, (n) => n.type === "button" && n.props.children === "Backup — Download JSON").props.onClick();
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(requests[0].action, "download");
    assert.deepEqual(JSON.parse(await downloaded.text()), snapshot);
    tree = render();
    find(tree, (n) => n.type === "input" && n.props.type === "file").props.onChange({
      target: { files: [{ size: 100, text: async () => JSON.stringify(snapshot) }] },
    });
    tree = render();
    find(tree, (n) => n.type === "button" && n.props.children === "Check Selected File").props.onClick();
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(requests[1].action, "validate");
    assert.deepEqual(requests[1].snapshot, snapshot);
    tree = render();
    find(tree, (n) => n.type === "button" && n.props.children === "Compare With Current Settings").props.onClick();
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(requests[2].action, "compare");
    tree = render();
    assert.ok(find(tree, (n) => n.type === "div" && n.props.children?.[0] === "music" && n.props.children?.[2] === "enabled, Other settings"));
    assert.equal(find(tree, (n) => n.type === "button" && n.props.children === "Restore unavailable").props.disabled, true);
    find(tree, (n) => n.type === "button" && n.props.children === "Preview Feature Toggles Only").props.onClick();
    await new Promise((resolve) => setImmediate(resolve));
    tree = render();
    assert.equal(find(tree, (n) => n.type === "button" && n.props.children === "Feature Restore Unavailable").props.disabled, true);
    find(tree, (n) => n.type === "button" && n.props.children === "Download Feature Recovery File").props.onClick();
    assert.equal(JSON.parse(await downloaded.text()).kind, "guild-feature-settings");
    tree = render();
    assert.equal(find(tree, (n) => n.type === "button" && n.props.children === "Feature Restore Unavailable").props.disabled, true);
    find(tree, (n) => n.type === "input" && n.props.type === "file").props.onChange({
      target: { files: [{ size: 512 * 1024 + 1 }] },
    });
    tree = render();
    find(tree, (n) => n.type === "button" && n.props.children === "Check Selected File").props.onClick();
    assert.equal(requests.length, 4);
  } finally {
    global.window = original.window; global.localStorage = original.localStorage; global.fetch = original.fetch;
    global.document = original.document;
    URL.createObjectURL = original.create; URL.revokeObjectURL = original.revoke;
  }
});

test("backup UI uses the complete dashboard settings endpoint and requires restore preview", () => {
  const source = fs.readFileSync(path.join(__dirname, "..", "src", "app", "dashboard", "system-health", "backups", "BackupsClient.tsx"), "utf8");
  assert.match(source, /api\/system\/config-backup/);
  assert.match(source, /possum-dashboard-full-configuration/);
  assert.match(source, /Preview Full Restore/);
  assert.match(source, /Download Current Recovery Backup/);
  assert.match(source, /recoveryDownloaded: true/);
  assert.match(source, /changedDashboardFiles/);
  assert.match(source, /changedDatabaseSettings/);
});
