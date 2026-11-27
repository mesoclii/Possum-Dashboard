export async function readAuditResponse(response: Response): Promise<Record<string, unknown>> {
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw new Error(response.ok ? "Invalid response from the server." : `Request failed (HTTP ${response.status}).`);
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new Error(response.ok ? "Invalid response from the server." : `Request failed (HTTP ${response.status}).`);
  }
  const result = body as Record<string, unknown>;
  if (!response.ok || result.success !== true) {
    throw new Error(typeof result.error === "string" && result.error.trim()
      ? result.error
      : response.ok ? "Request failed." : `Request failed (HTTP ${response.status}).`);
  }
  return result;
}

export async function requestAuditData<T>(
  url: string,
  field: string,
  isValid: (value: unknown) => value is T,
  signal: AbortSignal
): Promise<T> {
  const result = await readAuditResponse(await fetch(url, { signal, cache: "no-store" }));
  const value = result[field];
  if (!isValid(value)) throw new Error("Invalid response from the server.");
  return value;
}
