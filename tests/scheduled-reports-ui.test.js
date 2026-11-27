"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");

function render(reports) {
  const states = ["weekly", "", [], reports, ""];
  const source = fs.readFileSync(path.join(__dirname, "../src/app/dashboard/scheduled-reports/page.tsx"), "utf8");
  const js = ts.transpileModule(source, { compilerOptions: { testModule: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  const mod = { exports: {} };
  new Function("require", "module", "exports", js)((name) => {
    if (name === "react") return { useState: () => [states.shift(), () => {}], useEffect: () => {} };
    if (name === "@/components/possum/useGuildEngineEditor") return { useGuildEngineEditor: () => ({ guildId: "123", guildName: "Test", channels: [] }) };
    return require(name);
  }, mod, mod.exports);
  return renderToStaticMarkup(mod.exports.default());
}

test("reports distinguish zero, unavailable, approximate and stored-only values", () => {
  const html = render([
    { id: "1", cadence: "daily", memberCount: 0, activity: { tracked: 0, active1d: 0, active7d: 0, active30d: 0, joined7d: 0, joined30d: 0 }, retention: { olderThan30d: 0, retained30d: 0 }, moderation: { audit30: 0 }, eventsAvailable: true, eventIds: [], delivery: { skipped: "no-channel" } },
    { id: "2", cadence: "weekly", memberCount: 15, memberCountApproximate: true, activity: { missing: true }, retention: { missing: true }, moderation: { missing: true }, eventsAvailable: false },
  ]);
  assert.match(html, /Server members: 0/);
  assert.match(html, /Server members: ~15 \(approximate\)/);
  assert.match(html, /Tracked members: Unavailable/);
  assert.match(html, /Events: 0/);
  assert.match(html, /Events: Unavailable/);
  assert.match(html, /Delivery: Stored only/);
});
