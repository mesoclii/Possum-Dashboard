"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");

function load(file, mocks) {
  const source = fs.readFileSync(path.join(__dirname, "..", "src", ...file.split("/")), "utf8");
  const js = ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX,
  } }).outputText;
  const loadedModule = { exports: {} };
  new Function("require", "module", "exports", js)(
    (name) => Object.prototype.hasOwnProperty.call(mocks, name) ? mocks[name] : require(name),
    loadedModule, loadedModule.exports
  );
  return loadedModule.exports;
}

const jsx = { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }), Fragment: "fragment" };
function nodes(node) {
  if (Array.isArray(node)) return node.flatMap(nodes);
  if (!node || typeof node !== "object") return [];
  return [node, ...nodes(node.props?.children)];
}

const emojis = [{ id: "1", name: "wave", token: "<a:wave:1>", animated: true }];

function pickerBeside(tree, fieldValue) {
  const parent = nodes(tree).find((node) => {
    const children = node.props?.children;
    return Array.isArray(children) && children.some((child) => child?.type === "input" && child.props.value === fieldValue)
      && children.some((child) => child?.type === "picker");
  });
  return parent?.props.children.find((child) => child?.type === "picker");
}

function fieldWithValue(tree, value) {
  return nodes(tree).find((node) => node.type === "emoji-field" && node.props.children.props.value === value);
}

test("self-role pickers edit the intended panel and role without replacing other settings", () => {
  let cfg;
  const panel = (id, body, emoji) => ({
    id, messageBody: body, messageTitle: id, channelId: "", mode: "buttons",
    maxSelectable: 1, enabled: true, allowRemove: true, options: [
      { roleId: id, label: id, emoji, style: "secondary", description: "" },
    ],
  });
  const client = load("app/dashboard/access/selfroles/SelfrolesClient.tsx", {
    "react/jsx-runtime": jsx,
    react: { useState: (value) => [value, () => {}], useMemo: (fn) => fn(), useEffect() {} },
    "@/components/possum/GuildEmojiField": { default: "emoji-field" },
    "@/components/possum/GuildEmojiPicker": { default: "picker" },
    "@/components/possum/useGuildEmojis": { useGuildEmojis: (id) => { assert.equal(id, "guild"); return emojis; } },
    "@/components/possum/ConfigJsonEditor": { default: "json" },
    "@/components/possum/EngineInsights": { default: "insights" },
    "@/components/possum/useGuildEngineEditor": {
      useGuildEngineEditor: (_engine, defaults) => {
        cfg ||= { ...defaults, panels: [panel("one", "first body", "old"), panel("two", "other body", "other")] };
        return { guildId: "guild", config: cfg, setConfig: (next) => { cfg = typeof next === "function" ? next(cfg) : next; }, channels: [], roles: [] };
      },
    },
  }).default;
  let tree = client();
  const message = fieldWithValue(tree, "first body");
  assert.deepEqual(message.props.emojis, emojis);
  message.props.onInsert("first <a:wave:1> body");
  tree = client();
  const picker = pickerBeside(tree, "old");
  assert.deepEqual(picker.props.emojis, emojis);
  picker.props.onInsert("<a:wave:1>");
  assert.equal(cfg.panels[0].messageBody, "first <a:wave:1> body");
  assert.equal(cfg.panels[0].options[0].emoji, "<a:wave:1>");
  assert.equal(cfg.panels[1].messageBody, "other body");
  assert.equal(cfg.panels[1].options[0].emoji, "other");
  assert.equal(cfg.panels[0].options[0].roleId, "one");
});

test("ticket pickers preserve controls and other ticket types through save", async () => {
  const type = (label) => ({
    label, enabled: true, shortPrefix: label, panelChannelId: "", panelButtonLabel: label,
    panelButtonEmoji: `${label}-emoji`, panelTitle: label, panelDescription: `${label}-description`,
    panelThumbnailUrl: "", panelImageUrl: "", openCategoryId: "", closedCategoryId: "",
    transcriptChannelId: "", logChannelId: "", introTitle: label, introMessage: `${label}-intro`,
  });
  const config = {
    active: true, panelChannelId: "", panelLayout: "separate", panelTitle: "title", panelDescription: "fallback",
    panelThumbnailUrl: "", panelImageUrl: "", openCategoryId: "", closedCategoryId: "", transcriptLogId: "",
    staffRoleIds: ["staff"], founderRoleIds: [], singleLogMode: true,
    controls: { claimLabel: "Claim", claimEmoji: "claim", closeLabel: "Close", closeEmoji: "close",
      reopenLabel: "Reopen", reopenEmoji: "reopen", deleteLabel: "Delete", deleteEmoji: "delete" },
    types: { support: type("support"), vip: type("vip"), drops: type("drops") },
  };
  const slots = ["guild", "Guild", [], [], emojis, config, config, false, false, false, ""];
  let index = 0;
  const client = load("app/dashboard/access/tickets/TicketsClient.tsx", {
    "react/jsx-runtime": jsx,
    react: {
      useState: () => { const i = index++; return [slots[i], (next) => { slots[i] = typeof next === "function" ? next(slots[i]) : next; }]; },
      useMemo: (fn) => fn(), useEffect() {},
    },
    "next/link": { default: "link" },
    "@/components/possum/GuildEmojiField": { default: "emoji-field" },
    "@/components/possum/GuildEmojiPicker": { default: "picker" },
  }).default;
  const render = () => { index = 0; return client(); };
  for (const [value, next] of [["fallback", "fallback <a:wave:1>"], ["vip-description", "vip <a:wave:1> description"], ["drops-intro", "drops <a:wave:1> intro"]]) {
    const field = fieldWithValue(render(), value);
    assert.deepEqual(field.props.emojis, emojis);
    field.props.onInsert(next);
  }
  for (const value of ["claim", "close", "reopen", "delete", "support-emoji"]) {
    const picker = pickerBeside(render(), value);
    assert.deepEqual(picker.props.emojis, emojis);
    picker.props.onInsert("<a:wave:1>");
  }
  let payload;
  const originalFetch = global.fetch;
  global.fetch = async (_url, options) => {
    payload = JSON.parse(options.body);
    return { ok: true, json: async () => ({ config: payload.patch }) };
  };
  try {
    const save = nodes(render()).find((node) => node.type === "button" && node.props.children === "Save Tickets");
    await save.props.onClick();
  } finally {
    global.fetch = originalFetch;
  }
  assert.equal(payload.patch.panelDescription, "fallback <a:wave:1>");
  assert.equal(payload.patch.types.vip.panelDescription, "vip <a:wave:1> description");
  assert.equal(payload.patch.types.drops.introMessage, "drops <a:wave:1> intro");
  assert.equal(payload.patch.types.support.panelButtonEmoji, "<a:wave:1>");
  for (const key of ["claimEmoji", "closeEmoji", "reopenEmoji", "deleteEmoji"]) assert.equal(payload.patch.controls[key], "<a:wave:1>");
  assert.equal(payload.patch.types.vip.panelButtonEmoji, "vip-emoji");
  assert.deepEqual(payload.patch.staffRoleIds, ["staff"]);
});

test("tickets load server emojis from the existing guild-data response", async () => {
  const slots = ["guild"];
  let index = 0;
  const effects = [];
  const client = load("app/dashboard/access/tickets/TicketsClient.tsx", {
    "react/jsx-runtime": jsx,
    react: {
      useState: (value) => { const i = index++; if (!(i in slots)) slots[i] = value; return [slots[i], (next) => { slots[i] = typeof next === "function" ? next(slots[i]) : next; }]; },
      useMemo: (fn) => fn(), useEffect: (fn) => effects.push(fn),
    },
    "next/link": { default: "link" },
    "@/components/possum/GuildEmojiField": { default: "emoji-field" },
    "@/components/possum/GuildEmojiPicker": { default: "picker" },
  }).default;
  const originalFetch = global.fetch;
  global.fetch = async (url) => ({ ok: true, json: async () => url.includes("guild-data")
    ? { guild: { name: "Guild" }, emojis, roles: [], channels: [] }
    : { config: {} } });
  try {
    client();
    effects[1]();
    await new Promise((resolve) => setImmediate(resolve));
    assert.deepEqual(slots[4], emojis);
  } finally {
    global.fetch = originalFetch;
  }
});
