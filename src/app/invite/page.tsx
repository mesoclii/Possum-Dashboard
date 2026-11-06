import type { CSSProperties } from "react";
import Link from "next/link";
import { buildPublicInviteUrl } from "@/lib/publicLinks";

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
  padding: 20,
};

export default function InvitePage() {
  return (
    <div style={shell}>
      <div style={{ maxWidth: 1120, margin: "0 auto" }}>
        <section style={card}>
          <div style={{ color: "#ff9c9c", fontSize: 14, letterSpacing: "0.22em", textTransform: "uppercase" }}>
            Invite Possum
          </div>
          <h1
            style={{
              margin: "12px 0 10px",
              color: "#ff4545",
              fontSize: "clamp(2.8rem, 7vw, 5rem)",
              lineHeight: 0.94,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              textShadow: "0 0 24px rgba(255,0,0,0.42)",
            }}
          >
            Add The Bot
            <br />
            Then Configure
          </h1>
          <p style={{ color: "#ffd4d4", lineHeight: 1.8, maxWidth: 900 }}>
            When Possum joins a new guild, the standard setup stack comes in ready. Owners only need to pick channels,
            write their own messages, add their images, wire roles, and finish personalization.
          </p>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))", gap: 14, marginTop: 20 }}>
            <div style={card}>
              <div style={{ color: "#ff5e5e", fontWeight: 900, textTransform: "uppercase", letterSpacing: "0.08em" }}>
                What Starts Ready
              </div>
              <div style={{ color: "#ffd7d7", lineHeight: 1.7, marginTop: 10 }}>
                Bot Personalizer
                <br />
                Bot Masters
                <br />
                Tickets, selfroles, invite tracker
                <br />
                Economy, contracts, crew, dominion
                <br />
                Cat Drop, Rare Spawn, Range, Truth Or Dare
                <br />
                Possum AI
              </div>
            </div>
            <div style={card}>
              <div style={{ color: "#ff5e5e", fontWeight: 900, textTransform: "uppercase", letterSpacing: "0.08em" }}>
                What Stays Off
              </div>
              <div style={{ color: "#ffd7d7", lineHeight: 1.7, marginTop: 10 }}>
                TTS
                <br />
                Persona Engine AI
                <br />
                Heist Engine
                <br />
                Pokemon Suite
              </div>
            </div>
          </div>

          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 22 }}>
            <a
              href={buildPublicInviteUrl()}
              target="_blank"
              rel="noreferrer"
              style={{
                textDecoration: "none",
                borderRadius: 14,
                border: "1px solid #ff4a4a",
                padding: "14px 18px",
                fontWeight: 900,
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                color: "#1a0000",
                background: "linear-gradient(90deg, #ff3f3f, #ff863f)",
              }}
            >
              Invite To Server
            </a>
            <Link
              href="/features"
              style={{
                textDecoration: "none",
                borderRadius: 14,
                border: "1px solid rgba(255,0,0,0.45)",
                padding: "14px 18px",
                fontWeight: 900,
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                color: "#ffd7d7",
                background: "#130707",
              }}
            >
              View Features
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
