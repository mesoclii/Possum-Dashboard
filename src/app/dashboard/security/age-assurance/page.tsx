"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { resolveGuildContext } from "@/lib/liveRuntime";

type Policy = {
  onboarding: boolean;
  adultFeatures: boolean;
  podcasts: boolean;
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

  return (
    <main style={shell}>
      <h1 style={{ margin: 0 }}>Age Assurance</h1>
      <p style={muted}>
        Per-server controls for k-ID feature permissions. These settings do not age-gate the
        dashboard, Gaming Hub, ordinary bot use, purchases, or public podcast playback.
        The installed SDK supports built-in permission IDs only; the mapped categories are not
        exact adult-age guarantees. Verify the test product policy before enabling Adult Emote Studio.
      </p>
      <div style={card}>
        <strong>Selected server</strong>
        <div style={{ marginTop: 6 }}>{guildName || "Server"}{guildId ? ` · ${guildId}` : ""}</div>
      </div>
      {error ? <p role="alert" style={{ color: "#ff9b9b" }}>{error}</p> : null}
      {message ? <p role="status" style={{ color: "#9ce3b1" }}>{message}</p> : null}
      {!guildId ? <div role="alert" style={card}>Select a server before changing its age assurance settings.</div> : null}
      {loading ? <p>Loading server settings…</p> : null}

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
          When enabled, entry to the private Adult Emote Studio requires the built-in
          <code> mods </code> permission. This currently gates the staging page only;
          Discord import/export and publishing actions are not implemented here.
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
