"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { resolveGuildContext } from "@/lib/liveRuntime";

type Policy = {
  onboarding: boolean;
  onboardingAdultOnly: boolean;
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
  publicWebsiteUrl: string;
  dashboardUrl: string;
  developmentOrigin: string;
  supportEmailConfigured: boolean;
  supportEmail: string;
  profiles?: Record<"test" | "live", {
    serverApiKeyConfigured: boolean;
    publishableKeyConfigured: boolean;
    providerConfigured: boolean;
    apiBaseUrl: string;
    browserBaseUrl: string;
  }>;
};

type ProviderMode = "test" | "live";
type KeyDraft = { apiKey: string; publishableKey: string };
type UrlDraft = { apiBaseUrl: string; browserBaseUrl: string };
const defaultUrls: Record<ProviderMode, UrlDraft> = {
  test: { apiBaseUrl: "https://kai-api.test.k-id.com/api/v1", browserBaseUrl: "https://kai-api.test.k-id.com/fapi/v1" },
  live: { apiBaseUrl: "https://kai-api.k-id.com/api/v1", browserBaseUrl: "https://kai-api.k-id.com/fapi/v1" },
};

const DEFAULT_POLICY: Policy = {
  onboarding: false,
  onboardingAdultOnly: false,
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

async function fetchWithTimeout(input: RequestInfo | URL, init: RequestInit = {}, timeoutMs = 20_000) {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(`The dashboard request timed out after ${Math.round(timeoutMs / 1000)} seconds. Retry; saved k-ID keys are preserved.`);
    }
    throw error;
  } finally {
    window.clearTimeout(timeout);
  }
}

export default function AgeAssuranceSettingsPage() {
  const [guildId, setGuildId] = useState("");
  const [guildName, setGuildName] = useState("");
  const [policy, setPolicy] = useState<Policy>(DEFAULT_POLICY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [provider, setProvider] = useState<ProviderStatus | null>(null);
  const [providerWebsiteUrl, setProviderWebsiteUrl] = useState("https://possumbot.com");
  const [providerDashboardUrl, setProviderDashboardUrl] = useState("");
  const [providerDevelopmentOrigin, setProviderDevelopmentOrigin] = useState("http://localhost:3000");
  const [providerSupportEmail, setProviderSupportEmail] = useState("");
  const [keyDrafts, setKeyDrafts] = useState<Record<ProviderMode, KeyDraft>>({
    test: { apiKey: "", publishableKey: "" },
    live: { apiKey: "", publishableKey: "" },
  });
  const [urlDrafts, setUrlDrafts] = useState<Record<ProviderMode, UrlDraft>>(defaultUrls);
  const [providerAction, setProviderAction] = useState<"save-test" | "save-live" | "activate" | "test" | "start" | null>(null);
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
          onboardingAdultOnly: config.onboardingAdultOnly === true,
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
    void fetchWithTimeout("/api/age-assurance/provider", { cache: "no-store" }).then(async (response) => {
      const result = await response.json().catch(() => ({}));
      if (!response.ok || result?.success !== true) throw new Error(result?.error || "Could not load k-ID provider settings.");
      if (!active) return;
      const next = result.provider as ProviderStatus;
      setProvider(next);
      setUrlDrafts({
        test: { apiBaseUrl: next.profiles?.test?.apiBaseUrl || defaultUrls.test.apiBaseUrl, browserBaseUrl: next.profiles?.test?.browserBaseUrl || defaultUrls.test.browserBaseUrl },
        live: { apiBaseUrl: next.profiles?.live?.apiBaseUrl || defaultUrls.live.apiBaseUrl, browserBaseUrl: next.profiles?.live?.browserBaseUrl || defaultUrls.live.browserBaseUrl },
      });
      setProviderWebsiteUrl(next.publicWebsiteUrl || "https://possumbot.com");
      setProviderDashboardUrl(next.dashboardUrl || window.location.origin);
      setProviderDevelopmentOrigin(next.developmentOrigin || "http://localhost:3000");
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
      const response = await fetchWithTimeout("/api/bot/engine-config", {
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
        onboardingAdultOnly: saved.onboardingAdultOnly === true,
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

  async function saveProvider(mode: ProviderMode) {
    setProviderAction(mode === "live" ? "save-live" : "save-test"); setProviderError(""); setProviderMessage(""); setProviderTestResult("");
    try {
      const response = await fetchWithTimeout("/api/age-assurance/provider", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode,
          activate: false,
          apiBaseUrl: urlDrafts[mode].apiBaseUrl,
          dashboardUrl: providerDashboardUrl,
          publicWebsiteUrl: providerWebsiteUrl,
          developmentOrigin: providerDevelopmentOrigin,
          apiKey: keyDrafts[mode].apiKey,
          publishableKey: keyDrafts[mode].publishableKey,
          browserBaseUrl: urlDrafts[mode].browserBaseUrl,
          supportEmail: providerSupportEmail,
        }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || result?.success !== true) throw new Error(result?.error || "Could not save k-ID settings.");
      const savedProvider = result.provider as ProviderStatus;
      setProvider(savedProvider);
      setKeyDrafts((current) => ({ ...current, [mode]: { apiKey: "", publishableKey: "" } }));
      setProviderMessage(`${mode === "live" ? "Live" : "Test"} keys saved separately in encrypted server storage. The test keys were preserved.`);
    } catch (reason) { setProviderError(reason instanceof Error ? reason.message : "Could not save k-ID settings."); }
    finally { setProviderAction(null); }
  }

  async function activateProvider(mode: ProviderMode) {
    setProviderAction("activate"); setProviderError(""); setProviderMessage(""); setProviderTestResult("");
    try {
      const response = await fetchWithTimeout("/api/age-assurance/provider-activate", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || result?.success !== true) throw new Error(result?.error || `Could not activate ${mode} k-ID settings.`);
      setProvider(result.provider as ProviderStatus);
      const activeProvider = result.provider as ProviderStatus;
      setUrlDrafts({
        test: { apiBaseUrl: activeProvider.profiles?.test?.apiBaseUrl || defaultUrls.test.apiBaseUrl, browserBaseUrl: activeProvider.profiles?.test?.browserBaseUrl || defaultUrls.test.browserBaseUrl },
        live: { apiBaseUrl: activeProvider.profiles?.live?.apiBaseUrl || defaultUrls.live.apiBaseUrl, browserBaseUrl: activeProvider.profiles?.live?.browserBaseUrl || defaultUrls.live.browserBaseUrl },
      });
      setProviderWebsiteUrl(activeProvider.publicWebsiteUrl || "https://possumbot.com");
      setProviderDashboardUrl(activeProvider.dashboardUrl || window.location.origin);
      setProviderDevelopmentOrigin(activeProvider.developmentOrigin || "http://localhost:3000");
      setProviderMessage(`${mode === "live" ? "Live" : "Test"} is now the active environment. The other environment's keys remain saved.`);
    } catch (reason) { setProviderError(reason instanceof Error ? reason.message : "Could not switch k-ID environment."); }
    finally { setProviderAction(null); }
  }

  async function testProvider() {
    setProviderAction("test"); setProviderError(""); setProviderMessage(""); setProviderTestResult("");
    try {
      const response = await fetchWithTimeout("/api/age-assurance/provider-test", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || result?.success !== true) throw new Error(result?.error || "k-ID test failed.");
      setProviderTestResult(`Connected to k-ID ${provider?.mode || "active"} API. Server key accepted. This does not test the browser key or its allowed origins.`);
    } catch (reason) { setProviderError(reason instanceof Error ? reason.message : "k-ID test failed."); }
    finally { setProviderAction(null); }
  }

  async function startFullAgeKeyTest() {
    if (!guildId || !policy.adultFeatures) return;
    setProviderAction("start"); setProviderError(""); setProviderMessage(""); setProviderTestResult("");
    try {
      const response = await fetchWithTimeout("/api/age-assurance/request", {
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
      <p style={muted}>Feature mapping: server admission uses <code>join-groups</code>; the 18+ JED shelf uses <code>mature-language</code>; public JED publishing uses <code>mods</code>; TCG battles use <code>multiplayer</code>; TCG card trades use <code>send-gifts</code>; podcast recording uses <code>voice-chat</code>. Each check applies only to that feature. Possum Bot stays available to Everyone.</p>
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
        <p style={muted}>Test and Live keys have separate encrypted slots. Saving one will not overwrite the other. Only the active environment is used for checks. These three origin fields are the addresses to add in Kai → Where it runs.</p>
        <div style={{ ...card, marginTop: 10 }}>
          <strong>Active connection</strong>
          <p style={muted}>Environment: {provider?.mode || "checking"} | server key: {provider?.serverApiKeyConfigured ? "saved" : "missing"} | browser key: {provider?.publishableKeyConfigured ? "saved" : "missing"} | encrypted storage: {provider?.storageReady ? "ready" : "not ready"} | dashboard URL: {provider?.dashboardUrlConfigured ? "ready" : "missing"} | support email: {provider?.supportEmailConfigured ? "ready" : "missing"}</p>
          <p style={muted}>Active server API: {provider?.apiBaseUrl || "not configured"}</p>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 12, marginTop: 12 }}>
          <label style={muted}>Public website origin<br /><input value={providerWebsiteUrl} onChange={(event) => setProviderWebsiteUrl(event.target.value)} placeholder="https://possumbot.com" style={{ ...card, color: "#fff", padding: 10, width: "100%" }} /></label>
          <label style={muted}>Dashboard origin<br /><input value={providerDashboardUrl} onChange={(event) => setProviderDashboardUrl(event.target.value)} placeholder="https://dashboard.possumbot.com" style={{ ...card, color: "#fff", padding: 10, width: "100%" }} /></label>
          <label style={muted}>Local development origin (Test only)<br /><input value={providerDevelopmentOrigin} onChange={(event) => setProviderDevelopmentOrigin(event.target.value)} placeholder="http://localhost:3000" style={{ ...card, color: "#fff", padding: 10, width: "100%" }} /></label>
          <label style={muted}>Support email for k-ID<br /><input type="email" value={providerSupportEmail} onChange={(event) => setProviderSupportEmail(event.target.value)} placeholder="support@example.com" style={{ ...card, color: "#fff", padding: 10, width: "100%" }} /></label>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 12, marginTop: 12 }}>
          {(["test", "live"] as const).map((mode) => {
            const live = mode === "live";
            const profile = provider?.profiles?.[mode];
            const configured = Boolean(profile?.providerConfigured || (provider?.mode === mode && provider?.providerConfigured));
            const hasServerKey = Boolean(profile?.serverApiKeyConfigured || (provider?.mode === mode && provider?.serverApiKeyConfigured));
            const hasBrowserKey = Boolean(profile?.publishableKeyConfigured || (provider?.mode === mode && provider?.publishableKeyConfigured));
            const urls = urlDrafts[mode];
            return (
              <div key={mode} style={{ ...card, marginTop: 0, borderColor: provider?.mode === mode ? "#e94876" : "#6d1834" }}>
                <h3 style={{ marginTop: 0 }}>{live ? "Live (production)" : "Test (development)"}{provider?.mode === mode ? " | Active" : ""}</h3>
                <p style={muted}>Set the two k-ID endpoints for this environment. Test and Live are saved separately.</p>
                <label style={muted}>Server API URL (KID_API)<br /><input value={urls.apiBaseUrl} onChange={(event) => setUrlDrafts((current) => ({ ...current, [mode]: { ...current[mode], apiBaseUrl: event.target.value } }))} placeholder={defaultUrls[mode].apiBaseUrl} style={{ ...card, color: "#fff", padding: 10, width: "100%" }} /></label>
                <label style={muted}>Browser SDK URL (baseUrl)<br /><input value={urls.browserBaseUrl} onChange={(event) => setUrlDrafts((current) => ({ ...current, [mode]: { ...current[mode], browserBaseUrl: event.target.value } }))} placeholder={defaultUrls[mode].browserBaseUrl} style={{ ...card, color: "#fff", padding: 10, width: "100%" }} /></label>
                <p style={muted}>Server key: {hasServerKey ? "saved securely" : "not saved"} | Publishable key: {hasBrowserKey ? "saved securely" : "not saved"}</p>
                <label style={muted}>k-ID server secret key<br /><input type="password" autoComplete="new-password" value={keyDrafts[mode].apiKey} onChange={(event) => setKeyDrafts((current) => ({ ...current, [mode]: { ...current[mode], apiKey: event.target.value } }))} placeholder={hasServerKey ? "Saved securely - leave blank to keep" : "Paste the " + (live ? "live" : "test") + " server key"} style={{ ...card, color: "#fff", padding: 10, width: "100%" }} /></label>
                <label style={muted}>k-ID publishable key<br /><input type="password" autoComplete="new-password" value={keyDrafts[mode].publishableKey} onChange={(event) => setKeyDrafts((current) => ({ ...current, [mode]: { ...current[mode], publishableKey: event.target.value } }))} placeholder={hasBrowserKey ? "Saved securely - leave blank to keep" : "Paste the " + (live ? "live" : "test") + " publishable key"} style={{ ...card, color: "#fff", padding: 10, width: "100%" }} /></label>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
                  <button type="button" style={button} disabled={providerAction !== null || !providerDashboardUrl.trim()} onClick={() => void saveProvider(mode)}>{providerAction === (live ? "save-live" : "save-test") ? "Saving..." : "Save " + (live ? "Live" : "Test") + " keys"}</button>
                  <button type="button" style={button} disabled={providerAction !== null || !configured || provider?.mode === mode} onClick={() => void activateProvider(mode)}>{providerAction === "activate" ? "Switching..." : "Use " + (live ? "Live" : "Test")}</button>
                </div>
              </div>
            );
          })}
        </div>
        {providerError ? <p role="alert" style={{ color: "#ff9b9b" }}>{providerError}</p> : null}
        {providerMessage ? <p role="status" style={{ color: "#9ce3b1" }}>{providerMessage}</p> : null}
        {providerTestResult ? <p role="status" style={{ color: "#9ce3b1" }}>{providerTestResult}</p> : null}
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button type="button" style={button} disabled={providerAction !== null || !provider?.providerConfigured} onClick={() => void testProvider()}>{providerAction === "test" ? "Checking..." : "Test active k-ID connection"}</button>
          <button type="button" style={button} disabled={providerAction !== null || !guildId || !policy.adultFeatures || !provider?.providerConfigured} onClick={() => void startFullAgeKeyTest()}>{providerAction === "start" ? "Opening k-ID..." : provider?.mode === "live" ? "Start Live AgeKey check" : "Start Test AgeKey check"}</button>
        </div>
        <p style={{ ...muted, fontSize: 13 }}>This opens a real player check using the active Test or Live keys. Live creates a real Live k-ID session; the connection button above only checks the API. In Kai → Where it runs, add each origin as its own entry: the public website and dashboard under Live if the widget runs there; add localhost only under Test. This check requires Adult Emote Studio AgeKey to be enabled below.</p>
      </section>

      <section style={card}>
        <h2 style={{ marginTop: 0 }}>Optional server admission</h2>
        <p style={muted}>
          When enabled, members can choose k-ID instead of the existing ID-review route. Existing
          welcome text, ID tickets, refusal behavior, and post-verification flow are preserved.
          Only a confirmed <code>join-groups</code> permission can complete admission; pending,
          unknown, or provider-error results never grant access or trigger removal.
        </p>
        <button type="button" style={button} disabled={!guildId || loading || saving} onClick={() => toggle("onboarding")}>
          {policy.onboarding ? "Disable server admission AgeKey" : "Enable server admission AgeKey"}
        </button>
        <span style={{ ...muted, marginLeft: 12 }}>{policy.onboarding ? "Enabled for this server" : "Off"}</span>
        <label style={{ ...muted, display: "flex", gap: 10, alignItems: "flex-start", marginTop: 14 }}>
          <input
            type="checkbox"
            checked={policy.onboardingAdultOnly}
            disabled={!guildId || loading || saving || !policy.onboarding}
            onChange={() => toggle("onboardingAdultOnly")}
          />
          <span>
            This server is 18+. Require k-ID Verify Age at the civil adult age for the member&apos;s
            jurisdiction, in addition to <code>join-groups</code>.
          </span>
        </label>
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

      <section style={card}>
        <h2 style={{ marginTop: 0 }}>Product feature checks</h2>
        <p style={muted}>These product surfaces request their own permission only when a member opens the feature. They do not age-gate the dashboard, public Gaming Hub, ordinary bot use, or the all-ages JED shelf.</p>
        <ul style={{ ...muted, paddingLeft: 22 }}>
          <li><strong>Possum TCG battles:</strong> server-checks <code>multiplayer</code> for both players before battle actions.</li>
          <li><strong>Possum TCG trades:</strong> server-checks <code>send-gifts</code> for both players before trade actions.</li>
          <li><strong>Public JED publishing:</strong> requires <code>mods</code> before an asset is submitted for other people to see.</li>
          <li><strong>JED 18+ catalog:</strong> requires this server&apos;s Adult Emote Studio switch and the account&apos;s <code>mature-language</code> permission.</li>
        </ul>
        <p style={muted}>Set the thresholds and age rules for these permissions in k-ID Compliance Studio. The checks run when a member tries the gated action; only the 18+ JED shelf also uses the server switch above.</p>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <a href="/tcg" style={{ ...button, display: "inline-block", textDecoration: "none" }}>Open Possum TCG</a>
          <a href="/emotes" style={{ ...button, display: "inline-block", textDecoration: "none" }}>Open JED library</a>
        </div>
      </section>

      {saving ? <p role="status">Saving…</p> : null}
    </main>
  );
}
