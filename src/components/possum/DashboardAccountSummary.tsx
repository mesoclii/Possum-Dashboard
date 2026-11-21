"use client";

import { useEffect, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { fetchGuildData } from "@/lib/liveRuntime";

type Summary = { name: string; plan: string; guildName: string };

export default function DashboardAccountSummary() {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const requestedGuildId = searchParams?.get("guildId") || "";
  const [summary, setSummary] = useState<Summary | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    const load = async () => {
      const guildId = requestedGuildId || window.localStorage.getItem("activeGuildId") || "";
      const savedGuildName = window.localStorage.getItem("activeGuildName") || "";
      setSummary(null);
      setError("");
      try {
        const sessionResponse = await fetch("/api/auth/session?brief=1", { cache: "no-store", signal: controller.signal });
        if (!sessionResponse.ok) throw new Error("Account details unavailable");
        const session = await sessionResponse.json();
        if (!session.loggedIn || !session.user) {
          if (active) setError("Sign in to see account details");
          return;
        }
        const name = String(session.user.globalName || session.user.username || "Discord user");
        if (active) setSummary({ name, guildName: guildId ? savedGuildName || "Loading server…" : "No server selected", plan: guildId ? "Checking..." : "Select a server" });
        if (!guildId) return;

        const [guild, response] = await Promise.all([
          fetchGuildData(guildId).catch(() => null),
          fetch(`/api/subscriptions/status?guildId=${encodeURIComponent(guildId)}`, { cache: "no-store", signal: controller.signal }),
        ]);
        const data = await response.json();
        if (!response.ok || !data.success || !data.status?.plan) throw new Error("Server plan unavailable");
        const currentGuildName = String((guild as any)?.guild?.name || savedGuildName || "Selected server");
        window.localStorage.setItem("activeGuildName", currentGuildName);
        const plan = String(data.status.plan);
        if (active) setSummary({ name, guildName: currentGuildName, plan: data.status.active || plan.toUpperCase() === "FREE" ? plan : `${plan} (inactive)` });
      } catch (err) {
        if (!active || controller.signal.aborted) return;
        setError(err instanceof Error ? err.message : "Account details unavailable");
      }
    };
    const refresh = () => void load();
    refresh();
    window.addEventListener("dashboard:guild-change", refresh);
    window.addEventListener("storage", refresh);
    window.addEventListener("focus", refresh);
    return () => {
      active = false;
      controller.abort();
      window.removeEventListener("dashboard:guild-change", refresh);
      window.removeEventListener("storage", refresh);
      window.removeEventListener("focus", refresh);
    };
  }, [pathname, requestedGuildId]);

  return (
    <div className="dashboard-account-summary" aria-label="Dashboard account summary">
      {summary ? (
        <>
          <div><span>Signed in</span><strong>{summary.name}</strong></div>
          <div><span>Current server</span><strong>{summary.guildName}</strong></div>
          <div><span>Server plan</span><strong>{error || summary.plan}</strong></div>
        </>
      ) : <span role={error ? "status" : undefined}>{error || "Loading account..."}</span>}
    </div>
  );
}
