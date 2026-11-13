import { Suspense } from "react";
import VerificationClient from "./VerificationClient";

function Loading() {
  return <div style={{ color: "#ff4444", padding: 16 }}>Loading...</div>;
}

export default function Page() {
  return (
    <Suspense fallback={<Loading />}>
      <VerificationClient />
    </Suspense>
  );
}
