"use client";

// Everything Server Setup connected or created, grouped by system: logging,
// feature channels, categories, roles and panel channels. Each entry can be
// pointed at a different existing channel, category or role and saved to
// that system's settings. Nothing here creates or deletes Discord resources.

import { useCallback, useEffect, useMemo, useState } from "react";
import { readDashboardUserId } from "@/lib/dashboardContext";

type Resource = { id: string; name: string; kind?: string; parentId?: string; managed?: boolean };

type Proposal = {
  id: string;
  engine: string;
  engineLabel?: string;
  field: string;
  status: string;
  resourceType?: string;
  many?: boolean;
  protectedFlow?: boolean;
  intendedName?: string;
  currentValue?: unknown;
};

type PanelGuide = { id: string; engine?: string; label: string; href: string; resourceId?: string | null; configured: boolean };

type Report = {
  guildId?: string;
  proposals?: Proposal[];
  panelGuides?: PanelGuide[];
  allEngines?: { engine: string; label: string; href?: string }[];
  createdResources?: { id: string }[];
  directory?: { categories?: Resource[]; channels?: Resource[]; roles?: Resource[] };
};

type Row = {
  key: string;
  engine: string;
  system: string;
  field: string;
  label: string;
  resourceType: "channel" | "category" | "role";
  ids: string[];
  editable: boolean;
  createdBySetup: boolean;
  href?: string;
};

const LOG_PATTERN = /(log|audit|transcript)/i;

function idsOf(value: unknown): string[] {
  const list = Array.isArray(value) ? value : [value];
  return list.map((entry) => entry && typeof entry === "object" ? String((entry as { id?: string }).id || "") : String(entry || ""))
    .filter((entry) => /^\d{16,20}$/.test(entry));
}

function writePath(input: Record<string, unknown>, path: string[], value: unknown) {
  const next: Record<string, unknown> = { ...(input || {}) };
  let cursor: Record<string, unknown> = next;
  for (let index = 0; index < path.length - 1; index += 1) {
    const key = path[index];
    const child = cursor[key];
    cursor[key] = child && typeof child === "object" && !Array.isArray(child) ? { ...(child as Record<string, unknown>) } : {};
    cursor = cursor[key] as Record<string, unknown>;
  }
  cursor[path[path.length - 1]] = value;
  return next;
}

async function readJson(response: Response) {
  const json = await response.json().catch(() => ({}));
  if (!response.ok || json?.success === false) throw new Error(json?.error || `Request failed (${response.status}).`);
  return json;
}

export default function SetupConnections({ guildId }: { guildId: string }) {
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState("");
  const [open, setOpen] = useState(true);

  const load = useCallback(async () => {
    if (!guildId) return;
    setError("");
    try {
      const params = new URLSearchParams({ guildId });
      const userId = readDashboardUserId();
      if (userId) params.set("userId", userId);
      const json = await readJson(await fetch(`/api/bot/infrastructure?${params.toString()}`, { cache: "no-store" }));
      const next = json.report as Report | undefined;
      if (next?.guildId && next.guildId !== guildId) throw new Error("The setup report belonged to a different server and was discarded.");
      setReport(next || null);
      setDrafts({});
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not read what setup connected.");
    }
  }, [guildId]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const directory = report?.directory;
  const byId = useMemo(() => {
    const map = new Map<string, Resource>();
    for (const row of directory?.categories || []) map.set(row.id, { ...row, kind: "category" });
    for (const row of directory?.channels || []) map.set(row.id, row);
    for (const row of directory?.roles || []) map.set(row.id, { ...row, kind: "role" });
    return map;
  }, [directory]);

  const rows = useMemo(() => {
    const pages = new Map((report?.allEngines || []).map((entry) => [entry.engine, entry]));
    const created = new Set((report?.createdResources || []).map((entry) => String(entry.id)));
    const out: Row[] = [];
    const seen = new Set<string>();
    for (const proposal of report?.proposals || []) {
      if (proposal.protectedFlow || proposal.status !== "populated") continue;
      const ids = idsOf(proposal.currentValue);
      if (!ids.length) continue;
      const type = proposal.resourceType === "role" ? "role" : proposal.resourceType === "category" ? "category" : "channel";
      seen.add(proposal.id);
      out.push({
        key: proposal.id,
        engine: proposal.engine,
        system: LOG_PATTERN.test(proposal.field) && type === "channel" ? "Logging" : proposal.engineLabel || pages.get(proposal.engine)?.label || proposal.engine,
        field: proposal.field,
        label: proposal.intendedName || proposal.field,
        resourceType: type,
        ids,
        editable: !proposal.many && !proposal.field.includes("[]") && !/^panel:/.test(proposal.field),
        createdBySetup: ids.some((id) => created.has(id)),
        href: pages.get(proposal.engine)?.href,
      });
    }
    for (const guide of report?.panelGuides || []) {
      if (!guide.configured || !guide.resourceId || seen.has(guide.id) || !guide.engine) continue;
      const field = guide.id.slice(guide.engine.length + 1);
      out.push({
        key: guide.id,
        engine: guide.engine,
        system: "Panels",
        field,
        label: guide.label,
        resourceType: "channel",
        ids: [String(guide.resourceId)],
        editable: !/^panel:/.test(field) && !field.endsWith("ChannelIds"),
        createdBySetup: created.has(String(guide.resourceId)),
        href: guide.href,
      });
    }
    return out;
  }, [report]);

  const groups = useMemo(() => {
    const map = new Map<string, Row[]>();
    for (const row of rows) map.set(row.system, [...(map.get(row.system) || []), row]);
    return [...map.entries()].sort(([left], [right]) =>
      (left === "Logging" ? -2 : left === "Panels" ? -1 : 0) - (right === "Logging" ? -2 : right === "Panels" ? -1 : 0) || left.localeCompare(right));
  }, [rows]);

  function optionsFor(type: Row["resourceType"]) {
    if (type === "role") return (directory?.roles || []).filter((role) => !role.managed && role.name !== "@everyone");
    if (type === "category") return directory?.categories || [];
    return (directory?.channels || []).filter((channel) => ["text", "announcement", undefined, ""].includes(channel.kind));
  }

  function nameOf(id: string, type: Row["resourceType"]) {
    const resource = byId.get(id);
    if (!resource) return "Not found in the last scan";
    return type === "role" ? `@${resource.name}` : type === "category" ? resource.name : `#${resource.name}`;
  }

  async function save(row: Row) {
    const nextId = drafts[row.key];
    if (!nextId || nextId === row.ids[0]) return;
    setSaving(row.key);
    setError("");
    setNotice("");
    try {
      const query = new URLSearchParams({ guildId, engine: row.engine });
      const current = await readJson(await fetch(`/api/bot/engine-config?${query.toString()}`, { cache: "no-store" }));
      const config = writePath((current?.config || {}) as Record<string, unknown>, row.field.split("."), nextId);
      await readJson(await fetch("/api/bot/engine-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ guildId, engine: row.engine, config }),
      }));
      setNotice(`${row.label} now uses ${nameOf(nextId, row.resourceType)}.`);
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save that change.");
    } finally {
      setSaving("");
    }
  }

  if (!guildId) return null;

  return (
    <section className="mb-4 rounded-xl border border-pink-800/50 bg-black/50 p-4 text-pink-50">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-black uppercase text-pink-100">Connected by Possum setup</h2>
          <p className="mt-1 max-w-3xl text-sm text-pink-100/70">Every channel, category and role Server Setup connected or created, grouped by system, with your log channels first. Pick a different one and save to move a system; nothing is created or deleted here.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <a href="/dashboard/server-setup" className="inline-flex min-h-10 items-center rounded-lg border border-white/15 px-3 text-xs font-bold">Open Guided setup</a>
          <button type="button" onClick={() => setOpen(!open)} className="min-h-10 rounded-lg border border-white/15 px-3 text-xs font-bold">{open ? "Collapse" : `Show ${rows.length}`}</button>
        </div>
      </div>
      {error ? <p role="alert" className="mt-3 rounded-lg border border-red-700/60 bg-red-950/50 p-2 text-sm text-red-100">{error}</p> : null}
      {notice ? <p role="status" className="mt-3 rounded-lg border border-emerald-700/50 bg-emerald-950/30 p-2 text-sm text-emerald-100">{notice}</p> : null}
      {open && report && !rows.length ? (
        <p className="mt-3 text-sm text-pink-100/70">Nothing has been connected yet. Run Guided setup to connect or build your channels and roles; they will be listed here.</p>
      ) : null}
      {open ? (
        <div className="mt-3 space-y-3">
          {groups.map(([system, entries]) => (
            <div key={system} className="rounded-lg border border-white/10 p-3">
              <h3 className="text-sm font-black uppercase text-pink-200">{system}</h3>
              <ul className="mt-2 divide-y divide-white/5">
                {entries.map((row) => (
                  <li key={row.key} className="grid gap-2 py-2 md:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)_auto] md:items-center">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold">{row.label}</p>
                      <p className="text-xs text-pink-100/60">
                        {row.ids.map((id) => nameOf(id, row.resourceType)).join(", ")}
                        {row.createdBySetup ? " · created by Possum" : " · connected"}
                        {row.system === "Logging" || row.system === "Panels" ? ` · ${row.engine}` : ""}
                      </p>
                    </div>
                    {row.editable ? (
                      <select aria-label={`New destination for ${row.label}`} value={drafts[row.key] || row.ids[0]}
                        onChange={(event) => setDrafts((current) => ({ ...current, [row.key]: event.target.value }))}
                        className="min-h-10 w-full rounded-md border border-pink-900/50 bg-black px-2 text-sm text-pink-50">
                        {optionsFor(row.resourceType).map((resource) => (
                          <option key={resource.id} value={resource.id}>{row.resourceType === "role" ? `@${resource.name}` : row.resourceType === "category" ? resource.name : `#${resource.name}`}</option>
                        ))}
                      </select>
                    ) : (
                      <p className="text-xs text-pink-100/55">Several destinations. Change them on the system&apos;s page.</p>
                    )}
                    <div className="flex gap-2">
                      {row.editable ? (
                        <button type="button" disabled={saving === row.key || !drafts[row.key] || drafts[row.key] === row.ids[0]} onClick={() => void save(row)}
                          className="min-h-10 rounded-lg border border-pink-500/60 px-3 text-xs font-black uppercase disabled:opacity-40">{saving === row.key ? "Saving…" : "Save"}</button>
                      ) : null}
                      {row.href ? <a href={row.href} className="inline-flex min-h-10 items-center rounded-lg border border-white/15 px-3 text-xs font-bold">Open</a> : null}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}
