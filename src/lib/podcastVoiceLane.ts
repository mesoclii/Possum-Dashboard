export const podcastVoiceLanes = [
  { value: "main", label: "Main bot (default)" },
  { value: "custom", label: "Custom bot" },
  { value: "custom2", label: "Second custom bot" },
  { value: "custom3", label: "Third custom bot" },
] as const;

export type PodcastVoiceLane = (typeof podcastVoiceLanes)[number]["value"];

export function readPodcastVoiceLane(search: string, guildId: string): PodcastVoiceLane | "" {
  const params = new URLSearchParams(search);
  const lane = params.get("voiceLane");
  if (!lane || params.get("guildId") !== guildId) return "main";
  return podcastVoiceLanes.find((item) => item.value === lane)?.value || "";
}

export function podcastStudioHref(guildId: string, lane: PodcastVoiceLane): string {
  const params = new URLSearchParams({ guildId, voiceLane: lane });
  return `/dashboard/podcast?${params.toString()}`;
}
