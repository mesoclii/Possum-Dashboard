"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, type CSSProperties, type ChangeEvent } from "react";
import ConfigJsonEditor from "@/components/possum/ConfigJsonEditor";
import EngineInsights from "@/components/possum/EngineInsights";
import { buildDashboardHref } from "@/lib/dashboardContext";
import {
  fetchDashboardConfig,
  fetchGuildData,
  fetchRuntimeEngine,
  resolveGuildContext,
  runRuntimeEngineAction,
  saveRuntimeEngine,
} from "@/lib/liveRuntime";
import type { EngineDetails, EngineSummaryItem } from "@/components/possum/useGuildEngineEditor";

type QuickLink = { href: string; label: string };
type CatalogEdge = { from?: string; to?: string; type?: string; why?: string; channel?: string };
type EngineField = { key?: string; type?: string; label?: string; options?: string[]; step?: number; min?: number };
type EngineFieldGroup = { key?: string; label?: string; fields?: EngineField[] };
type EngineFieldSchema = { title?: string; groups?: EngineFieldGroup[] };
type LiveEngineSpec = {
  engineKey?: string;
  configKey?: string;
  displayName?: string;
  premiumRequired?: boolean;
  privateOnly?: boolean;
  hardDependencies?: { services?: string[]; envVars?: string[]; runtimeFlags?: string[] };
};
type DashboardConfig = { features?: Record<string, boolean> };
type BindingIssue = { field: string; kind: "channel" | "role"; missingIds: string[] };
type Channel = { id: string; name: string };
type Role = { id: string; name: string };
type RuntimePayload = { config?: Record<string, unknown>; summary?: EngineSummaryItem[]; details?: EngineDetails };
type Props = { engineKey: string; title: string; description: string; links?: QuickLink[]; featureFlagKey?: string };

const shell: CSSProperties = { color: "#ffd0d0", padding: 18, maxWidth: 1380 };
const card: CSSProperties = { border: "1px solid #5f0000", borderRadius: 14, padding: 16, background: "linear-gradient(180deg, rgba(120,0,0,0.12), rgba(0,0,0,0.72))", marginTop: 12 };
const inner: CSSProperties = { border: "1px solid #4a0000", borderRadius: 10, padding: 12, background: "#100000" };
const input: CSSProperties = { width: "100%", padding: "10px 12px", background: "#0b0b0b", color: "#ffd8d8", border: "1px solid #7a0000", borderRadius: 8 };
const button: CSSProperties = { ...input, width: "auto", cursor: "pointer", fontWeight: 800 };
const micro: CSSProperties = { color: "#ffbcbc", fontSize: 12, lineHeight: 1.6 };

function getAtPath(input: unknown, path: string[]) {
  return path.reduce<unknown>((current, key) => {
    if (!current || typeof current !== "object") return undefined;
    return (current as Record<string, unknown>)[key];
  }, input);
}

function setAtPath(input: Record<string, unknown>, path: string[], value: unknown) {
  const root = JSON.parse(JSON.stringify(input || {})) as Record<string, unknown>;
  let cursor = root;
  for (let index = 0; index < path.length - 1; index += 1) {
    const key = path[index];
    const current = cursor[key];
    if (!current || typeof current !== "object" || Array.isArray(current)) {
      cursor[key] = {};
    }
    cursor = cursor[key] as Record<string, unknown>;
  }
  cursor[path[path.length - 1]] = value;
  return root;
}

function humanize(value: string) {
  return String(value || "")
    .replace(/^security\./, "")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[._]/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function runtimeEnabled(config: Record<string, unknown>) {
  return config.enabled !== false && config.active !== false;
}

function defaultFeatureFlagForEngine(engineKey: string) {
  if (engineKey === "lockdown") return "lockdownEnabled";
  if (engineKey === "raid") return "raidEnabled";
  if (engineKey === "onboarding") return "onboardingEnabled";
  if (engineKey === "verification") return "verificationEnabled";
  if (engineKey === "security.governance") return "governanceEnabled";
  if (engineKey === "preOnboarding" || engineKey.startsWith("security.")) return "securityEnabled";
  return "";
}

function listFromText(value: unknown) {
  if (Array.isArray(value)) return value.map((entry) => String(entry || "").trim()).filter(Boolean);
  return String(value || "").split(/[\n,]+/).map((entry) => entry.trim()).filter(Boolean);
}

async function loadCatalog(guildId: string, engineKey: string) {
  const res = await fetch(`/api/bot/engine-catalog?guildId=${encodeURIComponent(guildId)}&engine=${encodeURIComponent(engineKey)}`, { cache: "no-store" });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json?.success === false) throw new Error(json?.error || "Failed to load engine catalog.");
  const specs: LiveEngineSpec[] = Array.isArray(json?.engineSpecs) ? (json.engineSpecs as LiveEngineSpec[]) : [];
  const spec = specs.find((entry: LiveEngineSpec) => String(entry?.engineKey || entry?.configKey || "").trim() === engineKey) || null;
  return {
    spec: spec as LiveEngineSpec | null,
    schema: (json?.fieldSchema && typeof json.fieldSchema === "object" ? json.fieldSchema : null) as EngineFieldSchema | null,
    edges: Array.isArray(json?.connections?.edges) ? (json.connections.edges as CatalogEdge[]) : [],
  };
}

function collectBindingIssues(schema: EngineFieldSchema | null, config: Record<string, unknown>, channels: Channel[], roles: Role[]) {
  const channelIds = new Set(channels.map((entry) => entry.id));
  const roleIds = new Set(roles.map((entry) => entry.id));
  const issues: BindingIssue[] = [];
  for (const group of schema?.groups || []) {
    for (const field of group.fields || []) {
      const key = String(field.key || "");
      const type = String(field.type || "");
      const value = getAtPath(config, key.split(".").filter(Boolean));
      if (type === "channel-single") {
        const id = String(value || "").trim();
        if (id && !channelIds.has(id)) issues.push({ field: String(field.label || humanize(key)), kind: "channel", missingIds: [id] });
      }
      if (type === "role-single") {
        const id = String(value || "").trim();
        if (id && !roleIds.has(id)) issues.push({ field: String(field.label || humanize(key)), kind: "role", missingIds: [id] });
      }
      if (type === "channel-multi" && Array.isArray(value)) {
        const missingIds = value.map((entry) => String(entry || "").trim()).filter(Boolean).filter((id) => !channelIds.has(id));
        if (missingIds.length) issues.push({ field: String(field.label || humanize(key)), kind: "channel", missingIds });
      }
      if (type === "role-multi" && Array.isArray(value)) {
        const missingIds = value.map((entry) => String(entry || "").trim()).filter(Boolean).filter((id) => !roleIds.has(id));
        if (missingIds.length) issues.push({ field: String(field.label || humanize(key)), kind: "role", missingIds });
      }
    }
  }
  return issues;
}

export default function SecurityEngineOperator({ engineKey, title, description, links = [], featureFlagKey }: Props) {
  const [guildId, setGuildId] = useState("");
  const [guildName, setGuildName] = useState("");
  const [dashboardConfig, setDashboardConfig] = useState<DashboardConfig>({});
  const [summary, setSummary] = useState<EngineSummaryItem[]>([]);
  const [details, setDetails] = useState<EngineDetails>({});
  const [config, setConfig] = useState<Record<string, unknown>>({});
  const [schema, setSchema] = useState<EngineFieldSchema | null>(null);
  const [spec, setSpec] = useState<LiveEngineSpec | null>(null);
  const [edges, setEdges] = useState<CatalogEdge[]>([]);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const context = resolveGuildContext();
    setGuildId(context.guildId);
    setGuildName(context.guildName);
  }, []);

  const reload = useCallback(async () => {
    if (!guildId) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      setMessage("");
      const [dashboard, runtime, guildData, catalog] = await Promise.all([
        fetchDashboardConfig(guildId),
        fetchRuntimeEngine(guildId, engineKey),
        fetchGuildData(guildId),
        loadCatalog(guildId, engineKey),
      ]);
      const payload = runtime as RuntimePayload;
      setDashboardConfig(dashboard as DashboardConfig);
      setSummary(Array.isArray(payload.summary) ? payload.summary : []);
      setDetails((payload.details && typeof payload.details === "object" ? payload.details : {}) as EngineDetails);
      setConfig((payload.config && typeof payload.config === "object" ? payload.config : {}) as Record<string, unknown>);
      setChannels(Array.isArray(guildData.channels) ? (guildData.channels as Channel[]) : []);
      setRoles(Array.isArray(guildData.roles) ? (guildData.roles as Role[]) : []);
      setSchema(catalog.schema);
      setSpec(catalog.spec);
      setEdges(catalog.edges);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to load security engine.");
    } finally {
      setLoading(false);
    }
  }, [engineKey, guildId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const effectiveFeatureFlag = featureFlagKey || defaultFeatureFlagForEngine(engineKey);
  const featureGateValue = effectiveFeatureFlag ? dashboardConfig.features?.[effectiveFeatureFlag] : undefined;
  const bindingIssues = useMemo(() => collectBindingIssues(schema, config, channels, roles), [channels, config, roles, schema]);
  const relatedEdges = useMemo(() => edges.filter((edge) => String(edge.from || "") === engineKey || String(edge.to || "") === engineKey), [edges, engineKey]);

  function updateField(fieldKey: string, value: unknown) {
    setConfig((prev) => setAtPath(prev, fieldKey.split(".").filter(Boolean), value));
  }

  async function applySave(nextConfig = config, okMessage = "Saved security engine.") {
    if (!guildId) return;
    try {
      setSaving(true);
      setMessage("");
      const json = await saveRuntimeEngine(guildId, engineKey, nextConfig);
      const payload = json as RuntimePayload;
      setSummary(Array.isArray(payload.summary) ? payload.summary : []);
      setDetails((payload.details && typeof payload.details === "object" ? payload.details : {}) as EngineDetails);
      setConfig((payload.config && typeof payload.config === "object" ? payload.config : nextConfig) as Record<string, unknown>);
      setMessage(okMessage);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  }

  async function toggleEnabled(nextEnabled: boolean) {
    const nextConfig = { ...config } as Record<string, unknown>;
    if (Object.prototype.hasOwnProperty.call(nextConfig, "enabled") || !Object.prototype.hasOwnProperty.call(nextConfig, "active")) nextConfig.enabled = nextEnabled;
    if (Object.prototype.hasOwnProperty.call(nextConfig, "active")) nextConfig.active = nextEnabled;
    await applySave(nextConfig, nextEnabled ? "Engine enabled." : "Engine disabled.");
  }

  async function resetToBaseline() {
    if (!guildId) return;
    if (typeof window !== "undefined" && !window.confirm("Reset this live engine back to its baseline config for the selected guild?")) return;
    try {
      setSaving(true);
      setMessage("");
      await runRuntimeEngineAction(guildId, engineKey, "resetConfig");
      await reload();
      setMessage("Reset to baseline.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Reset failed.");
    } finally {
      setSaving(false);
    }
  }

  function renderField(field: EngineField) {
    const fieldKey = String(field.key || "");
    const type = String(field.type || "string");
    const label = String(field.label || humanize(fieldKey));
    const value = getAtPath(config, fieldKey.split(".").filter(Boolean));

    if (type === "boolean") {
      return <label key={fieldKey} style={{ display: "inline-flex", gap: 8, alignItems: "center", fontWeight: 700 }}><input type="checkbox" checked={Boolean(value)} onChange={(event) => updateField(fieldKey, event.target.checked)} /> {label}</label>;
    }
    if (type === "number") {
      return <label key={fieldKey} style={{ display: "grid", gap: 6 }}><span style={micro}>{label}</span><input style={input} type="number" min={field.min} step={field.step || 1} value={typeof value === "number" ? value : Number(value || 0)} onChange={(event) => updateField(fieldKey, Number(event.target.value || 0))} /></label>;
    }
    if (type === "select") {
      return <label key={fieldKey} style={{ display: "grid", gap: 6 }}><span style={micro}>{label}</span><select style={input} value={String(value || "")} onChange={(event) => updateField(fieldKey, event.target.value)}>{(field.options || []).map((option) => <option key={option} value={option}>{humanize(option)}</option>)}</select></label>;
    }
    if (type === "channel-single") {
      return <label key={fieldKey} style={{ display: "grid", gap: 6 }}><span style={micro}>{label}</span><select style={input} value={String(value || "")} onChange={(event) => updateField(fieldKey, event.target.value)}><option value="">Not set</option>{channels.map((channel) => <option key={channel.id} value={channel.id}>#{channel.name}</option>)}</select></label>;
    }
    if (type === "role-single") {
      return <label key={fieldKey} style={{ display: "grid", gap: 6 }}><span style={micro}>{label}</span><select style={input} value={String(value || "")} onChange={(event) => updateField(fieldKey, event.target.value)}><option value="">Not set</option>{roles.map((role) => <option key={role.id} value={role.id}>@{role.name}</option>)}</select></label>;
    }
    if (type === "channel-multi") {
      const selected = Array.isArray(value) ? value.map((entry) => String(entry || "")).filter(Boolean) : [];
      return <label key={fieldKey} style={{ display: "grid", gap: 6 }}><span style={micro}>{label}</span><select style={{ ...input, minHeight: 140 }} multiple value={selected} onChange={(event: ChangeEvent<HTMLSelectElement>) => updateField(fieldKey, Array.from(event.target.selectedOptions).map((option) => option.value))}>{channels.map((channel) => <option key={channel.id} value={channel.id}>#{channel.name}</option>)}</select></label>;
    }
    if (type === "role-multi") {
      const selected = Array.isArray(value) ? value.map((entry) => String(entry || "")).filter(Boolean) : [];
      return <label key={fieldKey} style={{ display: "grid", gap: 6 }}><span style={micro}>{label}</span><select style={{ ...input, minHeight: 140 }} multiple value={selected} onChange={(event: ChangeEvent<HTMLSelectElement>) => updateField(fieldKey, Array.from(event.target.selectedOptions).map((option) => option.value))}>{roles.map((role) => <option key={role.id} value={role.id}>@{role.name}</option>)}</select></label>;
    }
    if (type === "string-list") {
      return <label key={fieldKey} style={{ display: "grid", gap: 6 }}><span style={micro}>{label}</span><textarea style={{ ...input, minHeight: 110 }} value={listFromText(value).join("\n")} onChange={(event) => updateField(fieldKey, listFromText(event.target.value))} /></label>;
    }
    if (type === "textarea") {
      return <label key={fieldKey} style={{ display: "grid", gap: 6 }}><span style={micro}>{label}</span><textarea style={{ ...input, minHeight: 120 }} value={String(value || "")} onChange={(event) => updateField(fieldKey, event.target.value)} /></label>;
    }
    return <label key={fieldKey} style={{ display: "grid", gap: 6 }}><span style={micro}>{label}</span><input style={input} value={String(value || "")} onChange={(event) => updateField(fieldKey, event.target.value)} /></label>;
  }

  if (!guildId && !loading) return <div style={{ ...shell, color: "#ff8080" }}>Missing guildId. Open from `/guilds` first.</div>;

  return (
    <section style={shell}>
      <div style={card}>
        <div style={{ color: "#ff9a9a", fontSize: 12, letterSpacing: "0.16em", textTransform: "uppercase" }}>Security Operator Surface</div>
        <div style={{ color: "#ff4545", fontSize: 24, fontWeight: 900, textTransform: "uppercase", letterSpacing: "0.10em", marginTop: 8 }}>{title || spec?.displayName || humanize(engineKey)}</div>
        <div style={{ color: "#ffabab", marginTop: 8 }}>Guild: <b>{guildName || guildId}</b></div>
        <div style={{ color: "#ffd0d0", lineHeight: 1.7, marginTop: 10 }}>{description}</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
          <span style={{ ...micro, border: `1px solid ${runtimeEnabled(config) ? "#1f8a3f" : "#8a2f2f"}`, borderRadius: 999, padding: "5px 10px" }}>{runtimeEnabled(config) ? "Runtime On" : "Runtime Off"}</span>
          {effectiveFeatureFlag ? <span style={{ ...micro, border: `1px solid ${featureGateValue === false ? "#8a2f2f" : "#1f8a3f"}`, borderRadius: 999, padding: "5px 10px" }}>{effectiveFeatureFlag}: {featureGateValue === false ? "Blocked" : "Open"}</span> : null}
          {spec?.premiumRequired ? <span style={{ ...micro, border: "1px solid #ff2bd6", borderRadius: 999, padding: "5px 10px" }}>Premium Engine</span> : null}
          {spec?.privateOnly ? <span style={{ ...micro, border: "1px solid #ff2bd6", borderRadius: 999, padding: "5px 10px" }}>Private Only</span> : null}
        </div>
        {links.length ? <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>{links.map((item) => <Link key={item.href} href={buildDashboardHref(item.href)} style={{ ...button, textDecoration: "none" }}>{item.label}</Link>)}</div> : null}
      </div>

      {message ? <div style={{ ...card, color: "#ffb3f0" }}>{message}</div> : null}
      {loading ? <div style={card}>Loading engine runtime...</div> : (
        <>
          <EngineInsights summary={summary} details={details} />

          <div style={card}>
            <div style={{ color: "#ff5b5b", fontWeight: 900, letterSpacing: "0.08em", textTransform: "uppercase" }}>Recovery Actions</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
              <button type="button" style={button} disabled={saving} onClick={() => void toggleEnabled(true)}>Enable Engine</button>
              <button type="button" style={button} disabled={saving} onClick={() => void toggleEnabled(false)}>Disable Engine</button>
              <button type="button" style={button} disabled={saving || loading} onClick={() => void reload()}>Reload Runtime</button>
              <button type="button" style={button} disabled={saving} onClick={() => void resetToBaseline()}>Reset To Baseline</button>
              <button type="button" style={button} disabled={saving} onClick={() => void applySave()}>{saving ? "Saving..." : "Save Security Engine"}</button>
            </div>
          </div>

          {bindingIssues.length ? <div style={card}><div style={{ color: "#ff5b5b", fontWeight: 900, letterSpacing: "0.08em", textTransform: "uppercase" }}>Missing Guild Bindings</div><div style={{ display: "grid", gap: 10, marginTop: 12 }}>{bindingIssues.map((issue) => <div key={`${issue.kind}:${issue.field}`} style={inner}><div style={{ color: "#ffdada", fontWeight: 800 }}>{issue.field}</div><div style={micro}>Missing {issue.kind} IDs: {issue.missingIds.join(", ")}</div></div>)}</div></div> : null}

          {relatedEdges.length ? <div style={card}><div style={{ color: "#ff5b5b", fontWeight: 900, letterSpacing: "0.08em", textTransform: "uppercase" }}>Cross-Engine Connections</div><div style={{ display: "grid", gap: 10, marginTop: 12 }}>{relatedEdges.map((edge, index) => <div key={`${edge.from || "?"}:${edge.to || "?"}:${index}`} style={inner}><div style={{ color: "#ffdada", fontWeight: 800 }}>{humanize(String(edge.from || "unknown"))} {" -> "} {humanize(String(edge.to || "unknown"))}</div><div style={micro}>{edge.type ? `${edge.type}. ` : ""}{edge.why || "Live engine dependency."}</div>{edge.channel ? <div style={micro}>Channel: {edge.channel}</div> : null}</div>)}</div></div> : null}

          <div style={card}>
            <div style={{ color: "#ff5b5b", fontWeight: 900, letterSpacing: "0.08em", textTransform: "uppercase" }}>Declared Dependencies</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 12, marginTop: 12 }}>
              {[{ label: "Services", value: spec?.hardDependencies?.services?.join(", ") || "None declared" }, { label: "Env Vars", value: spec?.hardDependencies?.envVars?.join(", ") || "None declared" }, { label: "Runtime Flags", value: spec?.hardDependencies?.runtimeFlags?.join(", ") || "None declared" }].map((row) => <div key={row.label} style={inner}><div style={micro}>{row.label}</div><div style={{ color: "#ffdada", fontWeight: 700, marginTop: 6 }}>{row.value}</div></div>)}
            </div>
          </div>

          <div style={card}>
            <div style={{ color: "#ff5b5b", fontWeight: 900, letterSpacing: "0.08em", textTransform: "uppercase" }}>Live Tuning</div>
            <div style={{ ...micro, marginTop: 8 }}>This editor is live-backed. Every field below maps to the real engine config for this guild instead of the old generic shell.</div>
            <div style={{ display: "grid", gap: 14, marginTop: 14 }}>
              {(schema?.groups || []).map((group) => {
                const fields = Array.isArray(group.fields) ? group.fields : [];
                if (!fields.length) return null;
                return <section key={group.key || group.label} style={inner}><div style={{ color: "#ffdada", fontWeight: 900, textTransform: "uppercase", letterSpacing: "0.08em" }}>{group.label || humanize(String(group.key || "group"))}</div><div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 12, marginTop: 12 }}>{fields.map((field) => renderField(field))}</div></section>;
              })}
            </div>
          </div>

          <ConfigJsonEditor
            title="Advanced Security Engine Config"
            value={config}
            disabled={saving}
            hint="Use the full JSON editor if you need deeper structures than the live security form exposes."
            onApply={async (nextValue) => {
              const safeValue = (nextValue && typeof nextValue === "object" ? nextValue : {}) as Record<string, unknown>;
              setConfig(safeValue);
              await applySave(safeValue);
            }}
          />
        </>
      )}
    </section>
  );
}
