import PodcastControlClient from "@/app/dashboard/podcast/PodcastControlClient";

export default async function PodcastStudio({ params }: { params: Promise<{ guildId: string }> }) {
  const { guildId } = await params;
  return <PodcastControlClient initialGuildId={guildId} />;
}
