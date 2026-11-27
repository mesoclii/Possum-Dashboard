"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { readDashboardGuildId, readDashboardUserId } from "@/lib/dashboardContext";
import { summarizeSetupPlan, type SetupPlan, type SetupPlanAction } from "./setupPlan";

type DirectoryRow = { id: string; name: string; kind?: string; managed?: boolean; parentId?: string; botPermissions?: { status?: string } };
type FeatureOption = { id: string; name: string; group: string; description: string; protected: boolean; selectable: boolean; selectionStatus?: string };
type Proposal = {
  id: string;
  engine: string;
  engineLabel?: string;
  field: string;
  intendedName?: string;
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
type ActiveSetupPlan = { plan: SetupPlan; canResume?: boolean; canCancel?: boolean; canCompensate?: boolean };

type Report = {
  guildId?: string;
  ready?: boolean;
  panelSetupPolicy?: string;
  channelCreationPolicy?: string;
  reason?: string;
  healthScore?: number;
  counts?: { critical: number; warning: number; notice: number; optional?: number; healthy: number };
  issues?: Finding[];
  findings?: Finding[];
  engines?: { engine: string; status: string; critical: number; warning: number; href: string }[];
  events?: { at: string; type: string; message: string }[];
  onboarding?: { status?: string; choices?: string[] } | null;
  proposals?: Proposal[];
  panelGuides?: { id: string; label: string; href: string; page: string; resourceType?: string; suggestedName?: string; destination: string; configured: boolean }[];
  settings?: {
    mode: string;
    repairEnabled: boolean;
    autopilotEnabled?: boolean;
    automaticProvisioningEnabled?: boolean;
    trackedEnginesConfigured?: boolean;
    trackedEngines?: string[];
    resourceNameOverrides?: Record<string, string>;
    selectedRoleMappings?: string[];
    rewardRoleSelections?: string[];
    customRoleNames?: string[];
    customChannelNames?: string[];
    categoryNameOverrides?: Record<string, string>;
    resourceCounts?: Record<string, number>;
    vipPrivateResourceKeys?: string[];
    setupTuning?: Record<string, unknown>;
  };
  featureCatalog?: FeatureOption[];
  allEngines?: { engine: string; label: string; requirements: number }[];
  trackedEngineCount?: number;
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
  plan?: SetupPlan;
  activePlan?: ActiveSetupPlan | null;
  record?: { settings?: { mode?: string; repairEnabled?: boolean; autopilotEnabled?: boolean; automaticProvisioningEnabled?: boolean; trackedEngines?: string[] | null } };
  export?: { body?: string };
};

type Notice = { id: number; tone: "ok" | "err"; title: string; detail?: string };
type PendingWrite = { title: string; detail: string; confirmLabel: string; body: Record<string, unknown> };
type CompensationItem = { actionId: string; status: string; reason?: string; resourceId?: string };
type CompensationPreview = {
  ok: boolean;
  planId: string;
  planState: string;
  previewToken: string;
  items: CompensationItem[];
  canExecute: boolean;
  deletesResources: false;
};
type DialogKind = "repair" | "adapt" | "setup-plan" | "compensation" | "";

function isPanelField(row: { engine: string; field: string }) {
  return /deploy/i.test(`${row.engine}:${row.field}`);
}

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

function settingsForInfrastructurePlan(report: Report | null): Record<string, unknown> {
  const settings = (report?.settings || {}) as NonNullable<Report["settings"]>;
  const selectedByCatalog = (report?.featureCatalog || [])
    .filter((feature) => feature.selectionStatus === "selected")
    .map((feature) => feature.id);
  const trackedEngines = settings.trackedEnginesConfigured === true
    ? settings.trackedEngines || []
    : selectedByCatalog;
  return {
    mode: "full-setup",
    trackedEngines,
    selectedRoleMappings: settings.selectedRoleMappings || [],
    rewardRoleSelections: settings.rewardRoleSelections || [],
    customRoleNames: settings.customRoleNames || [],
    customChannelNames: settings.customChannelNames || [],
    resourceNameOverrides: settings.resourceNameOverrides || {},
    categoryNameOverrides: settings.categoryNameOverrides || {},
    resourceCounts: settings.resourceCounts || {},
    vipPrivateResourceKeys: settings.vipPrivateResourceKeys || [],
    setupTuning: settings.setupTuning || {},
    autopilotEnabled: settings.autopilotEnabled === true,
    automaticProvisioningEnabled: settings.automaticProvisioningEnabled === true,
  };
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
    if (Object.prototype.hasOwnProperty.call(body, "automaticProvisioningEnabled")) {
      return {
        title: `Automatic resource creation ${body.automaticProvisioningEnabled ? "enabled" : "disabled"}`,
        lines: [
          body.automaticProvisioningEnabled
            ? "Missing non-panel resources may be created for tracked engines. Uncertain creates require manual review."
            : "Missing Discord resources will be reported for owner review.",
          "Existing mappings and protected onboarding, verification, pre-onboarding, and Heist flows stay unchanged.",
        ],
      };
    }
    if (Object.prototype.hasOwnProperty.call(body, "autopilotEnabled")) {
      return {
        title: `Infrastructure Autopilot ${body.autopilotEnabled ? "enabled" : "disabled"}`,
        lines: [
          body.autopilotEnabled
            ? "Unique, unambiguous reroutes may run automatically. If Repair is enabled, only previously setup-owned resources with verified deletion receipts and no name collision can be recreated; ambiguous cases require owner review."
            : "Infrastructure will monitor and report findings without automatic repairs.",
          "Roles, permissions, protected flows, and healthy mappings are never changed automatically.",
        ],
      };
    }
    if (Object.prototype.hasOwnProperty.call(body, "trackedEngines")) {
      return { title: "Server features saved", lines: [`Enabled ${Array.isArray(body.trackedEngines) ? body.trackedEngines.length : 0} feature systems. Infrastructure will only track selected systems.`, "No Discord resources were created or changed."] };
    }
    if (Object.prototype.hasOwnProperty.call(body, "repairEnabled")) {
      return {
        title: `Repair ${body.repairEnabled ? "enabled" : "disabled"}`,
        lines: ["Repair eligibility changed for this server.", "No Discord resources were changed."],
      };
    }
    if (Object.prototype.hasOwnProperty.call(body, "trackedEngines")) {
      const count = Array.isArray(body.trackedEngines) ? body.trackedEngines.length : 0;
      return {
        title: "Tracked features updated",
        lines: [
          count ? `Infrastructure will only check/create resources for ${count} selected feature${count === 1 ? "" : "s"}.` : "Infrastructure tracking is set to all features.",
          "Run Scan to refresh health for the selected features.",
        ],
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
        ...(result.channelCreationDisabled ? ["Channel and category creation is disabled; configure existing resources manually."] : []),
        ...(result.message ? [String(result.message)] : []),
      ],
    };
  }
  if (action === "repair") {
    const names = nameList(result.repaired);
    return {
      title: `Repair recreated ${countOf(result.repaired)} resource${countOf(result.repaired) === 1 ? "" : "s"}`,
      lines: [...(names.length ? [`Recreated: ${names.join(", ")}`] : []), ...(result.message ? [String(result.message)] : []), ...rowsOf(result.failed).slice(0, 4).map((row) => String(row.error || row.reason || "Manual review required."))],
    };
  }
  if (action === "plan-compensate") {
    const summary = (result.compensation || {}) as Record<string, number>;
    return {
      title: result.completed === true ? "Previous setup state restored" : "Restore finished with items for review",
      lines: [
        `${summary.completed || 0} changes restored`,
        `${summary.alreadyCompensated || 0} already restored`,
        `${summary.retainedResources || 0} created resources retained (not deleted)`,
        `${(summary.conflicts || 0) + (summary.manualReview || 0) + (summary.failed || 0)} items need review`,
      ],
    };
  }
  if (action === "approve") {
    const applied = countOf(result.applied);
    return {
      title: applied ? `Connected ${applied} destination${applied === 1 ? "" : "s"}` : "No destination connected",
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
  confirmDisabled = false,
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
  confirmDisabled?: boolean;
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
            disabled={busy || locked || confirmDisabled}
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
  const [activePlan, setActivePlan] = useState<ActiveSetupPlan | null>(null);
  const [planProgress, setPlanProgress] = useState("");
  const [query, setQuery] = useState("");
  const [showAllHealth, setShowAllHealth] = useState(false);
  const [showAllMappings, setShowAllMappings] = useState(false);
  const [routes, setRoutes] = useState<Record<string, string>>({});
  const [choices, setChoices] = useState<Record<string, string>>({});
  const [allowSharedResources, setAllowSharedResources] = useState<Record<string, boolean>>({});
  const [busyAction, setBusyAction] = useState("");
  const [notices, setNotices] = useState<Notice[]>([]);
  const [confirm, setConfirm] = useState<DialogKind>("");
  const [preview, setPreview] = useState<AdaptPreview | null>(null);
  const [compensationPreview, setCompensationPreview] = useState<CompensationPreview | null>(null);
  const [pending, setPending] = useState<PendingWrite | null>(null);
  const inFlight = useRef(false);
  const loadSequence = useRef(0);
  const loadedContext = useRef("");
  const lastLoadAt = useRef(0);
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
    let active = true;
    const load = (force = false) => {
      const nextGuild = readDashboardGuildId();
      const nextUser = readDashboardUserId();
      const context = `${nextGuild}:${nextUser}`;
      const contextChanged = context !== loadedContext.current;
      const now = Date.now();
      if (!force && !contextChanged) return;
      if (force && !contextChanged && now - lastLoadAt.current < 10_000) return;
      loadedContext.current = context;
      lastLoadAt.current = now;
      const sequence = ++loadSequence.current;
      setGuildId(nextGuild);
      setUserId(nextUser);
      setReport(null);
      setActivePlan(null);
      setPlanProgress("");
      setCompensationPreview(null);
      if (!nextGuild) return;
      fetch(`/api/bot/infrastructure?guildId=${encodeURIComponent(nextGuild)}&userId=${encodeURIComponent(nextUser)}`, { cache: "no-store" })
        .then(async (response) => {
          const json = await readJson(response);
          if (!response.ok || json.success === false) throw new Error(json.error || "Could not load the saved scan.");
          if (!active || sequence !== loadSequence.current || readDashboardGuildId() !== nextGuild) return;
          if (json.report && String((json.report as Report & { guildId?: string }).guildId || nextGuild) !== nextGuild) {
            throw new Error("The infrastructure response belonged to a different server and was discarded.");
          }
          setReport(json.report || null);
          setActivePlan(json.activePlan || null);
        })
        .catch((error: unknown) => {
          if (active && sequence === loadSequence.current) notify("err", "Could not load the saved scan", error instanceof Error ? error.message : "Request failed");
        });
    };
    load();
    const refresh = () => load(true);
    const refreshForStorage = (event: StorageEvent) => {
      if (["activeGuildId", "activeGuildName", "dashboardUserId", "dashboardUserRoleIds"].includes(event.key || "")) refresh();
    };
    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") refresh();
    };
    window.addEventListener("popstate", refresh);
    window.addEventListener("storage", refreshForStorage);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refreshWhenVisible);
    return () => {
      active = false;
      window.removeEventListener("popstate", refresh);
      window.removeEventListener("storage", refreshForStorage);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
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
    if (readDashboardGuildId() !== guildId || readDashboardUserId() !== userId) {
      notify("err", "Server selection changed", "Reload the page for the selected server before applying infrastructure changes.");
      return;
    }
    const needsPanelPolicy = ["approve", "provision", "repair", "decide"].includes(String(body.action)) ||
      (body.action === "adapt" && body.confirmed === true) ||
      (body.action === "settings" && (body.autopilotEnabled === true || body.automaticProvisioningEnabled === true));
    if (needsPanelPolicy && report?.panelSetupPolicy !== "channel-destinations-v2") {
      notify("err", "Update the bot first", "This bot has not confirmed the owner-approved panel destination channel policy.");
      return;
    }
    if (needsPanelPolicy && report?.channelCreationPolicy !== "single-post-v1") {
      notify("err", "Update the bot first", "This bot has not confirmed the single-request creation policy.");
      return;
    }
    const before = report?.healthScore;
    inFlight.current = true;
    setBusyAction(actionKey);
    try {
      const response = await fetch("/api/bot/infrastructure", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...body, guildId, userId }),
      });
      const json = await readJson(response);
      if (readDashboardGuildId() !== guildId || readDashboardUserId() !== userId) return;
      if (!response.ok || json.success === false) {
        notify("err", `Request failed (${response.status})`, json.error || "The bot API did not return an error message.");
        return;
      }
      if (body.action === "plan-compensation-preview") {
        const next = json.result as unknown as CompensationPreview | undefined;
        if (!next?.ok || !next.previewToken) {
          notify("err", "Compensation preview unavailable", json.error || "The saved plan cannot be safely restored.");
          return;
        }
        setCompensationPreview(next);
        setConfirm("compensation");
        notify("ok", "Restore preview ready",
          `${next.items.filter((item) => item.status === "ready").length} changes can be restored. Discord resources will not be deleted.`);
        return;
      }
      if (body.action === "plan-preview") {
        if (!json.plan) {
          notify("err", "Setup plan was not returned", "The bot did not save a reviewable plan, so nothing was changed.");
          return;
        }
        const nextPlan: ActiveSetupPlan = { plan: json.plan, canResume: true, canCancel: true, canCompensate: false };
        setActivePlan(nextPlan);
        setPlanProgress("");
        const summary = summarizeSetupPlan(json.plan.actions);
        if (summary.total) setConfirm("setup-plan");
        notify("ok", summary.total ? "Plan ready for approval" : "No changes to apply",
          summary.total
            ? `${summary.channels} channels, ${summary.roles} roles, ${summary.categories} categories to create · ${summary.mappings} destinations to connect. Approve the plan to apply it.`
            : "No new connections were found. You can choose a destination for any unresolved field below.");
        return;
      }
      if (json.result?.duplicate === true || json.result?.stale === true) {
        if ((rowsOf(json.result?.planned) as unknown as AdaptRow[]).some(isPanelField)) {
          notify("err", "Panel deployment refused", "Infrastructure can map an approved destination channel but cannot deploy a panel message.");
          return;
        }
        const planned = rowsOf(json.result?.planned) as unknown as AdaptRow[];
        if (!planned.length) {
          setPreview(null);
          setConfirm("");
          notify("err", json.result?.stale ? "Inventory changed; nothing to apply" : "No mappings to apply", String(json.result?.reason || "There are no unique empty mappings. Use Server Setup to review missing resources."));
          return;
        }
        setPreview({ wrote: false, planned, skipped: rowsOf(json.result?.skipped) as unknown as { id: string; reason: string }[] });
        setConfirm("adapt");
        notify("err", "The inventory changed", String(json.result?.reason || "Review the new preview before applying."));
        return;
      }
      if (json.preview) {
        if ((json.preview.planned || []).some(isPanelField)) {
          notify("err", "Panel mapping refused", "Update the bot before running setup; configure panels separately.");
          return;
        }
        if (!(json.preview.planned || []).length) {
          setPreview(null);
          const skipped = (json.preview.skipped || []).slice(0, 3).map((row) => `${row.id}: ${row.reason}`).join(" · ");
          notify("ok", "No existing resources matched uniquely", skipped || "Auto-Adapt only fills empty mappings when one existing Discord resource is an unambiguous match. Use Build setup plan to review creating missing resources.");
          return;
        }
        setPreview(json.preview);
        setConfirm("adapt");
        notify("ok", "Preview ready", `${json.preview.planned?.length || 0} empty mapping${json.preview.planned?.length === 1 ? "" : "s"} can be filled. Nothing was written.`);
        return;
      }
      setPreview(null);
      setConfirm("");
      setPending(null);
      if (body.action === "plan-compensate") setCompensationPreview(null);
      const refreshedResponse = await fetch(`/api/bot/infrastructure?guildId=${encodeURIComponent(guildId)}&userId=${encodeURIComponent(userId)}`, { cache: "no-store" });
      const refreshed = await readJson(refreshedResponse).catch(() => ({} as ApiJson));
      const nextReport = refreshed.report || json.report || null;
      if (nextReport?.guildId && String(nextReport.guildId) !== guildId) {
        notify("err", "Response discarded", "The infrastructure response belonged to a different server; no result was shown.");
        return;
      }
      setReport(nextReport);
      setActivePlan(refreshed.activePlan || null);
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

  async function executeSetupPlan() {
    const initial = activePlan?.plan;
    if (!initial || !guildId || !userId) {
      notify("err", "No saved setup plan", "Build a plan for the selected server before approving or resuming it.");
      return;
    }
    if (inFlight.current) {
      notify("err", "An operation is already running", "Wait for the current infrastructure operation to finish.");
      return;
    }
    if (readDashboardGuildId() !== guildId || readDashboardUserId() !== userId) {
      notify("err", "Server selection changed", "Reload this page for the currently selected server before continuing the plan.");
      return;
    }

    inFlight.current = true;
    setBusyAction("setup-plan");
    setConfirm("");
    let currentPlan = initial;
    const total = Math.max(currentPlan.actions.length, 1);
    const sendPlanRequest = async (action: string, extra: Record<string, unknown> = {}) => {
      const response = await fetch("/api/bot/infrastructure", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action, guildId, userId, planId: currentPlan.id, ...extra }),
      });
      const json = await readJson(response);
      if (readDashboardGuildId() !== guildId || readDashboardUserId() !== userId) {
        throw new Error("The selected server changed. The plan was stopped before another action could run.");
      }
      return { response, json };
    };

    try {
      if (currentPlan.state === "draft") {
        const { response, json } = await sendPlanRequest("plan-approve", { digest: currentPlan.digest });
        const approval = json.result as { plan?: SetupPlan; error?: string } | undefined;
        if (!response.ok || json.success === false || !approval?.plan) {
          if (approval?.plan) {
            currentPlan = approval.plan;
            setActivePlan({ plan: currentPlan, canResume: false, canCancel: true });
          }
          notify("err", "Setup plan was not approved", json.error || approval?.error || "The server rejected the saved plan; no action was started.");
          return;
        }
        currentPlan = approval.plan;
        setActivePlan({ plan: currentPlan, canResume: true, canCancel: true });
      } else if (["partial", "failed", "recovery_required"].includes(currentPlan.state)) {
        const { response, json } = await sendPlanRequest("plan-resume");
        const resumed = json.result as { plan?: SetupPlan; error?: string } | undefined;
        if (!response.ok || json.success === false || !resumed?.plan) {
          notify("err", "Setup plan could not resume", json.error || resumed?.error || "The saved plan is not in a resumable state.");
          return;
        }
        currentPlan = resumed.plan;
      } else if (!["approved", "running"].includes(currentPlan.state)) {
        notify("err", "Setup plan needs review", `The saved plan is ${currentPlan.state}. Create a fresh preview or resolve its recorded failure first.`);
        return;
      }

      setPlanProgress(`Approved · ${currentPlan.actions.filter((action) => action.status === "completed" || action.status === "skipped").length} of ${total} checkpoints complete.`);
      setActivePlan({ plan: currentPlan, canResume: true, canCancel: true });

      // The bot API executes exactly one durable, verified action per request.
      // Keep requests sequential so dependencies and checkpoints are respected.
      for (let step = 0; step < total + 2; step += 1) {
        const completed = currentPlan.actions.filter((action) => ["completed", "skipped"].includes(action.status)).length;
        setPlanProgress(`Running checkpoint ${Math.min(completed + 1, total)} of ${total} · ${completed} verified.`);
        const { response, json } = await sendPlanRequest("plan-run");
        const result = json.result as { plan?: SetupPlan; completed?: boolean; error?: string; resumable?: boolean; action?: SetupPlanAction } | undefined;
        if (result?.plan) {
          currentPlan = result.plan;
          setActivePlan({ plan: currentPlan, canResume: result.resumable !== false, canCancel: true });
        }
        if (json.report) setReport(json.report);
        if (!response.ok || json.success === false) {
          notify("err", "Setup plan paused", json.error || result?.error || "The bot rejected the next checkpoint. Completed work remains saved.");
          break;
        }
        if (result?.error) {
          notify("err", result.resumable ? "Setup plan paused safely" : "Setup plan needs recovery", `${result.error} Completed resources and checkpoints are preserved.`);
          break;
        }
        const done = result?.completed === true || currentPlan.state === "succeeded";
        const nowCompleted = currentPlan.actions.filter((action) => ["completed", "skipped"].includes(action.status)).length;
        setPlanProgress(done ? `Complete · ${nowCompleted} of ${currentPlan.actions.length} checkpoints verified.` : `Checkpoint verified · ${nowCompleted} of ${currentPlan.actions.length} complete.`);
        if (done) {
          const summary = summarizeSetupPlan(currentPlan.actions, true);
          notify("ok", summary.creates || summary.mappings ? "Infrastructure changes applied" : "No Discord resources changed",
            `${summary.creates} resources created and verified · ${summary.mappings} existing destinations connected.`);
          break;
        }
        if (step === total + 1) notify("err", "Setup plan paused", "The plan did not reach a terminal state within its recorded action count. Its checkpoints are saved; resume it to continue.");
      }

      const refreshedResponse = await fetch(`/api/bot/infrastructure?guildId=${encodeURIComponent(guildId)}&userId=${encodeURIComponent(userId)}`, { cache: "no-store" });
      const refreshed = await readJson(refreshedResponse);
      if (readDashboardGuildId() === guildId && readDashboardUserId() === userId) {
        if (refreshed.report) setReport(refreshed.report);
        setActivePlan(refreshed.activePlan || null);
      }
    } catch (error: unknown) {
      notify("err", "Setup plan paused", error instanceof Error ? error.message : "The request failed. Completed checkpoints remain saved.");
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

  const locked = Boolean(busyAction);
  const busyLabel = busyAction ? `Running ${busyAction.replace(/-/g, " ")}` : "";

  const rows = useMemo(() => {
    const directory = report?.directory;
    const all = [
      ...(directory?.categories || []).map((row) => ({ ...row, kind: "category" })),
      ...(directory?.channels || []),
      ...(directory?.roles || []).map((row) => ({ ...row, kind: "role" })),
    ];
    const categoryNames = new Map((directory?.categories || []).map((row) => [row.id, row.name]));
    const needle = query.trim().toLowerCase();
    return needle ? all.filter((row) => `${row.name} ${row.kind || ""} ${categoryNames.get(row.parentId || "") || ""}`.toLowerCase().includes(needle)) : all;
  }, [report, query]);
  const engineRows = useMemo(() => {
    const summaries = new Map((report?.engines || []).map((engine) => [engine.engine, engine]));
    const explicitSelection = report?.settings?.trackedEnginesConfigured === true;
    const tracked = new Set(report?.settings?.trackedEngines || []);
    return (report?.allEngines || []).map((entry) => {
      const summary = summaries.get(entry.engine);
      const isTracked = !explicitSelection || tracked.has(entry.engine);
      return {
        ...entry,
        status: summary?.status || (isTracked ? "selected" : "available"),
        critical: summary?.critical || 0,
        warning: summary?.warning || 0,
        href: summary?.href || "/dashboard/server-setup",
        tracked: isTracked,
      };
    });
  }, [report]);
  const healthFindings = (report?.findings || report?.issues || []).filter((finding) => !isPanelField(finding));
  const pendingMappings = (report?.proposals || []).filter((proposal) => proposal.status !== "populated" && !isPanelField(proposal));
  const activePlanSummary = summarizeSetupPlan(activePlan?.plan.actions || [], activePlan?.plan.state === "succeeded");
  const planPermissionBlocked = Boolean(activePlan?.plan.actions.some((action) =>
    action.type === "create_resource" && action.permissionStatus !== "verified"
  ));
  const selectedFeatureCount = report?.settings?.trackedEnginesConfigured === true
    ? (report.settings.trackedEngines || []).length
    : (report?.featureCatalog || []).filter((feature) => feature.selectionStatus === "selected").length;

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

<section className="relative overflow-hidden rounded-2xl border border-pink-700/40 bg-gradient-to-br from-[#240912] via-[#10070d] to-black p-5 shadow-[0_18px_70px_rgba(110,12,48,0.18)] possum-border sm:p-7">
        <div aria-hidden="true" className="pointer-events-none absolute -right-20 -top-28 h-72 w-72 rounded-full border border-pink-400/10 bg-pink-500/[0.04] blur-2xl" />
        <div className="relative">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-[11px] font-black uppercase tracking-[0.28em] text-pink-200/80">Possum · Server Intelligence</p>
            <span className="inline-flex items-center gap-2 rounded-full border border-pink-500/30 bg-black/35 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.16em] text-pink-100"><span className="h-1.5 w-1.5 rounded-full bg-pink-300 shadow-[0_0_12px_rgba(249,168,212,0.9)]" /> {report?.ready ? "Live inventory" : "Awaiting first scan"}</span>
          </div>
          <h1 className="mt-3 max-w-4xl text-3xl font-black uppercase leading-[1.04] tracking-[0.035em] text-white sm:text-4xl">Setup &amp; Infrastructure</h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-rose-100/80 sm:text-base">Your server, understood. Possum maps the systems you enable to the roles, channels, categories, permissions, and configuration they depend on. Review the plan, approve the changes, and verify what was actually applied.</p>
          <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <div className="rounded-xl border border-white/10 bg-black/35 p-3"><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-pink-200/65">Health score</p><p className="mt-1 text-2xl font-black tabular-nums text-white">{report?.healthScore ?? "—"}<span className="ml-1 text-xs font-bold text-pink-100/50">/ 100</span></p></div>
            <div className="rounded-xl border border-white/10 bg-black/35 p-3"><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-pink-200/65">Configured</p><p className="mt-1 text-2xl font-black tabular-nums text-white">{report?.setup?.configured ?? "—"}</p></div>
            <div className="rounded-xl border border-white/10 bg-black/35 p-3"><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-pink-200/65">Needs attention</p><p className="mt-1 text-2xl font-black tabular-nums text-amber-200">{report?.setup?.needsAttention ?? report?.counts?.critical ?? "—"}</p></div>
            <div className="rounded-xl border border-white/10 bg-black/35 p-3"><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-pink-200/65">Systems tracked</p><p className="mt-1 text-2xl font-black tabular-nums text-white">{report?.trackedEngineCount ?? (report?.allEngines?.length ?? "—")}</p></div>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-rose-100/65"><span>{report?.counts?.critical ?? 0} critical</span><span>{report?.counts?.warning ?? 0} warnings</span><span>{report?.counts?.optional ?? report?.counts?.notice ?? 0} optional</span><span>{report?.setup?.missing ?? 0} missing mappings</span></div>
        </div>
        {report?.onboarding?.status === "needs-choice" ? (
          <p className="mt-2 text-sm text-pink-100">This server was just discovered. Open Server Setup to choose systems, review resource names, and approve setup.</p>
        ) : null}
        <p className="mt-2 text-sm text-pink-100/80">{report?.ready ? "Observed by the saved scan." : report?.reason || "Scan the server to build a read-only directory."}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <ActionButton label="Scan" tip="Read the server directory and health. Does not write engine configuration." busy={busyAction === "scan"} busyLabel="Scanning…" locked={locked} onClick={() => post("scan", { action: "scan" })} />
          <ActionButton label="Connect existing server" tip="Scan this server for clear channel, category, and role matches. Review the feature mappings before applying them."
            busy={busyAction === "connect-existing"} busyLabel="Finding matches…" locked={locked}
            onClick={() => post("connect-existing", { action: "plan-preview", settings: { connectExisting: true } })} />
          <ActionButton label="Plan missing resources" tip="Review missing resources for systems selected in Server Setup."
            busy={busyAction === "setup-plan-preview"} busyLabel="Planning…" locked={locked || selectedFeatureCount === 0}
            onClick={() => post("setup-plan-preview", { action: "plan-preview", settings: settingsForInfrastructurePlan(report) })} />
          <a href="/dashboard/server-setup" className="inline-flex min-h-10 items-center rounded-lg border possum-divider px-3 text-sm font-black uppercase">Guided Server Setup</a>
          <span className={`inline-flex min-h-10 items-center gap-2 rounded-md border px-3 py-2 text-xs font-black uppercase ${report?.settings?.autopilotEnabled ? "border-emerald-700/70 bg-emerald-950/50 text-emerald-100" : "border-red-900/60 bg-black/40 text-red-200"}`} aria-label={`Autopilot is ${report?.settings?.autopilotEnabled ? "on" : "off"}`}><span aria-hidden="true">{report?.settings?.autopilotEnabled ? "●" : "○"}</span> Autopilot: {report?.settings?.autopilotEnabled ? "ON" : "OFF"}</span>
          <ActionButton label={report?.settings?.autopilotEnabled ? "Turn autopilot off" : "Turn autopilot on"} tip="Autopilot only reroutes to unique existing destinations or repairs previously setup-owned resources after verified deletion. It never changes protected onboarding, verification, pre-onboarding, or Heist flows." busy={busyAction === "autopilot-toggle"} busyLabel="Saving…" locked={locked || (!report?.settings?.autopilotEnabled && selectedFeatureCount === 0)} onClick={() => post("autopilot-toggle", { action: "settings", autopilotEnabled: !report?.settings?.autopilotEnabled })} />
          <span className={`inline-flex min-h-10 items-center gap-2 rounded-md border px-3 py-2 text-xs font-black uppercase ${report?.settings?.automaticProvisioningEnabled ? "border-emerald-700/70 bg-emerald-950/50 text-emerald-100" : "border-red-900/60 bg-black/40 text-red-200"}`} aria-label={`Automatic resource creation is ${report?.settings?.automaticProvisioningEnabled ? "on" : "off"}`}><span aria-hidden="true">{report?.settings?.automaticProvisioningEnabled ? "●" : "○"}</span> Auto-create: {report?.settings?.automaticProvisioningEnabled ? "ON" : "OFF"}</span>
          <ActionButton label={report?.settings?.automaticProvisioningEnabled ? "Turn auto-create off" : "Turn auto-create on"} tip="Automatic resource creation is separate from a reviewed setup plan. It applies only to missing non-panel resources for selected systems." busy={busyAction === "provisioning-toggle"} busyLabel="Saving…" locked={locked || (!report?.settings?.automaticProvisioningEnabled && selectedFeatureCount === 0)} onClick={() => post("provisioning-toggle", { action: "settings", automaticProvisioningEnabled: !report?.settings?.automaticProvisioningEnabled })} />
          <span className={`inline-flex min-h-10 items-center gap-2 rounded-md border px-3 py-2 text-xs font-black uppercase ${report?.settings?.repairEnabled ? "border-emerald-700/70 bg-emerald-950/50 text-emerald-100" : "border-red-900/60 bg-black/40 text-red-200"}`} aria-label={`Setup-owned resource repair is ${report?.settings?.repairEnabled ? "on" : "off"}`}><span aria-hidden="true">{report?.settings?.repairEnabled ? "●" : "○"}</span> Repair: {report?.settings?.repairEnabled ? "ON" : "OFF"}</span>
          <ActionButton label={report?.settings?.repairEnabled ? "Turn repair off" : "Turn repair on"} tip="Repair only recreates resources Possum previously created and recorded. It first verifies the exact old Discord resource is gone and refuses to create if a same-name resource exists." busy={busyAction === "repair-toggle"} busyLabel="Saving…" locked={locked || (!report?.settings?.repairEnabled && selectedFeatureCount === 0 && !(report?.settings?.customRoleNames?.length || report?.settings?.customChannelNames?.length))} onClick={() => post("repair-toggle", { action: "settings", repairEnabled: !report?.settings?.repairEnabled })} />
          <ActionButton label="Repair missing resources" tip="Recreate only setup-owned resources with a matching durable create receipt after Discord confirms the old resource is deleted. Same-name collisions and uncertain receipts require manual review." busy={busyAction === "repair"} busyLabel="Repairing…" locked={locked || report?.settings?.repairEnabled !== true} onClick={() => ask({ title: "Repair missing setup resources?", detail: "Possum will refresh this server's channels and roles, verify each setup-owned resource is actually gone, and check that no same-name replacement already exists. Only then will it recreate that resource and verify the new receipt. Uncertain creates, owner-created resources, protected flows, and ambiguous collisions are left untouched for manual review.", confirmLabel: "Repair verified resources", body: { action: "repair", confirmed: true } })} />
          <ActionButton label="JSON" tip="Download the directory as JSON." busy={busyAction === "export-json"} busyLabel="Exporting…" locked={locked} onClick={() => download("json")} />
          <ActionButton label="CSV" tip="Download the directory as CSV." busy={busyAction === "export-csv"} busyLabel="Exporting…" locked={locked} onClick={() => download("csv")} />
          <ActionButton label="TXT" tip="Download the directory as text." busy={busyAction === "export-txt"} busyLabel="Exporting…" locked={locked} onClick={() => download("txt")} />
        </div>
        <p className="mt-2 text-xs text-red-200/70">Mode {report?.settings?.mode || "discovery"}. Selected system groups control what health and Auto-Adapt consider. Protected onboarding, verification, pre-onboarding, and heist fields stay suggestion-only.</p>
        <p className="mt-2 text-xs text-red-200/70">Undo Setup is available in <a className="underline" href="/dashboard/server-setup">Server Setup</a> only to the current Discord server owner or globally authorized Possum emergency staff, not other administrators or dashboard roles.</p>
        <p className="mt-1 text-xs text-red-200/70">Undo Setup is currently disabled until dashboard sessions and bot ingress are isolated from other services.</p>
        <p className="mt-1 text-xs text-red-200/70"><a className="underline" href="/emergency-undo">Emergency access by server ID</a> is available without dashboard manager access.</p>
      </section>

      {activePlan?.plan ? (
        <section className="rounded-xl border possum-divider bg-black/50 p-4 possum-border" aria-labelledby="setup-plan-heading">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.18em] possum-soft">Persistent setup execution</p>
              <h2 id="setup-plan-heading" className="mt-1 text-lg font-black uppercase text-red-200">
                {activePlan.plan.state === "succeeded" ? "Setup applied" : activePlan.plan.state === "draft" ? "Awaiting approval" : `Setup · ${activePlan.plan.state.replace(/_/g, " ")}`}
              </h2>
              <p className="mt-1 text-sm text-pink-100/80">{activePlan.plan.state === "succeeded"
                ? `${activePlanSummary.creates} created · ${activePlanSummary.mappings} existing destinations connected`
                : `${activePlanSummary.creates} to create · ${activePlanSummary.mappings} existing destinations to connect`}</p>
              <p className="mt-1 text-sm text-red-100/80">{activePlan.plan.actions.filter((action) => ["completed", "skipped"].includes(action.status)).length} of {activePlan.plan.actions.length} checkpoints verified{planProgress ? ` · ${planProgress}` : ""}</p>
              {activePlan.plan.updatedAt ? <p className="mt-1 text-[11px] text-pink-100/55">Last checkpoint update: {new Date(activePlan.plan.updatedAt).toLocaleString()}</p> : null}
              {activePlan.plan.finishedAt ? <p className="mt-1 text-[11px] text-pink-100/55">Plan closed: {new Date(activePlan.plan.finishedAt).toLocaleString()}</p> : null}
              <p className="mt-1 text-xs text-pink-100/70">Each bot request runs one checkpoint. The plan is saved on the bot, so an interrupted run can resume from its last verified action.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {activePlan.plan.state === "draft" && activePlan.canResume && activePlanSummary.total > 0 ? <ActionButton label="Review and apply" tip="Review every planned change before authorizing execution." busy={false} locked={locked} onClick={() => setConfirm("setup-plan")} /> : null}
              {activePlan.canResume && activePlan.plan.state !== "draft" ? <ActionButton label="Resume plan" tip="Continue the saved plan from its next safe checkpoint." busy={busyAction === "setup-plan"} busyLabel="Running…" locked={locked} onClick={() => void executeSetupPlan()} /> : null}
              {activePlan.canCancel ? <ActionButton label="Cancel plan" tip="Cancel pending actions. Anything already created stays and remains recorded." busy={false} locked={locked} onClick={() => ask({ title: "Cancel this saved plan?", detail: "Pending actions will stop. Anything already created stays in the server and is listed in the saved plan.", confirmLabel: "Cancel plan", body: { action: "plan-cancel", planId: activePlan.plan.id } })} /> : null}
              {activePlan.canCompensate ? <ActionButton label="Preview restore" tip="Review which previous settings and mappings can be restored. This never deletes Discord resources." busy={busyAction === "plan-compensation-preview"} busyLabel="Checking…" locked={locked} onClick={() => post("plan-compensation-preview", { action: "plan-compensation-preview", planId: activePlan.plan.id })} /> : null}
            </div>
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {activePlan.plan.actions.map((action) => (
              <div key={action.id} className="rounded-lg border border-red-900/40 px-3 py-2">
                <p className="text-xs uppercase tracking-[0.12em] text-pink-200">{action.status.replace(/_/g, " ")} · {action.type.replace(/_/g, " ")}</p>
                <p className="mt-1 text-sm font-bold text-red-100">{action.name || action.resourceName || [action.engine, action.field].filter(Boolean).join(" · ") || action.flow || "Setup settings"}</p>
                {action.attempts ? <p className="mt-1 text-[11px] text-pink-100/55">Execution attempts: {action.attempts}</p> : null}
                {action.dependencies?.length ? <p className="mt-1 text-[11px] text-pink-100/55">Depends on: {action.dependencies.join(", ")}</p> : null}
                {action.missingPermissions?.length ? <p className="mt-1 text-xs text-amber-200">Needs bot permission: {action.missingPermissions.join(", ")}</p> : null}
                {action.result?.error || action.result?.reason ? <p className="mt-1 text-xs text-red-200">{action.result.error || action.result.reason}</p> : null}
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <section className="rounded-xl border possum-divider bg-black/50 p-4 possum-border">
        <h2 className="text-lg font-black uppercase text-red-200">Server health</h2>
        <div className="mt-3 space-y-2">
          {(showAllHealth ? healthFindings : healthFindings.slice(0, 6)).map((finding) => (
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
                        {(finding.resourceType === "role"
                          ? report?.directory?.roles || []
                          : finding.resourceType === "category"
                            ? report?.directory?.categories || []
                            : report?.directory?.channels || []).map((row) => (
                          <option key={row.id} value={row.id}>{row.name}</option>
                        ))}
                      </select>
                      <label className="inline-flex items-center gap-2 text-xs text-pink-100/80"><input type="checkbox" checked={allowSharedResources[`${finding.engine}:${finding.field}`] === true} onChange={(event) => setAllowSharedResources((current) => ({ ...current, [`${finding.engine}:${finding.field}`]: event.target.checked }))} /> Share destination with other features</label>
                      <ActionButton label="Use this" tip="Point this field at the selected existing Discord resource." busy={false} locked={locked || !routes[`${finding.engine}:${finding.field}`]} onClick={() => ask({ title: "Use this resource", detail: `${finding.engine}.${finding.field} will use the selected existing resource. Protected fields cannot be written.`, confirmLabel: "Use this", body: { action: "decide", engine: finding.engine, field: finding.field, decision: "reroute", channelId: routes[`${finding.engine}:${finding.field}`] || "", allowSharedResource: allowSharedResources[`${finding.engine}:${finding.field}`] === true } })} />
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
        {!healthFindings.length ? <p className="mt-2 text-sm text-pink-100/70">{report?.ready ? "No health findings for the selected systems." : "Scan the server to see health findings."}</p> : null}
        {healthFindings.length > 6 ? <button type="button" className="mt-3 text-sm font-bold underline" onClick={() => setShowAllHealth(!showAllHealth)}>{showAllHealth ? "Show fewer findings" : `Show all ${healthFindings.length} findings`}</button> : null}
      </section>

      <section className="rounded-xl border possum-divider bg-black/50 p-4 possum-border">
        <h2 className="text-lg font-black uppercase text-red-200">Link existing channels and roles</h2>
        <div className="mt-3 space-y-2">
          {(showAllMappings ? pendingMappings : pendingMappings.slice(0, 6)).map((proposal) => (
            <div key={proposal.id} className="rounded-lg border border-red-900/40 px-3 py-2">
              <p className="text-sm font-bold text-red-100">{proposal.engineLabel || proposal.engine}.{proposal.field}</p>
              {proposal.intendedName ? <p className="text-xs text-pink-100/70">Intended destination: {proposal.intendedName}</p> : null}
              <p className="text-xs text-pink-100/80">{proposal.status} · {proposal.reason}</p>
              {proposal.status === "ready" ? (
                <ActionButton label="Approve empty field" tip="Write the suggested resource into this empty field. A populated id is not overwritten." busy={false} locked={locked} onClick={() => ask({ title: "Approve empty field", detail: `${proposal.engine}.${proposal.field} will be filled only if it is still empty.`, confirmLabel: "Approve", body: { action: "approve", proposalIds: [proposal.id] } })} />
              ) : null}
              {!proposal.protectedFlow ? (
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <select aria-label={`Existing destination for ${proposal.intendedName || proposal.engine}`}
                    className="rounded-md border border-red-900/50 bg-black px-2 py-1 text-xs text-red-100" value={choices[proposal.id] || ""}
                    onChange={(event) => setChoices((current) => ({ ...current, [proposal.id]: event.target.value }))}>
                    <option value="">Choose an existing {proposal.resourceType || "channel"}</option>
                    {(proposal.resourceType === "role" ? report?.directory?.roles || []
                      : proposal.resourceType === "category" ? report?.directory?.categories || []
                        : (report?.directory?.channels || []).filter((row) => /voice/i.test(proposal.field)
                          ? row.kind === "voice" : /forum/i.test(proposal.field) ? row.kind === "forum" : ["text", "announcement"].includes(row.kind || "")))
                      .filter((row) => row.name !== "@everyone" && row.managed !== true)
                      .map((row) => <option key={row.id} value={row.id}>{row.name}{proposal.matches?.some((match) => match.id === row.id) ? " · suggested" : ""}</option>)}
                  </select>
                  <label className="inline-flex items-center gap-2 text-xs text-pink-100/80"><input type="checkbox" checked={allowSharedResources[proposal.id] === true} onChange={(event) => setAllowSharedResources((current) => ({ ...current, [proposal.id]: event.target.checked }))} /> Share destination with other features</label>
                  <ActionButton label="Connect destination" tip="Save the selected destination in this feature's dashboard settings."
                    busy={false} locked={locked || !choices[proposal.id]}
                    onClick={() => ask({
                      title: "Connect destination",
                      detail: `Save the selected resource for ${proposal.intendedName || proposal.engine}.`,
                      confirmLabel: "Connect",
                      body: { action: "approve", proposalIds: [proposal.id], selections: { [proposal.id]: choices[proposal.id] }, allowSharedResource: allowSharedResources[proposal.id] === true },
                    })} />
                </div>
              ) : null}
            </div>
          ))}
        </div>
        {!pendingMappings.length ? <p className="mt-2 text-sm text-pink-100/70">No pending mappings for the selected systems.</p> : null}
        {pendingMappings.length > 6 ? <button type="button" className="mt-3 text-sm font-bold underline" onClick={() => setShowAllMappings(!showAllMappings)}>{showAllMappings ? "Show fewer destinations" : `Show all ${pendingMappings.length} destinations`}</button> : null}
      </section>

      <section className="flex flex-wrap items-center justify-between gap-3 rounded-xl border possum-divider bg-black/50 p-4 possum-border">
        <div>
          <h2 className="text-lg font-black uppercase text-red-200">Need to plan panel destinations?</h2>
          <p className="mt-1 max-w-3xl text-sm text-red-100/75">Guided Server Setup owns the panel checklist. Infrastructure stays focused on scanning server resources, health, and saved mappings.</p>
        </div>
        <a href="/dashboard/server-setup" className="inline-flex min-h-10 items-center rounded-md border possum-divider px-3 text-sm font-bold">Open panel checklist</a>
      </section>

      <section className="rounded-xl border possum-divider bg-black/50 p-4 possum-border">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div><h2 className="text-lg font-black uppercase text-red-200">Managed feature systems</h2><p className="mt-1 text-xs text-pink-100/70">Every catalog feature is listed. Selected systems are scanned here; choose features and destinations in Server Setup.</p></div>
          <a href="/dashboard/server-setup" className="inline-flex min-h-9 items-center rounded-md border possum-divider px-3 text-xs font-bold">Manage feature selection</a>
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {engineRows.map((engine) => (
            <a key={engine.engine} href={engine.href} className="rounded-lg border border-red-900/40 px-3 py-2 hover:border-pink-700/70">
              <div className="flex items-start justify-between gap-2"><p className="text-sm font-bold text-red-100">{engine.label}</p><span className={`rounded px-2 py-0.5 text-[10px] font-black uppercase ${engine.status === "ready" ? "bg-emerald-950/70 text-emerald-200" : engine.tracked ? "bg-amber-950/70 text-amber-200" : "bg-slate-900 text-slate-300"}`}>{engine.status}</span></div>
              <p className="mt-1 text-xs text-pink-100/70">{engine.tracked ? `${engine.requirements} setup-managed resources · ${engine.critical} critical · ${engine.warning} warnings` : "Not selected for infrastructure tracking"}</p>
              <p className="mt-2 text-xs font-bold text-pink-200">{engine.href === "/dashboard/server-setup" ? "Select in Server Setup →" : "Open feature →"}</p>
            </a>
          ))}
          {!engineRows.length ? <p className="text-sm text-pink-100/70">Scan the server to load its feature catalog.</p> : null}
        </div>
      </section>

      <section className="rounded-xl border possum-divider bg-black/50 p-4 possum-border">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div><h2 className="text-lg font-black uppercase text-red-200">Operations</h2><p className="mt-1 text-sm text-red-100/80">Last inventory scan {report?.watch?.checkedAt ? new Date(report.watch.checkedAt).toLocaleString() : "not recorded"}. Current watch: {report?.watch?.ready ? "active" : "waiting for scan"}.</p></div>
          <div className="flex flex-wrap gap-2">
            <ActionButton label="Run scan" tip="Refresh server resources and health findings." busy={busyAction === "scan"} busyLabel="Scanning…" locked={locked} onClick={() => post("scan", { action: "scan" })} />
            <a href="/dashboard/operations" className="inline-flex min-h-10 items-center rounded-lg border possum-divider px-3 text-sm font-black uppercase">Operations center</a>
            <a href="/dashboard/security/audit-trail" className="inline-flex min-h-10 items-center rounded-lg border possum-divider px-3 text-sm font-black uppercase">Audit history</a>
          </div>
        </div>
        <div className="mt-3 space-y-2">
          {(report?.events || []).slice(0, 12).map((event) => (
            <p key={`${event.at}-${event.type}-${event.message}`} className="rounded-lg border border-red-900/40 px-3 py-2 text-xs text-red-100/80">{event.type} · {event.message}</p>
          ))}
          {!report?.events?.length ? <p className="text-xs text-pink-100/70">No infrastructure operations have been recorded for this server.</p> : null}
        </div>
      </section>

      <details className="rounded-xl border possum-divider bg-black/50 p-4 possum-border">
        <summary className="cursor-pointer text-lg font-black uppercase text-red-200">Channel and role inventory</summary>
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search channels, categories, or roles" className="mt-3 w-full rounded-lg border possum-divider bg-black/60 px-3 py-2 text-sm text-red-50" />
        <div className="mt-3 space-y-2">
          {rows.map((row) => (
            <div key={`${row.kind}-${row.id}`} className="flex items-center justify-between gap-3 rounded-lg border border-pink-900/40 px-3 py-2">
              <div>
                <p className="text-sm font-bold text-pink-100">{row.name}</p>
                <p className="text-xs uppercase tracking-[0.14em] text-red-300/80">
                  {row.kind}{row.parentId ? ` · ${report?.directory?.categories?.find((category) => category.id === row.parentId)?.name || "in a category"}` : ""}
                </p>
                {report?.createdResources?.some((resource) => resource.id === row.id) ? <p className="text-xs text-red-100/70">Created by Possum</p> : null}
              </div>
            </div>
          ))}
        </div>
      </details>

      <section className="rounded-xl border possum-divider bg-black/50 p-4 possum-border">
        <h2 className="text-lg font-black uppercase text-red-200">Continuous watch</h2>
        <p className="mt-2 text-sm text-red-100/80">Last check {report?.watch?.checkedAt ? new Date(report.watch.checkedAt).toLocaleString() : "—"} · Critical {report?.watch?.counts?.critical ?? 0} · Warning {report?.watch?.counts?.warning ?? 0} · Added {report?.watch?.added ?? 0} · Cleared {report?.watch?.resolved ?? 0}</p>
        <p className="mt-1 text-xs text-pink-100/70">{report?.settings?.autopilotEnabled ? "Autopilot can reroute to unique existing resources and repair only setup-owned resources with verified deletion receipts. Ambiguous collisions and uncertain creates stay in owner review." : "Read-only monitoring unless owner-approved repair is enabled."} {report?.settings?.automaticProvisioningEnabled ? "Automatic non-panel creation is also on for tracked engines." : "Missing resources are reported only; automatic creation is off."}</p>
        <div className="mt-3 space-y-2">
          {(report?.watch?.items || []).filter((entry) => !isPanelField(entry)).slice(0, 20).map((entry) => (
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
        detail="Only these empty mappings are written. Populated values stay. Protected heist, onboarding, verification, and pre-onboarding fields stay out. Ambiguous matches stay unassigned unless you explicitly choose a match; shared destinations are chosen one field at a time."
        confirmLabel="Apply these mappings"
        busy={busyAction === "adapt-apply"}
        locked={locked && busyAction !== "adapt-apply"}
        confirmDisabled={!preview?.planned?.length}
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
        open={confirm === "compensation" && Boolean(compensationPreview)}
        title="Restore the previous setup state?"
        detail="This restores only settings and mappings that still match the saved plan's safety checks. Discord resources created by the plan are retained; this operation does not delete channels or roles. Conflicts and uncertain changes remain for manual review."
        confirmLabel="Restore previous settings"
        busy={busyAction === "plan-compensate"}
        locked={locked && busyAction !== "plan-compensate"}
        confirmDisabled={!compensationPreview?.canExecute || !compensationPreview.items.some((item) => item.status === "ready")}
        onConfirm={() => {
          if (!compensationPreview) return;
          void post("plan-compensate", {
            action: "plan-compensate",
            planId: compensationPreview.planId,
            previewToken: compensationPreview.previewToken,
          });
        }}
        onCancel={() => { setConfirm(""); setCompensationPreview(null); }}
      >
        <div className="max-h-64 space-y-2 overflow-y-auto">
          {(compensationPreview?.items || []).map((item) => (
            <div key={item.actionId} className="rounded-lg border border-red-900/40 px-3 py-2">
              <p className="text-xs font-black uppercase text-pink-200">{item.status.replace(/_/g, " ")}</p>
              <p className="text-sm text-red-100">{item.actionId}</p>
              {item.reason ? <p className="mt-1 text-xs text-pink-100/70">{item.reason}</p> : null}
            </div>
          ))}
        </div>
      </ConfirmDialog>

      <ConfirmDialog
        open={confirm === "setup-plan" && Boolean(activePlan?.plan)}
        title={`Review ${activePlan?.plan.actions.length || 0} setup checkpoint${activePlan?.plan.actions.length === 1 ? "" : "s"}`}
        detail={activePlan?.plan.intent === "connect-existing"
          ? "Review the destinations the bot found in this server. Apply the plan to connect them to the listed feature settings."
          : "Review the exact resources to create and the existing destinations to connect."}
        confirmLabel="Apply reviewed plan"
        busy={busyAction === "setup-plan"}
        locked={locked && busyAction !== "setup-plan"}
        confirmDisabled={planPermissionBlocked || activePlanSummary.total === 0}
        onConfirm={() => void executeSetupPlan()}
        onCancel={() => setConfirm("")}
      >
        {planPermissionBlocked ? <p className="mb-2 rounded-lg border border-amber-700/60 bg-amber-950/30 p-2 text-xs text-amber-100">The bot is missing a required Discord permission for at least one planned resource. The plan cannot run until Discord permissions are corrected and a fresh preview is created.</p> : null}
        {activePlan?.plan.intent === "connect-existing" && activePlan.plan.actions.some((action) =>
          action.type === "configure_autopilot" && action.changes?.some((change) => change.key === "automaticProvisioningEnabled")) ? (
          <p className="mb-2 text-xs text-amber-100">This plan turns off Auto-create for this server so it can reuse your existing layout.</p>
        ) : null}
        <div className="max-h-72 space-y-2 overflow-y-auto">
          {(activePlan?.plan.actions || []).map((action) => (
            <div key={action.id} className="rounded-lg border border-red-900/50 px-3 py-2">
              <p className="text-xs uppercase tracking-[0.12em] text-pink-200">{action.type.replace(/_/g, " ")} · {action.resourceType || action.flow || "settings"}</p>
              <p className="mt-1 text-sm font-bold text-red-100">{action.name || action.resourceName || [action.engine, action.field].filter(Boolean).join(" · ") || action.flow || "Apply selected setup settings"}</p>
              {action.requiredPermissions?.length ? <p className="mt-1 text-xs text-pink-100/70">Bot permission: {action.requiredPermissions.join(", ")}{action.permissionStatus === "verified" ? " · verified" : " · not verified"}</p> : null}
            </div>
          ))}
        </div>
      </ConfirmDialog>


    </div>
  );
}
