"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");

test("JED gallery renders the unified discovery and vault workspace", () => {
  const filename = path.join(__dirname, "..", "src", "app", "emotes", "page.tsx");
  const code = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const pageModule = { exports: {} };
  new Function("require", "module", "exports", code)(require, pageModule, pageModule.exports);
  const markup = renderToStaticMarkup(React.createElement(pageModule.exports.default));

  assert.match(markup, /Your expression library/);
  assert.match(markup, /Find it\. Keep it\. Make it yours\./);
  assert.match(markup, /Discover/);
  assert.match(markup, /My Vault/);
  assert.match(markup, /Sign in to manage your vault/);
  assert.match(markup, /Public Library/);
  assert.match(markup, /Import &amp; Sources/);
  const source = fs.readFileSync(filename, "utf8");
  assert.match(source, /Create private collection/);
  assert.match(source, /Delete collection safely/);
  assert.match(source, /manage-personal-collection/);
  assert.match(source, /Collection descriptions must be|description/);
  assert.match(source, /PUBLIC_PAGE_SIZE = 24/);
  assert.match(source, />Previous</);
  assert.match(source, />Next</);
  assert.match(source, /GIFs/);
});
