"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Features = {
  ticketsEnabled: boolean;
  ttsEnabled: boolean;
  governanceEnabled: boolean;
};

const DEFAULT_FEATURES: Features = {
  ticketsEnabled: false,
  ttsEnabled: false,
  governanceEnabled: false
};

function resolveGuildId(): string {
  if (typeof window === "undefined") return "";
  const sp = new URLSearchParams(window.location.search);
  const q = sp.get("guildId") || sp.get("guildid") || "";
  const s = localStorage.getItem("activeGuildId") || localStorage.getItem("activeGuildid") || "";
  const g = (q || s).trim();
  if (g) {
    localStorage.setItem("activeGuildId", g);
    localStorage.setItem("activeGuildid", g);
  }
  return g;
}

function withGuild(href: string, guildId: string): string {
  if (!guildId) return href;
  const v = encodeURIComponent(guildId);
  const sep = href.includes("?") ? "&" : "?";
  return `${href}${sep}guildId=${v}&guildid=${v}`;
}

export default function AccessClient() {
  const [guildId] = useState<string>(() => resolveGuildId());
  const [features, setFeatures] = useState<Features>(DEFAULT_FEATURES);

  useEffect(() => {
    if (!guildId) return;

    (async () => {
      try {
        const r = await fetch(`/api/bot/dashboard-config?guildId=${encodeURIComponent(guildId)}`, { cache: "no-store" });
        const j = await r.json();
        const f = j?.config?.features || {};
        setFeatures({
          ticketsEnabled: !!f.ticketsEnabled,
          ttsEnabled: !!f.ttsEnabled,
          governanceEnabled: !!f.governanceEnabled,
        });
      } catch {
        setFeatures(DEFAULT_FEATURES);
      }
    })();
  }, [guildId]);

  if (!guildId) {
    return <main style={{ padding: 16, color: "#ff6666" }}>Missing guildId. Open from /guilds first.</main>;
  }

  return (
    <main style={{ padding: 16, color: "#ffd0d0" }}>
      <h1 style={{ marginTop: 0, color: "#ff4444", textTransform: "uppercase", letterSpacing: "0.08em" }}>Access Engines</h1>
      <p style={{ color: "#ff8a8a" }}>Guild: {typeof window !== 'undefined' ? (localStorage.getItem("activeGuildName") || "Selected server") : "Selected server"}</p>
      <p style={{ color: "#ffaaaa", fontSize: 12, marginTop: -4 }}>Each access engine is separated into its own page and saved independently.</p>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(260px,1fr))", gap: 12 }}>
        <Link href={withGuild("/dashboard/tickets", guildId)} style={{ border: "1px solid #5f0000", borderRadius: 10, padding: 12, color: "#ffd0d0", textDecoration: "none" }}>
          <b>Tickets</b> <span style={{ marginLeft: 8, color: features.ticketsEnabled ? "#72ff9c" : "#ff7f7f" }}>{features.ticketsEnabled ? "ENABLED" : "DISABLED"}</span>
        </Link>
        <Link href={withGuild("/dashboard/tts", guildId)} style={{ border: "1px solid #5f0000", borderRadius: 10, padding: 12, color: "#ffd0d0", textDecoration: "none" }}>
          <b>TTS</b> <span style={{ marginLeft: 8, color: features.ttsEnabled ? "#72ff9c" : "#ff7f7f" }}>{features.ttsEnabled ? "ENABLED" : "DISABLED"}</span>
        </Link>
        <Link href={withGuild("/dashboard/governance", guildId)} style={{ border: "1px solid #5f0000", borderRadius: 10, padding: 12, color: "#ffd0d0", textDecoration: "none" }}>
          <b>Governance</b> <span style={{ marginLeft: 8, color: features.governanceEnabled ? "#72ff9c" : "#ff7f7f" }}>{features.governanceEnabled ? "ENABLED" : "DISABLED"}</span>
        </Link>
        <Link href={withGuild("/dashboard/economy/leaderboard", guildId)} style={{ border: "1px solid #5f0000", borderRadius: 10, padding: 12, color: "#ffd0d0", textDecoration: "none" }}>
          <b>Invite Tracker</b>
        </Link>
        <Link href={withGuild("/dashboard/selfroles", guildId)} style={{ border: "1px solid #5f0000", borderRadius: 10, padding: 12, color: "#ffd0d0", textDecoration: "none" }}>
          <b>Self Roles</b>
        </Link>
        <Link href={withGuild("/dashboard/security", guildId)} style={{ border: "1px solid #5f0000", borderRadius: 10, padding: 12, color: "#ffd0d0", textDecoration: "none" }}>
          <b>Security</b>
        </Link>
      </div>
    </main>
  );
}
