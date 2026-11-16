import PodcastListeningClient from "./PodcastListeningClient";

export default async function PodcastPage({ params }: { params: Promise<{ guildId: string }> }) {
  const { guildId } = await params;
  return <PodcastListeningClient guildId={guildId} />;
}
