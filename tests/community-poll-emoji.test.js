"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");

const jsx = { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }), Fragment: "fragment" };
function nodes(node) {
  if (Array.isArray(node)) return node.flatMap(nodes);
  if (!node || typeof node !== "object") return [];
  return [node, ...nodes(node.props?.children)];
}

test("poll option picker and manual input update only the selected option and save the token", async () => {
  const token = "<a:long_server_emoji_name:123456789012345678>";
  const emojis = [{ id: "123456789012345678", name: "long_server_emoji_name", token, animated: true }];
  let config = {
    active: true, notes: "keep", polls: [
      { id: "poll1", name: "First", question: "Question", options: [
        { id: "one", label: "One", emoji: "😀" }, { id: "two", label: "Two", emoji: "🔥" },
      ] },
      { id: "poll2", name: "Other", question: "Other", options: [
        { id: "one", label: "A", emoji: "👍" }, { id: "two", label: "B", emoji: "" },
      ] },
    ],
  };
  let saved;
  const mocks = {
    "react/jsx-runtime": jsx,
    react: { useMemo: (fn) => fn(), useState: (initial) => [initial, () => {}] },
    "@/components/possum/ConfigJsonEditor": { default: "json" },
    "@/components/possum/EngineInsights": { default: "insights" },
    "@/components/possum/GuildEmojiPicker": { default: "picker" },
    "@/components/possum/useGuildEmojis": { useGuildEmojis: (id) => { assert.equal(id, "guild"); return emojis; } },
    "@/components/possum/useGuildEngineEditor": { useGuildEngineEditor: () => ({
      guildId: "guild", guildName: "Guild", config, setConfig: (next) => { config = typeof next === "function" ? next(config) : next; },
      channels: [], roles: [], summary: [], details: {}, loading: false, saving: false, save: async (value) => { saved = value; }, runAction() {},
    }) },
  };
  const source = fs.readFileSync(path.join(__dirname, "..", "src", "app", "dashboard", "community-studio", "CommunityStudioClient.tsx"), "utf8");
  const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  const testModule = { exports: {} };
  new Function("require", "module", "exports", js)((name) => mocks[name] || require(name), testModule, testModule.exports);
  const render = () => nodes(testModule.exports.default());
  let tree = render();
  const pickers = tree.filter((node) => node.type === "picker");
  assert.equal(pickers.length, 2);
  assert.deepEqual(pickers[1].props.emojis, emojis);
  pickers[1].props.onInsert(token);
  assert.equal(config.polls[0].options[0].emoji, "😀");
  assert.equal(config.polls[0].options[1].emoji, token);
  assert.equal(config.polls[1].options[0].emoji, "👍");
  assert.equal(config.notes, "keep");

  tree = render();
  const manual = tree.filter((node) => node.type === "input" && node.props.placeholder === "Emoji");
  manual[0].props.onChange({ target: { value: "🦊" } });
  tree = render();
  const save = tree.find((node) => node.type === "button" && node.props.children === "Save Community Studio");
  await save.props.onClick();
  assert.equal(saved.polls[0].options[0].emoji, "🦊");
  assert.equal(saved.polls[0].options[1].emoji, token);
  assert.equal(saved.notes, "keep");
});
