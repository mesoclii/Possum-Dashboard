"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { resolveGuildContext } from "@/lib/liveRuntime";

type Policy = {
  onboarding: boolean;
  adultFeatures: boolean;
  podcasts: boolean;
};

type ProviderStatus = {
  mode: "test" | "live";
  serverApiKeyConfigured: boolean;
  storageReady: boolean;
  apiBaseUrlConfigured: boolean;
  dashboardUrlConfigured: boolean;
  apiBaseUrl: string;
  providerConfigured: boolean;
  publishableKeyConfigured: boolean;
  browserBaseUrlConfigured: boolean;
  browserBaseUrl: string;
  supportEmailConfigured: boolean;
  supportEmail: string;
};

const DEFAULT_POLICY: Policy = {
  onboarding: false,
  adultFeatures: false,
  podcasts: false,
};

const shell: CSSProperties = { maxWidth: 1000, padding: 22, color: "#ffe5ee" };
const card: CSSProperties = {
  border: "1px solid #6d1834",
  borderRadius: 12,
  padding: 18,
  marginTop: 14,
  background: "rgba(80, 0, 20, 0.18)",
};
const muted: CSSProperties = { color: "#d7aebc", lineHeight: 1.55 };
const button: CSSProperties = {
  background: "#a81946",
  border: "1px solid #e94876",
  borderRadius: 8,
  color: "#fff",
  cursor: "pointer",
  padding: "10px 14px",
  fontWeight: 700,
};

export default function AgeAssuranceSettingsPage() {
  const [guildId, setGuildId] = useState("");
  const [guildName, setGuildName] = useState("");
  const [policy, setPolicy] = useState<Policy>(DEFAULT_POLICY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [provider, setProvider] = useState<ProviderStatus | null>(null);
  const [providerMode, setProviderMode] = useState<"test" | "live">("test");
  const [providerDashboardUrl, setProviderDashboardUrl] = useState("");
  const [providerApiKey, setProviderApiKey] = useState("");
  const [providerPublishableKey, setProviderPublishableKey] = useState("");
  const [providerBrowserBaseUrl, setProviderBrowserBaseUrl] = useState("https://kai-api.test.k-id.com/fapi/v1");
  const [providerSupportEmail, setProviderSupportEmail] = useState("");
  const [providerAction, setProviderAction] = useState<"save" | "test" | "start" | null>(null);
  const [providerMessage, setProviderMessage] = useState("");
  const [providerError, setProviderError] = useState("");
  const [providerTestResult, setProviderTestResult] = useState("");

  useEffect(() => {
    const context = resolveGuildContext();
    setGuildId(context.guildId);
    setGuildName(context.guildName);
  }, []);

  useEffect(() => {
    if (!guildId) {
      setLoading(false);
      return;
    }
    const controller = new AbortController();
    async function load() {
      setLoading(true);
      setError("");
      try {
        const query = new URLSearchParams({ guildId, engine: "ageAssurance" });
        const response = await fetch(`/api/bot/engine-config?${query}`, {
          cache: "no-store",
          signal: controller.signal,
        });
        const result = await response.json();
        if (!response.ok || result?.success !== true) {
          throw new Error(result?.error || "Could not load age assurance settings.");
        }
        const config = result.config && typeof result.config === "object" ? result.config : {};
        setPolicy({
          onboarding: config.onboarding === true,
          adultFeatures: config.adultFeatures === true,
          podcasts: config.podcasts === true,
        });
      } catch (reason) {
        if (!controller.signal.aborted) {
          setError(reason instanceof Error ? reason.message : "Could not load age assurance settings.");
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    void load();
    return () => controller.abort();
  }, [guildId]);

  useEffect(() => {
    let active = true;
    void fetch("/api/age-assurance/provider", { cache: "no-store" }).then(async (response) => {
      const result = await response.json().catch(() => ({}));
      if (!response.ok || result?.success !== true) throw new Error(result?.error || "Could not load k-ID provider settings.");
      if (!active) return;
      const next = result.provider as ProviderStatus;
      setProvider(next);
      setProviderMode(next.mode === "live" ? "live" : "test");
      setProviderDashboardUrl(window.location.origin);
      setProviderBrowserBaseUrl(next.browserBaseUrl || (next.mode === "live" ? "https://kai-api.k-id.com/fapi/v1" : "https://kai-api.test.k-id.com/fapi/v1"));
      setProviderSupportEmail(next.supportEmail || "");
    }).catch((reason) => {
      if (active) setProviderError(reason instanceof Error ? reason.message : "Could not load k-ID provider settings.");
    });
    return () => { active = false; };
  }, []);

  async function save(next: Policy) {
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/bot/engine-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ guildId, engine: "ageAssurance", config: next }),
      });
      const result = await response.json();
      if (!response.ok || result?.success !== true) {
        throw new Error(result?.error || "Could not save age assurance settings.");
      }
      const saved = result.config && typeof result.config === "object" ? result.config : next;
      setPolicy({
        onboarding: saved.onboarding === true,
        adultFeatures: saved.adultFeatures === true,
        podcasts: saved.podcasts === true,
      });
      setMessage("Age assurance settings saved for this server.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not save age assurance settings.");
    } finally {
      setSaving(false);
    }
  }

  function toggle(key: keyof Policy) {
    const next = { ...policy, [key]: !policy[key] };
    void save(next);
  }

  async function saveProvider() {
    setProviderAction("save"); setProviderError(""); setProviderMessage(""); setProviderTestResult("");
    try {
      const response = await fetch("/api/age-assurance/provider", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: providerMode, apiBaseUrl: providerMode === "live" ? "https://kai-api.k-id.com/api/v1" : "https://kai-api.test.k-id.com/api/v1", dashboardUrl: providerDashboardUrl, apiKey: providerApiKey, publishableKey: providerPublishableKey, browserBaseUrl: providerBrowserBaseUrl, supportEmail: providerSupportEmail }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || result?.success !== true) throw new Error(result?.error || "Could not save k-ID settings.");
      const savedProvider = result.provider as ProviderStatus;
      setProvider(savedProvider);
      setProviderBrowserBaseUrl(savedProvider.browserBaseUrl || providerBrowserBaseUrl);
      setProviderSupportEmail(savedProvider.supportEmail || providerSupportEmail);
      setProviderApiKey("");
      setProviderMessage("k-ID settings saved in encrypted server storage. The API key is not shown again.");
    } catch (reason) { setProviderError(reason instanceof Error ? reason.message : "Could not save k-ID settings."); }
    finally { setProviderAction(null); }
  }

  async function testProvider() {
    setProviderAction("test"); setProviderError(""); setProviderMessage(""); setProviderTestResult("");
    try {
      const response = await fetch("/api/age-assurance/provider-test", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || result?.success !== true) throw new Error(result?.error || "k-ID test failed.");
      setProviderTestResult(`Connected to k-ID ${provider?.mode || providerMode} API. Server key accepted. This does not test the browser key or its allowed origins.`);
    } catch (reason) { setProviderError(reason instanceof Error ? reason.message : "k-ID test failed."); }
    finally { setProviderAction(null); }
  }

  async function startFullAgeKeyTest() {
    if (!guildId || !policy.adultFeatures) return;
    setProviderAction("start"); setProviderError(""); setProviderMessage(""); setProviderTestResult("");
    try {
      const response = await fetch("/api/age-assurance/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({ guildId, surface: "adultFeatures" }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || result?.success !== true || typeof result.verificationUrl !== "string") {
        throw new Error(result?.error || "Could not start the full AgeKey test.");
      }
      window.location.assign(result.verificationUrl);
    } catch (reason) {
      setProviderError(reason instanceof Error ? reason.message : "Could not start the full AgeKey test.");
      setProviderAction(null);
    }
  }

  return (
    <main style={shell}>
      <h1 style={{ margin: 0 }}>Age Assurance</h1>
      <p style={muted}>
        Per-server controls for k-ID feature permissions. These settings do not age-gate the
        dashboard, Gaming Hub, ordinary bot use, purchases, or public podcast playback.
        Connect and test the k-ID product here, then enable each feature for the selected server. Configure the age thresholds and AgeKey methods in k-ID Compliance Studio.
      </p>
      <div style={card}>
        <strong>Selected server</strong>
        <div style={{ marginTop: 6 }}>{guildName || "Server"}</div>
      </div>
      {error ? <p role="alert" style={{ color: "#ff9b9b" }}>{error}</p> : null}
      {message ? <p role="status" style={{ color: "#9ce3b1" }}>{message}</p> : null}
      {!guildId ? <div role="alert" style={card}>Select a server before changing its age assurance settings.</div> : null}
      {loading ? <p>Loading server settings…</p> : null}

      <section style={card}>
        <h2 style={{ marginTop: 0 }}>k-ID provider setup</h2>
        <p style={muted}>Connect your k-ID product here. Use its Test API key while building; the key is saved encrypted on the bot server and is never sent back to this page. Configure age rules and permission thresholds in k-ID Compliance Studio.</p>
        <div style={{ ...card, marginTop: 10 }}>
          <strong>Connection status</strong>
          <p style={muted}>Environment: {provider?.mode || "checking"} · server key: {provider?.serverApiKeyConfigured ? "saved" : "missing"} · browser key: {provider?.publishableKeyConfigured ? "saved" : "missing"} · encrypted storage: {provider?.storageReady ? "ready" : "not ready"} · dashboard URL: {provider?.dashboardUrlConfigured ? "ready" : "missing"} · support email: {provider?.supportEmailConfigured ? "ready" : "missing"}</p>
          <p style={muted}>API endpoint: {provider?.apiBaseUrl || "not configured"}</p>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 12, marginTop: 12 }}>
          <label style={muted}>k-ID environment<br /><select value={providerMode} disabled={providerAction !== null} onChange={(event) => { const mode = event.target.value as "test" | "live"; setProviderMode(mode); setProviderBrowserBaseUrl(mode === "live" ? "https://kai-api.k-id.com/fapi/v1" : "https://kai-api.test.k-id.com/fapi/v1"); }} style={{ ...card, color: "#fff", padding: 10, width: "100%" }}><option value="test">Test (development)</option><option value="live">Live (production)</option></select></label>
          <label style={muted}>Public dashboard URL<br /><input value={providerDashboardUrl} onChange={(event) => setProviderDashboardUrl(event.target.value)} placeholder="https://dashboard.example.com" style={{ ...card, color: "#fff", padding: 10, width: "100%" }} /></label>
          <label style={muted}>k-ID browser SDK URL<br /><input value={providerBrowserBaseUrl} onChange={(event) => setProviderBrowserBaseUrl(event.target.value)} style={{ ...card, color: "#fff", padding: 10, width: "100%" }} /></label>
          <label style={muted}>Support email for k-ID<br /><input type="email" value={providerSupportEmail} onChange={(event) => setProviderSupportEmail(event.target.value)} placeholder="support@example.com" style={{ ...card, color: "#fff", padding: 10, width: "100%" }} /></label>
          <label style={muted}>k-ID server API key {provider?.serverApiKeyConfigured ? "(leave blank to keep current key)" : ""}<br /><input type="password" autoComplete="new-password" value={providerApiKey} onChange={(event) => setProviderApiKey(event.target.value)} placeholder={provider?.serverApiKeyConfigured ? "Saved securely" : "Paste the product's Test API key"} style={{ ...card, color: "#fff", padding: 10, width: "100%" }} /></label>
          <label style={muted}>k-ID publishable key {provider?.publishableKeyConfigured ? "(leave blank to keep current key)" : ""}<br /><input type="password" autoComplete="new-password" value={providerPublishableKey} onChange={(event) => setProviderPublishableKey(event.target.value)} placeholder={provider?.publishableKeyConfigured ? "Saved securely" : "Paste the product's publishable key"} style={{ ...card, color: "#fff", padding: 10, width: "100%" }} /></label>
        </div>
        {providerError ? <p role="alert" style={{ color: "#ff9b9b" }}>{providerError}</p> : null}
        {providerMessage ? <p role="status" style={{ color: "#9ce3b1" }}>{providerMessage}</p> : null}
        {providerTestResult ? <p role="status" style={{ color: "#9ce3b1" }}>{providerTestResult}</p> : null}
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button type="button" style={button} disabled={providerAction !== null || !providerDashboardUrl.trim()} onClick={() => void saveProvider()}>{providerAction === "save" ? "Saving…" : "Save k-ID setup"}</button>
          <button type="button" style={button} disabled={providerAction !== null || !provider?.providerConfigured} onClick={() => void testProvider()}>{providerAction === "test" ? "Checking…" : "Test k-ID connection"}</button>
          <button type="button" style={button} disabled={providerAction !== null || !guildId || !policy.adultFeatures || !provider?.providerConfigured} onClick={() => void startFullAgeKeyTest()}>{providerAction === "start" ? "Starting…" : "Start full AgeKey test"}</button>
        </div>
        <p style={{ ...muted, fontSize: 13 }}>The connection test checks only the server API and private key. For the browser widget, add <code>https://dashboard.possumbot.com</code> under the product&apos;s Developer Settings → Target origins in k-ID Compliance Studio. Start full AgeKey test opens the widget for this selected server; it requires Adult Emote Studio AgeKey to be enabled below.</p>
      </section>

      <section style={card}>
        <h2 style={{ marginTop: 0 }}>Optional server admission</h2>
        <p style={muted}>
          When enabled, members can choose k-ID instead of the existing ID-review route. Existing
          welcome text, ID tickets, refusal behavior, and post-verification flow are preserved.
          Only a confirmed <code>multiplayer</code> permission can complete admission; pending,
          unknown, or provider-error results never grant access or trigger removal.
        </p>
        <button type="button" style={button} disabled={!guildId || loading || saving} onClick={() => toggle("onboarding")}>
          {policy.onboarding ? "Disable server admission AgeKey" : "Enable server admission AgeKey"}
        </button>
        <span style={{ ...muted, marginLeft: 12 }}>{policy.onboarding ? "Enabled for this server" : "Off"}</span>
      </section>

      <section style={card}>
        <h2 style={{ marginTop: 0 }}>Podcast recording</h2>
        <p style={muted}>
          When enabled, each participant must have the exact <code>voice-chat</code> k-ID
          permission before their session consent is accepted. Existing per-session consent and
          withdrawal controls remain required.
        </p>
        <button type="button" style={button} disabled={!guildId || loading || saving} onClick={() => toggle("podcasts")}>
          {policy.podcasts ? "Disable podcast AgeKey" : "Enable podcast AgeKey"}
        </button>
        <span style={{ ...muted, marginLeft: 12 }}>{policy.podcasts ? "Enabled for this server" : "Off"}</span>
      </section>

      <section style={{ ...card, borderColor: "#634a31" }}>
        <h2 style={{ marginTop: 0 }}>Adult Emote Studio</h2>
        <p style={muted}>
          This enables the Adult Emote Studio AgeKey flow for this server. It does not block the owner dashboard from managing the library or configuring the integration.
        </p>
        <button type="button" style={button} disabled={!guildId || loading || saving} onClick={() => toggle("adultFeatures")}>
          {policy.adultFeatures ? "Disable Adult Emote Studio AgeKey" : "Enable Adult Emote Studio AgeKey"}
        </button>
        <span style={{ ...muted, marginLeft: 12 }}>{policy.adultFeatures ? "Enabled for this server" : "Off"}</span>
      </section>

      {saving ? <p role="status">Saving…</p> : null}
    </main>
  );
}
