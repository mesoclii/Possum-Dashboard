"use strict";
// Copies the canonical engine catalog (docs/dashboard-engines.json, owned by the
// bot repo) into the dashboard, so the two can never disagree about which engines
// exist or which dashboard section they belong to.
const fs = require("fs");
const path = require("path");

const BOT_PACKAGE_NAME = "possum-bot";

// True when `directory` is a Possum Bot checkout (identified by its package name,
// not its folder name, so renaming or moving the checkout cannot break discovery).
function isBotCheckout(directory) {
  try {
    return JSON.parse(fs.readFileSync(path.join(directory, "package.json"), "utf8"))?.name === BOT_PACKAGE_NAME;
  } catch { return false; }
}

function catalogCandidates({ scriptDir = __dirname, env = process.env } = {}) {
  const enclosing = path.join(scriptDir, "..", "..");
  return [
    env.POSSUM_ENGINE_CATALOG,
    // Local development nests the Dashboard inside the Bot checkout it pairs with.
    isBotCheckout(enclosing) ? path.join(enclosing, "docs", "dashboard-engines.json") : "",
    // Production deployments place Possum-Bot beside Possum-Dashboard.
    path.join(scriptDir, "..", "..", "Possum-Bot", "docs", "dashboard-engines.json"),
    // Local checkouts may place the Bot beside the workspace containing the Dashboard.
    path.join(scriptDir, "..", "..", "..", "Possum-Bot", "docs", "dashboard-engines.json"),
    // Compatibility fallback for older combined workspaces. Keep it after Bot sources
    // so a stale workspace copy can never override the active Bot catalog.
    path.join(scriptDir, "..", "..", "docs", "dashboard-engines.json"),
  ].filter(Boolean);
}

function resolveCatalogSource(candidates = catalogCandidates()) {
  return candidates.find((candidate) => fs.existsSync(candidate)) || "";
}

function syncCatalog({ source = resolveCatalogSource(), target = path.join(__dirname, "..", "src", "data", "dashboard-engines.json"), log = console.log } = {}) {
  if (!source) {
    log("[sync-catalog] canonical catalog not found next to this checkout; leaving the copy as-is");
    return { updated: false, source: "" };
  }

  const next = fs.readFileSync(source, "utf8").replace(/\r\n/g, "\n");
  const current = fs.existsSync(target) ? fs.readFileSync(target, "utf8").replace(/\r\n/g, "\n") : "";
  if (current === next) {
    log("[sync-catalog] dashboard catalog already matches");
    return { updated: false, source };
  }

  // Refuse to publish a catalog that does not parse; a broken catalog breaks the dashboard.
  JSON.parse(next);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, next);
  log("[sync-catalog] dashboard catalog updated from", path.relative(process.cwd(), source));
  return { updated: true, source };
}

if (require.main === module) syncCatalog();

module.exports = { catalogCandidates, resolveCatalogSource, syncCatalog };
