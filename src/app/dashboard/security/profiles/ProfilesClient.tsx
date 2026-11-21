"use client";

import { useEffect, useMemo, useState } from "react";
import { fetchDashboardConfig, fetchRuntimeEngine, resolveGuildContext, saveDashboardConfig, saveRuntimeEngine } from "@/lib/liveRuntime";

type ProfileId = "chill" | "balanced" | "strict" | "siege";

type JsonObject = Record<string, unknown>;

type ProfileDefinition = {
  title: string;
  subtitle: string;
  dashboardPatch: JsonObject;
  lockdownPatch: JsonObject;
  raidPatch: JsonObject;
};

const PROFILES: Record<ProfileId, ProfileDefinition> = {
  chill: {
    title: "Chill",
    subtitle: "Low friction, light guardrails",
    dashboardPatch: {
      features: { securityEnabled: true, lockdownEnabled: false, raidEnabled: true },
    },
    lockdownPatch: {
      enabled: false,
      joinThresholdPerMinute: 999,
      mentionThresholdPerMinute: 999,
      autoEscalation: false,
      exemptRoleIds: [],
      exemptChannelIds: [],
    },
    raidPatch: {
      enabled: true,
      joinBurstThreshold: 20,
      windowSeconds: 30,
      actionPreset: "observe",
      exemptRoleIds: [],
      exemptChannelIds: [],
      autoEscalate: false,
    },
  },
  balanced: {
    title: "Balanced",
    subtitle: "Recommended default for most servers",
    dashboardPatch: {
      features: { securityEnabled: true, lockdownEnabled: true, raidEnabled: true },
    },
    lockdownPatch: {
      enabled: true,
      joinThresholdPerMinute: 12,
      mentionThresholdPerMinute: 18,
      autoEscalation: true,
      exemptRoleIds: [],
      exemptChannelIds: [],
    },
    raidPatch: {
      enabled: true,
      joinBurstThreshold: 8,
      windowSeconds: 30,
      actionPreset: "contain",
      exemptRoleIds: [],
      exemptChannelIds: [],
      autoEscalate: true,
    },
  },
  strict: {
    title: "Strict",
    subtitle: "High moderation posture",
    dashboardPatch: {
      features: { securityEnabled: true, lockdownEnabled: true, raidEnabled: true },
    },
    lockdownPatch: {
      enabled: true,
      joinThresholdPerMinute: 8,
      mentionThresholdPerMinute: 12,
      autoEscalation: true,
      exemptRoleIds: [],
      exemptChannelIds: [],
    },
    raidPatch: {
      enabled: true,
      joinBurstThreshold: 6,
      windowSeconds: 30,
      actionPreset: "contain",
      exemptRoleIds: [],
      exemptChannelIds: [],
      autoEscalate: true,
    },
  },
  siege: {
    title: "Siege",
    subtitle: "Emergency mode",
    dashboardPatch: {
      features: { securityEnabled: true, lockdownEnabled: true, raidEnabled: true },
    },
    lockdownPatch: {
      enabled: true,
      joinThresholdPerMinute: 4,
      mentionThresholdPerMinute: 6,
      autoEscalation: true,
      exemptRoleIds: [],
      exemptChannelIds: [],
    },
    raidPatch: {
      enabled: true,
      joinBurstThreshold: 3,
      windowSeconds: 20,
      actionPreset: "lock",
      exemptRoleIds: [],
      exemptChannelIds: [],
      autoEscalate: true,
    },
  },
};

const card: React.CSSProperties = {
  border: "1px solid #5f0000",
  borderRadius: 12,
  padding: 14,
  background: "rgba(120,0,0,0.09)",
};

const btn: React.CSSProperties = {
  border: "1px solid #a30000",
  borderRadius: 10,
  background: "#1a0000",
  color: "#ffcccc",
  padding: "8px 12px",
  cursor: "pointer",
  fontWeight: 700,
};

function isObject(value: unknown): value is JsonObject {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function getAtPath(input: unknown, path: string[]) {
  return path.reduce<unknown>((current, part) => {
    if (!current || typeof current !== "object") return undefined;
    return (current as JsonObject)[part];
  }, input);
}

function sameValue(left: unknown, right: unknown) {
  if (Array.isArray(left) && Array.isArray(right)) {
    return JSON.stringify(left) === JSON.stringify(right);
  }
  return left === right;
}

function patchMatchesLive(live: unknown, patch: unknown): boolean {
  if (Array.isArray(patch)) {
    return Array.isArray(live) && JSON.stringify(live) === JSON.stringify(patch);
  }
  if (isObject(patch)) {
    if (!isObject(live)) return false;
    return Object.entries(patch).every(([key, value]) => patchMatchesLive(live[key], value));
  }
  return sameValue(live, patch);
}

function countDifferences(live: unknown, patch: unknown): number {
  if (Array.isArray(patch)) {
    return Array.isArray(live) && JSON.stringify(live) === JSON.stringify(patch) ? 0 : 1;
  }
  if (isObject(patch)) {
    if (!isObject(live)) return Object.keys(patch).length;
    return Object.entries(patch).reduce((total, [key, value]) => total + countDifferences(live[key], value), 0);
  }
  return sameValue(live, patch) ? 0 : 1;
}

function detectProfile(dashboardConfig: JsonObject, lockdownConfig: JsonObject, raidConfig: JsonObject) {
  const found = (Object.keys(PROFILES) as ProfileId[]).find((profileId) => {
    const profile = PROFILES[profileId];
    return (
      patchMatchesLive(dashboardConfig, profile.dashboardPatch) &&
      patchMatchesLive(lockdownConfig, profile.lockdownPatch) &&
      patchMatchesLive(raidConfig, profile.raidPatch)
    );
  });
  return found || "custom";
}

function describePosture(dashboardConfig: JsonObject, lockdownConfig: JsonObject, raidConfig: JsonObject) {
  return [
    {
      label: "Security Feature Gate",
      value: getAtPath(dashboardConfig, ["features", "securityEnabled"]) === false ? "Blocked" : "Open",
    },
    {
      label: "Lockdown",
      value: getAtPath(lockdownConfig, ["enabled"]) === false ? "Disabled" : "Enabled",
    },
    {
      label: "Raid",
      value: getAtPath(raidConfig, ["enabled"]) === false ? "Disabled" : "Enabled",
    },
    {
      label: "Lockdown Mention Threshold",
      value: String(getAtPath(lockdownConfig, ["mentionThresholdPerMinute"]) ?? "n/a"),
    },
    {
      label: "Raid Join Burst Threshold",
      value: String(getAtPath(raidConfig, ["joinBurstThreshold"]) ?? "n/a"),
    },
    {
      label: "Raid Preset",
      value: String(getAtPath(raidConfig, ["actionPreset"]) || "n/a"),
    },
  ];
}

export default function SecurityProfilesPage() {
  const [guildId, setGuildId] = useState("");
  const [guildName, setGuildName] = useState("");
  const [dashboardConfig, setDashboardConfig] = useState<JsonObject>({});
  const [lockdownConfig, setLockdownConfig] = useState<JsonObject>({});
  const [raidConfig, setRaidConfig] = useState<JsonObject>({});
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState("");
  const [msg, setMsg] = useState("");

  useEffect(() => {
    const context = resolveGuildContext();
    setGuildId(context.guildId);
    setGuildName(context.guildName);
  }, []);

  async function reload(targetGuildId: string) {
    if (!targetGuildId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setMsg("");
      const [dashboard, lockdown, raid] = await Promise.all([
        fetchDashboardConfig(targetGuildId),
        fetchRuntimeEngine(targetGuildId, "lockdown"),
        fetchRuntimeEngine(targetGuildId, "raid"),
      ]);

      setDashboardConfig((dashboard && typeof dashboard === "object" ? dashboard : {}) as JsonObject);
      setLockdownConfig((lockdown?.config && typeof lockdown.config === "object" ? lockdown.config : {}) as JsonObject);
      setRaidConfig((raid?.config && typeof raid.config === "object" ? raid.config : {}) as JsonObject);
    } catch (error) {
      setMsg(error instanceof Error ? error.message : "Failed to load live security posture.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void reload(guildId);
  }, [guildId]);

  const currentProfile = useMemo(
    () => detectProfile(dashboardConfig, lockdownConfig, raidConfig),
    [dashboardConfig, lockdownConfig, raidConfig]
  );
  const postureRows = useMemo(
    () => describePosture(dashboardConfig, lockdownConfig, raidConfig),
    [dashboardConfig, lockdownConfig, raidConfig]
  );

  async function applyProfile(profileId: ProfileId) {
    if (!guildId) return;
    const profile = PROFILES[profileId];
    setApplying(profileId);
    setMsg("");

    try {
      await Promise.all([
        saveDashboardConfig(guildId, profile.dashboardPatch),
        saveRuntimeEngine(guildId, "lockdown", profile.lockdownPatch),
        saveRuntimeEngine(guildId, "raid", profile.raidPatch),
      ]);
      await reload(guildId);
      setMsg(`Applied live posture: ${profile.title}`);
    } catch (error) {
      setMsg(error instanceof Error ? error.message : "Profile apply failed.");
    } finally {
      setApplying("");
    }
  }

  if (!guildId) {
    return <div style={{ color: "#ff6b6b", padding: 24 }}>Missing guildId. Open from /guilds first.</div>;
  }

  return (
    <div style={{ color: "#ffb3b3", padding: 18, maxWidth: 1220 }}>
      <h1 style={{ marginTop: 0, color: "#ff3b3b", letterSpacing: "0.08em", textTransform: "uppercase" }}>
        Security Profiles
      </h1>
      <div style={{ marginBottom: 12 }}>
        Guild: {guildName || "Selected server"} {msg ? `| ${msg}` : ""}
      </div>

      {loading ? (
        <div>Loading...</div>
      ) : (
        <>
          <div style={{ ...card, marginBottom: 14 }}>
            <div style={{ marginBottom: 6 }}>
              Current live posture: <b>{currentProfile === "custom" ? "Custom" : PROFILES[currentProfile].title}</b>
            </div>
            <div style={{ color: "#ffbcbc", fontSize: 13, lineHeight: 1.6 }}>
              This page no longer stores a separate dashboard profile state. It compares the live dashboard feature flags plus the live lockdown and raid engines,
              then applies profile patches directly to those bot paths.
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 10, marginTop: 12 }}>
              {postureRows.map((row) => (
                <div key={row.label} style={{ border: "1px solid #4a0000", borderRadius: 10, padding: 12, background: "#100000" }}>
                  <div style={{ color: "#ff9c9c", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.08em" }}>{row.label}</div>
                  <div style={{ color: "#ffdada", fontSize: 18, fontWeight: 800, marginTop: 6 }}>{row.value}</div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(2,minmax(280px,1fr))", gap: 12, marginBottom: 14 }}>
            {(Object.keys(PROFILES) as ProfileId[]).map((profileId) => {
              const profile = PROFILES[profileId];
              const differenceCount =
                countDifferences(dashboardConfig, profile.dashboardPatch) +
                countDifferences(lockdownConfig, profile.lockdownPatch) +
                countDifferences(raidConfig, profile.raidPatch);

              return (
                <div key={profileId} style={card}>
                  <h3 style={{ marginTop: 0, color: "#ff4444" }}>{profile.title}</h3>
                  <div style={{ marginBottom: 8 }}>{profile.subtitle}</div>
                  <div style={{ color: "#ffbcbc", fontSize: 13, lineHeight: 1.6, marginBottom: 10 }}>
                    {differenceCount === 0 ? "Already matches the live guild posture." : `${differenceCount} live setting differences from the current posture.`}
                  </div>
                  <div style={{ color: "#ffbcbc", fontSize: 13, lineHeight: 1.6, marginBottom: 12 }}>
                    Lockdown mentions: {String(profile.lockdownPatch.mentionThresholdPerMinute)} | Raid burst:{" "}
                    {String(profile.raidPatch.joinBurstThreshold)} | Raid preset: {String(profile.raidPatch.actionPreset)}
                  </div>
                  <button style={btn} onClick={() => void applyProfile(profileId)} disabled={applying.length > 0}>
                    {applying === profileId ? "Applying..." : `Apply ${profile.title}`}
                  </button>
                </div>
              );
            })}
          </div>

          <div style={card}>
            <h3 style={{ marginTop: 0, color: "#ff4444" }}>Refresh Live Posture</h3>
            <div style={{ color: "#ffbcbc", marginBottom: 10 }}>
              Use refresh if a different operator changed the live security engines and you want the comparison to update without leaving the page.
            </div>
            <button style={btn} onClick={() => void reload(guildId)} disabled={loading}>
              Refresh
            </button>
          </div>
        </>
      )}
    </div>
  );
}
