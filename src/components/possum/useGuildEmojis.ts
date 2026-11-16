"use client";

import { useEffect, useState } from "react";
import type { GuildEmoji } from "@/components/possum/GuildEmojiPicker";
import { fetchGuildData } from "@/lib/liveRuntime";

export function useGuildEmojis(guildId: string) {
  const [result, setResult] = useState<{ guildId: string; emojis: GuildEmoji[] }>({ guildId: "", emojis: [] });
  useEffect(() => {
    let active = true;
    if (guildId) {
      fetchGuildData(guildId).then((data) => {
        if (active) setResult({ guildId, emojis: data.emojis || [] });
      }).catch(() => {
        if (active) setResult({ guildId, emojis: [] });
      });
    }
    return () => { active = false; };
  }, [guildId]);
  return result.guildId === guildId ? result.emojis : [];
}
