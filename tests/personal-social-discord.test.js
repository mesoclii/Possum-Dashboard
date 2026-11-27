"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");

test("Discord bridge stays unavailable even with configured credentials", async () => {
  const env = { ...process.env };
  Object.assign(process.env, { PERSONAL_SOCIAL_BRIDGE_SECRET: "ab".repeat(32), PERSONAL_SOCIAL_BRIDGE_BOT_ID: "123" });
  try {
    const source = fs.readFileSync(path.join(__dirname, "..", "src", "app", "api", "personal-social", "discord", "route.ts"), "utf8");
    const js = ts.transpileModule(source, { compilerOptions: { testModule: ts.ModuleKind.CommonJS } }).outputText;
    const testModule = { exports: {} };
    new Function("require", "module", "exports", js)((name) => {
      if (name === "next/server") return { NextResponse: { json: (body, options) => ({ body, ...options }) } };
      throw new Error(`Unexpected dependency: ${name}`);
    }, testModule, testModule.exports);
    const response = await testModule.exports.POST({ headers: new Headers({ "x-social-user": "456" }) });
    assert.equal(response.status, 503);
    assert.equal(response.headers["Cache-Control"], "private, no-store");
    assert.deepEqual(response.body, { error: "Personal social bridge unavailable." });
  } finally { process.env = env; }
});
