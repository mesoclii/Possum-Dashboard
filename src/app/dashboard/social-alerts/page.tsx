import { Suspense } from "react";
import SocialAlertsClient from "./SocialAlertsClient";


export default function Page() {
  return (
    <Suspense fallback={<main style={{ padding: 16, color: "#ff8a8a" }}>Loading Social Alerts...</main>}>
      <SocialAlertsClient />
    </Suspense>
  );
}
