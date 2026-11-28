import { redirectToCanonical } from "@/lib/dashboard/legacyRedirect";

export const dynamic = "force-dynamic";

// Retired page: it only re-rendered Pokemon Catching. The Stage 2 engine itself is unchanged.
export default async function Page({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  return redirectToCanonical("/dashboard/pokemon-catching", searchParams);
}
