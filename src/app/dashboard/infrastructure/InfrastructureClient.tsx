"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
type AdaptRow = { id: string; engine: string; field: string; resourceId: string; resourceName: string };
type AdaptPreview = { wrote?: boolean; planned?: AdaptRow[]; skipped?: { id: string; reason: string }[]; reason?: string };

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
  setup?: { configured: number; missing: number; needsAttention: number; readyForApproval: number };
  createdResources?: { id: string; engine: string; field: string }[];
  directory?: { categories: DirectoryRow[]; channels: DirectoryRow[]; roles: DirectoryRow[] };
};

type Notice = { tone: "ok" | "err"; text: string };
type PendingWrite = { title: string; detail: string; confirmLabel: string; body: Record<string, unknown> };

async function loadReport(guildId: string, userId: string) {
  const response = await fetch(`/api/bot/infrastructure?guildId=${encodeURIComponent(guildId)}&userId=${encodeURIComponent(userId)}`, { cache: "no-store" });
  return response.json();
}

function describeResult(body: Record<string, unknown>, json: { result?: Record<string, unknown>; report?: Report; record?: { mode?: string; repairEnabled?: boolean } }): string {
  const action = String(body.action || "");
  const result = json.result || {};
  const report = json.report;
  if (action === "scan") {
    return `Scan finished. Health ${report?.healthScore ?? "—"}. Critical ${report?.counts?.critical ?? 0}. Warning ${report?.counts?.warning ?? 0}. Configured ${report?.setup?.configured ?? 0}. Missing ${report?.setup?.missing ?? 0}. Needs attention ${report?.setup?.needsAttention ?? 0}. No engine configuration was written.`;
  }
  if (action === "settings") {
    if (Object.prototype.hasOwnProperty.call(body, "repairEnabled")) return `Repair is now ${body.repairEnabled ? "on" : "off"}. No Discord resources were changed.`;
    return `Mode is now ${String(body.mode || json.record?.mode || "discovery")}. Nothing was created.`;
  }
  if (action === "adapt" && body.confirmed === true) {
    const applied = Array.isArray(result.applied) ? result.applied.length : 0;
    const skipped = Array.isArray(result.skipped) ? result.skipped.length : 0;
    return String(result.reason || `Applied ${applied} empty mapping${applied === 1 ? "" : "s"}. Skipped ${skipped}. Configuration write: ${result.wrote === true ? "yes" : "no"}.`);
  }
  if (action === "provision") {
    const created = Array.isArray(result.created) ? result.created.length : 0;
    const deferred = Array.isArray(result.deferred) ? result.deferred.length : 0;
    return String(result.message || `Full setup created ${created} resource${created === 1 ? "" : "s"}. Deferred ${deferred}.`);
  }
  if (action === "repair") {
    const repaired = Array.isArray(result.repaired) ? result.repaired.length : 0;
    return String(result.message || `Repair recreated ${repaired} recorded resource${repaired === 1 ? "" : "s"}.`);
  }
  if (action === "approve") {
    const applied = Array.isArray(result.applied) ? result.applied.length : 0;
    const skipped = Array.isArray(result.skipped) ? result.skipped.length : 0;
    return `Approved ${applied} empty field${applied === 1 ? "" : "s"}. Skipped ${skipped}. Populated IDs were left unchanged.`;
  }
  if (action === "decide") return String(result.reason || `Saved field decision ${String(result.action || body.decision || "")}.`);
  return "Finished.";
}

function ActionButton({ label, tip, busy, locked, onClick }: { label: string; tip: string; busy: boolean; locked: boolean; onClick: () => void }) {
  return (
    <button type="button" title={tip} disabled={locked} aria-busy={busy} className="possum-btn rounded-lg bg-black/40 px-3 py-2 text-sm font-black uppercase disabled:cursor-not-allowed disabled:opacity-50" onClick={onClick}>
      {busy ? "Working…" : label}
    </button>
  );
}

export default function InfrastructureClient() {
  const [guildId, setGuildId] = useState("");
  const [userId, setUserId] = useState("");
  const [report, setReport] = useState<Report | null>(null);
  const [query, setQuery] = useState("");
  const [routes, setRoutes] = useState<Record<string, string>>({});
  const [choices, setChoices] = useState<Record<string, string>>({});
  const [busyAction, setBusyAction] = useState("");
  const [notice, setNotice] = useState<Notice | null>(null);
  const [confirm, setConfirm] = useState<"setup" | "repair" | "adapt" | "">("");
  const [preview, setPreview] = useState<AdaptPreview | null>(null);
  const [pending, setPending] = useState<PendingWrite | null>(null);
  const inFlight = useRef(false);

  useEffect(() => {
    const nextGuild = readDashboardGuildId();
    const nextUser = readDashboardUserId();
    setGuildId(nextGuild);
    setUserId(nextUser);
    if (!nextGuild) return;
    loadReport(nextGuild, nextUser).then((json) => setReport(json?.report || null)).catch((error) => setNotice({ tone: "err", text: error.message }));
  }, []);

  async function post(actionKey: string, body: Record<string, unknown>) {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusyAction(actionKey);
    setNotice(null);
    try {
      const response = await fetch("/api/bot/infrastructure", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ guildId, userId, ...body }),
      });
      const json = await response.json();
      if (!response.ok || json?.success === false) {
        const text = json?.error || "Request failed";
        setNotice({ tone: "err", text });
        return;
      }
      if (json?.result?.duplicate || json?.result?.stale) {
        setPreview({ wrote: false, planned: json.result.planned || [], skipped: json.result.skipped || [] });
        setConfirm("adapt");
        setNotice({ tone: "err", text: json.result.reason || "The inventory changed. Review the new preview before applying." });
        return;
      }
      if (json?.preview) {
        setPreview(json.preview);
        setConfirm("adapt");
        setNotice({ tone: "ok", text: `${json.preview.planned?.length || 0} empty mappings can be filled. Nothing was written.` });
        return;
      }
      setPreview(null);
      setConfirm("");
      setPending(null);
      const refreshed = await loadReport(guildId, userId);
      setReport(refreshed?.report || json?.report || null);
      setNotice({ tone: "ok", text: describeResult(body, json) });
    } catch (error) {
      setNotice({ tone: "err", text: error instanceof Error ? error.message : "Request failed" });
    } finally {
      inFlight.current = false;
      setBusyAction("");
    }
  }

  function ask(next: PendingWrite) {
    if (inFlight.current) return;
    setPending(next);
  }

  async function download(format: "json" | "csv" | "txt") {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusyAction(`export-${format}`);
    setNotice(null);
    try {
      const response = await fetch(`/api/bot/infrastructure?guildId=${encodeURIComponent(guildId)}&userId=${encodeURIComponent(userId)}&export=1&format=${format}`, { cache: "no-store" });
      const json = await response.json();
      if (!response.ok || json?.success === false) {
        setNotice({ tone: "err", text: json?.error || "Export failed." });
        return;
      }
      const body = json?.export?.body || "";
      const blob = new Blob([body], { type: "text/plain" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `possum-directory.${format}`;
      link.click();
      URL.revokeObjectURL(url);
      setNotice({ tone: "ok", text: `Downloaded possum-directory.${format} (${body.length} characters).` });
    } catch (error) {
      setNotice({ tone: "err", text: error instanceof Error ? error.message : "Export failed." });
    } finally {
      inFlight.current = false;
      setBusyAction("");
    }
  }

  const locked = Boolean(busyAction);

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
        <p className="mt-1 text-sm text-pink-100/80">Configured {report?.setup?.configured ?? 0} · Missing {report?.setup?.missing ?? 0} · Needs attention {report?.setup?.needsAttention ?? 0}</p>
        {report?.onboarding?.status === "needs-choice" ? (
          <p className="mt-2 text-sm text-pink-100">This server was just discovered. Choose Auto-Adapt to use channels that already exist, or Full Setup and then confirm before Possum creates anything.</p>
        ) : null}
        <p className="mt-2 text-sm text-pink-100/80">{report?.ready ? `Observed by ${report ? "" : ""}the saved scan.` : report?.reason || "Scan the server to build a read-only directory."}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <ActionButton label="Scan" tip="Read the server directory and health. Does not write engine configuration." busy={busyAction === "scan"} locked={locked} onClick={() => post("scan", { action: "scan" })} />
          <ActionButton label="Discovery" tip="Set the mode to discovery. Nothing is created." busy={busyAction === "discovery"} locked={locked} onClick={() => post("discovery", { action: "settings", mode: "discovery" })} />
          <ActionButton label="Preview Auto-Adapt" tip="Show empty mappings that match one existing resource. Nothing is written until you apply the preview." busy={busyAction === "adapt-preview"} locked={locked} onClick={() => post("adapt-preview", { action: "adapt" })} />
          <ActionButton label="Full Setup" tip="Select full-setup mode. Resources are created only after the confirmation below." busy={busyAction === "full-setup"} locked={locked} onClick={() => post("full-setup", { action: "settings", mode: "full-setup" })} />
          <ActionButton label={`Repair ${report?.settings?.repairEnabled ? "On" : "Off"}`} tip="Toggle whether a later confirmed repair is allowed. This click does not recreate channels." busy={busyAction === "repair-toggle"} locked={locked} onClick={() => post("repair-toggle", { action: "settings", repairEnabled: !report?.settings?.repairEnabled })} />
          <ActionButton label="Confirm Full Setup" tip="Open the confirmation for creating at most five missing categories or channels." busy={false} locked={locked} onClick={() => setConfirm("setup")} />
          <ActionButton label="Confirm Repair" tip="Open the confirmation for recreating channels Possum previously recorded." busy={false} locked={locked} onClick={() => setConfirm("repair")} />
          <ActionButton label="JSON" tip="Download the directory as JSON." busy={busyAction === "export-json"} locked={locked} onClick={() => download("json")} />
          <ActionButton label="CSV" tip="Download the directory as CSV." busy={busyAction === "export-csv"} locked={locked} onClick={() => download("csv")} />
          <ActionButton label="TXT" tip="Download the directory as text." busy={busyAction === "export-txt"} locked={locked} onClick={() => download("txt")} />
        </div>
        {pending ? (
          <div className="mt-3 rounded-lg border border-pink-800/50 p-3" role="dialog" aria-label={pending.title}>
            <p className="text-sm font-black uppercase text-pink-100">{pending.title}</p>
            <p className="mt-1 text-sm text-pink-100">{pending.detail}</p>
            <div className="mt-2 flex gap-2">
              <ActionButton label={pending.confirmLabel} tip="Send this confirmed write." busy={busyAction === "pending"} locked={locked} onClick={() => post("pending", pending.body)} />
              <ActionButton label="Cancel" tip="Close this confirmation without writing." busy={false} locked={locked} onClick={() => setPending(null)} />
            </div>
          </div>
        ) : null}
        {confirm === "adapt" && preview ? (
          <div className="mt-3 max-h-80 overflow-y-auto rounded-lg border border-pink-800/50 p-3">
            <p className="text-sm text-pink-100">{preview.planned?.length || 0} empty mappings would be filled. Populated values stay. Protected heist, onboarding, verification, and pre-onboarding fields stay out. Ambiguous matches stay unassigned. Each Discord resource is used once. Apply checks this list against the current inventory and refuses it if the inventory changed.</p>
            <div className="mt-2 space-y-1">
              {(preview.planned || []).map((row) => (
                <p key={row.id} className="text-xs text-red-100">{row.engine}.{row.field} → {row.resourceName} ({row.resourceId})</p>
              ))}
            </div>
            <div className="mt-2 flex gap-2">
              <ActionButton label="Apply these mappings" tip="Write only the empty mappings in this preview. Refuses the write if the inventory changed." busy={busyAction === "adapt-apply"} locked={locked} onClick={() => post("adapt-apply", { action: "adapt", confirmed: true, planned: preview.planned || [] })} />
              <ActionButton label="Cancel" tip="Discard this preview without writing." busy={false} locked={locked} onClick={() => { setConfirm(""); setPreview(null); }} />
            </div>
          </div>
        ) : null}
        {confirm === "setup" ? (
          <div className="mt-3 rounded-lg border border-pink-800/50 p-3">
            <p className="text-sm text-pink-100">Full setup creates at most five missing categories or channels. Staff and security logs are private. Protected engines are skipped. Nothing is deleted.</p>
            <ActionButton label="Create approved resources" tip="Create at most five missing categories or channels. Protected engines stay skipped." busy={busyAction === "provision"} locked={locked} onClick={() => post("provision", { action: "provision", confirmed: true })} />
          </div>
        ) : null}
        {confirm === "repair" ? (
          <div className="mt-3 rounded-lg border border-pink-800/50 p-3">
            <p className="text-sm text-pink-100">Repair only recreates channels Possum recorded, and only while the repair toggle is on. Other channels stay untouched.</p>
            <ActionButton label="Recreate recorded resources" tip="Recreate only channels Possum recorded, and only while repair is on." busy={busyAction === "repair"} locked={locked} onClick={() => post("repair", { action: "repair", confirmed: true })} />
          </div>
        ) : null}
        <p className="mt-2 text-xs text-red-200/70">Mode {report?.settings?.mode || "discovery"}. Protected onboarding, verification, pre-onboarding, and heist fields stay suggestion-only.</p>
        {notice ? <p role="status" className={notice.tone === "ok" ? "mt-2 rounded-md border border-pink-700/60 bg-pink-950/40 px-3 py-2 text-sm text-pink-100" : "mt-2 rounded-md border border-red-700/70 bg-red-950/50 px-3 py-2 text-sm text-red-100"}>{notice.text}</p> : null}
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
              <ActionButton label="Copy ID" tip={`Copy Discord id ${row.id}`} busy={false} locked={locked} onClick={() => { navigator.clipboard?.writeText(row.id).then(() => setNotice({ tone: "ok", text: `Copied ${row.id}.` })).catch(() => setNotice({ tone: "err", text: "The browser did not allow copying that id." })); }} />
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
                  <ActionButton label="Turn off" tip="Hide this non-critical gap for this server. Critical gaps cannot be turned off." busy={false} locked={locked} onClick={() => ask({ title: "Turn off this gap", detail: `${finding.engine}.${finding.field} will be ignored for this server. The saved mapping is not deleted.`, confirmLabel: "Turn off", body: { action: "decide", engine: finding.engine, field: finding.field, decision: "ignore" } })} />
                  {finding.protectedFlow ? null : (
                    <>
                      <select className="rounded-md border border-red-900/50 bg-black px-2 py-1 text-xs text-red-100" value={routes[`${finding.engine}:${finding.field}`] || ""} onChange={(event) => setRoutes((current) => ({ ...current, [`${finding.engine}:${finding.field}`]: event.target.value }))}>
                        <option value="">Point at an existing {finding.resourceType || "resource"}</option>
                        {(finding.resourceType === "role" ? report?.directory?.roles || [] : [...(report?.directory?.categories || []), ...(report?.directory?.channels || [])]).map((row) => (
                          <option key={row.id} value={row.id}>{row.name}</option>
                        ))}
                      </select>
                      <ActionButton label="Use this" tip="Point this field at the selected existing Discord resource." busy={false} locked={locked} onClick={() => ask({ title: "Use this resource", detail: `${finding.engine}.${finding.field} will use the selected existing resource. Protected fields cannot be written.`, confirmLabel: "Use this", body: { action: "decide", engine: finding.engine, field: finding.field, decision: "reroute", channelId: routes[`${finding.engine}:${finding.field}`] || "" } })} />
                    </>
                  )}
                </div>
              ) : null}
              {finding.severity === "ignored" ? (
                <ActionButton label="Turn back on" tip="Clear the ignore decision for this field." busy={false} locked={locked} onClick={() => ask({ title: "Turn this gap back on", detail: `${finding.engine}.${finding.field} will show in health again.`, confirmLabel: "Turn back on", body: { action: "decide", engine: finding.engine, field: finding.field, decision: "clear" } })} />
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
                <ActionButton label="Approve empty field" tip="Write the suggested resource into this empty field. A populated id is not overwritten." busy={false} locked={locked} onClick={() => ask({ title: "Approve empty field", detail: `${proposal.engine}.${proposal.field} will be filled only if it is still empty.`, confirmLabel: "Approve", body: { action: "approve", proposalIds: [proposal.id] } })} />
              ) : null}
              {proposal.status === "ambiguous" && proposal.matches?.length ? (
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <select className="rounded-md border border-red-900/50 bg-black px-2 py-1 text-xs text-red-100" value={choices[proposal.id] || ""} onChange={(event) => setChoices((current) => ({ ...current, [proposal.id]: event.target.value }))}>
                    <option value="">Choose a match</option>
                    {proposal.matches.map((match) => <option key={match.id} value={match.id}>{match.name}</option>)}
                  </select>
                  <ActionButton label="Use this match" tip="Write the match you picked into this empty field." busy={false} locked={locked} onClick={() => ask({ title: "Use this match", detail: `${proposal.engine}.${proposal.field} will use the match selected in the list.`, confirmLabel: "Use this match", body: { action: "approve", proposalIds: [proposal.id], selections: { [proposal.id]: choices[proposal.id] || "" } } })} />
                </div>
              ) : null}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
