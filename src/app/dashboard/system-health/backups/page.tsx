import { Suspense } from "react";
import PremiumGate from "@/components/possum/PremiumGate";
import BackupsClient from "./BackupsClient";


function Loading() {
  return <div style={{ color: "#ff4444", padding: 16 }}>Loading...</div>;
}

export default function Page() {
  return (
    <Suspense fallback={<Loading />}>
      <PremiumGate featureKey="config-backup" featureLabel="Config Backup + Restore">
        <BackupsClient />
      </PremiumGate>
    </Suspense>
  );
}
