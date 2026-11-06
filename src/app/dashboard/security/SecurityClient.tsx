"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type CSSProperties } from "react";

type SummaryRow = {
  label: string;
  value: string;
};

type RuntimePayload = {
  config?: Record<string, any>;
  summary?: SummaryRow[];
};

type DashboardConfig = {
  features?: Record<string, boolean>;
};

type MasterControl = {
  id: string;
  title: string;
  detail: string;
  route: string;
  mode: "feature" | "engine";
  featureKey?: string;
  engine: string;
};

type RuntimeCard = {
  engine: string;
  title: string;
  detail: string;
  route: string;
};

const MASTER_CONTROLS: MasterControl[] = [
  {
    id: "feature:governanceEnabled",
    title: "Governance Feature Gate",
    detail: "Master security feature flag used by the governance-driven security stack.",
    route: "/dashboard/governance",
    mode: "feature",
    featureKey: "governanceEnabled",
    engine: "security.governance",
  },
  {
    id: "feature:onboardingEnabled",
    title: "Onboarding Feature Gate",
    detail: "Controls whether the onboarding join flow is live for this guild.",
    route: "/dashboard/security/onboarding",
    mode: "feature",
    featureKey: "onboardingEnabled",
    engine: "onboarding",
  },
  {
    id: "feature:verificationEnabled",
    title: "Verification Feature Gate",
    detail: "Controls whether verification decisions and follow-up staff actions are live.",
    route: "/dashboard/security/verification",
    mode: "feature",
    featureKey: "verificationEnabled",
    engine: "verification",
  },
  {
    id: "engine:lockdown",
    title: "Lockdown Engine",
    detail: "Emergency containment thresholds, exempt roles, and channel scope.",
    route: "/dashboard/security/lockdown",
    mode: "engine",
    engine: "lockdown",
  },
  {
    id: "engine:raid",
    title: "Raid Engine",
    detail: "Join burst detection, escalation windows, and raid action presets.",
    route: "/dashboard/security/raid",
    mode: "engine",
    engine: "raid",
  },
  {
    id: "engine:security.governance",
    title: "Security Governance Engine",
    detail: "Approval routing, emergency governance state, and security queue oversight.",
    route: "/dashboard/governance",
    mode: "engine",
    engine: "security.governance",
  },
  {
    id: "engine:security.enforcer",
    title: "Security Enforcer Engine",
    detail: "Execution path for governance-approved enforcement actions.",
    route: "/dashboard/security-enforcer",
    mode: "engine",
    engine: "security.enforcer",
  },
];

const LIVE_STACK: RuntimeCard[] = [
  {
    engine: "preOnboarding",
    title: "Pre-Onboarding",
    detail: "Blacklist rejoin bans, refusal-role handling, and enforcement DM copy.",
    route: "/dashboard/security/pre-onboarding",
  },
  {
    engine: "onboarding",
    title: "Onboarding",
    detail: "Welcome channels, onboarding templates, and post-verify routing.",
    route: "/dashboard/security/onboarding",
  },
  {
    engine: "verification",
    title: "Verification",
    detail: "Decline/timeout policy, kick reasons, and verification replies.",
    route: "/dashboard/security/verification",
  },
  {
    engine: "lockdown",
    title: "Lockdown",
    detail: "Join and mention thresholds, exemptions, and emergency escalation.",
    route: "/dashboard/security/lockdown",
  },
  {
    engine: "raid",
    title: "Raid",
    detail: "Burst thresholds, action presets, and auto-escalation behavior.",
    route: "/dashboard/security/raid",
  },
  {
    engine: "security.accountIntegrity",
    title: "Account Integrity",
    detail: "Account-age and identity risk thresholds with alert/review routing.",
    route: "/dashboard/security/account-integrity",
  },
  {
    engine: "security.behavioralDrift",
    title: "Behavioral Drift",
    detail: "Behavior anomaly scoring, decay, and monitored-channel scope.",
    route: "/dashboard/security/behavioral-drift",
  },
  {
    engine: "security.linkIntel",
    title: "Link Intel",
    detail: "Allowlists, blocklists, monitored channels, and link review flow.",
    route: "/dashboard/security/link-intel",
  },
  {
    engine: "security.threatIntel",
    title: "Threat Intel",
    detail: "Threat weighting, escalation thresholds, and auto-escalation policy.",
    route: "/dashboard/security/threat-intel",
  },
  {
    engine: "security.trustWeight",
    title: "Trust Weight",
    detail: "Trust floor scoring and trusted-role adjustments.",
    route: "/dashboard/security/trust-weight",
  },
  {
    engine: "security.riskEscalation",
    title: "Risk Escalation",
    detail: "Threshold-triggered escalation policy and approval requirements.",
    route: "/dashboard/security/risk-escalation",
  },
  {
    engine: "security.containment",
    title: "Containment",
    detail: "Slowmode, duration, target-channel scope, and notify-role routing.",
    route: "/dashboard/security/containment",
  },
  {
    engine: "security.shadowLayer",
    title: "Shadow Layer",
    detail: "Suppression mode, duration, and review/log channels.",
    route: "/dashboard/security/shadow-layer",
  },
  {
    engine: "security.forensics",
    title: "Forensics",
    detail: "Audit window, action burst limits, and forensics logging.",
    route: "/dashboard/security/forensics",
  },
  {
    engine: "security.staffActivityMonitor",
    title: "Staff Activity",
    detail: "Moderator/staff action thresholds, history window, and alerts.",
    route: "/dashboard/security/staff-activity",
  },
  {
    engine: "security.crewSecurity",
    title: "Crew Security",
    detail: "Crew warfare security thresholds and protected control routes.",
    route: "/dashboard/security/crew-security",
  },
  {
    engine: "security.governance",
    title: "Security Governance",
    detail: "Governance queue state, approvals, and emergency security posture.",
    route: "/dashboard/governance",
  },
  {
    engine: "security.enforcer",
    title: "Security Enforcer",
    detail: "Enforcement queue execution and delivery state.",
    route: "/dashboard/security-enforcer",
  },
];

const OPERATOR_TABS = [
  { label: "Moderator", href: "/dashboard/moderator", desc: "Live moderation runtime, logging, command controls, and immunity roles." },
  { label: "Audit Trail", href: "/dashboard/security/audit-trail", desc: "Retention, export routing, and audit visibility controls." },
  { label: "Automation Studio", href: "/dashboard/security/automation-studio", desc: "Rule automation surface for security actions." },
  { label: "Profiles", href: "/dashboard/security/profiles", desc: "Security presets and operator profile overlays." },
  { label: "Policy", href: "/dashboard/security/policy", desc: "Security policy surface layered on top of moderation/security controls." },
  { label: "Welcome + Goodbye", href: "/dashboard/security/welcome-goodbye", desc: "Join/leave message presentation and welcome card controls." },
  { label: "Slash Command Master", href: "/dashboard/slash-commands", desc: "Separate native command control surface for built-in slash commands." },
];

const box: CSSProperties = {
  border: "1px solid #6f0000",
  borderRadius: 12,
  padding: 14,
  background: "rgba(120,0,0,0.08)",
  marginBottom: 14,
};

const buttonStyle: CSSProperties = {
  border: "1px solid #a30000",
  borderRadius: 10,
  background: "#1a0000",
  color: "#ffcccc",
  padding: "8px 12px",
  cursor: "pointer",
  fontWeight: 700,
};

function getGuildId(): string {
  if (typeof window === "undefined") return "";
  const fromUrl = new URLSearchParams(window.location.search).get("guildId") || "";
  const fromStore = localStorage.getItem("activeGuildId") || "";
  const guildId = (fromUrl || fromStore).trim();
  if (guildId) localStorage.setItem("activeGuildId", guildId);
  return guildId;
}

function guildHref(href: string, guildId: string) {
  if (!guildId) return href;
  const joiner = href.includes("?") ? "&" : "?";
  return `${href}${joiner}guildId=${encodeURIComponent(guildId)}`;
}

function pill(on: boolean): CSSProperties {
  return {
    display: "inline-block",
    padding: "4px 10px",
    borderRadius: 999,
    border: `1px solid ${on ? "#1f8a3f" : "#8a2f2f"}`,
    color: on ? "#88ffb1" : "#ff9a9a",
    fontWeight: 800,
    fontSize: 12,
    letterSpacing: "0.06em",
  };
}

function runtimeEnabled(payload?: RuntimePayload | null) {
  const config = payload?.config || {};
  if (config.enabled === false) return false;
  if (config.active === false) return false;
  return true;
}

function summaryRows(payload?: RuntimePayload | null) {
  return Array.isArray(payload?.summary) ? payload!.summary!.slice(0, 3) : [];
}

async function readJsonSafe(res: Response) {
  return res.json().catch(() => ({}));
}

export default function SecurityPage() {
  const [guildId, setGuildId] = useState("");
  const [guildName, setGuildName] = useState("");
  const [dashboard, setDashboard] = useState<DashboardConfig>({});
  const [runtime, setRuntime] = useState<Record<string, RuntimePayload>>({});
  const [loading, setLoading] = useState(true);
  const [pendingKey, setPendingKey] = useState("");
  const [msg, setMsg] = useState("");

  useEffect(() => {
    const nextGuildId = getGuildId();
    setGuildId(nextGuildId);
    if (typeof window !== "undefined") {
      setGuildName(localStorage.getItem("activeGuildName") || "");
    }
  }, []);

  async function loadAll(targetGuildId: string) {
    if (!targetGuildId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setMsg("");

      const dashboardRes = await fetch(`/api/bot/dashboard-config?guildId=${encodeURIComponent(targetGuildId)}`, {
        cache: "no-store",
      });
      const dashboardJson = await readJsonSafe(dashboardRes);
      setDashboard(dashboardJson?.config || {});

      const engines = [...new Set([...MASTER_CONTROLS.map((item) => item.engine), ...LIVE_STACK.map((item) => item.engine)])];
      const runtimeEntries = await Promise.all(
        engines.map(async (engine) => {
          const res = await fetch(
            `/api/runtime/engine?guildId=${encodeURIComponent(targetGuildId)}&engine=${encodeURIComponent(engine)}`,
            { cache: "no-store" }
          );
          const json = await readJsonSafe(res);
          return [engine, { config: json?.config || {}, summary: Array.isArray(json?.summary) ? json.summary : [] }] as const;
        })
      );

      setRuntime(Object.fromEntries(runtimeEntries));
    } catch (error: any) {
      setMsg(error?.message || "Failed to load security runtime.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadAll(guildId);
  }, [guildId]);

  const featureFlags = useMemo(() => dashboard?.features || {}, [dashboard]);

  const controlCards = useMemo(
    () =>
      MASTER_CONTROLS.map((item) => {
        const payload = runtime[item.engine];
        const enabled = item.mode === "feature" ? Boolean(featureFlags[item.featureKey || ""]) : runtimeEnabled(payload);
        return {
          ...item,
          enabled,
          summary: summaryRows(payload),
        };
      }),
    [featureFlags, runtime]
  );

  const runtimeCards = useMemo(
    () =>
      LIVE_STACK.map((item) => ({
        ...item,
        enabled: runtimeEnabled(runtime[item.engine]),
        summary: summaryRows(runtime[item.engine]),
      })),
    [runtime]
  );

  async function toggleControl(item: MasterControl, nextValue: boolean) {
    if (!guildId) return;

    setPendingKey(item.id);
    setMsg("");
    try {
      if (item.mode === "feature" && item.featureKey) {
        const res = await fetch("/api/bot/dashboard-config", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            guildId,
            patch: {
              features: {
                [item.featureKey]: nextValue,
              },
            },
          }),
        });
        const json = await readJsonSafe(res);
        if (!res.ok || json?.success === false) {
          throw new Error(json?.error || `Failed to update ${item.title}.`);
        }
      } else {
        const res = await fetch("/api/runtime/engine", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            guildId,
            engine: item.engine,
            patch: {
              enabled: nextValue,
            },
          }),
        });
        const json = await readJsonSafe(res);
        if (!res.ok || json?.success === false) {
          throw new Error(json?.error || `Failed to update ${item.title}.`);
        }
      }

      setMsg(`${item.title} updated.`);
      await loadAll(guildId);
    } catch (error: any) {
      setMsg(error?.message || `Failed to update ${item.title}.`);
    } finally {
      setPendingKey("");
    }
  }

  if (!guildId) {
    return <div style={{ color: "#ff6b6b", padding: 24 }}>Missing guildId. Open from `/guilds` first.</div>;
  }

  return (
    <div style={{ color: "#ffd0d0", padding: 18, maxWidth: 1440 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        <div>
          <div style={{ color: "#ff9a9a", fontSize: 12, letterSpacing: "0.16em", textTransform: "uppercase" }}>Security Runtime</div>
          <h1 style={{ margin: "8px 0 0", color: "#ff4f4f", letterSpacing: "0.10em", textTransform: "uppercase" }}>Security Command Center</h1>
          <div style={{ color: "#ff8d8d", marginTop: 8 }}>Guild: {guildName || guildId}</div>
        </div>
        <button style={{ ...buttonStyle, cursor: "default", opacity: 0.85 }} disabled>
          Live Runtime Surface
        </button>
      </div>

      <div style={{ marginTop: 10, color: "#ffb1b1", lineHeight: 1.7, maxWidth: 1160 }}>
        This surface now reads live bot feature flags and live engine runtime data. Every control on this page maps to a real runtime path, and every deeper
        engine card opens the dedicated engine surface for full adjustment.
      </div>

      {msg ? <div style={{ ...box, color: "#ffb3f0" }}>{msg}</div> : null}

      {loading ? (
        <div style={box}>Loading security runtime...</div>
      ) : (
        <>
          <section style={box}>
            <h2 style={{ marginTop: 0, color: "#ff5b5b", letterSpacing: "0.08em", textTransform: "uppercase" }}>Master Controls</h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))", gap: 12 }}>
              {controlCards.map((item) => (
                <div key={item.id} style={{ border: "1px solid #4f0000", borderRadius: 10, padding: 14, background: "#100000" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
                    <div>
                      <div style={{ color: "#ff5252", fontWeight: 900, letterSpacing: "0.06em", textTransform: "uppercase" }}>{item.title}</div>
                      <div style={{ marginTop: 6, color: "#ffbcbc", fontSize: 13, lineHeight: 1.5 }}>{item.detail}</div>
                    </div>
                    <span style={pill(item.enabled)}>{item.enabled ? "ON" : "OFF"}</span>
                  </div>

                  <div style={{ marginTop: 12, display: "grid", gap: 6 }}>
                    {item.summary.length ? (
                      item.summary.map((row) => (
                        <div key={`${item.id}:${row.label}`} style={{ color: "#ffbcbc", fontSize: 13 }}>
                          <b>{row.label}:</b> {row.value}
                        </div>
                      ))
                    ) : (
                      <div style={{ color: "#ffbcbc", fontSize: 13 }}>No live summary returned yet.</div>
                    )}
                  </div>

                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center", marginTop: 14, flexWrap: "wrap" }}>
                    <label style={{ display: "inline-flex", alignItems: "center", gap: 8, fontWeight: 700, color: "#ffdcdc" }}>
                      <input
                        type="checkbox"
                        checked={item.enabled}
                        disabled={pendingKey === item.id}
                        onChange={(event) => void toggleControl(item, event.target.checked)}
                      />
                      {pendingKey === item.id ? "Saving..." : "Enabled"}
                    </label>

                    <Link
                      href={guildHref(item.route, guildId)}
                      style={{
                        textDecoration: "none",
                        border: "1px solid #7a0000",
                        borderRadius: 8,
                        padding: "6px 10px",
                        color: "#ffd0d0",
                        background: "#140000",
                        fontWeight: 700,
                      }}
                    >
                      Open Engine
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section style={box}>
            <h2 style={{ marginTop: 0, color: "#ff5b5b", letterSpacing: "0.08em", textTransform: "uppercase" }}>Live Engine Coverage</h2>
            <div style={{ color: "#ffb1b1", marginBottom: 12 }}>
              This list is pulled from live runtime engine paths. Use it to verify what is actually wired and to jump into the deeper per-engine controls.
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))", gap: 12 }}>
              {runtimeCards.map((item) => (
                <div key={item.engine} style={{ border: "1px solid #4f0000", borderRadius: 10, padding: 14, background: "#100000" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
                    <div style={{ color: "#ff5252", fontWeight: 900, letterSpacing: "0.06em", textTransform: "uppercase" }}>{item.title}</div>
                    <span style={pill(item.enabled)}>{item.enabled ? "ON" : "OFF"}</span>
                  </div>

                  <div style={{ marginTop: 8, color: "#ffbcbc", fontSize: 13, lineHeight: 1.5 }}>{item.detail}</div>

                  <div style={{ marginTop: 12, display: "grid", gap: 6 }}>
                    {item.summary.length ? (
                      item.summary.map((row) => (
                        <div key={`${item.engine}:${row.label}`} style={{ color: "#ffbcbc", fontSize: 13 }}>
                          <b>{row.label}:</b> {row.value}
                        </div>
                      ))
                    ) : (
                      <div style={{ color: "#ffbcbc", fontSize: 13 }}>No live summary returned yet.</div>
                    )}
                  </div>

                  <Link
                    href={guildHref(item.route, guildId)}
                    style={{
                      marginTop: 14,
                      display: "inline-block",
                      textDecoration: "none",
                      border: "1px solid #7a0000",
                      borderRadius: 8,
                      padding: "6px 10px",
                      color: "#ffd0d0",
                      background: "#140000",
                      fontWeight: 700,
                    }}
                  >
                    Open Engine
                  </Link>
                </div>
              ))}
            </div>
          </section>

          <section style={box}>
            <h2 style={{ marginTop: 0, color: "#ff5b5b", letterSpacing: "0.08em", textTransform: "uppercase" }}>Operator Tabs</h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))", gap: 12 }}>
              {OPERATOR_TABS.map((item) => (
                <Link
                  key={item.href}
                  href={guildHref(item.href, guildId)}
                  style={{
                    display: "block",
                    border: "1px solid #5f0000",
                    borderRadius: 10,
                    padding: 12,
                    background: "#100000",
                    textDecoration: "none",
                    color: "#ffd0d0",
                  }}
                >
                  <div style={{ color: "#ff4d4d", fontWeight: 800, marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                    {item.label}
                  </div>
                  <div style={{ fontSize: 13, lineHeight: 1.5, color: "#ffbcbc" }}>{item.desc}</div>
                </Link>
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
