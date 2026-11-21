"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const { Readable } = require("node:stream");
const { createBroker } = require("./broker.cjs");
const { signProof, verifyProof, createReplayStore, loadTrustedPublicKey } = require("./proof.cjs");

const fs = require("node:fs");
for (const name of ["openSync", "writeFileSync", "appendFileSync", "mkdirSync", "renameSync", "unlinkSync", "rmSync"]) {
  fs[name] = () => { throw new Error(`Unexpected filesystem mutation: ${name}`); };
}
const childProcess = require("node:child_process");
for (const name of ["spawn", "spawnSync", "exec", "execSync", "execFile", "execFileSync", "fork"]) {
  childProcess[name] = () => { throw new Error(`Unexpected child process: ${name}`); };
}

async function main() {
  const { privateKey, publicKey } = crypto.generateKeyPairSync("ed25519");
  const pem = privateKey.export({ type: "pkcs8", format: "pem" });
  const origin = "https://restore.example.test";
  const guild = "111111111111111111";
  const actor = "222222222222222222";
  const payload = Buffer.from('{"guildId":"111111111111111111","mode":"replace"}');
  let timestamp = 2000000000000;
  const consumed = new Set();
  const consume = (id) => !consumed.has(id) && Boolean(consumed.add(id));
  const expected = { issuer: origin, actor, guild, action: "dashboard-settings.restore", payload };
  const proof = signProof({ ...expected, now: timestamp }, pem);
  assert.throws(() => verifyProof(proof, { ...expected, payload: Buffer.from("{}") }, publicKey, consume, timestamp));
  assert.throws(() => verifyProof(proof, { ...expected, guild: actor }, publicKey, consume, timestamp));
  assert.throws(() => verifyProof(proof, { ...expected, action: "feature-settings.restore" }, publicKey, consume, timestamp));
  assert.throws(() => verifyProof(proof, expected, publicKey, consume, timestamp + 120000));
  assert.throws(() => verifyProof(`${proof.slice(0, -1)}!`, expected, publicKey, consume, timestamp));
  assert.equal(verifyProof(proof, expected, publicKey, consume, timestamp).sub, actor);
  assert.throws(() => verifyProof(proof, expected, publicKey, consume, timestamp), /already used/);
  const records = new Set();
  const files = {
    lstatSync: () => ({ uid: 123, mode: 0o700, isDirectory: () => true }),
    openSync(file, mode) {
      if (mode === "r") return 2;
      if (records.has(file)) { const error = Error("exists"); error.code = "EEXIST"; throw error; }
      records.add(file); return 1;
    },
    writeFileSync() {}, fsyncSync() {}, closeSync() {},
  };
  const store = createReplayStore(require("node:path").resolve("isolated-replay"), files, 123);
  const replayProof = signProof({ ...expected, now: timestamp }, pem);
  verifyProof(replayProof, expected, publicKey, store, timestamp);
  assert.throws(() => verifyProof(replayProof, expected, publicKey, store, timestamp), /already used/);
  files.lstatSync = () => ({ uid: 123, mode: 0o755, isDirectory: () => true });
  assert.throws(() => store("a".repeat(64), 100), /not private/);
  const keyPath = require("node:path").resolve("isolated-public-key");
  const trustedFiles = {
    lstatSync: (file) => ({ uid: 0, mode: 0o755, isFile: () => file === keyPath, isDirectory: () => file !== keyPath }),
    readFileSync: () => publicKey.export({ type: "spki", format: "pem" }),
  };
  assert.equal(loadTrustedPublicKey(keyPath, trustedFiles).asymmetricKeyType, "ed25519");
  trustedFiles.lstatSync = () => ({ uid: 123, mode: 0o777, isFile: () => true, isDirectory: () => true });
  assert.throws(() => loadTrustedPublicKey(keyPath, trustedFiles), /root-owned/);

  let user = { id: actor };
  let guilds = [{ id: guild, permissions: "8" }];
  const discordFetch = async (url) => {
    const body = url.endsWith("/oauth2/token") ? { access_token: "mock", expires_in: 600 }
      : url.endsWith("/users/@me") ? user : guilds;
    return { ok: true, json: async () => body };
  };
  const handler = createBroker({ origin, clientId: "123", clientSecret: "mock-secret", privateKey: pem, discordFetch, now: () => timestamp });
  async function request(method, url, headers = {}, body = "") {
    const req = Readable.from(body ? [Buffer.from(body)] : []);
    Object.assign(req, { method, url, headers: { host: "restore.example.test", ...headers } });
    return new Promise((resolve) => {
      const res = {
        headersSent: false,
        writeHead(status, headers) { this.status = status; this.headers = headers; this.headersSent = true; },
        end(body = "") { resolve({ status: this.status, headers: this.headers, body: body && this.headers["Content-Type"]?.startsWith("application/json") ? JSON.parse(body) : body }); },
        destroy() { throw new Error("response destroyed"); },
      };
      handler(req, res);
    });
  }
  const login = await request("GET", "/login");
  assert.equal(login.status, 302);
  const state = new URL(login.headers.Location).searchParams.get("state");
  assert.equal((await request("GET", `/oauth/callback?state=${state}&code=x`)).status, 400);
  const callback = await request("GET", `/oauth/callback?state=${state}&code=x`, { cookie: `__Host-restore_state=${state}` });
  assert.equal(callback.status, 303);
  const session = callback.headers["Set-Cookie"][0].split(";")[0];
  assert.equal((await request("GET", `/oauth/callback?state=${state}&code=x`, { cookie: `__Host-restore_state=${state}` })).status, 400);
  const body = JSON.stringify({ guild, action: "dashboard-settings.restore", payload: payload.toString() });
  const headers = { origin, "content-type": "application/json", cookie: session };
  assert.equal((await request("POST", "/grant", { ...headers, origin: "https://dashboard.example.test" }, body)).status, 403);
  assert.equal((await request("POST", "/grant", { ...headers, cookie: "" }, body)).status, 401);
  guilds = [{ id: guild, permissions: "32" }];
  assert.equal((await request("POST", "/grant", headers, body)).status, 403);
  guilds = [{ id: guild, permissions: "-1" }];
  assert.equal((await request("POST", "/grant", headers, body)).status, 403);
  guilds = [{ id: actor, owner: true }];
  assert.equal((await request("POST", "/grant", headers, body)).status, 403);
  guilds = [{ id: guild, owner: true }];
  user = { id: guild };
  assert.equal((await request("POST", "/grant", headers, body)).status, 401);
  user = { id: actor };
  const grant = await request("POST", "/grant", headers, body);
  assert.equal(grant.status, 200);
  assert.equal(verifyProof(grant.body.proof, expected, publicKey, () => true, timestamp).guild, guild);
  timestamp += 901000;
  assert.equal((await request("POST", "/grant", headers, body)).status, 401);
  console.log("restore authorization isolated tests passed");
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
