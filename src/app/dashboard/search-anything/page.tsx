import { Suspense } from "react";
import PremiumGate from "@/components/possum/PremiumGate";
import SearchAnythingClient from "./SearchAnythingClient";

export default function SearchAnythingPage() {
  return (
    <Suspense fallback={<div style={{ color: "#ff4444", padding: 16 }}>Loading...</div>}>
      <PremiumGate featureKey="search-anything" featureLabel="Search Anything">
        <SearchAnythingClient />
      </PremiumGate>
    </Suspense>
  );
}
