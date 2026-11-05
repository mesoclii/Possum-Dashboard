import type { NextApiRequest, NextApiResponse } from "next";
import { isDashboardControlOwner, isDashboardControlGuild } from "@/lib/dashboardOwner";
import { DASHBOARD_SESSION_COOKIE, readDashboardSessionValue } from "@/lib/session";
import { featureRequiresPremium, getGuildSubscriptionStatus, isDeveloperPremiumBypass } from "@/lib/subscription";

const FEATURE_LABELS: Record<string, string> = {
  tts: "TTS Engine",
  heist: "Heist Engine",
  persona: "Persona Engine AI",
  "openai-platform": "OpenAI Persona Platform",
  "advanced-security": "Advanced Security + Governance Suite",
  "automation-suite": "Automation + Custom Commands Suite",
  "signal-relay": "Social Alerts + Signal Relay",
  "search-anything": "Search Anything",
  "config-backup": "Config Backup + Restore",
  analytics: "Analytics",
  secondbot: "Second Token Bot",
};

async function readActorUserId(req: NextApiRequest) {
  const session = await readDashboardSessionValue(req.cookies[DASHBOARD_SESSION_COOKIE]);
  return String(session?.user?.id || "").trim();
}

export function mapPremiumFeatureKey(rawFeature: string) {
  const feature = String(rawFeature || "").trim().toLowerCase();
  if (!feature) return "";
  if (feature.startsWith("security.")) return "advanced-security";
  if (["tts"].includes(feature)) return "tts";
  if (["heist"].includes(feature)) return "heist";
  if (["persona", "ai-persona-runtime"].includes(feature)) return "persona";
  if (["openai-platform"].includes(feature)) return "openai-platform";
  if (["advanced-security"].includes(feature)) return "advanced-security";
  if (["automation-suite"].includes(feature)) return "automation-suite";
  if (["signalrelay", "signal-relay", "social-alerts"].includes(feature)) return "signal-relay";
  if (["searchanything", "search-anything"].includes(feature)) return "search-anything";
  if (["config-backup"].includes(feature)) return "config-backup";
  if (feature === "analytics") return "analytics";
  return feature;
}

function requiredPlanRank(featureKey: string) {
  // Every premium feature is in all plans except the Second Token Bot (Yearly and up).
  return featureKey === "secondbot" ? 2 : 1;
}

function planRank(plan: unknown) {
  const normalized = String(plan || "").trim().toLowerCase();
  if (normalized === "pro") return 1;
  if (normalized === "business" || normalized === "elite") return 2;
  if (normalized === "enterprise") return 3;
  return 0;
}

export async function requirePremiumAccess(
  req: NextApiRequest,
  res: NextApiResponse,
  guildId: string,
  rawFeature: string
) {
  const featureKey = mapPremiumFeatureKey(rawFeature);
  // Creator-only features are gated by identity, never by the billing-enforcement flag.
  if (featureKey !== "openai-platform" && !featureRequiresPremium(featureKey)) {
    return true;
  }

  const actorUserId = await readActorUserId(req);
  if (!actorUserId) {
    res.status(401).json({
      success: false,
      error: "A valid dashboard session is required.",
    });
    return false;
  }

  if (featureKey === "openai-platform") {
    if (isDashboardControlOwner(actorUserId)) return true;
    return res.status(403).json({
      success: false,
      premiumRequired: true,
      featureKey,
      error: "The OpenAI Persona Platform is reserved for bot creators.",
    });
  }

  if (isDeveloperPremiumBypass(actorUserId) || isDashboardControlOwner(actorUserId) || isDashboardControlGuild(guildId)) {
    return true;
  }

  const subscription = await getGuildSubscriptionStatus(guildId, actorUserId).catch(() => null);
  if (subscription?.active && planRank(subscription.plan) >= requiredPlanRank(featureKey)) {
    return true;
  }

  const minimumPlan = requiredPlanRank(featureKey) >= 2 ? "Yearly or Lifetime" : "Pro";
  return res.status(402).json({
    success: false,
    premiumRequired: true,
    featureKey,
    error: `${FEATURE_LABELS[featureKey] || "This feature"} requires an active ${minimumPlan} plan for this guild.`,
  });
}
