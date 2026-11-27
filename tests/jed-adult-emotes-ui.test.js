"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");

function load(file, mocks = {}) {
  const filename = path.join(__dirname, "..", "src", ...file.split("/"));
  const code = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const testModule = { exports: {} };
  new Function("require", "module", "exports", code)((name) => Object.hasOwn(mocks, name) ? mocks[name] : require(name), testModule, testModule.exports);
  return testModule.exports;
}

test("adult emote studio fails closed behind its feature-level age check", () => {
  const page = load("app/dashboard/jed/adult-emotes/page.tsx", {
    "@/components/possum/useGuildEngineEditor": {
      useGuildEngineEditor: () => ({
        guildId: "123456789012345678",
        guildName: "Private Guild",
        config: { enabled: true, batchLimit: 1, defaultTarget: "auto", defaultVisibility: "public", allowedDomains: [] },
        emojis: [],
        loading: false,
        message: "",
        runAction: async () => null,
        reload: async () => null,
      }),
    },
    "@/lib/dashboardContext": { buildDashboardHref: (href) => href },
    "next/link": ({ children, href }) => React.createElement("a", { href }, children),
  });
  const html = renderToStaticMarkup(React.createElement(page.default));
  assert.match(html, /Adult Emote Studio/);
  assert.match(html, /Feature-level age check/);
  assert.match(html, /Start k-ID AgeKey check/);
  assert.match(html, /Pending, failed, or unknown results never grant access/);
  assert.doesNotMatch(html, /Publish to gallery/);
});
