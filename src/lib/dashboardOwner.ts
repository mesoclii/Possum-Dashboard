export const CONTROL_OWNER_USER_IDS = Array.from(new Set([
  process.env.MASTER_OWNER_USER_ID,
  process.env.CONTROL_OWNER_USER_ID,
  process.env.OWNER_USER_ID,
  process.env.OWNER_USER_IDS,
  process.env.BOT_OWNER_USER_ID,
  process.env.BOT_OWNER_ID,
  process.env.SUPERUSER_USER_ID,
].flatMap((value) => String(value || "").split(","))
  .map((value) => value.trim())
  .filter((value) => /^\d{16,20}$/.test(value))));

export const MASTER_OWNER_USER_ID = CONTROL_OWNER_USER_IDS[0] || "";
export const CO_OWNER_USER_ID = CONTROL_OWNER_USER_IDS[1] || "";

export function isDashboardControlOwner(userId?: string | null) {
  const normalized = String(userId || "").trim();
  return Boolean(normalized && CONTROL_OWNER_USER_IDS.includes(normalized));
}

export const FALLBACK_GUILD_NAMES: Record<string, string> = {
  "1431799056211906582": "Saviors Gaming 18+",
  "1336178965202599936": "Possum Bot Games",
  "1567807367427661895": "Possum Bot Support",
};

const EXTRA_CONTROL_GUILDS = String(process.env.CONTROL_GUILD_IDS || "")
  .split(",")
  .map((id) => id.trim())
  .filter((id) => /^\d{16,20}$/.test(id));

export const CONTROL_OWNER_GUILD_IDS = Array.from(
  new Set([
    ...Object.keys(FALLBACK_GUILD_NAMES),
    ...EXTRA_CONTROL_GUILDS,
  ])
);

export function isDashboardControlGuild(guildId?: string | null) {
  const normalized = String(guildId || "").trim();
  return Boolean(normalized && CONTROL_OWNER_GUILD_IDS.includes(normalized));
}
