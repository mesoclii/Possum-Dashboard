import { MASTER_OWNER_USER_ID, isDashboardControlGuild, isDashboardControlOwner } from "@/lib/dashboardOwner";
import { writeGuildDiscoveryCache } from "@/lib/guildDiscoveryCache";
import prisma from "@/lib/prisma";
import { buildServerBotApiHeaders, readServerBotApiJson, SERVER_BOT_API } from "@/lib/botApiServer";
import { isPremiumEnforcementEnabled } from "@/lib/premiumMode";

const PREMIUM_FEATURES = new Set(["tts", "heist", "persona", "openai-platform", "advanced-security", "automation-suite"]);
const SYNC_TTL_MS = 60_000;

function normalizeActorUserId(actorUserId?: string) {
  return String(actorUserId || MASTER_OWNER_USER_ID).trim() || MASTER_OWNER_USER_ID;
}

function globalSubscriptionId(actorUserId?: string) {
  return `global:${normalizeActorUserId(actorUserId)}`;
}

export function featureRequiresPremium(featureKey: string) {
  return isPremiumEnforcementEnabled() && PREMIUM_FEATURES.has(String(featureKey || "").trim());
}

export function isDeveloperPremiumBypass(actorUserId?: string) {
  return isDashboardControlOwner(normalizeActorUserId(actorUserId));
}

export function isDeveloperGuildBypass(guildId?: string) {
  return isDashboardControlGuild(guildId);
}

type SubscriptionStatus = {
  guildId: string;
  active: boolean;
  plan: string;
  premiumTier: string | null;
  source: string;
  premiumExpiresAt: string | null;
  developerBypass: boolean;
  scope: "guild" | "global";
  inheritedFrom: string | null;
};

function normalizePlan(value: unknown) {
  const plan = String(value || "").trim();
  return plan || "FREE";
}

function isManualSource(value: unknown) {
  const source = String(value || "").trim().toLowerCase();
  return source.startsWith("owner_") || source.startsWith("global_") || source.startsWith("manual_");
}

function isExpiredRecord(record: { premiumExpiresAt: Date | null } | null | undefined) {
  return Boolean(record?.premiumExpiresAt && record.premiumExpiresAt.getTime() <= Date.now());
}

function toStatus(
  guildId: string,
  record: {
    active: boolean;
    plan: string;
    premiumTier: string | null;
    source: string;
    premiumExpiresAt: Date | null;
  } | null | undefined,
  developerBypass: boolean,
  scope: "guild" | "global",
  inheritedFrom: string | null = null
): SubscriptionStatus {
  const expired = isExpiredRecord(record);
  return {
    guildId,
    active: Boolean(record?.active) && !expired,
    plan: normalizePlan(record?.plan),
    premiumTier: record?.premiumTier || null,
    source: record?.source || (scope === "global" ? "global" : "db_cache"),
    premiumExpiresAt: record?.premiumExpiresAt ? record.premiumExpiresAt.toISOString() : null,
    developerBypass,
    scope,
    inheritedFrom,
  };
}

async function readBotPremium(guildId: string, actorUserId: string) {
  const upstream = await fetch(
    `${SERVER_BOT_API}/guild-data?guildId=${encodeURIComponent(guildId)}`,
    {
      headers: buildServerBotApiHeaders(actorUserId),
      cache: "no-store",
    }
  );
  const data = await readServerBotApiJson(upstream);
  if (!upstream.ok || data?.success === false) {
    throw new Error(data?.error || `Guild premium lookup failed (${upstream.status})`);
  }
  const premium = data?.premium || {};
  return {
    active: Boolean(premium?.premium),
    plan: normalizePlan(premium?.premiumTier || (premium?.premium ? "PRO" : "FREE")),
    premiumTier: premium?.premiumTier ? String(premium.premiumTier) : null,
    premiumExpiresAt: premium?.premiumExpires ? new Date(premium.premiumExpires) : null,
  };
}

export async function getGuildSubscriptionStatus(guildId: string, actorUserId?: string): Promise<SubscriptionStatus> {
  const id = String(guildId || "").trim();
  const normalizedActorUserId = normalizeActorUserId(actorUserId);
  const developerBypass = isDeveloperPremiumBypass(normalizedActorUserId) || isDeveloperGuildBypass(id);
  if (!id) {
    return {
      guildId: "",
      active: false,
      plan: "FREE",
      premiumTier: null,
      source: "missing_guild",
      premiumExpiresAt: null,
      developerBypass,
      scope: "guild",
      inheritedFrom: null,
    };
  }

  const globalId = globalSubscriptionId(normalizedActorUserId);
  const [existing, globalRecord] = await Promise.all([
    prisma.guildSubscription.findUnique({
      where: { guildId: id },
    }).catch(() => null),
    prisma.guildSubscription.findUnique({
      where: { guildId: globalId },
    }).catch(() => null),
  ]);

  const manualGuildRecord =
    existing && isManualSource(existing.source) && existing.active && !isExpiredRecord(existing) ? existing : null;
  if (manualGuildRecord) {
    const status = toStatus(id, manualGuildRecord, developerBypass, "guild");
    await writeGuildDiscoveryCache("subscription_status", id, status, 45).catch(() => null);
    return status;
  }

  // Disabled or expired manual grants must not block a later paid (bot-synced) plan.
  const shouldSync =
    !existing ||
    Date.now() - existing.syncedAt.getTime() > SYNC_TTL_MS;

  let syncedRecord = existing;
  if (shouldSync) {
    try {
      const botPremium = await readBotPremium(id, String(actorUserId || MASTER_OWNER_USER_ID).trim() || MASTER_OWNER_USER_ID);
      syncedRecord = await prisma.guildSubscription
        .upsert({
          where: { guildId: id },
          update: {
            plan: botPremium.plan,
            active: botPremium.active,
            source: "bot_sync",
            premiumTier: botPremium.premiumTier,
            premiumExpiresAt: botPremium.premiumExpiresAt,
            syncedAt: new Date(),
          },
          create: {
            guildId: id,
            plan: botPremium.plan,
            active: botPremium.active,
            source: "bot_sync",
            premiumTier: botPremium.premiumTier,
            premiumExpiresAt: botPremium.premiumExpiresAt,
            syncedAt: new Date(),
          },
        })
        .catch(() => null);
    } catch (error) {
      if (!existing) {
        throw error;
      }
    }
  }

  const guildStatus = toStatus(id, syncedRecord || existing, developerBypass, "guild");
  if (guildStatus.active) {
    await writeGuildDiscoveryCache("subscription_status", id, guildStatus, 45).catch(() => null);
    return guildStatus;
  }

  if (globalRecord && !isExpiredRecord(globalRecord) && globalRecord.active) {
    const globalStatus = toStatus(id, globalRecord, developerBypass, "global", globalId);
    await writeGuildDiscoveryCache("subscription_status", id, globalStatus, 45).catch(() => null);
    return globalStatus;
  }

  await writeGuildDiscoveryCache("subscription_status", id, guildStatus, 45).catch(() => null);
  return guildStatus;
}

export async function setGuildSubscriptionStatus(
  guildId: string,
  input: {
    active: boolean;
    plan?: string;
    premiumTier?: string | null;
    premiumExpiresAt?: Date | null;
    source?: string;
  },
  actorUserId?: string,
  options?: {
    scope?: "guild" | "global";
  }
): Promise<SubscriptionStatus> {
  const id = String(guildId || "").trim();
  if (!id) {
    throw new Error("guildId is required");
  }
  const scope = options?.scope === "global" ? "global" : "guild";
  const normalizedActorUserId = normalizeActorUserId(actorUserId);
  const targetId = scope === "global" ? globalSubscriptionId(normalizedActorUserId) : id;
  const source =
    String(
      input.source ||
        (scope === "global"
          ? (input.premiumExpiresAt ? "global_trial" : "global_override")
          : (input.premiumExpiresAt ? "owner_trial" : "owner_override"))
    ).trim() ||
    (scope === "global" ? "global_override" : "owner_override");

  const record = await prisma.guildSubscription.upsert({
    where: { guildId: targetId },
    update: {
      active: Boolean(input.active),
      plan: normalizePlan(input.plan || (input.active ? "PRO" : "FREE")),
      premiumTier: input.premiumTier ? String(input.premiumTier) : null,
      premiumExpiresAt: input.active ? (input.premiumExpiresAt ?? null) : null,
      source,
      syncedAt: new Date(),
    },
    create: {
      guildId: targetId,
      active: Boolean(input.active),
      plan: normalizePlan(input.plan || (input.active ? "PRO" : "FREE")),
      premiumTier: input.premiumTier ? String(input.premiumTier) : null,
      premiumExpiresAt: input.active ? (input.premiumExpiresAt ?? null) : null,
      source,
      syncedAt: new Date(),
    },
  });

  const status = toStatus(
    id,
    record,
    false,
    scope,
    scope === "global" ? targetId : null
  );
  await writeGuildDiscoveryCache("subscription_status", id, status, 45).catch(() => null);
  return status;
}
