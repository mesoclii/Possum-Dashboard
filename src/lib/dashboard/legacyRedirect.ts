import { redirect } from "next/navigation";

type SearchParams = Record<string, string | string[] | undefined>;

// Old dashboard addresses that showed the same panel as a menu page now send
// visitors to that menu page. The whole query string (guildId and anything
// else) is carried over so bookmarks keep opening the same server.
export async function redirectToCanonical(target: string, searchParams?: Promise<SearchParams>): Promise<never> {
  const params = (await searchParams) || {};
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    for (const entry of Array.isArray(value) ? value : [value]) {
      if (typeof entry === "string") query.append(key, entry);
    }
  }
  const suffix = query.toString();
  redirect(suffix ? `${target}?${suffix}` : target);
}
