import { buildServerBotApiHeaders, fetchServerBotApi, readServerBotApiJson, SERVER_BOT_API } from "@/lib/botApiServer";

async function hasPublicProfile(userId: string) {
  if (!userId) return false;
  const response = await fetchServerBotApi(`${SERVER_BOT_API}/internal/public-gaming/me`, {
    headers: buildServerBotApiHeaders(userId), cache: "no-store",
  }).catch(() => null);
  if (!response?.ok) return false;
  const data = await readServerBotApiJson(response).catch(() => null);
  return data?.success === true && Boolean(data.profile);
}

export async function resolvePublicGamingOwner(guestId: string, discordId: string) {
  if (guestId && discordId) {
    if (await hasPublicProfile(guestId)) return guestId;
    if (await hasPublicProfile(discordId)) return discordId;
  }
  return guestId || discordId;
}
