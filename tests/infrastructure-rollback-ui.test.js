"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const source = fs.readFileSync(
  path.join(__dirname, "../src/app/dashboard/infrastructure/InfrastructureClient.tsx"),
  "utf8",
);

test("setup restore uses the Bot rollback API and refuses resource deletion", () => {
  assert.match(source, /activePlan\.canCompensate/);
  assert.match(source, /action: "plan-rollback-preview"/);
  assert.match(source, /action: "plan-rollback"/);
  assert.match(source, /deletesResources !== false/);
  assert.match(source, /created by setup will be retained/);
  assert.doesNotMatch(source, /plan-compensation-preview|plan-compensate/);
});
