"use client";

import { useEffect, useState, type CSSProperties } from "react";

type Mode = "test" | "live";
type ProviderProfile = {
  serverApiKeyConfigured: boolean;
  publishableKeyConfigured: boolean;
  providerConfigured: boolean;
  apiBaseUrl: string;
  browserBaseUrl: string;
  dashboardUrl: string;
  publicWebsiteUrl: string;
  developmentOrigin: string;
  supportEmail: string;
  iconUrl: string;
};
type ProviderStatus = {
  mode: Mode;
  activeMode: Mode | "";
  profiles: Record<Mode, ProviderProfile | null>;
};
type Draft = {
  apiKey: string;
  publishableKey: string;
  apiBaseUrl: string;
  browserBaseUrl: string;
  dashboardUrl: string;
  publicWebsiteUrl: string;
  developmentOrigin: string;
  supportEmail: string;
  iconUrl: string;
};
type ProviderAction = "save" | "test" | "activate";

const MODES: Mode[] = ["test", "live"];
const DEFAULTS: Record<Mode, Pick<Draft, "apiBaseUrl" | "browserBaseUrl">> = {
  test: {
    apiBaseUrl: "https://kai-api.test.k-id.com/api/v1",
    browserBaseUrl: "https://kai-api.test.k-id.com/fapi/v1",
  },
  live: {
    apiBaseUrl: "https://kai-api.k-id.com/api/v1",
    browserBaseUrl: "https://kai-api.k-id.com/fapi/v1",
  },
};

const card: CSSProperties = {
  border: "1px solid #6d1834",
  borderRadius: 12,
  padding: 18,
  marginTop: 14,
  background: "rgba(80, 0, 20, 0.18)",
};
const muted: CSSProperties = { color: "#d7aebc", lineHeight: 1.55 };
const label: CSSProperties = { display: "grid", gap: 6, color: "#f4ced8", fontSize: 14 };
const input: CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  border: "1px solid #713047",
  borderRadius: 7,
  background: "#10090c",
  color: "#fff",
  padding: "10px 11px",
};
const button: CSSProperties = {
  background: "#a81946",
  border: "1px solid #e94876",
  borderRadius: 8,
  color: "#fff",
  cursor: "pointer",
  padding: "10px 14px",
  fontWeight: 700,
};

function emptyDraft(mode: Mode, dashboardUrl = ""): Draft {
  return {
    apiKey: "",
    publishableKey: "",
    ...DEFAULTS[mode],
    dashboardUrl,
    publicWebsiteUrl: "",
    developmentOrigin: "",
    supportEmail: "",
    iconUrl: "",
  };
}

function draftFromProfile(mode: Mode, profile: ProviderProfile | null, dashboardUrl: string, supportEmail: string): Draft {
  return {
    ...emptyDraft(mode, dashboardUrl),
    apiBaseUrl: profile?.apiBaseUrl || DEFAULTS[mode].apiBaseUrl,
    browserBaseUrl: profile?.browserBaseUrl || DEFAULTS[mode].browserBaseUrl,
    dashboardUrl: profile?.dashboardUrl || dashboardUrl,
    publicWebsiteUrl: profile?.publicWebsiteUrl || "",
    developmentOrigin: profile?.developmentOrigin || "",
    supportEmail: profile?.supportEmail || supportEmail,
    iconUrl: "",
  };
}

export default function AgeAssuranceProviderSettings() {
  const [provider, setProvider] = useState<ProviderStatus | null>(null);
  const [mode, setMode] = useState<Mode>("test");
  const [drafts, setDrafts] = useState<Record<Mode, Draft>>({
    test: emptyDraft("test"),
    live: emptyDraft("live"),
  });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<ProviderAction | "">("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    let active = true;
    void fetch("/api/age-assurance/provider", { cache: "no-store" })
      .then(async (response) => {
        const result = await response.json().catch(() => ({}));
        if (!response.ok || result?.success !== true || !result?.provider) {
          throw new Error(String(result?.error || "Could not load k-ID provider settings."));
        }
        if (!active) return;
        const status = result.provider as ProviderStatus;
        const origin = window.location.origin;
        const activeProfile = status.profiles?.[status.mode] || null;
        const sharedDashboardUrl = activeProfile?.dashboardUrl || status.profiles?.test?.dashboardUrl || status.profiles?.live?.dashboardUrl || origin;
        const sharedSupportEmail = activeProfile?.supportEmail || status.profiles?.test?.supportEmail || status.profiles?.live?.supportEmail || "";
        setProvider(status);
        setMode(status.activeMode === "live" ? "live" : "test");
        setDrafts({
          test: draftFromProfile("test", status.profiles?.test || null, sharedDashboardUrl, sharedSupportEmail),
          live: draftFromProfile("live", status.profiles?.live || null, sharedDashboardUrl, sharedSupportEmail),
        });
      })
      .catch((reason: unknown) => {
        if (active) setError(reason instanceof Error ? reason.message : "Could not load k-ID provider settings.");
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const draft = drafts[mode];
  const profile = provider?.profiles?.[mode] || null;

  function updateDraft(key: keyof Draft, value: string) {
    setDrafts((current) => ({ ...current, [mode]: { ...current[mode], [key]: value } }));
  }

  async function post(action: ProviderAction, selectedMode: Mode, values?: Draft) {
    const response = await fetch("/api/age-assurance/provider", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action,
        mode: selectedMode,
        ...(values || {}),
        ...(action === "save" ? { clearIconUrl: !String(values?.iconUrl || "").trim() } : {}),
      }),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || result?.success !== true) {
      throw new Error(String(result?.error || `Could not ${action} the ${selectedMode} k-ID profile.`));
    }
    if (result.provider) {
      const status = result.provider as ProviderStatus;
      setProvider(status);
      if (status.activeMode === selectedMode) {
        window.dispatchEvent(new Event("kid-provider-config-updated"));
      }
    }
    return result;
  }

  async function run(action: ProviderAction) {
    setBusy(action);
    setError("");
    setMessage("");
    try {
      const current = drafts[mode];
      if (!current.supportEmail.trim()) throw new Error("Enter the support email Kai should show players and parents.");
      if (!current.dashboardUrl.trim()) throw new Error("Enter the public dashboard URL.");

      await post("save", mode, current);
      setDrafts((previous) => ({
        ...previous,
        [mode]: { ...previous[mode], apiKey: "", publishableKey: "" },
      }));

      if (action === "save") {
        setMessage(`${mode === "test" ? "Test" : "Live"} k-ID settings saved. Keys remain hidden after saving.`);
        return;
      }

      if (!current.apiKey.trim() && !profile?.serverApiKeyConfigured) {
        throw new Error(`Enter the ${mode} server API key before testing or activating this profile.`);
      }
      if (!current.publishableKey.trim() && !profile?.publishableKeyConfigured) {
        throw new Error(`Enter the ${mode} publishable key before testing or activating this profile.`);
      }

      const tested = await post("test", mode);
      if (tested?.result?.serverKeyAccepted !== true) {
        throw new Error(`Kai did not confirm the ${mode} server key.`);
      }
      if (action === "test") {
        setMessage(`${mode === "test" ? "Test" : "Live"} server key accepted. The active environment was not changed.`);
        return;
      }

      await post("activate", mode);
      setMessage(`${mode === "test" ? "Test" : "Live"} k-ID mode is active. The dashboard browser configuration has been refreshed.`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : `Could not ${action} the k-ID profile.`);
    } finally {
      setBusy("");
    }
  }

  return (
    <section style={card} aria-labelledby="kid-provider-heading">
      <h2 id="kid-provider-heading" style={{ marginTop: 0 }}>k-ID provider environments</h2>
      <p style={muted}>
        Configure Test and Live separately. Saving or testing a profile does not switch the active environment.
        Activating one switches the browser and server to that environment for all k-ID checks.
      </p>
      {loading ? <p role="status">Loading provider settings…</p> : null}
      {error ? <p role="alert" style={{ color: "#ff9b9b" }}>{error}</p> : null}
      {message ? <p role="status" style={{ color: "#9ce3b1" }}>{message}</p> : null}
      {!loading && !provider ? (
        <p style={muted}>
          {error.includes("Master owner access")
            ? "Provider settings are available to the Possum Bot master owner."
            : "Provider settings could not be loaded. Refresh after signing in as the Possum Bot master owner."}
        </p>
      ) : null}

      {!loading && provider ? (
        <>
          <div role="group" aria-label="k-ID environment" style={{ display: "flex", gap: 8, margin: "14px 0" }}>
            {MODES.map((option) => (
              <button
                key={option}
                type="button"
                aria-pressed={mode === option}
                style={{ ...button, background: mode === option ? "#a81946" : "#251019" }}
                onClick={() => { setMode(option); setError(""); setMessage(""); }}
              >
                {option === "test" ? "Test mode" : "Live mode"}{provider?.activeMode === option ? " · Active" : ""}
              </button>
            ))}
          </div>

          <p style={muted}>
            {mode === "test"
              ? "When Test mode is active, the SDK sends the app permissions and legal/support details to Kai Test. Saving active Test settings refreshes that declaration."
              : "The SDK intentionally skips declarations with Live keys. Publish the app permissions and legal details in Kai Live before using this environment."}
          </p>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 12, marginTop: 14 }}>
            <label style={label}>
              Server API key {profile?.serverApiKeyConfigured ? <span style={muted}>Saved; leave blank to keep it</span> : null}
              <input
                style={input}
                type="password"
                autoComplete="new-password"
                value={draft.apiKey}
                placeholder={mode === "test" ? "kgs_test_…" : "kgs_live_…"}
                onChange={(event) => updateDraft("apiKey", event.target.value)}
              />
            </label>
            <label style={label}>
              Publishable key {profile?.publishableKeyConfigured ? <span style={muted}>Saved; leave blank to keep it</span> : null}
              <input
                style={input}
                type="password"
                autoComplete="new-password"
                value={draft.publishableKey}
                placeholder={mode === "test" ? "kgp_test_…" : "kgp_live_…"}
                onChange={(event) => updateDraft("publishableKey", event.target.value)}
              />
            </label>
            <label style={label}>
              Server API URL
              <input style={{ ...input, opacity: 0.8 }} value={draft.apiBaseUrl} readOnly />
            </label>
            <label style={label}>
              Browser SDK URL
              <input style={{ ...input, opacity: 0.8 }} value={draft.browserBaseUrl} readOnly />
            </label>
            <label style={label}>
              Public dashboard URL
              <input style={input} type="url" value={draft.dashboardUrl} onChange={(event) => updateDraft("dashboardUrl", event.target.value)} />
            </label>
            <label style={label}>
              Support email for players and parents
              <input style={input} type="email" autoComplete="email" required value={draft.supportEmail} onChange={(event) => updateDraft("supportEmail", event.target.value)} />
            </label>
            <label style={label}>
              App icon URL or dashboard image path (optional)
              <input style={input} type="text" value={draft.iconUrl} onChange={(event) => updateDraft("iconUrl", event.target.value)} placeholder="Leave blank to omit an SDK icon" />
            </label>
            <label style={label}>
              Public website origin (optional)
              <input style={input} type="url" value={draft.publicWebsiteUrl} onChange={(event) => updateDraft("publicWebsiteUrl", event.target.value)} placeholder="https://example.com" />
            </label>
            <label style={label}>
              Development origin (optional)
              <input style={input} type="url" value={draft.developmentOrigin} onChange={(event) => updateDraft("developmentOrigin", event.target.value)} placeholder="http://localhost:3000" />
            </label>
          </div>

          <p style={{ ...muted, marginTop: 14 }}>
            Declared app permissions: <code>join-groups</code>, <code>text-chat-public</code>, <code>text-chat-private</code>,
            <code> public-profile</code>, <code>send-accept-friend-requests</code>, <code>photo-video-sharing</code>,
            <code> online-status</code>, <code>multiplayer</code>, <code>send-gifts</code>, <code>mature-language</code>,
            <code>mods</code>, and <code>voice-chat</code>.
          </p>
          <p style={muted}>
            Server keys are kept on the bot server and are never returned to this page. Test connection checks the selected server key only;
            it does not validate the browser key or Kai product publication.
          </p>

          <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 14 }}>
            <button type="button" style={button} disabled={Boolean(busy)} onClick={() => void run("save")}>
              {busy === "save" ? "Saving…" : `Save ${mode === "test" ? "Test" : "Live"} settings`}
            </button>
            <button type="button" style={button} disabled={Boolean(busy)} onClick={() => void run("test")}>
              {busy === "test" ? "Testing…" : `Test ${mode === "test" ? "Test" : "Live"} connection`}
            </button>
            <button type="button" style={{ ...button, background: mode === "live" ? "#681225" : button.background }} disabled={Boolean(busy)} onClick={() => void run("activate")}>
              {busy === "activate" ? "Activating…" : `Activate ${mode === "test" ? "Test" : "Live"} mode`}
            </button>
          </div>
        </>
      ) : null}
    </section>
  );
}
