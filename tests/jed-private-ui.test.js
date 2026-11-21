"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");

function load(file, mocks = {}) {
  const filename = path.join(__dirname, "..", "src", ...file.split("/"));
  const code = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const module = { exports: {} };
  new Function("require", "module", "exports", code)((name) => Object.hasOwn(mocks, name) ? mocks[name] : require(name), module, module.exports);
  return module.exports;
}

const { createJedPrivateClient } = load("lib/jedPrivateClient.ts");
const id = "550e8400-e29b-41d4-a716-446655440000";
const digest = "a".repeat(64);

test("disabled status blocks all operations without uploading or asking for tokens", async () => {
  const requests = [];
  const client = createJedPrivateClient(async (url, init) => {
    requests.push({ url, init });
    return new Response(JSON.stringify({ available: false }), { status: 503 });
  });
  assert.equal(await client.checkAvailable(), false);
  await assert.rejects(client.list(), /unavailable/);
  await assert.rejects(client.upload({ size: 20 }, true, true, "I created this media"), /unavailable/);
  assert.equal(requests.length, 1);
  assert.equal(requests[0].url, "/api/jed-private/status");
  assert.equal(requests[0].init.credentials, "same-origin");
  assert.equal(requests[0].init.headers, undefined);
});

test("client requires consent, carries review digest and uses only same-origin paths", async () => {
  const calls = [];
  const client = createJedPrivateClient(async (url, init) => {
    calls.push({ url, init });
    if (url.endsWith("/status")) return Response.json({ available: true });
    if (url.endsWith("/review") && !init.method) return Response.json({
      rightsStatement: "I created this media", status: "pending", mime: "image/gif", digest, imageBase64: "R0lGODlh",
    });
    return Response.json({ id, items: [], ok: true });
  });
  assert.equal(await client.checkAvailable(), true);
  await assert.rejects(client.upload({ size: 10 }, false, true, "I created this media"), /consent/);
  await assert.rejects(client.upload({ size: 2 * 1024 * 1024 + 1 }, true, true, "I created this media"), /2 MiB/);
  await assert.rejects(client.share(id, "100000000000000002", false), /consent/);
  await assert.rejects(client.review(id, "approve", digest, false), /Confirm/);
  await client.upload({ size: 10 }, true, true, "I created this media");
  const preview = await client.preview(id);
  await client.review(id, "approve", preview.digest, true);
  await client.share(id, "100000000000000002", true);
  await client.revoke(id, "100000000000000002");
  await client.remove(id);
  assert.ok(calls.every(({ url, init }) => url.startsWith("/api/jed-private/") && init.credentials === "same-origin"));
  const review = calls.find(({ url, init }) => url.endsWith("/review") && init.method === "POST");
  assert.deepEqual(JSON.parse(review.init.body), { decision: "approve", confirmation: true, digest });
  const upload = calls.find(({ url, init }) => url.endsWith("/media") && init.method === "POST");
  assert.equal(upload.init.headers["x-jed-review"], "yes");
  assert.equal(upload.init.headers["x-jed-rights"], "yes");
});

test("page exposes review, upload and share controls disabled before readiness", () => {
  const page = load("app/dashboard/jed/private-media/page.tsx", { "@/lib/jedPrivateClient": { createJedPrivateClient } });
  const html = renderToStaticMarkup(React.createElement(page.default));
  assert.match(html, /<fieldset disabled=""/);
  assert.match(html, /Upload for private review/);
  assert.match(html, /Reviewer queue/);
  assert.match(html, /Recipient Discord user ID|media shared with you/);
});

test("dashboard proxy stays unavailable for every method", async () => {
  const route = load("app/api/jed-private/[...path]/route.ts", {
    "next/server": { NextResponse: { json: (body, options) => ({ body, ...options }) } },
  });
  for (const method of ["GET", "POST", "DELETE"]) {
    const response = route[method]();
    assert.equal(response.status, 503);
    assert.equal(response.body.available, false);
    assert.equal(response.headers["Cache-Control"], "private, no-store");
  }
});
