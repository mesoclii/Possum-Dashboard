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
  const module = { exports: {} };
  new Function("require", "module", "exports", compiled)(
    (name) => aliases[name] || require(name), module, module.exports
  );
  return module.exports;
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

test("Possum Admin navigation is owner-only and includes primary-owner switchboard", () => {
  const memberSections = nav.getDashboardNavSections(false, {});
  assert.equal(memberSections.some((section) => section.label === "Possum Admin"), false);

  const ownerAdmin = nav.getDashboardNavSections(true, {}).find((section) => section.label === "Possum Admin");
  assert.ok(ownerAdmin);
  assert.deepEqual(ownerAdmin.items.map((item) => item.href), [
    "/dashboard/system-health",
    "/dashboard/operations",
    "/dashboard/master",
    "/dashboard/ai/openai-platform",
  ]);
  const primaryOwnerAdmin = nav.getDashboardNavSections(true, {}, true).find((section) => section.label === "Possum Admin");
  assert.ok(primaryOwnerAdmin.items.some((item) => item.href === "/dashboard/switchboard"));
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
