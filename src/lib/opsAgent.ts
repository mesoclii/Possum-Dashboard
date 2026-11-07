import { NextRequest, NextResponse } from "next/server";
import { isDashboardControlOwner } from "@/lib/dashboardOwner";
import { DASHBOARD_SESSION_COOKIE, readDashboardSessionValue } from "@/lib/session";

export async function requireOpsOwner(request: NextRequest) {
  const session = await readDashboardSessionValue(
    request.cookies.get(DASHBOARD_SESSION_COOKIE)?.value
  ).catch(() => null);
  const userId = String(session?.user?.id || "").trim();
  if (!userId) {
    return { session: null, response: NextResponse.json({ success: false, error: "Authentication required" }, { status: 401 }) };
  }
  if (!isDashboardControlOwner(userId)) {
    return { session: null, response: NextResponse.json({ success: false, error: "Creator access required" }, { status: 403 }) };
  }
  return { session, response: null };
}

export async function opsAgentRequest(path: string, init: RequestInit = {}) {
  const base = String(process.env.OPS_AGENT_URL || "http://127.0.0.1:3190").replace(/\/+$/, "");
  const token = String(process.env.OPS_AGENT_TOKEN || "").trim();
  if (!token) {
    return { ok: false, status: 503, body: { success: false, error: "Operations agent token is not configured on the dashboard." } };
  }
  let url: URL;
  try {
    const baseUrl = new URL(base);
    const hostname = baseUrl.hostname.toLowerCase().replace(/^\\[|\\]$/g, "");
    if (
      baseUrl.protocol !== "http:" ||
      !["127.0.0.1", "::1", "localhost"].includes(hostname) ||
      baseUrl.pathname !== "/" ||
      baseUrl.username ||
      baseUrl.password
    ) throw new Error("Operations agent must be local and loopback-only");
    url = new URL(path, baseUrl);
    if (url.origin !== baseUrl.origin) throw new Error("Invalid operations path");
  } catch {
    return { ok: false, status: 500, body: { success: false, error: "Operations agent must be configured on a local loopback URL." } };
  }
  try {
    const headers = new Headers(init.headers);
    headers.set("accept", "application/json");
    headers.set("authorization", `Bearer ${token}`);
    if (init.body && !headers.has("content-type")) headers.set("content-type", "application/json");
    const response = await fetch(url, {
      ...init,
      headers,
      cache: "no-store",
      signal: AbortSignal.timeout(6000),
    });
    const body = await response.json().catch(() => ({}));
    return { ok: response.ok, status: response.status, body };
  } catch {
    return { ok: false, status: 502, body: { success: false, error: "Operations agent is unreachable." } };
  }
}

export function opsError(result: { ok: boolean; status: number; body: any }) {
  return NextResponse.json(
    { success: false, error: result.body?.error || "Operations agent request failed." },
    { status: result.status }
  );
}

export function normalizeIncident(item: any) {
  return {
    id: String(item?.id || ""),
    ref: String(item?.ref || item?.id || ""),
    title: String(item?.title || "Untitled incident"),
    severity: String(item?.severity || "warning"),
    status: String(item?.status || "open"),
    service: String(item?.service || item?.source || "system"),
    occurrences: Number(item?.occurrences || 1),
    firstSeenAt: String(item?.firstSeenAt || item?.createdAt || ""),
    lastSeenAt: String(item?.lastSeenAt || item?.createdAt || ""),
    summary: String(item?.summary || item?.detail || ""),
    details: item?.details && typeof item.details === "object" ? item.details : {},
    events: Array.isArray(item?.events) ? item.events : [],
    acknowledgedAt: item?.acknowledgedAt || null,
    acknowledgedBy: item?.acknowledgedBy || null,
    resolvedAt: item?.resolvedAt || null,
    resolvedBy: item?.resolvedBy || null,
    resolutionReason: item?.resolutionReason || null,
  };
}
