"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");

function load(file, mocks) {
  const filename = path.join(__dirname, "..", "src", ...file.split("/"));
  const js = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const module = { exports: {} };
  new Function("require", "module", "exports", js)(
    (name) => Object.prototype.hasOwnProperty.call(mocks, name) ? mocks[name] : require(name),
    module, module.exports
  );
  return module.exports;
}

const jsx = { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) };

function nodes(node) {
  if (!node || typeof node !== "object") return [];
  const children = node.props?.children;
  return [node, ...(Array.isArray(children) ? children.flatMap(nodes) : nodes(children))];
}

test("guild selector shows only guilds returned for the signed-in user", async () => {
  const state = [];
  let stateIndex = 0;
  const originalFetch = global.fetch;
  global.fetch = async (url) => ({
    ok: true,
    json: async () => url === "/api/guilds" ? { loggedIn: true, guilds: [{ id: "own", name: "Own" }] }
      : url === "/api/guilds/installed" ? { guilds: [{ id: "member", name: "Member server" }] } : {},
  });
  try {
    const page = load("app/guilds/page.tsx", {
      "react/jsx-runtime": jsx,
      react: {
        useState(value) { const i = stateIndex++; state[i] = value; return [value, (next) => { state[i] = next; }]; },
        useMemo: (fn) => fn(),
        useEffect: (fn) => fn(),
      },
      "@/lib/publicLinks": { buildPublicInviteUrl: () => "" },
    }).default;
    page();
    await new Promise((resolve) => setImmediate(resolve));
    assert.deepEqual(state[0].map((guild) => guild.id), ["member", "own"]);
  } finally {
    global.fetch = originalFetch;
  }
});

test("legacy guild API does not append unrelated fallback servers", async () => {
  const originalFetch = global.fetch;
  global.fetch = async () => ({ ok: true, status: 200 });
  try {
    const handler = load("pages/api/bot/guilds.ts", {
      "@/lib/botApi": {
        BOT_API: "http://bot", readActorUserId: async () => "actor",
        buildBotApiHeaders: async () => ({}), readJsonSafe: async () => ({ success: true, guilds: [] }),
      },
    }).default;
    const res = { status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; } };
    await handler({}, res);
    assert.equal(res.code, 200);
    assert.deepEqual(res.body.guilds, []);
  } finally {
    global.fetch = originalFetch;
  }
});

test("quick relay setup saves feed URLs and social handles in the correct fields", () => {
  for (const provider of ["rss", "podcast", "youtube"]) {
    let config = {
      active: false, pollIntervalMinutes: 15, sourceDefaults: { color: "#fff", mentionRoleId: "", includeSummary: true, postAsEmbed: true, footerText: "" },
      sources: [{ id: "one", provider, feedUrl: "", sourceRef: "", channelId: "", resourceType: provider === "youtube" ? "handle" : "feed" }],
      notes: "",
    };
    const client = load("app/dashboard/signal-relay/SignalRelayClient.tsx", {
      "react/jsx-runtime": jsx,
      react: { useMemo: (fn) => fn(), useState: (value) => [value, () => {}] },
      "@/components/possum/ConfigJsonEditor": { default: () => null },
      "@/components/possum/EngineInsights": { default: () => null },
      "@/components/possum/useGuildEngineEditor": {
        useGuildEngineEditor: () => ({
          guildId: "guild", config, setConfig: (fn) => { config = fn(config); }, channels: [], roles: [],
          loading: false, saving: false, save() {}, runAction() {},
        }),
      },
    }).default;
    const tree = client();
    const quickInput = nodes(tree).find((node) => node.type === "input" && node.props.placeholder);
    assert.ok(quickInput, provider);
    quickInput.props.onChange({ target: { value: "example" } });
    assert.equal(config.sources[0][provider === "youtube" ? "sourceRef" : "feedUrl"], "example", provider);
  }
});

test("Operations proxy accepts Unicode display names without placing them in HTTP headers", async () => {
  const originalFetch = global.fetch;
  const originalToken = process.env.OPS_AGENT_TOKEN;
  process.env.OPS_AGENT_TOKEN = "x".repeat(32);
  global.fetch = async (_url, options) => {
    const headers = new Headers(options.headers);
    assert.equal(headers.get("x-ops-actor"), "123456789012345678");
    return new Response(JSON.stringify({ success: true, data: {} }), { status: 200 });
  };
  try {
    const { callAgent } = load("lib/opsProxy.ts", {
      "@/lib/session": {},
      "@/lib/dashboardOwner": {},
    });
    const result = await callAgent({ path: "/v1/overview", actor: { userId: "123456789012345678", label: "🦝 Tester" } });
    assert.equal(result.ok, true);
  } finally {
    global.fetch = originalFetch;
    if (originalToken === undefined) delete process.env.OPS_AGENT_TOKEN; else process.env.OPS_AGENT_TOKEN = originalToken;
  }
});
