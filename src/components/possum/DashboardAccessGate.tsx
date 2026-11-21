"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

const ACCESS_CACHE_TTL_MS = 15 * 60 * 1000;
const SESSION_CACHE_TTL_MS = 10 * 60 * 1000;

type AccessCacheEntry = {
  allowed: boolean;
  reason: string;
  checkedAt: number;
};

type SessionCacheEntry = {
  loggedIn: boolean;
  userId: string;
  checkedAt: number;
};

function getContext() {
  if (typeof window === "undefined") {
    return { guildId: "", userId: "" };
  }

  const params = new URLSearchParams(window.location.search);
  const guildId = String(params.get("guildId") || localStorage.getItem("activeGuildId") || "").trim();
  if (guildId) localStorage.setItem("activeGuildId", guildId);

  const userId = String(
    params.get("userId") ||
      params.get("uid") ||
      localStorage.getItem("dashboardUserId") ||
      ""
  ).trim();
  if (userId) localStorage.setItem("dashboardUserId", userId);

  return { guildId, userId };
}

function accessReasonLabel(reason: string) {
  switch (reason) {
    case "ok_global_owner":
      return "Allowed by global owner override.";
    case "explicit_user_allowed":
      return "Allowed by the live dashboard allowlist.";
    case "explicit_user_denied":
      return "Denied by the live dashboard denylist.";
    case "ok_dashboard_policy_role":
      return "Allowed by the live dashboard role policy.";
    case "ok_native_admin":
      return "Allowed by guild owner or native Discord admin permissions.";
    case "ok_dashboard_access_role":
      return "Allowed by the configured dashboard access role.";
    case "ok_role_level":
      return "Allowed by the configured minimum role level.";
    case "ok_public_guild_member":
      return "Allowed as a member of this Discord server.";
    case "ok_member_gaming_portal_user":
      return "Allowed by the member gaming portal allowlist.";
    case "ok_member_gaming_portal_role":
      return "Allowed by the member gaming portal role policy.";
    case "member_gaming_portal_disabled":
      return "Member gaming portal is disabled for this guild.";
    case "route_not_allowed":
      return "Your policy does not allow this dashboard route.";
    case "dashboard_policy_inactive":
      return "Dashboard policy is disabled for this guild.";
    case "member_not_found":
      return "Your account is not currently resolved as a guild member.";
    default:
      return "Dashboard access denied by the live guild access policy.";
  }
}

function accessCacheKey(guildId: string, userId: string, routePath: string) {
  return `dashboard-access-v2:${guildId}:${userId}:${routePath || "/"}`;
}

function sessionCacheKey() {
  return "dashboard-session-brief";
}

function readAccessCache(guildId: string, userId: string, routePath: string): AccessCacheEntry | null {
  if (typeof window === "undefined" || !guildId || !userId) {
    return null;
  }

  try {
    const raw = sessionStorage.getItem(accessCacheKey(guildId, userId, routePath));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AccessCacheEntry;
    if (!parsed || typeof parsed !== "object") return null;
    if (Date.now() - Number(parsed.checkedAt || 0) > ACCESS_CACHE_TTL_MS) {
      sessionStorage.removeItem(accessCacheKey(guildId, userId, routePath));
      return null;
    }
    return {
      allowed: Boolean(parsed.allowed),
      reason: String(parsed.reason || ""),
      checkedAt: Number(parsed.checkedAt || 0),
    };
  } catch {
    return null;
  }
}

function writeAccessCache(guildId: string, userId: string, routePath: string, entry: Omit<AccessCacheEntry, "checkedAt">) {
  if (typeof window === "undefined" || !guildId || !userId) {
    return;
  }

  if (!entry.allowed) {
    try { sessionStorage.removeItem(accessCacheKey(guildId, userId, routePath)); } catch {}
    return;
  }

  try {
    sessionStorage.setItem(
      accessCacheKey(guildId, userId, routePath),
      JSON.stringify({
        allowed: Boolean(entry.allowed),
        reason: String(entry.reason || ""),
        checkedAt: Date.now(),
      })
    );
  } catch {
    // Ignore sessionStorage quota or privacy failures.
  }
}

function readSessionCache(): SessionCacheEntry | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = sessionStorage.getItem(sessionCacheKey());
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SessionCacheEntry;
    if (!parsed || typeof parsed !== "object") return null;
    if (Date.now() - Number(parsed.checkedAt || 0) > SESSION_CACHE_TTL_MS) {
      sessionStorage.removeItem(sessionCacheKey());
      return null;
    }
    return {
      loggedIn: Boolean(parsed.loggedIn),
      userId: String(parsed.userId || ""),
      checkedAt: Number(parsed.checkedAt || 0),
    };
  } catch {
    return null;
  }
}

function writeSessionCache(entry: Omit<SessionCacheEntry, "checkedAt">) {
  if (typeof window === "undefined") return;

  try {
    sessionStorage.setItem(
      sessionCacheKey(),
      JSON.stringify({
        loggedIn: Boolean(entry.loggedIn),
        userId: String(entry.userId || ""),
        checkedAt: Date.now(),
      })
    );
  } catch {
    // Ignore sessionStorage failures on restricted browsers.
  }
}

async function fetchJsonWithTimeout(url: string, timeoutMs: number) {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      cache: "no-store",
      signal: controller.signal,
    });
    const json = await res.json().catch(() => ({}));
    return { res, json };
  } finally {
    window.clearTimeout(timer);
  }
}

export default function DashboardAccessGate({ children }: { children: React.ReactNode }) {
  const [allowed, setAllowed] = useState(true);
  const [reason, setReason] = useState("");
  const pathname = usePathname();

  useEffect(() => {
    let mounted = true;

    (async () => {
      const context = getContext();
      const routePath = String(pathname || (typeof window !== "undefined" ? window.location.pathname : "/dashboard") || "/dashboard").trim();
      let userId = context.userId;
      const cachedSession = readSessionCache();
      if (!userId && cachedSession?.userId) {
        userId = cachedSession.userId;
      }
      const cachedAccess = readAccessCache(context.guildId, userId, routePath);

      if (cachedAccess && mounted) {
        setAllowed(cachedAccess.allowed);
        setReason(cachedAccess.reason);
        return;
      }

      try {
        let sessionJson: any = cachedSession
          ? { loggedIn: cachedSession.loggedIn, user: { id: cachedSession.userId } }
          : null;
        if (!sessionJson) {
          const sessionFetch = await fetchJsonWithTimeout("/api/auth/session?brief=1", 4500);
          sessionJson = sessionFetch.json;
          if (sessionJson?.loggedIn) {
            writeSessionCache({
              loggedIn: true,
              userId: String(sessionJson?.user?.id || "").trim(),
            });
          }
        }
        if (!sessionJson?.loggedIn) {
          if (!mounted) return;
          setAllowed(false);
          setReason("Login required. Please connect Discord before entering the dashboard.");
          return;
        }

        userId = String(sessionJson?.user?.id || userId || "").trim();
        if (userId && typeof window !== "undefined") {
          localStorage.setItem("dashboardUserId", userId);
        }
      } catch {
        if (!mounted) return;
        if (context.guildId) {
          setAllowed(true);
        } else {
          setAllowed(false);
          setReason("Login session check failed. Please reload and log in again.");
        }
        return;
      }

      if (!context.guildId || !userId) {
        if (!mounted) return;
        setAllowed(Boolean(!context.guildId));
        if (!context.guildId) return;
        setReason("Dashboard identity context missing. Please log in again.");
        return;
      }

      try {
        const { res: accessRes, json: accessJson } = await fetchJsonWithTimeout(
          `/api/bot/guild-access?guildId=${encodeURIComponent(context.guildId)}&userId=${encodeURIComponent(userId)}&routePath=${encodeURIComponent(routePath)}`,
          7000
        );

        if (!mounted) return;

        if (!accessRes.ok || accessJson?.success === false) {
          throw new Error(accessJson?.error || "Live guild access check failed.");
        }

        const nextAllowed = Boolean(accessJson?.access);
        const nextReason = accessReasonLabel(String(accessJson?.reason || ""));
        setAllowed(nextAllowed);
        setReason(nextReason);
        writeAccessCache(context.guildId, userId, routePath, { allowed: nextAllowed, reason: nextReason });
      } catch {
        if (!mounted) return;
        setAllowed(true);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [pathname]);

  if (!allowed) {
    return (
      <div
        style={{
          border: "1px solid #8f0000",
          borderRadius: 12,
          padding: 16,
          background: "rgba(120,0,0,0.16)",
          color: "#ffd3d3",
          maxWidth: 860,
        }}
      >
        <h2 style={{ marginTop: 0, color: "#ff5555", letterSpacing: "0.10em", textTransform: "uppercase" }}>
          Access denied
        </h2>
        <p style={{ marginBottom: 12 }}>{reason}</p>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <a
            href="/api/auth/discord/login"
            style={{
              border: "1px solid #7a0000",
              borderRadius: 10,
              padding: "8px 12px",
              color: "#ffd0d0",
              textDecoration: "none",
              fontWeight: 700,
              background: "#1a0000",
            }}
          >
            Login with Discord
          </a>
          <a
            href="/guilds"
            style={{
              border: "1px solid #7a0000",
              borderRadius: 10,
              padding: "8px 12px",
              color: "#ffd0d0",
              textDecoration: "none",
              fontWeight: 700,
              background: "#1a0000",
            }}
          >
            Return to Guild Select
          </a>
        </div>
      </div>
    );
  }

  return (
    <>
      {children}
    </>
  );
}
