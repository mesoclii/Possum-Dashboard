"use client";

export function getGuildId(): string {
  if (typeof window === "undefined") return "";
  const q = new URLSearchParams(window.location.search).get("guildId") || "";
  const s = localStorage.getItem("activeGuildId") || "";
  const v = (q || s).trim();
  if (v) localStorage.setItem("activeGuildId", v);
  return v;
}

export function toCsv(v: any): string {
  return Array.isArray(v) ? v.join(", ") : "";
}

export function fromCsv(v: string): string[] {
  return String(v || "")
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
}

export async function loadDashboardConfig(guildId: string): Promise<any> {
  const r = await fetch(`/api/bot/dashboard-config?guildId=${encodeURIComponent(guildId)}`, { cache: "no-store" });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j?.success === false) throw new Error(j?.error || "Failed to load dashboard config");
  return j?.config || {};
}

export async function saveDashboardPatch(guildId: string, patch: any): Promise<any> {
  const r = await fetch("/api/bot/dashboard-config", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ guildId, patch }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j?.success === false) throw new Error(j?.error || "Save failed");
  return j;
}

export const styles: Record<string, any> = {
  page: { color: "#ffb3b3", padding: 16, maxWidth: 1200 },
  card: { border: "1px solid #5f0000", borderRadius: 12, padding: 14, background: "rgba(120,0,0,0.10)", marginBottom: 12 },
  input: { width: "100%", padding: 10, borderRadius: 8, border: "1px solid #6f0000", background: "#0a0a0a", color: "#ffd7d7" },
  area: { width: "100%", minHeight: 90, padding: 10, borderRadius: 8, border: "1px solid #6f0000", background: "#0a0a0a", color: "#ffd7d7" },
  saveDock: {
    position: "fixed",
    right: 18,
    bottom: 18,
    zIndex: 40,
    border: "1px solid #7a0000",
    borderRadius: 12,
    padding: 10,
    background: "rgba(20,0,0,0.95)",
    display: "flex",
    alignItems: "center",
    gap: 8,
    boxShadow: "0 0 22px rgba(255,0,0,0.18)",
  },
};

export function StatusPill({ on }: { on: boolean }) {
  return (
    <span
      style={{
        marginLeft: 8,
        padding: "2px 8px",
        borderRadius: 999,
        border: `1px solid ${on ? "#1a9f4a" : "#7a0000"}`,
        color: on ? "#8cffb2" : "#ff9a9a",
        fontSize: 12,
      }}
    >
      {on ? "ENABLED" : "DISABLED"}
    </span>
  );
}
