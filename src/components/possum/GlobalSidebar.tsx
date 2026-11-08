"use client";

import { useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { buildDashboardHref } from "@/lib/dashboardContext";
import { useDashboardSessionState } from "@/components/possum/useDashboardSessionState";
import { usePublicFeatureVisibility } from "@/components/possum/usePublicFeatureVisibility";
import { getDashboardNavSections, getDashboardNavTopLinks, getSectionHref } from "@/lib/dashboard/navigation";

function isItemActive(pathname: string | null, href: string) {
  const baseHref = href.split("?")[0].split("#")[0];
  return pathname === baseHref || pathname?.startsWith(`${baseHref}/`);
}

export default function GlobalSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { isMasterOwner, isPrimaryOwner } = useDashboardSessionState();
  const featureVisibility = usePublicFeatureVisibility();
  const topLinks = useMemo(
    () => getDashboardNavTopLinks(isMasterOwner, isPrimaryOwner),
    [isMasterOwner, isPrimaryOwner]
  );
  const sections = useMemo(
    () => getDashboardNavSections(isMasterOwner, featureVisibility, isPrimaryOwner),
    [featureVisibility, isMasterOwner, isPrimaryOwner]
  );
  const [sectionOverride, setSectionOverride] = useState<{ pathname: string | null; label: string | null } | null>(null);
  const routeSection = sections.find((section) =>
    isItemActive(pathname, getSectionHref(section.label)) ||
    section.items.some((item) => isItemActive(pathname, item.href))
  ) ?? sections.find((section) => section.defaultOpen);
  const openSection = sectionOverride?.pathname === pathname ? sectionOverride.label : routeSection?.label ?? null;

  function navigateTo(href: string) {
    router.push(buildDashboardHref(href));
  }

  return (
    <aside className="w-full rounded-xl border possum-divider bg-black/80 p-4 possum-border">
      <p className="mb-3 text-sm font-semibold text-white">Navigation</p>
      <div className="mb-4 space-y-1">
        <button
          type="button"
          onClick={() => navigateTo("/dashboard")}
          className={
            isItemActive(pathname, "/dashboard")
              ? "block w-full rounded-md border border-pink-400/70 bg-pink-950/50 px-3 py-2 text-left text-sm font-black uppercase tracking-[0.04em] text-pink-100"
              : "block w-full rounded-md px-3 py-2 text-left text-sm font-bold uppercase tracking-[0.04em] text-red-200/80 hover:bg-pink-500/10 hover:text-pink-100"
          }
        >
          Dashboard
        </button>
        {topLinks.map((item) => {
          const active = isItemActive(pathname, item.href);
          return (
            <button
              key={item.href}
              type="button"
              onClick={() => navigateTo(item.href)}
              className={
                active
                  ? "relative z-10 block w-full cursor-pointer rounded-md border border-pink-400/70 bg-pink-950/50 px-3 py-2 text-left text-sm font-black uppercase tracking-[0.04em] text-pink-100"
                  : "relative z-10 block w-full cursor-pointer rounded-md px-3 py-2 text-left text-sm font-bold uppercase tracking-[0.04em] text-red-200/80 hover:bg-pink-500/10 hover:text-pink-100"
              }
            >
              {item.label}
            </button>
          );
        })}
      </div>
      <nav className="space-y-4">
        {sections.map((section) => {
          const open = openSection === section.label;
          return (
            <div key={section.label} className="rounded-lg border border-pink-500/40 bg-black/50 possum-border">
              <button
                type="button"
                onClick={() => setSectionOverride({
                  pathname,
                  label: openSection === section.label ? null : section.label
                })}
                className="flex w-full items-center justify-between px-3 py-2 text-left text-[11px] font-black uppercase tracking-[0.14em] text-pink-200"
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
                        className={
                          active
                            ? "relative z-10 block w-full cursor-pointer rounded-md border border-pink-400/70 bg-pink-950/50 px-3 py-2 text-left text-sm font-black uppercase tracking-[0.04em] text-pink-100"
                            : "relative z-10 block w-full cursor-pointer rounded-md px-3 py-2 text-left text-sm font-bold uppercase tracking-[0.04em] text-red-200/80 hover:bg-pink-500/10 hover:text-pink-100"
                        }
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
    </aside>
  );
}
