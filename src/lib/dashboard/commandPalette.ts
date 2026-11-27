import type { DashboardNavItem, DashboardNavSection, DashboardNavTopLink } from "@/lib/dashboard/navigation";

export type DashboardCommandEntry = {
  href: string;
  label: string;
  group: string;
  aliases: string[];
};

function normalize(value: string): string {
  return value.toLocaleLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim();
}

export function createDashboardCommandEntries(
  topLinks: DashboardNavTopLink[],
  sections: DashboardNavSection[]
): DashboardCommandEntry[] {
  const entries: DashboardCommandEntry[] = [];
  const byHref = new Map<string, DashboardCommandEntry>();
  const add = (item: DashboardNavItem, group: string) => {
    const existing = byHref.get(item.href);
    if (existing) {
      if (item.label !== existing.label && !existing.aliases.includes(item.label)) existing.aliases.push(item.label);
      if (group !== existing.group && !existing.aliases.includes(group)) existing.aliases.push(group);
      return;
    }
    const entry = { href: item.href, label: item.label, group, aliases: [group, item.href] };
    byHref.set(item.href, entry);
    entries.push(entry);
  };

  for (const item of topLinks) add(item, "Quick links");
  for (const section of sections) {
    for (const item of section.items) add(item, section.label);
  }
  return entries;
}

export function searchDashboardCommands(
  entries: DashboardCommandEntry[],
  query: string,
  limit = 12
): DashboardCommandEntry[] {
  const needle = normalize(query);
  if (!needle) return entries.slice(0, limit);

  return entries
    .map((entry, index) => {
      const label = normalize(entry.label);
      const searchable = normalize([entry.label, entry.group, ...entry.aliases].join(" "));
      const score = label === needle ? 0 : label.startsWith(needle) ? 1 : label.includes(needle) ? 2 : searchable.includes(needle) ? 3 : Number.POSITIVE_INFINITY;
      return { entry, index, score };
    })
    .filter((result) => Number.isFinite(result.score))
    .sort((left, right) => left.score - right.score || left.index - right.index)
    .slice(0, Math.max(0, limit))
    .map((result) => result.entry);
}
