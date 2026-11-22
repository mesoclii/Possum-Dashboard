"use client";

import {
  KidAgeGate,
  KidAgeGateError,
  KidAgeGateFail,
  KidAgeGatePass,
  KidAgeGatePending,
  KidAgeGateProhibited,
  KidCoreProvider,
  KidSessionProvider,
} from "@k-id/core-react";
import { useCallback, useEffect, useRef, useState } from "react";

type Surface = "onboarding" | "adultFeatures" | "podcasts";
type AssuranceState = {
  surface: Surface;
  sessionId: string;
  challengeId: string;
  challengeType: string;
  challengeUrl: string;
  completed: boolean;
};

const LABELS: Record<Surface, string> = {
  onboarding: "server admission",
  adultFeatures: "Adult Emote Studio",
  podcasts: "podcast recording",
};

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

async function postAction(action: string, payload: Record<string, string>) {
  const response = await fetch(`/api/age-assurance/${action}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
    body: JSON.stringify(payload),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data?.success !== true) {
    throw new Error(String(data?.error || "Age assurance request failed."));
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

  const surfaceLabel = state ? LABELS[state.surface] : "requested feature";
  const publishableKey = String(process.env.NEXT_PUBLIC_KID_PUBLISHABLE_KEY || "").trim();
  const baseUrl = String(process.env.NEXT_PUBLIC_KID_BASE_URL || "").trim();
  const supportEmail = String(process.env.NEXT_PUBLIC_KID_SUPPORT_EMAIL || "").trim();
  const publicDashboardUrl = String(process.env.NEXT_PUBLIC_DASHBOARD_URL || "").trim().replace(/\/+$/, "");

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
    const incomingToken = String(pageUrl.searchParams.get("token") || "").trim();
    pageUrl.searchParams.delete("token");
    window.history.replaceState({}, "", `${pageUrl.pathname}${pageUrl.search}${pageUrl.hash}`);
    if (!/^[A-Za-z0-9_-]{40,64}$/.test(incomingToken)) {
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
    } catch (challengeError) {
      setError(challengeError instanceof Error ? challengeError.message : "Could not save the pending k-ID challenge.");
    }
  }, [token]);

  useEffect(() => {
    if (!token || !state?.challengeUrl || accessStatus !== "pending") return;
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
  }, [accessStatus, refreshStatus, state?.challengeUrl, token]);

  const retry = () => {
    if (token) void beginUpgrade(token);
  };

  const statusText = accessStatus === "enabled"
    ? `k-ID confirmed access to ${surfaceLabel}. Return to the feature you requested.`
    : accessStatus === "prohibited"
      ? "k-ID says this feature is not available for this account. No other access decisions were made."
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

      {sdkReady && token && !state?.sessionId ? (
        !publishableKey || !baseUrl || !supportEmail || !publicDashboardUrl ? (
          <p role="alert">
            The k-ID browser configuration is incomplete. Do not paste a secret key here; the
            publishable key, test base URL, public dashboard URL, and support email must be configured.
          </p>
        ) : (
          <KidCoreProvider
            publishableKey={publishableKey}
            baseUrl={baseUrl}
            declare={{
              permissions: [
                { name: "multiplayer" },
                { name: "mods" },
                { name: "voice-chat" },
              ],
              privacyPolicyUrl: `${publicDashboardUrl}/privacy`,
              termsOfServiceUrl: `${publicDashboardUrl}/terms`,
              supportEmail,
            }}
          >
            <KidSessionProvider
              jurisdiction="auto"
              challengeId={state?.challengeId || undefined}
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
                  <p>{state?.surface === "onboarding" ? "k-ID could not confirm this request. You may use the existing manual verification option." : "k-ID could not confirm this request. No feature access was granted."}</p>
                </KidAgeGateFail>
                <KidAgeGateProhibited>
                  <p>k-ID did not create an eligible session. This result alone will not kick you.</p>
                </KidAgeGateProhibited>
                <KidAgeGateError>
                  <p>{state?.surface === "onboarding" ? "k-ID is temporarily unavailable. No access decision was made; retry or use the existing manual option." : "k-ID is temporarily unavailable. No access decision was made; retry later."}</p>
                </KidAgeGateError>
              </KidAgeGate>
            </KidSessionProvider>
          </KidCoreProvider>
        )
      ) : null}

      {accessStatus === "enabled" ? (
        <p><strong>Return to Discord and press “Finish k-ID verification.”</strong></p>
      ) : null}
      {["failed", "verification-required", "guardian-required", "unknown"].includes(accessStatus) ? (
        <button type="button" onClick={retry} disabled={busy} style={actionStyle}>
          Retry k-ID check
        </button>
      ) : null}
      {!token && !error ? <p>Loading request…</p> : null}
    </main>
  );
}
