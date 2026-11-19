"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");

const source = fs.readFileSync(path.join(__dirname, "../src/lib/dashboard/channelEntries.ts"), "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
const exportsObject = {};
vm.runInNewContext(compiled, { exports: exportsObject });
const { extractIdList, toggleChannelEntries } = exportsObject;

test("weighted spawn channels remain selected when read from setup", () => {
  const entries = [{ id: "123", weight: 5 }, "456"];
  assert.deepEqual(Array.from(extractIdList(entries)), ["123", "456"]);
  const result = Array.from(toggleChannelEntries(entries, "789"));
  assert.equal(result[0], entries[0]);
  assert.equal(result[0].weight, 5);
  assert.deepEqual(result.map((entry) => typeof entry === "string" ? entry : entry.id), ["123", "456", "789"]);
});

test("deselecting a channel preserves other weighted entries", () => {
  const retained = { id: "456", weight: 8 };
  const result = Array.from(toggleChannelEntries([{ id: "123", weight: 2 }, retained, null], "123"));
  assert.deepEqual(result, [retained, null]);
});
