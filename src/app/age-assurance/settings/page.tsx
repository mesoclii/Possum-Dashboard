"use client";

import { KidSettings, KidSettingsProvider } from "@k-id/core-react";
import { useEffect, useState, type CSSProperties } from "react";
import { useKidBrowserConfig } from "@/components/possum/KidCoreAppProvider";

type LinkedSession = { sessionId: string; challengeId: string };

const panel: CSSProperties = {
  width: "min(100% - 32px, 900px)",
  margin: "48px auto",
  padding: 24,
  border: "1px solid #6f1b2b",
  borderRadius: 16,
  background: "#10090c",
  color: "#ffe6eb",
  fontFamily: "Arial, sans-serif",
  lineHeight: 1.6,
};

const action: CSSProperties = {
  border: "1px solid #b52a4a",
  borderRadius: 10,
  background: "#60142a",
  color: "#fff",
  cursor: "pointer",
  padding: "10px 14px",
  fontWeight: 700,
};

export default function AgeAssurancePermissionSettingsPage() {
  const [session, setSession] = useState<LinkedSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [notLinked, setNotLinked] = useState(false);
  const [savingChallenge, setSavingChallenge] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const { config, loading: configLoading, error: configError } = useKidBrowserConfig();

  useEffect(() => {
    let active = true;
    void fetch("/api/age-assurance/settings", { cache: "no-store" })
      .then(async (response) => {
        const result = await response.json().catch(() => ({}));
        if (response.status === 404) {
          if (active) setNotLinked(true);
          return;
        }
        if (!response.ok || result?.success !== true || !result?.session) {
          throw new Error(String(result?.error || "No k-ID session is linked to this account yet."));
        }
        if (active) {
          setSession({
            sessionId: String(result.session.sessionId || ""),
            challengeId: String(result.session.challengeId || ""),
          });
        }
      })
      .catch((reason: unknown) => {
        if (active) setError(reason instanceof Error ? reason.message : "Could not load saved k-ID settings.");
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  async function saveChallenge(challengeId: string) {
    setSavingChallenge(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/age-assurance/settings-challenge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ challengeId }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || result?.success !== true || !result?.session) {
        throw new Error(String(result?.error || "Could not save the pending k-ID request."));
      }
      setSession((current) => ({
        sessionId: String(result.session.sessionId || current?.sessionId || ""),
        challengeId: String(result.session.challengeId || challengeId),
      }));
      setMessage("The pending k-ID permission request is saved to your account and will resume when you return.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not save the pending k-ID request.");
    } finally {
      setSavingChallenge(false);
    }
  }

  async function removeSession() {
    if (!window.confirm("Delete your saved k-ID session and permission settings? This removes the session from Kai and unlinks it from your account.")) return;
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/age-assurance/delete-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || result?.success !== true) {
        throw new Error(String(result?.error || "Could not delete the saved k-ID session."));
      }
      setSession(null);
      setMessage("Your saved k-ID session was deleted and unlinked from this account.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not delete the saved k-ID session.");
    }
  }

  return (
    <main style={panel}>
      <h1 style={{ marginTop: 0, color: "#ff7794" }}>Age assurance settings</h1>
      <p>Manage the k-ID permissions saved to your Possum Bot account. Each permission is optional, and guardian-managed permissions can request approval from a parent.</p>
      {loading || configLoading ? <p role="status">Loading your saved k-ID settings…</p> : null}
      {error ? <p role="alert" style={{ color: "#ff9b9b" }}>{error}</p> : null}
      {configError ? <p role="alert" style={{ color: "#ff9b9b" }}>{configError}</p> : null}
      {message ? <p role="status" style={{ color: "#9ce3b1" }}>{message}</p> : null}
      {!loading && notLinked ? (
        <section>
          <p>No k-ID session is linked to this Discord account yet. Start k-ID verification from the relevant Possum Bot feature first.</p>
          <a href="/dashboard" style={{ color: "#ff9db4" }}>Return to the dashboard</a>
        </section>
      ) : null}
      {!loading && session && !configLoading && config ? (
        <>
          <section aria-label="Saved k-ID permissions">
            <KidSettingsProvider
              sessionId={session.sessionId}
              challengeId={session.challengeId || undefined}
              onChallenge={(challengeId) => void saveChallenge(challengeId)}
            >
              <KidSettings />
            </KidSettingsProvider>
          </section>
          {savingChallenge ? <p role="status">Saving the pending approval request…</p> : null}
          <button type="button" style={{ ...action, marginTop: 18 }} onClick={() => void removeSession()}>
            Delete saved k-ID session
          </button>
        </>
      ) : null}
    </main>
  );
}
