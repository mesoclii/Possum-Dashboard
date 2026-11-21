"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const ACTIONS = new Set([
  "dashboard-settings.restore",
  "feature-settings.restore",
  "infrastructure.undo",
  "pokemon.dashboard",
  "panel.repair",
]);
const HASH = /^[a-f0-9]{64}$/;
const ID = /^\d{16,20}$/;

function payloadHash(bytes) {
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

function signProof({ issuer, actor, guild, action, payload, now = Date.now() }, privateKey) {
  if (typeof actor !== "string" || typeof guild !== "string" ||
      !ID.test(actor) || !ID.test(guild) || !ACTIONS.has(action) || !Buffer.isBuffer(payload)) {
    throw new Error("Invalid authorization request");
  }
  const iat = Math.floor(now / 1000);
  const claims = {
    v: 1, iss: issuer, sub: actor, guild, action,
    hash: payloadHash(payload), iat, exp: iat + 120,
    jti: crypto.randomBytes(32).toString("hex"),
  };
  const body = Buffer.from(JSON.stringify(claims)).toString("base64url");
  const signature = crypto.sign(null, Buffer.from(body), privateKey).toString("base64url");
  return `${body}.${signature}`;
}

// consume must atomically record the jti in storage protected from untrusted peers.
function verifyProof(proof, expected, publicKey, consume, now = Date.now()) {
  if (typeof proof !== "string" || proof.length > 4096) throw new Error("Invalid authorization proof");
  const parts = proof.split(".");
  if (parts.length !== 2 || !parts.every((part) => /^[A-Za-z0-9_-]+$/.test(part))) throw new Error("Invalid authorization proof");
  const [body, signature] = parts;
  if (!crypto.verify(null, Buffer.from(body), publicKey, Buffer.from(signature, "base64url"))) throw new Error("Invalid authorization signature");
  let claims;
  try { claims = JSON.parse(Buffer.from(body, "base64url").toString("utf8")); }
  catch { throw new Error("Invalid authorization claims"); }
  const time = Math.floor(now / 1000);
  if (!claims || claims.v !== 1 || claims.iss !== expected.issuer ||
      claims.sub !== expected.actor || claims.guild !== expected.guild ||
      claims.action !== expected.action || !ACTIONS.has(claims.action) ||
      !ID.test(claims.sub) || !ID.test(claims.guild) ||
      !Buffer.isBuffer(expected.payload) || !HASH.test(claims.hash) ||
      claims.hash !== payloadHash(expected.payload) || !HASH.test(claims.jti) ||
      !Number.isSafeInteger(claims.iat) || !Number.isSafeInteger(claims.exp) ||
      claims.exp !== claims.iat + 120 || claims.iat > time || claims.exp <= time) {
    throw new Error("Authorization proof does not match the request or has expired");
  }
  if (consume(claims.jti, claims.exp) !== true) throw new Error("Authorization proof already used");
  return claims;
}

function createReplayStore(directory, fileSystem = fs, uid = process.getuid?.()) {
  if (!path.isAbsolute(directory) || !Number.isInteger(uid)) throw new Error("Private replay directory required");
  return (jti, exp) => {
    if (!HASH.test(jti) || !Number.isSafeInteger(exp)) throw new Error("Invalid replay record");
    let current = path.resolve(directory);
    let first = true;
    for (;;) {
      const info = fileSystem.lstatSync(current);
      if (!info.isDirectory() || (first ? info.uid !== uid : info.uid !== uid && info.uid !== 0) ||
          (info.mode & (first ? 0o077 : 0o022)) !== 0) throw new Error("Replay directory is not private");
      const parent = path.dirname(current);
      if (parent === current) break;
      current = parent;
      first = false;
    }
    let fd;
    try {
      fd = fileSystem.openSync(path.join(directory, jti), "wx", 0o600);
    } catch (error) {
      if (error?.code === "EEXIST") return false;
      throw error;
    }
    try {
      fileSystem.writeFileSync(fd, `${exp}\n`, "utf8");
      fileSystem.fsyncSync(fd);
    } finally {
      fileSystem.closeSync(fd);
    }
    const dirFd = fileSystem.openSync(directory, "r");
    try { fileSystem.fsyncSync(dirFd); }
    finally { fileSystem.closeSync(dirFd); }
    return true;
  };
}

function loadTrustedPublicKey(file, fileSystem = fs) {
  if (!path.isAbsolute(file)) throw new Error("Absolute public key path required");
  let current = path.resolve(file);
  let first = true;
  for (;;) {
    const info = fileSystem.lstatSync(current);
    if (info.uid !== 0 || (info.mode & 0o022) !== 0 ||
        (first ? !info.isFile() : !info.isDirectory())) {
      throw new Error("Public key path must be root-owned and not writable by untrusted users");
    }
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
    first = false;
  }
  const key = crypto.createPublicKey(fileSystem.readFileSync(file));
  if (key.asymmetricKeyType !== "ed25519") throw new Error("Ed25519 public key required");
  return key;
}

module.exports = { ACTIONS, signProof, verifyProof, createReplayStore, loadTrustedPublicKey };
