"use client";

import { useEffect, useState } from "react";
import type { CSSProperties, FormEvent } from "react";

type ProviderStatus = {
  key: "battlenet" | "epic";
  label: string;
  ready: boolean;
  missing: string[];
  hasClientId: boolean;
  hasClientSecret: boolean;
  hasDeploymentId?: boolean;
};

type ProviderCredentials = {
  battlenet: { clientId: string; clientSecret: string };
  epic: { clientId: string; clientSecret: string; deploymentId: string };
};

type Props = { onSaved: () => void };

const initialCredentials: ProviderCredentials = {
  battlenet: { clientId: "", clientSecret: "" },
  epic: { clientId: "", clientSecret: "", deploymentId: "" },
};

const panel: CSSProperties = {
  border: "1px solid rgba(255,0,0,.35)",
  borderRadius: 12,
  padding: 14,
  background: "rgba(90,0,0,.10)",
  marginBottom: 12,
};
const input: CSSProperties = {
  width: "100%",
  background: "#070707",
  border: "1px solid rgba(255,0,0,.45)",
  color: "#ffd3d3",
  borderRadius: 10,
  padding: "10px 12px",
};
const button: CSSProperties = { ...input, width: "auto", fontWeight: 800, cursor: "pointer" };

export default function GameProviderAuthSettings({ onSaved }: Props) {
  const [statuses, setStatuses] = useState<ProviderStatus[]>([]);
  const [credentials, setCredentials] = useState<ProviderCredentials>(initialCredentials);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let active = true;
    fetch("/api/games/auth/settings", { cache: "no-store" })
      .then(async (response) => {
        const json = await response.json();
        if (!response.ok || json?.success === false) {
          throw new Error(json?.error || "Could not load provider setup status.");
        }
        if (active) setStatuses(Array.isArray(json.providers) ? json.providers : []);
      })
      .catch((error: any) => {
        if (active) setMessage(error?.message || "Could not load provider setup status.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  function updateCredential(provider: keyof ProviderCredentials, field: string, value: string) {
    setCredentials((current) => ({
      ...current,
      [provider]: { ...current[provider], [field]: value },
    }));
  }

  async function saveCredentials(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    try {
      const response = await fetch("/api/games/auth/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ providers: credentials }),
      });
      const json = await response.json();
      if (!response.ok || json?.success === false) {
        throw new Error(json?.error || "Could not save provider credentials.");
      }
      setStatuses(Array.isArray(json.providers) ? json.providers : []);
      setCredentials(initialCredentials);
      setMessage("Saved. Secret values are encrypted on the bot server and are never shown again.");
      onSaved();
    } catch (error: any) {
      setMessage(error?.message || "Could not save provider credentials.");
    } finally {
      setSaving(false);
    }
  }

  function providerStatus(key: ProviderStatus["key"]) {
    return statuses.find((provider) => provider.key === key);
  }

  return (
    <section style={panel}>
      <h3 style={{ marginTop: 0, color: "#ff6666", textTransform: "uppercase", letterSpacing: "0.08em" }}>
        Bot Owner: Provider Login Setup
      </h3>
      <p style={{ color: "#ffb7b7", fontSize: 12 }}>
        Add OAuth details here instead of editing .env. Secrets are sent over HTTPS, encrypted on the bot server, and never returned to the dashboard. Blank fields keep the saved value.
      </p>
      <form onSubmit={saveCredentials} style={{ display: "grid", gap: 12 }}>
        <div style={panel}>
          <strong>Battle.net</strong>
          <div style={{ color: "#ffb7b7", fontSize: 12, margin: "4px 0 10px" }}>
            {loading ? "Checking setup..." : providerStatus("battlenet")?.ready ? "Ready for login" : `Needs: ${providerStatus("battlenet")?.missing.join(", ") || "client ID and client secret"}`}
            {" | "}
            <a href="https://develop.battle.net/access/clients" target="_blank" rel="noreferrer">Open Battle.net developer portal</a>
          </div>
          <div style={{ display: "grid", gap: 8 }}>
            <input style={input} autoComplete="off" placeholder="Battle.net client ID" value={credentials.battlenet.clientId} onChange={(event) => updateCredential("battlenet", "clientId", event.target.value)} />
            <input style={input} type="password" autoComplete="new-password" placeholder="Battle.net client secret" value={credentials.battlenet.clientSecret} onChange={(event) => updateCredential("battlenet", "clientSecret", event.target.value)} />
          </div>
        </div>
        <div style={panel}>
          <strong>Epic Games</strong>
          <div style={{ color: "#ffb7b7", fontSize: 12, margin: "4px 0 10px" }}>
            {loading ? "Checking setup..." : providerStatus("epic")?.ready ? "Ready for login" : `Needs: ${providerStatus("epic")?.missing.join(", ") || "client ID, client secret, and EOS deployment ID"}`}
            {" | "}
            <a href="https://dev.epicgames.com/portal/" target="_blank" rel="noreferrer">Open Epic developer portal</a>
          </div>
          <div style={{ display: "grid", gap: 8 }}>
            <input style={input} autoComplete="off" placeholder="Epic Games client ID" value={credentials.epic.clientId} onChange={(event) => updateCredential("epic", "clientId", event.target.value)} />
            <input style={input} type="password" autoComplete="new-password" placeholder="Epic Games client secret" value={credentials.epic.clientSecret} onChange={(event) => updateCredential("epic", "clientSecret", event.target.value)} />
            <input style={input} autoComplete="off" placeholder="Epic EOS deployment ID" value={credentials.epic.deploymentId} onChange={(event) => updateCredential("epic", "deploymentId", event.target.value)} />
          </div>
        </div>
        <div>
          <button type="submit" style={button} disabled={saving || loading}>
            {saving ? "Saving securely..." : "Save provider credentials"}
          </button>
          {message ? <div role="status" style={{ marginTop: 8, color: "#ffb3f0" }}>{message}</div> : null}
        </div>
      </form>
    </section>
  );
}
