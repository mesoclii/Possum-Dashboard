"use strict";
// Copies the canonical engine catalog (docs/dashboard-engines.json, owned by the
// bot repo) into the dashboard, so the two can never disagree about which engines
// exist or which dashboard section they belong to.
const fs = require("fs");
const path = require("path");

const target = path.join(__dirname, "..", "src", "data", "dashboard-engines.json");
const candidates = [
  process.env.POSSUM_ENGINE_CATALOG,
  path.join(__dirname, "..", "..", "docs", "dashboard-engines.json"),
  path.join(__dirname, "..", "..", "Possum-Bot", "docs", "dashboard-engines.json"),
].filter(Boolean);

const source = candidates.find((candidate) => fs.existsSync(candidate));
if (!source) {
  console.log("[sync-catalog] canonical catalog not found next to this checkout; leaving the copy as-is");
  process.exit(0);
}

const next = fs.readFileSync(source, "utf8").replace(/\r\n/g, "\n");
const current = fs.existsSync(target) ? fs.readFileSync(target, "utf8").replace(/\r\n/g, "\n") : "";
if (current === next) {
  console.log("[sync-catalog] dashboard catalog already matches");
  process.exit(0);
}

// Refuse to publish a catalog that does not parse; a broken catalog breaks the dashboard.
JSON.parse(next);
fs.mkdirSync(path.dirname(target), { recursive: true });
fs.writeFileSync(target, next);
console.log("[sync-catalog] dashboard catalog updated from", path.relative(process.cwd(), source));
