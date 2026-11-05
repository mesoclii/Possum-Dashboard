"use client";

import { useEffect, useState } from "react";

const STORAGE_KEY = "possum.lang";
const ATTRS = ["placeholder", "title", "aria-label"] as const;
const SKIP_TAGS = new Set(["SCRIPT", "STYLE", "TEXTAREA", "INPUT", "CODE", "PRE", "NOSCRIPT"]);

type Dict = Record<string, string>;

function translateValue(dict: Dict, raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const hit = dict[trimmed];
  if (!hit || hit === trimmed) return null;
  const lead = raw.slice(0, raw.indexOf(trimmed));
  const trail = raw.slice(raw.indexOf(trimmed) + trimmed.length);
  return `${lead}${hit}${trail}`;
}

function shouldSkip(el: Element | null): boolean {
  for (let node: Element | null = el; node; node = node.parentElement) {
    if (SKIP_TAGS.has(node.tagName) || node.hasAttribute("data-no-translate") || node.getAttribute("contenteditable") === "true") {
      return true;
    }
  }
  return false;
}

function translateTextNode(dict: Dict, node: Text) {
  if (shouldSkip(node.parentElement)) return;
  const next = translateValue(dict, node.nodeValue || "");
  if (next !== null && next !== node.nodeValue) node.nodeValue = next;
}

function translateAttributes(dict: Dict, el: Element) {
  if (shouldSkip(el)) return;
  for (const attr of ATTRS) {
    const value = el.getAttribute(attr);
    if (!value) continue;
    const next = translateValue(dict, value);
    if (next !== null && next !== value) el.setAttribute(attr, next);
  }
}

function translateTree(dict: Dict, root: Node) {
  if (root.nodeType === Node.TEXT_NODE) {
    translateTextNode(dict, root as Text);
    return;
  }
  if (root.nodeType !== Node.ELEMENT_NODE) return;
  const el = root as Element;
  translateAttributes(dict, el);
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
  let current = walker.nextNode();
  while (current) {
    if (current.nodeType === Node.TEXT_NODE) translateTextNode(dict, current as Text);
    else translateAttributes(dict, current as Element);
    current = walker.nextNode();
  }
}

/**
 * Spanish UI support. English is the source of truth; when Spanish is chosen the
 * visible strings are swapped through a dictionary, and anything without an entry
 * stays English. Switching back to English reloads the page.
 */
export default function LanguageProvider() {
  const [lang, setLang] = useState<"en" | "es">("en");

  useEffect(() => {
    let saved: string | null = null;
    try {
      saved = window.localStorage.getItem(STORAGE_KEY);
    } catch {}
    if (saved === "es") setLang("es");
  }, []);

  useEffect(() => {
    if (lang !== "es") return;
    document.documentElement.lang = "es";
    let observer: MutationObserver | null = null;
    let cancelled = false;

    void import("@/lib/i18n/es.json").then((mod) => {
      if (cancelled) return;
      const dict = ((mod as any).default || mod) as Dict;
      translateTree(dict, document.body);
      observer = new MutationObserver((records) => {
        observer?.disconnect();
        for (const record of records) {
          if (record.type === "characterData") translateTree(dict, record.target);
          else if (record.type === "attributes") translateAttributes(dict, record.target as Element);
          else record.addedNodes.forEach((node) => translateTree(dict, node));
        }
        observer?.observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: [...ATTRS] });
      });
      observer.observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: [...ATTRS] });
    });

    return () => {
      cancelled = true;
      observer?.disconnect();
    };
  }, [lang]);

  function choose(next: "en" | "es") {
    if (next === lang) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {}
    if (next === "en") {
      window.location.reload();
      return;
    }
    setLang(next);
  }

  const pill = (active: boolean) => ({
    padding: "6px 10px",
    border: "none",
    cursor: "pointer",
    fontWeight: 900,
    fontSize: 12,
    letterSpacing: "0.08em",
    color: active ? "#fff" : "#ffb8b8",
    background: active ? "rgba(190,20,20,.85)" : "transparent",
  });

  return (
    <div
      data-no-translate
      style={{
        position: "fixed",
        right: 14,
        bottom: 14,
        zIndex: 9999,
        display: "flex",
        borderRadius: 999,
        overflow: "hidden",
        border: "1px solid rgba(255,0,0,.5)",
        background: "rgba(0,0,0,.85)",
      }}
    >
      <button type="button" aria-label="English" onClick={() => choose("en")} style={pill(lang === "en")}>
        EN
      </button>
      <button type="button" aria-label="Español" onClick={() => choose("es")} style={pill(lang === "es")}>
        ES
      </button>
    </div>
  );
}
