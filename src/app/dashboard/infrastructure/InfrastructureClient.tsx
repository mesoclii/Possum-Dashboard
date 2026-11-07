"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { readDashboardGuildId, readDashboardUserId } from "@/lib/dashboardContext";

type DirectoryRow = { id: string; name: string; kind?: string; parentId?: string; botPermissions?: { status?: string; flags?: string[] } };
type FeatureOption = { id: string; name: string; group: string; description: string; protected: boolean; selectable: boolean };
type Proposal = {
  id: string;
  engine: string;
  field: string;
  status: string;
  reason: string;
  proposedName?: string;
  resourceType?: string;
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
  settings?: { mode: string; repairEnabled: boolean; trackedEnginesConfigured?: boolean; trackedEngines?: string[]; resourceNameOverrides?: Record<string, string> };
  featureCatalog?: FeatureOption[];
  setup?: { configured: number; missing: number; needsAttention: number; readyForApproval: number };
  createdResources?: { id: string; engine: string; field: string }[];
  watch?: {
    ready?: boolean;
    checkedAt?: string;
    lastChangeAt?: string;
    added?: number;
    resolved?: number;
    counts?: { critical: number; warning: number; notice: number };
    items?: { id: string; kind: string; severity: string; engine: string; field: string; message: string; recommendation?: string; allowedAction?: string; protectedFlow?: boolean }[];
  };
  directory?: { categories: DirectoryRow[]; channels: DirectoryRow[]; roles: DirectoryRow[] };
};

type ApiJson = {
  success?: boolean;
  error?: string;
  report?: Report;
  result?: Record<string, unknown>;
  preview?: AdaptPreview;
  record?: { settings?: { mode?: string; repairEnabled?: boolean } };
  export?: { body?: string };
};

type Notice = { id: number; tone: "ok" | "err"; title: string; detail?: string };
type PendingWrite = { title: string; detail: string; confirmLabel: string; body: Record<string, unknown> };
type DialogKind = "setup" | "repair" | "adapt" | "";

async function readJson(response: Response): Promise<ApiJson> {
  try {
    return (await response.json()) as ApiJson;
  } catch {
    return {};
  }
}

function rowsOf(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? (value as Record<string, unknown>[]) : [];
}

function countOf(value: unknown): number {
  return rowsOf(value).length;
}

function nameList(value: unknown): string[] {
  return rowsOf(value)
    .map((row) => String(row.name || row.field || row.id || ""))
    .filter(Boolean)
    .slice(0, 5);
}

function describeResult(body: Record<string, unknown>, json: ApiJson): { title: string; lines: string[] } {
  const action = String(body.action || "");
  const result = json.result || {};
  const report = json.report;
  if (action === "scan") {
    return {
      title: "Scan complete",
      lines: [
        `Health ${report?.healthScore ?? "—"} · critical ${report?.counts?.critical ?? 0} · warning ${report?.counts?.warning ?? 0} · optional ${report?.counts?.optional ?? report?.counts?.notice ?? 0}`,
        `Configured ${report?.setup?.configured ?? 0} · missing ${report?.setup?.missing ?? 0} · needs attention ${report?.setup?.needsAttention ?? 0}`,
        "No engine configuration was written.",
      ],
    };
  }
  if (action === "settings") {
    if (Object.prototype.hasOwnProperty.call(body, "trackedEngines")) {
      return { title: "Server features saved", lines: [`Enabled ${Array.isArray(body.trackedEngines) ? body.trackedEngines.length : 0} feature systems. Infrastructure will only track selected systems.`, "No Discord resources were created or changed."] };
    }
    if (Object.prototype.hasOwnProperty.call(body, "repairEnabled")) {
      return {
        title: `Repair ${body.repairEnabled ? "enabled" : "disabled"}`,
        lines: ["Repair eligibility changed for this server.", "No Discord resources were changed."],
      };
    }
    return {
      title: "Mode updated",
      lines: [`Mode is now ${String(body.mode || json.record?.settings?.mode || "discovery")}.`, "Nothing was created."],
    };
  }
  if (action === "adapt" && body.confirmed === true) {
    return {
      title: result.wrote === true ? "Auto-Adapt applied" : "Auto-Adapt did not write",
      lines: [
        `Applied ${countOf(result.applied)} empty mapping${countOf(result.applied) === 1 ? "" : "s"}. Skipped ${countOf(result.skipped)}.`,
        `Configuration write: ${result.wrote === true ? "yes" : "no"}.`,
        ...(result.reason ? [String(result.reason)] : []),
        ...rowsOf(result.skipped).slice(0, 5).map((row) => `Skipped ${String(row.id || "")}: ${String(row.reason || "")}`),
      ],
    };
  }
  if (action === "provision") {
    const names = nameList(result.created);
    return {
      title: `Full setup created ${countOf(result.created)} resource${countOf(result.created) === 1 ? "" : "s"}`,
      lines: [
        ...(names.length ? [`Created: ${names.join(", ")}`] : []),
        `Deferred ${countOf(result.deferred)}. Configuration write: ${result.wroteConfig === true ? "yes" : "no"}. Mode ${String(result.mode || "full-setup")}.`,
        ...(result.message ? [String(result.message)] : []),
      ],
    };
  }
  if (action === "repair") {
    const names = nameList(result.repaired);
    return {
      title: `Repair recreated ${countOf(result.repaired)} resource${countOf(result.repaired) === 1 ? "" : "s"}`,
      lines: [...(names.length ? [`Recreated: ${names.join(", ")}`] : []), ...(result.message ? [String(result.message)] : [])],
    };
  }
  if (action === "approve") {
    return {
      title: `Approved ${countOf(result.applied)} empty field${countOf(result.applied) === 1 ? "" : "s"}`,
      lines: [
        `Skipped ${countOf(result.skipped)}. Populated IDs were left unchanged.`,
        ...rowsOf(result.skipped).slice(0, 5).map((row) => `Skipped ${String(row.id || "")}: ${String(row.reason || "")}`),
      ],
    };
  }
  if (action === "decide") {
    return {
      title: "Field decision saved",
      lines: [
        String(result.reason || `Saved decision ${String(result.action || body.decision || "")} for ${String(body.engine || "")}.${String(body.field || "")}.`),
        ...(result.channelId ? [`Now points at ${String(result.channelId)}.`] : []),
      ],
    };
  }
  return { title: "Finished", lines: [] };
}

function Spinner() {
  return (
    <svg className="h-3.5 w-3.5 shrink-0 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-90" fill="currentColor" d="M4 12a8 8 0 0 1 8-8v4a4 4 0 0 0-4 4H4z" />
    </svg>
  );
}

function ActionButton({
  label,
  tip,
  busy,
  busyLabel,
  locked,
  danger,
  onClick,
}: {
  label: string;
  tip: string;
  busy: boolean;
  busyLabel?: string;
  locked: boolean;
  danger?: boolean;
  onClick: () => void;
}) {
  const tipId = useId();
  const [hovered, setHovered] = useState(false);
  const showTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (showTimer.current) clearTimeout(showTimer.current);
  }, []);

  function schedule() {
    if (showTimer.current) clearTimeout(showTimer.current);
    showTimer.current = setTimeout(() => setHovered(true), 180);
  }

  function hide() {
    if (showTimer.current) clearTimeout(showTimer.current);
    setHovered(false);
  }

  return (
    <span className="relative inline-flex" onMouseEnter={schedule} onMouseLeave={hide} onFocusCapture={schedule} onBlurCapture={hide}>
      <button
        type="button"
        title={tip}
        aria-describedby={hovered ? tipId : undefined}
        aria-busy={busy}
        aria-disabled={locked}
        disabled={locked}
        className={`possum-btn inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-black uppercase disabled:cursor-not-allowed disabled:opacity-50 ${danger ? "border border-red-700/70 text-red-100" : ""}`}
        onClick={onClick}
      >
        {busy ? <Spinner /> : null}
        {busy ? busyLabel || "Working…" : label}
      </button>
      {hovered ? (
        <span
          role="tooltip"
          id={tipId}
          className="pointer-events-none absolute bottom-full left-0 z-30 mb-2 w-max max-w-[18rem] rounded-md border border-pink-800/70 bg-black px-2 py-1 text-xs font-medium normal-case tracking-normal text-pink-100 shadow-lg"
        >
          {tip}
        </span>
      ) : null}
    </span>
  );
}

function ConfirmDialog({
  open,
  title,
  detail,
  confirmLabel,
  busy,
  locked,
  children,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  detail: string;
  confirmLabel: string;
  busy: boolean;
  locked: boolean;
  children?: React.ReactNode;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const titleId = useId();
  const confirmRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!open) return;
    confirmRef.current?.focus();
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !busy) {
        event.preventDefault();
        onCancel();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, busy, onCancel]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy && !locked) onCancel(); }}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-busy={busy}
        className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-xl border border-pink-800/60 bg-black/95 p-4 shadow-2xl"
      >
        <p id={titleId} className="text-sm font-black uppercase tracking-[0.08em] text-pink-100">{title}</p>
        <p className="mt-2 text-sm text-pink-100/85">{detail}</p>
        {children ? <div className="mt-3">{children}</div> : null}
        <div className="mt-4 flex flex-wrap justify-end gap-2">
          <ActionButton label="Cancel" tip="Close this confirmation without writing." busy={false} locked={busy || locked} onClick={onCancel} />
          <button
            ref={confirmRef}
            type="button"
            aria-busy={busy}
            disabled={busy || locked}
            className="possum-btn inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-black uppercase disabled:cursor-not-allowed disabled:opacity-50"
            onClick={onConfirm}
          >
            {busy ? <Spinner /> : null}
            {busy ? "Working…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function InfrastructureClient() {
  const [guildId, setGuildId] = useState("");
  const [userId, setUserId] = useState("");
  const [report, setReport] = useState<Report | null>(null);
  const [selectedFeatures, setSelectedFeatures] = useState<string[]>([]);
  const [featuresDirty, setFeaturesDirty] = useState(false);
  const [namesDirty, setNamesDirty] = useState(false);
  const [nameOverrides, setNameOverrides] = useState<Record<string, string>>({});
  const [query, setQuery] = useState("");
  const [routes, setRoutes] = useState<Record<string, string>>({});
  const [choices, setChoices] = useState<Record<string, string>>({});
  const [busyAction, setBusyAction] = useState("");
  const [notices, setNotices] = useState<Notice[]>([]);
  const [confirm, setConfirm] = useState<DialogKind>("");
  const [preview, setPreview] = useState<AdaptPreview | null>(null);
  const [pending, setPending] = useState<PendingWrite | null>(null);
  const inFlight = useRef(false);
  const noticeId = useRef(0);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => () => {
    timers.current.forEach((timer) => clearTimeout(timer));
    timers.current = [];
  }, []);

  function notify(tone: Notice["tone"], title: string, detail?: string) {
    const id = (noticeId.current += 1);
    setNotices((current) => [...current.slice(-3), { id, tone, title, detail }]);
    if (tone === "ok") {
      const timer = setTimeout(() => setNotices((current) => current.filter((notice) => notice.id !== id)), 7000);
      timers.current.push(timer);
    }
  }

  function dismiss(id: number) {
    setNotices((current) => current.filter((notice) => notice.id !== id));
  }

  useEffect(() => {
    const nextGuild = readDashboardGuildId();
    const nextUser = readDashboardUserId();
    setGuildId(nextGuild);
    setUserId(nextUser);
    if (!nextGuild) return;
    fetch(`/api/bot/infrastructure?guildId=${encodeURIComponent(nextGuild)}&userId=${encodeURIComponent(nextUser)}`, { cache: "no-store" })
      .then(async (response) => {
        const json = await readJson(response);
        if (!response.ok || json.success === false) throw new Error(json.error || "Could not load the saved scan.");
        setReport(json.report || null);
        setSelectedFeatures(json.report?.settings?.trackedEngines || []);
        setNameOverrides(json.report?.settings?.resourceNameOverrides || {});
      })
      .catch((error: unknown) => notify("err", "Could not load the saved scan", error instanceof Error ? error.message : "Request failed"));
  }, []);

  async function post(actionKey: string, body: Record<string, unknown>) {
    if (inFlight.current) {
      notify("err", "A request is already running", "Wait for the current operation to finish before starting another.");
      return;
    }
    if (!guildId) {
      notify("err", "No server selected", "Choose a server in the dashboard before running infrastructure actions.");
      return;
    }
    const before = report?.healthScore;
    inFlight.current = true;
    setBusyAction(actionKey);
    try {
      const response = await fetch("/api/bot/infrastructure", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ guildId, userId, ...body }),
      });
      const json = await readJson(response);
      if (!response.ok || json.success === false) {
        notify("err", `Request failed (${response.status})`, json.error || "The bot API did not return an error message.");
        return;
      }
      if (json.result?.duplicate === true || json.result?.stale === true) {
        setPreview({ wrote: false, planned: rowsOf(json.result?.planned) as unknown as AdaptRow[], skipped: rowsOf(json.result?.skipped) as unknown as { id: string; reason: string }[] });
        setConfirm("adapt");
        notify("err", "The inventory changed", String(json.result?.reason || "Review the new preview before applying."));
        return;
      }
      if (json.preview) {
        setPreview(json.preview);
        setConfirm("adapt");
        notify("ok", "Preview ready", `${json.preview.planned?.length || 0} empty mapping${json.preview.planned?.length === 1 ? "" : "s"} can be filled. Nothing was written.`);
        return;
      }
      setPreview(null);
      setConfirm("");
      setPending(null);
      const refreshedResponse = await fetch(`/api/bot/infrastructure?guildId=${encodeURIComponent(guildId)}&userId=${encodeURIComponent(userId)}`, { cache: "no-store" });
      const refreshed = await readJson(refreshedResponse).catch(() => ({} as ApiJson));
      const nextReport = refreshed.report || json.report || null;
      setReport(nextReport);
      if (body.action === "settings" && (Object.prototype.hasOwnProperty.call(body, "trackedEngines") || Object.prototype.hasOwnProperty.call(body, "resourceNameOverrides"))) {
        if (nextReport?.settings?.trackedEnginesConfigured) setSelectedFeatures(nextReport.settings.trackedEngines || []);
        setNameOverrides(nextReport?.settings?.resourceNameOverrides || {});
        setFeaturesDirty(false);
        setNamesDirty(false);
      }
      const described = describeResult(body, json);
      const after = nextReport?.healthScore;
      const delta = typeof before === "number" && typeof after === "number" && before !== after
        ? `Health ${before} → ${after} (${after - before >= 0 ? "+" : ""}${after - before}).`
        : "";
      notify("ok", described.title, [delta, ...described.lines].filter(Boolean).join(" "));
    } catch (error: unknown) {
      notify("err", "Request did not complete", error instanceof Error ? error.message : "Request failed");
    } finally {
      inFlight.current = false;
      setBusyAction("");
    }
  }

  function ask(next: PendingWrite) {
    if (inFlight.current) {
      notify("err", "A request is already running", "Wait for the current operation to finish before starting another.");
      return;
    }
    setPending(next);
  }

  async function download(format: "json" | "csv" | "txt") {
    if (inFlight.current) {
      notify("err", "A request is already running", "Wait for the current operation to finish before exporting.");
      return;
    }
    if (!guildId) {
      notify("err", "No server selected", "Choose a server before exporting the directory.");
      return;
    }
    inFlight.current = true;
    setBusyAction(`export-${format}`);
    try {
      const response = await fetch(`/api/bot/infrastructure?guildId=${encodeURIComponent(guildId)}&userId=${encodeURIComponent(userId)}&export=1&format=${format}`, { cache: "no-store" });
      const json = await readJson(response);
      if (!response.ok || json.success === false) {
        notify("err", "Export failed", json.error || "The bot API did not return a file.");
        return;
      }
      const body = json.export?.body || "";
      if (!body) {
        notify("err", "Export was empty", "No directory rows were returned for this server.");
        return;
      }
      const blob = new Blob([body], { type: "text/plain" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `possum-directory.${format}`;
      link.click();
      URL.revokeObjectURL(url);
      notify("ok", `Downloaded possum-directory.${format}`, `${body.length} characters.`);
    } catch (error: unknown) {
      notify("err", "Export failed", error instanceof Error ? error.message : "Request failed");
    } finally {
      inFlight.current = false;
      setBusyAction("");
    }
  }

  async function copyId(id: string) {
    try {
      await navigator.clipboard?.writeText(id);
      notify("ok", "Copied", `Discord id ${id} is on the clipboard.`);
    } catch {
      notify("err", "Copy was blocked", "The browser did not allow copying that id. Select it from the directory instead.");
    }
  }

  const locked = Boolean(busyAction);
  const featureSelectionRequired = !report?.settings?.trackedEnginesConfigured || featuresDirty || namesDirty;
  const busyLabel = busyAction ? `Running ${busyAction.replace(/-/g, " ")}` : "";

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
      <div aria-live="polite" className="sr-only">{locked ? `${busyLabel}. Other actions are temporarily disabled.` : "No infrastructure action is running."}</div>

      <div className="pointer-events-none fixed bottom-4 right-4 z-50 flex w-[min(24rem,calc(100vw-2rem))] flex-col gap-2">
        {notices.map((notice) => (
          <div
            key={notice.id}
            role={notice.tone === "err" ? "alert" : "status"}
            aria-live={notice.tone === "err" ? "assertive" : "polite"}
            className={`pointer-events-auto rounded-lg border px-3 py-2 shadow-lg ${notice.tone === "ok" ? "border-pink-700/60 bg-pink-950/95 text-pink-100" : "border-red-700/70 bg-red-950/95 text-red-100"}`}
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-sm font-black uppercase tracking-[0.06em]">{notice.title}</p>
                {notice.detail ? <p className="mt-1 text-xs leading-relaxed">{notice.detail}</p> : null}
              </div>
              <button type="button" aria-label="Dismiss notification" className="rounded px-1 text-lg leading-none opacity-70 hover:opacity-100" onClick={() => dismiss(notice.id)}>×</button>
            </div>
          </div>
        ))}
      </div>

            <section className="rounded-xl border possum-divider bg-black/50 p-4 possum-border">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-black uppercase text-red-200">Server feature selection</h2>
            <p className="mt-1 max-w-3xl text-sm text-red-100/80">Choose the Possum systems this guild actually uses. Infrastructure will only discover, recommend, provision and monitor requirements belonging to selected systems. This does not switch bot engines on or off. You can change it later.</p>
          </div>
          <span className="rounded-md border border-pink-800/60 px-2 py-1 text-xs text-pink-100">{selectedFeatures.length} selected</span>
        </div>
        {!report?.settings?.trackedEnginesConfigured ? <p className="mt-3 rounded-lg border border-amber-700/50 bg-amber-950/30 px-3 py-2 text-sm text-amber-100">Choose and save this guild’s feature set before Auto-Adapt, Full Setup or Repair can run. Scanning remains read-only.</p> : <p className="mt-3 text-xs text-pink-100/70">Feature selection saved. Unselected systems are excluded from infrastructure requirements. Existing configuration and Discord resources are never deleted when a feature is turned off.</p>}
        {featuresDirty || namesDirty ? <p className="mt-2 rounded-lg border border-amber-700/50 bg-amber-950/30 px-3 py-2 text-xs text-amber-100">You have unsaved feature or naming changes. Save them before running setup, Auto-Adapt or Repair.</p> : null}
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          {(["community", "moderation", "engagement", "support"] as const).map((group) => {
            const options = (report?.featureCatalog || []).filter((feature) => feature.group === group);
            if (!options.length) return null;
            const title = group === "community" ? "Community" : group === "moderation" ? "Moderation & security" : group === "engagement" ? "Engagement" : "Support & administration";
            return <div key={group} className="rounded-lg border border-red-900/40 p-3">
              <h3 className="text-sm font-black uppercase text-pink-100">{title}</h3>
              <div className="mt-2 space-y-2">
                {options.map((feature) => <label key={feature.id} className="flex cursor-pointer items-start gap-2 rounded-md px-1 py-1 text-sm text-red-100">
                  <input type="checkbox" checked={selectedFeatures.includes(feature.id)} disabled={!feature.selectable || locked} onChange={(event) => { setFeaturesDirty(true); setSelectedFeatures((current) => event.target.checked ? [...new Set([...current, feature.id])] : current.filter((id) => id !== feature.id)); }} className="mt-1 accent-red-500" />
                  <span className="min-w-0 flex-1">
                    <span className="block font-bold">{feature.name}{feature.protected ? <span className="ml-2 text-[10px] font-normal uppercase text-amber-200">Protected flow</span> : null}</span>
                    <span className="block text-xs text-red-100/60">{feature.description}</span>
                  </span>
                </label>)}
              </div>
            </div>;
          })}
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <ActionButton label="Save features & names" tip="Save this guild’s feature selection. This changes tracking scope only and does not create or modify Discord resources." busy={busyAction === "feature-settings"} busyLabel="Saving…" locked={locked} onClick={() => post("feature-settings", { action: "settings", trackedEngines: selectedFeatures, resourceNameOverrides: nameOverrides })} />
          <span className="text-xs text-red-100/60">Protected systems remain suggestion-only. Their existing runtime and verification flows are not changed.</span>
        </div>
      </section>

<section className="rounded-xl border possum-divider bg-black/50 p-4 possum-border">
        <p className="text-xs uppercase tracking-[0.22em] possum-soft">Infrastructure</p>
        <h1 className="mt-1 text-2xl font-black uppercase tracking-[0.08em] possum-red">Server Directory</h1>
        <p className="mt-2 text-sm text-red-100/80">Health {report?.healthScore ?? "—"} · Critical {report?.counts?.critical ?? 0} · Warning {report?.counts?.warning ?? 0} · Optional {report?.counts?.optional ?? report?.counts?.notice ?? 0}</p>
        <p className="mt-1 text-sm text-pink-100/80">Configured {report?.setup?.configured ?? 0} · Missing {report?.setup?.missing ?? 0} · Needs attention {report?.setup?.needsAttention ?? 0}</p>
        {report?.onboarding?.status === "needs-choice" ? (
          <p className="mt-2 text-sm text-pink-100">This server was just discovered. Choose Auto-Adapt to use channels that already exist, or Full Setup and then confirm before Possum creates anything.</p>
        ) : null}
        <p className="mt-2 text-sm text-pink-100/80">{report?.ready ? "Observed by the saved scan." : report?.reason || "Scan the server to build a read-only directory."}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <ActionButton label="Scan" tip="Read the server directory and health. Does not write engine configuration." busy={busyAction === "scan"} busyLabel="Scanning…" locked={locked} onClick={() => post("scan", { action: "scan" })} />
          <ActionButton label="Discovery" tip="Set the mode to discovery. Nothing is created." busy={busyAction === "discovery"} busyLabel="Saving…" locked={locked} onClick={() => post("discovery", { action: "settings", mode: "discovery" })} />
          <ActionButton label="Preview Auto-Adapt" tip="Show empty mappings that match one existing resource. Nothing is written until you apply the preview." busy={busyAction === "adapt-preview"} busyLabel="Previewing…" locked={locked || featureSelectionRequired} onClick={() => post("adapt-preview", { action: "adapt" })} />
          <ActionButton label="Full Setup" tip="Select full-setup mode. Resources are created only after the confirmation below." busy={busyAction === "full-setup"} busyLabel="Saving…" locked={locked || featureSelectionRequired} onClick={() => post("full-setup", { action: "settings", mode: "full-setup" })} />
          <ActionButton label={`Repair ${report?.settings?.repairEnabled ? "On" : "Off"}`} tip="Toggle whether a later confirmed repair is allowed. This click does not recreate channels." busy={busyAction === "repair-toggle"} busyLabel="Saving…" locked={locked || featureSelectionRequired} onClick={() => post("repair-toggle", { action: "settings", repairEnabled: !report?.settings?.repairEnabled })} />
          <ActionButton label="Confirm Full Setup" tip="Open the confirmation for creating at most five missing categories or channels." busy={false} locked={locked || featureSelectionRequired} onClick={() => setConfirm("setup")} />
          <ActionButton label="Confirm Repair" tip="Open the confirmation for recreating channels Possum previously recorded." busy={false} locked={locked || featureSelectionRequired} onClick={() => setConfirm("repair")} />
          <ActionButton label="JSON" tip="Download the directory as JSON." busy={busyAction === "export-json"} busyLabel="Exporting…" locked={locked} onClick={() => download("json")} />
          <ActionButton label="CSV" tip="Download the directory as CSV." busy={busyAction === "export-csv"} busyLabel="Exporting…" locked={locked} onClick={() => download("csv")} />
          <ActionButton label="TXT" tip="Download the directory as text." busy={busyAction === "export-txt"} busyLabel="Exporting…" locked={locked} onClick={() => download("txt")} />
        </div>
        <p className="mt-2 text-xs text-red-200/70">Mode {report?.settings?.mode || "discovery"}. Protected onboarding, verification, pre-onboarding, and heist fields stay suggestion-only.</p>
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
              <ActionButton label="Copy ID" tip={`Copy Discord id ${row.id}`} busy={false} locked={locked} onClick={() => { void copyId(row.id); }} />
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-xl border possum-divider bg-black/50 p-4 possum-border">
        <h2 className="text-lg font-black uppercase text-red-200">Continuous watch</h2>
        <p className="mt-2 text-sm text-red-100/80">Last check {report?.watch?.checkedAt ? new Date(report.watch.checkedAt).toLocaleString() : "—"} · Critical {report?.watch?.counts?.critical ?? 0} · Warning {report?.watch?.counts?.warning ?? 0} · Added {report?.watch?.added ?? 0} · Cleared {report?.watch?.resolved ?? 0}</p>
        <p className="mt-1 text-xs text-pink-100/70">Read-only monitoring. Findings never change engine configuration; reroute and repair still need your approval.</p>
        <div className="mt-3 space-y-2">
          {(report?.watch?.items || []).slice(0, 20).map((entry) => (
            <div key={entry.id} className="rounded-lg border border-red-900/40 px-3 py-2">
              <p className="text-xs uppercase tracking-[0.14em] text-pink-200">{entry.severity} · {entry.kind} · {entry.allowedAction || "review"}</p>
              <p className="text-sm font-bold text-red-100">{entry.engine}.{entry.field}</p>
              <p className="text-xs text-red-100/80">{entry.message}</p>
              <p className="text-xs text-pink-100/80">{entry.recommendation}</p>
            </div>
          ))}
          {!report?.watch?.ready ? <p className="text-xs text-pink-100/70">No watch pass recorded for this server yet.</p> : null}
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
              {proposal.status === "missing" && !proposal.protectedFlow ? <label className="mt-2 block text-xs text-pink-100/70">Proposed resource name<input value={nameOverrides[proposal.id] ?? proposal.proposedName ?? ""} onChange={(event) => { setNamesDirty(true); setNameOverrides((current) => ({ ...current, [proposal.id]: event.target.value })); }} maxLength={90} className="mt-1 w-full rounded-md border border-red-900/50 bg-black px-2 py-1 text-sm text-red-50" /></label> : null}
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

      <ConfirmDialog
        open={Boolean(pending)}
        title={pending?.title || ""}
        detail={pending?.detail || ""}
        confirmLabel={pending?.confirmLabel || "Confirm"}
        busy={busyAction === "pending"}
        locked={locked && busyAction !== "pending"}
        onConfirm={() => { if (pending) void post("pending", pending.body); }}
        onCancel={() => setPending(null)}
      />

      <ConfirmDialog
        open={confirm === "adapt" && Boolean(preview)}
        title={`Apply ${preview?.planned?.length || 0} empty mapping${preview?.planned?.length === 1 ? "" : "s"}`}
        detail="Only these empty mappings are written. Populated values stay. Protected heist, onboarding, verification, and pre-onboarding fields stay out. Ambiguous matches stay unassigned. Each Discord resource is used once."
        confirmLabel="Apply these mappings"
        busy={busyAction === "adapt-apply"}
        locked={locked && busyAction !== "adapt-apply"}
        onConfirm={() => void post("adapt-apply", { action: "adapt", confirmed: true, planned: preview?.planned || [] })}
        onCancel={() => { setConfirm(""); setPreview(null); }}
      >
        <div className="max-h-60 space-y-1 overflow-y-auto">
          {(preview?.planned || []).slice(0, 40).map((row) => (
            <p key={row.id} className="text-xs text-red-100">{row.engine}.{row.field} → {row.resourceName} ({row.resourceId})</p>
          ))}
          {(preview?.planned?.length || 0) > 40 ? <p className="text-xs text-pink-100/70">+{(preview?.planned?.length || 0) - 40} more.</p> : null}
        </div>
      </ConfirmDialog>

      <ConfirmDialog
        open={confirm === "setup"}
        title="Create approved resources"
        detail={`Full setup creates at most five missing categories or channels. ${report?.setup?.missing ?? 0} field${(report?.setup?.missing ?? 0) === 1 ? "" : "s"} currently have no matching resource. Staff and security logs are private. Protected engines are skipped. Nothing is deleted.`}
        confirmLabel="Create approved resources"
        busy={busyAction === "provision"}
        locked={locked && busyAction !== "provision"}
        onConfirm={() => void post("provision", { action: "provision", confirmed: true })}
        onCancel={() => setConfirm("")}
      >
        <div className="max-h-60 space-y-1 overflow-y-auto">
          {(report?.proposals || []).filter((proposal) => proposal.status === "missing" && !proposal.protectedFlow).slice(0, 30).map((proposal) => (
            <p key={proposal.id} className="text-xs text-red-100">{proposal.resourceType || "resource"} · {proposal.engine}.{proposal.field} → <strong>{proposal.proposedName || proposal.field}</strong></p>
          ))}
        </div>
      </ConfirmDialog>

      <ConfirmDialog
        open={confirm === "repair"}
        title="Recreate recorded resources"
        detail={`Repair only recreates channels Possum recorded, and only while the repair toggle is on. Repair is currently ${report?.settings?.repairEnabled ? "on" : "off"}. Other channels stay untouched.`}
        confirmLabel="Recreate recorded resources"
        busy={busyAction === "repair"}
        locked={locked && busyAction !== "repair"}
        onConfirm={() => void post("repair", { action: "repair", confirmed: true })}
        onCancel={() => setConfirm("")}
      />
    </div>
  );
}
