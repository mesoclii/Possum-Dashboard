import { Suspense } from "react";
import PremiumGate from "@/components/possum/PremiumGate";
import SocialAlertsClient from "./SocialAlertsClient";


export default function Page() {
  return (
    <Suspense fallback={<main style={{ padding: 16, color: "#ff8a8a" }}>Loading Social Alerts...</main>}>
      <PremiumGate featureKey="signal-relay" featureLabel="Social Alerts + Signal Relay">
        <SocialAlertsClient />
      </PremiumGate>
    </Suspense>
  );
}
