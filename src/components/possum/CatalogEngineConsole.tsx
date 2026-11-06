/* eslint-disable @next/next/no-img-element */
"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type ChangeEvent, type CSSProperties } from "react";
import EngineInsights from "@/components/possum/EngineInsights";
import { buildDashboardHref } from "@/lib/dashboardContext";
import { useGuildEngineEditor, type GuildChannel, type GuildRole } from "@/components/possum/useGuildEngineEditor";

type QuickLink = {
  href: string;
  label: string;
};

type CatalogEngineConsoleProps = {
  engineKey: string;
  title: string;
  description: string;
  commandId?: string;
  links?: QuickLink[];
  showHeader?: boolean;
  showInsights?: boolean;
  surfaceVariant?: "default" | "security";
};

type JsonRecord = Record<string, any>;

type EngineField = {
  key?: string;
  type?: string;
  label?: string;
  options?: string[];
  min?: number;
  max?: number;
  step?: number;
  maxLength?: number;
};

type EngineFieldGroup = {
  key?: string;
  label?: string;
  fields?: EngineField[];
};

type EngineFieldSchema = {
  title?: string;
  groups?: EngineFieldGroup[];
};

type LiveEngineSpec = {
  engineKey: string;
  configKey?: string;
  displayName?: string;
  category?: string;
  featureFlag?: string;
  premiumRequired?: boolean;
  privateOnly?: boolean;
  decisionLogic?: string;
  hardDependencies?: {
    services?: string[];
    envVars?: string[];
    runtimeFlags?: string[];
  };
};

const shell: CSSProperties = {
  color: "#ffd0d0",
  padding: 18,
  maxWidth: 1360,
};

const card: CSSProperties = {
  border: "1px solid #5f0000",
  borderRadius: 14,
  padding: 16,
  background: "linear-gradient(180deg, rgba(120,0,0,0.12), rgba(0,0,0,0.72))",
  marginTop: 12,
};

const subtleCard: CSSProperties = {
  border: "1px solid #3d0000",
  borderRadius: 12,
  padding: 12,
  background: "#100000",
};

const input: CSSProperties = {
  width: "100%",
  background: "#0a0a0a",
  color: "#ffd0d0",
  border: "1px solid #7f0000",
  borderRadius: 10,
  padding: "10px 12px",
};

const button: CSSProperties = {
  ...input,
  width: "auto",
  cursor: "pointer",
  fontWeight: 900,
  textTransform: "uppercase",
  letterSpacing: "0.06em",
};

const label: CSSProperties = {
  color: "#ffb9b9",
  fontSize: 12,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  marginBottom: 6,
};

const scrollList: CSSProperties = {
  maxHeight: 220,
  overflowY: "auto",
  border: "1px solid #410000",
  borderRadius: 10,
  padding: 10,
  background: "#090202",
};

function isPlainObject(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function humanize(value: string) {
  return String(value || "")
    .replace(/^security\./, "")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/_/g, " ")
    .replace(/\./g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function updateAtPath(input: any, path: string[], nextValue: any): any {
  if (!path.length) return nextValue;
  const [head, ...rest] = path;
  const source = isPlainObject(input) ? input : {};
  return {
    ...source,
    [head]: rest.length ? updateAtPath(source[head], rest, nextValue) : nextValue,
  };
}

function getAtPath(input: any, path: string[]) {
  return path.reduce((current, segment) => {
    if (!current || typeof current !== "object") return undefined;
    return current[segment];
  }, input);
}

function toggle(list: string[], id: string) {
  const set = new Set((Array.isArray(list) ? list : []).map((value) => String(value || "").trim()).filter(Boolean));
  if (set.has(id)) set.delete(id);
  else set.add(id);
  return Array.from(set);
}

function lines(value: string) {
  return String(value || "")
    .split(/\r?\n+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseNumberish(value: string, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function looksLongText(key: string) {
  return /(message|template|notes|description|intro|footer|content|copy|text|prompt|backstory|logic)/i.test(key);
}

function looksImageField(key: string) {
  return /(image|banner|avatar|artwork|background|thumbnail|icon)url$/i.test(key);
}

function isChannelIdKey(key: string) {
  return /ChannelId$/i.test(key);
}

function isCategoryIdKey(key: string) {
  return /CategoryId$/i.test(key);
}

function isVoiceChannelKey(key: string) {
  return /(voice|stage)/i.test(key) && /ChannelId$/i.test(key);
}

function isRoleIdKey(key: string) {
  return /RoleId$/i.test(key);
}

function isChannelIdsKey(key: string) {
  return /ChannelIds$/i.test(key);
}

function isCategoryIdsKey(key: string) {
  return /CategoryIds$/i.test(key);
}

function isRoleIdsKey(key: string) {
  return /RoleIds$/i.test(key);
}

function getTextChannels(channels: GuildChannel[]) {
  return channels.filter((channel) => Number(channel?.type) === 0 || String(channel?.type || "").toLowerCase().includes("text"));
}

function getVoiceChannels(channels: GuildChannel[]) {
  return channels.filter((channel) => {
    const type = Number(channel?.type);
    const text = String(channel?.type || "").toLowerCase();
    return type === 2 || type === 13 || text.includes("voice") || text.includes("stage");
  });
}

function getCategories(channels: GuildChannel[]) {
  return channels.filter((channel) => Number(channel?.type) === 4 || String(channel?.type || "").toLowerCase().includes("category"));
}

function describeGroup(group: EngineFieldGroup, surfaceVariant: "default" | "security") {
  const key = String(group.key || group.label || "group").toLowerCase();
  if (surfaceVariant === "security") {
    if (key.includes("role")) return { title: "Role Access", help: "Trusted, exempt, notify, and operator escalation roles." };
    if (key.includes("channel")) return { title: "Channel Routing", help: "Alert, review, transcript, and monitored channel bindings." };
    if (key.includes("advanced")) return { title: "Advanced Controls", help: "Deeper logic tuning that affects scoring, escalation, or enforcement behavior." };
    if (key.includes("core")) return { title: "Core Policy", help: "Primary enablement, preset, threshold, and baseline notes." };
  }
  return {
    title: String(group.label || humanize(String(group.key || "group"))),
    help: surfaceVariant === "security"
      ? "Live engine-backed controls for this security runtime section."
      : "Live engine-backed controls for this section.",
  };
}

async function fileToDataUrl(file: File) {
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Image load failed."));
    reader.readAsDataURL(file);
  });
}

function renderIdChecklist({
  values,
  options,
  prefix,
  onToggle,
}: {
  values: string[];
  options: Array<{ id: string; name: string }>;
  prefix: string;
  onToggle: (id: string) => void;
}) {
  if (!options.length) {
    return <div style={{ color: "#ffabab" }}>No matching options available in this guild.</div>;
  }
  return (
    <div style={scrollList}>
      {options.map((option) => (
        <label key={`${prefix}:${option.id}`} style={{ display: "block", marginBottom: 6, color: "#ffd8d8" }}>
          <input type="checkbox" checked={values.includes(option.id)} onChange={() => onToggle(option.id)} /> {option.name}
        </label>
      ))}
    </div>
  );
}

function ChannelWeightListField({
  value,
  channels,
  update,
}: {
  value: any;
  channels: GuildChannel[];
  update: (nextValue: any) => void;
}) {
  const options = getTextChannels(channels);
  const rows = Array.isArray(value)
    ? value.map((entry) =>
        isPlainObject(entry)
          ? {
              channelId: String(entry.channelId || entry.id || ""),
              weight: Number(entry.weight || 1),
            }
          : { channelId: "", weight: 1 }
      )
    : [];

  return (
    <div style={{ display: "grid", gap: 10 }}>
      {rows.map((row, index) => (
        <div key={`${row.channelId || "row"}_${index}`} style={{ display: "grid", gridTemplateColumns: "1fr 140px auto", gap: 10 }}>
          <select
            style={input}
            value={row.channelId}
            onChange={(event) => {
              const next = [...rows];
              next[index] = { ...row, channelId: event.target.value };
              update(next);
            }}
          >
            <option value="">Select channel</option>
            {options.map((channel) => (
              <option key={channel.id} value={channel.id}>
                #{channel.name}
              </option>
            ))}
          </select>
          <input
            style={input}
            type="number"
            min={1}
            value={row.weight}
            onChange={(event) => {
              const next = [...rows];
              next[index] = { ...row, weight: parseNumberish(event.target.value, 1) };
              update(next);
            }}
          />
          <button type="button" style={button} onClick={() => update(rows.filter((_, rowIndex) => rowIndex !== index))}>
            Remove
          </button>
        </div>
      ))}
      <div>
        <button type="button" style={button} onClick={() => update([...rows, { channelId: "", weight: 1 }])}>
          Add Channel
        </button>
      </div>
    </div>
  );
}

function SchemaField({
  field,
  value,
  channels,
  roles,
  update,
}: {
  field: EngineField;
  value: any;
  channels: GuildChannel[];
  roles: GuildRole[];
  update: (nextValue: any) => void;
}) {
  const fieldKey = String(field.key || "");
  const labelText = String(field.label || humanize(fieldKey || "value"));
  const type = String(field.type || "string");
  const textChannels = getTextChannels(channels);
  const voiceChannels = getVoiceChannels(channels);

  if (type === "boolean") {
    return (
      <label style={{ display: "inline-flex", gap: 8, alignItems: "center", color: "#ffdcdc", fontWeight: 700 }}>
        <input type="checkbox" checked={Boolean(value)} onChange={(event) => update(event.target.checked)} /> {labelText}
      </label>
    );
  }

  if (type === "number") {
    return (
      <div>
        <div style={label}>{labelText}</div>
        <input
          style={input}
          type="number"
          min={field.min}
          max={field.max}
          step={field.step}
          value={Number(value ?? field.min ?? 0)}
          onChange={(event) => update(parseNumberish(event.target.value, Number(value ?? field.min ?? 0)))}
        />
      </div>
    );
  }

  if (type === "textarea") {
    return (
      <div>
        <div style={label}>{labelText}</div>
        <textarea style={{ ...input, minHeight: 120 }} value={String(value ?? "")} onChange={(event) => update(event.target.value)} />
      </div>
    );
  }

  if (type === "select") {
    const options = Array.isArray(field.options) ? field.options : [];
    return (
      <div>
        <div style={label}>{labelText}</div>
        <select style={input} value={String(value || "")} onChange={(event) => update(event.target.value)}>
          <option value="">Select</option>
          {options.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </div>
    );
  }

  if (type === "channel-single") {
    const options = /voice/i.test(labelText) ? voiceChannels : textChannels;
    return (
      <div>
        <div style={label}>{labelText}</div>
        <select style={input} value={String(value || "")} onChange={(event) => update(event.target.value)}>
          <option value="">Not set</option>
          {options.map((channel) => (
            <option key={channel.id} value={channel.id}>
              {options === textChannels ? "#" : ""}
              {channel.name}
            </option>
          ))}
        </select>
      </div>
    );
  }

  if (type === "channel-multi") {
    return (
      <div>
        <div style={label}>{labelText}</div>
        {renderIdChecklist({
          values: Array.isArray(value) ? value.map((entry) => String(entry)) : [],
          options: textChannels.map((channel) => ({ id: channel.id, name: `#${channel.name}` })),
          prefix: fieldKey || labelText,
          onToggle: (id) => update(toggle(Array.isArray(value) ? value.map((entry) => String(entry)) : [], id)),
        })}
      </div>
    );
  }

  if (type === "role-single") {
    return (
      <div>
        <div style={label}>{labelText}</div>
        <select style={input} value={String(value || "")} onChange={(event) => update(event.target.value)}>
          <option value="">Not set</option>
          {roles.map((role) => (
            <option key={role.id} value={role.id}>
              @{role.name}
            </option>
          ))}
        </select>
      </div>
    );
  }

  if (type === "role-multi") {
    return (
      <div>
        <div style={label}>{labelText}</div>
        {renderIdChecklist({
          values: Array.isArray(value) ? value.map((entry) => String(entry)) : [],
          options: roles.map((role) => ({ id: role.id, name: `@${role.name}` })),
          prefix: fieldKey || labelText,
          onToggle: (id) => update(toggle(Array.isArray(value) ? value.map((entry) => String(entry)) : [], id)),
        })}
      </div>
    );
  }

  if (type === "string-list") {
    return (
      <div>
        <div style={label}>{labelText}</div>
        <textarea style={{ ...input, minHeight: 120 }} value={Array.isArray(value) ? value.map((entry) => String(entry)).join("\n") : ""} onChange={(event) => update(lines(event.target.value))} />
      </div>
    );
  }

  if (type === "channel-weight-list") {
    return (
      <div>
        <div style={label}>{labelText}</div>
        <ChannelWeightListField value={value} channels={channels} update={update} />
      </div>
    );
  }

  return <ConfigField path={[fieldKey || "value"]} value={value} channels={channels} roles={roles} update={update} />;
}

function ConfigField({
  path,
  value,
  channels,
  roles,
  update,
}: {
  path: string[];
  value: any;
  channels: GuildChannel[];
  roles: GuildRole[];
  update: (nextValue: any) => void;
}) {
  const fieldKey = path[path.length - 1] || "value";
  const title = humanize(fieldKey);
  const textChannels = getTextChannels(channels);
  const voiceChannels = getVoiceChannels(channels);
  const categories = getCategories(channels);

  async function onUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const dataUrl = await fileToDataUrl(file).catch(() => "");
    if (dataUrl) update(dataUrl);
    event.target.value = "";
  }

  if (isPlainObject(value)) {
    const entries = Object.entries(value);
    return (
      <div style={card}>
        <div style={{ ...label, marginBottom: 10 }}>{title}</div>
        <div style={{ display: "grid", gap: 12 }}>
          {entries.length ? (
            entries.map(([nestedKey, nestedValue]) => (
              <ConfigField
                key={`${path.join(".")}:${nestedKey}`}
                path={[...path, nestedKey]}
                value={nestedValue}
                channels={channels}
                roles={roles}
                update={(nextValue) => update(updateAtPath(value, [nestedKey], nextValue))}
              />
            ))
          ) : (
            <div style={{ color: "#ffabab" }}>No nested settings defined.</div>
          )}
        </div>
      </div>
    );
  }

  if (Array.isArray(value)) {
    if (isChannelIdsKey(fieldKey)) {
      return (
        <div>
          <div style={label}>{title}</div>
          {renderIdChecklist({
            values: value.map((entry) => String(entry)),
            options: textChannels.map((entry) => ({ id: entry.id, name: `#${entry.name}` })),
            prefix: path.join("."),
            onToggle: (id) => update(toggle(value.map((entry) => String(entry)), id)),
          })}
        </div>
      );
    }

    if (isCategoryIdsKey(fieldKey)) {
      return (
        <div>
          <div style={label}>{title}</div>
          {renderIdChecklist({
            values: value.map((entry) => String(entry)),
            options: categories.map((entry) => ({ id: entry.id, name: entry.name })),
            prefix: path.join("."),
            onToggle: (id) => update(toggle(value.map((entry) => String(entry)), id)),
          })}
        </div>
      );
    }

    if (isRoleIdsKey(fieldKey)) {
      return (
        <div>
          <div style={label}>{title}</div>
          {renderIdChecklist({
            values: value.map((entry) => String(entry)),
            options: roles.map((entry) => ({ id: entry.id, name: `@${entry.name}` })),
            prefix: path.join("."),
            onToggle: (id) => update(toggle(value.map((entry) => String(entry)), id)),
          })}
        </div>
      );
    }

    if (value.every((entry) => entry === null || ["string", "number", "boolean"].includes(typeof entry))) {
      return (
        <div>
          <div style={label}>{title}</div>
          <textarea style={{ ...input, minHeight: 110 }} value={value.map((entry) => String(entry ?? "")).join("\n")} onChange={(event) => update(lines(event.target.value))} />
        </div>
      );
    }

    return (
      <div>
        <div style={label}>{title}</div>
        <textarea
          style={{ ...input, minHeight: 150, fontFamily: "monospace", fontSize: 12 }}
          value={JSON.stringify(value, null, 2)}
          onChange={(event) => {
            try {
              update(JSON.parse(event.target.value || "[]"));
            } catch {}
          }}
        />
        <div style={{ color: "#ffabab", fontSize: 12, marginTop: 6 }}>Advanced object-list editor. Paste valid JSON to update this list.</div>
      </div>
    );
  }

  if (typeof value === "boolean") {
    return (
      <label style={{ display: "inline-flex", gap: 8, alignItems: "center", color: "#ffdcdc", fontWeight: 700 }}>
        <input type="checkbox" checked={value} onChange={(event) => update(event.target.checked)} /> {title}
      </label>
    );
  }

  if (typeof value === "number") {
    return (
      <div>
        <div style={label}>{title}</div>
        <input style={input} type="number" value={value} onChange={(event) => update(parseNumberish(event.target.value, value))} />
      </div>
    );
  }

  if (typeof value === "string") {
    if (isVoiceChannelKey(fieldKey)) {
      return (
        <div>
          <div style={label}>{title}</div>
          <select style={input} value={value || ""} onChange={(event) => update(event.target.value)}>
            <option value="">Not set</option>
            {voiceChannels.map((channel) => (
              <option key={channel.id} value={channel.id}>
                {channel.name}
              </option>
            ))}
          </select>
        </div>
      );
    }

    if (isCategoryIdKey(fieldKey)) {
      return (
        <div>
          <div style={label}>{title}</div>
          <select style={input} value={value || ""} onChange={(event) => update(event.target.value)}>
            <option value="">Not set</option>
            {categories.map((channel) => (
              <option key={channel.id} value={channel.id}>
                {channel.name}
              </option>
            ))}
          </select>
        </div>
      );
    }

    if (isChannelIdKey(fieldKey)) {
      return (
        <div>
          <div style={label}>{title}</div>
          <select style={input} value={value || ""} onChange={(event) => update(event.target.value)}>
            <option value="">Not set</option>
            {textChannels.map((channel) => (
              <option key={channel.id} value={channel.id}>
                #{channel.name}
              </option>
            ))}
          </select>
        </div>
      );
    }

    if (isRoleIdKey(fieldKey)) {
      return (
        <div>
          <div style={label}>{title}</div>
          <select style={input} value={value || ""} onChange={(event) => update(event.target.value)}>
            <option value="">Not set</option>
            {roles.map((role) => (
              <option key={role.id} value={role.id}>
                @{role.name}
              </option>
            ))}
          </select>
        </div>
      );
    }

    if (/color$/i.test(fieldKey)) {
      return (
        <div>
          <div style={label}>{title}</div>
          <div style={{ display: "grid", gridTemplateColumns: "80px 1fr", gap: 10 }}>
            <input style={{ ...input, padding: 4 }} type="color" value={value || "#ff3131"} onChange={(event) => update(event.target.value)} />
            <input style={input} value={value || ""} onChange={(event) => update(event.target.value)} />
          </div>
        </div>
      );
    }

    if (looksImageField(fieldKey)) {
      return (
        <div>
          <div style={label}>{title}</div>
          <input style={input} value={value || ""} onChange={(event) => update(event.target.value)} />
          <input style={{ marginTop: 8 }} type="file" accept="image/*" onChange={onUpload} />
          {value ? (
            <div style={{ marginTop: 10 }}>
              <img src={value} alt={title} style={{ maxWidth: "100%", maxHeight: 180, borderRadius: 10, border: "1px solid #440000" }} />
            </div>
          ) : null}
        </div>
      );
    }

    if (looksLongText(fieldKey)) {
      return (
        <div>
          <div style={label}>{title}</div>
          <textarea style={{ ...input, minHeight: 120 }} value={value || ""} onChange={(event) => update(event.target.value)} />
        </div>
      );
    }

    return (
      <div>
        <div style={label}>{title}</div>
        <input style={input} value={value || ""} onChange={(event) => update(event.target.value)} />
      </div>
    );
  }

  return null;
}

export default function CatalogEngineConsole({
  engineKey,
  title,
  description,
  commandId = "",
  links = [],
  showHeader = true,
  showInsights = true,
  surfaceVariant = "default",
}: CatalogEngineConsoleProps) {
  const [spec, setSpec] = useState<LiveEngineSpec | null>(null);
  const [fieldSchema, setFieldSchema] = useState<EngineFieldSchema | null>(null);
  const {
    guildId,
    guildName,
    config,
    setConfig,
    channels,
    roles,
    summary,
    details,
    loading,
    saving,
    message,
    save,
    reload,
    runAction,
  } = useGuildEngineEditor<JsonRecord>(engineKey, {});

  useEffect(() => {
    if (!guildId) return;
    let cancelled = false;

    (async () => {
      const res = await fetch(`/api/bot/engine-catalog?guildId=${encodeURIComponent(guildId)}&engine=${encodeURIComponent(engineKey)}`, {
        cache: "no-store",
      });
      const json = await res.json().catch(() => ({}));
      if (cancelled || !res.ok || json?.success === false) return;

      const specs: LiveEngineSpec[] = Array.isArray(json?.engineSpecs) ? (json.engineSpecs as LiveEngineSpec[]) : [];
      const found =
        specs.find((entry: LiveEngineSpec) => String(entry?.engineKey || "").trim() === engineKey) ||
        specs.find((entry: LiveEngineSpec) => String(entry?.configKey || "").trim() === engineKey) ||
        null;

      setSpec(found);
      setFieldSchema(json?.fieldSchema && typeof json.fieldSchema === "object" ? json.fieldSchema : null);
    })().catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [engineKey, guildId]);

  const entries = Object.entries(config || {});
  const groupedSchema = useMemo(
    () => (Array.isArray(fieldSchema?.groups) ? fieldSchema.groups.filter((group) => Array.isArray(group?.fields) && group.fields.length) : []),
    [fieldSchema]
  );

  async function handleRuntimeAction(action: "enable" | "disable") {
    await runAction(action);
  }

  async function handleReset() {
    if (typeof window !== "undefined") {
      const confirmed = window.confirm("Reset this live engine back to its baseline config for the selected guild?");
      if (!confirmed) return;
    }
    await runAction("resetConfig");
  }

  if (!guildId) {
    return <div style={{ ...shell, color: "#ff8080" }}>Missing guildId. Open from /guilds first.</div>;
  }

  return (
    <section style={shell}>
      {showHeader ? (
        <div style={card}>
          <div style={{ ...label, marginBottom: 8 }}>Live Engine Surface</div>
          <div style={{ color: "#ff4545", fontSize: 24, fontWeight: 900, textTransform: "uppercase", letterSpacing: "0.10em" }}>
            {title || spec?.displayName || humanize(engineKey)}
          </div>
          <div style={{ color: "#ffabab", marginTop: 8 }}>
            Guild: <b>{guildName || guildId}</b>
            {commandId ? (
              <>
                {" "}
                | Commands: <b>{commandId}</b>
              </>
            ) : null}
          </div>
          <div style={{ color: "#ffd0d0", lineHeight: 1.7, marginTop: 10 }}>
            {description || spec?.decisionLogic || "This page writes directly into the live engine config for the selected guild."}
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
            {links.map((item) => (
              <Link key={item.href} href={buildDashboardHref(item.href)} style={{ ...button, textDecoration: "none" }}>
                {item.label}
              </Link>
            ))}
          </div>
        </div>
      ) : null}

      {message ? <div style={{ marginTop: 10, color: "#ffb3f0" }}>{message}</div> : null}

      {loading ? (
        <div style={card}>Loading engine runtime...</div>
      ) : (
        <>
          {showInsights ? <EngineInsights summary={summary} details={details} /> : null}

          <div style={{ ...card, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            <button type="button" onClick={() => void handleRuntimeAction("enable")} disabled={saving} style={button}>
              {spec?.featureFlag ? "Enable Engine & Feature" : "Enable Engine"}
            </button>
            <button type="button" onClick={() => void handleRuntimeAction("disable")} disabled={saving} style={button}>
              {spec?.featureFlag ? "Disable Engine & Feature" : "Disable Engine"}
            </button>
            <button type="button" onClick={() => void reload()} disabled={saving || loading} style={button}>
              Reload Runtime
            </button>
            <button type="button" onClick={() => void handleReset()} disabled={saving} style={button}>
              Reset To Baseline
            </button>
            <button type="button" onClick={() => void save()} disabled={saving} style={button}>
              {saving ? "Saving..." : surfaceVariant === "security" ? "Save Security Engine" : "Save Engine"}
            </button>
            <div style={{ color: "#ffbcbc", lineHeight: 1.7, flex: "1 1 320px" }}>
              {surfaceVariant === "security"
                ? "These controls write to the live security runtime path. Save validates first; enable and disable also synchronize the linked guild feature gate."
                : "These controls write to the live engine runtime path. Save validates first; enable and disable also synchronize the linked guild feature gate when this engine has one."}
            </div>
          </div>

          {groupedSchema.length
            ? groupedSchema.map((group) => (
                <div key={String(group.key || group.label || "group")} style={card}>
                  <div style={{ ...label, marginBottom: 10 }}>{describeGroup(group, surfaceVariant).title}</div>
                  <div style={{ color: "#ffbcbc", marginBottom: 12, lineHeight: 1.6 }}>{describeGroup(group, surfaceVariant).help}</div>
                  <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))" }}>
                    {(group.fields || []).map((field) => {
                      const path = String(field.key || "")
                        .split(".")
                        .map((part) => part.trim())
                        .filter(Boolean);
                      if (!path.length) return null;
                      return (
                        <div key={path.join(".")} style={subtleCard}>
                          <SchemaField
                            field={field}
                            value={getAtPath(config, path)}
                            channels={channels}
                            roles={roles}
                            update={(nextValue) => setConfig((prev) => updateAtPath(prev, path, nextValue))}
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))
            : entries.length
              ? entries.map(([key, value]) => (
                  <div key={key} style={card}>
                    <ConfigField
                      path={[key]}
                      value={value}
                      channels={channels}
                      roles={roles}
                      update={(nextValue) => setConfig((prev) => updateAtPath(prev, [key], nextValue))}
                    />
                  </div>
                ))
              : (
                <div style={card}>
                  <div style={{ color: "#ffbcbc" }}>No engine-specific overrides are saved yet. Save once to create the live runtime config for this guild.</div>
                </div>
              )}

          <div style={{ ...card, display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <div style={{ color: "#ffbcbc", lineHeight: 1.7 }}>
              {spec?.premiumRequired ? "Premium engine." : "Standard engine."}
              {spec?.privateOnly ? " Private-only surface." : ""}
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button type="button" onClick={() => void reload()} disabled={saving || loading} style={button}>
                Reload Runtime
              </button>
              <button type="button" onClick={() => void save()} disabled={saving} style={button}>
                {saving ? "Saving..." : surfaceVariant === "security" ? "Save Security Engine" : "Save Engine"}
              </button>
            </div>
          </div>
        </>
      )}
    </section>
  );
}
