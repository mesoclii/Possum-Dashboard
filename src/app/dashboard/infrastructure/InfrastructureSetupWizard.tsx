"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { readDashboardGuildId, readDashboardUserId } from "@/lib/dashboardContext";
import { summarizeSetupPlan, type SetupPlan } from "./setupPlan";

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

type SetupCreatedResource = {
  id: string;
  name?: string;
  kind?: string;
  engine?: string;
  field?: string;
  createdBySetup?: boolean | null;
  resourceKey?: string;
};

type PanelGuide = {
  id: string;
  engine?: string;
  selected?: boolean;
  label: string;
  href: string;
  page: string;
  resourceType: string;
  suggestedName?: string;
  destination: string;
  configured: boolean;
  editable?: boolean;
  protectedFlow?: boolean;
  created?: boolean;
};

type UndoResource = {
  id: string;
  name: string;
  kind: string;
  engine: string;
  field: string;
  exists: boolean;
  blocked: boolean;
  reason?: string;
};

type UndoPreview = {
  ok: boolean;
  resources: UndoResource[];
  unverifiedCount: number;
  previewToken: string;
};

type PanelJournalEntry = {
  kind: "reviews" | "selfroles";
  status: "not-started" | "uncertain" | "invalid" | "verified" | "unverified" | "changed";
  id?: string;
  name?: string;
};

type RewardRoleOption = {
  id: string;
  kind: "achievement" | "progression" | "prestige";
  engine: string;
  label: string;
  proposedName: string;
};

type SetupReport = {
  guildId?: string;
  panelSetupPolicy?: string;
  channelCreationPolicy?: string;
  ready?: boolean;
  reason?: string;
  featureCatalog?: Feature[];
  panelGuides?: PanelGuide[];
  proposals?: Proposal[];
  rewardRoleOptions?: RewardRoleOption[];
  vipRole?: { id: string; name: string } | null;
  directory?: {
    categories?: DirectoryResource[];
    channels?: DirectoryResource[];
  };
  setupTuning?: SetupTuning[];
  createdResources?: SetupCreatedResource[];
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
    customChannelNames?: string[];
  };
  setupCategories?: { group: string; name: string }[];
};

type ApiResponse = {
  success?: boolean;
  error?: string;
  report?: SetupReport;
  plan?: SetupPlan;
  activePlan?: { plan: SetupPlan; canResume?: boolean; canCancel?: boolean; canCompensate?: boolean } | null;
  preview?: { planned?: AdaptRow[]; skipped?: { id: string; reason: string }[] };
  undoPreview?: UndoPreview;
  result?: {
    plan?: SetupPlan;
    completed?: boolean;
    error?: string;
    wrote?: boolean;
    stale?: boolean;
    duplicate?: boolean;
    applied?: string[];
    created?: { id?: string; name?: string; engine?: string; field?: string }[];
    failed?: { id?: string; engine?: string; field?: string; name?: string; error?: string; reason?: string }[];
    loggingWarnings?: string[];
    role?: { id: string; name: string };
    deferred?: number;
    id?: string;
    name?: string;
    reason?: string;
    locked?: boolean;
    channelCreationDisabled?: boolean;
    entries?: PanelJournalEntry[];
    message?: string;
    ok?: boolean;
    complete?: boolean;
    unverifiedCount?: number;
    removed?: UndoResource[];
  };
};

type CreationFailure = {
  id: string;
  name: string;
  error: string;
};

type PreviewSnapshot = {
  plan: SetupPlan;
  autopilotEnabled: boolean;
  automaticProvisioningEnabled: boolean;
  features: string[];
  names: Record<string, string>;
  categoryNames: Record<string, string>;
  resourceCounts: Record<string, number>;
  selectedRoleMappings: string[];
  rewardRoleSelections: string[];
  customRoleNames: string[];
  customChannelNames: string[];
  vipPrivateResourceKeys: string[];
  flowChoices: FlowChoices;
  setupTuning: Record<string, number>;
  report: SetupReport;
  mappings: AdaptRow[];
  skippedMappings: { id: string; reason: string }[];
};

const GROUPS = [
  { id: "community", label: "Community" },
  { id: "onboarding", label: "Onboarding & Age Assurance" },
  { id: "moderation", label: "Moderation & Security" },
  { id: "economy", label: "Economy" },
  { id: "fun", label: "Fun & Games" },
  { id: "social", label: "Social Alerts" },
  { id: "automation", label: "Automation" },
  { id: "support", label: "Support & Administration" },
  { id: "logging", label: "Logging" },
  { id: "community-panels", label: "Community Panels" },
];

const DEFAULT_FLOW_CHOICES: FlowChoices = {
  onboarding: "keep",
  verification: "keep",
  preOnboarding: "keep",
};

function sorted(values: string[]) {
  return [...new Set(values)].sort();
}

function isPanelDestinationName(name: string) {
  return /panel|selfroles?/i.test(name.replace(/[^a-z0-9]/gi, ""));
}

function savedFeatureSelection(report: SetupReport | null) {
  const configured = report?.settings?.trackedEngines;
  return sorted(Array.isArray(configured) ? configured : (report?.featureCatalog || []).map((feature) => feature.id));
}

function roleSelectionsForFeatures(features: string[], roles: string[]) {
  const next = new Set(roles);
  if (features.includes("rareSpawn")) next.add("rareSpawn:accessRoleId");
  else next.delete("rareSpawn:accessRoleId");
  return sorted([...next]);
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
  const [selectedRoleMappings, setSelectedRoleMappings] = useState<string[]>([]);
  const [rewardRoleSelections, setRewardRoleSelections] = useState<string[]>([]);
  const [customRoleText, setCustomRoleText] = useState("");
  const [customChannelText, setCustomChannelText] = useState("");
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
  const [activePlan, setActivePlan] = useState<ApiResponse["activePlan"]>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [undoPreview, setUndoPreview] = useState<UndoPreview | null>(null);
  const [undoConfirmOpen, setUndoConfirmOpen] = useState(false);
  const [selectedVipResourceIds, setSelectedVipResourceIds] = useState<string[]>([]);
  const [vipConfirmationOpen, setVipConfirmationOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [created, setCreated] = useState<{ id?: string; name?: string; engine?: string; field?: string }[]>([]);
  const [creationFailures, setCreationFailures] = useState<CreationFailure[]>([]);
  const [batchProgress, setBatchProgress] = useState("");
  const [panelJournal, setPanelJournal] = useState<{ locked: boolean; entries: PanelJournalEntry[] } | null>(null);

  const callApi = useCallback(async (body: Record<string, unknown>) => {
    const response = await fetch("/api/bot/infrastructure", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...body, guildId, userId }),
      cache: "no-store",
    });
    const data = await readJson(response);
    if (readDashboardGuildId() !== guildId || readDashboardUserId() !== userId) {
      throw new Error("The selected server changed while setup was running. Reload this page before continuing.");
    }
    if (data.report?.guildId && String(data.report.guildId) !== guildId) {
      throw new Error("The server returned a setup report for a different server. No result was applied.");
    }
    return data;
  }, [guildId, userId]);

  const loadReport = useCallback(async () => {
    if (!guildId) return null;
    const response = await fetch(
      `/api/bot/infrastructure?guildId=${encodeURIComponent(guildId)}&userId=${encodeURIComponent(userId)}`,
      { cache: "no-store" }
    );
    const data = await readJson(response);
    setActivePlan(data.activePlan || null);
    const next = data.report || null;
    if (next) {
      setReport(next);
      const saved = savedFeatureSelection(next);
      setSelected(saved);
      setSelectedRoleMappings(roleSelectionsForFeatures(saved, sorted(next.settings?.selectedRoleMappings || [])));
      setRewardRoleSelections(sorted(next.settings?.rewardRoleSelections || []));
      setCustomRoleText((next.settings?.customRoleNames || []).join("\n"));
      setCustomChannelText((next.settings?.customChannelNames || []).join("\n"));
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
        setActivePlan(data.activePlan || null);
        const next = data.report || null;
        setReport(next);
        const saved = savedFeatureSelection(next);
        setSelected(saved);
        setSelectedRoleMappings(roleSelectionsForFeatures(saved, sorted(next?.settings?.selectedRoleMappings || [])));
        setRewardRoleSelections(sorted(next?.settings?.rewardRoleSelections || []));
        setCustomRoleText((next?.settings?.customRoleNames || []).join("\n"));
        setCustomChannelText((next?.settings?.customChannelNames || []).join("\n"));
        setVipPrivateSetupKeys(sorted(next?.settings?.vipPrivateResourceKeys || []));
        setNames(next?.settings?.resourceNameOverrides || {});
        setCategoryNames(next?.settings?.categoryNameOverrides || {});
        setResourceCounts(next?.settings?.resourceCounts || {});
        setSetupTuning(Object.fromEntries((next?.setupTuning || []).map((setting) => [setting.id, setting.value])));
        setAutopilotEnabled(next?.settings?.autopilotEnabled === true);
        setAutomaticProvisioningEnabled(next?.settings?.automaticProvisioningEnabled === true);
      })
      .catch((cause: unknown) => setError(cause instanceof Error ? cause.message : "Could not load this server's setup options."))
      .finally(() => setLoading(false));
  }, []);

  const features = useMemo(() => report?.featureCatalog || [], [report?.featureCatalog]);
  const featureById = useMemo(() => new Map(features.map((feature) => [feature.id, feature])), [features]);
  const selectedFeatures = useMemo(() => sorted(selected), [selected]);
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
  const normalizedCustomRoleNames = [...new Set(customRoleText.split(/\r?\n/).map((name) => name.trim().slice(0, 100)).filter(Boolean))].slice(0, 100);
  const normalizedCustomChannelNames = customChannelText.split(/\r?\n/).map((name) => name.trim().slice(0, 100)).filter((name, index, all) =>
    Boolean(name.replace(/[^a-z0-9]+/gi, "")) && all.findIndex((other) => other.toLowerCase().replace(/[^a-z0-9]+/g, "") === name.toLowerCase().replace(/[^a-z0-9]+/g, "")) === index
  ).slice(0, 100);
  const availableRewardRoleOptions = (report?.rewardRoleOptions || []).filter((option) => selected.includes(option.engine));
  const selectedRewardRoleOptions = availableRewardRoleOptions.filter((option) => previewRewardRoleSelections.includes(option.id));
  const vipPrivateSetupKeysSorted = sorted(vipPrivateSetupKeys);
  const planActions = previewSnapshot?.plan.actions || [];
  const planSummary = summarizeSetupPlan(planActions);
  const hasChanges = planSummary.total > 0;
  const createIds = new Set(planActions.filter((action) => action.type === "create_resource")
    .map((action) => action.id.slice("resource:".length).split("#")[0]));
  const editableCreateProposals = proposals.filter((proposal) => createIds.has(proposal.id));
  const roleProposals = editableCreateProposals.filter((proposal) => proposal.resourceType === "role");
  const channelProposals = editableCreateProposals.filter((proposal) => proposal.resourceType === "channel");
  const explicitCategoryProposals = editableCreateProposals.filter((proposal) => proposal.resourceType === "category");
  const blockedCreations = planActions.filter((action) =>
    action.type === "create_resource" && action.permissionStatus !== "verified");
  const skippedMappingCount = previewSnapshot?.skippedMappings.length || 0;
  const namesDirty = Boolean(previewSnapshot && !sameNames(names, previewSnapshot.names));
  const categoryNamesDirty = Boolean(previewSnapshot && !sameNames(categoryNames, previewSnapshot.categoryNames));
  const resourceCountsDirty = Boolean(previewSnapshot && !sameCounts(resourceCounts, previewSnapshot.resourceCounts));
  const setupTuningDirty = Boolean(previewSnapshot && !sameNumbers(setupTuning, previewSnapshot.setupTuning));
  const roleSelectionsDirty = Boolean(previewSnapshot && previewRoleSelections.join("\n") !== previewSnapshot.selectedRoleMappings.join("\n"));
  const rewardRoleSelectionsDirty = Boolean(previewSnapshot && previewRewardRoleSelections.join("\n") !== previewSnapshot.rewardRoleSelections.join("\n"));
  const customRoleNamesDirty = Boolean(previewSnapshot && normalizedCustomRoleNames.join("\n") !== previewSnapshot.customRoleNames.join("\n"));
  const customChannelNamesDirty = Boolean(previewSnapshot && normalizedCustomChannelNames.join("\n") !== previewSnapshot.customChannelNames.join("\n"));
  const vipSetupSelectionsDirty = Boolean(previewSnapshot && vipPrivateSetupKeysSorted.join("\n") !== previewSnapshot.vipPrivateResourceKeys.join("\n"));
  const vipResources = useMemo(() => [
    ...(report?.directory?.categories || []).map((resource) => ({ ...resource, kind: "category" })),
    ...(report?.directory?.channels || []).filter((resource) =>
      ["text", "voice", "announcement", "stage", "forum", "media"].includes(resource.kind)
    ),
  ], [report?.directory]);
  const previewDirty = Boolean(previewSnapshot && (
    autopilotEnabled !== previewSnapshot.autopilotEnabled ||
    automaticProvisioningEnabled !== previewSnapshot.automaticProvisioningEnabled ||
    selectedFeatures.join("\n") !== previewSnapshot.features.join("\n") ||
    namesDirty ||
    categoryNamesDirty ||
    resourceCountsDirty ||
    setupTuningDirty ||
    roleSelectionsDirty ||
    rewardRoleSelectionsDirty ||
    customRoleNamesDirty ||
    customChannelNamesDirty ||
    vipSetupSelectionsDirty ||
    JSON.stringify(flowChoices) !== JSON.stringify(previewSnapshot.flowChoices)
  ));
  const selectedProtected = features.filter((feature) => selected.includes(feature.id) && feature.protected);
  const activeFeatureGroup = GROUPS.find((group) => group.id === activeGroup) || GROUPS[0];
  const hasCrewGame = features.some((feature) => feature.id === "crew") && features.some((feature) => feature.id === "dominion");
  const displayFeatures = features.filter((feature) => !hasCrewGame || feature.id !== "dominion").map((feature) =>
    hasCrewGame && feature.id === "crew"
      ? { ...feature, name: "Crew, Dominion & Contracts", description: "One connected game: crews, territory and contracts. Configure game panels separately." }
      : feature
  );
  const featureSelectionIds = (id: string) => hasCrewGame && id === "crew" ? ["crew", "dominion"] : [id];
  const featureSelected = (id: string) => featureSelectionIds(id).every((entry) => selected.includes(entry));
  const activeFeatures = displayFeatures.filter((feature) => feature.group === activeFeatureGroup.id);
  const activeSelectable = activeFeatures.filter((feature) => feature.selectable);
  const activeGroupAllOn = activeSelectable.length > 0 && activeSelectable.every((feature) => featureSelected(feature.id));
  const reviewOnly = proposals.filter((proposal) =>
    selected.includes(proposal.engine) &&
    proposal.protectedFlow &&
    proposal.status !== "populated"
  );

  function setFeatureEnabled(id: string, enabled: boolean) {
    setError("");
    setMessage("");
    const ids = featureSelectionIds(id);
    const next = enabled
      ? sorted([...selected, ...ids])
      : selected.filter((entry) => !ids.includes(entry));
    setSelected(next);
    setSelectedRoleMappings((current) => roleSelectionsForFeatures(next, current));
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
    if (!selectedFeatures.length && !normalizedCustomRoleNames.length && !normalizedCustomChannelNames.length) {
      setError("Select a system or enter a custom role or channel to preview setup.");
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
      const draft = {
        features: selectedFeatures,
        names,
        categoryNames,
        resourceCounts,
        selectedRoleMappings: previewRoleSelections,
        rewardRoleSelections: previewRewardRoleSelections,
        customRoleNames: normalizedCustomRoleNames,
        customChannelNames: normalizedCustomChannelNames,
        vipPrivateResourceKeys: vipPrivateSetupKeysSorted,
        setupTuning,
        flowChoices,
        autopilotEnabled,
        automaticProvisioningEnabled,
      };
      const data = await callApi({
        action: "plan-preview",
        settings: {
          trackedEngines: draft.features,
          resourceNameOverrides: draft.names,
          categoryNameOverrides: draft.categoryNames,
          resourceCounts: draft.resourceCounts,
          selectedRoleMappings: draft.selectedRoleMappings,
          rewardRoleSelections: draft.rewardRoleSelections,
          customRoleNames: draft.customRoleNames,
          customChannelNames: draft.customChannelNames,
          vipPrivateResourceKeys: draft.vipPrivateResourceKeys,
          setupTuning: draft.setupTuning,
          autopilotEnabled: draft.autopilotEnabled,
          automaticProvisioningEnabled: draft.automaticProvisioningEnabled,
        },
        flowChoices: draft.flowChoices,
      });
      if (!data.report || !data.plan) throw new Error("The bot did not return a setup plan.");
      if (data.report.panelSetupPolicy !== "channel-destinations-v2" || data.report.channelCreationPolicy !== "single-post-v1") {
        throw new Error("The bot did not confirm the setup resource creation policy.");
      }
      setReport(data.report);
      setPreviewSnapshot({
        ...draft,
        plan: data.plan,
        report: data.report,
        mappings: data.preview?.planned || [],
        skippedMappings: data.preview?.skipped || [],
      });
      setMessage(summarizeSetupPlan(data.plan.actions).total
        ? "Plan ready for review. Approve it below to apply the listed changes."
        : "The plan has no changes to apply. Review any unresolved destinations below.");
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : "Could not prepare the setup preview.");
    } finally {
      setBusy(false);
    }
  }

  async function inspectPanelJournal() {
    setBusy(true);
    setError("");
    setPanelJournal(null);
    try {
      const { result } = await callApi({ action: "panel-journal-status" });
      if (!Array.isArray(result?.entries)) throw new Error("Panel creation journal is unavailable.");
      setPanelJournal({ locked: result.locked === true, entries: result.entries });
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : "Could not inspect the panel creation journal.");
    } finally {
      setBusy(false);
    }
  }

  async function approveSetup() {
    if (!previewSnapshot || previewDirty || !hasChanges || blockedCreations.length) return;
    setPreviewOpen(false);
    setBusy(true);
    setError("");
    setMessage("");
    setCreated([]);
    setCreationFailures([]);
    setBatchProgress("Approving the reviewed plan…");
    const draft = previewSnapshot.plan;
    let running = false;
    try {
      const approved = await callApi({ action: "plan-approve", planId: draft.id, digest: draft.digest });
      let plan = approved.result?.plan;
      if (!plan) throw new Error("The bot did not return an approved setup plan.");
      setActivePlan({ plan, canResume: ["approved", "running"].includes(plan.state) || (["partial", "failed", "recovery_required"].includes(plan.state) && plan.actions.some((action) => action.status === "failed" && action.result?.retryable === true)), canCancel: !plan.actions.some((action) => action.status === "running") && ["draft", "approved", "running", "resources_complete", "partial", "failed", "recovery_required"].includes(plan.state) });
      running = true;
      for (let index = 0; index <= draft.actions.length; index += 1) {
        const completed = plan.actions.filter((action) => action.status === "completed").length;
        setBatchProgress(`Applying setup · ${completed} of ${plan.actions.length} checkpoints complete…`);
        const step = await callApi({ action: "plan-run", planId: plan.id });
        const updated = step.result?.plan;
        if (!updated) throw new Error("The bot did not return the next setup checkpoint.");
        plan = updated;
        setActivePlan({ plan, canResume: ["approved", "running"].includes(plan.state) || (["partial", "failed", "recovery_required"].includes(plan.state) && plan.actions.some((action) => action.status === "failed" && action.result?.retryable === true)), canCancel: !plan.actions.some((action) => action.status === "running") && ["draft", "approved", "running", "resources_complete", "partial", "failed", "recovery_required"].includes(plan.state) });
        const summary = summarizeSetupPlan(plan.actions, true);
        setCreated(plan.actions.filter((action) =>
          action.type === "create_resource" && action.status === "completed").map((action) => ({
            id: action.result?.resourceId || action.id, name: action.name, engine: action.engine, field: action.field,
          })));
        setCreationFailures(plan.actions.filter((action) => action.result?.error).map((action) => ({
          id: action.id, name: action.name || action.resourceName || action.field || action.type,
          error: action.result?.error || "Setup stopped at this action.",
        })));
        if (step.result?.error || ["partial", "failed", "recovery_required"].includes(plan.state)) {
          throw new Error(step.result?.error || "Setup stopped before completing the reviewed plan.");
        }
        if (step.result?.completed || plan.state === "succeeded") {
          setPreviewSnapshot(null);
          setActivePlan(null);
          setMessage(summary.creates || summary.mappings
            ? `Setup applied · ${summary.creates} resources created and verified · ${summary.mappings} existing destinations connected.`
            : "Setup applied the reviewed settings. No Discord resources needed creation or mapping.");
          await loadReport();
          return;
        }
      }
      throw new Error("Setup stopped before the final checkpoint.");
    } catch (cause: unknown) {
      const detail = cause instanceof Error ? cause.message : "Setup stopped before all approved actions completed.";
      setError(running ? `${detail} The saved checkpoint is retained below so you can resume without rebuilding the preview.` : detail);
      if (running) {
        setPreviewSnapshot(null);
        await loadReport().catch(() => null);
      }
    } finally {
      setBatchProgress("");
      setBusy(false);
    }
  }

  async function resumeActiveSetup() {
    const saved = activePlan;
    if (!saved?.plan?.id || busy) return;
    setBusy(true);
    setError("");
    setMessage("");
    setBatchProgress("Recovering the saved setup checkpoint…");
    try {
      let plan = saved.plan;
      if (["running", "partial", "failed", "recovery_required"].includes(plan.state)) {
        const recovered = await callApi({ action: "plan-resume", planId: plan.id });
        plan = recovered.result?.plan || plan;
      } else if (plan.state !== "approved") {
        throw new Error(`This setup plan cannot resume while it is ${plan.state}.`);
      }
      setActivePlan({ plan, canResume: ["approved", "running"].includes(plan.state) || (["partial", "failed", "recovery_required"].includes(plan.state) && plan.actions.some((action) => action.status === "failed" && action.result?.retryable === true)), canCancel: !plan.actions.some((action) => action.status === "running") && ["draft", "approved", "running", "resources_complete", "partial", "failed", "recovery_required"].includes(plan.state) });
      for (let index = 0; index <= plan.actions.length; index += 1) {
        const completed = plan.actions.filter((action) => action.status === "completed").length;
        setBatchProgress(`Resuming setup · ${completed} of ${plan.actions.length} checkpoints complete…`);
        const step = await callApi({ action: "plan-run", planId: plan.id });
        const updated = step.result?.plan;
        if (!updated) throw new Error("The bot did not return the next recovered checkpoint.");
        plan = updated;
        setActivePlan({ plan, canResume: ["approved", "running"].includes(plan.state) || (["partial", "failed", "recovery_required"].includes(plan.state) && plan.actions.some((action) => action.status === "failed" && action.result?.retryable === true)), canCancel: !plan.actions.some((action) => action.status === "running") && ["draft", "approved", "running", "resources_complete", "partial", "failed", "recovery_required"].includes(plan.state) });
        setCreated(plan.actions.filter((action) => action.type === "create_resource" && action.status === "completed").map((action) => ({
          id: action.result?.resourceId || action.id, name: action.name, engine: action.engine, field: action.field,
        })));
        setCreationFailures(plan.actions.filter((action) => action.result?.error).map((action) => ({
          id: action.id, name: action.name || action.resourceName || action.field || action.type,
          error: action.result?.error || "Setup stopped at this action.",
        })));
        if (step.result?.error || ["partial", "failed", "recovery_required"].includes(plan.state)) {
          throw new Error(step.result?.error || "Setup needs attention before it can continue.");
        }
        if (step.result?.completed || plan.state === "succeeded") {
          const summary = summarizeSetupPlan(plan.actions, true);
          setActivePlan(null);
          setMessage(summary.creates || summary.mappings
            ? `Setup completed · ${summary.creates} resources created and verified · ${summary.mappings} existing destinations connected.`
            : "Setup completed and the approved settings were verified.");
          await loadReport();
          return;
        }
      }
      throw new Error("Setup stopped before the final checkpoint.");
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : "The saved setup could not be resumed.");
      await loadReport().catch(() => null);
    } finally {
      setBatchProgress("");
      setBusy(false);
    }
  }

  async function cancelActiveSetup() {
    const saved = activePlan;
    if (!saved?.plan?.id || busy || !saved.canCancel) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await callApi({ action: "plan-cancel", planId: saved.plan.id });
      setActivePlan(null);
      setPreviewSnapshot(null);
      setMessage("The saved setup plan was cancelled. No further actions will run.");
      await loadReport();
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : "The setup plan could not be cancelled.");
      await loadReport().catch(() => null);
    } finally {
      setBusy(false);
    }
  }

  async function prepareUndoPreview() {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const data = await callApi({ action: "undo-preview" });
      if (!data.undoPreview) {
        throw new Error("The server did not return a setup rollback preview.");
      }
      setUndoPreview(data.undoPreview);
      setUndoConfirmOpen(true);
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : "Could not prepare setup rollback.");
    } finally {
      setBusy(false);
    }
  }

  async function confirmUndoSetup() {
    if (!undoPreview) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const data = await callApi({
        action: "undo",
        confirmed: true,
        previewToken: undoPreview.previewToken,
      });
      const result = data.result || {};
      const refreshed = await loadReport();
      setUndoConfirmOpen(false);
      setUndoPreview(null);
      const unknownNotice = result.unverifiedCount
        ? ` ${result.unverifiedCount} older resource(s) had unknown ownership and were left untouched.`
        : "";
      setMessage(result.failed?.length
        ? `Undo Setup removed ${result.removed?.length || 0} resource(s); ${result.failed.length} operation(s) need attention.${unknownNotice}`
        : `Undo Setup removed ${result.removed?.length || 0} resource(s) and disabled setup automation.${unknownNotice}`);
      if (result.failed?.length) {
        setError(result.failed.map((item) => `${item.name || item.id || "Resource"}: ${item.error || "Could not remove."}`).join(" "));
      }
      if (!refreshed) throw new Error("Undo Setup finished, but the refreshed infrastructure report could not be loaded.");
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : "Undo Setup could not be completed.");
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
    if (!enabled && selected.includes("rareSpawn") && id === "rareSpawn:accessRoleId") return;
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
    const next = enabled
      ? sorted([...selected, ...ids])
      : selected.filter((id) => !ids.includes(id));
    setSelected(next);
    setSelectedRoleMappings((current) => roleSelectionsForFeatures(next, current));
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
      <section className="relative overflow-hidden rounded-2xl border border-pink-700/40 bg-gradient-to-br from-[#260b16] via-[#12070d] to-black p-5 shadow-[0_18px_70px_rgba(110,12,48,0.18)] possum-border sm:p-7">
        <div aria-hidden="true" className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full border border-pink-300/10 bg-pink-400/[0.05] blur-2xl" />
        <div className="relative">
          <p className="text-[11px] font-black uppercase tracking-[0.28em] text-pink-200/80">Possum · Guided deployment</p>
          <h1 className="mt-3 max-w-4xl text-3xl font-black uppercase leading-[1.04] tracking-[0.035em] text-white sm:text-4xl">Build your server. Understand every decision.</h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-rose-100/80 sm:text-base">This is more than a channel creator. Possum helps you shape the systems your community needs, understand the resources behind each feature, reuse what you already have, and review a complete deployment before anything is applied.</p>
          <div className="mt-5 grid gap-2 sm:grid-cols-3">
            <div className="rounded-xl border border-white/10 bg-black/35 p-3"><p className="text-xs font-black uppercase tracking-wider text-pink-200">01 · Discover</p><p className="mt-1 text-sm text-white">Inspect your server and identify existing roles, channels, categories, and configuration.</p></div>
            <div className="rounded-xl border border-white/10 bg-black/35 p-3"><p className="text-xs font-black uppercase tracking-wider text-pink-200">02 · Design</p><p className="mt-1 text-sm text-white">Choose feature systems, tune names, and see dependencies, permissions, and protected settings.</p></div>
            <div className="rounded-xl border border-white/10 bg-black/35 p-3"><p className="text-xs font-black uppercase tracking-wider text-pink-200">03 · Deploy</p><p className="mt-1 text-sm text-white">Approve the exact plan, follow durable checkpoints, and verify each applied change.</p></div>
          </div>
          <p className="mt-4 rounded-xl border border-amber-500/25 bg-amber-950/20 p-3 text-xs leading-relaxed text-amber-100/90"><strong>Safety is built into the workflow:</strong> existing resources are reused when matches are clear; missing resources are shown for approval; protected onboarding, pre-onboarding, and verification flows are never silently rewritten; panel messages are published from their feature pages, not guessed or spammed by setup.</p>
        </div>
      </section>

      <section className="rounded-xl border possum-divider bg-black/50 p-4 possum-border sm:p-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-black uppercase">Discord panel channels</h2>
            <p className="mt-1 max-w-3xl text-sm text-pink-100/75">Choose the features to include and name their panel channels. Setup can reuse an existing channel or create and connect a new one. Publish each panel from its feature page.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <a href="/dashboard/channels" className="inline-flex min-h-10 items-center rounded-lg border possum-divider px-3 text-sm font-bold">Review channels</a>
          </div>
        </div>
        <div className="mt-4 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
          {(report?.panelGuides || []).map((item) => (
            <article key={item.id} className="rounded-lg border border-pink-900/40 p-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <strong>{item.label}</strong>
                <span className={`rounded px-2 py-0.5 text-xs ${item.configured ? "bg-emerald-950/50 text-emerald-200" : "bg-amber-950/40 text-amber-100"}`}>
                  {item.configured ? "Mapped" : item.editable === false ? "Needs review" : selected.includes(item.engine || "") ? "Included · needs channel" : "Available"}
                </span>
              </div>
              <p className="mt-2 text-sm text-pink-100/70">{item.destination}</p>
              {item.engine && features.some((feature) => feature.id === item.engine && feature.selectable) ? (
                <label className="mt-2 flex items-center gap-2 text-xs text-pink-100">
                  <input type="checkbox" className="accent-pink-500" checked={featureSelected(item.engine)} disabled={busy}
                    onChange={(event) => { if (item.engine) setFeatureEnabled(item.engine, event.target.checked); }} />
                  Include this feature in setup
                </label>
              ) : null}
              {item.suggestedName && item.editable !== false && !item.configured ? (
                <label className="mt-2 block text-xs text-pink-100/75">
                  {item.resourceType === "category" ? "Category name" : "Channel name"}
                  <input
                    value={names[item.id] ?? item.suggestedName}
                    onChange={(event) => updateResourceName(item.id, event.target.value)}
                    maxLength={90}
                    aria-label={`${item.resourceType === "category" ? "Category" : "Channel"} name for ${item.label}`}
                    className="mt-1 min-h-10 w-full rounded-md border border-pink-900/50 bg-black px-3 text-sm text-pink-50"
                  />
                  <span className="mt-1 block text-pink-100/55">Used when this system is selected and included in the approved setup preview.</span>
                </label>
              ) : item.suggestedName ? <p className="mt-1 text-xs text-pink-100/65">Suggested destination: <strong>{item.resourceType === "category" ? "" : "#"}{item.suggestedName}</strong></p> : null}
              <a href={item.href} className="mt-2 inline-flex min-h-9 items-center font-bold text-pink-200 underline">Configure in {item.page} →</a>
            </article>
          ))}
        </div>
      </section>

      <section className="rounded-xl border possum-divider bg-black/50 p-4 possum-border sm:p-6">
        <h2 className="text-lg font-black uppercase">Previous panel setup records</h2>
        <p className="mt-2 text-sm">Setup may create or map an approved destination channel. It never publishes a panel. Previous creation records remain available for manual review.</p>
        <div className="mt-3 flex flex-wrap gap-3">
          <button type="button" disabled={busy} onClick={() => void inspectPanelJournal()} className="min-h-11 rounded-lg border possum-divider px-4 font-bold disabled:opacity-50">Check creation journal</button>
        </div>
        {panelJournal ? (
          <div role="status" className="mt-2 rounded border border-pink-900/50 p-3 text-sm">
            {panelJournal.locked ? <p>An operation may be running, or a previous lock needs manual review. Do not remove it automatically.</p> : null}
            {panelJournal.entries.map((entry) => (
              <p key={entry.kind}>
                <strong>{entry.kind === "reviews" ? "Reviews" : "Self roles"}:</strong>{" "}
                {entry.status === "not-started" ? "No creation request recorded." :
                  entry.status === "verified" ? `Recorded channel #${entry.name} currently matches Discord. Review it before configuring the panel separately.` :
                  entry.status === "uncertain" ? "The request may have succeeded. Check Discord and the journal; do not retry automatically." :
                  entry.status === "changed" ? "The recorded channel no longer matches the approved destination. Inspect Discord manually." :
                  entry.status === "unverified" ? "The recorded channel could not be verified against Discord." :
                  "The journal is incomplete or invalid. Inspect it manually; no automatic retry is safe."}
              </p>
            ))}
            <p className="mt-1 text-xs">This is an advisory snapshot, not permission to clear records or deploy a panel.</p>
          </div>
        ) : null}
      </section>

      <section className="rounded-xl border possum-divider bg-black/50 p-4 possum-border sm:p-6">
        <h2 className="text-lg font-black uppercase">First-run checklist</h2>
        <ol className="mt-3 grid gap-3 text-sm leading-relaxed md:grid-cols-2">
          <li className="rounded-lg border border-pink-900/40 p-3"><strong>1. Choose what this server uses.</strong> Select base features for setup; the wizard inspects their existing resources and lets you customize destinations and optional roles/channels before approval. Runtime switches are not silently changed.</li>
          <li className="rounded-lg border border-pink-900/40 p-3"><strong>2. Choose protected flows explicitly.</strong> Onboarding, verification and pre-onboarding stay as they are unless you select a change below and approve setup. Configure TTS, economy and other runtime switches on their own dashboard pages.</li>
          <li className="rounded-lg border border-pink-900/40 p-3"><strong>3. Configure member entry.</strong> Use the <a className="underline" href="/dashboard/security/pre-onboarding">Onboarding &amp; Age Assurance section</a> for pre-onboarding, onboarding, verification, and age rules. Choose destinations there; setup leaves those protected flows alone unless you explicitly approve a change.</li>
          <li className="rounded-lg border border-pink-900/40 p-3"><strong>4. Configure your custom bot securely.</strong> Use the <a className="underline" href="/dashboard/bot-personalizer#custom-bot-credentials">Bot Personalizer</a> for its token, client ID, and OAuth settings. Never paste tokens into chat.</li>
          <li className="rounded-lg border border-pink-900/40 p-3 md:col-span-2"><strong>5. Set message routing and verify permissions.</strong> In Bot Personalizer, choose who can send DMs, whether guild messages use the bot or webhook, then confirm the bot can manage the selected channels and roles.</li>
        </ol>
      </section>

      {report?.createdResources?.length ? (
        <section className="rounded-xl border border-red-800/60 bg-red-950/20 p-4 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-black uppercase text-red-100">Undo Setup</h2>
              <p className="mt-1 max-w-3xl text-sm text-red-100/75">
                Preview and remove only resources this setup can verify it created. This permanently deletes messages in those channels and removes deleted roles from members.
              </p>
              <p className="mt-1 max-w-3xl text-sm font-bold text-red-100">Only the current Discord server owner or globally authorized Possum emergency staff can preview or undo setup. Server administrators and dashboard roles do not grant access.</p>
              <p className="mt-1 text-sm font-bold text-red-100">Currently unavailable until the dashboard session store and bot ingress are isolated from other services.</p>
              <p className="mt-1 text-sm text-red-100/75"><a className="underline" href="/emergency-undo">Emergency access by server ID</a></p>
            </div>
            <button type="button" disabled onClick={() => void prepareUndoPreview()} className="min-h-11 rounded-lg border border-red-600/70 px-4 py-2 text-sm font-black uppercase text-red-100 disabled:cursor-not-allowed disabled:opacity-50">
              {busy ? "Preparing…" : "Preview Undo"}
            </button>
          </div>
        </section>
      ) : null}

      <section className="rounded-xl border possum-divider bg-black/50 p-4 possum-border sm:p-6">
        <h2 className="text-lg font-black uppercase">Protected flow decisions</h2>
        <p className="mt-1 text-sm text-pink-100/70">These three switches stay unchanged by default. Only an explicit Enable or Disable choice is applied after you approve and finish setup. TTS and all other feature switches are not changed here.</p>
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
      {activePlan?.plan ? (
        <section className="rounded-xl border border-amber-600/40 bg-amber-950/20 p-4 possum-border sm:p-5" aria-labelledby="active-setup-plan-title">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[11px] font-black uppercase tracking-wider text-amber-200">{activePlan.plan.state === "succeeded" ? "Deployment report" : "Saved deployment checkpoint"}</p>
              <h2 id="active-setup-plan-title" className="mt-1 text-lg font-black uppercase text-white">Setup {activePlan.plan.state.replace(/_/g, " ")}</h2>
              <p className="mt-1 text-xs text-amber-100/75">{activePlan.plan.state === "succeeded" ? "The approved plan completed. Its verified checkpoint history is retained here." : "This plan is saved on the bot. You can leave this page and return without losing its checkpoint."}</p>
              {activePlan.plan.state === "recovery_required" && !activePlan.canResume ? (
                <p role="alert" className="mt-2 max-w-3xl rounded-md border border-amber-500/40 bg-black/30 p-2 text-xs text-amber-100">
                  Setup paused because an action could not be safely retried. Review the failed checkpoint below. If the server resources or settings changed, cancel this plan and refresh the setup preview before approving a new plan. Completed checkpoints are retained and will be recognized during the new inventory scan.
                </p>
              ) : null}
            </div>
            <div className="flex flex-wrap gap-2">
              {activePlan.canResume ? <button type="button" disabled={busy} onClick={() => void resumeActiveSetup()} className="possum-btn min-h-10 rounded-lg px-4 text-sm font-black uppercase disabled:opacity-50">{busy ? "Working…" : "Resume setup"}</button> : null}
              {activePlan.canCancel ? <button type="button" disabled={busy} onClick={() => void cancelActiveSetup()} className="min-h-10 rounded-lg border border-amber-500/50 px-4 text-sm font-bold text-amber-100 disabled:opacity-50">Cancel plan</button> : null}
            </div>
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            <div className="rounded-lg border border-white/10 bg-black/30 p-3"><p className="text-xs text-pink-100/60">Completed</p><p className="mt-1 text-xl font-black tabular-nums">{activePlan.plan.actions.filter((action) => action.status === "completed").length}</p></div>
            <div className="rounded-lg border border-white/10 bg-black/30 p-3"><p className="text-xs text-pink-100/60">Remaining</p><p className="mt-1 text-xl font-black tabular-nums">{activePlan.plan.actions.filter((action) => !["completed", "skipped"].includes(action.status)).length}</p></div>
            <div className="rounded-lg border border-white/10 bg-black/30 p-3"><p className="text-xs text-pink-100/60">Total checkpoints</p><p className="mt-1 text-xl font-black tabular-nums">{activePlan.plan.actions.length}</p></div>
          </div>
          <ol className="mt-3 max-h-64 space-y-1 overflow-y-auto text-sm">
            {activePlan.plan.actions.map((action) => (
              <li key={action.id} className="flex items-start gap-2 rounded-md border border-white/5 px-2 py-2">
                <span className={action.status === "completed" ? "text-emerald-300" : action.status === "failed" ? "text-red-300" : action.status === "running" ? "text-amber-200" : "text-pink-100/45"}>{action.status === "completed" ? "✓" : action.status === "failed" ? "!" : action.status === "running" ? "…" : "○"}</span>
                <span className="min-w-0 flex-1">
                  <strong>{action.name || action.resourceName || action.field || action.type}</strong>
                  <span className="ml-2 text-xs text-pink-100/55">{action.type.replace(/_/g, " ")}</span>
                  {action.attempts ? <span className="ml-2 text-[11px] text-pink-100/45">Attempt {action.attempts}</span> : null}
                  {action.result?.error || action.result?.reason ? <span className="mt-1 block text-xs text-red-200">{action.result.error || action.result.reason}</span> : null}
                  {action.result?.skipReason ? <span className="mt-1 block text-xs text-amber-100">Skipped intentionally: {action.result.skipReason}</span> : null}
                  {action.history?.length ? (
                    <span className="mt-1 block text-[11px] text-pink-100/55">
                      Previous attempts: {action.history.slice(-3).map((entry) =>
                        `${entry.attempts || "?"} · ${String(entry.status || "unknown").replace(/_/g, " ")}${entry.recovery ? ` · ${entry.recovery.replace(/_/g, " ")}` : ""}`
                      ).join(" | ")}
                    </span>
                  ) : null}
                  {action.dependencies?.length ? <span className="mt-1 block text-[11px] text-pink-100/45">Waits for: {action.dependencies.join(", ")}</span> : null}
                  {action.missingPermissions?.length ? <span className="mt-1 block text-[11px] text-amber-200">Missing permissions: {action.missingPermissions.join(", ")}</span> : null}
                </span>
                <span className="shrink-0 text-xs capitalize text-pink-100/60">{action.status.replace(/_/g, " ")}</span>
              </li>
            ))}
          </ol>
        </section>
      ) : null}

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
            <p className="mt-1 text-sm text-pink-100/75">Select the base features to set up. The wizard uses this selection to inspect and reuse existing channels/roles, then show missing resources and optional names for your approval. This selector does not silently flip runtime switches.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-md border possum-divider px-2 py-1 text-xs">{selectedFeatures.length} selected</span>
            <button type="button" disabled={busy || (selectedFeatures.length === 0 && normalizedCustomRoleNames.length === 0 && normalizedCustomChannelNames.length === 0)} onClick={() => void preparePreview()} className="possum-btn min-h-11 rounded-lg px-4 py-2 text-sm font-black uppercase disabled:cursor-not-allowed disabled:opacity-50">
              {busy ? "Preparing…" : "Preview selected setup"}
            </button>
          </div>
        </div>
        <div role="tablist" aria-label="Setup feature categories" className="mt-4 flex flex-wrap gap-2">
          {GROUPS.map((group) => {
            const count = displayFeatures.filter((feature) => feature.group === group.id).length;
            if (!count) return null;
            const chosen = displayFeatures.filter((feature) => feature.group === group.id && featureSelected(feature.id)).length;
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
                  aria-checked={featureSelected(feature.id)}
                  checked={featureSelected(feature.id)}
                  disabled={busy || !feature.selectable}
                  onChange={(event) => setFeatureEnabled(feature.id, event.target.checked)}
                  className="mt-1 h-4 w-4 shrink-0 accent-pink-500"
                />
                <span className="min-w-0 flex-1">
                  <span className="block font-bold">{feature.name}{feature.protected ? <span className="ml-2 text-[10px] uppercase text-amber-200">Manual setup</span> : null}</span>
                  <span className="block text-xs leading-relaxed text-pink-100/60">{feature.description}</span>
                  {hasCrewGame && feature.id === "crew" && selected.includes("crew") !== selected.includes("dominion")
                    ? <span className="block text-xs text-amber-200">Only part of this game is currently selected; select it to track both systems.</span>
                    : null}
                </span>
              </label>
            ))}
            {!activeFeatures.length ? <p className="px-2 py-3 text-sm text-pink-100/60">No setup systems are listed in this category.</p> : null}
          </div>
        </fieldset>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button type="button" disabled={busy || (selectedFeatures.length === 0 && normalizedCustomRoleNames.length === 0 && normalizedCustomChannelNames.length === 0)} onClick={() => void preparePreview()} className="possum-btn min-h-11 rounded-lg px-4 py-2 text-sm font-black uppercase disabled:cursor-not-allowed disabled:opacity-50">
            {busy ? "Preparing…" : "Preview selected setup"}
          </button>
          <span className="text-xs text-pink-100/60">Your feature selection and destination changes are saved when you apply the reviewed plan. Protected flows change only if explicitly selected above. Feature selection determines which systems the plan can configure.</span>
        </div>
      </section>

      {report?.directory && report.vipRole && selected.includes("vip") ? (
        <details className="rounded-xl border possum-divider bg-black/50 p-4 possum-border sm:p-6">
          <summary className="cursor-pointer text-sm font-black uppercase">Optional VIP channel visibility</summary>
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
        </details>
      ) : null}

      <section className="rounded-xl border possum-divider bg-black/50 p-4 possum-border sm:p-6">
            <h2 className="text-lg font-black uppercase">Create and connect roles</h2>
            <p className="mt-1 text-sm text-pink-100/70">Select the roles you use for game rewards, alerts, and other features. Achievement, level, and prestige choices come from this server’s configured rewards.</p>
            <h3 className="mt-4 text-sm font-black uppercase">Optional system role mappings ({roleCandidates.length})</h3>
            <p className="mt-1 text-xs text-pink-100/60">Choose only roles that the selected system should grant. Existing role IDs and dashboard-owned role lists are not created here.</p>
            <div className="mt-3 grid gap-2 md:grid-cols-2">
              {roleCandidates.map((proposal) => (
                <label key={proposal.id} className="flex items-start gap-3 rounded-lg border border-pink-900/40 p-3 text-sm">
                  <input type="checkbox" checked={previewRoleSelections.includes(proposal.id)} disabled={proposal.engine === "rareSpawn" && proposal.field === "accessRoleId" && selected.includes("rareSpawn")} onChange={(event) => setRoleSelected(proposal.id, event.target.checked)} className="mt-1 accent-pink-500" />
                  <span><strong>{proposal.engineLabel || proposal.engine}</strong><span className="block text-xs text-pink-100/60">{proposal.engine === "rareSpawn" && proposal.field === "accessRoleId" ? "Required access role for the private Rare Spawn category" : `${proposal.field}${proposal.many ? " (multiple optional roles)" : ""}`}</span></span>
                </label>
              ))}
            </div>
            {availableRewardRoleOptions.length ? (
              <div className="mt-4">
                <h3 className="text-sm font-black uppercase">Achievement, level, and prestige rewards ({availableRewardRoleOptions.length})</h3>
                <div className="mt-2 grid gap-2 md:grid-cols-2">
                  {availableRewardRoleOptions.map((option) => (
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
            ) : selected.some((engine) => ["progression", "achievements", "prestige"].includes(engine)) ? (
              <p className="mt-3 text-sm text-pink-100/70">This server has no configured achievement, level, or prestige rewards waiting for a role.</p>
            ) : null}
            <label className="mt-4 grid gap-2 text-sm">
              <span><strong>Custom Discord roles</strong><span className="block text-xs text-pink-100/60">One role name per line, up to 100. Create them here for later dashboard assignment; this works even when no systems are selected.</span></span>
              <textarea
                value={customRoleText}
                onChange={(event) => setCustomRoleText(event.target.value)}
                maxLength={10100}
                rows={3}
                aria-label="Optional custom role names"
                placeholder={"Community Helper\nEvent Champion"}
                className="min-h-24 w-full rounded-md border border-pink-900/50 bg-black px-3 py-2 text-sm text-pink-50"
              />
              <span className="text-xs text-pink-100/60">{normalizedCustomRoleNames.length}/100 custom roles</span>
            </label>
            <label className="mt-4 grid gap-2 text-sm">
              <span><strong>Custom text channels</strong><span className="block text-xs text-pink-100/60">One name per line, up to 100. Existing matching channels are skipped.</span></span>
              <textarea value={customChannelText} onChange={(event) => setCustomChannelText(event.target.value)} maxLength={10100} rows={3} aria-label="Optional custom channel names" placeholder={"community-chat\nannouncements"} className="min-h-24 w-full rounded-md border border-pink-900/50 bg-black px-3 py-2 text-sm text-pink-50" />
              <span className="text-xs text-pink-100/60">{normalizedCustomChannelNames.length}/100 custom channels</span>
              {normalizedCustomChannelNames.some(isPanelDestinationName) ? <span className="text-xs text-amber-200">Selected panel destination channels appear in the approval plan. Setup creates the channel only; configure and publish the panel from its feature page.</span> : null}
            </label>
      </section>

      <details className="rounded-xl border possum-divider bg-black/50 p-4 possum-border">
        <summary className="cursor-pointer text-sm font-black uppercase">Automation after setup</summary>
        <label className="mt-3 flex items-center gap-2 text-sm">
          <input type="checkbox" checked={autopilotEnabled} disabled={busy} onChange={(event) => setAutopilotEnabled(event.target.checked)} className="accent-pink-500" />
          Enable Infrastructure Autopilot
        </label>
        <label className="mt-2 flex items-center gap-2 text-sm">
          <input type="checkbox" checked={automaticProvisioningEnabled} disabled={busy} onChange={(event) => setAutomaticProvisioningEnabled(event.target.checked)} className="accent-pink-500" />
          Allow automatic creation for selected systems
        </label>
      </details>

      {previewSnapshot ? (
        <section className="space-y-4 rounded-xl border possum-divider bg-black/50 p-4 possum-border sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-black uppercase">Review the complete setup</h2>
              <p className="mt-1 text-sm text-pink-100/75">Review proposed resources. Clear channel matches are mapped; approved missing destinations can be created. Setup never publishes panel messages.</p>
            </div>
            <span className="rounded-md border possum-divider px-2 py-1 text-xs">
              {planSummary.creates} to create · {planSummary.roles} roles · {planSummary.channels} channels · {planSummary.categories} categories · {planSummary.mappings} existing mappings
            </span>
          </div>

          {selectedProtected.length ? (
            <div className="rounded-lg border border-amber-700/50 bg-amber-950/20 p-3 text-sm text-amber-100">
              <strong>Manual review only:</strong> {selectedProtected.map((feature) => feature.name).join(", ")} are selected, but protected flows are not automatically created or rewritten.
            </div>
          ) : null}

          {editableCreateProposals.length || selectedRewardRoleOptions.length || normalizedCustomRoleNames.length ? (
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
                        {proposal.resourceType !== "role" && isPanelDestinationName(resourceName(proposal, names)) ? (
                          <span className="text-xs text-amber-200 sm:col-span-2">Destination channel only; the panel itself is never posted by setup.</span>
                        ) : null}
                        {report?.vipRole && (proposal.resourceType === "channel" || proposal.resourceType === "category") ? (
                          <label className="flex items-center gap-2 text-xs text-pink-100/75 sm:col-span-2">
                            <input type="checkbox" checked={vipPrivateSetupKeysSorted.includes(proposal.id)}
                              onChange={(event) => setVipSetupKeySelected(proposal.id, event.target.checked)} className="accent-pink-500" />
                            Restrict this new resource to VIPs (preserve staff access)
                          </label>
                        ) : null}
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
                <p className="mt-1 text-xs text-pink-100/65">Panel-like category names are excluded from setup.</p>
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
                      <input type="checkbox" checked={vipPrivateSetupKeysSorted.includes(privacyKey)}
                        onChange={(event) => setVipSetupKeySelected(privacyKey, event.target.checked)} className="accent-pink-500" />
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
            <details className="rounded-lg border border-amber-700/50 p-3 text-sm">
              <summary className="cursor-pointer font-bold">{skippedMappingCount} destinations need review</summary>
              <p className="mt-2 text-xs text-pink-100/75">Choose an existing match in Infrastructure or edit the destination name and refresh the plan.</p>
              <ul className="mt-2 space-y-1 text-xs text-amber-100/80">
                {previewSnapshot.skippedMappings.map((row) => {
                  const proposal = proposals.find((entry) => entry.id === row.id);
                  return <li key={row.id} className="rounded-lg border border-amber-700/30 p-2">
                    <strong>{proposal?.intendedName || proposal?.engineLabel || row.id}</strong> · {row.reason}
                    {proposal?.matches?.length ? <span className="block">Possible matches: {proposal.matches.map((match) => match.name).join(", ")}</span> : null}
                    {proposal && ["ambiguous", "duplicate"].includes(proposal.status) ? (
                      <label className="mt-2 block">
                        Use a different destination name
                        <input className="mt-1 block min-h-9 rounded border possum-divider bg-black px-2" value={names[proposal.id] ?? proposal.proposedName ?? ""}
                          onChange={(event) => updateResourceName(proposal.id, event.target.value)} maxLength={100} />
                      </label>
                    ) : null}
                  </li>;
                })}
              </ul>
            </details>
          ) : null}
          {blockedCreations.length ? <p className="text-sm text-amber-200">Discord permissions block {blockedCreations.length} resource actions. Review the bot permissions and refresh the preview.</p> : null}
          {previewDirty ? (
            <p className="rounded-lg border border-amber-700/50 bg-amber-950/30 p-3 text-sm text-amber-100">Your feature or name edits changed after this preview. Refresh the preview before approving.</p>
          ) : null}
          {created.length ? (
            <p className="text-sm text-pink-100">Already created during the last attempt: {created.map((row) => row.name || row.field || row.id).filter(Boolean).join(", ")}</p>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <button type="button" disabled={busy} onClick={() => void preparePreview()} className="min-h-11 rounded-lg border possum-divider px-4 py-2 text-sm font-bold disabled:opacity-50">Refresh preview</button>
            <button type="button" disabled={busy || previewDirty || !hasChanges || blockedCreations.length > 0} onClick={() => setPreviewOpen(true)} className="possum-btn min-h-11 rounded-lg px-4 py-2 text-sm font-black uppercase disabled:cursor-not-allowed disabled:opacity-50">Approve and build setup</button>
          </div>
        </section>
      ) : null}

      {previewOpen && previewSnapshot ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-3 sm:p-5" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) setPreviewOpen(false); }}>
          <section role="dialog" aria-modal="true" aria-labelledby="server-setup-confirm-title" className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl border possum-divider bg-black p-4 shadow-2xl sm:p-6">
            <h2 id="server-setup-confirm-title" className="text-xl font-black uppercase">Approve server setup?</h2>
            <p className="mt-2 text-sm text-pink-100/80">Possum will connect {planSummary.mappings} existing destinations and create {planSummary.creates} resources in this server.</p>
            <p className="mt-2 text-sm text-pink-100/80">Setup may create or map approved panel destination channels; it never posts panel messages. Protected onboarding settings and existing mappings stay unchanged.</p>
            <details className="mt-3 rounded-lg border border-pink-900/40 p-3">
              <summary className="cursor-pointer text-sm font-bold">Show the full creation and mapping list</summary>
              <ul className="mt-2 max-h-56 space-y-1 overflow-y-auto text-sm">
                {planActions.filter((action) => action.type === "create_resource" || action.type === "map_existing_resource").map((action) => (
                  <li key={action.id}>{action.type === "create_resource" ? `Create ${action.resourceType}` : `Connect ${proposals.find((proposal) => `mapping:${proposal.id}` === action.id)?.intendedName || action.engine}`} · <strong>{action.name || action.resourceName}</strong></li>
                ))}
              </ul>
            </details>
            <p className="mt-3 text-xs text-amber-100/80">Heist resources remain suggestion-only. Protected-flow switches change only when explicitly selected above and approved; other runtime feature flags are left unchanged.</p>
            <div className="mt-4 flex flex-wrap justify-end gap-2">
              <button type="button" disabled={busy} onClick={() => setPreviewOpen(false)} className="min-h-11 rounded-lg border possum-divider px-4 py-2 text-sm font-bold">Cancel</button>
              <button type="button" disabled={busy || previewDirty} onClick={() => void approveSetup()} className="possum-btn min-h-11 rounded-lg px-4 py-2 text-sm font-black uppercase disabled:opacity-50">Yes, build selected setup</button>
            </div>
          </section>
        </div>
      ) : null}

      {undoConfirmOpen && undoPreview ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-3 sm:p-5" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) setUndoConfirmOpen(false); }}>
          <section role="dialog" aria-modal="true" aria-labelledby="undo-setup-confirm-title" className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl border border-red-700/70 bg-black p-4 shadow-2xl sm:p-6">
            <h2 id="undo-setup-confirm-title" className="text-xl font-black uppercase text-red-100">Confirm Undo Setup</h2>
            <p className="mt-2 text-sm text-red-100/85">
              {undoPreview.resources.filter((resource) => resource.exists && !resource.blocked).length} resource(s) will be deleted. Messages in those channels will be permanently lost, and deleted roles will be removed from members. The server itself and resources setup merely reused will not be deleted.
            </p>
            {undoPreview.unverifiedCount ? (
              <p className="mt-2 rounded-lg border border-amber-700/50 bg-amber-950/30 p-3 text-sm text-amber-100">
                {undoPreview.unverifiedCount} older resource(s) have unknown ownership and are excluded from deletion.
              </p>
            ) : null}
            <ul className="mt-3 max-h-64 space-y-1 overflow-y-auto rounded-lg border border-red-900/50 p-3 text-sm text-red-50">
              {undoPreview.resources.map((resource) => (
                <li key={resource.id}>
                  {resource.kind}: <strong>{resource.name}</strong>
                  {resource.blocked ? ` — not deletable: ${resource.reason || "Discord restriction"}` : resource.exists ? " — will be deleted" : " — already missing; setup mapping will be cleared"}
                </li>
              ))}
              {!undoPreview.resources.length ? <li>No verified setup-created resources were found.</li> : null}
            </ul>
            <p className="mt-3 text-xs text-pink-100/70">Undo also disables setup automation, clears mappings to deleted resources, and clears setup selections. Other engine settings are left unchanged.</p>
            <div className="mt-4 flex flex-wrap justify-end gap-2">
              <button type="button" disabled={busy} onClick={() => setUndoConfirmOpen(false)} className="min-h-11 rounded-lg border possum-divider px-4 py-2 text-sm font-bold">Cancel</button>
              <button type="button" disabled={busy} onClick={() => void confirmUndoSetup()} className="min-h-11 rounded-lg border border-red-600 bg-red-950 px-4 py-2 text-sm font-black uppercase text-red-100 disabled:opacity-50">
                {busy ? "Removing…" : "Delete listed resources"}
              </button>
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
