"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

type Summary = {
  name: string;
  plan: string;
};

export default function DashboardAccountSummary() {
  const searchParams = useSearchParams();
  const requestedGuildId = searchParams?.get("guildId") || "";
  const [summary, setSummary] = useState<Summary | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    const guildId = requestedGuildId || window.localStorage.getItem("activeGuildId") || "";

    async function load() {
      setSummary(null);
      setError("");
      try {
        const sessionResponse = await fetch("/api/auth/session?brief=1", { cache: "no-store", signal: controller.signal });
        if (!sessionResponse.ok) throw new Error("Account details unavailable");
        const session = await sessionResponse.json();
        if (!session.loggedIn || !session.user) {
          setError("Sign in to see account details");
          return;
        }
        const name = String(session.user.globalName || session.user.username || "Discord user");
        setSummary({ name, plan: guildId ? "Checking..." : "Select a server" });
        if (!guildId) return;

        const response = await fetch(`/api/subscriptions/status?guildId=${encodeURIComponent(guildId)}`, {
          cache: "no-store",
          signal: controller.signal,
        });
        const data = await response.json();
        if (!response.ok || !data.success || !data.status?.plan) throw new Error("Server plan unavailable");
        const plan = String(data.status.plan);
        setSummary({ name, plan: data.status.active || plan.toUpperCase() === "FREE" ? plan : `${plan} (inactive)` });
      } catch (err) {
        if (controller.signal.aborted) return;
        setError(err instanceof Error ? err.message : "Account details unavailable");
      }
    }

    void load();
    return () => controller.abort();
  }, [requestedGuildId]);

  return (
    <div className="dashboard-account-summary" aria-label="Dashboard account summary">
      {summary ? (
        <>
          <div><span>Signed in</span><strong>{summary.name}</strong></div>
          <div><span>Server plan</span><strong>{error || summary.plan}</strong></div>
        </>
      ) : <span role={error ? "status" : undefined}>{error || "Loading account..."}</span>}
    </div>
  );
}
