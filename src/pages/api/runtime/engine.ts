import type { NextApiRequest, NextApiResponse } from "next";
import { auditDashboardEvent } from "@/lib/dashboardAudit";
import { isWriteBlockedForGuild, stockLockError } from "@/lib/guildPolicy";
import { BOT_API, buildBotApiHeaders, fetchBotApi, readActorUserId, readJsonSafe } from "@/lib/botApi";
import { requirePremiumAccess } from "@/lib/premiumGuard";
import { enforceDashboardRateLimit, isRateLimitError } from "@/lib/rateLimiter";
import { normalizeEngineKey } from "@/lib/engineKeys";
import { deleteServerCachePrefix, readServerCache, writeServerCache } from "@/lib/serverCache";

const RUNTIME_ENGINE_PROXY_TTL_MS = Math.max(1_000, Number(process.env.RUNTIME_ENGINE_PROXY_TTL_MS || 10_000));

type CachedRuntimeEngine = {
  status: number;
  body: unknown;
};

export const config = {
  api: {
    bodyParser: {
      sizeLimit: "4mb",
    },
  },
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const actorUserId = await readActorUserId(req);
    try {
      await enforceDashboardRateLimit(req, "runtime_engine", actorUserId);
    } catch (error: any) {
      if (isRateLimitError(error)) {
        return res.status(429).json({ success: false, error: "Too many runtime-engine requests. Please retry shortly." });
      }
    }

    if (!actorUserId) {
      return res.status(401).json({ success: false, error: "A valid dashboard session is required." });
    }

    const guildId =
      req.method === "GET"
        ? String(req.query.guildId || "").trim()
        : String(req.body?.guildId || "").trim();
    const engine =
      req.method === "GET"
        ? String(req.query.engine || "").trim()
        : String(req.body?.engine || "").trim();
    const normalizedEngine = normalizeEngineKey(engine);

    if (!guildId) {
      return res.status(400).json({ success: false, error: "guildId is required" });
    }
    if (!normalizedEngine) {
      return res.status(400).json({ success: false, error: "engine is required" });
    }

    if (req.method !== "GET" && isWriteBlockedForGuild(guildId)) {
      return res.status(403).json(stockLockError(guildId));
    }

    const allowed = await requirePremiumAccess(req, res, guildId, normalizedEngine);
    if (allowed !== true) return allowed;

    if (req.method === "GET") {
      const routePath = String(req.query.routePath || req.query.route || "").trim();
      const cacheKey = `runtime-engine:${guildId}:${normalizedEngine}:${actorUserId || "anon"}:${routePath || "/"}`;
      const cached = readServerCache<CachedRuntimeEngine>(cacheKey);

      try {
        const query = new URLSearchParams();
        query.set("guildId", guildId);
        query.set("engine", normalizedEngine);
        if (actorUserId) query.set("userId", actorUserId);
        if (routePath) query.set("routePath", routePath);
        const upstream = await fetchBotApi(
          `${BOT_API}/engine-runtime?${query.toString()}`,
          {
            headers: await buildBotApiHeaders(req),
            cache: "no-store",
          }
        );
        const json = await readJsonSafe(upstream);
        if (upstream.ok && json?.success !== false) {
          writeServerCache(cacheKey, { status: upstream.status, body: json }, RUNTIME_ENGINE_PROXY_TTL_MS);
        }
        if (upstream.status >= 500 && cached?.body) {
          return res.status(cached.status || 200).json(cached.body);
        }
        return res.status(upstream.status).json(json);
      } catch (error: any) {
        if (cached?.body) {
          return res.status(cached.status || 200).json(cached.body);
        }
        throw error;
      }
    }

    if (req.method === "POST" || req.method === "PUT") {
      const upstream = await fetchBotApi(`${BOT_API}/engine-runtime`, {
        method: "POST",
        headers: await buildBotApiHeaders(req, { json: true }),
        body: JSON.stringify({
          guildId,
          engine: normalizedEngine,
          userId: actorUserId,
          routePath: String(req.body?.routePath || req.body?.route || "").trim(),
          patch: req.body?.patch || req.body?.config || {},
        }),
      });
      const json = await readJsonSafe(upstream);
      deleteServerCachePrefix(`runtime-engine:${guildId}:${normalizedEngine}:`);
      void auditDashboardEvent({
        guildId,
        actorUserId,
        area: "runtime_engine",
        action: `${normalizedEngine}:save`,
        severity: upstream.ok ? "info" : "error",
        metadata: {
          engine: normalizedEngine,
          keys: Object.keys(req.body?.patch || req.body?.config || {}),
        },
      });
      return res.status(upstream.status).json(json);
    }

    return res.status(405).json({ success: false, error: "Method not allowed" });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err?.message || "Internal error" });
  }
}
