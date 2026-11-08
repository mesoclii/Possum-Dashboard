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
  settings?: {
    mode?: string;
    trackedEngines?: string[] | null;
    trackedEnginesConfigured?: boolean;
    resourceNameOverrides?: Record<string, string>;
  };
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
    failed?: { name?: string; error?: string; reason?: string }[];
    deferred?: number;
    message?: string;
  };
};

type PreviewSnapshot = {
  features: string[];
  names: Record<string, string>;
  report: SetupReport;
  mappings: AdaptRow[];
  skippedMappings: { id: string; reason: string }[];
};

const GROUPS = [
  { id: "community", label: "Community" },
  { id: "moderation", label: "Moderation & Security" },
  { id: "engagement", label: "Engagement" },
  { id: "support", label: "Support & Administration" },
];

function sorted(values: string[]) {
  return [...new Set(values)].sort();
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

export default function ServerSetupClient() {
  const [guildId, setGuildId] = useState("");
  const [userId, setUserId] = useState("");
  const [report, setReport] = useState<SetupReport | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [savedSelection, setSavedSelection] = useState<string[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [previewSnapshot, setPreviewSnapshot] = useState<PreviewSnapshot | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [created, setCreated] = useState<{ id?: string; name?: string; engine?: string; field?: string }[]>([]);
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
      const saved = sorted(next.settings?.trackedEngines || []);
      setSelected(saved);
      setSavedSelection(saved);
      setNames(next.settings?.resourceNameOverrides || {});
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
        const saved = sorted(next?.settings?.trackedEngines || []);
        setSelected(saved);
        setSavedSelection(saved);
        setNames(next?.settings?.resourceNameOverrides || {});
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
      proposal.status === "missing" &&
      !proposal.protectedFlow &&
      !proposal.many
    ),
    [proposals, selected]
  );
  const mappingCount = previewSnapshot?.mappings.length || 0;
  const skippedMappingCount = previewSnapshot?.skippedMappings.length || 0;
  const namesDirty = Boolean(previewSnapshot && !sameNames(names, previewSnapshot.names));
  const previewDirty = Boolean(previewSnapshot && (
    selectionDirty ||
    selectedFeatures.join("\n") !== previewSnapshot.features.join("\n") ||
    namesDirty
  ));
  const selectedProtected = features.filter((feature) => selected.includes(feature.id) && feature.protected);
  const reviewOnly = proposals.filter((proposal) =>
    selected.includes(proposal.engine) &&
    (proposal.protectedFlow || proposal.many) &&
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
    setPreviewSnapshot(null);
    setPreviewOpen(false);
    try {
      await callApi({
        action: "settings",
        mode: "discovery",
        trackedEngines: selectedFeatures,
        resourceNameOverrides: names,
      });
      const scan = await callApi({ action: "scan" });
      const next = scan.report || await loadReport();
      if (!next) throw new Error("The scan completed without returning a setup report.");
      const adapt = await callApi({ action: "adapt" });
      const normalizedNames = next.settings?.resourceNameOverrides || names;
      setReport(next);
      setSelected(sorted(next.settings?.trackedEngines || selectedFeatures));
      setSavedSelection(sorted(next.settings?.trackedEngines || selectedFeatures));
      setNames(normalizedNames);
      setPreviewSnapshot({
        features: sorted(next.settings?.trackedEngines || selectedFeatures),
        names: normalizedNames,
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
    setBatchProgress("Saving the approved feature and naming choices…");
    try {
      await callApi({
        action: "settings",
        mode: "discovery",
        trackedEngines: previewSnapshot.features,
        resourceNameOverrides: previewSnapshot.names,
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
      });

      const allCreated: { id?: string; name?: string; engine?: string; field?: string }[] = [];
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
        if (failures.length) {
          const first = failures[0];
          const details = first.error || first.reason || "Discord refused a resource operation.";
          throw new Error(`${allCreated.length} resource(s) were created before setup paused: ${details}`);
        }
        const deferred = Number(result.deferred || 0);
        if (deferred <= 0) {
          completed = true;
          break;
        }
        if (!batchCreated.length) {
          throw new Error(`${deferred} resource(s) remain, but the latest batch made no progress. Review the infrastructure report before retrying.`);
        }
      }
      if (!completed) {
        throw new Error("Setup reached the safety limit of 100 batches. Review the created resources and run another preview for anything remaining.");
      }

      const refreshed = await loadReport();
      setPreviewSnapshot(null);
      setMessage(`Setup finished. Created ${allCreated.length} resource(s); existing mappings were filled only when they were empty.`);
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

  function toggleGroup(group: string, enabled: boolean) {
    const ids = features.filter((feature) => feature.group === group && feature.selectable).map((feature) => feature.id);
    setSelected((current) => sorted(enabled
      ? [...current, ...ids]
      : current.filter((id) => !ids.includes(id))));
    setError("");
    setMessage("");
  }

  if (loading) {
    return <main className="mx-auto max-w-5xl rounded-xl border possum-divider bg-black/50 p-5 text-pink-100">Loading server setup…</main>;
  }

  if (!guildId) {
    return (
      <main className="mx-auto max-w-5xl space-y-3 rounded-xl border possum-divider bg-black/50 p-5 text-pink-100">
        <h1 className="text-2xl font-black uppercase">Server Setup</h1>
        <p>Choose a server from the dashboard before configuring its setup.</p>
        <a href="/guilds" className="inline-flex min-h-11 items-center rounded-lg border possum-divider px-4 font-bold">Choose a server</a>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-5xl space-y-4 text-red-100">
      <section className="rounded-xl border possum-divider bg-black/55 p-4 possum-border sm:p-6">
        <p className="text-xs uppercase tracking-[0.2em] possum-soft">Guild-aware setup</p>
        <h1 className="mt-1 text-2xl font-black uppercase possum-red sm:text-3xl">Server Setup</h1>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed">
          Choose the Possum systems this server plans to use. Review and rename every proposed resource, then approve one combined setup. Selecting systems only scopes Infrastructure; it does not switch runtime features on or off.
        </p>
        <p className="mt-3 rounded-lg border border-amber-700/50 bg-amber-950/30 p-3 text-sm text-amber-100">
          Setup creates only missing, eligible channels, categories, and roles. Existing server resources are never deleted. Protected flows such as welcome, verification, pre-onboarding, and GTA Heist remain manual/suggestion-only. The bot needs the appropriate Discord permissions.
        </p>
      </section>

      {error ? <div role="alert" className="rounded-lg border border-red-700/60 bg-red-950/50 p-3 text-sm text-red-100">{error}</div> : null}
      {message ? <div role="status" className="rounded-lg border border-pink-700/60 bg-pink-950/40 p-3 text-sm text-pink-100">{message}</div> : null}
      {batchProgress ? <div role="status" aria-live="polite" className="rounded-lg border possum-divider bg-black/60 p-3 text-sm text-pink-100">{batchProgress}</div> : null}

      <section className="rounded-xl border possum-divider bg-black/50 p-4 possum-border sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-black uppercase">Choose what this server uses</h2>
            <p className="mt-1 text-sm text-pink-100/75">Turn systems on for setup tracking. You can change this selection later.</p>
          </div>
          <span className="rounded-md border possum-divider px-2 py-1 text-xs">{selectedFeatures.length} selected</span>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {GROUPS.map((group) => {
            const rows = features.filter((feature) => feature.group === group.id);
            if (!rows.length) return null;
            const allOn = rows.filter((feature) => feature.selectable).every((feature) => selected.includes(feature.id));
            return (
              <fieldset key={group.id} className="min-w-0 rounded-lg border border-pink-900/50 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <legend className="px-1 text-sm font-black uppercase text-pink-100">{group.label}</legend>
                  <button type="button" disabled={busy} onClick={() => toggleGroup(group.id, !allOn)} className="min-h-10 rounded-md border possum-divider px-3 text-xs font-bold disabled:opacity-50">
                    {allOn ? "Turn group off" : "Turn group on"}
                  </button>
                </div>
                <div className="mt-2 space-y-1">
                  {rows.map((feature) => (
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
                </div>
              </fieldset>
            );
          })}
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button type="button" disabled={busy || selectedFeatures.length === 0} onClick={() => void preparePreview()} className="possum-btn min-h-11 rounded-lg px-4 py-2 text-sm font-black uppercase disabled:cursor-not-allowed disabled:opacity-50">
            {busy ? "Preparing…" : "Preview selected setup"}
          </button>
          <span className="text-xs text-pink-100/60">Preview scans are read-only; nothing is created until final approval.</span>
        </div>
      </section>

      {previewSnapshot ? (
        <section className="space-y-4 rounded-xl border possum-divider bg-black/50 p-4 possum-border sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-black uppercase">Review the complete setup</h2>
              <p className="mt-1 text-sm text-pink-100/75">Edit proposed names before approval. Discord channel names are saved as lowercase words joined by hyphens.</p>
            </div>
            <span className="rounded-md border possum-divider px-2 py-1 text-xs">{createProposals.length} to create · {mappingCount} existing mappings to fill</span>
          </div>

          {selectedProtected.length ? (
            <div className="rounded-lg border border-amber-700/50 bg-amber-950/20 p-3 text-sm text-amber-100">
              <strong>Manual review only:</strong> {selectedProtected.map((feature) => feature.name).join(", ")} are selected, but protected flows are not automatically created or rewritten.
            </div>
          ) : null}

          {createProposals.length ? (
            <div className="space-y-3">
              <h3 className="text-sm font-black uppercase text-pink-100">Resources to create</h3>
              {createProposals.map((proposal) => (
                <label key={proposal.id} className="grid gap-1 rounded-lg border border-pink-900/40 p-3 sm:grid-cols-[minmax(0,1fr)_minmax(12rem,20rem)] sm:items-center sm:gap-4">
                  <span className="min-w-0">
                    <span className="block font-bold">{proposal.engineLabel || featureById.get(proposal.engine)?.name || proposal.engine}</span>
                    <span className="block break-all text-xs text-pink-100/60">{proposal.resourceType || "channel"} · {proposal.field}</span>
                  </span>
                  <input
                    value={resourceName(proposal, names)}
                    onChange={(event) => updateResourceName(proposal.id, event.target.value)}
                    maxLength={90}
                    aria-label={`Name for ${proposal.engineLabel || proposal.engine} ${proposal.field}`}
                    className="min-h-11 w-full rounded-md border border-pink-900/50 bg-black px-3 text-sm text-pink-50"
                  />
                </label>
              ))}
            </div>
          ) : (
            <p className="rounded-lg border border-pink-900/40 p-3 text-sm text-pink-100/75">No eligible missing resources need creation for this selection.</p>
          )}

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
            <p className="text-xs text-amber-100/80">{reviewOnly.length} protected or multi-resource field(s) are excluded from automatic creation.</p>
          ) : null}
          {previewDirty ? (
            <p className="rounded-lg border border-amber-700/50 bg-amber-950/30 p-3 text-sm text-amber-100">Your feature or name edits changed after this preview. Refresh the preview before approving.</p>
          ) : null}
          {created.length ? (
            <p className="text-sm text-pink-100">Already created during the last attempt: {created.map((row) => row.name || row.field || row.id).filter(Boolean).join(", ")}</p>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <button type="button" disabled={busy} onClick={() => void preparePreview()} className="min-h-11 rounded-lg border possum-divider px-4 py-2 text-sm font-bold disabled:opacity-50">Refresh preview</button>
            <button type="button" disabled={busy || previewDirty || (createProposals.length === 0 && mappingCount === 0)} onClick={() => setPreviewOpen(true)} className="possum-btn min-h-11 rounded-lg px-4 py-2 text-sm font-black uppercase disabled:cursor-not-allowed disabled:opacity-50">Approve and build setup</button>
          </div>
        </section>
      ) : null}

      {previewOpen && previewSnapshot ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-3 sm:p-5" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) setPreviewOpen(false); }}>
          <section role="dialog" aria-modal="true" aria-labelledby="server-setup-confirm-title" className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl border possum-divider bg-black p-4 shadow-2xl sm:p-6">
            <h2 id="server-setup-confirm-title" className="text-xl font-black uppercase">Approve server setup?</h2>
            <p className="mt-2 text-sm text-pink-100/80">Possum will connect {mappingCount} existing mapping(s) and create up to {createProposals.length} missing channel(s), category resources, or roles for this server. Creation runs in small batches. Nothing will be deleted.</p>
            <ul className="mt-3 max-h-56 space-y-1 overflow-y-auto rounded-lg border border-pink-900/40 p-3 text-sm">
              {createProposals.map((proposal) => <li key={proposal.id}>{proposal.resourceType || "channel"}: <strong>{resourceName(proposal, names)}</strong></li>)}
              {previewSnapshot.mappings.map((row) => <li key={`map-${row.id}`}>Connect {row.engine}.{row.field} to <strong>{row.resourceName}</strong></li>)}
            </ul>
            <p className="mt-3 text-xs text-amber-100/80">Protected onboarding, verification, pre-onboarding, and Heist flows remain suggestion-only. Runtime features are not switched on or off by this setup.</p>
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
