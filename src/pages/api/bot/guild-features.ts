import type { NextApiRequest, NextApiResponse } from "next";
import {
  readGuildIdFromRequest,
  PRIMARY_BASELINE_GUILD_ID,
  GAMES_BASELINE_GUILD_ID,
  isWriteBlockedForGuild,
  stockLockError,
} from "@/lib/guildPolicy";
import {
  CANONICAL_FEATURE_KEYS,
  normalizeFeaturePatch,
  resolveCanonicalFeatureKey,
  withLegacyFeatureAliases,
} from "@/lib/dashboard/featureKeys";
import { BOT_API, buildBotApiHeaders, readJsonSafe } from "@/lib/botApi";

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

function applyNonPrimaryDefaultFeatures(
  guildId: string,
  upstreamFeatures: unknown,
  normalized: Record<string, boolean>
): Record<string, boolean> {
  if (!guildId || guildId === PRIMARY_BASELINE_GUILD_ID) return normalized;
  const allCanonicalOff = CANONICAL_FEATURE_KEYS.every((key) => normalized[key] === false);
  if (!allCanonicalOff) return normalized;
  if (guildId === GAMES_BASELINE_GUILD_ID) {
    return {
      ...normalized,
      ...GAMES_BASELINE_FEATURES,
    };
  }
  return {
    ...normalized,
    ...STANDARD_READY_FEATURES,
  };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const guildId = readGuildIdFromRequest(req);

    if (req.method === "GET") {
      if (!guildId) {
        return res.status(400).json({ success: false, error: "guildId is required" });
      }

      const upstream = await fetch(
        `${BOT_API}/guild-features?guildId=${encodeURIComponent(guildId)}`,
        { headers: await buildBotApiHeaders(req), cache: "no-store" }
      );

      const data = await readJsonSafe(upstream);
      if (isRecord(data) && isRecord(data.features)) {
        const normalized = withLegacyFeatureAliases(data.features);
        data.features = applyNonPrimaryDefaultFeatures(guildId, data.features, normalized);
      }
      return res.status(upstream.status).json(data);
    }

    if (req.method === "POST") {
      if (!guildId) {
        return res.status(400).json({ success: false, error: "guildId is required" });
      }
      if (isWriteBlockedForGuild(guildId)) {
        return res.status(403).json(stockLockError(guildId));
      }

      const rawBody = isRecord(req.body) ? { ...req.body } : {};
      const ignored: string[] = [];
      let payload: Record<string, unknown> = { ...rawBody, guildId };

      if (isRecord(rawBody.features)) {
        const normalized = normalizeFeaturePatch(rawBody.features);
        ignored.push(...normalized.ignoredKeys);
        if (Object.keys(normalized.patch).length === 0) {
          return res.status(200).json({ success: true, guildId, ignoredFeatureKeys: Array.from(new Set(ignored)) });
        }
        payload = { guildId, features: normalized.patch };
      } else {
        const rawKey =
          typeof rawBody.featureKey === "string"
            ? rawBody.featureKey
            : typeof rawBody.feature === "string"
              ? rawBody.feature
              : typeof rawBody.key === "string"
                ? rawBody.key
                : "";

        if (rawKey) {
          const canonical = resolveCanonicalFeatureKey(rawKey);
          if (!canonical || typeof rawBody.enabled !== "boolean") {
            ignored.push(rawKey);
            return res.status(200).json({ success: true, guildId, ignoredFeatureKeys: Array.from(new Set(ignored)) });
          }
          payload = { guildId, features: { [canonical]: rawBody.enabled } };
        }
      }

      const upstream = await fetch(`${BOT_API}/guild-features`, {
        method: "POST",
        headers: await buildBotApiHeaders(req, { json: true }),
        body: JSON.stringify(payload),
      });

      const data = await readJsonSafe(upstream);
      if (isRecord(data) && ignored.length > 0) {
        data.ignoredFeatureKeys = Array.from(new Set(ignored));
      }
      return res.status(upstream.status).json(data);
    }

    return res.status(405).json({ success: false, error: "Method not allowed" });
  } catch (err: unknown) {
    return res.status(500).json({
      success: false,
      error: getErrorMessage(err, "Bot API unreachable"),
    });
  }
}
