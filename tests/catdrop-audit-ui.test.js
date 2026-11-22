"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.join(__dirname, "..");
const moderatorClient = fs.readFileSync(
  path.join(root, "src", "app", "dashboard", "moderator", "ModeratorClient.tsx"),
  "utf8",
);
const catdropPage = fs.readFileSync(
  path.join(root, "src", "app", "dashboard", "catdrop", "page.tsx"),
  "utf8",
);

test("cat-drop audit destination is available from the moderator audit logging panel", () => {
  assert.match(moderatorClient, /\{ engine: "catdrop", path: "logChannelId", label: "Cat drops" \}/);
  assert.match(catdropPage, /value=\{cfg\.logChannelId \|\| ""\}/);
  assert.match(catdropPage, /Use moderator log channel/);
});
