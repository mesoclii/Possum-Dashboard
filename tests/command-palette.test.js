"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");

function load(relative, aliases = {}) {
  const source = fs.readFileSync(path.join(__dirname, "..", relative), "utf8");
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  const module = { exports: {} };
  new Function("require", "module", "exports", compiled)((name) => aliases[name] || require(name), module, module.exports);
  return module.exports;
}

const palette = load("src/lib/dashboard/commandPalette.ts", {
  "@/lib/dashboard/navigation": {},
});

test("command palette searches only the supplied role-filtered routes and ranks label matches", () => {
  const entries = palette.createDashboardCommandEntries(
    [{ href: "/dashboard/system-health", label: "System Health" }],
    [{ label: "Security", items: [
      { href: "/dashboard/security/audit-trail", label: "Audit Trail" },
      { href: "/dashboard/master", label: "Master Control", creatorOnly: true },
    ] }]
  );
  assert.deepEqual(palette.searchDashboardCommands(entries, "audit").map((entry) => entry.href), ["/dashboard/security/audit-trail"]);
  assert.deepEqual(palette.searchDashboardCommands(entries, "system").map((entry) => entry.href), ["/dashboard/system-health"]);
});

test("duplicate navigation routes appear once and retain their alternate labels for search", () => {
  const entries = palette.createDashboardCommandEntries(
    [{ href: "/dashboard/motd", label: "Message of the Day" }],
    [{ label: "Socials", items: [{ href: "/dashboard/motd", label: "Server Message of the Day" }] }]
  );
  assert.equal(entries.length, 1);
  assert.equal(entries[0].aliases.includes("Server Message of the Day"), true);
  assert.equal(palette.searchDashboardCommands(entries, "server message").length, 1);
});

test("command palette search ignores repeated whitespace and letter case", () => {
  const entries = palette.createDashboardCommandEntries([], [
    { label: "Socials", items: [{ href: "/tcg", label: "Possum Underworld TCG" }] },
  ]);
  assert.deepEqual(palette.searchDashboardCommands(entries, "  UNDERWORLD   tcg ").map((entry) => entry.href), ["/tcg"]);
});
