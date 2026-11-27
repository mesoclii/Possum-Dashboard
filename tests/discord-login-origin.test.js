"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");

function load(file, mocks) {
  const js = ts.transpileModule(fs.readFileSync(path.join(__dirname, "..", "src", ...file.split("/")), "utf8"), {
    compilerOptions: { testModule: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
  }).outputText;
  const testModule = { exports: {} };
  new Function("require", "module", "exports", js)((name) => Object.hasOwn(mocks, name) ? mocks[name] : require(name), testModule, testModule.exports);
  return testModule.exports;
}

test("Discord login redirects public host to canonical host before setting state cookies", async () => {
  const old = { ...process.env };
  process.env.DISCORD_REDIRECT_URI = "https://dashboard.example/api/auth/discord/callback";
  process.env.SESSION_SECRET = "test-secret";
  const session = load("lib/session.ts", { "@/lib/prisma": {} });
  const makeResponse = (location) => ({ location: String(location), headers: new Headers(), cookies: { values: [], set(...args) { this.values.push(args); } } });
  const route = load("app/api/auth/discord/login/route.ts", {
    "next/server": { NextResponse: { redirect: makeResponse, json: (body, options) => ({ body, ...options }) } },
    "@/lib/discordOAuth": { getDiscordOauthConfigurationIssue: () => null, buildDiscordOauthUrl: (state) => `https://discord.example/authorize?state=${state}` },
    "@/lib/dashboardAudit": { auditDashboardEvent: async () => {} },
    "@/lib/rateLimiter": { enforceDashboardRateLimit: async () => {}, isRateLimitError: () => false },
    "@/lib/session": session,
  });
  function request(url, host) { return { nextUrl: new URL(url), headers: new Headers({ host }) }; }
  try {
    const publicResponse = await route.GET(request("https://public.example/api/auth/discord/login?returnTo=%2Fgaming", "public.example"));
    const location = new URL(publicResponse.location);
    assert.equal(location.origin, "https://dashboard.example");
    assert.equal(location.pathname, "/api/auth/discord/login");
    assert.equal(location.searchParams.get("returnTo"), "/gaming");
    assert.equal(publicResponse.cookies.values.length, 0);

    const dashboardResponse = await route.GET(request(location.toString(), "dashboard.example"));
    assert.equal(new URL(dashboardResponse.location).host, "discord.example");
    assert.equal(dashboardResponse.cookies.values.length, 2);
    assert.equal(dashboardResponse.cookies.values[1][1], "/gaming");
    assert.equal(dashboardResponse.cookies.values[0][2].httpOnly, true);

    const malicious = await route.GET(request("https://public.example/api/auth/discord/login?returnTo=%2F%5Cevil.example", "public.example"));
    assert.equal(new URL(malicious.location).searchParams.get("returnTo"), "/guilds");
    assert.equal(session.sanitizeDashboardReturnTo("//evil.example"), "/guilds");
    assert.equal(session.sanitizeDashboardReturnTo("/\nevil"), "/guilds");
    assert.equal(session.sanitizeDashboardReturnTo("/gaming?tab=public"), "/gaming?tab=public");
  } finally { process.env = old; }
});

  test("Discord invite code grant starts on canonical host without breaking ordinary invites", async () => {
    const old = { ...process.env };
    process.env.DISCORD_REDIRECT_URI = "https://dashboard.example/api/auth/discord/callback";
    process.env.SESSION_SECRET = "test-secret";
    let codeGrant = true;
    const session = load("lib/session.ts", { "@/lib/prisma": {} });
    const makeResponse = (location) => ({ location: String(location), headers: new Headers(), cookies: { values: [], set(...args) { this.values.push(args); } } });
    const route = load("app/api/auth/discord/invite/route.ts", {
      "next/server": { NextResponse: { redirect: makeResponse, json: (body, options) => ({ body, ...options }) } },
      "@/lib/discordOAuth": {
        getDiscordOauthConfigurationIssue: () => null,
        buildDiscordInviteUrl: () => `https://discord.example/authorize?response_type=${codeGrant ? "code" : "none"}`,
      },
      "@/lib/session": session,
    });
    const request = { nextUrl: new URL("https://public.example/api/auth/discord/invite?guildId=123"), headers: new Headers({ host: "public.example" }) };
    try {
      const publicResponse = await route.GET(request);
      assert.equal(publicResponse.location, "https://dashboard.example/api/auth/discord/invite?guildId=123");
      assert.equal(publicResponse.cookies.values.length, 0);
      const dashboardResponse = await route.GET({ nextUrl: new URL(publicResponse.location), headers: new Headers({ host: "dashboard.example" }) });
      assert.equal(dashboardResponse.cookies.values.length, 2);
      codeGrant = false;
      assert.equal(new URL((await route.GET(request)).location).host, "discord.example");
    } finally { process.env = old; }
  });
