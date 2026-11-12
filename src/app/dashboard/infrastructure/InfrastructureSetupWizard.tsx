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

type ProtectedFlow = "onboarding" | "verification" | "preOnboarding";
type FlowChoice = "keep" | "enable" | "disable";
type FlowChoices = Record<ProtectedFlow, FlowChoice>;

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

type DirectoryResource = {
  id: string;
  name: string;
  kind: string;
  parentId?: string;
};

type RewardRoleOption = {
  id: string;
  kind: "achievement" | "progression" | "prestige";
  label: string;
  proposedName: string;
};

type SetupReport = {
  guildId?: string;
  ready?: boolean;
  reason?: string;
  featureCatalog?: Feature[];
  proposals?: Proposal[];
  rewardRoleOptions?: RewardRoleOption[];
  vipRole?: { id: string; name: string } | null;
  directory?: {
    categories?: DirectoryResource[];
    channels?: DirectoryResource[];
  };
  setupTuning?: SetupTuning[];
  settings?: {
    mode?: string;
    autopilotEnabled?: boolean;
    automaticProvisioningEnabled?: boolean;
    trackedEngines?: string[] | null;
    trackedEnginesConfigured?: boolean;
    selectedRoleMappings?: string[];
    vipPrivateResourceKeys?: string[];
    resourceNameOverrides?: Record<string, string>;
    categoryNameOverrides?: Record<string, string>;
    resourceCounts?: Record<string, number>;
    rewardRoleSelections?: string[];
    customRoleNames?: string[];
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
    loggingWarnings?: string[];
    role?: { id: string; name: string };
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
  selectedRoleMappings: string[];
  rewardRoleSelections: string[];
  customRoleNames: string[];
  vipPrivateResourceKeys: string[];
  flowChoices: FlowChoices;
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

const DEFAULT_FLOW_CHOICES: FlowChoices = {
  onboarding: "keep",
  verification: "keep",
  preOnboarding: "keep",
};

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
  const [selectedRoleMappings, setSelectedRoleMappings] = useState<string[]>([]);
  const [rewardRoleSelections, setRewardRoleSelections] = useState<string[]>([]);
  const [customRoleText, setCustomRoleText] = useState("");
  const [vipPrivateSetupKeys, setVipPrivateSetupKeys] = useState<string[]>([]);
  const [flowChoices, setFlowChoices] = useState<FlowChoices>(DEFAULT_FLOW_CHOICES);
  const [names, setNames] = useState<Record<string, string>>({});
  const [categoryNames, setCategoryNames] = useState<Record<string, string>>({});
  const [resourceCounts, setResourceCounts] = useState<Record<string, number>>({});
  const [setupTuning, setSetupTuning] = useState<Record<string, number>>({});
  const [autopilotEnabled, setAutopilotEnabled] = useState(false);
  const [automaticProvisioningEnabled, setAutomaticProvisioningEnabled] = useState(false);
  const [activeGroup, setActiveGroup] = useState(GROUPS[0].id);
  const [previewSnapshot, setPreviewSnapshot] = useState<PreviewSnapshot | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [selectedVipResourceIds, setSelectedVipResourceIds] = useState<string[]>([]);
  const [vipConfirmationOpen, setVipConfirmationOpen] = useState(false);
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
      setSelectedRoleMappings(sorted(next.settings?.selectedRoleMappings || []));
      setRewardRoleSelections(sorted(next.settings?.rewardRoleSelections || []));
      setCustomRoleText((next.settings?.customRoleNames || []).join("\n"));
      setVipPrivateSetupKeys(sorted(next.settings?.vipPrivateResourceKeys || []));
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
        setSelectedRoleMappings(sorted(next?.settings?.selectedRoleMappings || []));
        setRewardRoleSelections(sorted(next?.settings?.rewardRoleSelections || []));
        setCustomRoleText((next?.settings?.customRoleNames || []).join("\n"));
        setVipPrivateSetupKeys(sorted(next?.settings?.vipPrivateResourceKeys || []));
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
  const roleCandidates = useMemo(
    () => proposals.filter((proposal) =>
      selected.includes(proposal.engine) &&
      !proposal.protectedFlow &&
      proposal.resourceType === "role" &&
      (proposal.status !== "populated" || proposal.many)
    ),
    [proposals, selected]
  );
  const previewRoleSelections = sorted(selectedRoleMappings);
  const previewRewardRoleSelections = sorted(rewardRoleSelections);
  const normalizedCustomRoleNames = [...new Set(customRoleText.split(/\r?\n/).map((name) => name.trim()).filter(Boolean))].slice(0, 10);
  const selectedRewardRoleOptions = (report?.rewardRoleOptions || []).filter((option) => previewRewardRoleSelections.includes(option.id));
  const createProposals = useMemo(
    () => proposals.filter((proposal) =>
      (selected.includes(proposal.engine) || `${proposal.engine}:${proposal.field}` === "moderator:logging.logChannelId") &&
      !proposal.protectedFlow &&
      (proposal.resourceType !== "role" || previewRoleSelections.includes(proposal.id)) &&
      (
        proposal.status !== "populated" ||
        (proposal.many && proposal.resourceType === "role")
      )
    ),
    [proposals, previewRoleSelections, selected]
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
  const vipPrivateSetupKeysSorted = sorted(vipPrivateSetupKeys);
  const resourcesToCreate = createProposals.reduce((count, proposal) => count + (
    proposal.many && proposal.resourceType === "role"
      ? Math.max(0, targetRoleCount(proposal, resourceCounts) - existingRoleCount(proposal))
      : 1
  ), 0) + (previewSnapshot?.report.setupCategories?.length || 0) +
    selectedRewardRoleOptions.length + normalizedCustomRoleNames.length;
  const plannedVipSetupKeys = new Set([
    ...createProposals
      .filter((proposal) => proposal.resourceType === "channel" || proposal.resourceType === "category")
      .map((proposal) => proposal.id),
    ...(previewSnapshot?.report.setupCategories || []).map((category) => `group-category:${category.group}`),
  ]);
  const vipPrivateCreateCount = vipPrivateSetupKeysSorted.filter((id) => plannedVipSetupKeys.has(id)).length;
  const mappingCount = previewSnapshot?.mappings.length || 0;
  const skippedMappingCount = previewSnapshot?.skippedMappings.length || 0;
  const namesDirty = Boolean(previewSnapshot && !sameNames(names, previewSnapshot.names));
  const categoryNamesDirty = Boolean(previewSnapshot && !sameNames(categoryNames, previewSnapshot.categoryNames));
  const resourceCountsDirty = Boolean(previewSnapshot && !sameCounts(resourceCounts, previewSnapshot.resourceCounts));
  const setupTuningDirty = Boolean(previewSnapshot && !sameNumbers(setupTuning, previewSnapshot.setupTuning));
  const roleSelectionsDirty = Boolean(previewSnapshot && previewRoleSelections.join("\n") !== previewSnapshot.selectedRoleMappings.join("\n"));
  const rewardRoleSelectionsDirty = Boolean(previewSnapshot && previewRewardRoleSelections.join("\n") !== previewSnapshot.rewardRoleSelections.join("\n"));
  const customRoleNamesDirty = Boolean(previewSnapshot && normalizedCustomRoleNames.join("\n") !== previewSnapshot.customRoleNames.join("\n"));
  const vipSetupSelectionsDirty = Boolean(previewSnapshot && vipPrivateSetupKeysSorted.join("\n") !== previewSnapshot.vipPrivateResourceKeys.join("\n"));
  const vipResources = useMemo(() => [
    ...(report?.directory?.categories || []).map((resource) => ({ ...resource, kind: "category" })),
    ...(report?.directory?.channels || []).filter((resource) =>
      ["text", "voice", "announcement", "stage", "forum", "media"].includes(resource.kind)
    ),
  ], [report?.directory]);
  const flowChoicesDirty = Boolean(previewSnapshot && JSON.stringify(flowChoices) !== JSON.stringify(previewSnapshot.flowChoices));
  const previewDirty = Boolean(previewSnapshot && (
    selectionDirty ||
    selectedFeatures.join("\n") !== previewSnapshot.features.join("\n") ||
    namesDirty ||
    categoryNamesDirty ||
    resourceCountsDirty ||
    setupTuningDirty ||
    roleSelectionsDirty ||
    rewardRoleSelectionsDirty ||
    customRoleNamesDirty ||
    vipSetupSelectionsDirty ||
    flowChoicesDirty
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

  function setVipResourceSelected(id: string, enabled: boolean) {
    setSelectedVipResourceIds((current) => enabled
      ? sorted([...current, id])
      : current.filter((entry) => entry !== id));
  }

  function setVipSetupKeySelected(id: string, enabled: boolean) {
    setVipPrivateSetupKeys((current) => enabled
      ? sorted([...current, id])
      : current.filter((entry) => entry !== id));
  }

  async function applyVipVisibility() {
    if (!selectedVipResourceIds.length) return;
    setVipConfirmationOpen(false);
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const data = await callApi({ action: "vip-visibility", resourceIds: selectedVipResourceIds });
      const applied = data.result?.applied || [];
      const failed = data.result?.failed || [];
      if (data.report) setReport(data.report);
      setSelectedVipResourceIds(failed.map((row) => row.id || "").filter(Boolean));
      setMessage(`VIP visibility applied to ${applied.length} selected resource(s).${failed.length ? ` ${failed.length} need attention.` : ""}`);
      if (failed.length) setError(failed.map((row) => `${row.id || "Resource"}: ${row.error || "permission update failed"}`).join(" "));
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : "Could not apply VIP-only visibility.");
    } finally {
      setBusy(false);
    }
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
        selectedRoleMappings: previewRoleSelections,
        rewardRoleSelections: previewRewardRoleSelections,
        customRoleNames: normalizedCustomRoleNames,
        vipPrivateResourceKeys: vipPrivateSetupKeysSorted,
        setupTuning,
      });
      const adapt = await callApi({ action: "adapt" });
      const next = adapt.report || await loadReport();
      if (!next) throw new Error("The scan completed without returning a setup report.");
      const normalizedNames = next.settings?.resourceNameOverrides || names;
      const normalizedCategoryNames = next.settings?.categoryNameOverrides || categoryNames;
      const normalizedResourceCounts = next.settings?.resourceCounts || resourceCounts;
      const normalizedSetupTuning = Object.fromEntries((next.setupTuning || []).map((setting) => [setting.id, setting.value]));
      const normalizedVipPrivateKeys = sorted(next.settings?.vipPrivateResourceKeys || vipPrivateSetupKeysSorted);
      setReport(next);
      setSelected(sorted(next.settings?.trackedEngines || selectedFeatures));
      setSavedSelection(sorted(next.settings?.trackedEngines || selectedFeatures));
      setNames(normalizedNames);
      setCategoryNames(normalizedCategoryNames);
      setResourceCounts(normalizedResourceCounts);
      setVipPrivateSetupKeys(normalizedVipPrivateKeys);
      const normalizedRoleSelections = sorted(next.settings?.selectedRoleMappings || previewRoleSelections);
      setSelectedRoleMappings(normalizedRoleSelections);
      const normalizedRewardSelections = sorted(next.settings?.rewardRoleSelections || previewRewardRoleSelections);
      setRewardRoleSelections(normalizedRewardSelections);
      const savedCustomRoleNames = next.settings?.customRoleNames || normalizedCustomRoleNames;
      setCustomRoleText(savedCustomRoleNames.join("\n"));
      setSetupTuning(normalizedSetupTuning);
      setPreviewSnapshot({
        features: sorted(next.settings?.trackedEngines || selectedFeatures),
        names: normalizedNames,
        categoryNames: normalizedCategoryNames,
        resourceCounts: normalizedResourceCounts,
        selectedRoleMappings: normalizedRoleSelections,
        rewardRoleSelections: normalizedRewardSelections,
        customRoleNames: savedCustomRoleNames,
        vipPrivateResourceKeys: normalizedVipPrivateKeys,
        flowChoices: { ...flowChoices },
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
        selectedRoleMappings: previewSnapshot.selectedRoleMappings,
        rewardRoleSelections: previewSnapshot.rewardRoleSelections,
        customRoleNames: previewSnapshot.customRoleNames,
        vipPrivateResourceKeys: previewSnapshot.vipPrivateResourceKeys,
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
        rewardRoleSelections: previewSnapshot.rewardRoleSelections,
        customRoleNames: previewSnapshot.customRoleNames,
        vipPrivateResourceKeys: previewSnapshot.vipPrivateResourceKeys,
        setupTuning: previewSnapshot.setupTuning,
      });

      const allCreated: { id?: string; name?: string; engine?: string; field?: string }[] = [];
      const failuresById = new Map<string, CreationFailure>();
      const loggingWarnings = new Set<string>();
      const maxBatches = 100;
      let completed = false;
      for (let batch = 1; batch <= maxBatches; batch += 1) {
        setBatchProgress(`Creating approved resources (batch ${batch}; ${allCreated.length} created so far)…`);
        const data = await callApi({ action: "provision", confirmed: true });
        const result = data.result || {};
        const batchCreated = result.created || [];
        allCreated.push(...batchCreated);
        for (const warning of result.loggingWarnings || []) loggingWarnings.add(warning);
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

      const featurePatch: Record<string, boolean> = {};
      const securityPatch: Record<string, { enabled: boolean }> = {};
      for (const flow of Object.keys(previewSnapshot.flowChoices) as ProtectedFlow[]) {
        const choice = previewSnapshot.flowChoices[flow];
        if (choice === "keep") continue;
        const enabled = choice === "enable";
        const featureKey = flow === "onboarding"
          ? "onboardingEnabled"
          : flow === "verification"
            ? "verificationEnabled"
            : null;
        if (featureKey) featurePatch[featureKey] = enabled;
        securityPatch[flow] = { enabled };
      }
      if (Object.keys(featurePatch).length || Object.keys(securityPatch).length) {
        setBatchProgress("Saving the explicit onboarding and security choices…");
        const response = await fetch("/api/bot/dashboard-config", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            guildId,
            patch: {
              ...(Object.keys(featurePatch).length ? { features: featurePatch } : {}),
              ...(Object.keys(securityPatch).length ? { security: securityPatch } : {}),
            },
          }),
          cache: "no-store",
        });
        await readJson(response);
      }

      await callApi({ action: "settings", autopilotEnabled, automaticProvisioningEnabled });
      const refreshed = await loadReport();
      setPreviewSnapshot(null);
      const finalFailures = [...failuresById.values()];
      setCreationFailures(finalFailures);
      setMessage(finalFailures.length
        ? `Setup created ${allCreated.length} resource(s), but ${finalFailures.length} resource(s) still need attention. See the failed resources below.`
        : `Setup finished. Created ${allCreated.length} resource(s); existing mappings were filled only when they were empty. Autopilot is ${autopilotEnabled ? "on" : "off"}; automatic resource creation is ${automaticProvisioningEnabled ? "on" : "off"}.${loggingWarnings.size ? ` Setup logs need attention: ${[...loggingWarnings].join("; ")}` : ""}`);
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

  function setFlowChoice(flow: ProtectedFlow, choice: FlowChoice) {
    setFlowChoices((current) => ({ ...current, [flow]: choice }));
    setMessage("");
  }

  function setRoleSelected(id: string, enabled: boolean) {
    setSelectedRoleMappings((current) => sorted(enabled
      ? [...current, id]
      : current.filter((entry) => entry !== id)));
    setMessage("");
  }

  function setRewardRoleSelected(id: string, enabled: boolean) {
    setRewardRoleSelections((current) => sorted(enabled
      ? [...current, id]
      : current.filter((entry) => entry !== id)));
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
          Choose systems by category, review resource names, and approve one setup. Setup bootstraps the moderator log destination first, then creates selected reward roles before the remaining channels and categories.
        </p>
        <p className="mt-3 rounded-lg border border-amber-700/50 bg-amber-950/30 p-3 text-sm text-amber-100">
          Setup creates only missing, eligible channels, categories, and roles you explicitly select. Existing server resources are never deleted. Protected flows are never provisioned or rewritten automatically. The bot needs the appropriate Discord permissions.
        </p>
      </section>

      <section className="rounded-xl border possum-divider bg-black/50 p-4 possum-border sm:p-6">
        <h2 className="text-lg font-black uppercase">First-run checklist</h2>
        <ol className="mt-3 grid gap-3 text-sm leading-relaxed md:grid-cols-2">
          <li className="rounded-lg border border-pink-900/40 p-3"><strong>1. Bootstrap logging and roles.</strong> Setup creates the moderator log destination first, then selected cat, achievement, progression, and custom roles before the rest of the resources.</li>
          <li className="rounded-lg border border-pink-900/40 p-3"><strong>2. Decide protected member flows.</strong> Choose whether onboarding, verification, and pre-onboarding should be enabled or disabled, or leave each current setting unchanged.</li>
          <li className="rounded-lg border border-pink-900/40 p-3"><strong>3. Set up security and audit details.</strong> Review <a className="underline" href="/dashboard/security/pre-onboarding">pre-onboarding safeguards</a> and select the moderation logging systems below.</li>
          <li className="rounded-lg border border-pink-900/40 p-3"><strong>4. Configure your custom bot securely.</strong> Use the <a className="underline" href="/dashboard/bot-personalizer#custom-bot-credentials">Bot Personalizer</a> for its token, client ID, and OAuth settings. Never paste tokens into chat.</li>
          <li className="rounded-lg border border-pink-900/40 p-3 md:col-span-2"><strong>5. Set message routing and verify permissions.</strong> In Bot Personalizer, choose who can send DMs, whether guild messages use the bot or webhook, then confirm the bot can manage the selected channels and roles.</li>
        </ol>
      </section>

      <section className="rounded-xl border possum-divider bg-black/50 p-4 possum-border sm:p-6">
        <h2 className="text-lg font-black uppercase">Protected flow decisions</h2>
        <p className="mt-1 text-sm text-pink-100/70">These choices apply only after you approve and complete setup. “Keep current” preserves existing behavior.</p>
        <div className="mt-3 grid gap-3 md:grid-cols-3">
          {([
            ["onboarding", "Onboarding"],
            ["verification", "Verification"],
            ["preOnboarding", "Pre-onboarding security"],
          ] as [ProtectedFlow, string][]).map(([flow, label]) => (
            <label key={flow} className="grid gap-2 rounded-lg border border-pink-900/40 p-3 text-sm font-bold">
              {label}
              <select value={flowChoices[flow]} onChange={(event) => setFlowChoice(flow, event.target.value as FlowChoice)} className="min-h-10 rounded-md border border-pink-900/50 bg-black px-2 text-sm text-pink-50">
                <option value="keep">Keep current setting</option>
                <option value="enable">Enable</option>
                <option value="disable">Disable</option>
              </select>
            </label>
          ))}
        </div>
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
          <span className="text-xs text-pink-100/60">Scanning is read-only. Feature selection saves tracking scope; resources, mappings, and any protected-flow choices change only after approval.</span>
        </div>
      </section>

      {report?.directory ? (
        <section className="rounded-xl border possum-divider bg-black/50 p-4 possum-border sm:p-6">
          <h2 className="text-lg font-black uppercase">VIP-protected channel visibility</h2>
          <p className="mt-1 text-sm text-pink-100/70">
            {report.vipRole
              ? `Configured VIP role: ${report.vipRole.name}. Select existing categories or channels, then confirm to deny @everyone and allow this VIP role.`
              : "A valid configured VIP role was not found in this server. Configure the VIP role before applying private visibility."}
          </p>
          <p className="mt-1 text-xs text-pink-100/60">Only View Channel access for @everyone, VIP, and the bot is changed; other role permissions are preserved, so existing staff access remains. Discord administrators always retain access. Selecting a category protects its synced channels; select unsynced child channels separately.</p>
          {(["category", "channel"] as const).map((kind) => {
            const resources = vipResources.filter((resource) => kind === "category" ? resource.kind === "category" : resource.kind !== "category");
            if (!resources.length) return null;
            const title = kind === "category" ? "Categories" : "Channels";
            return (
              <details key={kind} className="mt-3 rounded-lg border border-pink-900/40 p-3">
                <summary className="cursor-pointer text-sm font-black uppercase text-pink-100">{title} ({resources.length})</summary>
                <div className="mt-2 grid gap-2 md:grid-cols-2">
                  {resources.map((resource) => (
                    <label key={resource.id} className="flex items-start gap-3 rounded-lg border border-pink-900/40 p-3 text-sm">
                      <input
                        type="checkbox"
                        checked={selectedVipResourceIds.includes(resource.id)}
                        onChange={(event) => setVipResourceSelected(resource.id, event.target.checked)}
                        className="mt-1 accent-pink-500"
                        disabled={!report.vipRole || busy}
                      />
                      <span>
                        <strong>{resource.name}</strong>
                        {resource.parentId ? <span className="block text-xs text-pink-100/60">in {vipResources.find((row) => row.id === resource.parentId)?.name || "a category"}</span> : null}
                      </span>
                    </label>
                  ))}
                </div>
              </details>
            );
          })}
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <button
              type="button"
              disabled={busy || !report.vipRole || !selectedVipResourceIds.length || selectedVipResourceIds.length > 100}
              onClick={() => setVipConfirmationOpen(true)}
              className="possum-btn min-h-11 rounded-lg px-4 py-2 text-sm font-black uppercase disabled:cursor-not-allowed disabled:opacity-50"
            >
              Apply VIP visibility ({selectedVipResourceIds.length})
            </button>
            {selectedVipResourceIds.length > 100 ? <span className="text-xs text-amber-100/80">Choose no more than 100 resources at a time.</span> : null}
          </div>
        </section>
      ) : null}

      <section className="rounded-xl border possum-divider bg-black/50 p-4 possum-border sm:p-6">
          <details>
            <summary className="cursor-pointer text-lg font-black uppercase">
              Optional reward role creation ({roleCandidates.length + (report?.rewardRoleOptions?.length || 0)})
            </summary>
            <p className="mt-2 text-sm text-pink-100/70">Select roles Possum should create and connect to a real reward. Achievement and progression rewards are opt-in. Other roles usually refer to roles you already have; leave those unchecked unless the bot grants them.</p>
            <div className="mt-3 grid gap-2 md:grid-cols-2">
              {roleCandidates.map((proposal) => (
                <label key={proposal.id} className="flex items-start gap-3 rounded-lg border border-pink-900/40 p-3 text-sm">
                  <input type="checkbox" checked={previewRoleSelections.includes(proposal.id)} onChange={(event) => setRoleSelected(proposal.id, event.target.checked)} className="mt-1 accent-pink-500" />
                  <span><strong>{proposal.engineLabel || proposal.engine}</strong><span className="block text-xs text-pink-100/60">{proposal.field}{proposal.many ? " (multiple optional roles)" : ""}</span></span>
                </label>
              ))}
            </div>
            {(report?.rewardRoleOptions || []).length ? (
              <div className="mt-4">
                <h3 className="text-sm font-black uppercase">Achievement and level rewards</h3>
                <div className="mt-2 grid gap-2 md:grid-cols-2">
                  {(report?.rewardRoleOptions || []).map((option) => (
                    <div key={option.id} className="grid gap-2 rounded-lg border border-pink-900/40 p-3 text-sm">
                      <label className="flex items-start gap-3">
                        <input type="checkbox" checked={previewRewardRoleSelections.includes(option.id)} onChange={(event) => setRewardRoleSelected(option.id, event.target.checked)} className="mt-1 accent-pink-500" />
                        <span><strong>{option.label}</strong><span className="block text-xs text-pink-100/60">{option.kind === "achievement" ? "Achievement unlock role" : option.kind === "prestige" ? "Prestige reward role" : "Progression level role"} · created role will be wired to this reward</span></span>
                      </label>
                      {previewRewardRoleSelections.includes(option.id) ? (
                        <input
                          value={names[option.id] || option.proposedName}
                          onChange={(event) => updateResourceName(option.id, event.target.value)}
                          maxLength={100}
                          aria-label={`Name for ${option.label} reward role`}
                          className="min-h-10 rounded-md border border-pink-900/50 bg-black px-3 text-sm text-pink-50"
                        />
                      ) : null}
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
            <label className="mt-4 grid gap-2 text-sm">
              <span><strong>Optional custom roles</strong><span className="block text-xs text-pink-100/60">One role name per line, up to 10. These are created for later dashboard assignment and are not granted automatically.</span></span>
              <textarea
                value={customRoleText}
                onChange={(event) => setCustomRoleText(event.target.value)}
                maxLength={1100}
                rows={3}
                aria-label="Optional custom role names"
                placeholder={"Community Helper\nEvent Champion"}
                className="min-h-24 w-full rounded-md border border-pink-900/50 bg-black px-3 py-2 text-sm text-pink-50"
              />
              <span className="text-xs text-pink-100/60">{normalizedCustomRoleNames.length}/10 custom roles</span>
            </label>
          </details>
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
              ), 0) + selectedRewardRoleOptions.length + normalizedCustomRoleNames.length} roles · {channelProposals.length} channels · {explicitCategoryProposals.length + (previewSnapshot.report.setupCategories?.length || 0)} categories · {mappingCount} existing mappings to fill{vipPrivateCreateCount ? ` · ${vipPrivateCreateCount} VIP-protected` : ""}
            </span>
          </div>

          {selectedProtected.length ? (
            <div className="rounded-lg border border-amber-700/50 bg-amber-950/20 p-3 text-sm text-amber-100">
              <strong>Manual review only:</strong> {selectedProtected.map((feature) => feature.name).join(", ")} are selected, but protected flows are not automatically created or rewritten.
            </div>
          ) : null}

          {createProposals.length || selectedRewardRoleOptions.length || normalizedCustomRoleNames.length ? (
            <div className="space-y-4">
              {[
                { title: "Roles", rows: roleProposals },
                { title: "Channels", rows: channelProposals },
                { title: "Engine categories", rows: explicitCategoryProposals },
              ].filter((group) => group.rows.length > 0).map((group) => (
                <details key={group.title} className="rounded-lg border border-pink-900/40 p-3">
                  <summary className="cursor-pointer text-sm font-black uppercase text-pink-100">{group.title} ({group.rows.length})</summary>
                  <div className="mt-3 space-y-2">
                    {group.rows.map((proposal) => (
                      <div key={proposal.id} className="grid gap-1 rounded-lg border border-pink-900/40 p-3 sm:grid-cols-[minmax(0,1fr)_minmax(12rem,20rem)] sm:items-center sm:gap-4">
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
                        {report?.vipRole && (proposal.resourceType === "channel" || proposal.resourceType === "category") ? (
                          <label className="flex items-center gap-2 text-xs text-pink-100/75 sm:col-span-2">
                            <input
                              type="checkbox"
                              checked={vipPrivateSetupKeysSorted.includes(proposal.id)}
                              onChange={(event) => setVipSetupKeySelected(proposal.id, event.target.checked)}
                              className="accent-pink-500"
                            />
                            Restrict this new resource to VIPs (preserve staff access)
                          </label>
                        ) : null}
                      </div>
                    ))}
                  </div>
                </details>
              ))}
            </div>
          ) : (
            <p className="rounded-lg border border-pink-900/40 p-3 text-sm text-pink-100/75">No eligible missing resources need creation for this selection.</p>
          )}

          {previewSnapshot.report.setupCategories?.length ? (
            <div className="space-y-3 rounded-lg border border-pink-900/40 p-3">
              <div>
                <h3 className="text-sm font-black uppercase text-pink-100">Categories for these systems</h3>
                <p className="mt-1 text-xs text-pink-100/65">New system channels go under their feature category. New log, audit, and transcript destinations get a separate Logging category. Existing channels and mappings are not moved.</p>
              </div>
              {previewSnapshot.report.setupCategories.map((category) => {
                const label = category.group === "logging"
                  ? "Logging"
                  : GROUPS.find((group) => group.id === category.group)?.label || category.group;
                const privacyKey = `group-category:${category.group}`;
                return <div key={category.group} className="grid gap-1 rounded-md sm:grid-cols-[minmax(0,1fr)_minmax(12rem,20rem)] sm:items-center sm:gap-4">
                  <span className="text-sm font-bold">{label}</span>
                  <input
                    value={categoryNames[category.group] || category.name}
                    onChange={(event) => updateCategoryName(category.group, event.target.value)}
                    maxLength={100}
                    aria-label={`Name for ${label} category`}
                    className="min-h-11 w-full rounded-md border border-pink-900/50 bg-black px-3 text-sm text-pink-50"
                  />
                  {report?.vipRole ? (
                    <label className="flex items-center gap-2 text-xs text-pink-100/75 sm:col-span-2">
                      <input
                        type="checkbox"
                        checked={vipPrivateSetupKeysSorted.includes(privacyKey)}
                        onChange={(event) => setVipSetupKeySelected(privacyKey, event.target.checked)}
                        className="accent-pink-500"
                      />
                      Restrict this new category to VIPs (preserve staff access)
                    </label>
                  ) : null}
                </div>;
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
            <p className="mt-2 text-sm text-pink-100/80">Possum will connect {mappingCount} existing mapping(s) and create {resourcesToCreate} missing channels, categories, and roles for this server. New channels are grouped by system category. {vipPrivateCreateCount ? `${vipPrivateCreateCount} selected new resource(s) will deny @everyone and allow the configured VIP role while preserving staff access.` : ""} Nothing will be deleted.</p>
            <details className="mt-3 rounded-lg border border-pink-900/40 p-3">
              <summary className="cursor-pointer text-sm font-bold">Show the full creation and mapping list</summary>
              <ul className="mt-2 max-h-56 space-y-1 overflow-y-auto text-sm">
                {createProposals.map((proposal) => <li key={proposal.id}>{proposal.resourceType || "channel"}: <strong>{resourceName(proposal, names)}</strong>
                  {vipPrivateSetupKeysSorted.includes(proposal.id) ? " — VIP-protected" : ""}
                  {proposal.many && proposal.resourceType === "role" && targetRoleCount(proposal, resourceCounts) > 1
                    ? ` (${Math.max(0, targetRoleCount(proposal, resourceCounts) - existingRoleCount(proposal))} to create)`
                    : ""}
                </li>)}
                {selectedRewardRoleOptions.map((option) => <li key={option.id}>reward role: <strong>{names[option.id] || option.proposedName}</strong> → {option.label}</li>)}
                {normalizedCustomRoleNames.map((name, index) => <li key={`custom-role-${index}`}>custom role: <strong>{name}</strong> (not assigned to a reward)</li>)}
                {(previewSnapshot.report.setupCategories || []).map((category) => <li key={`category-${category.group}`}>category: <strong>{categoryNames[category.group] || category.name}</strong>{vipPrivateSetupKeysSorted.includes(`group-category:${category.group}`) ? " — VIP-protected" : ""}</li>)}
                {previewSnapshot.mappings.map((row) => <li key={`map-${row.id}`}>Connect {row.engine}.{row.field} to <strong>{row.resourceName}</strong></li>)}
              </ul>
            </details>
            <p className="mt-3 text-xs text-amber-100/80">Protected flows and Heist resources remain suggestion-only. Any explicit onboarding, verification, or pre-onboarding choice above is applied only after this approved setup finishes.</p>
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

      {vipConfirmationOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-3 sm:p-5" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) setVipConfirmationOpen(false); }}>
          <section role="dialog" aria-modal="true" aria-labelledby="vip-visibility-confirm-title" className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-xl border possum-divider bg-black p-4 shadow-2xl sm:p-6">
            <h2 id="vip-visibility-confirm-title" className="text-xl font-black uppercase">Confirm VIP-only visibility</h2>
            <p className="mt-2 text-sm text-pink-100/80">This will deny View Channel to @everyone and allow it to {report?.vipRole?.name || "the configured VIP role"} for the selected resources. Existing role-specific grants, including staff access, and all other permissions are preserved. Discord administrators always retain access.</p>
            <ul className="mt-3 max-h-56 space-y-1 overflow-y-auto rounded-lg border border-pink-900/40 p-3 text-sm">
              {vipResources.filter((resource) => selectedVipResourceIds.includes(resource.id)).map((resource) => (
                <li key={resource.id}>{resource.kind}: <strong>{resource.name}</strong></li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-amber-100/80">Unsynced channels inside a selected category will not inherit its permissions. Select those channels separately if they should also be VIP-only.</p>
            <div className="mt-4 flex flex-wrap justify-end gap-2">
              <button type="button" disabled={busy} onClick={() => setVipConfirmationOpen(false)} className="min-h-11 rounded-lg border possum-divider px-4 py-2 text-sm font-bold">Cancel</button>
              <button type="button" disabled={busy || !report?.vipRole} onClick={() => void applyVipVisibility()} className="possum-btn min-h-11 rounded-lg px-4 py-2 text-sm font-black uppercase disabled:opacity-50">Confirm permissions</button>
            </div>
          </section>
        </div>
      ) : null}
    </main>
  );
}
