"use client";

import { useEffect, useMemo, useState } from "react";
import { readDashboardGuildId, readDashboardUserId } from "@/lib/dashboardContext";

type DirectoryRow = { id: string; name: string; kind?: string; parentId?: string; botPermissions?: { status?: string; flags?: string[] } };
type Proposal = {
  id: string;
  engine: string;
  field: string;
  status: string;
  reason: string;
  suggestedName?: string;
  suggestedId?: string;
  matches?: { id: string; name: string }[];
  protectedFlow?: boolean;
};
type Finding = {
  severity: string;
  problemKind?: string;
  engine: string;
  field: string;
  resourceType?: string;
  flexible?: boolean;
  protectedFlow?: boolean;
  message: string;
  recommendation?: string;
};
type Report = {
  ready?: boolean;
  reason?: string;
  healthScore?: number;
  counts?: { critical: number; warning: number; notice: number; optional?: number; healthy: number };
  issues?: Finding[];
  findings?: Finding[];
  engines?: { engine: string; status: string; critical: number; warning: number; href: string }[];
  events?: { at: string; type: string; message: string }[];
  onboarding?: { status?: string; choices?: string[] } | null;
  proposals?: Proposal[];
  settings?: { mode: string; repairEnabled: boolean };
  createdResources?: { id: string; engine: string; field: string }[];
  directory?: { categories: DirectoryRow[]; channels: DirectoryRow[]; roles: DirectoryRow[] };
};

async function loadReport(guildId: string, userId: string) {
  const response = await fetch(`/api/bot/infrastructure?guildId=${encodeURIComponent(guildId)}&userId=${encodeURIComponent(userId)}`, { cache: "no-store" });
  return response.json();
}

export default function InfrastructureClient() {
  const [guildId, setGuildId] = useState("");
  const [userId, setUserId] = useState("");
  const [report, setReport] = useState<Report | null>(null);
  const [query, setQuery] = useState("");
  const [message, setMessage] = useState("");
  const [routes, setRoutes] = useState<Record<string, string>>({});
  const [choices, setChoices] = useState<Record<string, string>>({});
  const [confirm, setConfirm] = useState<"setup" | "repair" | "">("");

  useEffect(() => {
    const nextGuild = readDashboardGuildId();
    const nextUser = readDashboardUserId();
    setGuildId(nextGuild);
    setUserId(nextUser);
    if (!nextGuild) return;
    loadReport(nextGuild, nextUser).then((json) => setReport(json?.report || null)).catch((error) => setMessage(error.message));
  }, []);

  async function post(body: Record<string, unknown>) {
    setMessage("");
    const response = await fetch("/api/bot/infrastructure", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ guildId, userId, ...body }),
    });
    const json = await response.json();
    if (!response.ok || json?.success === false) {
      setMessage(json?.error || "Request failed");
      return;
    }
    const refreshed = await loadReport(guildId, userId);
    setReport(refreshed?.report || null);
    setMessage("Saved.");
  }

  async function download(format: "json" | "csv" | "txt") {
    const response = await fetch(`/api/bot/infrastructure?guildId=${encodeURIComponent(guildId)}&userId=${encodeURIComponent(userId)}&export=1&format=${format}`, { cache: "no-store" });
    const json = await response.json();
    const body = json?.export?.body || "";
    const blob = new Blob([body], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `possum-directory.${format}`;
    link.click();
    URL.revokeObjectURL(url);
  }

  const rows = useMemo(() => {
    const directory = report?.directory;
    const all = [
      ...(directory?.categories || []).map((row) => ({ ...row, kind: "category" })),
      ...(directory?.channels || []),
      ...(directory?.roles || []).map((row) => ({ ...row, kind: "role" })),
    ];
    const needle = query.trim().toLowerCase();
    return needle ? all.filter((row) => `${row.name} ${row.id} ${row.kind || ""}`.toLowerCase().includes(needle)) : all;
  }, [report, query]);

  return (
    <div className="space-y-4">
      <section className="rounded-xl border possum-divider bg-black/50 p-4 possum-border">
        <p className="text-xs uppercase tracking-[0.22em] possum-soft">Infrastructure</p>
        <h1 className="mt-1 text-2xl font-black uppercase tracking-[0.08em] possum-red">Server Directory</h1>
        <p className="mt-2 text-sm text-red-100/80">Health {report?.healthScore ?? "—"} · Critical {report?.counts?.critical ?? 0} · Warning {report?.counts?.warning ?? 0} · Optional {report?.counts?.optional ?? report?.counts?.notice ?? 0}</p>
        {report?.onboarding?.status === "needs-choice" ? (
          <p className="mt-2 text-sm text-pink-100">This server was just discovered. Choose Auto-Adapt to use channels that already exist, or Full Setup and then confirm before Possum creates anything.</p>
        ) : null}
        <p className="mt-2 text-sm text-pink-100/80">{report?.ready ? `Observed by ${report ? "" : ""}the saved scan.` : report?.reason || "Scan the server to build a read-only directory."}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" className="possum-btn rounded-lg bg-black/40 px-3 py-2 text-sm font-black uppercase" onClick={() => post({ action: "scan" })}>Scan</button>
          <button type="button" className="possum-btn rounded-lg bg-black/40 px-3 py-2 text-sm font-black uppercase" onClick={() => post({ action: "settings", mode: "discovery" })}>Discovery</button>
          <button type="button" className="possum-btn rounded-lg bg-black/40 px-3 py-2 text-sm font-black uppercase" onClick={() => post({ action: "adapt" })}>Auto-Adapt</button>
          <button type="button" className="possum-btn rounded-lg bg-black/40 px-3 py-2 text-sm font-black uppercase" onClick={() => post({ action: "settings", mode: "full-setup" })}>Full Setup</button>
          <button type="button" className="possum-btn rounded-lg bg-black/40 px-3 py-2 text-sm font-black uppercase" onClick={() => { setConfirm(""); post({ action: "settings", repairEnabled: !report?.settings?.repairEnabled }); }}>Repair {report?.settings?.repairEnabled ? "On" : "Off"}</button>
          <button type="button" className="possum-btn rounded-lg bg-black/40 px-3 py-2 text-sm font-black uppercase" onClick={() => setConfirm("setup")}>Confirm Full Setup</button>
          <button type="button" className="possum-btn rounded-lg bg-black/40 px-3 py-2 text-sm font-black uppercase" onClick={() => setConfirm("repair")}>Confirm Repair</button>
          <button type="button" className="possum-btn rounded-lg bg-black/40 px-3 py-2 text-sm font-black uppercase" onClick={() => download("json")}>JSON</button>
          <button type="button" className="possum-btn rounded-lg bg-black/40 px-3 py-2 text-sm font-black uppercase" onClick={() => download("csv")}>CSV</button>
          <button type="button" className="possum-btn rounded-lg bg-black/40 px-3 py-2 text-sm font-black uppercase" onClick={() => download("txt")}>TXT</button>
        </div>
        {confirm === "setup" ? (
          <div className="mt-3 rounded-lg border border-pink-800/50 p-3">
            <p className="text-sm text-pink-100">Full setup creates at most five missing categories or channels. Staff and security logs are private. Protected engines are skipped. Nothing is deleted.</p>
            <button type="button" className="possum-btn mt-2 rounded-md px-2 py-1 text-xs font-black uppercase" onClick={() => { setConfirm(""); post({ action: "provision", confirmed: true }); }}>Create approved resources</button>
          </div>
        ) : null}
        {confirm === "repair" ? (
          <div className="mt-3 rounded-lg border border-pink-800/50 p-3">
            <p className="text-sm text-pink-100">Repair only recreates channels Possum recorded, and only while the repair toggle is on. Other channels stay untouched.</p>
            <button type="button" className="possum-btn mt-2 rounded-md px-2 py-1 text-xs font-black uppercase" onClick={() => { setConfirm(""); post({ action: "repair", confirmed: true }); }}>Recreate recorded resources</button>
          </div>
        ) : null}
        <p className="mt-2 text-xs text-red-200/70">Mode {report?.settings?.mode || "discovery"}. Protected onboarding, verification, pre-onboarding, and heist fields stay suggestion-only.</p>
        {message ? <p className="mt-2 text-sm text-pink-200">{message}</p> : null}
      </section>

      <section className="rounded-xl border possum-divider bg-black/50 p-4 possum-border">
        <h2 className="text-lg font-black uppercase text-red-200">Engines</h2>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {(report?.engines || []).filter((engine) => engine.status !== "ready").slice(0, 24).map((engine) => (
            <a key={engine.engine} href={engine.href} className="rounded-lg border border-red-900/40 px-3 py-2">
              <p className="text-sm font-bold text-red-100">{engine.engine}</p>
              <p className="text-xs uppercase tracking-[0.14em] text-pink-200">{engine.status} · critical {engine.critical} · warning {engine.warning}</p>
            </a>
          ))}
        </div>
      </section>

      <section className="rounded-xl border possum-divider bg-black/50 p-4 possum-border">
        <h2 className="text-lg font-black uppercase text-red-200">Operations</h2>
        <div className="mt-3 space-y-2">
          {(report?.events || []).slice(0, 12).map((event) => (
            <p key={`${event.at}-${event.type}-${event.message}`} className="text-xs text-red-100/80">{event.type} · {event.message}</p>
          ))}
        </div>
      </section>

      <section className="rounded-xl border possum-divider bg-black/50 p-4 possum-border">
        <h2 className="text-lg font-black uppercase text-red-200">Directory</h2>
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search channels, categories, roles, or IDs" className="mt-3 w-full rounded-lg border possum-divider bg-black/60 px-3 py-2 text-sm text-red-50" />
        <div className="mt-3 space-y-2">
          {rows.map((row) => (
            <div key={`${row.kind}-${row.id}`} className="flex items-center justify-between gap-3 rounded-lg border border-pink-900/40 px-3 py-2">
              <div>
                <p className="text-sm font-bold text-pink-100">{row.name}</p>
                <p className="text-xs uppercase tracking-[0.14em] text-red-300/80">{row.kind} · {row.id}{row.parentId ? ` · parent ${row.parentId}` : ""}</p>
                <p className="text-xs text-red-100/70">{row.botPermissions?.flags?.length ? row.botPermissions.flags.join(", ") : row.botPermissions?.status || "role"}{report?.createdResources?.some((resource) => resource.id === row.id) ? " · Possum created" : ""}</p>
              </div>
              <button type="button" className="possum-btn rounded-md px-2 py-1 text-xs font-black uppercase" onClick={() => navigator.clipboard?.writeText(row.id)}>Copy ID</button>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-xl border possum-divider bg-black/50 p-4 possum-border">
        <h2 className="text-lg font-black uppercase text-red-200">Health</h2>
        <div className="mt-3 space-y-2">
          {(report?.findings || report?.issues || []).slice(0, 40).map((finding) => (
            <div key={`${finding.problemKind}-${finding.engine}-${finding.field}-${finding.message}`} className="rounded-lg border border-red-900/40 px-3 py-2">
              <p className="text-xs uppercase tracking-[0.14em] text-pink-200">{finding.severity} · {finding.problemKind}</p>
              <p className="text-sm font-bold text-red-100">{finding.engine}.{finding.field}</p>
              <p className="text-xs text-red-100/80">{finding.message}</p>
              <p className="text-xs text-pink-100/80">{finding.recommendation}</p>
              {finding.flexible && finding.severity !== "ignored" ? (
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <button type="button" className="possum-btn rounded-md px-2 py-1 text-xs font-black uppercase" onClick={() => post({ action: "decide", engine: finding.engine, field: finding.field, decision: "ignore" })}>Turn off</button>
                  {finding.protectedFlow ? null : (
                    <>
                      <select className="rounded-md border border-red-900/50 bg-black px-2 py-1 text-xs text-red-100" value={routes[`${finding.engine}:${finding.field}`] || ""} onChange={(event) => setRoutes((current) => ({ ...current, [`${finding.engine}:${finding.field}`]: event.target.value }))}>
                        <option value="">Point at an existing {finding.resourceType || "resource"}</option>
                        {(finding.resourceType === "role" ? report?.directory?.roles || [] : [...(report?.directory?.categories || []), ...(report?.directory?.channels || [])]).map((row) => (
                          <option key={row.id} value={row.id}>{row.name}</option>
                        ))}
                      </select>
                      <button type="button" className="possum-btn rounded-md px-2 py-1 text-xs font-black uppercase" onClick={() => post({ action: "decide", engine: finding.engine, field: finding.field, decision: "reroute", channelId: routes[`${finding.engine}:${finding.field}`] || "" })}>Use this</button>
                    </>
                  )}
                </div>
              ) : null}
              {finding.severity === "ignored" ? (
                <button type="button" className="possum-btn mt-2 rounded-md px-2 py-1 text-xs font-black uppercase" onClick={() => post({ action: "decide", engine: finding.engine, field: finding.field, decision: "clear" })}>Turn back on</button>
              ) : null}
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-xl border possum-divider bg-black/50 p-4 possum-border">
        <div className="mt-3 space-y-2">
          {(report?.proposals || []).filter((proposal) => proposal.status !== "populated").slice(0, 40).map((proposal) => (
            <div key={proposal.id} className="rounded-lg border border-red-900/40 px-3 py-2">
              <p className="text-sm font-bold text-red-100">{proposal.engine}.{proposal.field}</p>
              <p className="text-xs text-pink-100/80">{proposal.status} · {proposal.reason}</p>
              {proposal.status === "ready" ? (
                <button type="button" className="possum-btn mt-2 rounded-md px-2 py-1 text-xs font-black uppercase" onClick={() => post({ action: "approve", proposalIds: [proposal.id] })}>Approve empty field</button>
              ) : null}
              {proposal.status === "ambiguous" && proposal.matches?.length ? (
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <select className="rounded-md border border-red-900/50 bg-black px-2 py-1 text-xs text-red-100" value={choices[proposal.id] || ""} onChange={(event) => setChoices((current) => ({ ...current, [proposal.id]: event.target.value }))}>
                    <option value="">Choose a match</option>
                    {proposal.matches.map((match) => <option key={match.id} value={match.id}>{match.name}</option>)}
                  </select>
                  <button type="button" className="possum-btn rounded-md px-2 py-1 text-xs font-black uppercase" onClick={() => post({ action: "approve", proposalIds: [proposal.id], selections: { [proposal.id]: choices[proposal.id] || "" } })}>Use this match</button>
                </div>
              ) : null}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
