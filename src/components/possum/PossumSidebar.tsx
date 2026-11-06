"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { buildDashboardHref } from "@/lib/dashboardContext";
import { useDashboardSessionState } from "@/components/possum/useDashboardSessionState";
import { getDashboardNavSections, getDashboardNavTopLinks } from "@/lib/dashboard/navigation";

function itemClass(active: boolean): string {
  return active
    ? "block w-full rounded-md border border-pink-500/70 bg-gradient-to-r from-pink-600/25 to-emerald-500/10 px-3 py-2 text-left text-sm font-extrabold uppercase tracking-[0.05em] text-pink-100 possum-nav-active"
    : "block w-full rounded-md border border-transparent px-3 py-2 text-left text-sm font-bold uppercase tracking-[0.04em] text-red-300/85 hover:border-emerald-400/50 hover:bg-emerald-500/10 hover:text-emerald-200";
}

function isItemActive(pathname: string | null, href: string) {
  const baseHref = href.split("?")[0].split("#")[0];
  return pathname === baseHref || pathname?.startsWith(`${baseHref}/`);
}

function shouldPrefetchNavRoutes() {
  if (typeof window === "undefined") return false;
  const nav = window.navigator as Navigator & {
    deviceMemory?: number;
    connection?: { saveData?: boolean } | undefined;
  };
  if (nav.connection?.saveData) return false;
  if (typeof nav.deviceMemory === "number" && nav.deviceMemory <= 1) return false;
  return true;
}

export default function PossumSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { isMasterOwner } = useDashboardSessionState();
  const topLinks = useMemo(() => getDashboardNavTopLinks(isMasterOwner), [isMasterOwner]);
  const sections = useMemo(() => getDashboardNavSections(isMasterOwner), [isMasterOwner]);
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({});
  const prefetchedHrefsRef = useRef<Set<string>>(new Set());

  function isSectionOpen(label: string, defaultOpen: boolean) {
    return typeof openSections[label] === "boolean" ? openSections[label] : defaultOpen;
  }

  function toggleSection(label: string, defaultOpen: boolean) {
    setOpenSections((prev) => ({ ...prev, [label]: !isSectionOpen(label, defaultOpen) }));
  }

  function navigateTo(href: string) {
    router.push(buildDashboardHref(href));
  }

  const prefetchHref = useCallback((href: string) => {
    if (!shouldPrefetchNavRoutes()) {
      return;
    }
    const resolved = buildDashboardHref(href);
    if (!resolved || prefetchedHrefsRef.current.has(resolved)) {
      return;
    }
    prefetchedHrefsRef.current.add(resolved);
    router.prefetch(resolved);
  }, [router]);

  return (
    <div className="rounded-xl border possum-divider bg-black/55 p-4 possum-border">
      <div className="mb-4 border-b possum-divider pb-3">
        <p className="text-[11px] uppercase tracking-[0.24em] possum-soft">Possum Bot</p>
        <button
          type="button"
          onClick={() => navigateTo("/dashboard")}
          className="mt-1 block text-left text-lg font-black uppercase tracking-[0.08em] possum-red possum-glow-soft hover:text-red-200"
        >
          Dashboard
        </button>
        <div className="mt-3 space-y-1">
          {topLinks.map((item) => {
            const active = isItemActive(pathname, item.href);
            return (
              <button
                key={item.href}
                type="button"
                onClick={() => navigateTo(item.href)}
                onMouseEnter={() => prefetchHref(item.href)}
                onFocus={() => prefetchHref(item.href)}
                className={`${itemClass(Boolean(active))} relative z-10 cursor-pointer`}
              >
                {item.label}
              </button>
            );
          })}
        </div>
      </div>

      <nav className="space-y-4">
        {sections.map((section) => {
          const defaultOpen = Boolean(section.defaultOpen || section.items.some((item) => isItemActive(pathname, item.href)));
          const open = isSectionOpen(section.label, defaultOpen);
          return (
            <div key={section.label} className="rounded-lg border border-pink-900/50 bg-black/30 possum-nav-section">
              <button
                type="button"
                onClick={() => toggleSection(section.label, defaultOpen)}
                className="flex w-full items-center justify-between px-3 py-2 text-left text-[11px] font-black uppercase tracking-[0.18em] text-red-300/70"
              >
                {section.label}
                <span>{open ? "-" : "+"}</span>
              </button>
              {open ? (
                <div className="relative z-10 space-y-1 px-2 pb-2">
                  {section.items.map((item) => {
                    const active = isItemActive(pathname, item.href);
                    return (
                      <button
                        key={item.href}
                        type="button"
                        onClick={() => navigateTo(item.href)}
                        onMouseEnter={() => prefetchHref(item.href)}
                        onFocus={() => prefetchHref(item.href)}
                        className={`${itemClass(Boolean(active))} relative z-10 cursor-pointer`}
                      >
                        {item.label}
                      </button>
                    );
                  })}
                </div>
              ) : null}
            </div>
          );
        })}
      </nav>
    </div>
  );
}
