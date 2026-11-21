"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const ts = require("typescript");

const guild = "111111111111111111";
const other = "222222222222222222";
const audit = "audit-trail-config.json";
const runtime = "runtime-safety.json";
const source = fs.readFileSync(path.join(__dirname, "..", "src", "pages", "api", "system", "config-backup.ts"), "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true } }).outputText;
function loadLibrary(name, fileSystem = fs, cwd = process.cwd()) {
  const source = fs.readFileSync(path.join(__dirname, "..", "src", "lib", `${name}.ts`), "utf8");
  const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true } }).outputText;
  const mod = { exports: {} };
  new Function("require", "module", "exports", "process", js)((name) => name === "fs" ? fileSystem : require(name), mod, mod.exports, { cwd: () => cwd });
  return mod.exports;
}
const discord = loadLibrary("discordOAuth");

function fixture(t) {
  const root = path.join(__dirname, `config-backup-test-${crypto.randomBytes(8).toString("hex")}`);
  const dir = path.join(root, "data", "setup");
  fs.mkdirSync(dir, { recursive: true });
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const state = { session: { user: { id: "actor" }, accessToken: "token" }, discordUser: { id: "actor" }, guilds: [{ id: guild, permissions: "32" }], premium: true, auditFail: false, failRename: "", failRead: "" };
  const fileSystem = {
    ...fs,
    renameSync(from, to) { if (path.basename(to) === state.failRename) throw Error("write failed"); return fs.renameSync(from, to); },
    readFileSync(file, ...args) {
      if (path.basename(file) === state.failRead) { const error = Error("file disappeared"); error.code = "ENOENT"; throw error; }
      return fs.readFileSync(file, ...args);
    },
  };
  const actualSetup = loadLibrary("setupStore", fileSystem, root);
  const setup = { ...actualSetup, appendAudit() { if (state.auditFail) throw Error("audit failed"); } };
  const mocks = {
    fs: fileSystem,
    "@/lib/setupStore": setup,
    "@/lib/premiumGuard": { requirePremiumAccess: async (_req, res) => state.premium ? true : res.status(402).json({ success: false }) },
    "@/lib/session": { DASHBOARD_SESSION_COOKIE: "session", readDashboardSessionValue: async () => state.session },
    "@/lib/discordOAuth": { fetchDiscordUser: async () => state.discordUser, fetchDiscordGuilds: async () => { if (state.guilds instanceof Error) throw state.guilds; return state.guilds; }, hasGuildManageAccess: discord.hasGuildManageAccess },
  };
  const mod = { exports: {} };
  new Function("require", "module", "exports", "process", compiled)((name) => mocks[name] || require(name), mod, mod.exports, { cwd: () => root });
  const put = (file, value) => fs.writeFileSync(path.join(dir, file), typeof value === "string" ? value : JSON.stringify(value));
  const get = (file) => JSON.parse(fs.readFileSync(path.join(dir, file), "utf8"));
  const call = async (method, body = {}, query = { guildId: guild }) => {
    const res = { statusCode: 200, status(n) { this.statusCode = n; return this; }, json(value) { this.body = value; return this; }, setHeader() {} };
    await mod.exports.default({ method, query, body, cookies: {} }, res);
    return res;
  };
  const callSettings = async (route, method, body = {}, query = { guildId: guild }) => {
    const source = fs.readFileSync(path.join(__dirname, "..", "src", "pages", "api", ...route.split("/")) + ".ts", "utf8");
    const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true } }).outputText;
    const target = { exports: {} };
    const dependencies = { ...mocks, "@/lib/dashboardAudit": { auditDashboardEvent: async () => {} }, "@/lib/rateLimiter": { enforceDashboardRateLimit: async () => {}, isRateLimitError: () => false } };
    new Function("require", "module", "exports", "process", js)((name) => dependencies[name] || require(name), target, target.exports, { cwd: () => root });
    const res = { statusCode: 200, status(n) { this.statusCode = n; return this; }, json(value) { this.body = value; return this; } };
    await target.exports.default({ method, query, body, cookies: {} }, res);
    return res;
  };
  return { state, put, get, call, callSettings, setup, dir, restore: mod.exports.restoreConfigBackup };
}

test("export and isolated restore round trip merge and replace without changing other guilds", async (t) => {
  const f = fixture(t);
  f.put(audit, { [guild]: { include: { ai: true }, active: true }, [other]: { keep: 7 } });
  f.put(runtime, { [guild]: { active: true } });
  f.put("unlisted.json", { [guild]: { private: true } });
  const response = await f.call("GET");
  assert.equal(response.statusCode, 200);
  const backup = response.body.backup;
  assert.deepEqual(Object.keys(backup.files), [audit, runtime]);
  f.put(audit, { [guild]: { include: { moderation: true }, extra: 1 }, [other]: { keep: 7 } });
  assert.equal(f.restore(guild, backup, "merge").success, true);
  assert.deepEqual(f.get(audit)[guild], { include: { moderation: true, ai: true }, extra: 1, active: true });
  assert.deepEqual(f.get(audit)[other], { keep: 7 });
  assert.equal(f.restore(guild, backup, "replace").success, true);
  assert.deepEqual(f.get(audit)[guild], backup.files[audit]);
  assert.deepEqual(f.get(audit)[other], { keep: 7 });
  const blocked = await f.call("POST", { guildId: guild, payload: backup });
  assert.equal(blocked.statusCode, 503);
  assert.match(blocked.body.error, /isolated/);
});

test("requires authenticated live guild management and premium access", async (t) => {
  const f = fixture(t);
  f.state.session = null; assert.equal((await f.call("GET")).statusCode, 401);
  f.state.session = { user: { id: "actor" }, accessToken: "token" };
  f.state.discordUser = { id: "different" }; assert.equal((await f.call("GET")).statusCode, 401);
  f.state.discordUser = { id: "actor" };
  f.state.guilds = [{ id: other, owner: true }]; assert.equal((await f.call("GET")).statusCode, 403);
  f.state.guilds = [{ id: guild, permissions: "0" }]; assert.equal((await f.call("GET")).statusCode, 403);
  assert.equal((await f.call("POST", { guildId: guild, payload: { guildId: guild, files: {} } })).statusCode, 403);
  f.state.guilds = Error("offline"); assert.equal((await f.call("GET")).statusCode, 503);
  f.state.guilds = [{ id: guild, owner: true }]; f.state.premium = false; assert.equal((await f.call("GET")).statusCode, 402);
});

test("rejects cross-guild, unknown files, malformed values and dangerous keys before any writes", async (t) => {
  const f = fixture(t);
  f.put(audit, { [other]: { keep: true } });
  const bad = [
    { guildId: other, files: { [audit]: {} } },
    { guildId: guild, files: { "anything.json": {} } },
    { guildId: guild, files: { "../audit-trail-config.json": {} } },
    { guildId: guild, files: { [audit]: [] } },
    JSON.parse(`{"guildId":"${guild}","files":{"${audit}":{"__proto__":{"polluted":true}}}}`),
  ];
  for (const payload of bad) {
    assert.equal((await f.call("POST", { guildId: guild, payload })).statusCode, 400);
    assert.equal(f.restore(guild, payload, "replace").success, false);
  }
  assert.equal((await f.call("POST", { guildId: other, payload: bad[0] })).statusCode, 400);
  assert.deepEqual(f.get(audit), { [other]: { keep: true } });
});

test("corrupt or wrong-shaped stores fail export and preflight without writes", async (t) => {
  const f = fixture(t);
  f.put(audit, { [guild]: { active: true }, [other]: { keep: true } });
  for (const corrupt of ["", "{broken", "[]", "null"]) {
    f.put(runtime, corrupt);
    assert.equal((await f.call("GET")).statusCode, 500);
    const result = f.restore(guild, { guildId: guild, files: { [audit]: { active: false }, [runtime]: {} } }, "replace");
    assert.equal(result.success, false); assert.deepEqual(result.applied, []);
    assert.deepEqual(f.get(audit)[guild], { active: true });
    assert.equal(fs.readFileSync(path.join(f.dir, runtime), "utf8"), corrupt);
  }
  f.put(runtime, { [other]: { keep: true } }); f.state.failRead = runtime;
  assert.equal((await f.call("GET")).statusCode, 500);
  assert.equal(f.restore(guild, { guildId: guild, files: { [runtime]: {} } }, "replace").success, false);
  assert.deepEqual(f.get(runtime), { [other]: { keep: true } });
});

test("atomic writes report partial failures and audit errors", (t) => {
  const f = fixture(t);
  f.put(audit, { [other]: { keep: true } }); f.put(runtime, { [other]: { keep: 2 } });
  const payload = { guildId: guild, files: { [audit]: { active: true }, [runtime]: { active: false } } };
  f.state.failRename = runtime;
  const partial = f.restore(guild, payload, "replace");
  assert.equal(partial.success, false); assert.deepEqual(partial.applied, [audit]);
  assert.deepEqual(f.get(runtime), { [other]: { keep: 2 } });
  assert.deepEqual(fs.readdirSync(f.dir).filter((name) => name.endsWith(".tmp")), []);
  f.state.failRename = ""; f.state.auditFail = true;
  const failedAudit = f.restore(guild, payload, "replace");
  assert.equal(failedAudit.success, false); assert.deepEqual(failedAudit.applied, [audit, runtime]);
});

test("live settings routes and backup share a lock and reject corrupt stores", async (t) => {
  const f = fixture(t);
  for (const [route, file] of [["audit/config", audit], ["system/runtime-safety", runtime]]) {
    f.put(file, { [other]: { keep: true } });
    assert.equal((await f.callSettings(route, "POST", { guildId: guild, patch: { active: false } })).statusCode, 200);
    assert.equal(f.get(file)[guild].active, false);
    assert.deepEqual(f.get(file)[other], { keep: true });
    f.put(file, "{broken");
    assert.equal((await f.callSettings(route, "POST", { guildId: guild, patch: { active: true } })).statusCode, 500);
    assert.equal(fs.readFileSync(path.join(f.dir, file), "utf8"), "{broken");
    f.put(file, { [other]: { keep: true } });
  }
  fs.mkdirSync(path.join(f.dir, ".setup-store.lock"));
  assert.equal((await f.call("GET")).statusCode, 500);
  assert.equal((await f.callSettings("system/runtime-safety", "POST", { guildId: guild, patch: { active: true } })).statusCode, 500);
  assert.equal(f.restore(guild, { guildId: guild, files: { [runtime]: { active: true } } }, "replace").success, false);
  assert.deepEqual(f.get(runtime), { [other]: { keep: true } });
});
