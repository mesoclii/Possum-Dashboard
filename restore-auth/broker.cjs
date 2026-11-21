"use strict";

const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { ACTIONS, signProof } = require("./proof.cjs");

const COOKIE = "__Host-restore_session";
const STATE_COOKIE = "__Host-restore_state";
const ID = /^\d{16,20}$/;

function cookie(req, name) {
  const found = String(req.headers.cookie || "").split(";").map((x) => x.trim())
    .filter((x) => x.startsWith(`${name}=`));
  return found.length === 1 ? found[0].slice(name.length + 1) : "";
}

function createBroker({ origin, clientId, clientSecret, privateKey, discordFetch = fetch, now = Date.now }) {
  const url = new URL(origin);
  if (url.protocol !== "https:" || url.origin !== origin || !clientId || !clientSecret ||
      crypto.createPrivateKey(privateKey).asymmetricKeyType !== "ed25519") throw new Error("Invalid broker configuration");
  const callback = `${origin}/oauth/callback`;
  const states = new Map();
  const sessions = new Map();
  const id = () => crypto.randomBytes(32).toString("base64url");
  const prune = () => {
    for (const [k, v] of states) if (v.expires <= now()) states.delete(k);
    for (const [k, v] of sessions) if (v.expires <= now()) sessions.delete(k);
  };
  const discord = async (endpoint, options) => {
    const response = await discordFetch(`https://discord.com/api${endpoint}`, {
      ...options, signal: AbortSignal.timeout(10000), cache: "no-store",
    });
    if (!response.ok) throw new Error("Discord verification failed");
    return response.json();
  };
  const setCookie = (name, value, maxAge) =>
    `${name}=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;
  const headers = {
    "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY", "Referrer-Policy": "no-referrer",
    "Content-Security-Policy": "default-src 'none'; script-src 'self'; connect-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'",
  };
  function send(res, status, body, type = "application/json; charset=utf-8", extra = {}) {
    res.writeHead(status, { ...headers, "Content-Type": type, ...extra });
    res.end(type.startsWith("application/json") ? JSON.stringify(body) : body);
  }
  async function handler(req, res) {
    prune();
    if (String(req.headers.host || "").toLowerCase() !== url.host.toLowerCase()) return send(res, 400, { error: "Invalid host" });
    const requestUrl = new URL(req.url, origin);
    if (req.method === "GET" && requestUrl.pathname === "/login") {
      if (states.size >= 10000) return send(res, 503, { error: "Login capacity reached" });
      const state = id();
      states.set(state, { expires: now() + 300000 });
      const params = new URLSearchParams({ client_id: clientId, redirect_uri: callback, response_type: "code", scope: "identify guilds", state });
      res.writeHead(302, { ...headers, Location: `https://discord.com/oauth2/authorize?${params}`, "Set-Cookie": setCookie(STATE_COOKIE, state, 300) });
      return res.end();
    }
    if (req.method === "GET" && requestUrl.pathname === "/oauth/callback") {
      const state = requestUrl.searchParams.get("state") || "";
      const code = requestUrl.searchParams.get("code") || "";
      const entry = states.get(state);
      if (!entry || entry.expires <= now() || cookie(req, STATE_COOKIE) !== state || !code) return send(res, 400, { error: "Invalid login state" });
      states.delete(state);
      const form = new URLSearchParams({ client_id: clientId, client_secret: clientSecret, grant_type: "authorization_code", code, redirect_uri: callback });
      const token = await discord("/oauth2/token", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: form });
      if (!token.access_token || !Number.isFinite(token.expires_in) || token.expires_in <= 0) throw new Error("Invalid Discord token");
      const user = await discord("/users/@me", { headers: { authorization: `Bearer ${token.access_token}` } });
      if (!ID.test(String(user.id || ""))) throw new Error("Invalid Discord account");
      if (sessions.size >= 10000) return send(res, 503, { error: "Session capacity reached" });
      const session = id();
      sessions.set(session, { actor: user.id, accessToken: token.access_token, expires: now() + Math.min(token.expires_in * 1000, 900000) });
      res.writeHead(303, { ...headers, Location: "/", "Set-Cookie": [setCookie(COOKIE, session, 900), setCookie(STATE_COOKIE, "", 0)] });
      return res.end();
    }
    if (req.method === "GET" && requestUrl.pathname === "/") {
      return send(res, 200, PAGE, "text/html; charset=utf-8");
    }
    if (req.method === "GET" && requestUrl.pathname === "/app.js") {
      return send(res, 200, SCRIPT, "application/javascript; charset=utf-8");
    }
    if (req.method === "POST" && requestUrl.pathname === "/grant") {
      if (req.headers.origin !== origin || !/^application\/json(?:\s*;|$)/i.test(String(req.headers["content-type"] || ""))) {
        return send(res, 403, { error: "Same-origin JSON required" });
      }
      const session = sessions.get(cookie(req, COOKIE));
      if (!session || session.expires <= now()) return send(res, 401, { error: "Sign in again" });
      let size = 0;
      const chunks = [];
      for await (const chunk of req) {
        size += chunk.length;
        if (size > 524288) return send(res, 413, { error: "Request too large" });
        chunks.push(chunk);
      }
      let input;
      try { input = JSON.parse(Buffer.concat(chunks).toString("utf8")); }
      catch { return send(res, 400, { error: "Invalid request" }); }
      if (!input || !ID.test(input.guild) || !ACTIONS.has(input.action) ||
          typeof input.payload !== "string" || !input.payload || Buffer.byteLength(input.payload) > 400000) {
        return send(res, 400, { error: "Invalid guild, action or payload" });
      }
      try { JSON.parse(input.payload); } catch { return send(res, 400, { error: "Payload must be JSON" }); }
      const auth = { headers: { authorization: `Bearer ${session.accessToken}` } };
      const user = await discord("/users/@me", auth);
      if (user.id !== session.actor) return send(res, 401, { error: "Discord identity changed" });
      const guilds = await discord("/users/@me/guilds?limit=200", auth);
      if (!Array.isArray(guilds)) throw new Error("Invalid Discord guild response");
      const member = guilds.find((g) => g && g.id === input.guild);
      let admin = member?.owner === true;
      const permissions = member?.permissions_new || member?.permissions || "0";
      try { admin = admin || (typeof permissions === "string" && /^\d+$/.test(permissions) && (BigInt(permissions) & 8n) === 8n); }
      catch { /* Invalid permissions do not grant access. */ }
      if (!admin) return send(res, 403, { error: "Discord guild owner or administrator required" });
      const proof = signProof({ issuer: origin, actor: session.actor, guild: input.guild, action: input.action, payload: Buffer.from(input.payload, "utf8"), now: now() }, privateKey);
      return send(res, 200, { proof, actor: session.actor, expiresInSeconds: 120 });
    }
    return send(res, 404, { error: "Not found" });
  }
  return (req, res) => {
    handler(req, res).catch(() => {
      if (!res.headersSent) send(res, 503, { error: "Authorization service unavailable" });
      else res.destroy();
    });
  };
}

const PAGE = `<!doctype html><html lang="en"><meta charset="utf-8"><title>Restore authorization</title>
<h1>Restore authorization</h1><p>This separate service signs only the exact JSON shown below. Review it before authorizing. The proof expires in two minutes and must be used once. Sign in with the Discord account administering the selected guild.</p>
<a href="/login">Sign in with Discord</a><form id="grant"><p><label>Guild ID <input name="guild" required pattern="[0-9]{16,20}"></label></p>
<p><label>Action <select name="action"><option value="dashboard-settings.restore">Dashboard settings</option><option value="feature-settings.restore">Feature settings</option><option value="infrastructure.undo">Undo Setup</option><option value="pokemon.dashboard">Pokémon dashboard</option><option value="panel.repair">Panel repair</option></select></label></p>
<p><label>Exact restore request JSON<br><textarea name="payload" rows="20" cols="90" required></textarea></label></p>
<button type="submit">Authorize this exact request</button></form><pre id="result"></pre><script src="/app.js"></script></html>`;
const SCRIPT = `"use strict";document.getElementById("grant").addEventListener("submit",async e=>{e.preventDefault();const f=new FormData(e.target);const r=await fetch("/grant",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(Object.fromEntries(f))});document.getElementById("result").textContent=JSON.stringify(await r.json(),null,2);});`;

if (require.main === module) {
  const credentialDir = process.env.CREDENTIALS_DIRECTORY;
  if (!credentialDir) throw new Error("systemd credentials are required");
  const clientSecret = fs.readFileSync(path.join(credentialDir, "discord-client-secret"), "utf8").trim();
  const privateKey = fs.readFileSync(path.join(credentialDir, "signing-key"));
  const socket = process.env.RESTORE_AUTH_SOCKET;
  if (!socket || !path.isAbsolute(socket)) throw new Error("Absolute socket path required");
  const handler = createBroker({ origin: process.env.RESTORE_AUTH_ORIGIN, clientId: process.env.DISCORD_CLIENT_ID, clientSecret, privateKey });
  const server = http.createServer(handler);
  server.listen(socket, () => fs.chmodSync(socket, 0o660));
}

module.exports = { createBroker };
