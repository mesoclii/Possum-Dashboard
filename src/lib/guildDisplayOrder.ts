type DisplayGuild = {
  id: string;
  name: string;
  botPresent?: boolean;
};

const CONTROL_OWNER_DISPLAY_ORDER = [
  "1336178965202599936",
  "1519823415119446146",
  "1567807367427661895",
];

export function orderGuildsForDisplay<T extends DisplayGuild>(
  guilds: T[],
  policy: { primaryGuildId: string; gamesBaselineGuildId: string },
  isControlOwner: boolean,
): T[] {
  const rank = (guildId: string) => {
    if (isControlOwner) {
      const preferredIndex = CONTROL_OWNER_DISPLAY_ORDER.indexOf(guildId);
      if (preferredIndex !== -1) return preferredIndex;
    }
    const offset = isControlOwner ? CONTROL_OWNER_DISPLAY_ORDER.length : 0;
    if (guildId === policy.primaryGuildId) return offset;
    if (guildId === policy.gamesBaselineGuildId) return offset + 1;
    return offset + 2;
  };

  return [...guilds].sort((a, b) => {
    const rankDifference = rank(a.id) - rank(b.id);
    if (rankDifference !== 0) return rankDifference;
    if (Boolean(a.botPresent) !== Boolean(b.botPresent)) return a.botPresent ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
}
