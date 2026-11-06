"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { resolveGuildContext, readJsonOrThrow, saveRuntimeEngine } from "@/lib/liveRuntime";

type ProviderPayload = {
  success?: boolean;
  guildId?: string | null;
  provider?: {
    configured?: boolean;
    keyPresent?: boolean;
    baseUrl?: string;
    model?: string;
  };
  personas?: {
    count?: number;
    autoReplyEnabled?: boolean;
    mentionOnly?: boolean;
  };
  runtime?: {
    personaAiEnabled?: boolean;
    adaptiveAiEnabled?: boolean;
    personaOnlyChannelIds?: string[];
    personaKeywordTriggers?: string[];
  } | null;
  warnings?: string[];
};

type PersonaRuntimePayload = {
  config?: {
    settings?: {
      autoReplyEnabled?: boolean;
      mentionOnly?: boolean;
    };
    personaCount?: number;
    personas?: Array<{
      key?: string;
      name?: string;
      enabled?: boolean;
      bio?: string;
      triggerCount?: number;
      mentionRequired?: boolean;
      imageConfigured?: boolean;
      allowedRoleCount?: number;
      allowedChannelCount?: number;
    }>;
  };
};

const shell: CSSProperties = { color: "#ffd0d0", padding: 20, maxWidth: 1280 };
const card: CSSProperties = {
  border: "1px solid #6f0000",
  borderRadius: 12,
  background: "rgba(120,0,0,0.08)",
  padding: 14,
  marginBottom: 14,
};
const input: CSSProperties = {
  width: "100%",
  padding: 10,
  background: "#0a0a0a",
  border: "1px solid #7a0000",
  color: "#ffd7d7",
  borderRadius: 8,
};
const button: CSSProperties = {
  ...input,
  width: "auto",
  cursor: "pointer",
  fontWeight: 800,
  textTransform: "uppercase",
  letterSpacing: "0.06em",
};

export default function OpenAiPlatformClient() {
  const [guildId, setGuildId] = useState("");
  const [guildName, setGuildName] = useState("");
  const [provider, setProvider] = useState<ProviderPayload>({});
  const [personaRuntime, setPersonaRuntime] = useState<PersonaRuntimePayload>({});
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const resolved = resolveGuildContext();
    setGuildId(resolved.guildId);
    setGuildName(resolved.guildName);
  }, []);

  async function loadAll(targetGuildId: string) {
    if (!targetGuildId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setMessage("");
      const [providerRes, personaRes] = await Promise.all([
        fetch(`/api/bot/openai-runtime?guildId=${encodeURIComponent(targetGuildId)}`, { cache: "no-store" }),
        fetch(`/api/ai/persona-runtime?guildId=${encodeURIComponent(targetGuildId)}`, { cache: "no-store" }),
      ]);
      const providerJson = await readJsonOrThrow(providerRes);
      const personaJson = await readJsonOrThrow(personaRes);
      setProvider(providerJson);
      setPersonaRuntime(personaJson);
    } catch (err: any) {
      setMessage(err?.message || "Failed to load hosted AI platform state.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadAll(guildId);
  }, [guildId]);

  async function saveRuntimePatch(patch: Record<string, unknown>, okLabel: string) {
    if (!guildId) return;
    try {
      setMessage("");
      await saveRuntimeEngine(guildId, "runtimeRouter", patch);
      await loadAll(guildId);
      setMessage(okLabel);
    } catch (err: any) {
      setMessage(err?.message || "Save failed.");
    }
  }

  const personas = useMemo(
    () => Array.isArray(personaRuntime?.config?.personas) ? personaRuntime.config!.personas! : [],
    [personaRuntime]
  );

  if (!guildId && !loading) {
    return <div style={{ color: "#ff8585", padding: 20 }}>Missing guildId. Open from `/guilds` first.</div>;
  }

  return (
    <div style={shell}>
      <div style={card}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <div>
            <h1 style={{ margin: 0, color: "#ff4a4a", letterSpacing: "0.12em", textTransform: "uppercase" }}>Creator AI Platform</h1>
            <div style={{ color: "#ff9f9f", marginTop: 6 }}>Guild: {guildName || guildId}</div>
            <div style={{ color: "#ffb7b7", fontSize: 12, marginTop: 6 }}>
              This page shows the live provider/runtime state the bot creator actually uses. The old pricing catalog was dashboard-only and has been removed.
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Link href={`/dashboard/ai/persona?guildId=${encodeURIComponent(guildId)}`} style={button}>Open Persona AI</Link>
            <Link href={`/dashboard/ai?guildId=${encodeURIComponent(guildId)}`} style={button}>Open AI Routing</Link>
          </div>
        </div>
        {message ? <div style={{ marginTop: 10, color: "#ffb3f0" }}>{message}</div> : null}
      </div>

      {loading ? <div style={card}>Loading creator AI platform...</div> : null}

      {!loading ? (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 10, marginBottom: 14 }}>
            {[
              ["Provider", provider?.provider?.configured ? "Configured" : "Missing API Key"],
              ["Model", provider?.provider?.model || "Unknown"],
              ["Persona Runtime", provider?.runtime?.personaAiEnabled ? "Enabled" : "Disabled"],
              ["Adaptive Runtime", provider?.runtime?.adaptiveAiEnabled ? "Enabled" : "Disabled"],
              ["Persona Roster", String(provider?.personas?.count ?? personaRuntime?.config?.personaCount ?? 0)],
            ].map(([label, value]) => (
              <div key={label} style={card}>
                <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.08em", color: "#ffadad" }}>{label}</div>
                <div style={{ marginTop: 6, fontSize: 22, fontWeight: 900, color: "#fff" }}>{value}</div>
              </div>
            ))}
          </div>

          <div style={card}>
            <h3 style={{ marginTop: 0, color: "#ff6666", textTransform: "uppercase", letterSpacing: "0.08em" }}>Provider State</h3>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div>
                <label>Base URL</label>
                <input style={input} readOnly value={provider?.provider?.baseUrl || "https://api.openai.com/v1"} />
              </div>
              <div>
                <label>Model</label>
                <input style={input} readOnly value={provider?.provider?.model || "gpt-4o-mini"} />
              </div>
            </div>
            <div style={{ marginTop: 10, color: provider?.provider?.configured ? "#88ffb1" : "#ff9a9a" }}>
              {provider?.provider?.configured ? "OpenAI credentials are loaded in the bot runtime." : "OpenAI credentials are missing from the bot runtime."}
            </div>
            {Array.isArray(provider?.warnings) && provider.warnings.length ? (
              <div style={{ marginTop: 10, color: "#ffb3f0", fontSize: 12 }}>
                {provider.warnings.join(" | ")}
              </div>
            ) : null}
          </div>

          <div style={card}>
            <h3 style={{ marginTop: 0, color: "#ff6666", textTransform: "uppercase", letterSpacing: "0.08em" }}>Guild Runtime</h3>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2,minmax(220px,1fr))", gap: 10 }}>
              <label>
                <input
                  type="checkbox"
                  checked={Boolean(provider?.runtime?.personaAiEnabled)}
                  onChange={(event) => void saveRuntimePatch({ personaAiEnabled: event.target.checked }, `Persona runtime ${event.target.checked ? "enabled" : "disabled"}.`)}
                />{" "}
                Persona runtime enabled
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={Boolean(provider?.runtime?.adaptiveAiEnabled)}
                  onChange={(event) => void saveRuntimePatch({ adaptiveAiEnabled: event.target.checked }, `Adaptive runtime ${event.target.checked ? "enabled" : "disabled"}.`)}
                />{" "}
                Adaptive runtime enabled
              </label>
            </div>
            <div style={{ marginTop: 10, color: "#ffb3b3", fontSize: 12 }}>
              Persona-only channels: {Array.isArray(provider?.runtime?.personaOnlyChannelIds) ? provider.runtime.personaOnlyChannelIds.length : 0}
              {" | "}
              Persona keywords: {Array.isArray(provider?.runtime?.personaKeywordTriggers) ? provider.runtime.personaKeywordTriggers.join(", ") : "none"}
            </div>
          </div>

          <div style={card}>
            <h3 style={{ marginTop: 0, color: "#ff6666", textTransform: "uppercase", letterSpacing: "0.08em" }}>Persona Runtime</h3>
            <div style={{ color: "#ffb3b3", fontSize: 12, marginBottom: 10 }}>
              Auto replies: {personaRuntime?.config?.settings?.autoReplyEnabled ? "On" : "Off"}
              {" | "}
              Mention only: {personaRuntime?.config?.settings?.mentionOnly === false ? "Off" : "On"}
            </div>
            {personas.length ? personas.map((persona) => (
              <div key={persona.key || persona.name} style={{ borderTop: "1px solid #3a0000", paddingTop: 10, marginTop: 10 }}>
                <div style={{ fontWeight: 900 }}>{persona.name || persona.key || "Persona"}</div>
                <div style={{ color: "#ffb3b3", fontSize: 12 }}>
                  {persona.enabled === false ? "disabled" : "enabled"} | triggers {persona.triggerCount || 0} | {persona.mentionRequired === false ? "ambient allowed" : "mention required"} | channels {persona.allowedChannelCount || 0} | roles {persona.allowedRoleCount || 0}
                </div>
                {persona.bio ? <div style={{ color: "#ffcccc", marginTop: 6, fontSize: 13 }}>{persona.bio}</div> : null}
              </div>
            )) : <div style={{ color: "#ffb3b3" }}>No persona runtime entries found.</div>}
          </div>
        </>
      ) : null}
    </div>
  );
}
