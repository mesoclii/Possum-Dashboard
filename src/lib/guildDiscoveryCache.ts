import prisma from "@/lib/prisma";
import {
  deleteRedisKey,
  publishDashboardEvent,
  readRedisJson,
  subscribeDashboardEvent,
  writeRedisJson,
} from "@/lib/dashboardRedis";

const memoryCache = new Map<string, { expiresAt: number; payload: any }>();
const INVALIDATE_CHANNEL = "possum.guild.invalidate";

type CacheKind = "discord_admin_guilds" | "discord_user_guilds" | "bot_installed_guilds" | "subscription_status";

function buildCacheKey(kind: CacheKind, key: string) {
  return `possum:${kind}:${key}`;
}

function clearMemoryKey(cacheKey: string) {
  memoryCache.delete(cacheKey);
}

void subscribeDashboardEvent(INVALIDATE_CHANNEL, (payload: any) => {
  const guildId = String(payload?.guildId || "").trim();
  if (!guildId) return;
  for (const key of memoryCache.keys()) {
    if (key.includes(guildId) || key.includes(":all")) {
      memoryCache.delete(key);
    }
  }
});

export async function readGuildDiscoveryCache<T = any>(kind: CacheKind, key: string): Promise<T | null> {
  const cacheKey = buildCacheKey(kind, key);
  const memoryHit = memoryCache.get(cacheKey);
  if (memoryHit && memoryHit.expiresAt > Date.now()) {
    return memoryHit.payload as T;
  }
  if (memoryHit) {
    memoryCache.delete(cacheKey);
  }

  const redisHit = await readRedisJson<{ payload: T; expiresAt: number }>(cacheKey);
  if (redisHit && Number(redisHit.expiresAt || 0) > Date.now()) {
    memoryCache.set(cacheKey, { expiresAt: Number(redisHit.expiresAt), payload: redisHit.payload });
    return redisHit.payload;
  }

  const row = await prisma.guildDiscoveryCache.findUnique({ where: { cacheKey } }).catch(() => null);
  if (!row || row.expiresAt.getTime() <= Date.now()) {
    if (row) {
      await prisma.guildDiscoveryCache.delete({ where: { cacheKey } }).catch(() => null);
    }
    return null;
  }

  try {
    const payload = JSON.parse(row.payload);
    memoryCache.set(cacheKey, { expiresAt: row.expiresAt.getTime(), payload });
    return payload as T;
  } catch {
    await prisma.guildDiscoveryCache.delete({ where: { cacheKey } }).catch(() => null);
    return null;
  }
}

export async function writeGuildDiscoveryCache(kind: CacheKind, key: string, payload: unknown, ttlSeconds = 45) {
  const cacheKey = buildCacheKey(kind, key);
  const expiresAt = Date.now() + Math.max(5, ttlSeconds) * 1000;
  memoryCache.set(cacheKey, { expiresAt, payload });
  await writeRedisJson(cacheKey, { payload, expiresAt }, ttlSeconds).catch(() => false);
  await prisma.guildDiscoveryCache
    .upsert({
      where: { cacheKey },
      update: {
        kind,
        payload: JSON.stringify(payload ?? null),
        expiresAt: new Date(expiresAt),
      },
      create: {
        cacheKey,
        kind,
        payload: JSON.stringify(payload ?? null),
        expiresAt: new Date(expiresAt),
      },
    })
    .catch(() => null);
}

export async function invalidateGuildDiscoveryCache(kind: CacheKind, key: string) {
  const cacheKey = buildCacheKey(kind, key);
  clearMemoryKey(cacheKey);
  await deleteRedisKey(cacheKey).catch(() => false);
  await prisma.guildDiscoveryCache.delete({ where: { cacheKey } }).catch(() => null);
}

export async function publishGuildInvalidation(guildId: string, scope = "config") {
  await publishDashboardEvent(INVALIDATE_CHANNEL, {
    guildId: String(guildId || "").trim(),
    scope: String(scope || "config"),
    at: new Date().toISOString(),
  }).catch(() => false);
}
