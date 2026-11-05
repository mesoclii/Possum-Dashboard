import { Suspense } from "react";
import PremiumGate from "@/components/possum/PremiumGate";
import AnalyticsClient from "./AnalyticsClient";

export default function AnalyticsPage() {
  return (
    <Suspense fallback={<div style={{ color: "#ff4444", padding: 16 }}>Loading...</div>}>
      <PremiumGate featureKey="analytics" featureLabel="Analytics">
        <AnalyticsClient />
      </PremiumGate>
    </Suspense>
  );
}
