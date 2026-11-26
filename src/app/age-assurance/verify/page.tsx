"use client";

import {
  KidAgeGate,
  KidAgeGateError,
  KidAgeGateFail,
  KidAgeGatePass,
  KidAgeGatePending,
  KidAgeGateProhibited,
  KidCoreProvider,
  KidSettingsProvider,
  KidSessionProvider,
  useKidPermissionSettings,
  useKidAgeGate,
  type PermissionName,
} from "@k-id/core-react";
import { useCallback, useEffect, useRef, useState } from "react";

type Surface = "onboarding" | "adultFeatures" | "podcasts" | "tcgBattles" | "tcgTrades" | "jedPublishing";
type AssuranceState = {
  surface: Surface;
  sessionId: string;
  challengeId: string;
  challengeType: string;
  challengeUrl: string;
  completed: boolean;
};
type ClientConfig = { publishableKey: string; baseUrl: string; supportEmail: string; dashboardUrl: string; mode: string };

const LABELS: Record<Surface, string> = {
  onboarding: "server admission",
  adultFeatures: "Adult Emote Studio",
  podcasts: "podcast recording",
  tcgBattles: "Possum TCG battles",
  tcgTrades: "Possum TCG card trading",
  jedPublishing: "public JED asset publishing",
};

const PERMISSIONS: Record<Surface, PermissionName> = {
  onboarding: "join-groups",
  adultFeatures: "mature-language",
  podcasts: "voice-chat",
  tcgBattles: "multiplayer",
  tcgTrades: "send-gifts",
  jedPublishing: "mods",
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

function KidAgeGateErrorDetails({ onRetry }: { onRetry: () => void }) {
  const { error: sdkError } = useKidAgeGate();
  return (
    <>
      <p role="alert">
        k-ID could not load this check{sdkError ? ` (${sdkError.code}): ${sdkError.message}` : "."}
        {" "}No access decision was made.
      </p>
      <button type="button" onClick={onRetry} style={actionStyle}>Retry k-ID setup</button>
    </>
  );
}

function FeaturePermissionRequest({
  permissionName,
  onPermissionUpdated,
}: {
  permissionName: PermissionName;
  onPermissionUpdated: () => Promise<void>;
}) {
  const { permissions, isLoaded, error, upgrade, refresh, challenge } = useKidPermissionSettings();
  const [email, setEmail] = useState(() => {
    try { return typeof window === "undefined" ? "" : window.localStorage.getItem("possum:kid:age-email") || ""; }
    catch { return ""; }
  });
  const [busy, setBusy] = useState(false);
  const [requestError, setRequestError] = useState("");
  const [confirmedRefresh, setConfirmedRefresh] = useState(false);
  const permission = permissions.find((item) => item.name === permissionName);
  const threshold = Number(permission?.verifiedAgeThreshold);

  useEffect(() => {
    if (!permission?.enabled || confirmedRefresh) return;
    setConfirmedRefresh(true);
    void onPermissionUpdated();
  }, [permission?.enabled, confirmedRefresh, onPermissionUpdated]);

  async function requestPermission() {
    if (!email.trim()) {
      setRequestError("Enter your email so k-ID can send the age-check link.");
      return;
    }
    setBusy(true);
    setRequestError("");
    setConfirmedRefresh(false);
    try {
      const result = await upgrade([permissionName], email.trim());
      if (!result.ok) {
        setRequestError(result.error?.message || "k-ID could not start the feature permission check.");
        return;
      }
      await refresh();
      await onPermissionUpdated();
    } catch (error) {
      setRequestError(error instanceof Error ? error.message : "k-ID could not start the feature permission check.");
    } finally {
      setBusy(false);
    }
  }

  if (!isLoaded) return <p role="status">Loading the claimed k-ID session…</p>;
  if (error) return <p role="alert">Kai could not load this session. No feature access was granted.</p>;
  if (!permission) return <p role="alert">Kai did not return the required “{permissionName}” permission. Check that it is declared in the Kai product.</p>;
  if (permission.enabled) return <p role="status">Kai enabled the permission. Confirming it with the Possum Bot server…</p>;
  if (permission.managedBy === "PROHIBITED") return <p role="alert">Kai says this feature is prohibited for this account.</p>;
  if (permission.managedBy === "GUARDIAN") return <p role="alert">A guardian-managed permission cannot unlock this adult-only feature.</p>;
  if (permission.managedBy !== "PLAYER" || !Number.isFinite(threshold) || threshold <= 0) {
    return <p role="alert">This Kai permission has no verified-age threshold configured. No access was granted; configure the feature in Kai before retrying.</p>;
  }

  return (
    <section style={{ marginTop: 18, padding: 16, border: "1px solid #6f1b2b", borderRadius: 12 }}>
      <h2 style={{ marginTop: 0, color: "#ff7794", fontSize: 18 }}>Verify access to this feature</h2>
      {challenge.status === "pending" ? (
        <p role="status">Kai sent the verification link. Complete it, then this page will confirm the permission with the server.</p>
      ) : (
        <>
          <label htmlFor="kid-age-email">Email for your Kai verification link</label>
          <input
            id="kid-age-email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => {
              const value = event.target.value;
              setEmail(value);
              try { window.localStorage.setItem("possum:kid:age-email", value); } catch {}
            }}
            style={{ display: "block", width: "100%", boxSizing: "border-box", margin: "8px 0 12px", padding: 11, borderRadius: 8 }}
          />
          <button type="button" onClick={() => void requestPermission()} disabled={busy} style={actionStyle}>
            {busy ? "Starting Kai check…" : "Send age-check link"}
          </button>
        </>
      )}
      {requestError ? <p role="alert" style={{ color: "#ff9b9b" }}>{requestError}</p> : null}
    </section>
  );
}

async function postAction(action: string, payload: Record<string, string>) {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 20_000);
  let response: Response;
  try {
    response = await fetch(`/api/age-assurance/${action}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") throw new Error("k-ID did not respond within 20 seconds. Your saved session is preserved; retry the permission check.");
    throw error;
  } finally {
    window.clearTimeout(timeout);
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data?.success !== true) {
    const failure = new Error(String(data?.error || "Age assurance request failed.")) as Error & { status?: number; data?: any };
    failure.status = response.status;
    failure.data = data;
    throw failure;
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
  const [sdkAttempt, setSdkAttempt] = useState(0);
  const [returnTo, setReturnTo] = useState("");
  const [clientConfig, setClientConfig] = useState<ClientConfig | null>(null);
  const [clientConfigLoading, setClientConfigLoading] = useState(true);
  const claimInFlight = useRef(false);
  const claimedTokens = useRef(new Set<string>());

  const surfaceLabel = state ? LABELS[state.surface] : "requested feature";
  const publishableKey = String(clientConfig?.publishableKey || "").trim();
  const baseUrl = String(clientConfig?.baseUrl || "").trim();
  const supportEmail = String(clientConfig?.supportEmail || "").trim();
  const publicDashboardUrl = String(clientConfig?.dashboardUrl || "").trim().replace(/\/+$/, "");

  useEffect(() => {
    let active = true;
    void fetch("/api/age-assurance/client-config", { cache: "no-store" }).then(async (response) => {
      const result = await response.json().catch(() => ({}));
      if (!response.ok || result?.success !== true) throw new Error(result?.error || "Could not load k-ID browser setup.");
      if (active) setClientConfig(result.config as ClientConfig);
    }).catch((reason) => {
      if (active) setError(reason instanceof Error ? reason.message : "Could not load k-ID browser setup.");
    }).finally(() => { if (active) setClientConfigLoading(false); });
    return () => { active = false; };
  }, []);

  const refreshStatus = useCallback(async (stateToken: string) => {
    const result = await postAction("status", { token: stateToken });
    setState(result.state || null);
    setAccessStatus(String(result.status || "unknown"));
    return String(result.status || "unknown");
  }, []);

  const refreshFeaturePermission = useCallback(async (stateToken: string) => {
    setBusy(true);
    setError("");
    try {
      const result = await postAction("upgrade", { token: stateToken });
      setState(result.state || null);
      setAccessStatus(String(result.status || "unknown"));
      setSdkReady(true);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Could not start age assurance.");
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    const pageUrl = new URL(window.location.href);
    const incomingToken = String(pageUrl.searchParams.get("token") || "").trim();
    const requestedReturnTo = String(pageUrl.searchParams.get("returnTo") || "");
    if (["/tcg", "/emotes"].includes(requestedReturnTo)) setReturnTo(requestedReturnTo);
    pageUrl.searchParams.delete("token");
    pageUrl.searchParams.delete("returnTo");
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
      setSdkReady(true);
      if (current.challengeUrl) {
        setAccessStatus("pending");
        return;
      }
      await refreshStatus(incomingToken);
    }).catch((loadError) => {
      if (active) setError(loadError instanceof Error ? loadError.message : "Could not load age assurance.");
    });
    return () => {
      active = false;
    };
  }, [refreshStatus]);

  const handleClaim = useCallback(async (claimToken: string) => {
    if (!token || claimInFlight.current || claimedTokens.current.has(claimToken)) return;
    claimInFlight.current = true;
    claimedTokens.current.add(claimToken);
    setBusy(true);
    setError("");
    try {
      const result = await postAction("claim", { token, claimToken });
      setState(result.state || null);
      // A successful claim can be followed by an exact feature-permission
      // challenge. The permission status from the pre-challenge session is not
      // the challenge state; keep the challenge iframe visible until it resolves.
      setAccessStatus(result.challenge || result.state?.challengeUrl
        ? "pending"
        : String(result.status || "pending"));
      setSdkReady(true);
    } catch (claimError) {
      claimedTokens.current.delete(claimToken);
      const savedState = (claimError as Error & { data?: { state?: AssuranceState } })?.data?.state;
      if (savedState) {
        setState(savedState);
        setAccessStatus(savedState.challengeUrl ? "pending" : "unknown");
        setSdkReady(true);
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

  const handleSession = useCallback(async (_sessionId: string) => {
    if (!token) return;
    try {
      // The backend resolves the session from its claimed challenge/token. Never accept this
      // browser callback's session ID as an access decision.
      const status = await refreshStatus(token);
      if (status === "needs-session") setAccessStatus("pending");
    } catch (sessionError) {
      setError(sessionError instanceof Error ? sessionError.message : "Could not confirm the k-ID session.");
    }
  }, [refreshStatus, token]);

  const retry = () => {
    if (token) void refreshFeaturePermission(token);
  };
  const pollInFlight = useRef(false);
  const checkPendingResult = useCallback(async () => {
    if (!token || busy || pollInFlight.current) return;
    pollInFlight.current = true;
    setBusy(true);
    setError("");
    try { await refreshStatus(token); }
    catch (statusError) { setError(statusError instanceof Error ? statusError.message : "Could not check the k-ID result."); }
    finally { pollInFlight.current = false; setBusy(false); }
  }, [token, busy, refreshStatus]);
  const confirmPermissionServerSide = useCallback(async () => {
    if (token) await refreshStatus(token);
  }, [refreshStatus, token]);

  useEffect(() => {
    if (!token || !state?.challengeId || accessStatus !== "pending") return;
    const poll = async () => {
      if (pollInFlight.current) return;
      pollInFlight.current = true;
      try {
        const status = await refreshStatus(token);
        if (status === "pending") setError("");
      } catch (statusError) {
        setError(statusError instanceof Error ? statusError.message : "Could not check the Kai challenge.");
      } finally {
        pollInFlight.current = false;
      }
    };
    const timer = window.setInterval(() => void poll(), 5000);
    return () => window.clearInterval(timer);
  }, [token, state?.challengeId, accessStatus, refreshStatus]);

  useEffect(() => {
    if (!state?.challengeId || !state.challengeUrl || accessStatus !== "pending") return;
    let trustedOrigin = "";
    try { trustedOrigin = new URL(state.challengeUrl).origin; } catch { return; }
    const onChallengeMessage = (event: MessageEvent) => {
      if (event.origin !== trustedOrigin) return;
      const message = event.data;
      const challengeId = String(message?.data?.id || message?.challengeId || "");
      if (message?.eventType !== "Challenge.StateChange" || challengeId !== state.challengeId) return;
      // postMessage only prompts a server check. The backend reads the saved
      // challenge ID and verifies its status with k-ID before granting access.
      void checkPendingResult();
    };
    window.addEventListener("message", onChallengeMessage);
    return () => window.removeEventListener("message", onChallengeMessage);
  }, [state?.challengeId, state?.challengeUrl, accessStatus, checkPendingResult]);
  const retrySdk = () => {
    setError("");
    setSdkAttempt((attempt) => attempt + 1);
  };

  const statusText = accessStatus === "enabled"
    ? state?.surface === "onboarding"
      ? "k-ID confirmed the server-admission permission. Possum Bot is completing your server verification now."
      : `k-ID confirmed access to ${surfaceLabel}. Return to the feature you requested.`
    : accessStatus === "prohibited"
      ? "k-ID says this feature is not available for this account. No other access decisions were made."
      : accessStatus === "guardian-required"
        ? "This permission is guardian-managed and cannot unlock an adult-only feature."
        : accessStatus === "failed"
            ? state?.surface === "onboarding"
              ? "The k-ID challenge did not complete. You can retry or use the existing manual verification option."
              : "The k-ID challenge did not complete. You can retry or return to the feature later."
          : accessStatus === "verification-required"
              ? "Kai created the session. Request the selected feature permission below to continue."
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
      {accessStatus === "enabled" && returnTo ? <p><a href={returnTo} style={{ color: "#ff9ebc" }}>Return to the feature</a></p> : null}
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
      {state?.challengeId && accessStatus === "pending" ? (
        <button type="button" onClick={() => void checkPendingResult()} disabled={busy} style={actionStyle}>
          {busy ? "Checking with k-ID…" : "Check k-ID result"}
        </button>
      ) : null}
      {state?.sessionId && accessStatus === "pending" && !state.challengeId ? (
        <button type="button" onClick={() => void checkPendingResult()} disabled={busy} style={actionStyle}>
          {busy ? "Checking with k-ID..." : "Check feature permission"}
        </button>
      ) : null}
      {error && state?.sessionId && accessStatus !== "enabled" && accessStatus !== "pending" ? (
        <button type="button" onClick={() => void refreshFeaturePermission(token)} disabled={busy} style={actionStyle}>
          Retry Kai permission check
        </button>
      ) : null}

      {sdkReady && token && accessStatus !== "enabled" ? (
        clientConfigLoading ? <p role="status">Loading k-ID test setup…</p> : !publishableKey || !baseUrl || !supportEmail || !publicDashboardUrl ? (
          <p role="alert">
            The k-ID browser setup is incomplete. Open <a href="/dashboard/security/age-assurance">Dashboard → Security → Age Assurance</a> and save the publishable key, browser URL, dashboard URL, and support email.
          </p>
        ) : (
          <KidCoreProvider
            key={sdkAttempt}
            publishableKey={publishableKey}
            baseUrl={baseUrl}
            declare={{
              permissions: [
                { name: "multiplayer" },
                { name: "join-groups" },
                { name: "public-profile" },
                { name: "custom-username" },
                { name: "online-status" },
                { name: "text-chat-public" },
                { name: "text-chat-private" },
                { name: "photo-video-sharing" },
                { name: "mods" },
                { name: "mature-language" },
                { name: "send-gifts" },
                { name: "voice-chat" },
              ],
              privacyPolicyUrl: `${publicDashboardUrl}/privacy`,
              termsOfServiceUrl: `${publicDashboardUrl}/terms`,
              iconUrl: `${publicDashboardUrl}/kid-app-icon.png`,
              supportEmail,
            }}
          >
            {state?.sessionId ? (
              <KidSettingsProvider
                key={state.sessionId}
                sessionId={state.sessionId}
                challengeId={state.challengeId || undefined}
                onChallenge={(challengeId) => void handleChallenge(challengeId)}
              >
                <FeaturePermissionRequest
                  permissionName={PERMISSIONS[state.surface]}
                  onPermissionUpdated={confirmPermissionServerSide}
                />
              </KidSettingsProvider>
            ) : (
              <KidSessionProvider
                jurisdiction="auto"
                challengeId={state?.challengeId || undefined}
                onChallenge={(challengeId) => void handleChallenge(challengeId)}
                onSession={(sessionId) => void handleSession(sessionId)}
                onClaim={(claimToken) => void handleClaim(claimToken)}
              >
                <KidAgeGate>
                  <KidAgeGatePass><p>Kai created a session. Confirming the selected feature permission...</p></KidAgeGatePass>
                  <KidAgeGatePending><p>Complete any Kai consent step to continue.</p></KidAgeGatePending>
                  <KidAgeGateFail><p>This Kai check did not complete. No feature access was granted.</p></KidAgeGateFail>
                  <KidAgeGateProhibited><p>Kai did not create an eligible session. No feature access was granted.</p></KidAgeGateProhibited>
                  <KidAgeGateError><KidAgeGateErrorDetails onRetry={retrySdk} /></KidAgeGateError>
                </KidAgeGate>
              </KidSessionProvider>
            )}
          </KidCoreProvider>
        )
      ) : null}

      {accessStatus === "enabled" ? (
        <p><strong>{state?.surface === "onboarding" ? "Return to Discord. Your server verification is being completed automatically." : "Return to the feature you requested."}</strong></p>
      ) : null}
      {["failed", "guardian-required", "unknown"].includes(accessStatus) ? (
        <button type="button" onClick={retry} disabled={busy} style={actionStyle}>
          Retry k-ID check
        </button>
      ) : null}
      {!token && !error ? <p>Loading request…</p> : null}
    </main>
  );
}
