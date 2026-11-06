"use client";

import Link from "next/link";
import type { CSSProperties } from "react";
import { useEffect, useState } from "react";
import PlanTierPicker from "@/components/possum/PlanTierPicker";
import { buildPublicInviteUrl, buildSupportServerUrl } from "@/lib/publicLinks";
import { PRICING_FOOTNOTE, PREMIUM_FEATURES, STANDARD_FEATURES } from "@/lib/premiumCatalog";

type SessionState = {
  loggedIn: boolean;
  canEnterDashboard: boolean;
};

const shell: CSSProperties = {
  minHeight: "100vh",
  background:
    "transparent",
  color: "#ffd7d7",
  padding: "32px 24px 60px",
};

const card: CSSProperties = {
  border: "1px solid rgba(255,0,0,0.34)",
  borderRadius: 18,
  background: "linear-gradient(180deg, rgba(110,0,0,0.18), rgba(0,0,0,0.72))",
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
    <div style={shell}>
      <div style={{ maxWidth: 1480, margin: "0 auto" }}>
        <section style={{ ...card, padding: 28, marginBottom: 22 }}>
          <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1.2fr) minmax(320px,0.8fr)", gap: 20 }}>
            <div>
              <div style={{ color: "#ff9494", fontSize: 14, letterSpacing: "0.24em", textTransform: "uppercase" }}>
                Public Feature List
              </div>
              <h1
                style={{
                  margin: "12px 0 10px",
                  color: "#ff3e3e",
                  fontSize: "clamp(2.8rem, 7vw, 5.6rem)",
                  lineHeight: 0.92,
                  letterSpacing: "0.12em",
                  textTransform: "uppercase",
                  textShadow: "0 0 28px rgba(255,0,0,0.46)",
                }}
              >
                Features
              </h1>
              <p style={{ fontSize: 16, lineHeight: 1.8, maxWidth: 920, color: "#ffd3d3" }}>
                Public guilds start on the standard ready stack so owners only need to set channels, messages,
                images, roles, webhooks, timers, and engine preferences. Premium features stay off until enabled by
                plan or trial. Pokemon remains private and is never part of the public catalog. One plan covers every
                server you own or staff in, and Possum Bot stays one of the most actively updated bots in active development.
              </p>
              <div style={{ color: "#ffb0b0", fontSize: 13, marginTop: 10 }}>
                Feature requests and fixes can be suggested in{" "}
                <a href={buildSupportServerUrl()} target="_blank" rel="noopener noreferrer" style={{ color: "#ff9f9f", fontWeight: 700 }}>
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
                    color: "#ffd7d7",
                    border: "1px solid rgba(255,0,0,0.45)",
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
          <div style={{ color: "#8dffb9", fontSize: 13, letterSpacing: "0.18em", textTransform: "uppercase", marginBottom: 14 }}>
            Free Features (Included Standard Stack)
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))", gap: 12 }}>
            {STANDARD_FEATURES.map((feature) => (
              <div key={feature.id} style={{ ...card, margin: 0, padding: 14 }}>
                <div style={{ color: "#ff5757", fontWeight: 900, textTransform: "uppercase", letterSpacing: "0.08em" }}>
                  {feature.label}
                </div>
                <div style={{ color: "#ffd0d0", fontSize: 13, lineHeight: 1.65, marginTop: 8 }}>{feature.summary}</div>
              </div>
            ))}
          </div>
          <a
            href="#pro-features"
            style={{ ...action, marginTop: 18, color: "#fff1c7", border: "1px solid rgba(255,200,120,0.55)", background: "rgba(120,0,0,0.35)" }}
          >
            See Pro features ↓
          </a>
        </section>

        <section id="pro-features" style={{ ...card, marginBottom: 22 }}>
          <div style={{ color: "#ffd39a", fontSize: 13, letterSpacing: "0.18em", textTransform: "uppercase", marginBottom: 14 }}>
            Premium Features
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))", gap: 14 }}>
            {PREMIUM_FEATURES.map((feature) => (
              <div key={feature.id} style={{ ...card, margin: 0 }}>
                <div style={{ color: "#ffd49a", fontSize: 11, letterSpacing: "0.10em", textTransform: "uppercase" }}>
                  {feature.premiumLabel}
                </div>
                <div style={{ color: "#ff5a5a", fontSize: 24, fontWeight: 900, textTransform: "uppercase", marginTop: 10 }}>
                  {feature.label}
                </div>
                <div style={{ color: "#ffd0d0", lineHeight: 1.7, marginTop: 10 }}>{feature.summary}</div>
                <div style={{ color: "#ffb9b9", fontSize: 12, marginTop: 12 }}>
                  Included in: {feature.includedIn.join(", ")}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section style={{ ...card, marginBottom: 22 }}>
          <div style={{ color: "#ff9a9a", fontSize: 13, letterSpacing: "0.18em", textTransform: "uppercase", marginBottom: 14 }}>
            Premium Plans
          </div>
          <div style={{ marginBottom: 6 }}>
            <PlanTierPicker buyHref={primaryActionHref} buyLabel={primaryActionLabel} />
          </div>
          <div style={{ color: "#ffb8b8", fontSize: 12, marginTop: 14 }}>{PRICING_FOOTNOTE}</div>
        </section>

        <section style={card}>
          <div style={{ color: "#ff9a9a", fontSize: 13, letterSpacing: "0.18em", textTransform: "uppercase", marginBottom: 12 }}>
            Availability
          </div>
          <div style={{ color: "#ffd7d7", lineHeight: 1.8 }}>
            Pokemon is private and not sold publicly. Saviors keeps its original baseline untouched. Public guilds get
            the standard ready stack with premium features off until the guild owner buys a plan or you grant a trial.
          </div>
        </section>
      </div>
    </div>
  );
}
