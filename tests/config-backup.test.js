"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const ts = require("typescript");

const guildId = "111111111111111111";
const otherGuildId = "222222222222222222";
const ownerId = "333333333333333333";
const adminId = "444444444444444444";
const backupKind = "possum-dashboard-full-configuration";
const files = {
  "audit-trail-config.json": { present: true, value: { active: true, channelId: "555555555555555555" } },
  "runtime-safety.json": { present: false },
};

function makeFullBackup(targetGuild = guildId) {
  return {
    kind: backupKind, version: 1, id: crypto.randomUUID(), guildId: targetGuild,
    name: "Test backup", createdAt: new Date().toISOString(),
    bot: { id: "bot-backup", guildId: targetGuild, config: { onboarding: {} }, features: { onboardingEnabled: true } },
    dashboard: { kind: "possum-dashboard-settings", version: 2, guildId: targetGuild, name: "Dashboard settings",
      createdAt: new Date().toISOString(), actorUserId: ownerId, files },
  };
}

function fixture(options = {}) {
  const state = {
    session: { user: { id: options.actorId || ownerId }, accessToken: "discord-token" },
    guild: { id: guildId, owner: options.isOwner !== false, permissions: options.isOwner === false ? "32" : "0" },
    botCalls: [], dashboardCalls: [], saved: new Map(),
    botResponse: options.botResponse || {},
  };
  const setupBackup = {
    captureDashboardSettingsBackup(id, name = "", actorId = "") { return { kind: "possum-dashboard-settings", version: 2, guildId: id, name, createdAt: new Date().toISOString(), actorUserId: actorId, files: structuredClone(files) }; },
    validateDashboardSettingsBackup(value, id) { if (value?.guildId !== id || value?.kind !== "possum-dashboard-settings") throw new Error("Invalid dashboard settings backup."); },
    previewDashboardSettingsRestore(id, actor, target) { state.dashboardCalls.push({ action: "preview", id, actor }); return { token: "dashboard-preview", recovery: { ...structuredClone(target), name: "recovery" }, changedFiles: ["audit-trail-config.json"] }; },
    restoreDashboardSettings(id, actor, target, token) { state.dashboardCalls.push({ action: "restore", id, actor, token }); return token === "dashboard-preview" ? { success: true, applied: ["audit-trail-config.json"] } : { success: false, reason: "preview-invalid" }; },
    savePrivateDashboardBackup(id, backup) { const meta = { id: backup.id, guildId: id, name: backup.name, createdAt: backup.createdAt, bytes: 120, engineCount: 1, featureCount: 1 }; state.saved.set(meta.id, { ...meta, backup }); return meta; },
    listPrivateDashboardBackups(id) { return [...state.saved.values()].filter((entry) => entry.guildId === id).map(({ backup: _backup, ...meta }) => meta); },
    getPrivateDashboardBackup(id, key) { const entry = state.saved.get(key); return entry?.guildId === id ? entry : null; },
    deletePrivateDashboardBackup(id, key) { const entry = state.saved.get(key); if (entry?.guildId !== id) return false; state.saved.delete(key); return true; },
  };
  const mocks = {
    "@/lib/setupStore": { appendAudit() {} },
    "@/lib/discordOAuth": {
      fetchDiscordUser: async () => ({ id: state.session.user.id }),
      fetchDiscordGuilds: async () => [state.guild],
      hasGuildManageAccess: (guild) => guild?.owner === true || guild?.permissions === "32",
    },
    "@/lib/session": { DASHBOARD_SESSION_COOKIE: "session", readDashboardSessionValue: async () => state.session },
    "@/lib/dashboardConfigBackup": setupBackup,
    "@/lib/botApi": {
      BOT_API: "http://127.0.0.1:3001",
      buildBotApiHeaders: async () => ({ "x-dashboard-token": "token" }),
      fetchBotApi: async (_url, init) => {
        const body = JSON.parse(String(init.body)); state.botCalls.push(body);
        const result = state.botResponse[body.action] || (body.action === "full-preview"
          ? { success: true, token: "bot-preview", recovery: { guildId, config: {}, features: {} }, changedEngines: ["onboarding"], changedFeatures: ["onboardingEnabled"], changedDashboardSettings: ["Automation flows"] }
          : { success: true, appliedEngines: ["onboarding"], appliedDashboardSettings: true });
        return { ok: result.success !== false, status: result.status || (result.success === false ? 409 : 200), text: async () => JSON.stringify(result) };
      },
      readJsonSafe: async (response) => JSON.parse(await response.text()),
    },
  };
  const source = fs.readFileSync(path.join(__dirname, "..", "src", "pages", "api", "system", "config-backup.ts"), "utf8");
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true } }).outputText;
  const mod = { exports: {} };
  new Function("require", "module", "exports", "process", compiled)((name) => mocks[name] || require(name), mod, mod.exports, process);
  const call = async (method, body = {}, query = { guildId }, origin = "https://dashboard.example") => {
    const res = { statusCode: 200, headers: {}, setHeader(key, value) { this.headers[key] = value; }, status(code) { this.statusCode = code; return this; }, json(value) { this.body = value; return this; } };
    await mod.exports.default({ method, query, body, cookies: { session: "session" }, headers: {
      origin, host: "dashboard.example", "x-forwarded-proto": "https",
      "content-type": "application/json",
    } }, res);
    return res;
  };
  return { state, call };
}

test("full export captures dashboard settings and is scoped to the selected guild", async () => {
  const f = fixture();
  const response = await f.call("GET", {}, { guildId, action: "export" });
  assert.equal(response.statusCode, 200);
  assert.equal(response.body.backup.guildId, guildId);
  assert.equal(response.body.backup.files["audit-trail-config.json"].value.channelId, "555555555555555555");
  assert.equal(f.state.botCalls.length, 0);
});
test("composite preview reports database changes and restore applies setup files plus bot settings", async () => {
  const f = fixture();
  const backup = makeFullBackup();
  const preview = await f.call("POST", { guildId, action: "preview", backup });
  assert.equal(preview.statusCode, 200);
  assert.deepEqual(preview.body.changedDatabaseSettings, ["Automation flows"]);
  assert.deepEqual(preview.body.changedDashboardFiles, ["audit-trail-config.json"]);
  const restored = await f.call("POST", { guildId, action: "restore", backup, previewToken: preview.body.token, confirm: true, recoveryDownloaded: true });
  assert.equal(restored.statusCode, 200);
  assert.equal(f.state.dashboardCalls.at(-1).action, "restore");
  assert.deepEqual(f.state.botCalls.map((entry) => entry.action), ["full-preview", "full-restore"]);
  assert.match(restored.body.warning, /flow definitions/);
});

test("guild administrators may export but cannot restore another server's dashboard settings", async () => {
  const f = fixture({ isOwner: false, actorId: adminId });
  const exportResult = await f.call("GET", {}, { guildId, action: "export" });
  assert.equal(exportResult.statusCode, 200);
  const denied = await f.call("POST", { guildId, action: "preview", backup: makeFullBackup() });
  assert.equal(denied.statusCode, 403);
  assert.equal(f.state.botCalls.length, 0);
});
test("cross-guild backups and cross-origin restore requests are rejected before writes", async () => {
  const f = fixture();
  const foreign = makeFullBackup(otherGuildId);
  const invalid = await f.call("POST", { guildId, action: "preview", backup: foreign });
  assert.equal(invalid.statusCode, 400);
  const crossOrigin = await f.call("POST", { guildId, action: "preview", backup: makeFullBackup() }, { guildId }, "https://evil.example");
  assert.equal(crossOrigin.statusCode, 403);
  assert.equal(f.state.botCalls.length, 0);
});

