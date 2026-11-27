"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");

function response() {
  return { statusCode: 200, status(n) { this.statusCode = n; return this; }, json(body) { this.body = body; return this; } };
}

test("undo proxy is disabled and never forwards tokens while isolation is unresolved", async () => {
  let upstreamCalls = 0;
  const mocks = {
    BOT_API: "http://127.0.0.1:3001",
    readActorUserId: async () => "222222222222222222",
    buildBotApiHeaders: async () => ({}),
    fetchBotApi: async () => { upstreamCalls++; throw new Error("must not forward"); },
  };
  const source = fs.readFileSync(path.join(__dirname, "..", "src", "pages", "api", "bot", "infrastructure.ts"), "utf8");
  const js = ts.transpileModule(source, { compilerOptions: { testModule: ts.ModuleKind.CommonJS, esModuleInterop: true } }).outputText;
  const mod = { exports: {} };
  new Function("require", "module", "exports", js)((name) => {
    if (name === "@/lib/botApi") return mocks;
    if (name === "@/lib/session") return {};
    return require(name);
  }, mod, mod.exports);
  const valid = mod.exports.validUndoBotUrl;
  for (const url of ["http://127.0.0.1:3001", "http://[::1]:3001"]) assert.equal(valid(url), true);
  for (const url of ["http://localhost:3001", "https://127.0.0.1:3001", "http://example.com", "http://127.0.0.1.evil:3001", "http://user@127.0.0.1:3001", "http://127.0.0.1:3001/path", "not a url"]) assert.equal(valid(url), false);
  const res = response();
  await mod.exports.default({
    method: "POST", headers: { origin: "https://dashboard.example", "content-type": "application/json" },
    body: { guildId: "111111111111111111", action: "undo", userId: "222222222222222222" },
  }, res);
  assert.equal(res.statusCode, 503);
  assert.equal(upstreamCalls, 0);
});
