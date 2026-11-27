import { Suspense } from "react";
import MessageOfDayClient from "./MessageOfDayClient";

export default function MessageOfDayPage() {
  return <Suspense fallback={<div style={{ padding: 20 }}>Loading Message of the Day...</div>}><MessageOfDayClient /></Suspense>;
}
