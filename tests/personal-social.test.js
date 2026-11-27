"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");
const Database = require("better-sqlite3");

function load(file, mocks) {
  const filename = path.join(__dirname, "..", "src", ...file.split("/"));
  const js = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: { testModule: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const testModule = { exports: {} };
  new Function("require", "module", "exports", js)((name) => Object.hasOwn(mocks, name) ? mocks[name] : require(name), testModule, testModule.exports);
  return testModule.exports;
}

function fixture() {
  const db = new Database(":memory:");
  db.exec(`
    CREATE TABLE PersonalSocialAccount (userId TEXT, provider TEXT, providerId TEXT, label TEXT, url TEXT, PRIMARY KEY(userId, provider));
    CREATE TABLE PersonalSocialRevision (userId TEXT, provider TEXT, revision TEXT NOT NULL, PRIMARY KEY(userId, provider));
    CREATE TABLE PersonalSocialVisibility (userId TEXT, provider TEXT, guildId TEXT, PRIMARY KEY(userId, provider, guildId));
    CREATE TABLE PersonalSocialOAuthState (stateHash TEXT PRIMARY KEY, sessionHash TEXT, userId TEXT, expiresAt INTEGER);
    CREATE TABLE PersonalSocialOAuthAttempt (stateHash TEXT PRIMARY KEY, sessionHash TEXT, userId TEXT, provider TEXT, expiresAt INTEGER, claimed INTEGER NOT NULL DEFAULT 0);
    CREATE TABLE DashboardSession (discordId TEXT, accessToken TEXT, expiresAt INTEGER);
  `);
  function sql(parts, values) {
    return [parts.join("?"), values.map((value) => value instanceof Date ? value.getTime() : value)];
  }
  const prisma = {
    async $executeRaw(parts, ...values) { const [query, args] = sql(parts, values); return db.prepare(query).run(...args).changes; },
    async $queryRaw(parts, ...values) { const [query, args] = sql(parts, values); return db.prepare(query).all(...args); },
    async $transaction(fn) { return fn(prisma); },
    dashboardSession: {
      async findMany({ where }) {
        return db.prepare("SELECT discordId, accessToken FROM DashboardSession WHERE expiresAt > ? ORDER BY expiresAt DESC").all(where.expiresAt.gt.getTime())
          .filter((session) => where.discordId.in.includes(session.discordId));
      },
    },
  };
  const lib = load("lib/personalSocial.ts", { "@/lib/prisma": prisma });
  return { db, prisma, lib };
}

test("OAuth state is session-bound, expires, and is consumed only once", async () => {
  const { db, lib } = fixture();
  const env = { ...process.env };
  process.env.DISCORD_REDIRECT_URI = "https://dashboard.example/api/auth/discord/callback";
  process.env.SOCIAL_TWITCH_CLIENT_ID = "client";
  process.env.SOCIAL_TWITCH_CLIENT_SECRET = "secret";
  try {
    const { state, url } = await lib.beginSocial("twitch", "owner", "session");
    assert.equal(new URL(url).searchParams.get("redirect_uri"), "https://dashboard.example/api/personal-social/twitch/callback");
    assert.equal(await lib.consumeState("youtube", state, state, "owner", "session"), false);
    assert.equal(await lib.consumeState("twitch", state, state, "other", "session"), false);
    assert.equal(await lib.consumeState("twitch", state, state, "owner", "different"), false);
    assert.equal(await lib.consumeState("twitch", state, "wrong", "owner", "session"), false);
    assert.equal(await lib.consumeState("twitch", state, state, "owner", "session"), true);
    assert.equal(await lib.consumeState("twitch", state, state, "owner", "session"), false);
    const expired = await lib.beginSocial("twitch", "owner", "session");
    db.prepare("UPDATE PersonalSocialOAuthAttempt SET expiresAt = 1").run();
    assert.equal(await lib.consumeState("twitch", expired.state, expired.state, "owner", "session"), false);
    assert.equal(lib.sameOrigin(new Request("https://dashboard.example", { headers: { origin: "https://evil.example" } })), false);
    assert.equal(lib.sameOrigin(new Request("https://dashboard.example", { headers: { origin: "https://dashboard.example" } })), true);
  } finally { process.env = env; db.close(); }
});

test("new identities start private and replacement removes old server grants", async () => {
  const { db, lib } = fixture();
  try {
    const account = { id: "1", label: "first", url: "https://www.twitch.tv/first" };
    await lib.saveSocial("twitch", "owner", account);
    assert.equal(db.prepare("SELECT count(*) n FROM PersonalSocialVisibility").get().n, 0);
    db.prepare("INSERT INTO PersonalSocialVisibility VALUES ('owner', 'twitch', '123')").run();
    await lib.saveSocial("twitch", "owner", { ...account, label: "renamed" });
    assert.equal(db.prepare("SELECT count(*) n FROM PersonalSocialVisibility").get().n, 1);
    await lib.saveSocial("twitch", "owner", { id: "2", label: "second", url: "https://www.twitch.tv/second" });
    assert.equal(db.prepare("SELECT count(*) n FROM PersonalSocialVisibility").get().n, 0);
  } finally { db.close(); }
});

test("directory requires viewer and owner current membership and fails closed", async () => {
  const { db, lib } = fixture();
  const fetchBefore = global.fetch;
  try {
    await lib.saveSocial("twitch", "owner", { id: "1", label: "one", url: "https://www.twitch.tv/one" });
    db.prepare("INSERT INTO PersonalSocialVisibility VALUES ('owner', 'twitch', '123')").run();
    db.prepare("INSERT INTO DashboardSession VALUES (?, ?, ?)").run("owner", "owner-token", Date.now() + 60000);
    let ownerMember = true;
    global.fetch = async (_url, options) => {
      const token = options.headers.Authorization;
      if (token === "Bearer bad") return { ok: false };
      return { ok: true, json: async () => token === "Bearer viewer" || ownerMember ? [{ id: "123" }] : [] };
    };
    assert.equal((await lib.visibleDirectory("123", "viewer")).accounts.length, 1);
    const revision = db.prepare("SELECT revision FROM PersonalSocialRevision WHERE userId = 'owner'").get().revision;
    db.prepare("DELETE FROM PersonalSocialRevision WHERE userId = 'owner'").run();
    assert.equal((await lib.visibleDirectory("123", "viewer")).accounts.length, 0);
    db.prepare("INSERT INTO PersonalSocialRevision VALUES ('owner', 'twitch', ?)").run(revision);
    ownerMember = false;
    assert.equal((await lib.visibleDirectory("123", "viewer")).accounts.length, 0);
    await assert.rejects(() => lib.visibleDirectory("123", "bad"));
    db.prepare("UPDATE DashboardSession SET expiresAt = 1").run();
    assert.equal((await lib.visibleDirectory("123", "viewer")).accounts.length, 0);
  } finally { global.fetch = fetchBefore; db.close(); }
});

test("Twitch exchange validates provider identity and never stores token", async () => {
  const { db, lib } = fixture();
  const fetchBefore = global.fetch;
  const env = { ...process.env };
  process.env.DISCORD_REDIRECT_URI = "https://dashboard.example/api/auth/discord/callback";
  process.env.SOCIAL_TWITCH_CLIENT_ID = "client";
  process.env.SOCIAL_TWITCH_CLIENT_SECRET = "secret";
  const calls = [];
  global.fetch = async (url) => {
    calls.push(url);
    if (url.endsWith("/token")) return { ok: true, json: async () => ({ access_token: "do-not-store" }) };
    if (url.endsWith("/users")) return { ok: true, json: async () => ({ data: [{ id: "42", login: "real_user" }] }) };
    return { ok: true };
  };
  try {
    assert.deepEqual(await lib.exchangeTwitch("code"), { id: "42", label: "real_user", url: "https://www.twitch.tv/real_user" });
    assert.equal(calls.at(-1), "https://id.twitch.tv/oauth2/revoke");
    assert.equal(db.prepare("SELECT count(*) n FROM PersonalSocialAccount").get().n, 0);
  } finally { global.fetch = fetchBefore; process.env = env; db.close(); }
});

test("YouTube links only a single authenticated channel and revokes temporary authorization", async () => {
  const { db, lib } = fixture();
  const fetchBefore = global.fetch;
  const env = { ...process.env };
  process.env.DISCORD_REDIRECT_URI = "https://dashboard.example/api/auth/discord/callback";
  process.env.SOCIAL_YOUTUBE_CLIENT_ID = "client";
  process.env.SOCIAL_YOUTUBE_CLIENT_SECRET = "secret";
  const calls = [];
  let channels = [{ id: `UC${"a".repeat(22)}`, snippet: { title: "Channel" } }];
  global.fetch = async (url) => {
    calls.push(url);
    if (url.endsWith("/token")) return { ok: true, json: async () => ({ access_token: "do-not-store" }) };
    if (url.includes("/channels?")) return { ok: true, json: async () => ({ items: channels }) };
    return { ok: true };
  };
  try {
    const start = await lib.beginSocial("youtube", "owner", "session");
    assert.equal(new URL(start.url).searchParams.get("scope"), "https://www.googleapis.com/auth/youtube.readonly");
    assert.equal(new URL(start.url).searchParams.get("code_challenge_method"), "S256");
    assert.equal((await lib.exchangeYouTube("code", start.verifier)).label, "Channel");
    assert.equal(calls.at(-1), "https://oauth2.googleapis.com/revoke");
    channels = [channels[0], channels[0]];
    await assert.rejects(() => lib.exchangeYouTube("code", start.verifier));
    assert.equal(calls.at(-1), "https://oauth2.googleapis.com/revoke");
    assert.equal(db.prepare("SELECT count(*) n FROM PersonalSocialAccount").get().n, 0);
  } finally { global.fetch = fetchBefore; process.env = env; db.close(); }
});

test("OAuth callback links only the initiating Discord session and rejects replay", async () => {
  const { db, lib } = fixture();
  const fetchBefore = global.fetch;
  const env = { ...process.env };
  process.env.DISCORD_REDIRECT_URI = "https://dashboard.example/api/auth/discord/callback";
  process.env.SOCIAL_TWITCH_CLIENT_ID = "client";
  process.env.SOCIAL_TWITCH_CLIENT_SECRET = "secret";
  global.fetch = async (url) => {
    if (url.endsWith("/token")) return { ok: true, json: async () => ({ access_token: "temporary" }) };
    if (url.endsWith("/users")) return { ok: true, json: async () => ({ data: [{ id: "42", login: "real_user" }] }) };
    return { ok: true };
  };
  const response = (body, status) => ({
    body, status, headers: new Headers(), cookies: { values: new Map(), set(name, value) { this.values.set(name, value); } },
  });
  const routes = load("lib/personalSocialRoutes.ts", {
    "next/server": { NextResponse: { json: (body, options) => response(body, options.status || 200), redirect: (url, status) => response(url, status) } },
    "@/lib/personalSocial": lib,
    "@/lib/session": { DASHBOARD_SESSION_COOKIE: "session", readDashboardSessionValue: async (raw) => raw === "valid" ? { user: { id: "owner" } } : null },
    "@/lib/rateLimiter": { enforceDashboardRateLimit: async () => {} },
  });
  try {
    const start = await routes.socialStart({ headers: new Headers({ origin: "https://dashboard.example" }), cookies: { get: () => ({ value: "valid" }) } }, "twitch");
    const state = new URL(start.body.url).searchParams.get("state");
    const stateCookie = start.cookies.values.get(lib.socialStateCookie("twitch"));
    const callback = {
      nextUrl: new URL(`https://dashboard.example/api/personal-social/twitch/callback?state=${state}&code=auth-code`),
      cookies: { get: (name) => ({ value: name === "session" ? "valid" : stateCookie }) },
    };
    assert.match((await routes.socialCallback(callback, "twitch")).body, /result=connected$/);
    assert.equal(db.prepare("SELECT count(*) n FROM PersonalSocialAccount WHERE userId = 'owner'").get().n, 1);
    assert.equal(db.prepare("SELECT count(*) n FROM PersonalSocialVisibility").get().n, 0);
    assert.match((await routes.socialCallback(callback, "twitch")).body, /result=invalid$/);
  } finally { global.fetch = fetchBefore; process.env = env; db.close(); }
});

test("visibility writes enforce origin, signed-in owner, and current guild membership", async () => {
  const { db, prisma, lib } = fixture();
  const fetchBefore = global.fetch;
  const env = { ...process.env };
  process.env.DISCORD_REDIRECT_URI = "https://dashboard.example/api/auth/discord/callback";
  global.fetch = async () => ({ ok: true, json: async () => [{ id: "123", name: "Member server" }] });
  const route = load("app/api/personal-social/route.ts", {
    "next/server": { NextResponse: { json: (body, options) => ({ body, status: options.status }) } },
    "@/lib/prisma": prisma,
    "@/lib/session": { DASHBOARD_SESSION_COOKIE: "session", readDashboardSessionValue: async (raw) => raw === "valid" ? { user: { id: "owner" }, accessToken: "token" } : null },
    "@/lib/personalSocial": lib,
    "@/lib/rateLimiter": { enforceDashboardRateLimit: async () => {} },
  });
  function request(input, origin = "https://dashboard.example", session = "valid") {
    return { headers: new Headers({ origin }), cookies: { get: () => ({ value: session }) }, json: async () => input };
  }
  try {
    await lib.saveSocial("twitch", "owner", { id: "1", label: "one", url: "https://www.twitch.tv/one" });
    const body = { action: "visibility", provider: "twitch", guildId: "123", visible: true, expectedProviderId: "1", expectedRevision: db.prepare("SELECT revision FROM PersonalSocialRevision WHERE userId='owner' AND provider='twitch'").get().revision, userId: "victim" };
    assert.equal((await route.POST(request(body, "https://evil.example"))).status, 403);
    assert.equal((await route.POST(request(body, "https://dashboard.example", "invalid"))).status, 401);
    assert.equal((await route.POST(request({ ...body, guildId: "999" }))).status, 403);
    assert.equal((await route.POST(request(body))).status, 200);
    assert.equal((await route.POST(request(body))).status, 409);
    body.expectedRevision = db.prepare("SELECT revision FROM PersonalSocialRevision WHERE userId='owner' AND provider='twitch'").get().revision;
    assert.equal((await route.POST(request(body))).status, 200);
    assert.deepEqual(db.prepare("SELECT userId, guildId FROM PersonalSocialVisibility").all(), [{ userId: "owner", guildId: "123" }]);
    assert.equal((await route.POST(request({ action: "disconnect", provider: "twitch" }))).status, 200);
    assert.equal(db.prepare("SELECT count(*) n FROM PersonalSocialVisibility").get().n, 0);
    assert.equal(db.prepare("SELECT count(*) n FROM PersonalSocialAccount").get().n, 0);
  } finally { global.fetch = fetchBefore; process.env = env; db.close(); }
});

  test("delayed visibility request cannot share a replacement identity", async () => {
    const { db, prisma, lib } = fixture();
    const env = { ...process.env };
    const fetchBefore = global.fetch;
    process.env.DISCORD_REDIRECT_URI = "https://dashboard.example/api/auth/discord/callback";
    let release;
    let entered;
    const waiting = new Promise((resolve) => { entered = resolve; });
    global.fetch = async () => {
      entered();
      await new Promise((resolve) => { release = resolve; });
      return { ok: true, json: async () => [{ id: "123" }] };
    };
    const route = load("app/api/personal-social/route.ts", {
      "next/server": { NextResponse: { json: (body, options) => ({ body, status: options.status }) } },
      "@/lib/prisma": prisma,
      "@/lib/session": { DASHBOARD_SESSION_COOKIE: "session", readDashboardSessionValue: async () => ({ user: { id: "owner" }, accessToken: "token" }) },
      "@/lib/personalSocial": lib,
      "@/lib/rateLimiter": { enforceDashboardRateLimit: async () => {} },
    });
    try {
      await lib.saveSocial("twitch", "owner", { id: "1", label: "old", url: "https://www.twitch.tv/old" });
      const revision = db.prepare("SELECT revision FROM PersonalSocialRevision WHERE userId='owner' AND provider='twitch'").get().revision;
      const request = { headers: new Headers({ origin: "https://dashboard.example" }), cookies: { get: () => ({ value: "valid" }) },
        json: async () => ({ action: "visibility", provider: "twitch", guildId: "123", visible: true, expectedProviderId: "1", expectedRevision: revision }) };
      const pending = route.POST(request);
      await waiting;
      await lib.saveSocial("twitch", "owner", { id: "2", label: "new", url: "https://www.twitch.tv/new" });
      release();
      assert.equal((await pending).status, 409);
      assert.equal(db.prepare("SELECT count(*) n FROM PersonalSocialVisibility").get().n, 0);
    } finally { global.fetch = fetchBefore; process.env = env; db.close(); }
  });

  test("disconnect invalidates unclaimed and in-flight callbacks without affecting another provider", async () => {
    const { db, lib } = fixture();
    const env = { ...process.env };
    process.env.DISCORD_REDIRECT_URI = "https://dashboard.example/api/auth/discord/callback";
    process.env.SOCIAL_TWITCH_CLIENT_ID = "client";
    process.env.SOCIAL_TWITCH_CLIENT_SECRET = "secret";
    process.env.SOCIAL_YOUTUBE_CLIENT_ID = "client";
    process.env.SOCIAL_YOUTUBE_CLIENT_SECRET = "secret";
    try {
      const claimed = await lib.beginSocial("twitch", "owner", "session");
      const other = await lib.beginSocial("youtube", "owner", "session");
      assert.equal(await lib.consumeState("twitch", claimed.state, claimed.state, "owner", "session"), true);
      await lib.disconnectSocial("twitch", "owner");
      assert.equal(await lib.completeSocial("twitch", claimed.state, "owner", "session", { id: "42", label: "one", url: "https://www.twitch.tv/one" }), false);
      const unclaimed = await lib.beginSocial("twitch", "owner", "session");
      await lib.disconnectSocial("twitch", "owner");
      assert.equal(await lib.consumeState("twitch", unclaimed.state, unclaimed.state, "owner", "session"), false);
      assert.equal(await lib.consumeState("youtube", other.state, other.state, "owner", "session"), true);
      assert.equal(db.prepare("SELECT count(*) n FROM PersonalSocialAccount").get().n, 0);
      const superseded = await lib.beginSocial("twitch", "owner", "session");
      const fresh = await lib.beginSocial("twitch", "owner", "session");
      assert.equal(await lib.consumeState("twitch", superseded.state, superseded.state, "owner", "session"), false);
      assert.equal(await lib.consumeState("twitch", fresh.state, fresh.state, "owner", "session"), true);
      assert.equal(await lib.completeSocial("twitch", fresh.state, "owner", "session", { id: "42", label: "one", url: "https://www.twitch.tv/one" }), true);
    } finally { process.env = env; db.close(); }
  });

  test("directory pages continue past inaccessible profiles without exposing them", async () => {
    const { db, lib } = fixture();
    const fetchBefore = global.fetch;
    const env = { ...process.env };
    process.env.SESSION_SECRET = "test-session-secret";
    try {
      const addAccount = db.prepare("INSERT INTO PersonalSocialAccount VALUES (?, 'twitch', ?, ?, ?)");
      const addShare = db.prepare("INSERT INTO PersonalSocialVisibility VALUES (?, 'twitch', '123')");
      for (let i = 1; i <= 21; i++) {
        const id = String(1000 + i);
        addAccount.run(id, id, `user${id}`, `https://www.twitch.tv/user${id}`);
        addShare.run(id);
      }
      db.prepare("INSERT INTO PersonalSocialRevision VALUES ('1021', 'twitch', 'revision')").run();
      db.prepare("INSERT INTO DashboardSession VALUES (?, ?, ?)").run("1021", "last", Date.now() + 60000);
      global.fetch = async () => ({ ok: true, json: async () => [{ id: "123" }] });
      const first = await lib.visibleDirectory("123", "viewer");
      assert.deepEqual(first.accounts, []);
      assert.ok(first.nextCursor);
      assert.equal(Buffer.from(first.nextCursor, "base64url").toString("utf8").includes("1020"), false);
      const cursor = lib.decodeDirectoryCursor(first.nextCursor, "123");
      assert.ok(cursor);
      assert.equal(lib.decodeDirectoryCursor(first.nextCursor, "999"), null);
      const second = await lib.visibleDirectory("123", "viewer", cursor);
      assert.deepEqual(second.accounts.map((entry) => entry.userId), ["1021"]);
      assert.equal(second.nextCursor, null);
      assert.equal(lib.decodeDirectoryCursor("not-json", "123"), null);
    } finally { global.fetch = fetchBefore; process.env = env; db.close(); }
  });

  test("former-server sharing remains individually revocable when Discord is unavailable", async () => {
    const { db, prisma, lib } = fixture();
    const fetchBefore = global.fetch;
    const env = { ...process.env };
    process.env.DISCORD_REDIRECT_URI = "https://dashboard.example/api/auth/discord/callback";
    global.fetch = async () => ({ ok: false });
    const route = load("app/api/personal-social/route.ts", {
      "next/server": { NextResponse: { json: (body, options) => ({ body, status: options.status }) } },
      "@/lib/prisma": prisma,
      "@/lib/session": { DASHBOARD_SESSION_COOKIE: "session", readDashboardSessionValue: async () => ({ user: { id: "owner" }, accessToken: "token" }) },
      "@/lib/personalSocial": lib,
      "@/lib/rateLimiter": { enforceDashboardRateLimit: async () => {} },
    });
    const cookies = { get: () => ({ value: "valid" }) };
    try {
      await lib.saveSocial("twitch", "owner", { id: "1", label: "one", url: "https://www.twitch.tv/one" });
      db.prepare("INSERT INTO PersonalSocialVisibility VALUES ('owner', 'twitch', '123')").run();
      const result = await route.GET({ cookies, nextUrl: new URL("https://dashboard.example/api/personal-social") });
      assert.equal(result.body.guildsVerified, false);
      assert.deepEqual(result.body.visibility, [{ provider: "twitch", guildId: "123" }]);
      const removed = await route.POST({ cookies, headers: new Headers({ origin: "https://dashboard.example" }),
        json: async () => ({ action: "visibility", provider: "twitch", guildId: "123", visible: false }) });
      assert.equal(removed.status, 200);
      assert.equal(db.prepare("SELECT count(*) n FROM PersonalSocialVisibility").get().n, 0);
    } finally { global.fetch = fetchBefore; process.env = env; db.close(); }
  });

  test("social navigation redirects to configured canonical dashboard, never request host", () => {
    const route = load("app/api/personal-social/dashboard/route.ts", {
      "next/server": { NextResponse: {
        json: (body, options) => ({ body, status: options.status }),
        redirect: (url, status) => ({ url, status, headers: new Headers() }),
      } },
      "@/lib/personalSocial": { socialOrigin: () => "https://dashboard.example", isSocialOAuthProvider: (value) => ["twitch", "youtube", "reddit", "x", "tiktok"].includes(value) },
    });
    assert.equal(route.GET({ nextUrl: new URL("https://untrusted.example/") }).url, "https://dashboard.example/personal-social");
    assert.equal(route.GET({ nextUrl: new URL("https://untrusted.example/?guildId=123") }).url, "https://dashboard.example/personal-social?guildId=123");
    assert.equal(route.GET({ nextUrl: new URL("https://untrusted.example/?guildId=123%2F..%2Fadmin") }).url, "https://dashboard.example/personal-social");
    assert.equal(route.GET({ nextUrl: new URL("https://untrusted.example/?guildId=123&provider=twitch") }).url, "https://dashboard.example/personal-social?guildId=123&provider=twitch");
    assert.equal(route.GET({ nextUrl: new URL("https://untrusted.example/?guildId=123&provider=facebook") }).url, "https://dashboard.example/personal-social?guildId=123");
    const guildsPage = fs.readFileSync(path.join(__dirname, "..", "src", "app", "guilds", "page.tsx"), "utf8");
    assert.match(guildsPage, /href="\/api\/personal-social\/dashboard"/);
  });

test("filtered directory paginates shared profiles and binds cursors to server and provider", async () => {
  const { db, prisma, lib } = fixture();
  const oldFetch = global.fetch;
  const env = { ...process.env };
  process.env.SESSION_SECRET = "test-session-secret";
  global.fetch = async () => ({ ok: true, json: async () => [{ id: "123" }, { id: "456" }] });
  const route = load("app/api/personal-social/route.ts", {
    "next/server": { NextResponse: { json: (body, options) => ({ body, status: options.status }) } },
    "@/lib/prisma": prisma,
    "@/lib/session": { DASHBOARD_SESSION_COOKIE: "session", readDashboardSessionValue: async () => ({ user: { id: "viewer" }, accessToken: "viewer-token" }) },
    "@/lib/personalSocial": lib,
    "@/lib/rateLimiter": { enforceDashboardRateLimit: async () => {} },
  });
  const get = (query) => route.GET({ cookies: { get: () => ({ value: "session" }) }, nextUrl: new URL(`https://dashboard.example/api/personal-social?${query}`) });
  try {
    for (let i = 0; i < 21; i++) {
      const user = String(1000 + i);
      await lib.saveSocial("twitch", user, { id: user, label: user, url: `https://www.twitch.tv/user${user}` });
      db.prepare("INSERT INTO PersonalSocialVisibility VALUES (?, 'twitch', '123')").run(user);
      db.prepare("INSERT INTO DashboardSession VALUES (?, ?, ?)").run(user, "owner-token", Date.now() + 60000);
    }
    await lib.saveSocial("youtube", "1000", { id: "youtube-id", label: "youtube", url: "https://www.youtube.com/channel/example" });
    db.prepare("INSERT INTO PersonalSocialVisibility VALUES ('1000', 'youtube', '123')").run();
    const first = await get("guildId=123&provider=twitch");
    assert.equal(first.status, 200);
    assert.equal(first.body.accounts.length, 20);
    assert.ok(first.body.accounts.every((entry) => entry.provider === "twitch"));
    assert.ok(first.body.nextCursor);
    const cursor = encodeURIComponent(first.body.nextCursor);
    const second = await get(`guildId=123&provider=twitch&cursor=${cursor}`);
    assert.equal(second.body.accounts.length, 1);
    assert.equal(second.body.nextCursor, null);
    const youtube = await get("guildId=123&provider=youtube");
    assert.deepEqual(youtube.body.accounts.map((entry) => entry.provider), ["youtube"]);
    assert.equal((await get(`guildId=123&provider=youtube&cursor=${cursor}`)).status, 400);
    assert.equal((await get(`guildId=456&provider=twitch&cursor=${cursor}`)).status, 400);
    assert.equal((await get("guildId=123&provider=facebook")).status, 400);
  } finally { global.fetch = oldFetch; process.env = env; db.close(); }
});

test("Discord social link opens a directory only for a verified current server", async () => {
  const oldFetch = global.fetch;
  const oldWindow = global.window;
  try {
    for (const [guildId, guildsVerified, expectedDirectory] of [["123", true, true], ["999", true, false], ["123", false, false]]) {
      const calls = [];
      global.window = { location: { search: `?guildId=${guildId}&provider=twitch` }, history: { replaceState() {} } };
      global.fetch = async (url) => {
        calls.push(url);
        return { ok: true, json: async () => url.includes("?guildId=")
          ? { accounts: [], nextCursor: null }
          : { providers: [], accounts: [], visibility: [], guilds: [{ id: "123", name: "Server" }], guildsVerified } };
      };
      const jsx = { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) };
      const page = load("app/personal-social/page.tsx", {
        react: {
          useState: (value) => [value, () => {}],
          useRef: (value) => ({ current: value }),
          useEffect: (effect) => effect(),
        },
        "react/jsx-runtime": jsx,
      }).default;
      page();
      await new Promise((resolve) => setImmediate(resolve));
      assert.equal(calls.includes(`/api/personal-social?guildId=${guildId}&provider=twitch`), expectedDirectory);
    }
  } finally { global.fetch = oldFetch; global.window = oldWindow; }
});

test("Discord social link retains its server through the sign-in prompt", async () => {
  const oldFetch = global.fetch;
  const oldWindow = global.window;
  global.window = { location: { search: "?guildId=123&provider=twitch" }, history: { replaceState() {} } };
  global.fetch = async () => ({ ok: false, json: async () => ({ error: "Sign in with Discord first." }) });
  const states = [], refs = [];
  let stateIndex = 0, refIndex = 0, effectRan = false;
  const jsx = { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) };
  const page = load("app/personal-social/page.tsx", {
    react: {
      useState: (initial) => {
        const index = stateIndex++;
        if (!(index in states)) states[index] = initial;
        return [states[index], (value) => { states[index] = value; }];
      },
      useRef: (initial) => {
        const index = refIndex++;
        if (!refs[index]) refs[index] = { current: initial };
        return refs[index];
      },
      useEffect: (effect) => { if (!effectRan) { effectRan = true; effect(); } },
    },
    "react/jsx-runtime": jsx,
  }).default;
  function nodes(node) {
    if (Array.isArray(node)) return node.flatMap(nodes);
    if (!node || typeof node !== "object") return [];
    return [node, ...nodes(node.props?.children)];
  }
  try {
    page();
    await new Promise((resolve) => setImmediate(resolve));
    stateIndex = 0; refIndex = 0;
    const signIn = nodes(page()).find((node) => node.type === "a" && node.props.children === "Sign in");
    const url = new URL(signIn.props.href, "https://dashboard.example");
    assert.equal(url.searchParams.get("returnTo"), "/personal-social?guildId=123&provider=twitch");
  } finally { global.fetch = oldFetch; global.window = oldWindow; }
});

test("former-server grant is presented with a functional individual revoke control", async () => {
  const data = {
    providers: [{ id: "twitch", status: "available" }], guilds: [], guildsVerified: false,
    accounts: [{ provider: "twitch", providerId: "1", label: "one", url: "https://www.twitch.tv/one" }],
    visibility: [{ provider: "twitch", guildId: "123" }],
  };
  const states = [data, "", false, null, "", null, false];
  let index = 0;
  const jsx = { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) };
  const page = load("app/personal-social/page.tsx", {
    react: { useState: () => [states[index++], () => {}], useRef: () => ({ current: 0 }), useEffect: () => {} },
    "react/jsx-runtime": jsx,
  }).default;
  function nodes(node) {
    if (Array.isArray(node)) return node.flatMap(nodes);
    if (!node || typeof node !== "object") return [];
    return [node, ...nodes(node.props?.children)];
  }
  const elements = nodes(page());
  const button = elements.find((node) => node.type === "button" && node.props.children === "Stop sharing");
  assert.ok(button);
  const oldFetch = global.fetch;
  const requests = [];
  global.fetch = async (url, options) => {
    requests.push({ url, options });
    return { ok: true, json: async () => options?.method === "POST" ? { success: true } : data };
  };
  try {
    button.props.onClick();
    await new Promise((resolve) => setImmediate(resolve));
    assert.deepEqual(JSON.parse(requests[0].options.body), { action: "visibility", provider: "twitch", guildId: "123", visible: false });
  } finally { global.fetch = oldFetch; }
});

test("disconnect during external OAuth exchange makes the callback fail closed", async () => {
  const { db, lib } = fixture();
  const oldFetch = global.fetch;
  const env = { ...process.env };
  process.env.DISCORD_REDIRECT_URI = "https://dashboard.example/api/auth/discord/callback";
  process.env.SOCIAL_TWITCH_CLIENT_ID = "client";
  process.env.SOCIAL_TWITCH_CLIENT_SECRET = "secret";
  let entered;
  let release;
  const waiting = new Promise((resolve) => { entered = resolve; });
  global.fetch = async (url) => {
    if (url.endsWith("/token")) {
      entered();
      await new Promise((resolve) => { release = resolve; });
      return { ok: true, json: async () => ({ access_token: "temporary" }) };
    }
    if (url.endsWith("/users")) return { ok: true, json: async () => ({ data: [{ id: "42", login: "real_user" }] }) };
    return { ok: true };
  };
  const response = (body, status) => ({ body, status, headers: new Headers(), cookies: { set() {} } });
  const routes = load("lib/personalSocialRoutes.ts", {
    "next/server": { NextResponse: { json: (body, options) => response(body, options.status || 200), redirect: (url, status) => response(url, status) } },
    "@/lib/personalSocial": lib,
    "@/lib/session": { DASHBOARD_SESSION_COOKIE: "session", readDashboardSessionValue: async () => ({ user: { id: "owner" } }) },
    "@/lib/rateLimiter": { enforceDashboardRateLimit: async () => {} },
  });
  try {
    const attempt = await lib.beginSocial("twitch", "owner", "valid");
    const request = {
      nextUrl: new URL(`https://dashboard.example/api/personal-social/twitch/callback?state=${attempt.state}&code=auth-code`),
      cookies: { get: (name) => ({ value: name === "session" ? "valid" : attempt.state }) },
    };
    const callback = routes.socialCallback(request, "twitch");
    await waiting;
    await lib.disconnectSocial("twitch", "owner");
    release();
    assert.match((await callback).body, /result=invalid$/);
    assert.equal(db.prepare("SELECT count(*) n FROM PersonalSocialAccount").get().n, 0);
  } finally { global.fetch = oldFetch; process.env = env; db.close(); }
});

test("in-memory Prisma transactions atomically invalidate claimed OAuth attempts", async () => {
  const { PrismaBetterSqlite3 } = require("@prisma/adapter-better-sqlite3");
  const { PrismaClient } = require("@prisma/client");
  const prisma = new PrismaClient({ adapter: new PrismaBetterSqlite3({ url: ":memory:" }) });
  const env = { ...process.env };
  process.env.DISCORD_REDIRECT_URI = "https://dashboard.example/api/auth/discord/callback";
  process.env.SOCIAL_TWITCH_CLIENT_ID = "client";
  process.env.SOCIAL_TWITCH_CLIENT_SECRET = "secret";
  try {
    await prisma.$executeRawUnsafe("CREATE TABLE PersonalSocialAccount (userId TEXT, provider TEXT, providerId TEXT, label TEXT, url TEXT, PRIMARY KEY(userId, provider))");
    await prisma.$executeRawUnsafe("CREATE TABLE PersonalSocialRevision (userId TEXT, provider TEXT, revision TEXT NOT NULL, PRIMARY KEY(userId, provider))");
    await prisma.$executeRawUnsafe("CREATE TABLE PersonalSocialVisibility (userId TEXT, provider TEXT, guildId TEXT, PRIMARY KEY(userId, provider, guildId))");
    await prisma.$executeRawUnsafe("CREATE TABLE PersonalSocialOAuthState (stateHash TEXT PRIMARY KEY, sessionHash TEXT, userId TEXT, expiresAt INTEGER)");
    await prisma.$executeRawUnsafe("CREATE TABLE PersonalSocialOAuthAttempt (stateHash TEXT PRIMARY KEY, sessionHash TEXT, userId TEXT, provider TEXT, expiresAt INTEGER, claimed INTEGER NOT NULL DEFAULT 0)");
    const lib = load("lib/personalSocial.ts", { "@/lib/prisma": prisma });
    const attempt = await lib.beginSocial("twitch", "owner", "session");
    assert.equal(await lib.consumeState("twitch", attempt.state, attempt.state, "owner", "session"), true);
    await lib.disconnectSocial("twitch", "owner");
    assert.equal(await lib.completeSocial("twitch", attempt.state, "owner", "session", { id: "42", label: "one", url: "https://www.twitch.tv/one" }), false);
    const rows = await prisma.$queryRawUnsafe("SELECT userId FROM PersonalSocialAccount");
    assert.deepEqual(rows, []);
  } finally { process.env = env; await prisma.$disconnect(); }
});

test("existing social accounts receive stable revisions without changing grants", () => {
  const db = new Database(":memory:");
  try {
    db.exec(`CREATE TABLE PersonalSocialAccount (userId TEXT NOT NULL, provider TEXT NOT NULL, providerId TEXT NOT NULL, label TEXT NOT NULL, url TEXT NOT NULL, PRIMARY KEY(userId, provider));
      CREATE TABLE PersonalSocialVisibility (userId TEXT NOT NULL, provider TEXT NOT NULL, guildId TEXT NOT NULL, PRIMARY KEY(userId, provider, guildId));
      INSERT INTO PersonalSocialAccount VALUES ('1001', 'twitch', '42', 'one', 'https://www.twitch.tv/one');
      INSERT INTO PersonalSocialVisibility VALUES ('1001', 'twitch', '123');`);
    const source = fs.readFileSync(path.join(__dirname, "..", "src", "lib", "dashboardStoreBootstrap.ts"), "utf8");
    const sql = source.match(/db\.exec\(`([\s\S]*?)`\)/)?.[1];
    assert.ok(sql);
    db.exec(sql);
    const revision = db.prepare("SELECT revision FROM PersonalSocialRevision").get().revision;
    assert.match(revision, /^[a-f0-9]{32}$/);
    db.exec(sql);
    assert.equal(db.prepare("SELECT revision FROM PersonalSocialRevision").get().revision, revision);
    assert.equal(db.prepare("SELECT count(*) n FROM PersonalSocialVisibility").get().n, 1);
  } finally { db.close(); }
});

test("real Prisma transaction rejects stale decisions and permits a fresh consent", async () => {
  const { PrismaBetterSqlite3 } = require("@prisma/adapter-better-sqlite3");
  const { PrismaClient } = require("@prisma/client");
  const prisma = new PrismaClient({ adapter: new PrismaBetterSqlite3({ url: ":memory:" }) });
  try {
    await prisma.$executeRawUnsafe("CREATE TABLE PersonalSocialAccount (userId TEXT, provider TEXT, providerId TEXT, label TEXT, url TEXT, PRIMARY KEY(userId, provider))");
    await prisma.$executeRawUnsafe("CREATE TABLE PersonalSocialRevision (userId TEXT, provider TEXT, revision TEXT NOT NULL, PRIMARY KEY(userId, provider))");
    await prisma.$executeRawUnsafe("CREATE TABLE PersonalSocialVisibility (userId TEXT, provider TEXT, guildId TEXT, PRIMARY KEY(userId, provider, guildId))");
    const lib = load("lib/personalSocial.ts", { "@/lib/prisma": prisma });
    const account = { id: "42", label: "one", url: "https://www.twitch.tv/one" };
    await lib.saveSocial("twitch", "1001", account);
    const [initial] = await prisma.$queryRawUnsafe("SELECT revision FROM PersonalSocialRevision");
    assert.equal(await lib.setSocialVisibility("twitch", "1001", "123", false), true);
    assert.equal(await lib.setSocialVisibility("twitch", "1001", "123", true, "42", initial.revision), false);
    const [fresh] = await prisma.$queryRawUnsafe("SELECT revision FROM PersonalSocialRevision");
    assert.equal(await lib.setSocialVisibility("twitch", "1001", "123", true, "42", fresh.revision), true);
    assert.equal(await lib.setSocialVisibility("twitch", "1001", "123", true, "42", fresh.revision), false);
    assert.equal((await prisma.$queryRawUnsafe("SELECT * FROM PersonalSocialVisibility")).length, 1);
  } finally { await prisma.$disconnect(); }
});

test("directory API fails closed when viewer membership changes during owner verification", async () => {
  const { db, prisma, lib } = fixture();
  const oldFetch = global.fetch;
  let release, entered, viewerMember = true;
  const waiting = new Promise((resolve) => { entered = resolve; });
  global.fetch = async (_url, options) => {
    if (options.headers.Authorization === "Bearer owner-token") {
      entered();
      await new Promise((resolve) => { release = resolve; });
      return { ok: true, json: async () => [{ id: "123" }] };
    }
    return { ok: true, json: async () => viewerMember ? [{ id: "123" }] : [] };
  };
  const route = load("app/api/personal-social/route.ts", {
    "next/server": { NextResponse: { json: (body, options) => ({ body, status: options.status, headers: options.headers }) } },
    "@/lib/prisma": prisma,
    "@/lib/session": { DASHBOARD_SESSION_COOKIE: "session", readDashboardSessionValue: async () => ({ user: { id: "viewer" }, accessToken: "viewer-token" }) },
    "@/lib/personalSocial": lib,
    "@/lib/rateLimiter": { enforceDashboardRateLimit: async () => {} },
  });
  try {
    await lib.saveSocial("twitch", "1001", { id: "42", label: "private-profile", url: "https://www.twitch.tv/one" });
    db.prepare("INSERT INTO PersonalSocialVisibility VALUES ('1001', 'twitch', '123')").run();
    db.prepare("INSERT INTO DashboardSession VALUES (?, ?, ?)").run("1001", "owner-token", Date.now() + 60000);
    const pending = route.GET({ cookies: { get: () => ({ value: "session" }) }, nextUrl: new URL("https://dashboard.example/api/personal-social?guildId=123") });
    await waiting;
    viewerMember = false;
    release();
    const response = await pending;
    assert.equal(response.status, 503);
    assert.equal(response.headers["Cache-Control"], "private, no-store");
    assert.equal(JSON.stringify(response.body).includes("private-profile"), false);
  } finally { global.fetch = oldFetch; db.close(); }
});

test("directory omits a profile revoked during membership verification", async () => {
  const { db, lib } = fixture();
  const oldFetch = global.fetch;
  let release;
  let entered;
  const waiting = new Promise((resolve) => { entered = resolve; });
  global.fetch = async (_url, options) => {
    if (options.headers.Authorization === "Bearer owner-token") {
      entered();
      await new Promise((resolve) => { release = resolve; });
    }
    return { ok: true, json: async () => [{ id: "123" }] };
  };
  try {
    await lib.saveSocial("twitch", "1001", { id: "42", label: "one", url: "https://www.twitch.tv/one" });
    db.prepare("INSERT INTO PersonalSocialVisibility VALUES ('1001', 'twitch', '123')").run();
    db.prepare("INSERT INTO DashboardSession VALUES (?, ?, ?)").run("1001", "owner-token", Date.now() + 60000);
    const pending = lib.visibleDirectory("123", "viewer");
    await waiting;
    db.prepare("DELETE FROM PersonalSocialVisibility WHERE userId = '1001'").run();
    release();
    assert.deepEqual((await pending).accounts, []);
  } finally { global.fetch = oldFetch; db.close(); }
});

test("directory rechecks earlier profiles after all membership lookups, including re-sharing", async () => {
  const { db, lib } = fixture();
  const oldFetch = global.fetch;
  let release;
  let entered;
  let blocked = false;
  const waiting = new Promise((resolve) => { entered = resolve; });
  global.fetch = async (_url, options) => {
    if (options.headers.Authorization === "Bearer slow-owner" && !blocked) {
      blocked = true;
      entered();
      await new Promise((resolve) => { release = resolve; });
    }
    return { ok: true, json: async () => [{ id: "123" }] };
  };
  try {
    for (const [user, token] of [["1001", "fast-owner"], ["1002", "slow-owner"]]) {
      await lib.saveSocial("twitch", user, { id: user, label: user, url: `https://www.twitch.tv/${user}` });
      db.prepare("INSERT INTO PersonalSocialVisibility VALUES (?, 'twitch', '123')").run(user);
      db.prepare("INSERT INTO DashboardSession VALUES (?, ?, ?)").run(user, token, Date.now() + 60000);
    }
    const pending = lib.visibleDirectory("123", "viewer");
    await waiting;
    await new Promise((resolve) => setImmediate(resolve));
    await lib.setSocialVisibility("twitch", "1001", "123", false);
    const revision = db.prepare("SELECT revision FROM PersonalSocialRevision WHERE userId = '1001'").get().revision;
    assert.equal(await lib.setSocialVisibility("twitch", "1001", "123", true, "1001", revision), true);
    release();
    assert.deepEqual((await pending).accounts.map((entry) => entry.userId), ["1002"]);
    assert.deepEqual((await lib.visibleDirectory("123", "viewer")).accounts.map((entry) => entry.userId), ["1001", "1002"]);
  } finally { global.fetch = oldFetch; db.close(); }
});

test("additional providers require explicit enablement and construct official OAuth requests", async () => {
  const { db, lib } = fixture();
  const env = { ...process.env };
  process.env.DISCORD_REDIRECT_URI = "https://dashboard.example/api/auth/discord/callback";
  process.env.SOCIAL_REDDIT_USER_AGENT = "web:example:v1 (by /u/test)";
  for (const name of ["X", "REDDIT", "TIKTOK"]) {
    process.env[`SOCIAL_${name}_CLIENT_ID`] = "client";
    process.env[`SOCIAL_${name}_CLIENT_SECRET`] = "secret";
    delete process.env[`SOCIAL_${name}_ENABLED`];
  }
  try {
    for (const provider of ["x", "reddit", "tiktok"]) {
      assert.equal(lib.socialProviderStatus(provider), "approval-required");
      await assert.rejects(() => lib.beginSocial(provider, "owner", "session"));
      process.env[`SOCIAL_${provider.toUpperCase()}_ENABLED`] = "true";
    }
    const x = await lib.beginSocial("x", "owner", "session");
    const xUrl = new URL(x.url);
    assert.equal(xUrl.origin, "https://x.com");
    assert.equal(xUrl.searchParams.get("scope"), "tweet.read users.read");
    assert.equal(xUrl.searchParams.get("code_challenge_method"), "S256");
    const redditUrl = new URL((await lib.beginSocial("reddit", "owner", "session")).url);
    assert.equal(redditUrl.origin, "https://www.reddit.com");
    assert.equal(redditUrl.searchParams.get("scope"), "identity");
    assert.equal(redditUrl.searchParams.get("duration"), "temporary");
    const tiktokUrl = new URL((await lib.beginSocial("tiktok", "owner", "session")).url);
    assert.equal(tiktokUrl.origin, "https://www.tiktok.com");
    assert.equal(tiktokUrl.searchParams.get("client_key"), "client");
    assert.equal(tiktokUrl.searchParams.get("scope"), "user.info.basic,user.info.profile");
  } finally { process.env = env; db.close(); }
});

test("X and Reddit verify provider user identity and revoke short-lived tokens", async () => {
  const { db, lib } = fixture();
  const env = { ...process.env };
  const oldFetch = global.fetch;
  process.env.DISCORD_REDIRECT_URI = "https://dashboard.example/api/auth/discord/callback";
  process.env.SOCIAL_X_CLIENT_ID = "client";
  process.env.SOCIAL_X_CLIENT_SECRET = "secret";
  process.env.SOCIAL_REDDIT_CLIENT_ID = "client";
  process.env.SOCIAL_REDDIT_CLIENT_SECRET = "secret";
  process.env.SOCIAL_REDDIT_USER_AGENT = "web:example:v1 (by /u/test)";
  const calls = [];
  global.fetch = async (url, options) => {
    calls.push({ url, options });
    if (url.endsWith("/token") || url.endsWith("/access_token")) return { ok: true, json: async () => ({ access_token: "temporary" }) };
    if (url.endsWith("/users/me")) return { ok: true, json: async () => ({ data: { id: "123", username: "test_user" } }) };
    if (url.endsWith("/api/v1/me")) return { ok: true, json: async () => ({ id: "abc123", name: "test_user" }) };
    return { ok: true };
  };
  try {
    assert.deepEqual(await lib.exchangeX("code", "a".repeat(43)), { id: "123", label: "test_user", url: "https://x.com/test_user" });
    assert.equal(calls[0].options.body.get("code_verifier"), "a".repeat(43));
    assert.match(calls[0].options.headers.Authorization, /^Basic /);
    assert.equal(calls[2].url, "https://api.x.com/2/oauth2/revoke");
    assert.deepEqual(await lib.exchangeReddit("code"), { id: "abc123", label: "test_user", url: "https://www.reddit.com/user/test_user" });
    assert.equal(calls[3].options.headers["User-Agent"], process.env.SOCIAL_REDDIT_USER_AGENT);
    assert.equal(calls[5].url, "https://www.reddit.com/api/v1/revoke_token");
    assert.equal(db.prepare("SELECT count(*) n FROM PersonalSocialAccount").get().n, 0);
  } finally { global.fetch = oldFetch; process.env = env; db.close(); }
});

test("TikTok requires granted profile scope and trusted provider URL, revoking on failure", async () => {
  const { db, lib } = fixture();
  const env = { ...process.env };
  const oldFetch = global.fetch;
  process.env.DISCORD_REDIRECT_URI = "https://dashboard.example/api/auth/discord/callback";
  process.env.SOCIAL_TIKTOK_CLIENT_ID = "client";
  process.env.SOCIAL_TIKTOK_CLIENT_SECRET = "secret";
  let scope = "user.info.basic,user.info.profile";
  let profile = "https://www.tiktok.com/@real_user?tracking=removed";
  const calls = [];
  global.fetch = async (url) => {
    calls.push(url);
    if (url.endsWith("/oauth/token/")) return { ok: true, json: async () => ({ access_token: "temporary", refresh_token: "not-stored", open_id: "opaque", scope }) };
    if (url.includes("/user/info/")) return { ok: true, json: async () => ({ data: { user: { open_id: "opaque", display_name: "Real", profile_deep_link: profile } }, error: { code: "ok" } }) };
    return { ok: true };
  };
  try {
    assert.deepEqual(await lib.exchangeTikTok("code"), { id: "opaque", label: "Real", url: "https://www.tiktok.com/@real_user" });
    assert.equal(calls.at(-1), "https://open.tiktokapis.com/v2/oauth/revoke/");
    profile = "https://evil.example/@real_user";
    await assert.rejects(() => lib.exchangeTikTok("code"));
    assert.equal(calls.at(-1), "https://open.tiktokapis.com/v2/oauth/revoke/");
    scope = "user.info.basic";
    await assert.rejects(() => lib.exchangeTikTok("code"));
    assert.equal(calls.at(-1), "https://open.tiktokapis.com/v2/oauth/revoke/");
    assert.equal(db.prepare("SELECT count(*) n FROM PersonalSocialAccount").get().n, 0);
  } finally { global.fetch = oldFetch; process.env = env; db.close(); }
});

test("X callback stores only verified profile with private-by-default sharing", async () => {
  const { db, lib } = fixture();
  const env = { ...process.env };
  const oldFetch = global.fetch;
  process.env.DISCORD_REDIRECT_URI = "https://dashboard.example/api/auth/discord/callback";
  process.env.SOCIAL_X_CLIENT_ID = "client";
  process.env.SOCIAL_X_CLIENT_SECRET = "secret";
  process.env.SOCIAL_X_ENABLED = "true";
  global.fetch = async (url) => {
    if (url.endsWith("/token")) return { ok: true, json: async () => ({ access_token: "temporary" }) };
    if (url.endsWith("/users/me")) return { ok: true, json: async () => ({ data: { id: "123", username: "test_user" } }) };
    return { ok: true };
  };
  const response = (body, status) => ({ body, status, headers: new Headers(), cookies: { set() {} } });
  const routes = load("lib/personalSocialRoutes.ts", {
    "next/server": { NextResponse: { json: (body, options) => response(body, options.status || 200), redirect: (url, status) => response(url, status) } },
    "@/lib/personalSocial": lib,
    "@/lib/session": { DASHBOARD_SESSION_COOKIE: "session", readDashboardSessionValue: async () => ({ user: { id: "owner" } }) },
    "@/lib/rateLimiter": { enforceDashboardRateLimit: async () => {} },
  });
  try {
    const attempt = await lib.beginSocial("x", "owner", "valid");
    const request = {
      nextUrl: new URL(`https://dashboard.example/api/personal-social/x/callback?state=${attempt.state}&code=auth-code`),
      cookies: { get: (name) => ({ value: name === "session" ? "valid" : `${attempt.state}.${attempt.verifier}` }) },
    };
    assert.match((await routes.socialCallback(request, "x")).body, /result=connected$/);
    assert.deepEqual(db.prepare("SELECT provider, providerId, label FROM PersonalSocialAccount").all(), [{ provider: "x", providerId: "123", label: "test_user" }]);
    assert.equal(db.prepare("SELECT count(*) n FROM PersonalSocialVisibility").get().n, 0);
  } finally { global.fetch = oldFetch; process.env = env; db.close(); }
});

for (const scenario of ["revoke", "reconnect"]) {
  test(`delayed sharing cannot undo ${scenario}`, async () => {
    const { db, prisma, lib } = fixture();
    const env = { ...process.env };
    const oldFetch = global.fetch;
    process.env.DISCORD_REDIRECT_URI = "https://dashboard.example/api/auth/discord/callback";
    let release, entered;
    const waiting = new Promise((resolve) => { entered = resolve; });
    global.fetch = async () => {
      entered();
      await new Promise((resolve) => { release = resolve; });
      return { ok: true, json: async () => [{ id: "123" }] };
    };
    const route = load("app/api/personal-social/route.ts", {
      "next/server": { NextResponse: { json: (body, options) => ({ body, status: options.status }) } },
      "@/lib/prisma": prisma,
      "@/lib/session": { DASHBOARD_SESSION_COOKIE: "session", readDashboardSessionValue: async () => ({ user: { id: "owner" }, accessToken: "token" }) },
      "@/lib/personalSocial": lib,
      "@/lib/rateLimiter": { enforceDashboardRateLimit: async () => {} },
    });
    const request = (body) => ({ headers: new Headers({ origin: "https://dashboard.example" }), cookies: { get: () => ({ value: "valid" }) }, json: async () => body });
    const account = { id: "1", label: "one", url: "https://www.twitch.tv/one" };
    try {
      await lib.saveSocial("twitch", "owner", account);
      const version = db.prepare("SELECT revision FROM PersonalSocialRevision WHERE userId='owner' AND provider='twitch'").get().revision;
      const delayed = route.POST(request({ action: "visibility", provider: "twitch", expectedProviderId: "1", expectedRevision: version, guildId: "123", visible: true }));
      await waiting;
      if (scenario === "revoke") {
        assert.equal((await route.POST(request({ action: "visibility", provider: "twitch", guildId: "123", visible: false }))).status, 200);
      } else {
        assert.equal((await route.POST(request({ action: "disconnect", provider: "twitch" }))).status, 200);
        await lib.saveSocial("twitch", "owner", account);
      }
      release();
      assert.equal((await delayed).status, 409, scenario);
      assert.equal(db.prepare("SELECT count(*) n FROM PersonalSocialVisibility").get().n, 0, scenario);
    } finally { global.fetch = oldFetch; process.env = env; db.close(); }
  });
}
