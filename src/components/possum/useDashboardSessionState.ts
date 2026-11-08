"use client";

import { useEffect, useState } from "react";

type DashboardSessionState = {
  loading: boolean;
  loggedIn: boolean;
  isMasterOwner: boolean;
  isPrimaryOwner: boolean;
};

const DEFAULT_STATE: DashboardSessionState = {
  loading: true,
  loggedIn: false,
  isMasterOwner: false,
  isPrimaryOwner: false,
};

const SESSION_CACHE_TTL_MS = 5 * 60_000;
const SESSION_STORAGE_KEY = "dashboard-session-state";

let sessionCache:
  | {
      value: DashboardSessionState;
      expiresAt: number;
    }
  | null = null;
let sessionRequest: Promise<DashboardSessionState> | null = null;

function readSessionStorageCache(): DashboardSessionState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as DashboardSessionState & { checkedAt?: number };
    if (!parsed || typeof parsed !== "object") return null;
    if (Date.now() - Number(parsed.checkedAt || 0) > SESSION_CACHE_TTL_MS) {
      sessionStorage.removeItem(SESSION_STORAGE_KEY);
      return null;
    }
    return {
      loading: false,
      loggedIn: Boolean(parsed.loggedIn),
      isMasterOwner: Boolean(parsed.isMasterOwner),
      isPrimaryOwner: Boolean(parsed.isPrimaryOwner),
    };
  } catch {
    return null;
  }
}

function writeSessionStorageCache(value: DashboardSessionState) {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(
      SESSION_STORAGE_KEY,
      JSON.stringify({
        loading: false,
        loggedIn: Boolean(value.loggedIn),
        isMasterOwner: Boolean(value.isMasterOwner),
        isPrimaryOwner: Boolean(value.isPrimaryOwner),
        checkedAt: Date.now(),
      })
    );
  } catch {
    // Ignore sessionStorage failures.
  }
}

async function loadDashboardSessionState(): Promise<DashboardSessionState> {
  const now = Date.now();
  if (sessionCache && sessionCache.expiresAt > now) {
    return sessionCache.value;
  }

  const storageCached = readSessionStorageCache();
  if (storageCached) {
    sessionCache = {
      value: storageCached,
      expiresAt: now + SESSION_CACHE_TTL_MS,
    };
    return storageCached;
  }

  if (sessionRequest) {
    return sessionRequest;
  }

  sessionRequest = (async () => {
    let nextState: DashboardSessionState = {
      loading: false,
      loggedIn: false,
      isMasterOwner: false,
      isPrimaryOwner: false,
    };
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 3500);

    try {
      const res = await fetch("/api/auth/session?brief=1", {
        cache: "no-store",
        signal: controller.signal,
      });
      const json = await res.json().catch(() => ({}));
      nextState = {
        loading: false,
        loggedIn: Boolean(json?.loggedIn),
        isMasterOwner: Boolean(json?.isMasterOwner),
        isPrimaryOwner: Boolean(json?.isPrimaryOwner),
      };
    } catch {
      nextState = {
        loading: false,
        loggedIn: false,
        isMasterOwner: false,
        isPrimaryOwner: false,
      };
    } finally {
      window.clearTimeout(timeout);
    }

    sessionCache = {
      value: nextState,
      expiresAt: Date.now() + SESSION_CACHE_TTL_MS,
    };
    if (nextState.loggedIn) {
      writeSessionStorageCache(nextState);
    }
    sessionRequest = null;
    return nextState;
  })();

  return sessionRequest;
}

export function useDashboardSessionState() {
  const [state, setState] = useState<DashboardSessionState>(DEFAULT_STATE);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const nextState = await loadDashboardSessionState();
      if (cancelled) return;
      setState(nextState);
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
