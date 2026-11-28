"use client";

import Link from "next/link";
import { type CSSProperties, type ReactNode } from "react";
import { buildDashboardHref } from "@/lib/dashboardContext";
import { useDashboardSessionState } from "@/components/possum/useDashboardSessionState";

type Props = {
  title: string;
  children: ReactNode;
};

const panel: CSSProperties = {
  border: "1px solid rgba(255,0,0,.36)",
  borderRadius: 12,
  padding: 16,
  background: "rgba(100,0,0,.10)",
  color: "#ffd0d0",
};

const action: CSSProperties = {
  border: "1px solid #7a0000",
  borderRadius: 10,
  background: "#130707",
  color: "#ffd7d7",
  padding: "10px 12px",
  fontWeight: 800,
  letterSpacing: "0.06em",
  textTransform: "uppercase",
  cursor: "pointer",
  textDecoration: "none",
  display: "inline-block",
};

export default function CreatorOnlyGate({ title, children }: Props) {
  const { loading, isMasterOwner } = useDashboardSessionState();

  if (loading) {
    return <section style={panel}>Checking creator access...</section>;
  }

  if (isMasterOwner) {
    return <>{children}</>;
  }

  return (
    <section style={panel}>
      <div style={{ color: "#ff9a9a", fontSize: 12, letterSpacing: "0.14em", textTransform: "uppercase" }}>
        Creator Only
      </div>
      <h1 style={{ marginTop: 8, color: "#ff4a4a", letterSpacing: "0.08em", textTransform: "uppercase" }}>
        {title}
      </h1>
      <p style={{ color: "#ffb5b5", lineHeight: 1.6 }}>
        This surface is internal bot-creator tooling. It is intentionally hidden from normal guild operators.
      </p>
      <Link href={buildDashboardHref("/dashboard/ai/learning")} style={action}>
        Back To Possum AI
      </Link>
    </section>
  );
}
