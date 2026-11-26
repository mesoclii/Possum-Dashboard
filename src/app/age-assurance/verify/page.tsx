"use client";

import {
  KidAgeGate,
  KidAgeGateError,
  KidAgeGateFail,
  KidAgeGatePass,
  KidAgeGatePending,
  KidAgeGateProhibited,
  KidPermissionSettings,
  KidSessionVerifyAge,
  KidSessionVerifyAgeError,
  KidSessionVerifyAgeFail,
  KidSessionVerifyAgePass,
  KidSessionVerifyAgePending,
  KidSettingsProvider,
  KidSessionProvider,
} from "@k-id/core-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useKidBrowserConfig } from "@/components/possum/KidCoreAppProvider";

type Surface =
  | "onboarding"
  | "adultFeatures"
  | "podcasts"
  | "tcgBattles"
  | "tcgTrades"
  | "jedPublishing";
type AssuranceState = {
  surface: Surface;
  scope: "guild" | "product";
  sessionId: string;
  challengeId: string;
  challengeType: string;
  challengeUrl: string;
  completed: boolean;
  requiresAdultVerification: boolean;
};

type ActionResponse = {
  success?: boolean;
  state?: AssuranceState | null;
  status?: string;
  error?: string;
  sessionCreated?: boolean;
};

class AgeAssuranceActionError extends Error {
  responseData: ActionResponse;

  constructor(message: string, responseData: ActionResponse) {
    super(message);
    this.name = "AgeAssuranceActionError";
    this.responseData = responseData;
  }
}

const LABELS: Record<Surface, string> = {
  onboarding: "server admission",
  adultFeatures: "Adult Emote Studio",
  podcasts: "podcast recording",
  tcgBattles: "TCG battles",
  tcgTrades: "TCG card trades",
  jedPublishing: "public JED publishing",
};

const PERMISSIONS = {
  onboarding: "join-groups",
  adultFeatures: "mature-language",
  podcasts: "voice-chat",
  tcgBattles: "multiplayer",
  tcgTrades: "send-gifts",
  jedPublishing: "mods",
} as const;

const panelStyle = {
  width: "min(100% - 32px, 760px)",
  margin: "48px auto",
  padding: 24,
  border: "1px solid #6f1b2b",
  borderRadius: 16,
  background: "#10090c",
  color: "#ffe6eb",
  fontFamily: "Arial, sans-serif",
  lineHeight: 1.6,
} as const;

const actionStyle = {
  border: "1px solid #b52a4a",
  borderRadius: 10,
  background: "#60142a",
  color: "#fff",
  cursor: "pointer",
  padding: "10px 14px",
  fontWeight: 700,
} as const;

const REQUEST_TOKEN_STORAGE_KEY = "possum.age-assurance.request.v1";
const REQUEST_TOKEN_TTL_MS = 2 * 60 * 60 * 1000;
const REQUEST_TOKEN_PATTERN = /^[A-Za-z0-9_-]{40,64}$/;

function readStoredRequestToken() {
  try {
    const stored = JSON.parse(sessionStorage.getItem(REQUEST_TOKEN_STORAGE_KEY) || "null");
    const token = String(stored?.token || "");
    const savedAt = Number(stored?.savedAt || 0);
    const now = Date.now();
    if (
      REQUEST_TOKEN_PATTERN.test(token) &&
      Number.isFinite(savedAt) &&
      savedAt > 0 &&
      savedAt <= now &&
      now - savedAt < REQUEST_TOKEN_TTL_MS
    ) {
      return token;
    }
    sessionStorage.removeItem(REQUEST_TOKEN_STORAGE_KEY);
  } catch {}
  return "";
}

async function postAction(action: string, payload: Record<string, string>): Promise<ActionResponse> {
  const response = await fetch(`/api/age-assurance/${action}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
    body: JSON.stringify(payload),
  });
  const parsed: unknown = await response.json().catch(() => ({}));
  const data: ActionResponse = parsed && typeof parsed === "object" && !Array.isArray(parsed)
    ? parsed as ActionResponse
    : {};
  if (!response.ok || data?.success !== true) {
    throw new AgeAssuranceActionError(
      String(data.error || "Age assurance request failed."),
      data
    );
  }
  return data;
}

export default function AgeAssuranceVerificationPage() {
  const [token, setToken] = useState("");
  const [state, setState] = useState<AssuranceState | null>(null);
  const [accessStatus, setAccessStatus] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [sdkReady, setSdkReady] = useState(false);
  const claimInFlight = useRef(false);
  const requestToken = useRef("");
  const { config: clientConfig, loading: clientConfigLoading, error: clientConfigError } = useKidBrowserConfig();

  const surfaceLabel = state ? LABELS[state.surface] : "requested feature";

  const refreshStatus = useCallback(async (stateToken: string) => {
    const result = await postAction("status", { token: stateToken });
    setState(result.state || null);
    setAccessStatus(String(result.status || "unknown"));
    return String(result.status || "unknown");
  }, []);

  const beginUpgrade = useCallback(async (stateToken: string) => {
    setBusy(true);
    setError("");
    try {
      const result = await postAction("upgrade", { token: stateToken });
      setState(result.state || null);
      setAccessStatus(String(result.status || "unknown"));
      setSdkReady(false);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Could not start age assurance.");
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    const pageUrl = new URL(window.location.href);
    const hasQueryToken = pageUrl.searchParams.has("token");
    const queryToken = String(pageUrl.searchParams.get("token") || "").trim();
    let incomingToken = queryToken;
    if (REQUEST_TOKEN_PATTERN.test(queryToken)) {
      requestToken.current = queryToken;
      try {
        sessionStorage.setItem(REQUEST_TOKEN_STORAGE_KEY, JSON.stringify({ token: queryToken, savedAt: Date.now() }));
      } catch {}
    } else if (hasQueryToken) {
      requestToken.current = "";
      try { sessionStorage.removeItem(REQUEST_TOKEN_STORAGE_KEY); } catch {}
    } else {
      incomingToken = requestToken.current || readStoredRequestToken();
      requestToken.current = incomingToken;
    }
    pageUrl.searchParams.delete("token");
    window.history.replaceState({}, "", `${pageUrl.pathname}${pageUrl.search}${pageUrl.hash}`);
    if (!REQUEST_TOKEN_PATTERN.test(incomingToken)) {
      setError("This age assurance link is missing or invalid. Return to Discord and request a new one.");
      return;
    }

    setToken(incomingToken);
    let active = true;
    void postAction("state", { token: incomingToken }).then(async (result) => {
      if (!active) return;
      const current = result.state as AssuranceState | null;
      if (!current) throw new Error("The age assurance request is unavailable.");
      setState(current);
      if (!current.sessionId) {
        setSdkReady(true);
        return;
      }
      if (current.challengeUrl) {
        setAccessStatus("pending");
        return;
      }
      if (current.completed) {
        await refreshStatus(incomingToken);
        return;
      }
      await beginUpgrade(incomingToken);
    }).catch((loadError) => {
      if (active) setError(loadError instanceof Error ? loadError.message : "Could not load age assurance.");
    });
    return () => {
      active = false;
    };
  }, [beginUpgrade, refreshStatus]);

  useEffect(() => {
    if (!token || !["enabled", "prohibited", "guardian-required"].includes(accessStatus)) return;
    try {
      const stored = JSON.parse(sessionStorage.getItem(REQUEST_TOKEN_STORAGE_KEY) || "null");
      if (stored?.token === token) sessionStorage.removeItem(REQUEST_TOKEN_STORAGE_KEY);
    } catch {}
  }, [accessStatus, token]);

  const handleClaim = useCallback(async (claimToken: string) => {
    if (!token || claimInFlight.current) return;
    claimInFlight.current = true;
    setBusy(true);
    setError("");
    try {
      const result = await postAction("claim", { token, claimToken });
      setState(result.state || null);
      setAccessStatus(String(result.status || "pending"));
      setSdkReady(!result.state?.sessionId);
    } catch (claimError) {
      if (claimError instanceof AgeAssuranceActionError) {
        const failedState = claimError.responseData.state;
        if (failedState?.sessionId) {
          setState(failedState);
          setAccessStatus("verification-required");
          setSdkReady(false);
        } else if (failedState?.challengeId || failedState?.challengeUrl) {
          setState(failedState);
          setAccessStatus("pending");
          setSdkReady(false);
        }
      }
      setError(claimError instanceof Error ? claimError.message : "k-ID could not confirm this session.");
    } finally {
      claimInFlight.current = false;
      setBusy(false);
    }
  }, [token]);

  const handleChallenge = useCallback(async (challengeId: string) => {
    if (!token) return;
    try {
      const result = await postAction("challenge", { token, challengeId });
      setState(result.state || null);
      setAccessStatus("pending");
    } catch (challengeError) {
      setError(challengeError instanceof Error ? challengeError.message : "Could not save the pending k-ID challenge.");
    }
  }, [token]);

  const handleSession = useCallback(async (sessionId: string) => {
    if (!token) return;
    try {
      const result = await postAction("session", { token, sessionId });
      if (result.status && result.status !== "awaiting-claim") {
        setState(result.state || null);
        setAccessStatus(String(result.status));
      }
    } catch (sessionError) {
      setError(sessionError instanceof Error ? sessionError.message : "Could not confirm the saved k-ID session.");
    }
  }, [token]);

  useEffect(() => {
    if (!token || (!state?.challengeId && !state?.challengeUrl) || accessStatus !== "pending") return;
    let active = true;
    const timer = window.setInterval(() => {
      void refreshStatus(token).then((status) => {
        if (active && status !== "pending") window.clearInterval(timer);
      }).catch((statusError) => {
        if (active) setError(statusError instanceof Error ? statusError.message : "Could not refresh k-ID status.");
      });
    }, 4000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [accessStatus, refreshStatus, state?.challengeId, state?.challengeUrl, token]);

  const retry = () => {
    if (token) void beginUpgrade(token);
  };

  const checkVerifiedAge = async () => {
    if (!token) return;
    setBusy(true);
    setError("");
    try {
      await refreshStatus(token);
    } catch (statusError) {
      setError(statusError instanceof Error ? statusError.message : "Could not confirm the k-ID age result.");
    } finally {
      setBusy(false);
    }
  };

  const statusText = accessStatus === "enabled"
    ? `k-ID confirmed access to ${surfaceLabel}. Return to the feature you requested.`
    : accessStatus === "prohibited"
      ? "k-ID says this feature is not available for this account. No other access decisions were made."
      : accessStatus === "age-verification-required"
        ? "The permission is enabled, but k-ID has not confirmed civil adult age for this session. Complete Verify Age below; the server will check again before allowing access."
      : accessStatus === "guardian-required"
        ? "This permission is guardian-managed and cannot unlock an adult-only feature."
        : accessStatus === "failed"
            ? state?.surface === "onboarding"
              ? "The k-ID challenge did not complete. You can retry or use the existing manual verification option."
              : "The k-ID challenge did not complete. You can retry or return to the feature later."
          : accessStatus === "verification-required"
              ? state?.surface === "onboarding"
                ? "The feature still needs an eligible k-ID permission. Retry the check or use the existing manual verification option."
                : "The feature still needs an eligible k-ID permission. Retry the check or return to the feature later."
            : accessStatus === "pending"
              ? "Complete the k-ID check below. This does not change your access to other Possum Bot features."
              : accessStatus
                ? state?.surface === "onboarding"
                  ? "k-ID could not confirm access. Use the existing manual verification option if this is server onboarding."
                  : "k-ID could not confirm access. No feature access was granted; try again or contact a server administrator."
                : "";

  return (
    <main style={panelStyle}>
      <h1 style={{ marginTop: 0, color: "#ff7794" }}>Possum Bot age assurance</h1>
      <p>
        This check applies only to the selected feature. It does not gate the dashboard, Gaming Hub,
        ordinary bot use, or public podcast playback.
      </p>
      {error ? <p role="alert" style={{ color: "#ff9b9b" }}>{error}</p> : null}
      {statusText ? <p role="status">{statusText}</p> : null}
      {busy ? <p>Confirming with k-ID…</p> : null}

      {state?.challengeUrl && accessStatus === "pending" ? (
        <iframe
          title={`k-ID verification for ${surfaceLabel}`}
          src={state.challengeUrl}
          width="100%"
          height="640"
          allow="camera;payment;publickey-credentials-get;publickey-credentials-create"
          referrerPolicy="no-referrer"
          style={{ border: "1px solid #6f1b2b", borderRadius: 12, background: "#fff" }}
        />
      ) : null}

      {token && state ? (
        clientConfigLoading ? (
          <p role="status">Loading the saved k-ID browser setup…</p>
        ) : !clientConfig ? (
          <p role="alert">
            {clientConfigError || "The active k-ID browser configuration is incomplete. Save its publishable key, browser URL, dashboard URL, and support email."}
          </p>
        ) : (
          <>
            {state.sessionId ? (
              <KidSessionProvider
                sessionId={state.sessionId}
                challengeId={state.challengeId || undefined}
                onSession={(sessionId) => void handleSession(sessionId)}
                onChallenge={(challengeId) => void handleChallenge(challengeId)}
              >
                {state.requiresAdultVerification && accessStatus === "age-verification-required" ? (
                  <section aria-label="Civil adult age verification">
                    <p>
                      The selected feature also requires k-ID to verify the civil adult age in your
                      jurisdiction. The browser result alone does not unlock it; Possum Bot checks
                      the updated session with k-ID before granting access.
                    </p>
                    <KidSessionVerifyAge>
                      <KidSessionVerifyAgePending>
                        <p>Waiting for k-ID to finish the adult-age check…</p>
                      </KidSessionVerifyAgePending>
                      <KidSessionVerifyAgePass>
                        <p>k-ID reports the age check passed. Ask the server to confirm the session:</p>
                        <button type="button" style={actionStyle} disabled={busy} onClick={() => void checkVerifiedAge()}>
                          Check access with the server
                        </button>
                      </KidSessionVerifyAgePass>
                      <KidSessionVerifyAgeFail>
                        <p>k-ID did not confirm adult age. No access was granted; use the feature&apos;s other available option or contact a server administrator.</p>
                      </KidSessionVerifyAgeFail>
                      <KidSessionVerifyAgeError>
                        <p>k-ID could not complete the age check. No access was granted; reload this page to retry or contact support.</p>
                      </KidSessionVerifyAgeError>
                    </KidSessionVerifyAge>
                  </section>
                ) : null}
                {accessStatus !== "enabled" && accessStatus !== "age-verification-required" ? (
                  <section aria-label="Feature permission settings">
                    <p>
                      k-ID session ready. Enable the <strong>{PERMISSIONS[state.surface]}</strong>
                      permission below for {surfaceLabel}, then check the result.
                    </p>
                    <KidSettingsProvider
                      sessionId={state.sessionId}
                      challengeId={state.challengeId || undefined}
                      onChallenge={(challengeId) => void handleChallenge(challengeId)}
                    >
                      <KidPermissionSettings />
                    </KidSettingsProvider>
                  </section>
                ) : null}
              </KidSessionProvider>
            ) : sdkReady ? (
              <KidSessionProvider
                jurisdiction="auto"
                challengeId={state.challengeId || undefined}
                onSession={(sessionId) => void handleSession(sessionId)}
                onChallenge={(challengeId) => void handleChallenge(challengeId)}
                onClaim={(claimToken) => void handleClaim(claimToken)}
              >
                <KidAgeGate>
                  <KidAgeGatePass>
                    <p>k-ID created a session. Confirming the selected feature permission…</p>
                  </KidAgeGatePass>
                  <KidAgeGatePending>
                    <p>Complete any k-ID consent step to continue.</p>
                  </KidAgeGatePending>
                  <KidAgeGateFail>
                    <p>{state.surface === "onboarding" ? "k-ID could not confirm this request. You may use the existing manual verification option." : "k-ID could not confirm this request. No feature access was granted."}</p>
                  </KidAgeGateFail>
                  <KidAgeGateProhibited>
                    <p>k-ID did not create an eligible session. This result alone will not kick you.</p>
                  </KidAgeGateProhibited>
                  <KidAgeGateError>
                    <p>{state.surface === "onboarding" ? "k-ID is temporarily unavailable. No access decision was made; retry or use the existing manual option." : "k-ID is temporarily unavailable. No access decision was made; retry later."}</p>
                  </KidAgeGateError>
                </KidAgeGate>
              </KidSessionProvider>
            ) : null}
          </>
        )
      ) : null}

      {accessStatus === "enabled" ? (
        <p><strong>Return to Discord and press “Finish k-ID verification.”</strong></p>
      ) : null}
      {["failed", "verification-required", "guardian-required", "unknown"].includes(accessStatus) ? (
        <button type="button" onClick={retry} disabled={busy} style={actionStyle}>
          {state?.sessionId ? "Check permission again" : "Retry k-ID check"}
        </button>
      ) : null}
      {!token && !error ? <p>Loading request…</p> : null}
    </main>
  );
}
