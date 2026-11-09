"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { readDashboardGuildId, readDashboardUserId } from "@/lib/dashboardContext";

type Feature = {
  id: string;
  name: string;
  group: string;
  description: string;
  protected: boolean;
  selectable: boolean;
};

type Proposal = {
  id: string;
  engine: string;
  engineLabel?: string;
  field: string;
  status: string;
  reason: string;
  resourceType?: string;
  many?: boolean;
  protectedFlow?: boolean;
  proposedName?: string;
  intendedName?: string;
  suggestedName?: string;
  suggestedId?: string;
  matches?: { id: string; name: string }[];
  currentValue?: unknown;
};

type SetupTuning = {
  id: string;
  engine: string;
  field: string;
  label: string;
  min: number;
  max: number;
  step: number;
  value: number;
  currentValue: number;
  defaultValue: number;
  preserved: boolean;
};

type AdaptRow = {
  id: string;
  engine: string;
  field: string;
  resourceId: string;
  resourceName: string;
};

type SetupReport = {
  guildId?: string;
  ready?: boolean;
  reason?: string;
  featureCatalog?: Feature[];
  proposals?: Proposal[];
  setupTuning?: SetupTuning[];
  settings?: {
    mode?: string;
    autopilotEnabled?: boolean;
    automaticProvisioningEnabled?: boolean;
    trackedEngines?: string[] | null;
    trackedEnginesConfigured?: boolean;
    resourceNameOverrides?: Record<string, string>;
    categoryNameOverrides?: Record<string, string>;
    resourceCounts?: Record<string, number>;
  };
  setupCategories?: { group: string; name: string }[];
};

type ApiResponse = {
  success?: boolean;
  error?: string;
  report?: SetupReport;
  preview?: { planned?: AdaptRow[]; skipped?: { id: string; reason: string }[] };
  result?: {
    wrote?: boolean;
    stale?: boolean;
    duplicate?: boolean;
    applied?: string[];
    created?: { id?: string; name?: string; engine?: string; field?: string }[];
    failed?: { id?: string; engine?: string; field?: string; name?: string; error?: string; reason?: string }[];
    deferred?: number;
    message?: string;
  };
};

type CreationFailure = {
  id: string;
  name: string;
  error: string;
};

type PreviewSnapshot = {
  features: string[];
  names: Record<string, string>;
  categoryNames: Record<string, string>;
  resourceCounts: Record<string, number>;
  setupTuning: Record<string, number>;
  report: SetupReport;
  mappings: AdaptRow[];
  skippedMappings: { id: string; reason: string }[];
};

const GROUPS = [
  { id: "community", label: "Community" },
  { id: "moderation", label: "Moderation & Security" },
  { id: "economy", label: "Economy" },
  { id: "gaming", label: "Gaming" },
  { id: "fun", label: "Fun & Games" },
  { id: "social", label: "Social Alerts" },
  { id: "automation", label: "Automation" },
  { id: "support", label: "Support & Administration" },
];

function sorted(values: string[]) {
  return [...new Set(values)].sort();
}

function savedFeatureSelection(report: SetupReport | null) {
  const configured = report?.settings?.trackedEngines;
  return sorted(Array.isArray(configured) ? configured : (report?.featureCatalog || []).map((feature) => feature.id));
}

function sameNames(left: Record<string, string>, right: Record<string, string>) {
  const keys = new Set([...Object.keys(left), ...Object.keys(right)]);
  for (const key of keys) {
    if (String(left[key] || "") !== String(right[key] || "")) return false;
  }
  return true;
}

async function readJson(response: Response): Promise<ApiResponse> {
  let data: ApiResponse;
  try {
    data = (await response.json()) as ApiResponse;
  } catch {
    throw new Error(`The server returned an unreadable response (${response.status}).`);
  }
  if (!response.ok || data.success === false) {
    throw new Error(data.error || `The request failed (${response.status}).`);
  }
  return data;
}

function resourceName(proposal: Proposal, overrides: Record<string, string>) {
  return String(
    overrides[proposal.id] ||
      proposal.proposedName ||
      proposal.intendedName ||
      proposal.suggestedName ||
      proposal.field
  );
}

function sameCounts(left: Record<string, number>, right: Record<string, number>) {
  const keys = new Set([...Object.keys(left), ...Object.keys(right)]);
  for (const key of keys) {
    if (Number(left[key] || 1) !== Number(right[key] || 1)) return false;
  }
  return true;
}

function sameNumbers(left: Record<string, number>, right: Record<string, number>) {
  const keys = new Set([...Object.keys(left), ...Object.keys(right)]);
  for (const key of keys) {
    if (Number(left[key] ?? 0) !== Number(right[key] ?? 0)) return false;
  }
  return true;
}

function existingRoleCount(proposal: Proposal) {
  return Array.isArray(proposal.currentValue)
    ? proposal.currentValue.filter((value) => String(value || "").trim()).length
    : 0;
}

function targetRoleCount(proposal: Proposal, counts: Record<string, number>) {
  return Math.max(Number(counts[proposal.id] || 1), existingRoleCount(proposal));
}

export default function InfrastructureSetupWizard() {
  const [guildId, setGuildId] = useState("");
  const [userId, setUserId] = useState("");
  const [report, setReport] = useState<SetupReport | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [savedSelection, setSavedSelection] = useState<string[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [categoryNames, setCategoryNames] = useState<Record<string, string>>({});
  const [resourceCounts, setResourceCounts] = useState<Record<string, number>>({});
  const [setupTuning, setSetupTuning] = useState<Record<string, number>>({});
  const [autopilotEnabled, setAutopilotEnabled] = useState(false);
  const [automaticProvisioningEnabled, setAutomaticProvisioningEnabled] = useState(false);
  const [activeGroup, setActiveGroup] = useState(GROUPS[0].id);
  const [previewSnapshot, setPreviewSnapshot] = useState<PreviewSnapshot | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [created, setCreated] = useState<{ id?: string; name?: string; engine?: string; field?: string }[]>([]);
  const [creationFailures, setCreationFailures] = useState<CreationFailure[]>([]);
  const [batchProgress, setBatchProgress] = useState("");

  const callApi = useCallback(async (body: Record<string, unknown>) => {
    const response = await fetch("/api/bot/infrastructure", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ guildId, userId, ...body }),
      cache: "no-store",
    });
    return readJson(response);
  }, [guildId, userId]);

  const loadReport = useCallback(async () => {
    if (!guildId) return null;
    const response = await fetch(
      `/api/bot/infrastructure?guildId=${encodeURIComponent(guildId)}&userId=${encodeURIComponent(userId)}`,
      { cache: "no-store" }
    );
    const data = await readJson(response);
    const next = data.report || null;
    if (next) {
      setReport(next);
      const saved = savedFeatureSelection(next);
      setSelected(saved);
      setSavedSelection(saved);
      setNames(next.settings?.resourceNameOverrides || {});
      setCategoryNames(next.settings?.categoryNameOverrides || {});
      setResourceCounts(next.settings?.resourceCounts || {});
      setSetupTuning(Object.fromEntries((next.setupTuning || []).map((setting) => [setting.id, setting.value])));
      setAutopilotEnabled(next.settings?.autopilotEnabled === true);
      setAutomaticProvisioningEnabled(next.settings?.automaticProvisioningEnabled === true);
    }
    return next;
  }, [guildId, userId]);

  useEffect(() => {
    const nextGuild = readDashboardGuildId();
    const nextUser = readDashboardUserId();
    setGuildId(nextGuild);
    setUserId(nextUser);
    if (!nextGuild) {
      setLoading(false);
      return;
    }
    const params = new URLSearchParams({ guildId: nextGuild, userId: nextUser });
    fetch(`/api/bot/infrastructure?${params.toString()}`, { cache: "no-store" })
      .then(readJson)
      .then((data) => {
        const next = data.report || null;
        setReport(next);
        const saved = savedFeatureSelection(next);
        setSelected(saved);
        setSavedSelection(saved);
        setNames(next?.settings?.resourceNameOverrides || {});
        setCategoryNames(next?.settings?.categoryNameOverrides || {});
        setResourceCounts(next?.settings?.resourceCounts || {});
        setSetupTuning(Object.fromEntries((next?.setupTuning || []).map((setting) => [setting.id, setting.value])));
      })
      .catch((cause: unknown) => setError(cause instanceof Error ? cause.message : "Could not load this server's setup options."))
      .finally(() => setLoading(false));
  }, []);

  const features = useMemo(() => report?.featureCatalog || [], [report?.featureCatalog]);
  const featureById = useMemo(() => new Map(features.map((feature) => [feature.id, feature])), [features]);
  const selectedFeatures = useMemo(() => sorted(selected), [selected]);
  const selectionDirty = selectedFeatures.join("\n") !== savedSelection.join("\n");
  const proposals = useMemo(() => report?.proposals || [], [report?.proposals]);
  const createProposals = useMemo(
    () => proposals.filter((proposal) =>
      selected.includes(proposal.engine) &&
      !proposal.protectedFlow &&
      (
        proposal.status !== "populated" ||
        (proposal.many && proposal.resourceType === "role")
      )
    ),
    [proposals, selected]
  );
  const roleProposals = useMemo(
    () => createProposals.filter((proposal) => proposal.resourceType === "role"),
    [createProposals]
  );
  const channelProposals = useMemo(
    () => createProposals.filter((proposal) => proposal.resourceType !== "role" && proposal.resourceType !== "category"),
    [createProposals]
  );
  const explicitCategoryProposals = useMemo(
    () => createProposals.filter((proposal) => proposal.resourceType === "category"),
    [createProposals]
  );
  const resourcesToCreate = createProposals.reduce((count, proposal) => count + (
    proposal.many && proposal.resourceType === "role"
      ? Math.max(0, targetRoleCount(proposal, resourceCounts) - existingRoleCount(proposal))
      : 1
  ), 0) + (previewSnapshot?.report.setupCategories?.length || 0);
  const mappingCount = previewSnapshot?.mappings.length || 0;
  const skippedMappingCount = previewSnapshot?.skippedMappings.length || 0;
  const namesDirty = Boolean(previewSnapshot && !sameNames(names, previewSnapshot.names));
  const categoryNamesDirty = Boolean(previewSnapshot && !sameNames(categoryNames, previewSnapshot.categoryNames));
  const resourceCountsDirty = Boolean(previewSnapshot && !sameCounts(resourceCounts, previewSnapshot.resourceCounts));
  const setupTuningDirty = Boolean(previewSnapshot && !sameNumbers(setupTuning, previewSnapshot.setupTuning));
  const previewDirty = Boolean(previewSnapshot && (
    selectionDirty ||
    selectedFeatures.join("\n") !== previewSnapshot.features.join("\n") ||
    namesDirty ||
    categoryNamesDirty ||
    resourceCountsDirty ||
    setupTuningDirty
  ));
  const selectedProtected = features.filter((feature) => selected.includes(feature.id) && feature.protected);
  const activeFeatureGroup = GROUPS.find((group) => group.id === activeGroup) || GROUPS[0];
  const activeFeatures = features.filter((feature) => feature.group === activeFeatureGroup.id);
  const activeSelectable = activeFeatures.filter((feature) => feature.selectable);
  const activeGroupAllOn = activeSelectable.length > 0 && activeSelectable.every((feature) => selected.includes(feature.id));
  const reviewOnly = proposals.filter((proposal) =>
    selected.includes(proposal.engine) &&
    proposal.protectedFlow &&
    proposal.status !== "populated"
  );

  function setFeatureEnabled(id: string, enabled: boolean) {
    setError("");
    setMessage("");
    setSelected((current) => enabled
      ? sorted([...current, id])
      : current.filter((entry) => entry !== id));
  }

  async function preparePreview() {
    if (!guildId) {
      setError("Choose a server before starting setup.");
      return;
    }
    if (!selectedFeatures.length) {
      setError("Turn on at least one system to preview its setup.");
      return;
    }
    setBusy(true);
    setError("");
    setMessage("");
    setCreated([]);
    setCreationFailures([]);
    setPreviewSnapshot(null);
    setPreviewOpen(false);
    try {
      await callApi({ action: "scan" });
      await callApi({
        action: "settings",
        mode: "discovery",
        trackedEngines: selectedFeatures,
        resourceNameOverrides: names,
        categoryNameOverrides: categoryNames,
        resourceCounts,
        setupTuning,
      });
      const adapt = await callApi({ action: "adapt" });
      const next = adapt.report || await loadReport();
      if (!next) throw new Error("The scan completed without returning a setup report.");
      const normalizedNames = next.settings?.resourceNameOverrides || names;
      const normalizedCategoryNames = next.settings?.categoryNameOverrides || categoryNames;
      const normalizedResourceCounts = next.settings?.resourceCounts || resourceCounts;
      const normalizedSetupTuning = Object.fromEntries((next.setupTuning || []).map((setting) => [setting.id, setting.value]));
      setReport(next);
      setSelected(sorted(next.settings?.trackedEngines || selectedFeatures));
      setSavedSelection(sorted(next.settings?.trackedEngines || selectedFeatures));
      setNames(normalizedNames);
      setCategoryNames(normalizedCategoryNames);
      setResourceCounts(normalizedResourceCounts);
      setSetupTuning(normalizedSetupTuning);
      setPreviewSnapshot({
        features: sorted(next.settings?.trackedEngines || selectedFeatures),
        names: normalizedNames,
        categoryNames: normalizedCategoryNames,
        resourceCounts: normalizedResourceCounts,
        setupTuning: normalizedSetupTuning,
        report: next,
        mappings: adapt.preview?.planned || [],
        skippedMappings: adapt.preview?.skipped || [],
      });
      setMessage("Read-only preview ready. Nothing has been created or changed on Discord.");
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : "Could not prepare the setup preview.");
    } finally {
      setBusy(false);
    }
  }

  async function approveSetup() {
    if (!previewSnapshot || previewDirty) return;
    setPreviewOpen(false);
    setBusy(true);
    setError("");
    setMessage("");
    setCreated([]);
    setCreationFailures([]);
    setBatchProgress("Saving the approved feature and naming choices…");
    try {
      await callApi({
        action: "settings",
        mode: "discovery",
        trackedEngines: previewSnapshot.features,
        resourceNameOverrides: previewSnapshot.names,
        categoryNameOverrides: previewSnapshot.categoryNames,
        resourceCounts: previewSnapshot.resourceCounts,
        setupTuning: previewSnapshot.setupTuning,
      });

      if (previewSnapshot.mappings.length) {
        setBatchProgress("Applying approved matches to existing empty configuration fields…");
        const adapted = await callApi({
          action: "adapt",
          confirmed: true,
          planned: previewSnapshot.mappings,
        });
        if (adapted.result?.stale || adapted.result?.duplicate) {
          throw new Error("The server changed after preview. Nothing else was created; refresh the preview before retrying.");
        }
      }

      await callApi({
        action: "settings",
        mode: "full-setup",
        trackedEngines: previewSnapshot.features,
        resourceNameOverrides: previewSnapshot.names,
        categoryNameOverrides: previewSnapshot.categoryNames,
        resourceCounts: previewSnapshot.resourceCounts,
        setupTuning: previewSnapshot.setupTuning,
      });

      const allCreated: { id?: string; name?: string; engine?: string; field?: string }[] = [];
      const failuresById = new Map<string, CreationFailure>();
      const maxBatches = 100;
      let completed = false;
      for (let batch = 1; batch <= maxBatches; batch += 1) {
        setBatchProgress(`Creating approved resources (batch ${batch}; ${allCreated.length} created so far)…`);
        const data = await callApi({ action: "provision", confirmed: true });
        const result = data.result || {};
        const batchCreated = result.created || [];
        allCreated.push(...batchCreated);
        setCreated([...allCreated]);

        const failures = result.failed || [];
        for (const failure of failures) {
          const id = failure.id || `${failure.engine || "resource"}:${failure.field || failure.name || failuresById.size}`;
          failuresById.set(id, {
            id,
            name: failure.name || failure.field || id,
            error: failure.error || failure.reason || "Discord refused this resource operation.",
          });
        }
        const deferred = Number(result.deferred || 0);
        if (deferred <= 0) {
          completed = true;
          break;
        }
        if (!batchCreated.length) {
          setCreationFailures([...failuresById.values()]);
          const firstFailure = failuresById.values().next().value as CreationFailure | undefined;
          const detail = firstFailure ? ` ${firstFailure.name}: ${firstFailure.error}` : "";
          throw new Error(`${deferred} resource(s) remain, but the latest batch made no progress.${detail} Review Discord permissions and retry setup.`);
        }
      }
      if (!completed) {
        throw new Error("Setup reached the safety limit of 100 batches. Review the created resources and run another preview for anything remaining.");
      }

      await callApi({ action: "settings", autopilotEnabled, automaticProvisioningEnabled });
      const refreshed = await loadReport();
      setPreviewSnapshot(null);
      const finalFailures = [...failuresById.values()];
      setCreationFailures(finalFailures);
      setMessage(finalFailures.length
        ? `Setup created ${allCreated.length} resource(s), but ${finalFailures.length} resource(s) still need attention. See the failed resources below.`
        : `Setup finished. Created ${allCreated.length} resource(s); existing mappings were filled only when they were empty. Autopilot is ${autopilotEnabled ? "on" : "off"}; automatic resource creation is ${automaticProvisioningEnabled ? "on" : "off"}.`);
      setBatchProgress("");
      if (!refreshed) throw new Error("Setup finished, but the refreshed infrastructure report could not be loaded.");
    } catch (cause: unknown) {
      setBatchProgress("");
      setError(cause instanceof Error ? cause.message : "Setup stopped before all approved actions completed.");
      await loadReport().catch(() => null);
    } finally {
      setBusy(false);
    }
  }

  function updateResourceName(id: string, value: string) {
    setNames((current) => ({ ...current, [id]: value }));
    setMessage("");
  }

  function updateCategoryName(id: string, value: string) {
    setCategoryNames((current) => ({ ...current, [id]: value }));
    setMessage("");
  }

  function updateResourceCount(id: string, rawValue: string) {
    const parsed = Number(rawValue);
    if (!Number.isInteger(parsed)) return;
    setResourceCounts((current) => ({ ...current, [id]: Math.min(10, Math.max(1, parsed)) }));
    setMessage("");
  }

  function updateSetupTuning(id: string, rawValue: string) {
    const parsed = Number(rawValue);
    if (!Number.isFinite(parsed)) return;
    setSetupTuning((current) => ({ ...current, [id]: parsed }));
    setMessage("");
  }

  function toggleGroup(group: string, enabled: boolean) {
    const ids = features.filter((feature) => feature.group === group && feature.selectable).map((feature) => feature.id);
    setSelected((current) => sorted(enabled
      ? [...current, ...ids]
      : current.filter((id) => !ids.includes(id))));
    setError("");
    setMessage("");
  }

  if (loading) {
    return <main className="rounded-xl border possum-divider bg-black/50 p-5 text-pink-100">Loading infrastructure setup…</main>;
  }

  if (!guildId) {
    return (
      <main className="space-y-3 rounded-xl border possum-divider bg-black/50 p-5 text-pink-100">
        <h1 className="text-2xl font-black uppercase">Server Setup</h1>
        <p>Choose a server from the dashboard before configuring its setup.</p>
        <a href="/guilds" className="inline-flex min-h-11 items-center rounded-lg border possum-divider px-4 font-bold">Choose a server</a>
      </main>
    );
  }

  return (
    <main className="space-y-4 text-red-100">
      <section className="rounded-xl border possum-divider bg-black/55 p-4 possum-border sm:p-6">
        <p className="text-xs uppercase tracking-[0.2em] possum-soft">Infrastructure</p>
        <h1 className="mt-1 text-2xl font-black uppercase possum-red sm:text-3xl">Guided Server Setup</h1>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed">
          Choose systems by category, review channel, category, and role names, then approve one setup. This only scopes infrastructure tracking; it does not switch runtime features on or off.
        </p>
        <p className="mt-3 rounded-lg border border-amber-700/50 bg-amber-950/30 p-3 text-sm text-amber-100">
          Setup creates only missing, eligible channels, categories, and roles. Existing server resources are never deleted. Protected flows such as welcome, verification, pre-onboarding, and GTA Heist remain manual/suggestion-only. The bot needs the appropriate Discord permissions.
        </p>
      </section>

      {error ? <div role="alert" className="rounded-lg border border-red-700/60 bg-red-950/50 p-3 text-sm text-red-100">{error}</div> : null}
      {message ? <div role="status" className="rounded-lg border border-pink-700/60 bg-pink-950/40 p-3 text-sm text-pink-100">{message}</div> : null}
      {batchProgress ? <div role="status" aria-live="polite" className="rounded-lg border possum-divider bg-black/60 p-3 text-sm text-pink-100">{batchProgress}</div> : null}
      {creationFailures.length ? (
        <section role="alert" className="rounded-lg border border-amber-700/60 bg-amber-950/30 p-3 text-sm text-amber-100">
          <h2 className="font-black uppercase">Resources needing attention</h2>
          <ul className="mt-2 space-y-2">
            {creationFailures.map((failure) => <li key={failure.id}><strong>{failure.name}:</strong> {failure.error}</li>)}
          </ul>
        </section>
      ) : null}

      <section className="rounded-xl border possum-divider bg-black/50 p-4 possum-border sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-black uppercase">Choose what this server uses</h2>
            <p className="mt-1 text-sm text-pink-100/75">Turn systems on for setup tracking. You can change this selection later.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-md border possum-divider px-2 py-1 text-xs">{selectedFeatures.length} selected</span>
            <button type="button" disabled={busy || selectedFeatures.length === 0} onClick={() => void preparePreview()} className="possum-btn min-h-11 rounded-lg px-4 py-2 text-sm font-black uppercase disabled:cursor-not-allowed disabled:opacity-50">
              {busy ? "Preparing…" : "Preview selected setup"}
            </button>
          </div>
        </div>
        <div role="tablist" aria-label="Setup feature categories" className="mt-4 flex flex-wrap gap-2">
          {GROUPS.map((group) => {
            const count = features.filter((feature) => feature.group === group.id).length;
            if (!count) return null;
            const chosen = features.filter((feature) => feature.group === group.id && selected.includes(feature.id)).length;
            return <button
              key={group.id}
              type="button"
              role="tab"
              aria-selected={activeGroup === group.id}
              aria-controls="setup-feature-panel"
              onClick={() => setActiveGroup(group.id)}
              className={`min-h-10 rounded-md border px-3 text-xs font-bold ${activeGroup === group.id ? "border-pink-500 bg-pink-950/40 text-pink-100" : "border-pink-900/50 text-pink-100/70"}`}
            >{group.label} <span className="ml-1 opacity-70">{chosen}/{count}</span></button>;
          })}
        </div>
        <fieldset id="setup-feature-panel" role="tabpanel" className="mt-3 rounded-lg border border-pink-900/50 p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <legend className="px-1 text-sm font-black uppercase text-pink-100">{activeFeatureGroup.label}</legend>
            <button type="button" disabled={busy || !activeSelectable.length} onClick={() => toggleGroup(activeGroup, !activeGroupAllOn)} className="min-h-10 rounded-md border possum-divider px-3 text-xs font-bold disabled:opacity-50">
              {activeGroupAllOn ? "Clear this category" : "Select this category"}
            </button>
          </div>
          <div className="mt-2 grid gap-1 md:grid-cols-2">
            {activeFeatures.map((feature) => (
              <label key={feature.id} className="flex min-h-12 cursor-pointer items-start gap-3 rounded-md px-2 py-2 hover:bg-pink-950/20">
                <input
                  type="checkbox"
                  role="switch"
                  aria-checked={selected.includes(feature.id)}
                  checked={selected.includes(feature.id)}
                  disabled={busy || !feature.selectable}
                  onChange={(event) => setFeatureEnabled(feature.id, event.target.checked)}
                  className="mt-1 h-4 w-4 shrink-0 accent-pink-500"
                />
                <span className="min-w-0 flex-1">
                  <span className="block font-bold">{feature.name}{feature.protected ? <span className="ml-2 text-[10px] uppercase text-amber-200">Manual setup</span> : null}</span>
                  <span className="block text-xs leading-relaxed text-pink-100/60">{feature.description}</span>
                </span>
              </label>
            ))}
            {!activeFeatures.length ? <p className="px-2 py-3 text-sm text-pink-100/60">No setup systems are listed in this category.</p> : null}
          </div>
        </fieldset>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button type="button" disabled={busy || selectedFeatures.length === 0} onClick={() => void preparePreview()} className="possum-btn min-h-11 rounded-lg px-4 py-2 text-sm font-black uppercase disabled:cursor-not-allowed disabled:opacity-50">
            {busy ? "Preparing…" : "Preview selected setup"}
          </button>
          <span className="text-xs text-pink-100/60">Scanning is read-only. Your feature selection saves tracking scope; Discord resources and mappings change only after approval.</span>
        </div>
      </section>

      {previewSnapshot ? (
        <section className="space-y-4 rounded-xl border possum-divider bg-black/50 p-4 possum-border sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-black uppercase">Review the complete setup</h2>
              <p className="mt-1 text-sm text-pink-100/75">Review and rename the proposed channels, categories, and roles before approval.</p>
            </div>
            <span className="rounded-md border possum-divider px-2 py-1 text-xs">
              {resourcesToCreate} resources to create · {roleProposals.reduce((count, proposal) => count + (
                proposal.many && proposal.resourceType === "role"
                  ? Math.max(0, targetRoleCount(proposal, resourceCounts) - existingRoleCount(proposal))
                  : 1
              ), 0)} roles · {channelProposals.length} channels · {explicitCategoryProposals.length + (previewSnapshot.report.setupCategories?.length || 0)} categories · {mappingCount} existing mappings to fill
            </span>
          </div>

          {selectedProtected.length ? (
            <div className="rounded-lg border border-amber-700/50 bg-amber-950/20 p-3 text-sm text-amber-100">
              <strong>Manual review only:</strong> {selectedProtected.map((feature) => feature.name).join(", ")} are selected, but protected flows are not automatically created or rewritten.
            </div>
          ) : null}

          {createProposals.length ? (
            <div className="space-y-4">
              {[
                { title: "Roles", rows: roleProposals },
                { title: "Channels", rows: channelProposals },
                { title: "Engine categories", rows: explicitCategoryProposals },
              ].filter((group) => group.rows.length > 0).map((group) => (
                <div key={group.title} className="space-y-2">
                  <h3 className="text-sm font-black uppercase text-pink-100">{group.title} ({group.rows.length})</h3>
                  {group.rows.map((proposal) => (
                <label key={proposal.id} className="grid gap-1 rounded-lg border border-pink-900/40 p-3 sm:grid-cols-[minmax(0,1fr)_minmax(12rem,20rem)] sm:items-center sm:gap-4">
                  <span className="min-w-0">
                    <span className="block font-bold">{proposal.engineLabel || featureById.get(proposal.engine)?.name || proposal.engine}</span>
                    <span className="block break-all text-xs text-pink-100/60">{proposal.resourceType || "channel"} · {proposal.field}</span>
                  </span>
                  <input
                    value={resourceName(proposal, names)}
                    onChange={(event) => updateResourceName(proposal.id, event.target.value)}
                    maxLength={100}
                    aria-label={`Name for ${proposal.engineLabel || proposal.engine} ${proposal.field}`}
                    className="min-h-11 w-full rounded-md border border-pink-900/50 bg-black px-3 text-sm text-pink-50"
                  />
                  {proposal.many && proposal.resourceType === "role" ? (
                    <label className="flex items-center gap-2 text-xs text-pink-100/75 sm:col-span-2">
                      Roles to create
                      <input
                        type="number"
                        min={1}
                        max={10}
                        value={targetRoleCount(proposal, resourceCounts)}
                        onChange={(event) => updateResourceCount(proposal.id, event.target.value)}
                        aria-label={`Number of roles for ${proposal.engineLabel || proposal.engine} ${proposal.field}`}
                        className="min-h-10 w-24 rounded-md border border-pink-900/50 bg-black px-2 text-sm text-pink-50"
                      />
                      <span>Additional roles are named with a number suffix.</span>
                    </label>
                  ) : null}
                </label>
                  ))}
                </div>
              ))}
            </div>
          ) : (
            <p className="rounded-lg border border-pink-900/40 p-3 text-sm text-pink-100/75">No eligible missing resources need creation for this selection.</p>
          )}

          {previewSnapshot.report.setupCategories?.length ? (
            <div className="space-y-3 rounded-lg border border-pink-900/40 p-3">
              <div>
                <h3 className="text-sm font-black uppercase text-pink-100">Categories for these systems</h3>
                <p className="mt-1 text-xs text-pink-100/65">New channels will be placed under their matching category. Existing matching categories are reused.</p>
              </div>
              {previewSnapshot.report.setupCategories.map((category) => {
                const label = GROUPS.find((group) => group.id === category.group)?.label || category.group;
                return <label key={category.group} className="grid gap-1 rounded-md sm:grid-cols-[minmax(0,1fr)_minmax(12rem,20rem)] sm:items-center sm:gap-4">
                  <span className="text-sm font-bold">{label}</span>
                  <input
                    value={categoryNames[category.group] || category.name}
                    onChange={(event) => updateCategoryName(category.group, event.target.value)}
                    maxLength={100}
                    aria-label={`Name for ${label} category`}
                    className="min-h-11 w-full rounded-md border border-pink-900/50 bg-black px-3 text-sm text-pink-50"
                  />
                </label>;
              })}
            </div>
          ) : null}

          {previewSnapshot.report.setupTuning?.length ? (
            <section className="space-y-3 rounded-lg border border-pink-900/40 p-3">
              <div>
                <h3 className="text-sm font-black uppercase text-pink-100">Game and reward defaults</h3>
                <p className="mt-1 text-xs text-pink-100/65">Review spawn timing and rewards before approval. Existing customized values are preserved and shown read-only.</p>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                {previewSnapshot.report.setupTuning.map((setting) => (
                  <label key={setting.id} className="grid gap-1 rounded-md border border-pink-900/30 p-3">
                    <span className="text-xs font-bold">{featureById.get(setting.engine)?.name || setting.engine} · {setting.label}</span>
                    <input
                      type="number"
                      min={setting.min}
                      max={setting.max}
                      step={setting.step}
                      value={setupTuning[setting.id] ?? setting.value}
                      disabled={setting.preserved}
                      onChange={(event) => updateSetupTuning(setting.id, event.target.value)}
                      aria-label={`${setting.engine} ${setting.label}`}
                      className="min-h-10 rounded-md border border-pink-900/50 bg-black px-3 text-sm text-pink-50 disabled:opacity-60"
                    />
                    {setting.preserved ? <span className="text-[11px] text-amber-100/75">Saved value {setting.currentValue} is already customized; setup will leave it unchanged.</span> : null}
                  </label>
                ))}
              </div>
            </section>
          ) : null}

          {previewSnapshot.mappings.length ? (
            <div className="rounded-lg border border-pink-900/40 p-3">
              <h3 className="text-sm font-black uppercase text-pink-100">Existing resources to connect</h3>
              <ul className="mt-2 space-y-1 text-sm">
                {previewSnapshot.mappings.map((row) => <li key={row.id}>{row.engine}.{row.field} → <strong>{row.resourceName}</strong></li>)}
              </ul>
            </div>
          ) : null}

          {skippedMappingCount ? (
            <p className="text-xs text-amber-100/80">{skippedMappingCount} existing mapping suggestion(s) need manual review and will be left unchanged.</p>
          ) : null}
          {reviewOnly.length ? (
            <p className="text-xs text-amber-100/80">{reviewOnly.length} protected field(s) are excluded from automatic creation.</p>
          ) : null}
          {previewDirty ? (
            <p className="rounded-lg border border-amber-700/50 bg-amber-950/30 p-3 text-sm text-amber-100">Your feature or name edits changed after this preview. Refresh the preview before approving.</p>
          ) : null}
          {created.length ? (
            <p className="text-sm text-pink-100">Already created during the last attempt: {created.map((row) => row.name || row.field || row.id).filter(Boolean).join(", ")}</p>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <button type="button" disabled={busy} onClick={() => void preparePreview()} className="min-h-11 rounded-lg border possum-divider px-4 py-2 text-sm font-bold disabled:opacity-50">Refresh preview</button>
            <button type="button" disabled={busy || previewDirty || (resourcesToCreate === 0 && mappingCount === 0)} onClick={() => setPreviewOpen(true)} className="possum-btn min-h-11 rounded-lg px-4 py-2 text-sm font-black uppercase disabled:cursor-not-allowed disabled:opacity-50">Approve and build setup</button>
          </div>
        </section>
      ) : null}

      {previewOpen && previewSnapshot ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-3 sm:p-5" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) setPreviewOpen(false); }}>
          <section role="dialog" aria-modal="true" aria-labelledby="server-setup-confirm-title" className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl border possum-divider bg-black p-4 shadow-2xl sm:p-6">
            <h2 id="server-setup-confirm-title" className="text-xl font-black uppercase">Approve server setup?</h2>
            <p className="mt-2 text-sm text-pink-100/80">Possum will connect {mappingCount} existing mapping(s) and create {resourcesToCreate} missing channels, categories, and roles for this server. New channels are grouped by system category. Nothing will be deleted.</p>
            <ul className="mt-3 max-h-56 space-y-1 overflow-y-auto rounded-lg border border-pink-900/40 p-3 text-sm">
              {createProposals.map((proposal) => <li key={proposal.id}>{proposal.resourceType || "channel"}: <strong>{resourceName(proposal, names)}</strong>
                {proposal.many && proposal.resourceType === "role" && targetRoleCount(proposal, resourceCounts) > 1
                  ? ` (${Math.max(0, targetRoleCount(proposal, resourceCounts) - existingRoleCount(proposal))} to create)`
                  : ""}
              </li>)}
              {(previewSnapshot.report.setupCategories || []).map((category) => <li key={`category-${category.group}`}>category: <strong>{categoryNames[category.group] || category.name}</strong></li>)}
              {previewSnapshot.mappings.map((row) => <li key={`map-${row.id}`}>Connect {row.engine}.{row.field} to <strong>{row.resourceName}</strong></li>)}
            </ul>
            <p className="mt-3 text-xs text-amber-100/80">Protected onboarding, verification, pre-onboarding, and Heist flows remain suggestion-only. Runtime features are not switched on or off by this setup.</p>
            <label className="mt-3 flex items-start gap-3 rounded-lg border border-pink-900/40 p-3 text-sm">
              <input
                type="checkbox"
                checked={autopilotEnabled}
                onChange={(event) => setAutopilotEnabled(event.target.checked)}
                className="mt-1 accent-pink-500"
              />
              <span>
                <strong className="block">Enable Infrastructure Autopilot after setup</strong>
                <span className="mt-1 block text-xs text-pink-100/70">It can repair channels Possum created and reroute a broken channel/category mapping only to one clear, unused existing match. It never deletes resources, changes permissions, recreates roles, overwrites healthy mappings, or changes protected flows. Unclear cases stay for owner review.</span>
              </span>
            </label>
            <label className="mt-3 flex items-start gap-3 rounded-lg border border-pink-900/40 p-3 text-sm">
              <input
                type="checkbox"
                checked={automaticProvisioningEnabled}
                onChange={(event) => setAutomaticProvisioningEnabled(event.target.checked)}
                className="mt-1 accent-pink-500"
              />
              <span>
                <strong className="block">Allow automatic creation of missing resources</strong>
                <span className="mt-1 block text-xs text-pink-100/70">When enabled, infrastructure may create missing channels, categories, and roles for tracked systems after setup. This is separate from Autopilot; it never overwrites existing mappings or creates resources for protected onboarding, verification, pre-onboarding, or Heist flows.</span>
              </span>
            </label>
            {previewSnapshot.report.setupTuning?.length ? <p className="mt-2 text-xs text-pink-100/70">Approved game and reward values are saved only after confirmation; existing customized settings are not overwritten.</p> : null}
            <div className="mt-4 flex flex-wrap justify-end gap-2">
              <button type="button" disabled={busy} onClick={() => setPreviewOpen(false)} className="min-h-11 rounded-lg border possum-divider px-4 py-2 text-sm font-bold">Cancel</button>
              <button type="button" disabled={busy || previewDirty} onClick={() => void approveSetup()} className="possum-btn min-h-11 rounded-lg px-4 py-2 text-sm font-black uppercase disabled:opacity-50">Yes, build selected setup</button>
            </div>
          </section>
        </div>
      ) : null}
    </main>
  );
}
