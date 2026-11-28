import { redirectToCanonical } from "@/lib/dashboard/legacyRedirect";

export const dynamic = "force-dynamic";

// Retired page: it only linked to Truth / Dare and Achievements, which are both in the menu.
export default async function Page({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  return redirectToCanonical("/dashboard/games", searchParams);
}
