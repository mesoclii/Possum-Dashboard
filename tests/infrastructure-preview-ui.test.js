"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");
const { renderToStaticMarkup } = require("react-dom/server");

function render(customChannels) {
  const source = fs.readFileSync(path.join(__dirname, "../src/app/dashboard/infrastructure/InfrastructureSetupWizard.tsx"), "utf8");
  const js = ts.transpileModule(source, { compilerOptions: { testModule: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  const testModule = { exports: {} };
  let stateIndex = 0;
  new Function("require", "module", "exports", js)((name) => {
    if (name === "react") return {
      useState: (initial) => {
        const index = stateIndex++;
        const value = index === 0 ? "123456789012345678" : index === 8 ? customChannels : index === 24 ? false : initial;
        return [value, () => {}];
      },
      useCallback: (callback) => callback,
      useMemo: (callback) => callback(),
      useEffect: () => {},
    };
    if (name === "@/lib/dashboardContext") return {};
    return require(name);
  }, testModule, testModule.exports);
  return renderToStaticMarkup(testModule.exports.default());
}

test("custom channels alone enable both setup preview buttons", () => {
  for (const [channels, disabled] of [["", true], ["game-room", false]]) {
    const buttons = [...render(channels).matchAll(/<button\b([^>]*)>Preview selected setup<\/button>/g)];
    assert.equal(buttons.length, 2);
    for (const button of buttons) assert.equal(/\bdisabled=""/.test(button[1]), disabled);
  }
});
