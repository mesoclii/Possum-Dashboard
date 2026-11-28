export type LiveHealthStatus = "online" | "degraded" | "offline" | "unknown";

export type PublicLiveCheck = {
  id: string;
  label: string;
  status: LiveHealthStatus;
  checkedAt: string | null;
};

export type PublicLiveHealth = {
  source: "possum-ops-agent";
  status: LiveHealthStatus;
  freshness: "fresh" | "stale" | "unavailable";
  checkedAt: string | null;
  observedAt: string;
  message: string;
  checks: PublicLiveCheck[];
};

const MAX_SAMPLE_AGE_MS = 90_000;

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function isoTime(value: unknown): string | null {
  const timestamp = typeof value === "number" ? value : Number(value);
  if (Number.isFinite(timestamp) && timestamp > 0) return new Date(timestamp).toISOString();
  const parsed = Date.parse(String(value || ""));
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : null;
}

function probeStatus(probeValue: unknown, sampleFresh: boolean, requireBotReadiness = false): LiveHealthStatus {
  if (!sampleFresh) return "unknown";
  const probe = record(probeValue);
  if (typeof probe.ok !== "boolean") return "unknown";
  if (!probe.ok) return "offline";
  if (!requireBotReadiness) return "online";
  if (probe.discordReady === false || probe.databaseReady === false) return "degraded";
  if (probe.discordReady !== true || probe.databaseReady !== true) return "unknown";
  return "online";
}

export function buildPublicLiveHealthSnapshot(input: unknown, now = Date.now()): PublicLiveHealth {
  const root = record(input);
  const agent = record(root.agent);
  const checkedAt = isoTime(agent.lastTickAt);
  const checkedMs = checkedAt ? Date.parse(checkedAt) : Number.NaN;
  const sampleAge = now - checkedMs;
  const sampleFresh = Number.isFinite(sampleAge) && sampleAge >= -5_000 && sampleAge <= MAX_SAMPLE_AGE_MS;
  const freshness: PublicLiveHealth["freshness"] = !input
    ? "unavailable"
    : sampleFresh ? "fresh" : checkedAt ? "stale" : "unavailable";
  const http = record(root.http);
  const httpServices = record(http.services);
  const checks: PublicLiveCheck[] = [
    {
      id: "bot-core",
      label: "Bot API, Discord Gateway, and Database",
      status: probeStatus(httpServices.bot, sampleFresh, true),
      checkedAt: isoTime(record(httpServices.bot).checkedAt) || checkedAt,
    },
    {
      id: "dashboard",
      label: "Dashboard API",
      status: probeStatus(httpServices.dashboard, sampleFresh),
      checkedAt: isoTime(record(httpServices.dashboard).checkedAt) || checkedAt,
    },
    {
      id: "game-provider-bridge",
      label: "Game Provider Bridge",
      status: probeStatus(httpServices.bridge, sampleFresh),
      checkedAt: isoTime(record(httpServices.bridge).checkedAt) || checkedAt,
    },
    {
      id: "operations-agent",
      label: "Operations Monitor",
      status: sampleFresh ? "online" : "unknown",
      checkedAt,
    },
  ];
  const status: LiveHealthStatus = checks.some((check) => check.status === "offline")
    ? "offline"
    : checks.some((check) => check.status === "degraded")
      ? "degraded"
      : checks.every((check) => check.status === "online")
        ? "online"
        : "unknown";

  return {
    source: "possum-ops-agent",
    status,
    freshness,
    checkedAt,
    observedAt: new Date(now).toISOString(),
    message: freshness === "fresh"
      ? "Live checks are based on the latest Operations Agent sample."
      : freshness === "stale"
        ? "The latest Operations Agent sample is stale; live health is unknown."
        : "Live health is unknown because Operations Agent data is unavailable.",
    checks,
  };
}
