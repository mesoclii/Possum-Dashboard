"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");

const root = path.join(__dirname, "..");
function loadTypeScript(relative, aliases = {}) {
  const source = fs.readFileSync(path.join(root, relative), "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const loaded = { exports: {} };
  new Function("require", "module", "exports", compiled)(
    (name) => aliases[name] || require(name), loaded, loaded.exports,
  );
  return loaded.exports;
}

const lanes = loadTypeScript("src/lib/podcastVoiceLane.ts");
const Selector = loadTypeScript("src/components/possum/PodcastVoiceBotSelect.tsx", {
  "@/lib/podcastVoiceLane": lanes,
}).default;

test("personalizer choice reaches the same guild's studio without changing its default", () => {
  for (const { value } of lanes.podcastVoiceLanes) {
    const url = new URL(lanes.podcastStudioHref("123456789012345678", value), "https://example.test");
    assert.equal(url.pathname, "/dashboard/podcast");
    assert.equal(lanes.readPodcastVoiceLane(url.search, "123456789012345678"), value);
    assert.equal(lanes.readPodcastVoiceLane(url.search, "223456789012345678"), "main");
  }
  assert.equal(lanes.readPodcastVoiceLane("", "123456789012345678"), "main");
  assert.equal(lanes.readPodcastVoiceLane("?guildId=123456789012345678&voiceLane=invalid", "123456789012345678"), "");
});

test("shared selector displays every lane and rejects invalid changes", () => {
  const changes = [];
  const element = Selector({ value: "main", onChange: (value) => changes.push(value) });
  const select = element.props.children[1];
  select.props.onChange({ target: { value: "custom3" } });
  select.props.onChange({ target: { value: "invalid" } });
  assert.deepEqual(changes, ["custom3"]);
  const markup = renderToStaticMarkup(React.createElement(Selector, { value: "", onChange() {} }));
  assert.match(markup, /Choose a valid bot/);
  for (const { label } of lanes.podcastVoiceLanes) assert.ok(markup.includes(label));
});

test("personalizer links to studio and the local studio or redirect keeps the selection", () => {
  const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
  const personalizer = read("src/app/dashboard/bot-personalizer/BotPersonalizerClient.tsx");
  assert.match(personalizer, /PodcastVoiceBotSelect value=\{podcastLane\}/);
  assert.match(personalizer, /podcastStudioHref\(guildId, podcastLane\)/);
  assert.match(personalizer, /does not save a server-wide default or start recording/);
  assert.match(personalizer, /<section id="podcast-recording-bot"[^>]*>[\s\S]*?<PodcastVoiceBotSelect value=\{podcastLane\}/);
  assert.match(personalizer, /Voice: Podcast[\s\S]*?Chosen for each session, not saved as per-feature routing\.[\s\S]*?href="#podcast-recording-bot"/);
  const studioPath = "src/app/dashboard/podcast/PodcastControlClient.tsx";
  if (fs.existsSync(path.join(root, studioPath))) {
    const studio = read(studioPath);
    assert.match(studio, /readPodcastVoiceLane\(window\.location\.search, guildId\)/);
    assert.match(studio, /disabled=\{busy \|\| !control \|\| !voiceLane\}/);
    assert.match(studio, /action: "prepare", voiceLane/);
  } else {
    assert.match(read("src/app/dashboard/podcast/page.tsx"), /url\.searchParams\.append\(key, item\)/);
  }
});
