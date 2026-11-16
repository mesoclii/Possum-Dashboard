import { Suspense } from "react";
import SearchAnythingClient from "./SearchAnythingClient";

export default function SearchAnythingPage() {
  return (
    <Suspense fallback={<div style={{ color: "#ff4444", padding: 16 }}>Loading...</div>}>
      <SearchAnythingClient />
    </Suspense>
  );
}
