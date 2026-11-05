"use client";

export type GuildChannel = {
  id: string;
  name: string;
  type?: number | string;
  parentId?: string | null;
};

export type GuildRole = {
  id: string;
  name: string;
  position?: number;
  color?: string;
};

export type GuildDataPayload = {
  guild?: { id?: string; name?: string };
  channels?: GuildChannel[];
  roles?: GuildRole[];
};

const GUILD_DATA_TTL_MS = 120_000;
const RUNTIME_ENGINE_TTL_MS = 90_000;
const DASHBOARD_CONFIG_TTL_MS = 120_000;

type TimedCacheEntry<T> = {
  value: T;
  expiresAt: number;
};

const guildDataCache = new Map<string, TimedCacheEntry<GuildDataPayload>>();
const guildDataInflight = new Map<string, Promise<GuildDataPayload>>();
const runtimeEngineCache = new Map<string, TimedCacheEntry<any>>();
const runtimeEngineInflight = new Map<string, Promise<any>>();
const dashboardConfigCache = new Map<string, TimedCacheEntry<any>>();
const dashboardConfigInflight = new Map<string, Promise<any>>();

export async function readJsonOrThrow(res: Response) {
  let text = "";
  try {
    text = await res.text();
  } catch (error: any) {
    if (isAbortLikeError(error)) {
      throw new Error("Dashboard response stream was interrupted before it finished.");
    }
    throw error;
  }

  let json: any = {};
  if (text) {
    try {
      json = JSON.parse(text);
    } catch {
      throw new Error(text || `Request failed (${res.status})`);
    }
  }

  if (!res.ok || json?.success === false) {
    throw new Error(json?.error || `Request failed (${res.status})`);
  }
  return json;
}

function isAbortLikeError(error: unknown) {
  const message = String((error as any)?.message || "");
  return (error as any)?.name === "AbortError" || /aborted|timed out/i.test(message);
}

async function fetchJsonOrThrow(url: string, init: RequestInit = {}, timeoutMs = 30_000, retryCount = 2) {
  let attempt = 0;
  while (true) {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        ...init,
        cache: init.cache ?? "no-store",
        signal: controller.signal,
      });
      return await readJsonOrThrow(res);
    } catch (error: any) {
      if (attempt < retryCount && isAbortLikeError(error)) {
        attempt += 1;
        continue;
      }
      if (isAbortLikeError(error)) {
        throw new Error(`Dashboard request timed out after ${timeoutMs}ms.`);
      }
      throw error;
    } finally {
      window.clearTimeout(timeout);
    }
  }
}

export function resolveGuildContext() {
  if (typeof window === "undefined") {
    return { guildId: "", guildName: "", userId: "" };
  }

  const params = new URLSearchParams(window.location.search);
  const guildId = (params.get("guildId") || localStorage.getItem("activeGuildId") || "").trim();
  const guildName = (localStorage.getItem("activeGuildName") || guildId).trim();
  const userId = (params.get("userId") || params.get("uid") || localStorage.getItem("dashboardUserId") || "").trim();

  if (guildId) {
    localStorage.setItem("activeGuildId", guildId);
  }
  if (userId) {
    localStorage.setItem("dashboardUserId", userId);
  }

  return { guildId, guildName, userId };
}

function resolveViewerUserId(explicitUserId = "") {
  const direct = String(explicitUserId || "").trim();
  if (direct) return direct;
  return resolveGuildContext().userId;
}

function resolveRoutePath() {
  if (typeof window === "undefined") return "/dashboard";
  return String(window.location.pathname || "/dashboard").trim() || "/dashboard";
}

export function peekGuildData(guildId: string, explicitUserId = "") {
  const userId = resolveViewerUserId(explicitUserId);
  const cacheKey = `${String(guildId || "").trim()}:${userId}`;
  return guildDataCache.get(cacheKey)?.value || null;
}

export function peekRuntimeEngine(guildId: string, engine: string, userId = "") {
  const actorUserId = resolveViewerUserId(userId);
  const routePath = resolveRoutePath();
  const cacheKey = `${String(guildId || "").trim()}:${String(engine || "").trim()}:${actorUserId}:${routePath}`;
  return runtimeEngineCache.get(cacheKey)?.value || null;
}

export async function fetchGuildData(guildId: string, explicitUserId = "") {
  const userId = resolveViewerUserId(explicitUserId);
  const cacheKey = `${String(guildId || "").trim()}:${userId}`;
  const cached = guildDataCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.value;
  }
  const inflight = guildDataInflight.get(cacheKey);
  if (inflight) return inflight;

  const request = (async () => {
    try {
      const json = await fetchJsonOrThrow(
        `/api/bot/guild-data?guildId=${encodeURIComponent(guildId)}${userId ? `&userId=${encodeURIComponent(userId)}` : ""}`
      );
      const roles = Array.isArray(json?.roles) ? json.roles : [];
      roles.sort((a: GuildRole, b: GuildRole) => (Number(b.position || 0) - Number(a.position || 0)) || a.name.localeCompare(b.name));
      const value = {
        guild: json?.guild || null,
        channels: Array.isArray(json?.channels) ? json.channels : [],
        roles,
        botUser: json?.botUser || null,
      } as GuildDataPayload & { botUser?: unknown };
      guildDataCache.set(cacheKey, { value, expiresAt: Date.now() + GUILD_DATA_TTL_MS });
      guildDataInflight.delete(cacheKey);
      return value;
    } catch (error) {
      const stale = guildDataCache.get(cacheKey);
      if (stale?.value) {
        guildDataInflight.delete(cacheKey);
        return stale.value;
      }
      throw error;
    }
  })().catch((error) => {
    guildDataInflight.delete(cacheKey);
    throw error;
  });

  guildDataInflight.set(cacheKey, request);
  return request;
}

export function invalidateRuntimeEngines(guildId: string, engines: string[]) {
  for (const engine of engines) {
    const cachePrefix = `${String(guildId || "").trim()}:${String(engine || "").trim()}:`;
    for (const key of runtimeEngineCache.keys()) {
      if (key.startsWith(cachePrefix)) runtimeEngineCache.delete(key);
    }
  }
}

export async function fetchRuntimeEngine(guildId: string, engine: string, userId = "") {
  const actorUserId = resolveViewerUserId(userId);
  const routePath = resolveRoutePath();
  const cacheKey = `${String(guildId || "").trim()}:${String(engine || "").trim()}:${actorUserId}:${routePath}`;
  const cached = runtimeEngineCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.value;
  }
  const inflight = runtimeEngineInflight.get(cacheKey);
  if (inflight) return inflight;

  const request = (async () => {
    try {
      const json = await fetchJsonOrThrow(
        `/api/runtime/engine?guildId=${encodeURIComponent(guildId)}&engine=${encodeURIComponent(engine)}${actorUserId ? `&userId=${encodeURIComponent(actorUserId)}` : ""}&routePath=${encodeURIComponent(routePath)}`
      );
      runtimeEngineCache.set(cacheKey, { value: json, expiresAt: Date.now() + RUNTIME_ENGINE_TTL_MS });
      runtimeEngineInflight.delete(cacheKey);
      return json;
    } catch (error) {
      const stale = runtimeEngineCache.get(cacheKey);
      if (stale?.value) {
        runtimeEngineInflight.delete(cacheKey);
        return stale.value;
      }
      throw error;
    }
  })().catch((error) => {
    runtimeEngineInflight.delete(cacheKey);
    throw error;
  });

  runtimeEngineInflight.set(cacheKey, request);
  return request;
}

export async function saveRuntimeEngine(guildId: string, engine: string, patch: Record<string, unknown>, userId = "") {
  const actorUserId = resolveViewerUserId(userId);
  const routePath = resolveRoutePath();
  const json = await fetchJsonOrThrow("/api/runtime/engine", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ guildId, engine, patch, userId: actorUserId, routePath }),
  });
  const cachePrefix = `${String(guildId || "").trim()}:${String(engine || "").trim()}:`;
  for (const key of runtimeEngineCache.keys()) {
    if (key.startsWith(cachePrefix)) {
      runtimeEngineCache.delete(key);
    }
  }
  return json;
}

export async function validateRuntimeEngine(guildId: string, engine: string, patch: Record<string, unknown>) {
  const actorUserId = resolveViewerUserId();
  return await fetchJsonOrThrow("/api/runtime/engine-validate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ guildId, engine, patch, userId: actorUserId }),
  });
}

export async function runRuntimeEngineAction(guildId: string, engine: string, action: string, payload?: Record<string, unknown>, userId = "") {
  const actorUserId = resolveViewerUserId(userId);
  const routePath = resolveRoutePath();
  const json = await fetchJsonOrThrow("/api/runtime/engine-action", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ guildId, engine, action, payload, userId: actorUserId, routePath }),
  });
  const cachePrefix = `${String(guildId || "").trim()}:${String(engine || "").trim()}:`;
  for (const key of runtimeEngineCache.keys()) {
    if (key.startsWith(cachePrefix)) {
      runtimeEngineCache.delete(key);
    }
  }
  return json;
}

export async function fetchDashboardConfig(guildId: string) {
  const userId = resolveViewerUserId();
  const cacheKey = `${String(guildId || "").trim()}:${userId}`;
  const cached = dashboardConfigCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.value;
  }
  const inflight = dashboardConfigInflight.get(cacheKey);
  if (inflight) return inflight;

  const request = (async () => {
    const json = await fetchJsonOrThrow(
      `/api/bot/dashboard-config?guildId=${encodeURIComponent(guildId)}${userId ? `&userId=${encodeURIComponent(userId)}` : ""}`
    );
    const value = json?.config || {};
    dashboardConfigCache.set(cacheKey, { value, expiresAt: Date.now() + DASHBOARD_CONFIG_TTL_MS });
    dashboardConfigInflight.delete(cacheKey);
    return value;
  })().catch((error) => {
    dashboardConfigInflight.delete(cacheKey);
    throw error;
  });

  dashboardConfigInflight.set(cacheKey, request);
  return request;
}

export async function saveDashboardConfig(guildId: string, patch: Record<string, unknown>) {
  const userId = resolveViewerUserId();
  const json = await fetchJsonOrThrow("/api/bot/dashboard-config", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ guildId, patch, userId }),
  });
  for (const key of dashboardConfigCache.keys()) {
    if (key.startsWith(`${String(guildId || "").trim()}:`)) {
      dashboardConfigCache.delete(key);
    }
  }
  return json;
}
