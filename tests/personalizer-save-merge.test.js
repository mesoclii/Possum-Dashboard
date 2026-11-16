"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { mergePersonalizerSave } = require("../src/lib/personalizerSaveMerge");

test("save response keeps new image and credentials entered while saving", () => {
  const before = { avatar: "old", token: "submitted", library: ["old"], name: "before" };
  const current = { ...before, avatar: "new", token: "new-token", library: ["old", "new"] };
  const saved = { avatar: "old", token: "", library: ["old"], name: "normalized" };
  assert.deepEqual(mergePersonalizerSave(before, current, saved), {
    avatar: "new", token: "new-token", library: ["old", "new"], name: "normalized",
  });
});
