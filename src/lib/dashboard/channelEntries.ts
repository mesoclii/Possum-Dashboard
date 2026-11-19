export type ChannelEntry = string | { id: string; weight?: number };

export function channelEntryId(entry: unknown): string {
  if (typeof entry === "string") return entry.trim();
  return entry && typeof entry === "object" && "id" in entry ? String(entry.id || "").trim() : "";
}

export function extractIdList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map(channelEntryId).filter(Boolean);
}

export function toggleChannelEntries<T extends ChannelEntry>(entries: T[], id: string): Array<T | string> {
  const current = Array.isArray(entries) ? entries : [];
  return current.some((entry) => channelEntryId(entry) === id)
    ? current.filter((entry) => channelEntryId(entry) !== id)
    : [...current, id];
}
