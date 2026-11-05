import { Suspense } from "react";
import PremiumGate from "@/components/possum/PremiumGate";
import SignalRelayClient from "./SignalRelayClient";


export default function Page() {
  return (
    <Suspense fallback={<main style={{ padding: 16, color: "#ff8a8a" }}>Loading Signal Relay...</main>}>
      <PremiumGate featureKey="signal-relay" featureLabel="Social Alerts + Signal Relay">
        <SignalRelayClient />
      </PremiumGate>
    </Suspense>
  );
}
