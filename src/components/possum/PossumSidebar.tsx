"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { buildDashboardHref } from "@/lib/dashboardContext";
import { useDashboardSessionState } from "@/components/possum/useDashboardSessionState";
import { usePublicFeatureVisibility } from "@/components/possum/usePublicFeatureVisibility";
import { getDashboardNavSections, getDashboardNavTopLinks, getSectionHref } from "@/lib/dashboard/navigation";

function itemClass(active: boolean): string {
  return active
    ? "block w-full rounded-md border border-pink-500/70 bg-gradient-to-r from-pink-600/30 to-red-600/10 px-3 py-2 text-left text-sm font-extrabold uppercase tracking-[0.05em] text-pink-100 possum-nav-active"
    : "block w-full rounded-md border border-transparent px-3 py-2 text-left text-sm font-bold uppercase tracking-[0.04em] text-red-300/85 hover:border-pink-400/50 hover:bg-pink-500/10 hover:text-pink-100";
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
  const { isMasterOwner, isPrimaryOwner } = useDashboardSessionState();
  const featureVisibility = usePublicFeatureVisibility();
  const topLinks = useMemo(() => getDashboardNavTopLinks(isMasterOwner), [isMasterOwner]);
  const sections = useMemo(
    () => getDashboardNavSections(isMasterOwner, featureVisibility, isPrimaryOwner),
    [featureVisibility, isMasterOwner, isPrimaryOwner]
  );
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({});
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const prefetchedHrefsRef = useRef<Set<string>>(new Set());

  function isSectionOpen(label: string, defaultOpen: boolean) {
    return typeof openSections[label] === "boolean" ? openSections[label] : defaultOpen;
  }

  function toggleSection(label: string, defaultOpen: boolean) {
    setOpenSections((prev) => ({ ...prev, [label]: !isSectionOpen(label, defaultOpen) }));
  }

  function navigateTo(href: string) {
    setMobileMenuOpen(false);
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
    <div className="flex min-h-full flex-col rounded-xl border possum-divider bg-black/55 p-4 possum-border">
      <div className="mb-4 flex items-center justify-between gap-3 border-b possum-divider pb-3">
        <div className="min-w-0">
          <p className="text-[11px] uppercase tracking-[0.24em] possum-soft">Possum Bot</p>
          <button
            type="button"
            onClick={() => navigateTo("/dashboard")}
            className="mt-1 block text-left text-lg font-black uppercase tracking-[0.08em] possum-red possum-glow-soft hover:text-red-200"
          >
            Dashboard
          </button>
        </div>
        <button
          type="button"
          aria-expanded={mobileMenuOpen}
          aria-controls="possum-sidebar-navigation"
          onClick={() => setMobileMenuOpen((open) => !open)}
          className="min-h-11 shrink-0 rounded-md border possum-divider px-3 text-xs font-black uppercase tracking-[0.08em] text-pink-100 lg:hidden"
        >
          {mobileMenuOpen ? "Close menu" : "Menu"}
        </button>
      </div>

      <div
        id="possum-sidebar-navigation"
        className={mobileMenuOpen
          ? "block max-h-[calc(100dvh-6rem)] overflow-y-auto overscroll-contain lg:max-h-none lg:overflow-visible"
          : "hidden lg:block"}
      >
        <div className="mb-4 space-y-1 border-b possum-divider pb-3">
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

        <nav className="space-y-4">
          {sections.map((section) => {
            const defaultOpen = Boolean(section.defaultOpen || section.items.some((item) => isItemActive(pathname, item.href)));
            const open = isSectionOpen(section.label, defaultOpen);
            return (
              <div key={section.label} className="rounded-lg border border-pink-900/50 bg-black/30 possum-nav-section">
                <div className="flex items-stretch">
                  <button
                    type="button"
                    onClick={() => navigateTo(getSectionHref(section.label))}
                    onMouseEnter={() => prefetchHref(getSectionHref(section.label))}
                    title={`Open ${section.label} overview`}
                    className={`min-w-0 flex-1 px-3 py-2 text-left text-xs font-black uppercase tracking-[0.16em] hover:text-pink-200 ${
                      isItemActive(pathname, getSectionHref(section.label)) ? "text-pink-200" : "text-pink-300/90"
                    }`}
                  >
                    {section.label}
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleSection(section.label, defaultOpen)}
                    aria-expanded={open}
                    aria-label={`${open ? "Collapse" : "Expand"} ${section.label}`}
                    title={open ? "Collapse" : "Expand"}
                    className="possum-chevron flex w-10 items-center justify-center border-l border-pink-400/40 text-pink-200 hover:bg-pink-500/15"
                  >
                    <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform 160ms ease" }}>
                      <path d="M4 7l6 6 6-6" />
                    </svg>
                  </button>
                </div>
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
    </div>
  );
}
