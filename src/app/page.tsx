"use client";

import type { CSSProperties } from "react";
import { useEffect, useMemo, useState } from "react";
import { buildSupportServerUrl } from "@/lib/publicLinks";

type LandingSession = {
  loggedIn: boolean;
  oauthConfigured: boolean;
  canEnterDashboard: boolean;
  user?: {
    id: string;
    username: string;
    globalName: string | null;
  } | null;
};


const buttonBase: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  minWidth: 220,
  padding: "16px 18px",
  borderRadius: 16,
  textDecoration: "none",
  textTransform: "uppercase",
  letterSpacing: "0.16em",
  fontWeight: 900,
  fontSize: 14,
};

const primaryButton: CSSProperties = {
  ...buttonBase,
  color: "#190000",
  background: "linear-gradient(90deg, #ff2bd6 0%, #ff2a4d 100%)",
  boxShadow: "0 0 30px rgba(255,43,214,0.45), 0 0 50px rgba(255,42,77,0.25)",
};

const secondaryButton: CSSProperties = {
  ...buttonBase,
  color: "#ffe0e0",
  border: "1px solid rgba(255,43,214,0.6)",
  background: "rgba(18,0,16,0.72)",
  boxShadow: "0 0 18px rgba(255,43,214,0.25)",
};

export default function Home() {
  const [session, setSession] = useState<LandingSession>({
    loggedIn: false,
    oauthConfigured: false,
    canEnterDashboard: false,
    user: null,
  });
  const [now, setNow] = useState(() => new Date());
  const [lastUpdatedAt, setLastUpdatedAt] = useState("");

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    (async () => {
      const [sessionRes, buildRes] = await Promise.all([
        fetch("/api/auth/session?brief=1", { cache: "no-store" }).catch(() => null),
        fetch("/api/build-info", { cache: "no-store" }).catch(() => null),
      ]);
      const json = await sessionRes?.json().catch(() => ({}));
      const buildJson = await buildRes?.json().catch(() => ({}));
      setSession({
        loggedIn: Boolean(json?.loggedIn),
        oauthConfigured: Boolean(json?.oauthConfigured),
        canEnterDashboard: Boolean(json?.canEnterDashboard),
        user: json?.user || null,
      });
      const buildUpdatedAt = String(buildJson?.build?.updatedAt || "").trim();
      setLastUpdatedAt(buildUpdatedAt || new Date(document.lastModified || Date.now()).toISOString());
    })();
  }, []);

  const dateLine = useMemo(
    () =>
      now.toLocaleDateString("en-US", {
        weekday: "long",
        month: "long",
        day: "2-digit",
        year: "numeric",
        timeZone: "America/Los_Angeles",
      }),
    [now]
  );

  const timeLine = useMemo(
    () =>
      now.toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: true,
        timeZone: "America/Los_Angeles",
        timeZoneName: "short",
      }),
    [now]
  );

  const lastUpdatedLine = useMemo(() => {
    if (!lastUpdatedAt) return "Last Updated: Not available";
    const stamp = new Date(lastUpdatedAt);
    if (Number.isNaN(stamp.getTime())) return "Last Updated: Not available";
    const date = stamp.toLocaleDateString("en-US", {
      month: "long",
      day: "2-digit",
      year: "numeric",
      timeZone: "America/Los_Angeles",
    });
    const time = stamp.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
      timeZone: "America/Los_Angeles",
      timeZoneName: "short",
    });
    return `Last Updated: ${date} | ${time}`;
  }, [lastUpdatedAt]);

  const entryHref = session.loggedIn && session.canEnterDashboard ? "/guilds" : "/api/auth/discord/login?returnTo=%2Fguilds";
  const entryLabel = session.loggedIn && session.canEnterDashboard ? "Select Guild" : "Login To Discord";

  return (
    <div
      style={{
        minHeight: "100vh",
        background:
          "radial-gradient(circle at 80% 0%, rgba(255,43,214,0.20) 0%, transparent 45%), radial-gradient(circle at 10% 100%, rgba(255,42,77,0.16) 0%, transparent 45%), transparent",
        color: "#ffe2e2",
      }}
    >
      <div style={{ maxWidth: 1520, margin: "0 auto", padding: "22px 26px 56px" }}>
        <section
          style={{
            border: "1px solid rgba(255,43,214,0.5)",
            borderRadius: 28,
            background: "linear-gradient(180deg, rgba(60,0,50,0.28), rgba(0,0,0,0.72))",
            padding: "42px 34px 34px",
            boxShadow: "0 0 40px rgba(255,43,214,0.25), 0 0 80px rgba(255,42,77,0.12)",
            overflow: "hidden",
          }}
        >
          <div style={{ textAlign: "center" }}>
            <div
              className="possum-title"
              style={{
                fontSize: "clamp(3rem, 11vw, 8.8rem)",
                fontWeight: 950,
                letterSpacing: "0.22em",
                textTransform: "uppercase",
                lineHeight: 0.86,
                margin: 0,
              }}
            >
              Possum
              <br />
              Control
              <br />
              Room
            </div>

            <div style={{ display: "flex", gap: 14, flexWrap: "wrap", justifyContent: "center", marginTop: 34 }}>
              <a href="/status" style={secondaryButton}>
                System Status
              </a>
              <a href="/features" style={secondaryButton}>
                Features
              </a>
              <a href={entryHref} style={primaryButton}>
                {entryLabel}
              </a>
            </div>

            <div style={{ color: "#9a7a7a", fontSize: 13, marginTop: 22 }}>
              <a href="/terms" style={{ color: "#ff9a9a" }}>Terms of Service</a>
              {" · "}
              <a href="/privacy" style={{ color: "#ff9a9a" }}>Privacy Policy</a>
            </div>

            <div style={{ color: "#ffbcbc", fontSize: 14, marginTop: 18, minHeight: 24 }}>
              {session.loggedIn
                ? `Discord connected as ${session.user?.globalName || session.user?.username || "Connected"}`
                : session.oauthConfigured
                  ? "Login with Discord to unlock guild selection"
                  : "Discord OAuth is not configured yet on this deployment."}
            </div>
            <div
              style={{
                color: "#ffb3b3",
                fontSize: 14,
                marginTop: 12,
                display: "flex",
                gap: 10,
                flexWrap: "wrap",
                justifyContent: "center",
                alignItems: "center",
              }}
            >
              <span>Possum Bot is one of the most actively updated bots in development.</span>
              <a
                href={buildSupportServerUrl()}
                target="_blank"
                rel="noreferrer"
                style={{
                  color: "#ffd1f5",
                  fontWeight: 900,
                  textDecoration: "none",
                  border: "1px solid rgba(255,43,214,0.7)",
                  borderRadius: 999,
                  padding: "8px 14px",
                  background: "rgba(40,0,28,0.72)",
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  fontSize: 13,
                }}
              >
                Join Possum Bot Support
              </a>
            </div>
          </div>

        </section>

        <div style={{ marginTop: 22, textAlign: "center" }}>
          <div style={{ color: "#ff8c8c", fontSize: 26, fontWeight: 900, letterSpacing: "0.10em", textTransform: "uppercase" }}>
            {dateLine}
          </div>
          <div style={{ color: "#ffd7d7", fontSize: 22, letterSpacing: "0.18em", textTransform: "uppercase", marginTop: 10 }}>
            {timeLine}
          </div>
          <div style={{ color: "#ffb0b0", fontSize: 14, letterSpacing: "0.08em", textTransform: "uppercase", marginTop: 10 }}>
            {lastUpdatedLine}
          </div>
          <div
            style={{
              color: "#ff9a9a",
              fontSize: 24,
              fontWeight: 900,
              letterSpacing: "0.24em",
              textTransform: "uppercase",
              marginTop: 18,
              textShadow: "0 0 22px rgba(255,54,54,0.22)",
            }}
          >
            Designed by aStonedPossum &amp; aCityRaccoon
          </div>
        </div>
      </div>
    </div>
  );
}
