import { Suspense } from "react";
import CreatorOnlyGate from "@/components/possum/CreatorOnlyGate";
import OperationsClient from "./OperationsClient";

function Loading() {
  return <div style={{ color: "#ff4444", padding: 16 }}>Loading...</div>;
}

export default function Page() {
  return (
    <CreatorOnlyGate title="Operations Center">
      <Suspense fallback={<Loading />}>
        <OperationsClient />
      </Suspense>
    </CreatorOnlyGate>
  );
}
