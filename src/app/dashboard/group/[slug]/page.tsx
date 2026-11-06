import { Suspense } from "react";
import DashboardClient from "../../DashboardClient";

export default async function GroupPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return (
    <Suspense fallback={<div style={{ color: "#ff4444", padding: 16 }}>Loading...</div>}>
      <DashboardClient groupSlug={slug} />
    </Suspense>
  );
}