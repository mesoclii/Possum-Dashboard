"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");

function load(relative, aliases = {}) {
  const source = fs.readFileSync(path.join(__dirname, "..", relative), "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const testModule = { exports: {} };
  new Function("require", "module", "exports", compiled)(
    (name) => aliases[name] || require(name), testModule, testModule.exports
  );
  return testModule.exports;
}

const requests = load("src/lib/auditRequests.ts");
const array = (value) => Array.isArray(value);
const signal = new AbortController().signal;
const response = (body, status = 200) => new Response(JSON.stringify(body), { status });

test("requests distinguish empty success from HTTP, application, network and malformed errors", async () => {
  const original = global.fetch;
  try {
    global.fetch = async () => response({ success: true, events: [] });
    assert.deepEqual(await requests.requestAuditData("/events", "events", array, signal), []);
    global.fetch = async () => response({ success: false, error: "Please retry shortly." }, 429);
    await assert.rejects(requests.requestAuditData("/events", "events", array, signal), /Please retry shortly/);
    global.fetch = async () => response({ success: false, error: "Unavailable" });
    await assert.rejects(requests.requestAuditData("/events", "events", array, signal), /Unavailable/);
    global.fetch = async () => new Response("broken", { status: 500 });
    await assert.rejects(requests.requestAuditData("/events", "events", array, signal), /HTTP 500/);
    global.fetch = async () => new Response("broken");
    await assert.rejects(requests.requestAuditData("/events", "events", array, signal), /Invalid response/);
    global.fetch = async () => response({ success: true, events: null });
    await assert.rejects(requests.requestAuditData("/events", "events", array, signal), /Invalid response/);
    global.fetch = async () => { throw new Error("Network offline"); };
    await assert.rejects(requests.requestAuditData("/events", "events", array, signal), /Network offline/);
  } finally {
    global.fetch = original;
  }
});

function renderAudit(config, events, logs) {
  const states = ["guild-1", config, events, logs, "dash-error", ""];
  const hooks = {
    useState: () => [states.shift(), () => {}],
    useEffect: () => {},
    useRef: () => ({ current: null }),
    useCallback: (fn) => fn,
  };
  const AuditTrail = load("src/app/dashboard/security/audit-trail/AuditTrailClient.tsx", {
    react: hooks,
    "next/link": { __esModule: true, default: ({ href, children }) => React.createElement("a", { href }, children) },
    "@/lib/dashboardContext": { buildDashboardHref: (href) => href },
    "@/lib/moderatorNavigation": { MODERATOR_AUDIT_HREF: "/dashboard/moderator?tab=audit" },
    "@/lib/auditRequests": requests,
  }).default;
  return renderToStaticMarkup(AuditTrail());
}

test("independent failures are visible without hiding successful data or claiming it is empty", () => {
  const html = renderAudit(
    { status: "error", error: "Config denied" },
    { status: "error", error: "Events unavailable" },
    { status: "success", data: ["working log"] }
  );
  assert.match(html, /Audit config could not be loaded: Config denied/);
  assert.match(html, /Events could not be loaded: Events unavailable/);
  assert.match(html, /working log/);
  assert.doesNotMatch(html, /No events yet/);
  assert.match(html, /Refresh Audit Data/);
});

test("loading and failed logs do not look like successful empty results", () => {
  const html = renderAudit(
    { status: "success", data: { active: true, retainDays: 30, exportChannelId: "" } },
    { status: "loading" },
    { status: "error", error: "Log access denied" }
  );
  assert.match(html, /Loading events/);
  assert.doesNotMatch(html, /No events yet/);
  assert.match(html, /Log feed could not be loaded: Log access denied/);
  assert.doesNotMatch(html, /No log lines/);
  const empty = renderAudit({ status: "loading" }, { status: "success", data: [] }, { status: "success", data: [] });
  assert.match(empty, /No events yet/);
  assert.match(empty, /No log lines/);
});

test("switching log kinds ignores an older response even if fetch does not abort", async () => {
  const savedFetch = global.fetch;
  const savedWindow = global.window;
  const savedStorage = global.localStorage;
  const pending = [];
  global.fetch = (url) => new Promise((resolve) => pending.push({ url, resolve }));
  global.window = { location: { search: "?guildId=guild-1" } };
  global.localStorage = { getItem: () => "", setItem: () => {} };
  const slots = [];
  let index = 0;
  let effects = [];
  const hooks = {
    useState(initial) {
      const slot = index++;
      if (!(slot in slots)) slots[slot] = typeof initial === "function" ? initial() : initial;
      return [slots[slot], (value) => { slots[slot] = typeof value === "function" ? value(slots[slot]) : value; }];
    },
    useRef(initial) {
      const slot = index++;
      if (!(slot in slots)) slots[slot] = { current: initial };
      return slots[slot];
    },
    useEffect(effect) { index++; effects.push(effect); },
    useCallback(fn) { index++; return fn; },
  };
  try {
    const AuditTrail = load("src/app/dashboard/security/audit-trail/AuditTrailClient.tsx", {
      react: hooks,
      "next/link": { __esModule: true, default: ({ href, children }) => React.createElement("a", { href }, children) },
      "@/lib/dashboardContext": { buildDashboardHref: (href) => href },
      "@/lib/moderatorNavigation": { MODERATOR_AUDIT_HREF: "/dashboard/moderator?tab=audit" },
      "@/lib/auditRequests": requests,
    }).default;
    const render = () => { index = 0; effects = []; return AuditTrail(); };
    const tree = render();
    effects.forEach((effect) => effect());
    function findSelect(node) {
      if (!node || typeof node !== "object") return null;
      if (node.type === "select") return node;
      for (const child of React.Children.toArray(node.props?.children)) {
        const found = findSelect(child);
        if (found) return found;
      }
      return null;
    }
    findSelect(tree).props.onChange({ target: { value: "bot-error" } });
    const oldLog = pending.find((item) => item.url.includes("kind=dash-error"));
    const newLog = pending.find((item) => item.url.includes("kind=bot-error"));
    newLog.resolve(response({ success: true, lines: ["new log"] }));
    await new Promise((resolve) => setImmediate(resolve));
    oldLog.resolve(response({ success: true, lines: ["old log"] }));
    await new Promise((resolve) => setImmediate(resolve));
    const html = renderToStaticMarkup(render());
    assert.match(html, /new log/);
    assert.doesNotMatch(html, /old log/);
  } finally {
    global.fetch = savedFetch;
    global.window = savedWindow;
    global.localStorage = savedStorage;
  }
});
