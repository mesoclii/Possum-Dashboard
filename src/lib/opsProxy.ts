import type { NextApiRequest, NextApiResponse } from "next";
import { DASHBOARD_SESSION_COOKIE, readDashboardSessionValue } from "@/lib/session";
import { isDashboardControlOwner } from "@/lib/dashboardOwner";

/**
 * Server-side proxy to the operations agent.
 *
 * Two rules hold for every route in this folder:
 *  1. The caller must be an authenticated creator. Hiding the nav link is not
 *     security, so the check lives here, not in the UI.
 *  2. The agent bearer token is read from process.env on the server and is never
 *     placed in a response body, a cookie or client-side state.
 */

const DEFAULT_AGENT_PORT = "3190";
const DEFAULT_TIMEOUT_MS = 8000;

function agentBaseUrl(): string {
  const rawHost = String(process.env.OPS_AGENT_HOST || "127.0.0.1").trim() || "127.0.0.1";
  const host = rawHost.replace(/^\\[|\\]$/g, "").toLowerCase();
  if (!["127.0.0.1", "::1", "localhost"].includes(host)) {
    throw new Error("OPS_AGENT_HOST must be a loopback address.");
  }
  const portText = String(process.env.OPS_AGENT_PORT || DEFAULT_AGENT_PORT).trim() || DEFAULT_AGENT_PORT;
  const port = Number(portText);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("OPS_AGENT_PORT must be between 1 and 65535.");
  }
  const address = host.includes(":") ? `[${host}]` : host;
  return `http://${address}:${port}`;
}

export type OpsActor = { userId: string; label: string };

export async function requireOpsOwner(req: NextApiRequest, res: NextApiResponse): Promise<OpsActor | null> {
  const session = await readDashboardSessionValue(req.cookies[DASHBOARD_SESSION_COOKIE]);
  const userId = String(session?.user?.id || "").trim();

  if (!userId) {
    res.status(401).json({ success: false, error: "Authentication required" });
    return null;
  }

  if (!isDashboardControlOwner(userId)) {
    res.status(403).json({ success: false, error: "Creator only" });
    return null;
  }

  const label = String(session?.user?.globalName || session?.user?.username || userId);
  return { userId, label };
}

export type AgentResult = {
  ok: boolean;
  status: number;
  data?: unknown;
  error?: string;
};

export async function callAgent(options: {
  path: string;
  method?: string;
  body?: unknown;
  actor?: OpsActor;
}): Promise<AgentResult> {
  const token = String(process.env.OPS_AGENT_TOKEN || "").trim();
  if (!token) {
    return { ok: false, status: 503, error: "Operations agent is not configured (OPS_AGENT_TOKEN)" };
  }

  try {
    const baseUrl = new URL(agentBaseUrl());
    const targetUrl = new URL(options.path, baseUrl);
    if (targetUrl.origin !== baseUrl.origin) throw new Error("Invalid operations agent path.");
    const response = await fetch(targetUrl, {
      method: options.method || "GET",
      headers: {
        authorization: `Bearer ${token}`,
        accept: "application/json",
        ...(options.body ? { "content-type": "application/json" } : {}),
        ...(options.actor ? { "x-ops-actor": options.actor.label } : {}),
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
      signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
      cache: "no-store",
    });

    const text = await response.text();
    if (text.length > 512 * 1024) {
      return { ok: false, status: 502, error: "Operations agent response exceeded the size limit." };
    }
    let payload: unknown = null;
    if (text) {
      try {
        payload = JSON.parse(text);
      } catch {
        payload = null;
      }
    }

    const record = (payload || {}) as { success?: boolean; data?: unknown; error?: string };

    if (!response.ok || record.success === false) {
      return { ok: false, status: response.status, error: record.error || `Agent returned HTTP ${response.status}` };
    }

    return { ok: true, status: 200, data: record.data };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const offline = message.includes("ECONNREFUSED") || message.includes("fetch failed");
    return {
      ok: false,
      status: offline ? 503 : 502,
      error: offline ? "Operations agent is not reachable" : `Agent request failed: ${message}`,
    };
  }
}

export async function proxyOps(
  req: NextApiRequest,
  res: NextApiResponse,
  path: string,
  options: { method?: string; body?: unknown } = {}
): Promise<void> {
  const actor = await requireOpsOwner(req, res);
  if (!actor) return;

  const result = await callAgent({ path, method: options.method || "GET", body: options.body, actor });

  res.setHeader("cache-control", "private, no-store");

  if (!result.ok) {
    res.status(result.status).json({ success: false, error: result.error });
    return;
  }

  res.status(200).json({ success: true, data: result.data });
}

export function queryString(req: NextApiRequest, keys: string[]): string {
  const params = new URLSearchParams();
  for (const key of keys) {
    const raw = req.query[key];
    const value = Array.isArray(raw) ? raw[0] : raw;
    if (value !== undefined && value !== "") params.set(key, value);
  }
  const encoded = params.toString();
  return encoded ? `?${encoded}` : "";
}

export function firstQueryValue(value: string | string[] | undefined): string {
  return String(Array.isArray(value) ? value[0] : value || "").trim();
}
