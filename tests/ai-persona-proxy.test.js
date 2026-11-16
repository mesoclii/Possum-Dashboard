"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");

const ACTOR = "111111111111111111";
const OTHER = "222222222222222222";
const GUILD = "333333333333333333";

function createProxy(session) {
  const file = path.join(__dirname, "..", "src", "lib", "aiBillingProxy.ts");
  const code = ts.transpileModule(fs.readFileSync(file, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 }
  }).outputText;
  const calls = [];
  const mocks = {
    "next/server": { NextResponse: { json: (body, options) => ({ body, status: options?.status || 200 }) } },
    "@/lib/rateLimiter": { enforceDashboardRateLimit: async () => {}, isRateLimitError: () => false },
    "@/lib/session": {
      DASHBOARD_SESSION_COOKIE: "session",
      readDashboardSessionValue: async (cookie) => cookie === "valid-cookie" ? session : null
    },
    "@/lib/botApiServer": {
      SERVER_BOT_API: "http://bot",
      buildServerBotApiHeaders: (userId) => ({ "x-dashboard-user-id": userId }),
      fetchServerBotApi: async (url, options) => { calls.push({ url, options }); return { ok: true }; },
      readServerBotApiJson: async () => ({ success: true })
    }
  };
  const mod = { exports: {} };
  new Function("require", "module", "exports", code)((name) => mocks[name] || require(name), mod, mod.exports);
  return { proxy: mod.exports.proxyAiBilling, calls };
}

function request(cookie = "valid-cookie") {
  return {
    cookies: { get: () => ({ value: cookie }) },
    nextUrl: new URL(`https://dashboard.example/?guildId=${GUILD}&userId=${OTHER}`),
    json: async () => ({ guildId: GUILD, userId: OTHER, accessToken: "forged-token", slug: "test", prompt: "hello" })
  };
}

test("persona test forwards only the authenticated session actor and Discord token", async () => {
  const { proxy, calls } = createProxy({ user: { id: ACTOR }, accessToken: "session-token" });
  const result = await proxy(request(), "/api/ai-personas/test", "POST", ["slug", "prompt"]);
  assert.equal(result.status, 200);
  assert.equal(calls.length, 1);
  const { headers, body } = calls[0].options;
  assert.equal(headers["x-dashboard-user-id"], ACTOR);
  assert.equal(headers["x-persona-discord-token"], "session-token");
  assert.deepEqual(JSON.parse(body), { guildId: GUILD, userId: ACTOR, slug: "test", prompt: "hello" });
});

test("other routes never receive the Discord token, and missing session is rejected", async () => {
  const { proxy, calls } = createProxy({ user: { id: ACTOR }, accessToken: "session-token" });
  await proxy(request(), "/api/ai-personas/save", "POST", ["slug"]);
  await proxy(request(), "/api/ai-personas", "GET", []);
  assert.equal(calls.length, 2);
  for (const { options } of calls) assert.equal(options.headers["x-persona-discord-token"], undefined);
  assert.equal((await proxy(request("invalid-cookie"), "/api/ai-personas/test", "POST", ["slug", "prompt"])).status, 401);
  assert.equal(calls.length, 2);
});

test("a missing session token is not replaced by a caller-provided token", async () => {
  const { proxy, calls } = createProxy({ user: { id: ACTOR } });
  await proxy(request(), "/api/ai-personas/test", "POST", ["slug", "prompt"]);
  assert.equal(calls[0].options.headers["x-persona-discord-token"], undefined);
});
