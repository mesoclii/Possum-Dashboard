"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");

function load(file, mocks = {}) {
  const source = fs.readFileSync(path.join(__dirname, "..", "src", ...file.split("/")), "utf8");
  const js = ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX,
  } }).outputText;
  const testModule = { exports: {} };
  new Function("require", "module", "exports", js)(
    (name) => Object.prototype.hasOwnProperty.call(mocks, name) ? mocks[name] : require(name),
    testModule, testModule.exports
  );
  return testModule.exports;
}

const jsx = { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }), Fragment: "fragment" };
function nodes(node) {
  if (Array.isArray(node)) return node.flatMap(nodes);
  if (!node || typeof node !== "object") return [];
  const children = node.props?.children;
  return [node, ...nodes(children)];
}

test("guild data cache retains the server's emoji tokens", async () => {
  const oldWindow = global.window;
  const oldFetch = global.fetch;
  global.window = { setTimeout, clearTimeout };
  let requests = 0;
  global.fetch = async () => {
    requests++;
    return new Response(JSON.stringify({ emojis: [{ id: "1", name: "wave", token: "<a:wave:1>", animated: true }] }));
  };
  try {
    const runtime = load("lib/liveRuntime.ts");
    const first = await runtime.fetchGuildData("guild", "viewer");
    const second = await runtime.fetchGuildData("guild", "viewer");
    assert.deepEqual(first.emojis, [{ id: "1", name: "wave", token: "<a:wave:1>", animated: true }]);
    assert.deepEqual(second.emojis, first.emojis);
    assert.equal(requests, 1);
  } finally {
    global.window = oldWindow;
    global.fetch = oldFetch;
  }
});

test("picker only inserts an available selected emoji", () => {
  const state = [];
  let cursor = 0;
  let inserted;
  const picker = load("components/possum/GuildEmojiPicker.tsx", {
    "react/jsx-runtime": jsx,
    react: { useState: (initial) => {
      const index = cursor++;
      if (!(index in state)) state[index] = initial;
      return [state[index], (value) => { state[index] = value; }];
    } },
  }).default;
  const render = (emojis) => { cursor = 0; return picker({ emojis, onInsert: (value) => { inserted = value; } }); };
  const emojis = [
    { id: "1", name: "wave", token: "<a:wave:1>", animated: true },
    { id: "2", name: "gone", token: "<:gone:2>", available: false },
  ];
  let tree = render(emojis);
  nodes(tree).find((node) => node.type === "button").props.onClick();
  tree = render(emojis);
  const emojiButtons = nodes(tree).filter((node) => node.type === "button" && String(node.props["aria-label"] || "").startsWith("Insert :"));
  assert.equal(emojiButtons.length, 1);
  assert.equal(emojiButtons[0].props["aria-label"], "Insert :wave: animated");
  emojiButtons[0].props.onClick();
  assert.equal(inserted, "<a:wave:1>");
  tree = render([]);
  assert.equal(tree.type, "small");
});

test("emoji insertion replaces the selection and restores the caret without losing surrounding text", () => {
  const control = {
    value: "Hello selected world", selectionStart: 6, selectionEnd: 14,
    focus() { this.focused = true; },
    setSelectionRange(start, end) { this.caret = [start, end]; },
  };
  let output;
  const oldRaf = global.requestAnimationFrame;
  global.requestAnimationFrame = (callback) => callback();
  try {
    const field = load("components/possum/GuildEmojiField.tsx", {
      "react/jsx-runtime": jsx,
      react: { useRef: () => ({ current: control }), cloneElement: (child, props) => ({ ...child, props: { ...child.props, ...props } }) },
      "@/components/possum/GuildEmojiPicker": { default: "picker" },
    }).default;
    const tree = field({ children: { type: "textarea", props: {} }, emojis: [], onInsert: (value) => { output = value; } });
    nodes(tree).find((node) => node.type === "picker").props.onInsert("<:wave:1>");
    assert.equal(output, "Hello <:wave:1> world");
    assert.equal(control.focused, true);
    assert.deepEqual(control.caret, [15, 15]);
  } finally {
    global.requestAnimationFrame = oldRaf;
  }
});

test("onboarding and pre-onboarding insertion updates only the selected template", () => {
  for (const [file, field] of [
    ["onboarding/OnboardingClient.tsx", "postVerifyTemplate"],
    ["pre-onboarding/PreOnboardingClient.tsx", "banDmTemplate"],
  ]) {
    let config;
    const client = load(`app/dashboard/security/${file}`, {
      "react/jsx-runtime": jsx,
      "@/components/possum/GuildEmojiField": { default: "emoji-field" },
      "@/components/possum/useGuildEmojis": { useGuildEmojis: () => [{ id: "1", name: "wave", token: "<:wave:1>" }] },
      "@/components/possum/ConfigJsonEditor": { default: "json" },
      "@/components/possum/EngineInsights": { default: "insights" },
      "@/components/possum/useGuildEngineEditor": {
        useGuildEngineEditor: (_engine, defaults) => {
          config = { ...defaults, [field]: "before after", untouched: "keep" };
          return { guildId: "guild", config, setConfig: (fn) => { config = fn(config); }, channels: [], roles: [] };
        },
      },
    }).default;
    const wrapper = nodes(client()).find((node) => node.type === "emoji-field" && node.props.children.props.value === "before after");
    assert.ok(wrapper, file);
    assert.equal(wrapper.props.emojis[0].token, "<:wave:1>");
    wrapper.props.onInsert("before <:wave:1> after");
    assert.equal(config[field], "before <:wave:1> after");
    assert.equal(config.untouched, "keep");
  }
});

test("welcome and onboarding builder insert into the correct engine draft", () => {
  for (const [file, slots, fieldIndex, label] of [
    ["welcome-goodbye/WelcomeGoodbyeClient.tsx", ["guild", "Guild", { untouched: 1 }, { postVerifyTemplate: "target", untouched: 2 }, {}, [], false, false, ""], 3, "Post-verification welcome message"],
    ["onboarding-builder/OnboardingBuilderClient.tsx", ["guild", "Guild", {}, { dmTemplate: "target", untouched: 3 }, { panelDescription: "ticket", untouched: 4 }, {}, [], [], false, false, ""], 4, null],
  ]) {
    let index = 0;
    const client = load(`app/dashboard/security/${file}`, {
      "react/jsx-runtime": jsx,
      react: {
        useState: () => { const i = index++; return [slots[i], (next) => { slots[i] = typeof next === "function" ? next(slots[i]) : next; }]; },
        useEffect() {}, useMemo: (fn) => fn(),
      },
      "next/link": { default: "link" },
      "@/components/possum/GuildEmojiField": { default: "emoji-field" },
      "@/components/possum/useGuildEmojis": { useGuildEmojis: () => [{ id: "1", name: "wave", token: "<:wave:1>" }] },
      "@/lib/liveRuntime": {},
    }).default;
    const fields = nodes(client()).filter((node) => node.type === "emoji-field");
    const wrapper = fields.find((node) => label ? node.props.children.props["aria-label"] === label : node.props.children.props.value === "ticket");
    assert.ok(wrapper, file);
    wrapper.props.onInsert("prefix <:wave:1> suffix");
    assert.equal(slots[fieldIndex][label ? "postVerifyTemplate" : "panelDescription"], "prefix <:wave:1> suffix");
    assert.equal(slots[fieldIndex].untouched, label ? 2 : 4);
  }
});

test("a stale guild emoji request cannot overwrite the new guild", async () => {
  let state = { guildId: "", emojis: [] };
  let effect;
  const pending = {};
  const hook = load("components/possum/useGuildEmojis.ts", {
    react: {
      useState: () => [state, (value) => { state = value; }],
      useEffect: (fn) => { effect = fn; },
    },
    "@/lib/liveRuntime": { fetchGuildData: (id) => new Promise((resolve) => { pending[id] = resolve; }) },
  }).useGuildEmojis;
  hook("old");
  const cleanup = effect();
  cleanup();
  hook("new");
  effect();
  pending.new({ emojis: [{ id: "new" }] });
  await Promise.resolve();
  pending.old({ emojis: [{ id: "old" }] });
  await Promise.resolve();
  assert.deepEqual(state, { guildId: "new", emojis: [{ id: "new" }] });
});
