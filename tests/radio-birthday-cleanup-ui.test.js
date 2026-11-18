"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");

const jsx = { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) };

function nodes(node) {
  if (!node || typeof node !== "object") return [];
  const children = node.props?.children;
  return [node, ...(Array.isArray(children) ? children.flatMap(nodes) : nodes(children))];
}

for (const initial of [undefined, true]) {
  test(`birthday cleanup opt-in loads and saves from ${String(initial)}`, async () => {
    const state = [];
    const effects = [];
    let index = 0;
    let effectIndex = 0;
    let request;
    const oldFetch = global.fetch;
    const oldWindow = global.window;
    const oldStorage = global.localStorage;
    global.localStorage = { getItem: () => "", setItem: () => {} };
    global.window = { location: { search: "?guildId=123" } };
    global.fetch = async (url, options) => {
      if (options?.method === "POST") {
        request = JSON.parse(options.body);
        return { ok: true, json: async () => ({ success: true, config: request.patch }) };
      }
      if (url.startsWith("/api/runtime/engine")) {
        return { ok: true, json: async () => ({ success: true, config: {
          birthday: { roleId: "role-1", ...(initial === undefined ? {} : { durableRoleCleanup: initial }) },
        } }) };
      }
      return { ok: true, json: async () => ({ roles: [], channels: [] }) };
    };
    try {
      const file = path.join(__dirname, "..", "src", "app", "dashboard", "economy", "radio-birthday", "RadioBirthdayClient.tsx");
      const js = ts.transpileModule(fs.readFileSync(file, "utf8"), {
        compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
      }).outputText;
      const module = { exports: {} };
      new Function("require", "module", "exports", js)((name) => {
        if (name === "react/jsx-runtime") return jsx;
        if (name === "react") return {
          useState(value) {
            const i = index++;
            if (!(i in state)) state[i] = value;
            return [state[i], (next) => { state[i] = typeof next === "function" ? next(state[i]) : next; }];
          },
          useMemo: (fn) => fn(),
          useEffect(fn, deps) {
            const i = effectIndex++;
            if (!effects[i] || deps.some((value, n) => value !== effects[i][n])) {
              effects[i] = deps;
              fn();
            }
          },
        };
        return require(name);
      }, module, module.exports);
      const render = () => { index = 0; effectIndex = 0; return nodes(module.exports.default()); };
      render();
      render();
      await new Promise((resolve) => setImmediate(resolve));
      let tree = render();
      const control = tree.find((node) => node.type === "input" && node.props.checked === (initial === true) &&
        tree.some((parent) => parent.type === "label" && nodes(parent).includes(node) &&
          String(parent.props.children).includes("Keep birthday role cleanup")));
      assert.ok(control, "cleanup checkbox reflects the loaded setting");
      control.props.onChange({ target: { checked: initial !== true } });
      tree = render();
      const save = tree.find((node) => node.type === "button" && node.props.children === "Save Birthday");
      await save.props.onClick();
      assert.equal(request.patch.birthday.durableRoleCleanup, initial !== true);
      assert.equal(request.patch.birthday.roleId, "role-1");
    } finally {
      global.fetch = oldFetch;
      global.window = oldWindow;
      global.localStorage = oldStorage;
    }
  });
}
