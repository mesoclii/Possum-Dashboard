"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, type CSSProperties } from "react";
import PlanTierPicker from "@/components/possum/PlanTierPicker";
import { useDashboardSessionState } from "@/components/possum/useDashboardSessionState";
import { buildDashboardHref, readDashboardGuildId } from "@/lib/dashboardContext";
import { fetchGuildData } from "@/lib/liveRuntime";
import { buildPublicInviteUrl, buildSupportServerUrl } from "@/lib/publicLinks";
import { PRICING_FOOTNOTE, PREMIUM_FEATURES } from "@/lib/premiumCatalog";

type SubscriptionStatus = {
  active: boolean;
  plan: string;
  premiumTier: string | null;
  source: string;
  premiumExpiresAt: string | null;
  scope: "guild" | "global";
  inheritedFrom: string | null;
  developerBypass?: boolean;
};

const card: CSSProperties = {
  border: "1px solid rgba(255,0,0,.36)",
  borderRadius: 16,
  padding: 18,
  background: "linear-gradient(180deg, rgba(100,0,0,.12), rgba(0,0,0,.70))",
};

const action: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  borderRadius: 12,
  padding: "10px 14px",
  fontWeight: 900,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  textDecoration: "none",
};

export default function PremiumFeaturesClient() {
  const { isMasterOwner } = useDashboardSessionState();
  const guildId = readDashboardGuildId();
  const [status, setStatus] = useState<SubscriptionStatus | null>(null);
  const [statusMsg, setStatusMsg] = useState("");
  const [canManagePremium, setCanManagePremium] = useState(false);
  const [saving, setSaving] = useState(false);
  const [grantScope, setGrantScope] = useState<"guild" | "global">("guild");
  const [trialDays, setTrialDays] = useState(0);
  const [guildName, setGuildName] = useState("");

  useEffect(() => {
    setGuildName(localStorage.getItem("activeGuildName") || "");
    if (!guildId) return;
    fetchGuildData(guildId)
      .then((json: any) => {
        const name = String(json?.guild?.name || "").trim();
        if (name) {
          setGuildName(name);
          localStorage.setItem("activeGuildName", name);
        }
      })
      .catch(() => null);
  }, [guildId]);

  const loadStatus = useCallback(async () => {
    if (!guildId) return;
    const res = await fetch(`/api/subscriptions/status?guildId=${encodeURIComponent(guildId)}`, {
      cache: "no-store",
    }).catch(() => null);
    const json = await res?.json().catch(() => ({}));
    if (!res || !res.ok || json?.success === false) {
      setStatusMsg(json?.error || "Failed to load premium status.");
      return;
    }
    setStatus(json?.status || null);
    setGrantScope(json?.status?.scope === "global" ? "global" : "guild");
    setCanManagePremium(Boolean(json?.canManagePremium));
    setStatusMsg("");
  }, [guildId]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("success") === "true") setStatusMsg("Payment received. Premium activates within a few seconds; refresh if it does not show.");
    else if (params.get("cancel") === "true") setStatusMsg("Checkout canceled. You were not charged.");
  }, []);

  useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

  async function savePlan(active: boolean, plan: string) {
    if (!guildId) return;
    setSaving(true);
    setStatusMsg("");
    try {
      const res = await fetch("/api/subscriptions/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          guildId,
          active,
          plan,
          premiumTier: active ? plan : null,
          scope: grantScope,
          trialDays: active ? trialDays : 0,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json?.success === false) {
        throw new Error(json?.error || "Failed to update premium plan.");
      }
      setStatus(json?.status || null);
      setCanManagePremium(Boolean(json?.canManagePremium));
      setStatusMsg(
        active
          ? `${plan} enabled for ${grantScope === "global" ? "the admin trial scope" : "this guild"}${trialDays > 0 ? ` for ${trialDays} day(s)` : ""}.`
          : `Premium disabled for ${grantScope === "global" ? "the admin trial scope" : "this guild"}.`
      );
    } catch (error: any) {
      setStatusMsg(error?.message || "Failed to update premium plan.");
    } finally {
      setSaving(false);
    }
  }

  async function startCheckout(plan: "monthly" | "yearly" | "lifetime" | "ai_addon") {
    if (!guildId) {
      setStatusMsg("Select a server first.");
      return;
    }
    setSaving(true);
    setStatusMsg("");
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ guildId, plan }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json?.success === false || !json?.url) {
        throw new Error(json?.error || "Checkout failed.");
      }
      window.location.href = json.url;
    } catch (error: any) {
      setStatusMsg(error?.message || "Checkout failed.");
      setSaving(false);
    }
  }

  const stateLabel = status?.developerBypass
    ? "Developer Access"
    : status?.active
      ? `${status.plan} Active (${status.scope === "global" ? "Global Trial" : "Guild"})`
      : "Premium Off";
  const visiblePremiumFeatures = PREMIUM_FEATURES.filter((feature) => !feature.creatorOnly || isMasterOwner);

  return (
    <div style={{ color: "#ffd0d0", maxWidth: 1380 }}>
      <section id="premium-addons" style={{ ...card, marginBottom: 16 }}>
        <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1.3fr) minmax(320px,0.8fr)", gap: 18 }}>
          <div>
            <div style={{ color: "#ff9a9a", fontSize: 12, letterSpacing: "0.18em", textTransform: "uppercase" }}>
              Paid Guild Features
            </div>
            <h1
              style={{
                marginTop: 10,
                marginBottom: 8,
                color: "#ff4a4a",
                letterSpacing: "0.10em",
                textTransform: "uppercase",
                fontSize: "clamp(2rem, 4vw, 3.6rem)",
              }}
            >
              Premium Features
            </h1>
            <p style={{ color: "#ffb5b5", lineHeight: 1.7, maxWidth: 860 }}>
              This page only lists paid guild add-ons, plan pricing, and master-owner trial controls. Standard features
              stay out of this surface, and Pokemon remains private-only. Paid plans are enforced per guild. Global
              grants on this page are internal master-owner trial tools, not customer billing behavior. Creator AI
              platform controls stay off the public catalog and only appear for bot creators.
            </p>
            <div style={{ color: "#ffb0b0", fontSize: 12, marginTop: 10 }}>
              Feature requests and fixes can be suggested in{" "}
              <a href={buildSupportServerUrl()} target="_blank" rel="noopener noreferrer" style={{ color: "#ff9f9f", fontWeight: 700 }}>
                Join Possum Bot Support
              </a>
              .
            </div>
          </div>

          <div style={{ ...card, margin: 0 }}>
            <div style={{ color: "#ff9a9a", fontSize: 12, letterSpacing: "0.16em", textTransform: "uppercase" }}>
              Current Guild
            </div>
            <div style={{ color: "#fff0f0", fontSize: 28, fontWeight: 900, marginTop: 8 }}>{guildName && guildName !== guildId ? guildName : guildId || "No guild selected"}</div>
            <div style={{ color: "#ffd7d7", fontSize: 14, marginTop: 10 }}>
              {stateLabel}
              {status?.premiumTier ? ` | ${status.premiumTier}` : ""}
            </div>
            {status?.premiumExpiresAt ? (
              <div style={{ color: "#ffb7b7", fontSize: 12, marginTop: 6 }}>
                Expires: {new Date(status.premiumExpiresAt).toLocaleString()}
              </div>
            ) : null}
            {status?.scope === "global" && status?.inheritedFrom ? (
              <div style={{ color: "#ffb7b7", fontSize: 12, marginTop: 6 }}>
                This guild is inheriting an internal global admin entitlement.
              </div>
            ) : null}
            {statusMsg ? <div style={{ color: "#ffb0b0", fontSize: 12, marginTop: 8 }}>{statusMsg}</div> : null}
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 14 }}>
              <a
                href={buildPublicInviteUrl()}
                target="_blank"
                rel="noreferrer"
                style={{ ...action, color: "#160000", background: "linear-gradient(90deg, #ff4141, #ff2bd6)" }}
              >
                Invite Bot
              </a>
              <Link
                href="/features"
                style={{
                  ...action,
                  color: "#ffd7d7",
                  border: "1px solid rgba(255,0,0,.45)",
                  background: "#130707",
                }}
              >
                Features Page
              </Link>
            </div>
          </div>
        </div>
      </section>

      {canManagePremium ? (
        <section style={{ ...card, marginBottom: 16 }}>
          <div
            style={{
              color: "#ff9a9a",
              fontSize: 12,
              letterSpacing: "0.16em",
              textTransform: "uppercase",
              marginBottom: 12,
            }}
          >
            Master Owner Trial Controls
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", marginBottom: 12 }}>
            <button
              type="button"
              disabled={saving}
              onClick={() => setGrantScope("guild")}
              style={{
                ...action,
                cursor: saving ? "wait" : "pointer",
                color: grantScope === "guild" ? "#190000" : "#ffd7d7",
                background: grantScope === "guild" ? "linear-gradient(90deg, #ff4141, #ff2bd6)" : "#130707",
                border: "1px solid rgba(255,0,0,.45)",
              }}
            >
              Guild Scope
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={() => setGrantScope("global")}
              style={{
                ...action,
                cursor: saving ? "wait" : "pointer",
                color: grantScope === "global" ? "#190000" : "#ffd7d7",
                background: grantScope === "global" ? "linear-gradient(90deg, #ff4141, #ff2bd6)" : "#130707",
                border: "1px solid rgba(255,0,0,.45)",
              }}
            >
              Global Trial
            </button>
            <label style={{ color: "#ffbdbd", fontSize: 12 }}>
              Trial Days
              <input
                type="number"
                min={0}
                max={365}
                value={trialDays}
                onChange={(e) => setTrialDays(Math.max(0, Math.min(365, Math.trunc(Number(e.target.value || 0)))))}
                style={{ marginLeft: 8, width: 90, padding: "8px 10px", borderRadius: 10, border: "1px solid rgba(255,0,0,.45)", background: "#130707", color: "#ffd7d7" }}
              />
            </label>
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button
              type="button"
              disabled={saving}
              onClick={() => void savePlan(true, "PRO")}
              style={{
                ...action,
                cursor: saving ? "wait" : "pointer",
                color: "#ffd7d7",
                border: "1px solid rgba(255,0,0,.45)",
                background: "#130707",
              }}
            >
              Grant Pro
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={() => void savePlan(true, "BUSINESS")}
              style={{
                ...action,
                cursor: saving ? "wait" : "pointer",
                color: "#ffd7d7",
                border: "1px solid rgba(255,0,0,.45)",
                background: "#130707",
              }}
            >
              Grant Business
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={() => void savePlan(true, "ENTERPRISE")}
              style={{
                ...action,
                cursor: saving ? "wait" : "pointer",
                color: "#ffd7d7",
                border: "1px solid rgba(255,0,0,.45)",
                background: "#130707",
              }}
            >
              Grant Enterprise
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={() => void savePlan(false, "FREE")}
              style={{
                ...action,
                cursor: saving ? "wait" : "pointer",
                color: "#ffd7d7",
                border: "1px solid rgba(255,160,0,.45)",
                background: "rgba(70,35,0,0.46)",
              }}
            >
              Set Free
            </button>
          </div>
          <div style={{ color: "#ffb0b0", fontSize: 12, marginTop: 10 }}>
            Guild Scope writes a single guild entitlement. Global Trial writes the internal account-wide admin trial record for your current owner account.
          </div>
        </section>
      ) : null}

      <section style={{ ...card, marginBottom: 16 }}>
        <div
          style={{
            color: "#ffd39a",
            fontSize: 12,
            letterSpacing: "0.16em",
            textTransform: "uppercase",
            marginBottom: 12,
          }}
        >
          Premium Add-Ons
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))", gap: 14 }}>
          {visiblePremiumFeatures.map((feature) => (
            <div key={feature.id} style={{ ...card, margin: 0 }}>
              <div style={{ color: "#ffd49a", fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase" }}>
                {feature.premiumLabel}
              </div>
              <div
                style={{
                  color: "#ff5a5a",
                  fontWeight: 900,
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                  fontSize: 22,
                  marginTop: 10,
                }}
              >
                {feature.label}
              </div>
              <div style={{ color: "#ffd0d0", lineHeight: 1.65, marginTop: 10 }}>{feature.summary}</div>
              <div style={{ color: "#ffb7b7", fontSize: 12, marginTop: 10 }}>Included in: {feature.includedIn.join(", ")}</div>
              <div style={{ color: "#ffb7b7", fontSize: 12, marginTop: 8 }}>{feature.pricingNote}</div>
              <Link
                href={buildDashboardHref(feature.route)}
                style={{
                  display: "inline-block",
                  textDecoration: "none",
                  marginTop: 14,
                  borderRadius: 12,
                  border: "1px solid rgba(255,0,0,.45)",
                  padding: "10px 14px",
                  fontWeight: 900,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  color: "#ffd7d7",
                  background: "#130707",
                }}
              >
                Open
              </Link>
            </div>
          ))}
        </div>
      </section>

      <section id="advanced-security" style={{ ...card, marginBottom: 16 }}>
        <div style={{ color: "#ffd39a", fontSize: 12, letterSpacing: "0.16em", textTransform: "uppercase", marginBottom: 12 }}>
          Advanced Security + Governance
        </div>
        <div style={{ color: "#ffd0d0", lineHeight: 1.7, maxWidth: 1040 }}>
          Free keeps the safety baseline intact: failsafe, basic governance status, blacklist controls, and basic enforcer
          deny/timeout/quarantine actions. Premium only unlocks the intelligence and automation layer on top.
        </div>
        <div style={{ color: "#ffb7b7", fontSize: 13, lineHeight: 1.7, marginTop: 12 }}>
          <div>Threat Intel</div>
          <div>Link Intelligence</div>
          <div>Behavioral Drift</div>
          <div>Trust Weighting</div>
          <div>Risk Escalation</div>
          <div>Auto Containment</div>
          <div>Governance approval workflow enhancements</div>
        </div>
      </section>

      <section id="automation-suite" style={{ ...card, marginBottom: 16 }}>
        <div style={{ color: "#ffd39a", fontSize: 12, letterSpacing: "0.16em", textTransform: "uppercase", marginBottom: 12 }}>
          Automation + Custom Commands
        </div>
        <div style={{ color: "#ffd0d0", lineHeight: 1.7, maxWidth: 1040 }}>
          Free keeps the operating baseline. Premium expands automation depth, higher execution limits, multi-step action
          chains, and elevated custom-command scale for guilds that need more than the starter cap.
        </div>
        <div style={{ color: "#ffb7b7", fontSize: 13, lineHeight: 1.7, marginTop: 12 }}>
          <div>Advanced automation rules</div>
          <div>Higher execution and throughput limits</div>
          <div>Multi-step action chains</div>
          <div>Elevated custom-command capacity</div>
        </div>
      </section>

      <section style={card}>
        <div
          style={{
            color: "#ff9a9a",
            fontSize: 12,
            letterSpacing: "0.16em",
            textTransform: "uppercase",
            marginBottom: 12,
          }}
        >
          Plan Pricing
        </div>
        <PlanTierPicker onBuy={(key) => void startCheckout(key)} disabled={saving} />
        <div style={{ marginTop: 18, paddingTop: 14, borderTop: "1px solid rgba(255,0,0,.25)" }}>
          <div style={{ color: "#fff1c7", fontSize: 14, marginBottom: 8 }}>
            Need more AI than the monthly allowance? Add extra usage to any plan.
          </div>
          <button
            type="button"
            disabled={saving}
            onClick={() => void startCheckout("ai_addon")}
            style={{ ...action, border: "1px solid rgba(255,0,0,.5)", background: "rgba(120,0,0,.35)", color: "#fff1c7", cursor: "pointer", fontSize: 12 }}
          >
            AI Add-on
          </button>
        </div>
        <div style={{ color: "#ffb8b8", fontSize: 12, marginTop: 14 }}>{PRICING_FOOTNOTE}</div>
      </section>
    </div>
  );
}

