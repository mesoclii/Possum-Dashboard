"use client";

import { useMemo, useState } from "react";
import EngineInsights from "@/components/possum/EngineInsights";
import { useGuildEngineEditor } from "@/components/possum/useGuildEngineEditor";

type SearchProvider = {
  key: string;
  label: string;
  description: string;
  enabled: boolean;
  urlTemplate: string;
  color: string;
};

type SearchConfig = {
  enabled: boolean;
  defaultProvider: string;
  resultsPerQuery: number;
  allowNsfw: boolean;
  providers: SearchProvider[];
  notes: string;
};

const DEFAULT_CONFIG: SearchConfig = {
  enabled: false,
  defaultProvider: "google",
  resultsPerQuery: 4,
  allowNsfw: false,
  providers: [],
  notes: "",
};

const shell: React.CSSProperties = { color: "#ffd0d0", padding: 18, maxWidth: 1280 };
const card: React.CSSProperties = { border: "1px solid #6a0000", borderRadius: 12, background: "rgba(120,0,0,0.10)", padding: 14, marginBottom: 12 };
const input: React.CSSProperties = { width: "100%", padding: "10px 12px", background: "#0b0b0b", color: "#ffd8d8", border: "1px solid #7a0000", borderRadius: 8 };
const button: React.CSSProperties = { ...input, width: "auto", cursor: "pointer", fontWeight: 800 };
const micro: React.CSSProperties = { fontSize: 12, color: "#ffb2b2", lineHeight: 1.6 };

function normalizeConfig(raw: Partial<SearchConfig> | null | undefined): SearchConfig {
  const next = raw || {};
  return {
    ...DEFAULT_CONFIG,
    ...next,
    enabled: next.enabled === true,
    defaultProvider: String(next.defaultProvider || DEFAULT_CONFIG.defaultProvider).trim() || DEFAULT_CONFIG.defaultProvider,
    resultsPerQuery: Math.max(1, Math.min(6, Number(next.resultsPerQuery || DEFAULT_CONFIG.resultsPerQuery))),
    allowNsfw: next.allowNsfw === true,
    providers: Array.isArray(next.providers)
      ? next.providers.map((provider) => ({
          key: String(provider?.key || "").trim(),
          label: String(provider?.label || provider?.key || "Provider").trim(),
          description: String(provider?.description || "").trim(),
          enabled: provider?.enabled !== false,
          urlTemplate: String(provider?.urlTemplate || "").trim(),
          color: String(provider?.color || "#ef4444").trim() || "#ef4444",
        }))
      : [],
    notes: String(next.notes || "").trim(),
  };
}

export default function SearchAnythingClient() {
  const {
    guildId,
    guildName,
    config,
    setConfig,
    summary,
    details,
    loading,
    saving,
    message,
    save,
    runAction,
  } = useGuildEngineEditor<SearchConfig>("searchAnything", DEFAULT_CONFIG);
  const cfg = useMemo(() => normalizeConfig(config), [config]);
  const [previewQuery, setPreviewQuery] = useState("");
  const [previewProvider, setPreviewProvider] = useState("");
  const [previewUrl, setPreviewUrl] = useState("");

  function updateProvider(index: number, patch: Partial<SearchProvider>) {
    setConfig((prev) => {
      const normalized = normalizeConfig(prev);
      const providers = [...normalized.providers];
      providers[index] = { ...providers[index], ...patch };
      return { ...normalized, providers };
    });
  }

  async function previewSearch() {
    const result = await runAction("previewQuery", {
      providerKey: previewProvider || cfg.defaultProvider,
      query: previewQuery,
    });
    setPreviewUrl(String((result as { url?: string } | null)?.url || ""));
  }

  if (!guildId) {
    return <div style={{ ...shell, color: "#ff8a8a" }}>Missing guildId. Open from `/guilds` first.</div>;
  }

  return (
    <div style={shell}>
      <h1 style={{ margin: 0, color: "#ff4444", letterSpacing: "0.12em", textTransform: "uppercase" }}>Search Anything</h1>
      <div style={{ color: "#ff9c9c", marginTop: 6 }}>Guild: {guildName || guildId}</div>
      <div style={{ color: "#ffb0b0", fontSize: 12, marginTop: 4 }}>
        This utility gives each guild a real search surface instead of a fake placeholder card. You can tune which providers show up, what URLs they use, and what the `/search` command opens.
      </div>
      {message ? <div style={{ color: "#ffb3f0", marginTop: 8 }}>{message}</div> : null}

      {loading ? (
        <div style={card}>Loading Search Anything...</div>
      ) : (
        <>
          <EngineInsights summary={summary} details={details} showDetails />

          <section style={card}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 12 }}>
              <label><input type="checkbox" checked={cfg.enabled} onChange={(event) => setConfig((prev) => ({ ...normalizeConfig(prev), enabled: event.target.checked }))} /> Search Anything Enabled</label>
              <label><input type="checkbox" checked={cfg.allowNsfw} onChange={(event) => setConfig((prev) => ({ ...normalizeConfig(prev), allowNsfw: event.target.checked }))} /> Allow NSFW Targets</label>
              <div>
                <div style={{ marginBottom: 6 }}>Default Provider</div>
                <select style={input} value={cfg.defaultProvider} onChange={(event) => setConfig((prev) => ({ ...normalizeConfig(prev), defaultProvider: event.target.value }))}>
                  {cfg.providers.map((provider) => <option key={provider.key} value={provider.key}>{provider.label}</option>)}
                </select>
              </div>
              <div>
                <div style={{ marginBottom: 6 }}>Quick Links Per Search</div>
                <input style={input} type="number" min={1} max={6} value={cfg.resultsPerQuery} onChange={(event) => setConfig((prev) => ({ ...normalizeConfig(prev), resultsPerQuery: Number(event.target.value || 1) }))} />
              </div>
            </div>
            <div style={{ marginTop: 12 }}>
              <div style={{ marginBottom: 6 }}>Operator Notes</div>
              <textarea style={{ ...input, minHeight: 90 }} value={cfg.notes} onChange={(event) => setConfig((prev) => ({ ...normalizeConfig(prev), notes: event.target.value }))} />
            </div>
          </section>

          <section style={card}>
            <div style={{ fontWeight: 800, marginBottom: 8 }}>Provider Routes</div>
            <div style={micro}>Use <code>{"{{query}}"}</code> anywhere in the URL template. If you want a guild to avoid one provider completely, turn it off here and <code>/search</code> will stop offering it.</div>
            <div style={{ display: "grid", gap: 12, marginTop: 12 }}>
              {cfg.providers.map((provider, index) => (
                <div key={provider.key} style={{ ...card, marginBottom: 0 }}>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 12 }}>
                    <div>
                      <div style={{ marginBottom: 6 }}>Provider</div>
                      <input style={input} value={provider.label} onChange={(event) => updateProvider(index, { label: event.target.value })} />
                    </div>
                    <div>
                      <div style={{ marginBottom: 6 }}>Provider Key</div>
                      <input style={input} value={provider.key} readOnly />
                    </div>
                    <div>
                      <div style={{ marginBottom: 6 }}>Accent Color</div>
                      <input style={input} value={provider.color} onChange={(event) => updateProvider(index, { color: event.target.value })} />
                    </div>
                    <div style={{ display: "flex", alignItems: "end" }}>
                      <label><input type="checkbox" checked={provider.enabled} onChange={(event) => updateProvider(index, { enabled: event.target.checked })} /> Enabled</label>
                    </div>
                  </div>
                  <div style={{ marginTop: 10 }}>
                    <div style={{ marginBottom: 6 }}>Description</div>
                    <input style={input} value={provider.description} onChange={(event) => updateProvider(index, { description: event.target.value })} />
                  </div>
                  <div style={{ marginTop: 10 }}>
                    <div style={{ marginBottom: 6 }}>URL Template</div>
                    <input style={input} value={provider.urlTemplate} onChange={(event) => updateProvider(index, { urlTemplate: event.target.value })} />
                  </div>
                </div>
              ))}
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
              <button type="button" style={button} disabled={saving} onClick={() => void save(normalizeConfig(cfg))}>Save Search Anything</button>
            </div>
          </section>

          <section style={card}>
            <div style={{ fontWeight: 800, marginBottom: 8 }}>Live Search Preview</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 12 }}>
              <div>
                <div style={{ marginBottom: 6 }}>Provider</div>
                <select style={input} value={previewProvider} onChange={(event) => setPreviewProvider(event.target.value)}>
                  <option value="">Use default provider</option>
                  {cfg.providers.filter((provider) => provider.enabled).map((provider) => <option key={provider.key} value={provider.key}>{provider.label}</option>)}
                </select>
              </div>
              <div style={{ gridColumn: "1 / -1" }}>
                <div style={{ marginBottom: 6 }}>Search Query</div>
                <input style={input} value={previewQuery} onChange={(event) => setPreviewQuery(event.target.value)} placeholder="Saviors GTA heist route" />
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
              <button type="button" style={button} disabled={saving || !previewQuery.trim()} onClick={() => void previewSearch()}>Preview Search URL</button>
              {previewUrl ? <a href={previewUrl} target="_blank" rel="noreferrer" style={{ ...button, textDecoration: "none" }}>Open Preview</a> : null}
            </div>
            {previewUrl ? <div style={{ ...micro, marginTop: 10 }}>{previewUrl}</div> : null}
          </section>
        </>
      )}
    </div>
  );
}
