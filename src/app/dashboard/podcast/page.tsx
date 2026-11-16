import { redirect } from "next/navigation";
import { buildDashboardUrl } from "@/lib/dashboardUrl";

export default async function PodcastDashboardRedirect({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const url = buildDashboardUrl("/dashboard/podcast");
  for (const [key, value] of Object.entries(await searchParams)) {
    for (const item of Array.isArray(value) ? value : value === undefined ? [] : [value]) {
      url.searchParams.append(key, item);
    }
  }
  redirect(url.toString());
}
