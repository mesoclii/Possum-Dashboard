"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");

function load(relative, aliases = {}) {
  const source = fs.readFileSync(path.join(__dirname, "..", relative), "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const loadedModule = { exports: {} };
  new Function("require", "module", "exports", compiled)(
    (name) => aliases[name] || require(name), loadedModule, loadedModule.exports
  );
  return loadedModule.exports;
}

const moderator = load("src/lib/moderatorNavigation.ts");
const context = load("src/lib/dashboardContext.ts");
const nav = load("src/lib/dashboard/navigation.ts", { "@/lib/premiumCatalog": { PREMIUM_FEATURES: [] } });
const AuditTrail = load("src/app/dashboard/security/audit-trail/AuditTrailClient.tsx", {
  "next/link": { __esModule: true, default: ({ href, children }) => React.createElement("a", { href }, children) },
  "@/lib/dashboardContext": context,
  "@/lib/moderatorNavigation": moderator,
  "@/lib/auditRequests": load("src/lib/auditRequests.ts"),
}).default;

test("Security navigation exposes the audit trail without replacing Moderator", () => {
  for (const owner of [false, true]) {
    const security = nav.getDashboardNavSections(owner, {}).find((section) => section.label === "Security");
    assert.ok(security.items.some((item) => item.href === "/dashboard/moderator"));
    assert.equal(security.items.filter((item) => item.href === "/dashboard/security/audit-trail").length, 1);
  }
});

test("top navigation links and Possum Admin section respect owner boundaries without duplicates", () => {
  const memberSections = nav.getDashboardNavSections(false, {});
  assert.equal(memberSections.some((section) => section.label === "Possum Admin"), false);
  assert.deepEqual(nav.getDashboardNavTopLinks(false).map((item) => item.href), [
    "/dashboard/motd",
    "/dashboard/system-health",
  ]);

  const ownerAdmin = nav.getDashboardNavSections(true, {}).find((section) => section.label === "Possum Admin");
  assert.ok(ownerAdmin);
  assert.deepEqual(ownerAdmin.items.map((item) => item.href), ["/dashboard/ai/openai-platform"]);
  const ownerTopLinks = nav.getDashboardNavTopLinks(true).map((item) => item.href);
  assert.deepEqual(ownerTopLinks, [
    "/dashboard/motd",
    "/dashboard/system-health",
    "/dashboard/operations",
    "/dashboard/master",
  ]);
  const primaryOwnerTopLinks = nav.getDashboardNavTopLinks(true, true).map((item) => item.href);
  assert.ok(primaryOwnerTopLinks.includes("/dashboard/switchboard"));
  assert.equal(ownerAdmin.items.some((item) => ownerTopLinks.includes(item.href)), false);
});

test("visible dashboard routes are unique and keep Message of the Day and !Command Studio canonical", () => {
  for (const [owner, primaryOwner, pokemonOperator] of [[false, false, false], [true, false, false], [true, true, true]]) {
    const topLinks = nav.getDashboardNavTopLinks(owner, primaryOwner, pokemonOperator);
    const sections = nav.getDashboardNavSections(owner, {}, primaryOwner, pokemonOperator);
    const routes = [...topLinks, ...sections.flatMap((section) => section.items)]
      .map((item) => item.href.split("?")[0].split("#")[0]);
    assert.equal(new Set(routes).size, routes.length, "each visible route should have one navigation entry");
    assert.equal(topLinks.filter((item) => item.href === "/dashboard/motd").length, 1);
    assert.equal(sections.flatMap((section) => section.items).some((item) => item.href === "/dashboard/motd"), false);
    const automation = sections.find((section) => section.label === "Automation");
    assert.ok(automation.items.some((item) => item.href === "/dashboard/commands" && item.label === "!Command Studio"));
    assert.equal(automation.items.some((item) => item.href === "/dashboard/custom-commands"), false);
  }
  const legacyRoute = fs.readFileSync(path.join(__dirname, "..", "src/app/dashboard/custom-commands/page.tsx"), "utf8");
  assert.match(legacyRoute, /redirect\("\/dashboard\/commands"\)/);
});

test("social game hubs and Heist appear in their requested dashboard categories", () => {
  const sections = nav.getDashboardNavSections(true, {});
  const socials = sections.find((section) => section.label === "Socials");
  const pro = sections.find((section) => section.label === "Possum Pro");
  assert.ok(socials);
  assert.ok(pro);
  for (const href of ["/dashboard/games", "/dashboard/wow", "/tcg"]) {
    assert.ok(socials.items.some((item) => item.href === href), `${href} should be under Socials`);
  }
  assert.ok(pro.items.some((item) => item.href === "/dashboard/heist"));
  assert.equal(sections.some((section) => section.label === "Fun + Games" && section.items.some((item) => ["/dashboard/games", "/dashboard/wow", "/tcg", "/dashboard/heist"].includes(item.href))), false);
});

test("moderator tab links select valid tabs and preserve the original default", () => {
  assert.equal(moderator.readModeratorTab(null), "automod");
  assert.equal(moderator.readModeratorTab("invalid"), "automod");
  for (const tab of ["automod", "admin", "audit", "commands"]) {
    assert.equal(moderator.readModeratorTab(tab), tab);
  }
  const source = fs.readFileSync(path.join(__dirname, "..", "src/app/dashboard/moderator/ModeratorClient.tsx"), "utf8");
  assert.match(source, /useState<TabKey>\(\(\) => readModeratorTab\(requestedTab\)\)/);
  assert.match(source, /setTab\(readModeratorTab\(requestedTab\)\)/);
  assert.match(source, /\}, \[requestedTab\]\)/);
});

test("audit trail links keep the selected guild and identify distinct logging surfaces", () => {
  const savedWindow = global.window;
  const savedStorage = global.localStorage;
  const values = new Map([["activeGuildId", "old-guild"]]);
  global.window = { location: { search: "?guildId=current-guild&userId=user-1" } };
  global.localStorage = { getItem: (key) => values.get(key) || null, setItem: (key, value) => values.set(key, value) };
  try {
    const markup = renderToStaticMarkup(React.createElement(AuditTrail));
    assert.match(markup, /dashboard configuration history and process logs/);
    assert.match(markup, /href="\/dashboard\/moderator\?tab=audit&amp;guildId=current-guild&amp;userId=user-1"/);
    assert.match(markup, /href="\/dashboard\/channels\?guildId=current-guild&amp;userId=user-1"/);
    assert.equal(values.get("activeGuildId"), "current-guild");
  } finally {
    global.window = savedWindow;
    global.localStorage = savedStorage;
  }
});
