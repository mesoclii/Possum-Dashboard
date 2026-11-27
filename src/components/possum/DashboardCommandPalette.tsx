"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useDashboardSessionState } from "@/components/possum/useDashboardSessionState";
import { usePublicFeatureVisibility } from "@/components/possum/usePublicFeatureVisibility";
import { buildDashboardHref } from "@/lib/dashboardContext";
import { getDashboardNavSections, getDashboardNavTopLinks } from "@/lib/dashboard/navigation";
import { createDashboardCommandEntries, searchDashboardCommands } from "@/lib/dashboard/commandPalette";

export default function DashboardCommandPalette() {
  const router = useRouter();
  const paletteId = useId();
  const { isMasterOwner, isPrimaryOwner, isPokemonOperator } = useDashboardSessionState();
  const featureVisibility = usePublicFeatureVisibility();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const dialogRef = useRef<HTMLElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const entries = useMemo(() => createDashboardCommandEntries(
    getDashboardNavTopLinks(isMasterOwner, isPrimaryOwner, isPokemonOperator),
    getDashboardNavSections(isMasterOwner, featureVisibility, isPrimaryOwner, isPokemonOperator)
  ), [featureVisibility, isMasterOwner, isPokemonOperator, isPrimaryOwner]);
  const results = useMemo(() => searchDashboardCommands(entries, query), [entries, query]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        const target = event.target;
        if (target instanceof HTMLElement && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))) return;
        event.preventDefault();
        setOpen(true);
      } else if (event.key === "Escape") {
        setOpen(false);
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    if (open) {
      returnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      inputRef.current?.focus();
    } else {
      returnFocusRef.current?.focus();
      returnFocusRef.current = null;
      setQuery("");
      setActiveIndex(0);
    }
  }, [open]);

  useEffect(() => {
    setActiveIndex((index) => Math.min(index, Math.max(0, results.length - 1)));
  }, [results.length]);

  function navigate(href: string) {
    setOpen(false);
    router.push(buildDashboardHref(href));
  }

  return (
    <>
      <button
        type="button"
        aria-keyshortcuts="Control+K Meta+K"
        onClick={() => setOpen(true)}
        className="rounded-lg border possum-divider bg-black/40 px-3 py-2 text-sm font-bold text-pink-100 possum-btn"
      >
        Search pages <span className="ml-1 text-xs possum-soft">Ctrl/⌘ K</span>
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-[100] flex items-start justify-center bg-black/75 px-3 pt-[12vh] backdrop-blur-sm"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setOpen(false);
          }}
        >
          <section
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="dashboard-command-title"
            onKeyDown={(event) => {
              if (event.key !== "Tab") return;
              const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
                'input:not([disabled]), button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])'
              );
              if (!focusable?.length) {
                event.preventDefault();
                return;
              }
              const first = focusable[0];
              const last = focusable[focusable.length - 1];
              if (event.shiftKey && document.activeElement === first) {
                event.preventDefault();
                last.focus();
              } else if (!event.shiftKey && document.activeElement === last) {
                event.preventDefault();
                first.focus();
              }
            }}
            className="w-full max-w-2xl overflow-hidden rounded-xl border border-pink-500/50 bg-[#160b17] shadow-2xl shadow-black/70"
          >
            <h2 id="dashboard-command-title" className="sr-only">Search dashboard pages</h2>
            <div className="border-b border-pink-500/20 p-4">
              <label htmlFor="dashboard-command-search" className="sr-only">Search dashboard pages</label>
              <input
                ref={inputRef}
                id="dashboard-command-search"
                role="combobox"
                aria-autocomplete="list"
                aria-expanded="true"
                aria-controls={`${paletteId}-results`}
                aria-activedescendant={results[activeIndex] ? `${paletteId}-option-${activeIndex}` : undefined}
                autoComplete="off"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "ArrowDown") {
                    event.preventDefault();
                    setActiveIndex((index) => Math.min(results.length - 1, index + 1));
                  } else if (event.key === "ArrowUp") {
                    event.preventDefault();
                    setActiveIndex((index) => Math.max(0, index - 1));
                  } else if (event.key === "Enter" && results[activeIndex]) {
                    event.preventDefault();
                    navigate(results[activeIndex].href);
                  }
                }}
                placeholder="Find a dashboard page or feature..."
                className="w-full bg-transparent text-base text-pink-50 outline-none placeholder:text-pink-200/45"
              />
              <p className="mt-2 text-xs text-pink-100/55">Searches pages available to your current role and selected feature access.</p>
            </div>

            <div id={`${paletteId}-results`} role="listbox" aria-label="Dashboard pages" className="max-h-[55vh] overflow-y-auto p-2">
              {results.length ? results.map((entry, index) => (
                <button
                  key={entry.href}
                  id={`${paletteId}-option-${index}`}
                  type="button"
                  role="option"
                  aria-selected={index === activeIndex}
                  onMouseEnter={() => setActiveIndex(index)}
                  onClick={() => navigate(entry.href)}
                  className={`flex w-full items-center justify-between gap-4 rounded-lg px-3 py-3 text-left ${index === activeIndex ? "bg-pink-500/20 text-pink-50" : "text-pink-100/85 hover:bg-pink-500/10"}`}
                >
                  <span className="font-semibold">{entry.label}</span>
                  <span className="shrink-0 text-xs text-pink-200/55">{entry.group}</span>
                </button>
              )) : (
                <p className="px-3 py-8 text-center text-sm text-pink-100/60">No available dashboard pages match that search.</p>
              )}
            </div>

            <div className="flex justify-between border-t border-pink-500/20 px-4 py-2 text-xs text-pink-100/55">
              <span>Up/down select · Enter open</span>
              <span>Esc close</span>
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}
