export const SERVER_BOT_API = String(process.env.BOT_API_URL || "http://127.0.0.1:3001").trim();
const SERVER_BOT_API_TIMEOUT_MS = Math.max(5_000, Number(process.env.BOT_API_TIMEOUT_MS || 45_000));

const DASHBOARD_TOKEN = String(process.env.DASHBOARD_API_TOKEN || "").trim();

export function buildServerBotApiHeaders(
  userId?: string,
  _options: { allowFallback?: boolean } = {}
) {
  const headers: Record<string, string> = {};
  if (DASHBOARD_TOKEN) headers["x-dashboard-token"] = DASHBOARD_TOKEN;
  const normalizedUserId = String(userId || "").trim();
  if (normalizedUserId) {
    headers["x-dashboard-user-id"] = normalizedUserId;
  }
  return headers;
}

export async function readServerBotApiJson(response: Response) {
  let text = "";
  try {
    text = await response.text();
  } catch (error: any) {
    if (error?.name === "AbortError" || /aborted/i.test(String(error?.message || ""))) {
      return { success: false, error: "Bot API response stream was interrupted before it finished." };
    }
    return { success: false, error: error?.message || "Failed to read Bot API response." };
  }
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    return { success: false, error: text || "Invalid upstream JSON" };
  }
}

export async function fetchServerBotApi(
  url: string,
  init: RequestInit = {},
  timeoutMs = SERVER_BOT_API_TIMEOUT_MS
) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      ...init,
      cache: init.cache ?? "no-store",
      signal: controller.signal,
    });
  } catch (error: any) {
    if (error?.name === "AbortError" || /aborted/i.test(String(error?.message || ""))) {
      throw new Error(`Bot API timed out after ${timeoutMs}ms.`);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}
