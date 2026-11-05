"use client";

import Link from "next/link";
import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { buildDashboardHref } from "@/lib/dashboardContext";
import { DEV_MODE } from "@/lib/devMode";
import { isPremiumEnforcementEnabled } from "@/lib/premiumMode";

type PremiumGateProps = {
  featureKey: string;
  featureLabel: string;
  children: ReactNode;
};

const panel: CSSProperties = {
  border: "1px solid rgba(255,0,0,.36)",
  borderRadius: 12,
  padding: 16,
  background: "rgba(100,0,0,.10)",
  color: "#ffd0d0",
};

const action: CSSProperties = {
  border: "1px solid #7a0000",
  borderRadius: 10,
  background: "#130707",
  color: "#ffd7d7",
  padding: "10px 12px",
  fontWeight: 800,
  letterSpacing: "0.06em",
  textTransform: "uppercase",
  cursor: "pointer",
  textDecoration: "none",
  display: "inline-block",
};

function resolveGuildId() {
  if (typeof window === "undefined") return "";
  const params = new URLSearchParams(window.location.search);
  return String(params.get("guildId") || localStorage.getItem("activeGuildId") || "").trim();
}

export default function PremiumGate({ featureKey, featureLabel, children }: PremiumGateProps) {
  const premiumEnforced = isPremiumEnforcementEnabled();
  const [guildId, setGuildId] = useState("");
  const [loading, setLoading] = useState(true);
  const [allowed, setAllowed] = useState(false);
  const [plan, setPlan] = useState("FREE");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!premiumEnforced || DEV_MODE) {
      setAllowed(true);
      setPlan(premiumEnforced ? "DEVELOPER ACCESS" : "UNLOCKED");
      setLoading(false);
      return;
    }

    const id = resolveGuildId();
    setGuildId(id);
    if (!id) {
      setLoading(false);
      setAllowed(false);
      return;
    }

    (async () => {
      try {
        setLoading(true);
        setError("");
        const res = await fetch(`/api/subscriptions/status?guildId=${encodeURIComponent(id)}`, { cache: "no-store" });
        const json = await res.json().catch(() => ({}));
        if (!res.ok || json?.success === false) {
          throw new Error(json?.error || "Failed to load subscription status.");
        }
        const developerBypass = Boolean(json?.status?.developerBypass);
        const plan = String(json?.status?.plan || "FREE").toLowerCase();
        const planRank = plan === "enterprise" ? 3 : plan === "business" || plan === "elite" ? 2 : plan === "pro" ? 1 : 0;
        const minimumRank = 1;
        const creatorAccess = Boolean(json?.canManagePremium);
        const planAllowed = Boolean(json?.status?.active) && planRank >= minimumRank;
        setAllowed(featureKey === "openai-platform" ? creatorAccess : planAllowed || developerBypass || DEV_MODE);
        setPlan(
          developerBypass || DEV_MODE
            ? "DEVELOPER ACCESS"
            : plan.toUpperCase()
        );
      } catch (err: any) {
        setAllowed(false);
        setError(err?.message || "Failed to load subscription status.");
      } finally {
        setLoading(false);
      }
    })();
  }, [featureKey, premiumEnforced]);

  if (loading) {
    return <div style={panel}>Checking premium access...</div>;
  }

  if (allowed) {
    return <>{children}</>;
  }

  return (
    <section style={panel}>
      <div style={{ color: "#ff9a9a", fontSize: 12, letterSpacing: "0.14em", textTransform: "uppercase" }}>
        Premium Required
      </div>
      <h1 style={{ marginTop: 8, color: "#ff4a4a", letterSpacing: "0.08em", textTransform: "uppercase" }}>
        {featureLabel}
      </h1>
      <p style={{ color: "#ffb5b5", lineHeight: 1.6 }}>
        {featureKey === "openai-platform"
          ? "This creator-only page is available only to bot owners."
          : `${featureLabel} requires an active ${["advanced-security", "automation-suite"].includes(featureKey) ? "Business or Enterprise" : "Pro, Business, or Enterprise"} plan before it can be configured live.`}
      </p>
      <div style={{ color: "#ffd7a6", fontSize: 13, marginBottom: 12 }}>
        Guild: {guildId || "Not selected"} | Current Plan: {plan}
      </div>
      <div style={{ color: "#ffb5b5", fontSize: 12, marginBottom: 12 }}>
        Feature key: {featureKey}
      </div>
      {error ? <div style={{ color: "#ffb5b5", marginBottom: 12 }}>{error}</div> : null}
      <Link href={buildDashboardHref("/dashboard/premium-features")} style={action}>
        Open Premium Features
      </Link>
    </section>
  );
}
