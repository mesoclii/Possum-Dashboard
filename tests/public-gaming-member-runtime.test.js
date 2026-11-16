"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");

test("public hub uses the existing member route for reads and actions", async () => {
  const source = fs.readFileSync(path.join(__dirname, "..", "src", "lib", "liveRuntime.ts"), "utf8");
  const code = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const calls = [];
  const exports = {};
  const window = {
    location: { pathname: "/gaming", search: "" },
    setTimeout,
    clearTimeout,
    localStorage: { getItem: () => "", setItem: () => {} },
  };
  const fetch = async (url, options) => {
    calls.push({ url, options });
    return { ok: true, text: async () => JSON.stringify({ success: true }) };
  };
  vm.runInNewContext(code, { exports, window, localStorage: window.localStorage, fetch, AbortController, URLSearchParams, setTimeout, clearTimeout });
  await exports.fetchRuntimeEngine("guild", "gameIdentity", "actor");
  await exports.runRuntimeEngineAction("guild", "squadFinder", "joinSession", { sessionId: "squad" }, "actor");
  assert.equal(new URL(calls[0].url, "http://localhost").searchParams.get("routePath"), "/dashboard/games");
  assert.equal(JSON.parse(calls[1].options.body).routePath, "/dashboard/games");
  window.location.pathname = "/dashboard/other";
  await exports.fetchRuntimeEngine("guild", "gameIdentity", "actor");
  assert.equal(new URL(calls[2].url, "http://localhost").searchParams.get("routePath"), "/dashboard/other");
});
