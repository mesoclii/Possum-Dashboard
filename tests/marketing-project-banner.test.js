"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");

test("marketing pages show project credits at the top and update times in the footer", () => {
  const source = fs.readFileSync(path.join(__dirname, "..", "src", "components", "possum", "MarketingSite.tsx"), "utf8");
  const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
  const mod = { exports: {} };
  new Function("require", "module", "exports", js)((name) => {
    if (name === "next/link") return { __esModule: true, default: ({ children, ...props }) => React.createElement("a", props, children) };
    if (name === "@/lib/publicLinks") return { buildPublicInviteUrl: () => "#invite", buildSupportServerUrl: () => "#support" };
    if (name === "@/components/possum/ProjectUpdateTimes") return { __esModule: true, default: () => React.createElement("div", null, "Project update times") };
    return require(name);
  }, mod, mod.exports);
  const header = renderToStaticMarkup(React.createElement(mod.exports.MarketingHeader));
  const footer = renderToStaticMarkup(React.createElement(mod.exports.MarketingFooter));
  assert.ok(header.indexOf("</header>") < header.indexOf("site-project-banner"));
  for (const text of ["aStonedPossum", "aCityRaccoon", "FluffyBnny"]) {
    assert.ok(header.includes(text));
    assert.ok(!footer.includes(text));
  }
  assert.ok(!header.includes("Project update times"));
  assert.ok(footer.includes("Project update times"));
});
