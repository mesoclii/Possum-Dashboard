"use client";

import { KidCoreProvider, KidSettings, KidSettingsProvider } from "@k-id/core-react";
import { useEffect, useState } from "react";

type SavedSession = { sessionId: string; challengeId: string };
type BrowserConfig = { publishableKey: string; baseUrl: string; supportEmail: string; dashboardUrl: string };
const shell = { maxWidth: 760, margin: "48px auto", padding: 24, border: "1px solid #6f1b2b", borderRadius: 16, background: "#10090c", color: "#ffe6eb", fontFamily: "Arial, sans-serif", lineHeight: 1.6 } as const;
const button = { border: "1px solid #b52a4a", borderRadius: 10, background: "#60142a", color: "#fff", cursor: "pointer", padding: "10px 14px", fontWeight: 700 } as const;

export default function AgeAssuranceSettingsPage() {
  const [saved, setSaved] = useState<SavedSession | null>(null);
  const [config, setConfig] = useState<BrowserConfig | null>(null);
  const [message, setMessage] = useState("Loading your saved k-ID settings?");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let active = true;
    void Promise.all([
      fetch("/api/age-assurance/settings", { cache: "no-store" }).then(async (r) => { const d = await r.json(); if (!r.ok || !d?.success) throw new Error(d?.error || "Could not load your saved k-ID session."); return d.session as SavedSession; }),
      fetch("/api/age-assurance/client-config", { cache: "no-store" }).then(async (r) => { const d = await r.json(); if (!r.ok || !d?.success) throw new Error(d?.error || "Could not load k-ID browser setup."); return d.config as BrowserConfig; }),
    ]).then(([s, c]) => { if (active) { setSaved(s); setConfig(c); setMessage(""); } }).catch((e) => { if (active) setMessage(e instanceof Error ? e.message : "Could not load your k-ID settings."); });
    return () => { active = false; };
  }, []);
  async function saveChallenge(challengeId: string) {
    const r = await fetch("/api/age-assurance/settings-challenge", { method: "POST", headers: { "Content-Type": "application/json" }, cache: "no-store", body: JSON.stringify({ challengeId }) });
    const d = await r.json().catch(() => ({}));
    if (!r.ok || !d?.success) throw new Error(d?.error || "Could not save the pending k-ID request.");
    setSaved(d.session as SavedSession);
  }
  async function forgetSession() {
    if (!window.confirm("Remove your saved k-ID session? Gated features will ask you to verify again.")) return;
    setBusy(true); setMessage("");
    try {
      const r = await fetch("/api/age-assurance/delete-session", { method: "POST", cache: "no-store" });
      const d = await r.json().catch(() => ({}));
      if (!r.ok || !d?.success) throw new Error(d?.error || "Could not remove your saved k-ID session.");
      setSaved(null); setMessage("Your saved k-ID session and pending checks were removed.");
    } catch (e) { setMessage(e instanceof Error ? e.message : "Could not remove your saved k-ID session."); }
    finally { setBusy(false); }
  }
  const dashboardUrl = String(config?.dashboardUrl || "").replace(/\/+$/, "");
  const ready = Boolean(saved?.sessionId && config?.publishableKey && config?.baseUrl && config?.supportEmail && dashboardUrl);
  return <main style={shell}>
    <h1 style={{ marginTop: 0, color: "#ff7794" }}>AgeKey permissions</h1>
    <p>Manage the k-ID permissions attached to your account. Turning a permission off can disable its gated feature; this page does not gate the dashboard or public Gaming Hub.</p>
    {message ? <p role="status">{message}</p> : null}
    {ready ? <KidCoreProvider publishableKey={config!.publishableKey} baseUrl={config!.baseUrl} declare={{
      permissions: [{ name: "multiplayer" }, { name: "join-groups" }, { name: "public-profile" }, { name: "custom-username" }, { name: "online-status" }, { name: "text-chat-public" }, { name: "text-chat-private" }, { name: "photo-video-sharing" }, { name: "mods" }, { name: "voice-chat" }],
      privacyPolicyUrl: dashboardUrl + "/privacy", termsOfServiceUrl: dashboardUrl + "/terms", iconUrl: dashboardUrl + "/kid-app-icon.png", supportEmail: config!.supportEmail,
    }}><KidSettingsProvider sessionId={saved!.sessionId} challengeId={saved!.challengeId || undefined} onChallenge={(id) => void saveChallenge(id)}><KidSettings /></KidSettingsProvider></KidCoreProvider> : null}
    {saved ? <button type="button" onClick={() => void forgetSession()} disabled={busy} style={{ ...button, marginTop: 20 }}>{busy ? "Removing?" : "Remove saved k-ID session"}</button> : null}
  </main>;
}
