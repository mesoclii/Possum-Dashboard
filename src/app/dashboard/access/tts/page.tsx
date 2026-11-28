import { redirectToCanonical } from "@/lib/dashboard/legacyRedirect";

export const dynamic = "force-dynamic";

// Duplicate address: the same panel lives at /dashboard/tts in the menu.
export default async function Page({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  return redirectToCanonical("/dashboard/tts", searchParams);
}
