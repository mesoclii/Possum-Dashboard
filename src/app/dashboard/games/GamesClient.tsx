"use client";

import { useEffect, useState } from "react";
import { resolveGuildContext } from "@/lib/liveRuntime";
import GameSocialClient from "@/components/possum/GameSocialClient";

type GamesClientProps = { mode: "member" | "admin" | "auto" };

export default function GamesClient({ mode }: GamesClientProps) {
  const [guildContext, setGuildContext] = useState({ guildId: "", guildName: "", userId: "" });
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
    <div style={{ width: "100%", minWidth: 0 }}>
      <GameSocialClient guildId={guildId} guildName={guildName} mode={mode} />
    </div>
  );
}
