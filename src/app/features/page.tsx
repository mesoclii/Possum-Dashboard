"use client";

import { MarketingHeader, MarketingFooter } from "@/components/possum/MarketingSite";

import Link from "next/link";
import type { CSSProperties } from "react";
import { useEffect, useState } from "react";
import PlanTierPicker from "@/components/possum/PlanTierPicker";
import { buildPublicInviteUrl, buildSupportServerUrl } from "@/lib/publicLinks";
import { PRICING_FOOTNOTE, PREMIUM_FEATURES, STANDARD_FEATURES } from "@/lib/premiumCatalog";
import { usePublicFeatureVisibility } from "@/components/possum/usePublicFeatureVisibility";

type SessionState = {
  loggedIn: boolean;
  canEnterDashboard: boolean;
};

const shell: CSSProperties = {
  minHeight: "100vh",
  background:
    "transparent",
  color: "#ffe0f8",
  padding: "32px 24px 60px",
};

const card: CSSProperties = {
  border: "1px solid rgba(255,43,214,0.34)",
  borderRadius: 18,
  background: "linear-gradient(180deg, rgba(255,36,79,0.13), rgba(0,0,0,0.72))",
  padding: 18,
  boxShadow: "0 18px 50px rgba(0,0,0,0.32)",
};

const action: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  minWidth: 190,
  textDecoration: "none",
  borderRadius: 14,
  padding: "14px 16px",
  fontWeight: 900,
  letterSpacing: "0.12em",
  textTransform: "uppercase",
};

export default function FeaturesPage() {
  const [session, setSession] = useState<SessionState>({ loggedIn: false, canEnterDashboard: false });
  const featureVisibility = usePublicFeatureVisibility();
  const publicPremiumFeatures = PREMIUM_FEATURES.filter((feature) =>
    !feature.creatorOnly && featureVisibility?.[feature.id] === true
  );

  useEffect(() => {
    (async () => {
      const res = await fetch("/api/auth/session?brief=1", { cache: "no-store" }).catch(() => null);
      const json = await res?.json().catch(() => ({}));
      setSession({
        loggedIn: Boolean(json?.loggedIn),
        canEnterDashboard: Boolean(json?.canEnterDashboard),
      });
    })();
  }, []);

  const primaryActionHref = session.loggedIn && session.canEnterDashboard ? "/guilds" : buildPublicInviteUrl();
  const primaryActionLabel = session.loggedIn && session.canEnterDashboard ? "Select Guild" : "Invite Bot";
  const primaryActionProps =
    session.loggedIn && session.canEnterDashboard
      ? {}
      : { target: "_blank", rel: "noreferrer" };

  return (
    <>
      <MarketingHeader />
      <div style={shell}>
      <div style={{ maxWidth: 1480, margin: "0 auto" }}>
        <section style={{ ...card, padding: 28, marginBottom: 22 }}>
          <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1.2fr) minmax(320px,0.8fr)", gap: 20 }}>
            <div>
              <div style={{ color: "#ff8bea", fontSize: 14, letterSpacing: "0.24em", textTransform: "uppercase" }}>
                Public Feature List
              </div>
              <h1
                style={{
                  margin: "12px 0 10px",
                  color: "#ff2bd6",
                  fontSize: "clamp(2.8rem, 7vw, 5.6rem)",
                  lineHeight: 0.92,
                  letterSpacing: "0.12em",
                  textTransform: "uppercase",
                  textShadow: "0 0 28px rgba(255,43,214,0.42)",
                }}
              >
                Features
              </h1>
              <p style={{ fontSize: 16, lineHeight: 1.8, maxWidth: 920, color: "#ffe0f8" }}>
                Public guilds start on the standard ready stack so owners only need to set channels, messages,
                images, roles, webhooks, timers, and engine preferences. Premium features stay off until enabled by
                plan or trial. Pokemon remains private and is never part of the public catalog. One plan covers every
                server you own or staff in, and Possum Bot stays one of the most actively updated bots in active development.
              </p>
              <div style={{ color: "#ff9bea", fontSize: 13, marginTop: 10 }}>
                Feature requests and fixes can be suggested in{" "}
                <a href={buildSupportServerUrl()} target="_blank" rel="noopener noreferrer" style={{ color: "#ff70e2", fontWeight: 700 }}>
                  Join Possum Bot Support
                </a>
                .
              </div>
            </div>

            <div style={{ ...card, margin: 0 }}>
              <div style={{ color: "#ff8e8e", fontSize: 12, letterSpacing: "0.18em", textTransform: "uppercase" }}>
                Quick Actions
              </div>
              <div style={{ display: "grid", gap: 10, marginTop: 14 }}>
                <a
                  href={primaryActionHref}
                  style={{
                    ...action,
                    color: "#190000",
                    background: "linear-gradient(90deg, #ff2a4d, #ff2bd6)",
                  }}
                  {...primaryActionProps}
                >
                  {primaryActionLabel}
                </a>
                <Link
                  href="/"
                  style={{
                    ...action,
                    color: "#ffe0f8",
                    border: "1px solid rgba(255,43,214,0.5)",
                    background: "#130707",
                  }}
                >
                  Exit
                </Link>
              </div>
            </div>
          </div>
        </section>

        <section style={{ ...card, marginBottom: 22 }}>
          <div style={{ color: "#ff65df", fontSize: 13, letterSpacing: "0.18em", textTransform: "uppercase", marginBottom: 14 }}>
            Free Features (Included Standard Stack)
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))", gap: 12 }}>
            {STANDARD_FEATURES.map((feature) => (
              <div key={feature.id} style={{ ...card, margin: 0, padding: 14 }}>
                <div style={{ color: "#ff2bd6", fontWeight: 900, textTransform: "uppercase", letterSpacing: "0.08em" }}>
                  {feature.label}
                </div>
                <div style={{ color: "#ffe0f8", fontSize: 13, lineHeight: 1.65, marginTop: 8 }}>{feature.summary}</div>
              </div>
            ))}
          </div>
          <a
            href="#pro-features"
            style={{ ...action, marginTop: 18, color: " #ffe0f8", border: "1px solid rgba(255,43,214,0.55)", background: "rgba(255,36,79,0.16)" }}
          >
            See Pro features ↓
          </a>
        </section>

        <section id="pro-features" style={{ ...card, marginBottom: 22 }}>
          <div style={{ color: "#ff8bea", fontSize: 13, letterSpacing: "0.18em", textTransform: "uppercase", marginBottom: 14 }}>
            Premium Features
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))", gap: 14 }}>
            {publicPremiumFeatures.map((feature) => (
              <div key={feature.id} style={{ ...card, margin: 0 }}>
                <div style={{ color: "#ff8bea", fontSize: 11, letterSpacing: "0.10em", textTransform: "uppercase" }}>
                  {feature.premiumLabel}
                </div>
                <div style={{ color: "#ff244f", fontSize: 24, fontWeight: 900, textTransform: "uppercase", marginTop: 10 }}>
                  {feature.label}
                </div>
                <div style={{ color: "#ffe0f8", lineHeight: 1.7, marginTop: 10 }}>{feature.summary}</div>
                <div style={{ color: "#ffb0f2", fontSize: 12, marginTop: 12 }}>
                  Included in: {feature.includedIn.join(", ")}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section style={{ ...card, marginBottom: 22 }}>
          <div style={{ color: "#ff8bea", fontSize: 13, letterSpacing: "0.18em", textTransform: "uppercase", marginBottom: 14 }}>
            Premium Plans
          </div>
          <div style={{ marginBottom: 6 }}>
            <PlanTierPicker buyHref={primaryActionHref} buyLabel={primaryActionLabel} />
          </div>
          <div style={{ color: "#ffb0f2", fontSize: 12, marginTop: 14 }}>{PRICING_FOOTNOTE}</div>
        </section>

        <section style={card}>
          <div style={{ color: "#ff8bea", fontSize: 13, letterSpacing: "0.18em", textTransform: "uppercase", marginBottom: 12 }}>
            Availability
          </div>
          <div style={{ color: "#ffe0f8", lineHeight: 1.8 }}>
            Private and experimental modules are not included in the public feature catalog. Public guilds start with
            the standard ready stack, with optional Pro features enabled only through the appropriate plan or trial.
          </div>
        </section>
      </div>
      </div>
      <MarketingFooter />
    </>
  );
}
