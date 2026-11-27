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
  const testModule = { exports: {} };
  new Function("require", "module", "exports", js)(
    (name) => Object.prototype.hasOwnProperty.call(mocks, name) ? mocks[name] : require(name),
    testModule, testModule.exports
  );
  return testModule.exports;
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
      "@/lib/guildDisplayOrder": load("lib/guildDisplayOrder.ts", {}),
    }).default;
    page();
    await new Promise((resolve) => setImmediate(resolve));
    assert.deepEqual(state[0].map((guild) => guild.id), ["member", "own"]);
  } finally {
    global.fetch = originalFetch;
  }
});

test("owner display order is a non-mutating sort of returned guilds only", () => {
  const { orderGuildsForDisplay } = load("lib/guildDisplayOrder.ts", {});
  const policy = { primaryGuildId: "saviors", gamesBaselineGuildId: "1336178965202599936" };
  const guilds = [
    { id: "saviors", name: "Saviors", botPresent: true },
    { id: "1567807367427661895", name: "Support", botPresent: true },
    { id: "1336178965202599936", name: "Alexandria", botPresent: true },
    { id: "other", name: "Other", botPresent: true },
    { id: "1519823415119446146", name: "Lotus", botPresent: false },
  ];
  assert.deepEqual(orderGuildsForDisplay(guilds, policy, true).map((g) => g.id), [
    "1336178965202599936", "1519823415119446146", "1567807367427661895", "saviors", "other",
  ]);
  assert.deepEqual(orderGuildsForDisplay(guilds, policy, false).map((g) => g.id), [
    "saviors", "1336178965202599936", "other", "1567807367427661895", "1519823415119446146",
  ]);
  assert.deepEqual(guilds.map((g) => g.id), [
    "saviors", "1567807367427661895", "1336178965202599936", "other", "1519823415119446146",
  ]);
  assert.deepEqual(orderGuildsForDisplay([guilds[0], guilds[4]], policy, true).map((g) => g.id), [
    "1519823415119446146", "saviors",
  ]);
});

test("guild selector applies owner ordering only for the matching authenticated owner session", async () => {
  const originalFetch = global.fetch;
  const originalWindow = global.window;
  const originalStorage = global.localStorage;
  const ids = ["1431799056211906582", "1336178965202599936", "1519823415119446146", "1567807367427661895"];
  try {
    for (const [session, expected] of [
      [{ loggedIn: true, isMasterOwner: true, user: { id: "owner" } }, [ids[1], ids[2], ids[3], ids[0]]],
      [{ loggedIn: true, isMasterOwner: false, user: { id: "owner" } }, [ids[0], ids[1], ids[2], ids[3]]],
      [{ loggedIn: true, isMasterOwner: true, user: { id: "different" } }, [ids[0], ids[1], ids[2], ids[3]]],
      [{ loggedIn: false, isMasterOwner: true, user: { id: "owner" } }, [ids[0], ids[1], ids[2], ids[3]]],
    ]) {
      const state = [];
      let stateIndex = 0;
      let firstRender = true;
      const storage = new Map([["activeGuildId", "saved"], ["activeGuildName", "Saved server"]]);
      global.localStorage = { getItem: (key) => storage.get(key), setItem: (key, value) => storage.set(key, value) };
      global.window = { location: { search: "" } };
      global.fetch = async (url) => ({
        ok: true,
        json: async () => url === "/api/guilds" ? { loggedIn: true, user: { id: "owner" }, guilds: [] }
          : url === "/api/guilds/installed" ? { guilds: ids.map((id, i) => ({ id, name: String(i) })) }
            : url === "/api/auth/session?brief=1" ? session : {},
      });
      const page = load("app/guilds/page.tsx", {
        "react/jsx-runtime": jsx,
        react: {
          useState(value) {
            const i = stateIndex++;
            if (firstRender) state[i] = value;
            return [state[i], (next) => { state[i] = next; }];
          },
          useMemo: (fn) => fn(),
          useEffect: (fn) => { if (firstRender) fn(); },
        },
        "@/lib/publicLinks": { buildPublicInviteUrl: () => "" },
        "@/lib/guildDisplayOrder": load("lib/guildDisplayOrder.ts", {}),
      }).default;
      page();
      await new Promise((resolve) => setImmediate(resolve));
      firstRender = false;
      stateIndex = 0;
      const tree = page();
      const shown = nodes(tree).filter((node) =>
        node.type === "div" && Array.isArray(node.props?.children) && node.props.children[0] === "Guild "
      ).map((node) => node.props.children[1]);
      assert.deepEqual(shown, expected);
      assert.equal(storage.get("activeGuildId"), "saved");
      assert.equal(storage.get("activeGuildName"), "Saved server");
    }
  } finally {
    global.fetch = originalFetch;
    global.window = originalWindow;
    global.localStorage = originalStorage;
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
