"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { catalogCandidates, resolveCatalogSource } = require("../scripts/sync-catalog");

function writeCatalog(file) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, "{}");
}

test("a Dashboard nested in a Bot checkout uses that Bot's catalog, whatever the folder is called", (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "possum-catalog-nested-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const bot = path.join(root, "Any Folder Name");
  fs.mkdirSync(bot, { recursive: true });
  fs.writeFileSync(path.join(bot, "package.json"), JSON.stringify({ name: "possum-bot" }));
  const botCatalog = path.join(bot, "docs", "dashboard-engines.json");
  writeCatalog(botCatalog);
  // A sibling Bot copy must not win over the enclosing one.
  writeCatalog(path.join(bot, "Possum-Bot", "docs", "dashboard-engines.json"));

  const candidates = catalogCandidates({ scriptDir: path.join(bot, "negan-dashboard", "scripts"), env: {} });
  assert.equal(resolveCatalogSource(candidates), botCatalog);
});

test("a Dashboard beside Possum-Bot prefers it over a stale combined-workspace copy", (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "possum-catalog-source-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const scriptDir = path.join(root, "apps", "Possum-Dashboard", "scripts");
  const siblingBotCatalog = path.join(root, "apps", "Possum-Bot", "docs", "dashboard-engines.json");
  writeCatalog(siblingBotCatalog);
  writeCatalog(path.join(root, "apps", "docs", "dashboard-engines.json"));
  // An unrelated checkout elsewhere (such as an old desktop folder) is never consulted.
  writeCatalog(path.join(root, "Negan Bot", "docs", "dashboard-engines.json"));

  const candidates = catalogCandidates({ scriptDir, env: {} });
  assert.equal(resolveCatalogSource(candidates), siblingBotCatalog);
  assert.equal(candidates.some((candidate) => candidate.includes("Negan Bot")), false);
});

test("an explicit catalog path overrides discovered repositories", (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "possum-catalog-override-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const override = path.join(root, "canonical.json");
  const fallback = path.join(root, "workspace", "docs", "dashboard-engines.json");
  fs.mkdirSync(path.dirname(fallback), { recursive: true });
  fs.writeFileSync(override, "{}");
  fs.writeFileSync(fallback, "{}");

  const candidates = catalogCandidates({ scriptDir: path.join(root, "workspace", "Dashboard", "scripts"), env: { POSSUM_ENGINE_CATALOG: override } });
  assert.equal(resolveCatalogSource(candidates), override);
});
