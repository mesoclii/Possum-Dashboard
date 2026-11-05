const INVITE_PATH = "/api/auth/discord/invite";
const SUPPORT_SERVER_PATH = "/api/support-server";
export const SUPPORT_SERVER_GUILD_ID = "1567807367427661895";

export function buildPublicInviteUrl(guildId?: string) {
  if (!guildId) return INVITE_PATH;
  const params = new URLSearchParams({ guildId });
  return `${INVITE_PATH}?${params.toString()}`;
}

export function buildSupportServerUrl() {
  return SUPPORT_SERVER_PATH;
}
