"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");

const keys = [
  "MASTER_OWNER_USER_ID", "CONTROL_OWNER_USER_ID", "OWNER_USER_ID", "OWNER_USER_IDS",
  "BOT_OWNER_USER_ID", "BOT_OWNER_ID", "SUPERUSER_USER_ID",
];
const previous = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
const owner = "111111111111111111";
const secondOwner = "222222222222222222";
const outsider = "333333333333333333";
const guildId = "444444444444444444";

function clearOwners() {
  for (const key of keys) delete process.env[key];
}

function load(file, mocks = {}) {
  const filename = path.join(__dirname, "..", "src", ...file.split("/"));
  const js = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const module = { exports: {} };
  new Function("require", "module", "exports", js)(
    (name) => Object.prototype.hasOwnProperty.call(mocks, name) ? mocks[name] : require(name),
    module, module.exports
  );
  return module.exports;
}

function response() {
  return {
    statusCode: 200,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
}

test("dashboard access configuration rejects unsigned requests before proxying", async () => {
  let calls = 0;
  const handler = load("pages/api/bot/dashboard-access-config.ts", {
    "@/lib/botApi": {
      BOT_API: "http://bot", readActorUserId: async () => "",
      buildBotApiHeaders: async () => { calls++; return {}; },
      readJsonSafe: async () => ({}),
    },
    "@/lib/dashboardAudit": { auditDashboardEvent() {} },
    "@/lib/rateLimiter": { enforceDashboardRateLimit: async () => {}, isRateLimitError: () => false },
  }).default;
  for (const method of ["GET", "POST", "PUT"]) {
    const res = response();
    await handler({ method, query: { guildId }, body: { guildId } }, res);
    assert.equal(res.statusCode, 401);
  }
  assert.equal(calls, 0);
});

test.after(() => {
  for (const [key, value] of Object.entries(previous)) {
    if (value === undefined) delete process.env[key]; else process.env[key] = value;
  }
});

test("owner identities are explicit, validated and fail closed", () => {
  clearOwners();
  let policy = load("lib/dashboardOwner.ts");
  assert.equal(policy.isDashboardControlOwner(owner), false);
  assert.equal(policy.isDashboardControlOwner(""), false);
  process.env.OWNER_USER_IDS = `${owner},bad, ${secondOwner},${owner}`;
  policy = load("lib/dashboardOwner.ts");
  assert.deepEqual(policy.CONTROL_OWNER_USER_IDS, [owner, secondOwner]);
  assert.equal(policy.isDashboardControlOwner(owner), true);
  assert.equal(policy.isDashboardControlOwner(secondOwner), true);
  assert.equal(policy.isDashboardControlOwner(outsider), false);
  const api = load("lib/botApiServer.ts");
  assert.equal(api.buildServerBotApiHeaders()["x-dashboard-user-id"], undefined);
  assert.equal(api.buildServerBotApiHeaders(outsider)["x-dashboard-user-id"], outsider);
});

test("every supported owner variable enables only its valid configured identities", () => {
  for (const key of keys) {
    clearOwners();
    process.env[key] = owner;
    const policy = load("lib/dashboardOwner.ts");
    assert.equal(policy.isDashboardControlOwner(owner), true, key);
    assert.equal(policy.isDashboardControlOwner(outsider), false, key);
  }
});

test("all configured owners may use Pokémon controls, outsiders may not", async () => {
  clearOwners();
  process.env.OWNER_USER_IDS = `${owner},${secondOwner}`;
  let actor = outsider;
  let calls = 0;
  const handler = load("pages/api/bot/pokemon-access.ts", {
    "@/lib/dashboardOwner": load("lib/dashboardOwner.ts"),
    "@/lib/botApi": {
      BOT_API: "http://bot", readActorUserId: async () => actor,
      buildBotApiHeaders: async () => ({}),
      fetchBotApi: async () => { calls++; return { status: 200 }; },
      readJsonSafe: async () => ({ success: true }),
    },
  }).default;
  let res = response();
  await handler({ method: "POST", body: {} }, res);
  assert.equal(res.statusCode, 403);
  for (actor of [owner, secondOwner]) {
    for (const method of ["GET", "POST"]) {
      res = response();
      await handler({ method, body: {} }, res);
      assert.equal(res.statusCode, 200);
    }
  }
  assert.equal(calls, 4);
});

test("premium overrides require a configured session owner", async () => {
  clearOwners();
  process.env.OWNER_USER_ID = owner;
  let actor = outsider;
  let writes = 0;
  const route = load("app/api/subscriptions/status/route.ts", {
    "next/server": { NextResponse: { json: (body, options) => ({ body, status: options?.status || 200 }) } },
    "@/lib/dashboardOwner": load("lib/dashboardOwner.ts"),
    "@/lib/session": { DASHBOARD_SESSION_COOKIE: "session", readDashboardSessionValue: async () => ({ user: { id: actor } }) },
    "@/lib/dashboardAudit": { auditDashboardEvent() {} },
    "@/lib/rateLimiter": { enforceDashboardRateLimit: async () => {}, isRateLimitError: () => false },
    "@/lib/subscription": { setGuildSubscriptionStatus: async () => { writes++; return { active: true, plan: "PRO", scope: "global" }; } },
    "@/lib/botApiServer": {},
  });
  const request = { cookies: { get: () => ({ value: "signed" }) }, json: async () => ({ guildId, scope: "global", active: true }) };
  assert.equal((await route.POST(request)).status, 403);
  assert.equal(writes, 0);
  actor = owner;
  assert.equal((await route.POST(request)).status, 200);
  assert.equal(writes, 1);
});

test("premium mutation rejects missing or non-owner actor even when called directly", async () => {
  clearOwners();
  process.env.OWNER_USER_ID = owner;
  let writes = 0;
  const subscription = load("lib/subscription.ts", {
    "@/lib/dashboardOwner": load("lib/dashboardOwner.ts"),
    "@/lib/guildDiscoveryCache": { writeGuildDiscoveryCache: async () => {} },
    "@/lib/prisma": { default: { guildSubscription: { upsert: async () => { writes++; return {}; } } } },
    "@/lib/botApiServer": {},
    "@/lib/premiumMode": { isPremiumEnforcementEnabled: () => false },
  });
  for (const actor of [undefined, outsider]) {
    await assert.rejects(subscription.setGuildSubscriptionStatus(guildId, { active: true }, actor), /configured owner/);
  }
  assert.equal(writes, 0);
});

test("Social Alerts and Search Anything are free with premium enforcement enabled", () => {
  const subscription = load("lib/subscription.ts", {
    "@/lib/dashboardOwner": {},
    "@/lib/guildDiscoveryCache": {},
    "@/lib/prisma": {},
    "@/lib/botApiServer": {},
    "@/lib/premiumMode": { isPremiumEnforcementEnabled: () => true },
  });
  assert.equal(subscription.featureRequiresPremium("signal-relay"), false);
  assert.equal(subscription.featureRequiresPremium("search-anything"), false);
  assert.equal(subscription.featureRequiresPremium("tts"), true);
});

test("Social navigation keeps alerts and podcast together outside Possum Pro", () => {
  const nav = load("lib/dashboard/navigation.ts", { "@/lib/premiumCatalog": { PREMIUM_FEATURES: [] } });
  const sections = nav.getDashboardNavSections(true, undefined, true);
  const social = sections.find((section) => section.label === "Social");
  const pro = sections.find((section) => section.label === "Possum Pro");
  for (const route of ["/dashboard/games", "/dashboard/podcast", "/dashboard/social-alerts", "/dashboard/signal-relay"]) {
    assert.ok(social.items.some((item) => item.href === route), route);
    assert.ok(!pro.items.some((item) => item.href === route), route);
  }
});

test("engine config errors do not disclose another actor's cached config", async () => {
  let actor = owner;
  let mode = "ok";
  const handler = load("pages/api/bot/engine-config.ts", {
    "@/lib/dashboardAudit": { auditDashboardEvent() {} },
    "@/lib/guildPolicy": { readGuildIdFromRequest: (req) => req.query.guildId },
    "@/lib/rateLimiter": { enforceDashboardRateLimit: async () => {}, isRateLimitError: () => false },
    "@/lib/premiumGuard": { requirePremiumAccess: async () => true },
    "@/lib/botApi": {
      BOT_API: "http://bot", readActorUserId: async () => actor,
      buildBotApiHeaders: async () => ({ actor }),
      fetchBotApi: async () => {
        if (mode === "throw") throw new Error("offline");
        return mode === "ok" ? { status: 200, ok: true } : { status: 503, ok: false };
      },
      readJsonSafe: async (upstream) => upstream.ok ? { success: true, config: { secret: "guild config" } } : { success: false },
    },
  }).default;
  const req = { method: "GET", query: { guildId, engine: "test" } };
  let res = response();
  await handler(req, res);
  assert.equal(res.statusCode, 200);
  actor = outsider;
  for (mode of ["error", "throw"]) {
    res = response();
    await handler(req, res);
    assert.equal(res.statusCode, mode === "error" ? 503 : 500);
    assert.equal(res.body.config, undefined);
  }
});

test("dashboard config checks every request instead of sharing cached authorization", async () => {
  let actor = owner;
  const handler = load("pages/api/bot/dashboard-config.ts", {
    "@/lib/dashboardAudit": { auditDashboardEvent() {} },
    "@/lib/guildPolicy": { readGuildIdFromRequest: (req) => req.query.guildId },
    "@/lib/rateLimiter": { enforceDashboardRateLimit: async () => {}, isRateLimitError: () => false },
    "@/lib/dashboard/featureKeys": { CANONICAL_FEATURE_KEYS: [], asBoolean: Boolean, withLegacyFeatureAliases: () => ({}) },
    "@/lib/serverCache": { deleteServerCachePrefix() {} },
    "@/lib/botApi": {
      BOT_API: "http://bot", buildBotApiHeaders: async () => ({ actor }),
      fetchBotApi: async (_url, init) => init.headers.actor === owner ? { status: 200, ok: true } : { status: 403, ok: false },
      readJsonSafe: async (upstream) => upstream.ok ? { success: true, config: {} } : { success: false },
    },
  }).default;
  const req = { method: "GET", query: { guildId } };
  let res = response();
  await handler(req, res);
  assert.equal(res.statusCode, 200);
  actor = outsider;
  res = response();
  await handler(req, res);
  assert.equal(res.statusCode, 403);
});

test("fresh runtime polls always reach upstream and never return stale data", async () => {
  let count = 0;
  const handler = load("pages/api/runtime/engine.ts", {
    "@/lib/dashboardAudit": { auditDashboardEvent() {} },
    "@/lib/guildPolicy": {},
    "@/lib/premiumGuard": { requirePremiumAccess: async () => true },
    "@/lib/rateLimiter": { enforceDashboardRateLimit: async () => {}, isRateLimitError: () => false },
    "@/lib/engineKeys": { normalizeEngineKey: (key) => key },
    "@/lib/botApi": {
      BOT_API: "http://bot", readActorUserId: async () => owner,
      buildBotApiHeaders: async () => ({}),
      fetchBotApi: async (_url, init) => {
        assert.equal(init.cache, "no-store");
        count++;
        return count < 3 ? { status: 200, body: { count } } : { status: 503, body: { success: false } };
      },
      readJsonSafe: async (upstream) => upstream.body,
    },
  }).default;
  const req = { method: "GET", query: { guildId, engine: "gamer", fresh: "1" } };
  for (const expected of [1, 2]) {
    const res = response();
    await handler(req, res);
    assert.equal(res.body.count, expected);
  }
  const res = response();
  await handler(req, res);
  assert.equal(res.statusCode, 503);
  assert.equal(res.body.count, undefined);
});
