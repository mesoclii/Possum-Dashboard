"use client";

import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import Link from "next/link";
import { resolveGuildContext } from "@/lib/liveRuntime";
import GameSocialClient from "@/components/possum/GameSocialClient";

const card: CSSProperties = {
  border: "1px solid rgba(255,0,0,.35)",
  borderRadius: 12,
  padding: 14,
  background: "rgba(90,0,0,.10)",
  marginBottom: 12,
};

export default function GamesClient() {
  const [guildContext, setGuildContext] = useState(() => resolveGuildContext());
  const guildId = guildContext.guildId;
  const guildName = guildContext.guildName;

  // The guild picker stores the active guild in localStorage, so the hub has to
  // re-resolve after mount (and on focus/guild switches) or it stays on the
  // "Missing guildId" screen when opened without query parameters.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const sync = () => {
      const next = resolveGuildContext();
      setGuildContext((prev) =>
        prev.guildId === next.guildId && prev.guildName === next.guildName ? prev : next
      );
    };
    sync();
    window.addEventListener("popstate", sync);
    window.addEventListener("storage", sync);
    window.addEventListener("focus", sync);
    document.addEventListener("visibilitychange", sync);
    return () => {
      window.removeEventListener("popstate", sync);
      window.removeEventListener("storage", sync);
      window.removeEventListener("focus", sync);
      document.removeEventListener("visibilitychange", sync);
    };
  }, []);

  if (!guildId) {
    return <div style={{ color: "#ff6b6b", padding: 24 }}>Missing guildId. Open from `/guilds` first.</div>;
  }

  return (
    <div style={{ maxWidth: 1280, color: "#ffcaca" }}>
      <div style={card}>
        <div style={{ fontSize: 24, letterSpacing: "0.16em", textTransform: "uppercase", fontWeight: 900, color: "#ff2f2f" }}>
          Gaming Hub
        </div>
        <div style={{ color: "#ff9e9e", marginTop: 4 }}>Guild: {guildName || guildId}</div>
        <div style={{ color: "#ffb7b7", fontSize: 12, marginTop: 8 }}>
          This page is only for the external game stack: linked identities, Steam / Epic / Xbox / Battle.net / PlayStation / Rockstar accounts, live presence, provider stats, hours, gamer cards, and squad finder.
        </div>
        <div style={{ color: "#ffb7b7", fontSize: 12, marginTop: 8 }}>
          Cat Drop, Pokemon, Truth Dare, Crew, Dominion, and other server mini-game engines stay on their own dedicated dashboard pages.
        </div>
        <Link
          href="/dashboard/games/wilds"
          style={{ display: "inline-block", marginTop: 10, color: "#ffb0b0", fontSize: 12, textDecoration: "underline" }}
        >
          Possum Wilds (Pro) — species art/assets
        </Link>
      </div>
      <GameSocialClient guildId={guildId} guildName={guildName} />
    </div>
  );
}
