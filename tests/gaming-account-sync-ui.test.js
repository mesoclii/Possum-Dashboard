"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");
const jsx = require("react/jsx-runtime");

function renderHub(root, identities, calls) {
  const source = fs.readFileSync(path.join(root, "src", "components", "possum", "MemberGamingHub.tsx"), "utf8");
  const code = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const exports = {};
  const react = {
    useState(initial) { return [initial === "overview" ? "profile" : typeof initial === "function" ? initial() : initial, () => {}]; },
    useMemo(fn) { return fn(); },
    useEffect() {},
  };
  vm.runInNewContext(code, {
    exports,
    require(name) {
      if (name === "react") return react;
      if (name === "react/jsx-runtime") return jsx;
      if (name === "@/styles/possumTheme") return { possum: {} };
      throw new Error(`Unexpected dependency: ${name}`);
    },
  });
  const providers = ["steam", "battlenet", "bungie", "playstation", "xbox"].map((key) => ({
    key, title: key, ready: true, mode: key === "playstation" ? "psn_service" : "oauth",
  }));
  const tree = exports.default({
    guildId: "123", guildName: "Community", viewerUserId: "456",
    engines: { gameIdentity: { details: { authProviders: providers, memberSelfService: { identities } } } },
    loading: false, saving: false, message: "", warnings: [],
    onReload() {},
    onAction(...args) { calls.push(args); return Promise.resolve({ ok: true }); },
    buildConnectHref(key) { return `/connect/${key}`; },
  });
  function expand(node) {
    if (Array.isArray(node)) return node.flatMap(expand);
    if (!node || typeof node !== "object") return [];
    if (typeof node.type === "function") return expand(node.type(node.props));
    return [{ ...node, children: expand(node.props?.children) }];
  }
  return expand(tree);
}

function find(node, predicate) {
  for (const entry of node) {
    if (predicate(entry)) return entry;
    const child = find(entry.children, predicate);
    if (child) return child;
  }
  return null;
}

for (const [site, root] of [["gaming hub", path.resolve(__dirname, "..")]]) {
  test(`${site}: sync uses WoW for Battle.net and preserves unverified PlayStation refresh`, () => {
    const calls = [];
    const tree = renderHub(root, [
      { providerKey: "battlenet", platformKey: "pc", verified: true },
      { providerKey: "playstation", platformKey: "playstation", verified: false },
      { providerKey: "steam", platformKey: "pc", verified: false },
    ], calls);
    function providerCard(name) {
      return find(tree, (entry) => entry.type === "div" &&
        entry.children.some((child) => child.type === "div" && child.children.some((nested) =>
          nested.type === "strong" && nested.props.children === name)));
    }
    const battle = providerCard("battlenet");
    const psn = providerCard("playstation");
    const steam = providerCard("steam");
    const sync = (card) => find(card.children, (entry) => entry.type === "button" && entry.props.children === "Sync game data");
    assert.ok(sync(battle));
    assert.ok(sync(psn));
    assert.equal(sync(steam), null);
    sync(battle).props.onClick();
    sync(psn).props.onClick();
    assert.equal(calls[0][0], "gameProvider");
    assert.equal(calls[0][1], "refreshProviderUser");
    assert.equal(calls[0][2].providerKey, "wow");
    assert.equal(calls[0][2].platform, "pc");
    assert.equal(calls[1][2].providerKey, "playstation");
    assert.ok(find(battle.children, (entry) => entry.type === "a" && entry.props.children === "Reconnect"));
  });
}
