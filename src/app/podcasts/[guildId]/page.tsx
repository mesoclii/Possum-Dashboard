import { redirect } from "next/navigation";

export default async function PodcastRedirect({ params }: { params: Promise<{ guildId: string }> }) {
  const { guildId } = await params;
  if (!/^\d{16,20}$/.test(guildId)) redirect("/");
  redirect(`https://dashboard.possumbot.com/podcasts/${guildId}`);
}
