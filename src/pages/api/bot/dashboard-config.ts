import type { NextApiRequest, NextApiResponse } from "next";
import { auditDashboardEvent } from "@/lib/dashboardAudit";
import {
  readGuildIdFromRequest,
  PRIMARY_BASELINE_GUILD_ID,
  GAMES_BASELINE_GUILD_ID,
  isWriteBlockedForGuild,
  stockLockError,
} from "@/lib/guildPolicy";
import { enforceDashboardRateLimit, isRateLimitError } from "@/lib/rateLimiter";
import {
  CANONICAL_FEATURE_KEYS,
  asBoolean,
  normalizeFeaturePatch,
  withLegacyFeatureAliases,
} from "@/lib/dashboard/featureKeys";
import { BOT_API, buildBotApiHeaders, fetchBotApi, readJsonSafe } from "@/lib/botApi";
import { deleteServerCachePrefix } from "@/lib/serverCache";

export const config = {
  api: {
    bodyParser: {
      sizeLimit: "12mb",
    },
  },
};

function isRecord(input: unknown): input is Record<string, unknown> {
  return !!input && typeof input === "object" && !Array.isArray(input);
}

function getErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof Error && err.message) return err.message;
  return fallback;
}

function buildUnlockedFeatureBaseline(): Record<string, boolean> {
  return CANONICAL_FEATURE_KEYS.reduce<Record<string, boolean>>((out, key) => {
    if (key !== "catDropEnabled" && key !== "rareDropEnabled") out[key] = true;
    return out;
  }, {});
}

const GAMES_BASELINE_FEATURES = buildUnlockedFeatureBaseline();
const STANDARD_READY_FEATURES = buildUnlockedFeatureBaseline();

function enrichDashboardFeatures(configInput: unknown, guildId: string) {
  if (!isRecord(configInput)) return configInput;

  const config = { ...configInput };
  const security = isRecord(config.security) ? (config.security as Record<string, unknown>) : {};
  const lockdown = isRecord(security.lockdown) ? (security.lockdown as Record<string, unknown>) : {};
  const raid = isRecord(security.raid) ? (security.raid as Record<string, unknown>) : {};

  const tickets =
    isRecord(config.tickets) && typeof (config.tickets as Record<string, unknown>).active === "boolean"
      ? asBoolean((config.tickets as Record<string, unknown>).active)
      : false;

  const giveaways =
    isRecord(config.giveaways) && typeof (config.giveaways as Record<string, unknown>).active === "boolean"
      ? asBoolean((config.giveaways as Record<string, unknown>).active)
      : false;

  const pokemonPrivateOnly =
    isRecord(config.games) &&
    isRecord((config.games as Record<string, unknown>).pokemon) &&
    typeof (((config.games as Record<string, unknown>).pokemon as Record<string, unknown>).privateOnly) === "boolean"
      ? asBoolean((((config.games as Record<string, unknown>).pokemon as Record<string, unknown>).privateOnly), true)
      : true;

  const normalized = withLegacyFeatureAliases(config.features, {
    lockdownEnabled: asBoolean(lockdown.enabled, false),
    raidEnabled: asBoolean(raid.enabled, false),
    ticketsEnabled: tickets,
    giveawaysEnabled: giveaways,
    pokemonPrivateOnly,
  });
  const allCanonicalOff = CANONICAL_FEATURE_KEYS.every((key) => normalized[key] === false);
  if (allCanonicalOff) {
    Object.assign(
      normalized,
      guildId && guildId === GAMES_BASELINE_GUILD_ID ? GAMES_BASELINE_FEATURES : STANDARD_READY_FEATURES
    );
  }
  config.features = normalized;

  return config;
}

function normalizeWriteBody(req: NextApiRequest, guildId: string) {
  const body = isRecord(req.body) ? { ...req.body } : {};
  body.guildId = guildId;

  const ignored: string[] = [];

  if (isRecord(body.patch) && Object.prototype.hasOwnProperty.call(body.patch, "features")) {
    const patchObj = { ...(body.patch as Record<string, unknown>) };
    const { patch, ignoredKeys } = normalizeFeaturePatch(patchObj.features);
    ignored.push(...ignoredKeys);
    if (Object.keys(patch).length > 0) patchObj.features = patch;
    else delete patchObj.features;
    body.patch = patchObj;
  }

  if (Object.prototype.hasOwnProperty.call(body, "features")) {
    const { patch, ignoredKeys } = normalizeFeaturePatch((body as Record<string, unknown>).features);
    ignored.push(...ignoredKeys);
    if (Object.keys(patch).length > 0) body.features = patch;
    else delete body.features;
  }

  return { body, ignoredFeatureKeys: Array.from(new Set(ignored)) };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    try {
      await enforceDashboardRateLimit(req, "bot_dashboard_config");
    } catch (error: any) {
      if (isRateLimitError(error)) {
        return res.status(429).json({ success: false, error: "Too many dashboard config requests. Please retry shortly." });
      }
    }

    const guildId = readGuildIdFromRequest(req);

    if (req.method === "GET") {
      if (!guildId) return res.status(400).json({ success: false, error: "guildId is required" });

      const upstream = await fetchBotApi(
        `${BOT_API}/dashboard-config?guildId=${encodeURIComponent(guildId)}`,
        { headers: await buildBotApiHeaders(req), cache: "no-store" }
      );
      const data = await readJsonSafe(upstream);
      if (isRecord(data) && isRecord(data.config)) {
        data.config = enrichDashboardFeatures(data.config, guildId);
      }
      return res.status(upstream.status).json(data);
    }

    if (req.method === "POST") {
      if (!guildId) return res.status(400).json({ success: false, error: "guildId is required" });
      if (isWriteBlockedForGuild(guildId)) {
        return res.status(403).json(stockLockError(guildId));
      }

      const normalized = normalizeWriteBody(req, guildId);
      const upstream = await fetchBotApi(`${BOT_API}/dashboard-config`, {
        method: "POST",
        headers: await buildBotApiHeaders(req, { json: true }),
        body: JSON.stringify(normalized.body),
      });
      const data = await readJsonSafe(upstream);
      deleteServerCachePrefix(`bot-guild-access:${guildId}:`);
      if (isRecord(data) && normalized.ignoredFeatureKeys.length > 0) {
        data.ignoredFeatureKeys = normalized.ignoredFeatureKeys;
      }
      void auditDashboardEvent({
        guildId,
        actorUserId: String(req.headers["x-dashboard-user-id"] || req.body?.userId || req.query?.userId || "").trim() || null,
        area: "dashboard_config",
        action: "save",
        severity: upstream.ok ? "info" : "error",
        metadata: {
          ignoredFeatureKeys: normalized.ignoredFeatureKeys,
          baselineGuild: guildId === PRIMARY_BASELINE_GUILD_ID || guildId === GAMES_BASELINE_GUILD_ID,
          keys: Object.keys((normalized.body as any)?.patch || (normalized.body as any)?.features || {}),
        },
      });
      return res.status(upstream.status).json(data);
    }

    return res.status(405).json({ success: false, error: "Method not allowed" });
  } catch (err: unknown) {
    return res.status(500).json({ success: false, error: getErrorMessage(err, "Proxy error") });
  }
}
