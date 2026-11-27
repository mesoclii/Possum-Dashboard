"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { catalogCandidates, resolveCatalogSource } = require("../scripts/sync-catalog");

test("catalog sync prefers the Bot repo over a stale workspace copy", (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "possum-catalog-source-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const scriptDir = path.join(root, "Possum-Infra-Sync", "Possum-Dashboard", "scripts");
  const activeBotCatalog = path.join(root, "Negan Bot", "docs", "dashboard-engines.json");
  const staleBotCatalog = path.join(root, "Possum-Infra-Sync", "Possum-Bot", "docs", "dashboard-engines.json");
  const staleCatalog = path.join(root, "Possum-Infra-Sync", "docs", "dashboard-engines.json");
  fs.mkdirSync(path.dirname(activeBotCatalog), { recursive: true });
  fs.mkdirSync(path.dirname(staleBotCatalog), { recursive: true });
  fs.mkdirSync(path.dirname(staleCatalog), { recursive: true });
  fs.writeFileSync(activeBotCatalog, "{}");
  fs.writeFileSync(staleBotCatalog, "{}");
  fs.writeFileSync(staleCatalog, "{}");

  const candidates = catalogCandidates({ scriptDir, env: {} });
  assert.equal(resolveCatalogSource(candidates), activeBotCatalog);
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
