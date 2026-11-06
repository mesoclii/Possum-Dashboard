"use client";

import { usePathname } from "next/navigation";

export default function DashboardBanner() {
  const pathname = usePathname();
  if (pathname !== "/dashboard") return null;
  return (
    <div className="possum-banner" role="img" aria-label="Possum Bot neon banner">
      <div className="possum-banner-text">
        <span className="possum-banner-kicker">Possum Bot</span>
        <span className="possum-banner-title">Command Center</span>
        <span className="possum-banner-sub">Moderation · Games · AI · Economy — all in one place</span>
      </div>
    </div>
  );
}