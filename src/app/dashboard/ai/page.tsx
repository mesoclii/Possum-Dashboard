import { redirectToCanonical } from "@/lib/dashboard/legacyRedirect";

export const dynamic = "force-dynamic";

// Retired page: it edited the same AI routing switches as AI Talking Rules (/dashboard/runtime-router).
export default async function Page({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  return redirectToCanonical("/dashboard/runtime-router", searchParams);
}
