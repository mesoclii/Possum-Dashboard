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
  registryVersion?: number;
  lifecycleStates?: string[];
  dependencies?: string[];
  selectionStatus?: string;
  selectionIssues?: string[];
  implementationDependencies?: {
    services: string[];
    packages: string[];
    envVars: string[];
    runtimeFlags: string[];
  };
  featureDependencies?: { state: string; engineIds: string[] };
  featureConflicts?: { state: string; engineIds: string[] };
  featureRelationships?: {
    state: string;
    connections: {
      engineId: string;
      direction: "incoming" | "outgoing";
      type: string;
      channel: string;
      description: string;
      evidence: string[];
    }[];
  };
  resources?: {
    id: string;
    field: string;
    key: string;
    kind: string;
    many: boolean;
    setupManaged: boolean;
    protectedFlow: boolean;
    writePolicy: string;
    expectedPermissions: string[];
    permissionStatus: string;
    requirementStatus: string;
    dependencies: string[];
  }[];
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
  featureSelection?: { valid: boolean; issues: { type: string; featureId: string; relatedFeatureId: string; message: string }[] };
  setupProfiles?: { id: string; name: string; description: string; featureIds: string[] }[];
  panelGuides?: { id: string; label: string; href: string; page: string; resourceType: string; suggestedName?: string; destination: string; configured: boolean }[];
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
    setupProfile?: string;
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
  activePlan?: { plan: SetupPlan; canResume: boolean; canCancel: boolean; canCompensate: boolean } | null;
  plan?: SetupPlan;
  preview?: { planned?: AdaptRow[]; skipped?: { id: string; reason: string }[] };
  undoPreview?: UndoPreview;
  result?: {
    plan?: SetupPlan;
    action?: { id: string; status: string; result?: { error?: string; resourceId?: string } | null };
    actionResult?: { created?: boolean; resourceId?: string; error?: string };
    completed?: boolean;
    resumable?: boolean;
    error?: string;
    resourcesComplete?: boolean;
    result?: {
      created?: { id?: string; name?: string; engine?: string; field?: string }[];
      failed?: { id?: string; engine?: string; field?: string; name?: string; error?: string; reason?: string }[];
      loggingWarnings?: string[];
      deferred?: number;
      channelCreationDisabled?: boolean;
      message?: string;
    };
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
    planState?: string;
    previewToken?: string;
    deletesResources?: boolean;
    items?: CompensationPreviewItem[];
    compensation?: {
      completed: number;
      alreadyCompensated: number;
      noChange: number;
      retainedResources: number;
      conflicts: number;
      manualReview: number;
      failed: number;
    };
  };
};

type SetupPlan = {
  id: string;
  digest: string;
  state: string;
  createdAt: string;
  expiresAt: string;
  actions: {
    id: string;
    type: string;
    status: string;
    dependencies: string[];
    requiredPermissions?: string[];
    engine?: string;
    field?: string;
    resourceType?: string;
    resourceKey?: string;
    name?: string;
    resourceId?: string;
    resourceName?: string;
    flow?: string;
    choice?: string;
    changes?: { key: string; before: unknown; after: unknown }[];
    before?: unknown;
    after?: unknown;
    permissionCheck?: string;
    permissionStatus?: string;
    missingPermissions?: string[];
    permissionReason?: string;
    result?: { resourceId?: string; error?: string } | null;
    compensation?: { status: string; reason?: string; resourceId?: string } | null;
  }[];
};

type CompensationPreviewItem = {
  actionId: string;
  actionType: string;
  name: string;
  engine?: string;
  field?: string;
  status: string;
  reason: string;
  resourceId?: string;
};

type ActiveSetupPlan = {
  plan: SetupPlan;
  canResume: boolean;
  canCancel: boolean;
  canCompensate: boolean;
};

type CreationFailure = {
  id: string;
  name: string;
  error: string;
};

type PreviewSnapshot = {
  features: string[];
  setupProfile: string;
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
  plan: SetupPlan;
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
  { id: "gaming", label: "Gaming Hub" },
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
  const [activePlan, setActivePlan] = useState<ActiveSetupPlan | null>(null);
  const [compensationPreview, setCompensationPreview] = useState<{
    planId: string;
    previewToken: string;
    items: CompensationPreviewItem[];
    deletesResources: boolean;
  } | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [savedSelection, setSavedSelection] = useState<string[]>([]);
  const [setupProfile, setSetupProfile] = useState("custom");
  const [savedSetupProfile, setSavedSetupProfile] = useState("custom");
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
    setCompensationPreview((current) =>
      current && current.planId === data.activePlan?.plan.id ? current : null
    );
    const next = data.report || null;
    if (next) {
      setReport(next);
      const saved = savedFeatureSelection(next);
      setSelected(saved);
      setSavedSelection(saved);
      setSetupProfile(next.settings?.setupProfile || "custom");
      setSavedSetupProfile(next.settings?.setupProfile || "custom");
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
        const next = data.report || null;
        setActivePlan(data.activePlan || null);
        setReport(next);
        const saved = savedFeatureSelection(next);
        setSelected(saved);
        setSavedSelection(saved);
        setSetupProfile(next?.settings?.setupProfile || "custom");
        setSavedSetupProfile(next?.settings?.setupProfile || "custom");
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
  const featureSelectionIssues = useMemo(() => {
    const selectedIds = new Set(selectedFeatures);
    const issues = new Set<string>();
    for (const feature of features) {
      if (!selectedIds.has(feature.id)) continue;
      if (feature.featureDependencies?.state === "declared") {
        for (const dependencyId of feature.featureDependencies.engineIds) {
          if (!featureById.has(dependencyId)) {
            issues.add(`${feature.name} requires ${featureById.get(dependencyId)?.name || dependencyId}, which is unavailable for this server.`);
          } else if (!selectedIds.has(dependencyId)) {
            issues.add(`${feature.name} requires ${featureById.get(dependencyId)?.name || dependencyId}. Select both systems before setup.`);
          }
        }
      }
      if (feature.featureConflicts?.state === "declared") {
        for (const conflictId of feature.featureConflicts.engineIds) {
          if (selectedIds.has(conflictId)) {
            issues.add(`${feature.name} conflicts with ${featureById.get(conflictId)?.name || conflictId}. Choose only one before setup.`);
          }
        }
      }
    }
    return [...issues];
  }, [features, featureById, selectedFeatures]);
  const selectionDirty = selectedFeatures.join("\n") !== savedSelection.join("\n") ||
    setupProfile !== savedSetupProfile;
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
  const pendingCustomChannels = normalizedCustomChannelNames.filter((name) =>
    !(report?.createdResources || []).some((resource) => resource.resourceKey === `custom-channel:${name.toLowerCase().replace(/[^a-z0-9]+/g, "")}`) &&
    !(report?.directory?.channels || []).some((channel) => ["text", "announcement"].includes(channel.kind) && channel.name.toLowerCase().replace(/[^a-z0-9]+/g, "") === name.toLowerCase().replace(/[^a-z0-9]+/g, ""))
  );
  const standalonePanelGuides = (report?.panelGuides || []).filter((item) =>
    item.id.endsWith(":panel") && item.resourceType === "channel" && Boolean(item.suggestedName)
  );
  const standalonePanelChannelAliases: Record<string, string[]> = {
    "selfroles:panel": ["selfroles", "roles", "selfrolespanel"],
    "giveaways:panel": ["giveaways", "giveaway", "contests"],
  };
  const missingStandalonePanelGuides = standalonePanelGuides.filter((item) =>
    !item.configured &&
    !(report?.directory?.channels || []).some((channel) => {
      const name = channel.name.toLowerCase().replace(/[^a-z0-9]+/g, "");
      const aliases = standalonePanelChannelAliases[item.id] || [String(item.suggestedName || "").toLowerCase().replace(/[^a-z0-9]+/g, "")];
      return ["text", "announcement"].includes(channel.kind) && aliases.includes(name);
    }) && !normalizedCustomChannelNames.some((name) => name.toLowerCase().replace(/[^a-z0-9]+/g, "") === String(item.suggestedName || "").toLowerCase().replace(/[^a-z0-9]+/g, ""))
  );
  const availableRewardRoleOptions = (report?.rewardRoleOptions || []).filter((option) => selected.includes(option.engine));
  const selectedRewardRoleOptions = availableRewardRoleOptions.filter((option) => previewRewardRoleSelections.includes(option.id));
  const editableCreateProposals = useMemo(
    () => proposals.filter((proposal) =>
      (selected.includes(proposal.engine) || `${proposal.engine}:${proposal.field}` === "moderator:logging.logChannelId") &&
      !proposal.protectedFlow &&
      !/deploy/i.test(`${proposal.engine}:${proposal.field}`) &&
      (proposal.resourceType !== "role" || previewRoleSelections.includes(proposal.id)) &&
      (
        proposal.status === "missing" ||
        (proposal.status === "populated" && proposal.many && proposal.resourceType === "role")
      )
    ),
    [proposals, previewRoleSelections, selected]
  );
  const createProposals = useMemo(
    () => editableCreateProposals,
    [editableCreateProposals, names]
  );
  const roleProposals = useMemo(
    () => createProposals.filter((proposal) => proposal.resourceType === "role"),
    [createProposals]
  );
  const channelProposals = useMemo(
    () => editableCreateProposals.filter((proposal) => proposal.resourceType !== "role" && proposal.resourceType !== "category"),
    [editableCreateProposals]
  );
  const explicitCategoryProposals = useMemo(
    () => editableCreateProposals.filter((proposal) => proposal.resourceType === "category"),
    [editableCreateProposals]
  );
  const vipPrivateSetupKeysSorted = sorted(vipPrivateSetupKeys);
  const setupCategoriesToCreate = (previewSnapshot?.report.setupCategories || [])
    .filter((category) => !isPanelDestinationName(categoryNames[category.group] || category.name));
  const resourcesToCreate = createProposals.reduce((count, proposal) => count + (
    proposal.many && proposal.resourceType === "role"
      ? Math.max(0, targetRoleCount(proposal, resourceCounts) - existingRoleCount(proposal))
      : 1
  ), 0) + selectedRewardRoleOptions.length + normalizedCustomRoleNames.length +
    pendingCustomChannels.length + setupCategoriesToCreate.length;
  const mappingCount = previewSnapshot?.mappings.length || 0;
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
    selectionDirty ||
    setupProfile !== previewSnapshot.setupProfile ||
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
  const hasCrewGame = ["crew", "dominion", "contracts"].every((id) => features.some((feature) => feature.id === id));
  const displayFeatures = features.filter((feature) =>
    !hasCrewGame || !["dominion", "contracts"].includes(feature.id)
  ).map((feature) =>
    hasCrewGame && feature.id === "crew"
      ? { ...feature, name: "Crew, Dominion & Contracts", description: "One connected game: crews, territory and contracts. Configure game panels separately." }
      : feature
  );
  const featureSelectionIds = (id: string) => hasCrewGame && id === "crew" ? ["crew", "dominion", "contracts"] : [id];
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
    setSetupProfile("custom");
    setSelectedRoleMappings((current) => roleSelectionsForFeatures(next, current));
  }

  function chooseSetupProfile(profileId: string) {
    const profile = report?.setupProfiles?.find((item) => item.id === profileId);
    if (!profile) return;
    setSetupProfile(profile.id);
    if (profile.id !== "custom") {
      setSelected(profile.featureIds);
      setSelectedRoleMappings((current) => roleSelectionsForFeatures(profile.featureIds, current));
    }
    setError("");
    setMessage("");
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
      const scan = await callApi({ action: "scan" });
      if (scan.report?.panelSetupPolicy !== "channel-destinations-v2") {
        throw new Error("The bot does not report the approved channel-only panel setup policy. Update the bot before running setup.");
      }
      if (scan.report?.channelCreationPolicy !== "single-post-v1") {
        throw new Error("The bot does not confirm the single-request creation policy. Update the bot before running setup.");
      }
      const planPreview = await callApi({
        action: "plan-preview",
        settings: {
          mode: "discovery",
          trackedEngines: selectedFeatures,
          setupProfile,
          resourceNameOverrides: names,
          categoryNameOverrides: categoryNames,
          resourceCounts,
          selectedRoleMappings: previewRoleSelections,
          rewardRoleSelections: previewRewardRoleSelections,
          customRoleNames: normalizedCustomRoleNames,
          customChannelNames: normalizedCustomChannelNames,
          vipPrivateResourceKeys: vipPrivateSetupKeysSorted,
          setupTuning,
        },
        flowChoices,
      });
      if (!planPreview.plan?.id || !planPreview.plan.digest) {
        throw new Error("The bot did not save a versioned setup plan. Update the bot before running setup.");
      }
      if ((planPreview.preview?.planned || []).some((row) => /deploy/i.test(`${row.engine}:${row.field}`))) {
        throw new Error("The bot returned a panel deployment action in its setup preview. Update the bot before running setup.");
      }
      const next = planPreview.report || await loadReport();
      if (!next) throw new Error("The scan completed without returning a setup report.");
      const normalizedNames = next.settings?.resourceNameOverrides || names;
      const normalizedCategoryNames = next.settings?.categoryNameOverrides || categoryNames;
      const normalizedResourceCounts = next.settings?.resourceCounts || resourceCounts;
      const normalizedSetupTuning = Object.fromEntries((next.setupTuning || []).map((setting) => [setting.id, setting.value]));
      const normalizedVipPrivateKeys = sorted(next.settings?.vipPrivateResourceKeys || vipPrivateSetupKeysSorted);
      setReport(next);
      setSelected(sorted(next.settings?.trackedEngines || selectedFeatures));
      setSavedSelection(sorted(next.settings?.trackedEngines || selectedFeatures));
      setSetupProfile(next.settings?.setupProfile || setupProfile);
      setSavedSetupProfile(next.settings?.setupProfile || setupProfile);
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
      const savedCustomChannelNames = next.settings?.customChannelNames || normalizedCustomChannelNames;
      setCustomChannelText(savedCustomChannelNames.join("\n"));
      setSetupTuning(normalizedSetupTuning);
      setPreviewSnapshot({
        features: sorted(next.settings?.trackedEngines || selectedFeatures),
        setupProfile: next.settings?.setupProfile || setupProfile,
        names: normalizedNames,
        categoryNames: normalizedCategoryNames,
        resourceCounts: normalizedResourceCounts,
        selectedRoleMappings: normalizedRoleSelections,
        rewardRoleSelections: normalizedRewardSelections,
        customRoleNames: savedCustomRoleNames,
        customChannelNames: savedCustomChannelNames,
        vipPrivateResourceKeys: normalizedVipPrivateKeys,
        flowChoices: { ...flowChoices },
        setupTuning: normalizedSetupTuning,
        plan: planPreview.plan,
        report: next,
        mappings: planPreview.preview?.planned || [],
        skippedMappings: planPreview.preview?.skipped || [],
      });
      setMessage("Read-only preview ready. Nothing has been created or changed on Discord.");
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

  async function runApprovedPlan(plan: SetupPlan) {
    const allCreated: { id?: string; name?: string; engine?: string; field?: string }[] = [];
    let completed = false;
    for (let index = 0; index < plan.actions.length + 1; index += 1) {
      setBatchProgress(`Applying approved action ${index + 1} of ${plan.actions.length}…`);
      const data = await callApi({ action: "plan-run", planId: plan.id });
      const run = data.result;
      if (!run?.plan) throw new Error("The bot did not return the saved setup-plan checkpoint.");
      setActivePlan({
        plan: run.plan,
        canResume: ["approved", "running", "partial", "failed"].includes(run.plan.state),
        canCancel: ["approved", "running", "resources_complete", "partial", "failed", "recovery_required"].includes(run.plan.state),
        canCompensate: run.plan.actions.some((action) => action.status === "completed"),
      });
      if (data.report) setReport(data.report);
      if (run.actionResult?.created && run.actionResult.resourceId) {
        allCreated.push({ id: run.actionResult.resourceId, name: run.action?.id || "Created resource" });
        setCreated([...allCreated]);
      }
      if (run.action?.status === "failed" || run.error) {
        const failedAction = run.action;
        if (failedAction) {
          setCreationFailures([{
            id: failedAction.id,
            name: failedAction.id,
            error: failedAction.result?.error || run.error || "The action failed and needs attention.",
          }]);
        }
        throw new Error(run.error || failedAction?.result?.error || "The setup plan paused and requires attention.");
      }
      if (run.completed || run.plan.state === "succeeded") {
        completed = true;
        break;
      }
      if (run.action?.status !== "completed") {
        throw new Error("The latest setup action has no successful checkpoint. The saved plan was left unchanged for review.");
      }
    }
    if (!completed) throw new Error("The setup plan did not reach a completed state. Resume it from the saved plan status.");
    const refreshed = await loadReport();
    setPreviewSnapshot(null);
    setCreationFailures([]);
    setMessage(`Setup finished. ${allCreated.length} resource(s) were created; existing mappings were filled only when empty. Protected-flow and automation settings were applied and verified by the bot.`);
    setBatchProgress("");
    if (!refreshed) throw new Error("Setup finished, but the refreshed infrastructure report could not be loaded.");
  }

  async function approveSetup() {
    if (!previewSnapshot || previewDirty) return;
    if (previewSnapshot.report.panelSetupPolicy !== "channel-destinations-v2") {
      setError("The bot does not report the approved channel-only panel setup policy. Update the bot before running setup.");
      return;
    }
    if (previewSnapshot.report.channelCreationPolicy !== "single-post-v1") {
      setError("The bot does not confirm the single-request creation policy. Update the bot before running setup.");
      return;
    }
    setPreviewOpen(false);
    setBusy(true);
    setError("");
    setMessage("");
    setCreated([]);
    setCreationFailures([]);
    setBatchProgress("Approving the saved, versioned setup plan…");
    try {
      const approval = await callApi({
        action: "plan-approve",
        planId: previewSnapshot.plan.id,
        digest: previewSnapshot.plan.digest,
      });
      const approvedPlan = approval.result?.plan || previewSnapshot.plan;
      setActivePlan({ plan: approvedPlan, canResume: true, canCancel: true, canCompensate: false });
      await runApprovedPlan(approvedPlan);
    } catch (cause: unknown) {
      setBatchProgress("");
      setError(cause instanceof Error ? cause.message : "Setup stopped before all approved actions completed.");
      await loadReport().catch(() => null);
    } finally {
      setBusy(false);
    }
  }

  async function resumeActiveSetup() {
    if (!activePlan?.canResume) return;
    setBusy(true);
    setError("");
    setMessage("");
    setBatchProgress("Resuming the saved setup plan…");
    try {
      let plan = activePlan.plan;
      if (plan.state === "draft") {
        const approval = await callApi({ action: "plan-approve", planId: plan.id, digest: plan.digest });
        if (!approval.result?.plan) throw new Error("The bot did not approve the saved setup preview.");
        plan = approval.result.plan;
      } else if (!["approved", "running"].includes(plan.state)) {
        const resumed = await callApi({ action: "plan-resume", planId: plan.id });
        if (!resumed.result?.plan) throw new Error("The bot did not return a resumable setup plan.");
        plan = resumed.result.plan;
      }
      await runApprovedPlan(plan);
    } catch (cause: unknown) {
      setBatchProgress("");
      setError(cause instanceof Error ? cause.message : "The saved setup plan could not be resumed.");
      await loadReport().catch(() => null);
    } finally {
      setBusy(false);
    }
  }

  async function cancelActiveSetup() {
    if (!activePlan?.canCancel) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await callApi({ action: "plan-cancel", planId: activePlan.plan.id });
      setCompensationPreview(null);
      await loadReport();
      setMessage("The setup plan was cancelled. Completed actions and created resources were not rolled back.");
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : "The setup plan could not be cancelled.");
    } finally {
      setBusy(false);
    }
  }

  async function preparePlanCompensation() {
    if (!activePlan?.canCompensate) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const data = await callApi({
        action: "plan-rollback-preview",
        planId: activePlan.plan.id,
      });
      if (!data.result?.previewToken || !Array.isArray(data.result.items)) {
        throw new Error("The server did not return a versioned compensation preview.");
      }
      setCompensationPreview({
        planId: activePlan.plan.id,
        previewToken: data.result.previewToken,
        items: data.result.items,
        deletesResources: data.result.deletesResources === true,
      });
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : "Could not prepare plan compensation.");
    } finally {
      setBusy(false);
    }
  }

  async function compensateActivePlan() {
    if (!compensationPreview) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const data = await callApi({
        action: "plan-rollback",
        planId: compensationPreview.planId,
        previewToken: compensationPreview.previewToken,
      });
      const summary = data.result?.compensation;
      const plan = data.result?.plan;
      if (!summary || !plan) throw new Error("The server did not return the saved compensation checkpoint.");
      setCompensationPreview(null);
      setActivePlan({
        plan,
        canResume: false,
        canCancel: false,
        canCompensate: plan.state === "rollback_incomplete",
      });
      setMessage(
        `Compensation recorded: ${summary.completed} restored, ${summary.retainedResources} created resource(s) retained for separate review, ${summary.conflicts} drift conflict(s), ${summary.manualReview} manual review item(s), ${summary.failed} failure(s). No Discord resources were deleted.`
      );
      try {
        await loadReport();
      } catch (refreshError: unknown) {
        setError(`Compensation was saved, but the infrastructure report could not be refreshed: ${
          refreshError instanceof Error ? refreshError.message : "unknown refresh error"
        }`);
      }
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : "The setup plan could not be compensated.");
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
    setSetupProfile("custom");
    setSelectedRoleMappings((current) => roleSelectionsForFeatures(next, current));
    setError("");
    setMessage("");
  }

  function addPanelChannelsToSetup() {
    const additions = missingStandalonePanelGuides
      .map((item) => item.suggestedName?.trim())
      .filter((name): name is string => Boolean(name))
      .slice(0, Math.max(0, 100 - normalizedCustomChannelNames.length));
    if (!additions.length) {
      setMessage("The recommended self-role and giveaway channels already exist, are configured, or are staged.");
      return;
    }
    const next = [...normalizedCustomChannelNames, ...additions];
    setCustomChannelText(next.join("\n"));
    setError("");
    setMessage(`${additions.length} missing panel destination channel(s) added to the setup review. Preview and approve to create them; setup will not publish panels.`);
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
          Start with the panel checklist, then choose features, connect existing resources, and create the missing roles, channels, and categories you approve.
        </p>
        <p className="mt-3 rounded-lg border border-amber-700/50 bg-amber-950/30 p-3 text-sm text-amber-100">
          Setup reuses clear existing channel matches and can create only the missing destinations you approve. It never posts panel messages, and protected-flow settings change only through explicit, backend-applied choices in the saved plan.
        </p>
      </section>

      <section className="rounded-xl border possum-divider bg-black/50 p-4 possum-border sm:p-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-black uppercase">Panel and member-entry destinations</h2>
            <p className="mt-1 max-w-3xl text-sm text-pink-100/75">Clear existing matches are reused. Missing tracked destinations appear in the reviewed setup plan; self-role and giveaway channels can be staged below. Setup never sends a panel message. Protected member-entry flows remain on their own pages.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" disabled={busy || !missingStandalonePanelGuides.length} onClick={addPanelChannelsToSetup} className="possum-btn min-h-10 rounded-lg px-3 text-sm font-bold disabled:cursor-not-allowed disabled:opacity-50">Add {missingStandalonePanelGuides.length} missing panel channel{missingStandalonePanelGuides.length === 1 ? "" : "s"} to setup</button>
            <a href="/dashboard/channels" className="inline-flex min-h-10 items-center rounded-lg border possum-divider px-3 text-sm font-bold">Review channels</a>
          </div>
        </div>
        <div className="mt-4 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
          {(report?.panelGuides || []).map((item) => (
            <article key={item.id} className="rounded-lg border border-pink-900/40 p-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <strong>{item.label}</strong>
                <span className={`rounded px-2 py-0.5 text-xs ${item.configured ? "bg-emerald-950/50 text-emerald-200" : "bg-amber-950/40 text-amber-100"}`}>
                  {item.id.endsWith(":flow") ? "Configure on page" : !report?.ready ? "Scan to inspect" : item.configured ? "Destination found" : "Needs a destination"}
                </span>
              </div>
              <p className="mt-2 text-sm text-pink-100/70">{item.destination}</p>
              {item.suggestedName ? <p className="mt-1 text-xs text-pink-100/65">Suggested channel: <strong>#{item.suggestedName}</strong>{(report?.directory?.channels || []).some((channel) => ["text", "announcement"].includes(channel.kind) && channel.name.toLowerCase().replace(/[^a-z0-9]+/g, "") === item.suggestedName?.toLowerCase().replace(/[^a-z0-9]+/g, "")) ? " · matching channel already exists" : ""}</p> : null}
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
        <p className="mt-1 text-sm text-pink-100/70">These three switches stay unchanged by default. An explicit Enable or Disable choice is applied and verified by the bot as its own saved-plan action. TTS and all other feature switches are not changed here.</p>
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

      {activePlan ? (
        <section className="rounded-xl border border-amber-700/50 bg-amber-950/20 p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-black uppercase">Saved setup plan: {activePlan.plan.state.replace(/_/g, " ")}</h2>
              <p className="mt-1 text-sm text-amber-100/80">
                {activePlan.plan.actions.filter((action) => ["completed", "skipped"].includes(action.status)).length}
                {" of "}
                {activePlan.plan.actions.length} actions checkpointed. Resuming continues from the first safely pending action; cancelling does not undo completed changes.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {activePlan.canResume ? (
                <button type="button" disabled={busy} onClick={() => void resumeActiveSetup()} className="possum-btn min-h-10 rounded-lg px-4 text-sm font-bold disabled:opacity-50">
                  {busy ? "Working…" : activePlan.plan.state === "draft" ? "Approve saved plan and continue" : activePlan.plan.state === "approved" ? "Continue approved setup" : "Resume setup"}
                </button>
              ) : null}
              {activePlan.canCancel ? (
                <button type="button" disabled={busy} onClick={() => void cancelActiveSetup()} className="min-h-10 rounded-lg border possum-divider px-4 text-sm font-bold disabled:opacity-50">
                  Cancel plan
                </button>
              ) : null}
              {activePlan.canCompensate ? (
                <button type="button" disabled={busy} onClick={() => void preparePlanCompensation()} className="min-h-10 rounded-lg border border-amber-500/60 px-4 text-sm font-bold text-amber-100 disabled:opacity-50">
                  Preview compensation
                </button>
              ) : null}
            </div>
          </div>
          <details className="mt-3 rounded-lg border border-amber-800/40 p-3">
            <summary className="cursor-pointer text-sm font-bold">Review the saved actions and permissions</summary>
            <ol className="mt-3 space-y-2 text-sm">
              {activePlan.plan.actions.map((action, index) => (
                <li key={action.id} className="rounded border border-amber-900/40 p-2">
                  <div className="flex flex-wrap justify-between gap-2">
                    <strong>{index + 1}. {action.name || action.resourceName || action.flow || action.engine || action.id}</strong>
                    <span>{action.status.replace(/_/g, " ")}</span>
                  </div>
                  <p className="mt-1 text-xs text-amber-100/70">
                    {action.type.replace(/_/g, " ")}
                    {action.resourceType ? ` · ${action.resourceType}` : ""}
                    {action.field ? ` · ${action.field}` : ""}
                    {action.choice ? ` · ${action.choice}` : ""}
                    {action.resourceId ? ` · existing resource ${action.resourceId}` : ""}
                  </p>
                  {action.requiredPermissions?.length ? <p className="mt-1 text-xs">Bot permissions: {action.requiredPermissions.join(", ")}</p> : null}
                  {action.permissionCheck ? <p className="mt-1 text-xs">Permission check: refreshed immediately before mutation.</p> : null}
                  {action.permissionStatus ? (
                    <p className={`mt-1 text-xs ${action.permissionStatus === "verified" ? "text-emerald-200" : "text-amber-100"}`}>
                      Permissions at preview: {action.permissionStatus}
                      {action.missingPermissions?.length ? ` · missing ${action.missingPermissions.join(", ")}` : ""}
                      {action.permissionReason ? ` · ${action.permissionReason}` : ""}
                    </p>
                  ) : null}
                  {action.compensation ? (
                    <p className="mt-1 text-xs text-amber-100/80">
                      Compensation: {action.compensation.status.replace(/_/g, " ")}
                      {action.compensation.reason ? ` · ${action.compensation.reason}` : ""}
                    </p>
                  ) : null}
                  {action.before !== null || action.after !== null ? (
                    <p className="mt-1 text-xs text-amber-100/70">
                      Before: {JSON.stringify(action.before)} → After: {JSON.stringify(action.after)}
                    </p>
                  ) : null}
                  {action.dependencies.length ? <p className="mt-1 text-xs text-amber-100/60">Depends on: {action.dependencies.join(", ")}</p> : null}
                  {action.changes?.length ? (
                    <ul className="mt-2 space-y-1 text-xs">
                      {action.changes.map((change) => (
                        <li key={change.key}>
                          <strong>{change.key}:</strong> {JSON.stringify(change.before)} → {JSON.stringify(change.after)}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </li>
              ))}
            </ol>
          </details>
          {compensationPreview?.planId === activePlan.plan.id ? (
            <section aria-label="Setup plan compensation preview" className="mt-3 rounded-lg border border-amber-500/50 bg-black/40 p-3">
              <h3 className="font-black uppercase">Review compensation</h3>
              <p className="mt-1 text-sm text-amber-100/80">
                Only settings and mappings that still match this plan will be restored. Created Discord resources are retained; this action does not delete anything.
              </p>
              <ul className="mt-3 space-y-2 text-sm">
                {compensationPreview.items.map((item) => (
                  <li key={item.actionId} className="rounded border border-amber-900/40 p-2">
                    <strong>{item.name} — {item.status.replace(/_/g, " ")}</strong>
                    <p className="mt-1 text-xs text-amber-100/70">{item.reason}</p>
                    {item.resourceId ? <p className="mt-1 text-xs">Retained resource ID: {item.resourceId}</p> : null}
                  </li>
                ))}
              </ul>
              <div className="mt-3 flex flex-wrap gap-2">
                <button type="button" disabled={busy} onClick={() => void compensateActivePlan()} className="min-h-10 rounded-lg border border-amber-500/60 px-4 text-sm font-bold text-amber-100 disabled:opacity-50">
                  Apply reviewed compensation
                </button>
                <button type="button" disabled={busy} onClick={() => setCompensationPreview(null)} className="min-h-10 rounded-lg border possum-divider px-4 text-sm font-bold disabled:opacity-50">
                  Keep plan unchanged
                </button>
              </div>
            </section>
          ) : null}
        </section>
      ) : null}

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
            <p className="mt-1 text-sm text-pink-100/75">Select the base features to set up. The wizard uses this selection to inspect and reuse existing channels/roles, then show missing resources and optional names for your approval. This selector does not silently flip runtime switches.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-md border possum-divider px-2 py-1 text-xs">{selectedFeatures.length} selected</span>
            <button type="button" disabled={busy || featureSelectionIssues.length > 0 || (selectedFeatures.length === 0 && normalizedCustomRoleNames.length === 0 && normalizedCustomChannelNames.length === 0)} onClick={() => void preparePreview()} className="possum-btn min-h-11 rounded-lg px-4 py-2 text-sm font-black uppercase disabled:cursor-not-allowed disabled:opacity-50">
              {busy ? "Preparing…" : "Preview selected setup"}
            </button>
          </div>
        </div>
        <div className="mt-4 max-w-2xl">
          <label htmlFor="community-setup-profile" className="block text-sm font-black uppercase text-pink-100">
            Community profile
          </label>
          <select
            id="community-setup-profile"
            value={setupProfile}
            disabled={busy || !report?.setupProfiles?.length}
            onChange={(event) => chooseSetupProfile(event.target.value)}
            className="mt-2 min-h-11 w-full rounded-md border possum-divider bg-black px-3 text-sm text-pink-100"
          >
            {(report?.setupProfiles || []).map((profile) => (
              <option key={profile.id} value={profile.id}>{profile.name}</option>
            ))}
          </select>
          <p className="mt-1 text-xs text-pink-100/60">
            {report?.setupProfiles?.find((profile) => profile.id === setupProfile)?.description ||
              "Choose a profile to stage a feature selection. It does not create resources or change runtime switches."}
          </p>
        </div>
        {featureSelectionIssues.length ? (
          <div role="alert" className="mt-3 rounded-lg border border-amber-700/60 bg-amber-950/30 p-3 text-sm text-amber-100">
            <strong>Resolve feature dependencies before previewing setup.</strong>
            <ul className="mt-1 list-disc pl-5">{featureSelectionIssues.map((issue) => <li key={issue}>{issue}</li>)}</ul>
          </div>
        ) : null}
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
                  {feature.implementationDependencies ? (
                    <span className="mt-1 block text-[11px] leading-relaxed text-pink-100/50">
                      Declared runtime dependencies: {[
                        ...feature.implementationDependencies.services,
                        ...feature.implementationDependencies.packages,
                        ...feature.implementationDependencies.envVars.map((name) => `env:${name}`),
                        ...feature.implementationDependencies.runtimeFlags.map((name) => `flag:${name}`),
                      ].join(", ") || "none listed"}
                    </span>
                  ) : null}
                  {feature.featureRelationships?.connections.length ? (
                    <details className="mt-1 text-[11px] text-pink-100/60">
                      <summary className="cursor-pointer">Verified runtime connections (informational)</summary>
                      <ul className="mt-1 list-disc space-y-1 pl-5">
                        {feature.featureRelationships.connections.map((connection) => (
                          <li key={`${connection.direction}:${connection.engineId}:${connection.type}`}>
                            {connection.direction === "outgoing" ? "Connects to" : "Receives from"}{" "}
                            {featureById.get(connection.engineId)?.name || connection.engineId}
                            {connection.description ? ` — ${connection.description}` : ""}
                          </li>
                        ))}
                      </ul>
                      <span className="mt-1 block">These links describe runtime integrations; they do not enable or require the connected feature.</span>
                    </details>
                  ) : null}
                  {hasCrewGame && feature.id === "crew" &&
                    ["crew", "dominion", "contracts"].some((id) => selected.includes(id) !== selected.includes("crew"))
                    ? <span className="block text-xs text-amber-200">Crew, Dominion &amp; Contracts must be selected together.</span>
                    : null}
                </span>
              </label>
            ))}
            {!activeFeatures.length ? <p className="px-2 py-3 text-sm text-pink-100/60">No setup systems are listed in this category.</p> : null}
          </div>
        </fieldset>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button type="button" disabled={busy || featureSelectionIssues.length > 0 || (selectedFeatures.length === 0 && normalizedCustomRoleNames.length === 0 && normalizedCustomChannelNames.length === 0)} onClick={() => void preparePreview()} className="possum-btn min-h-11 rounded-lg px-4 py-2 text-sm font-black uppercase disabled:cursor-not-allowed disabled:opacity-50">
            {busy ? "Preparing…" : "Preview selected setup"}
          </button>
          <span className="text-xs text-pink-100/60">Scanning is read-only. Feature selection saves setup scope; resources and mappings change only after approval. Protected flows change only if explicitly selected above. Other runtime feature switches are left unchanged.</span>
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
            <h2 className="text-lg font-black uppercase">Create and connect roles</h2>
            <p className="mt-1 text-sm text-pink-100/70">Reward roles are optional and created only when explicitly selected. Custom roles can be created without selecting a system.</p>
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

      {previewSnapshot ? (
        <section className="space-y-4 rounded-xl border possum-divider bg-black/50 p-4 possum-border sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-black uppercase">Review the complete setup</h2>
              <p className="mt-1 text-sm text-pink-100/75">Review proposed resources. Clear channel matches are mapped; approved missing destinations can be created. Setup never publishes panel messages.</p>
            </div>
            <span className="rounded-md border possum-divider px-2 py-1 text-xs">
              {resourcesToCreate} resources to create · {roleProposals.reduce((count, proposal) => count + (
                proposal.many && proposal.resourceType === "role"
                  ? Math.max(0, targetRoleCount(proposal, resourceCounts) - existingRoleCount(proposal))
                  : 1
              ), 0) + selectedRewardRoleOptions.length + normalizedCustomRoleNames.length} roles · {createProposals.filter((proposal) => proposal.resourceType === "channel").length + pendingCustomChannels.length} channels · {createProposals.filter((proposal) => proposal.resourceType === "category").length + setupCategoriesToCreate.length} categories · {mappingCount} existing mappings to fill
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

          <section className="rounded-lg border border-pink-900/40 p-3">
            <h3 className="text-sm font-black uppercase text-pink-100">Saved deployment plan</h3>
            <p className="mt-1 text-xs text-pink-100/70">
              Versioned plan {previewSnapshot.plan.id} · {previewSnapshot.plan.actions.length} actions · expires {new Date(previewSnapshot.plan.expiresAt).toLocaleString()}
            </p>
            <details className="mt-2">
              <summary className="cursor-pointer text-xs font-bold">Review action order and dependencies</summary>
              <ol className="mt-2 max-h-48 space-y-1 overflow-y-auto text-xs">
                {previewSnapshot.plan.actions.map((action) => (
                  <li key={action.id}>
                    <strong>{action.id}</strong> — {action.type.replace(/_/g, " ")}
                    {action.before !== null || action.after !== null
                      ? ` · ${JSON.stringify(action.before)} → ${JSON.stringify(action.after)}`
                      : ""}
                    {action.dependencies.length ? ` · depends on ${action.dependencies.join(", ")}` : ""}
                    {action.requiredPermissions?.length ? ` · requires ${action.requiredPermissions.join(", ")}` : ""}
                    {action.permissionStatus ? ` · permissions ${action.permissionStatus}` : ""}
                    {action.permissionReason ? ` (${action.permissionReason})` : ""}
                  </li>
                ))}
              </ol>
            </details>
          </section>

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
            <button type="button" disabled={busy || previewDirty || (resourcesToCreate === 0 && mappingCount === 0 && !previewSnapshot.features.includes("reviews"))} onClick={() => setPreviewOpen(true)} className="possum-btn min-h-11 rounded-lg px-4 py-2 text-sm font-black uppercase disabled:cursor-not-allowed disabled:opacity-50">Approve and build setup</button>
          </div>
        </section>
      ) : null}

      {previewOpen && previewSnapshot ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-3 sm:p-5" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) setPreviewOpen(false); }}>
          <section role="dialog" aria-modal="true" aria-labelledby="server-setup-confirm-title" className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl border possum-divider bg-black p-4 shadow-2xl sm:p-6">
            <h2 id="server-setup-confirm-title" className="text-xl font-black uppercase">Approve server setup?</h2>
            <p className="mt-2 text-sm text-pink-100/80">Possum will connect {mappingCount} existing mapping(s) and create up to {resourcesToCreate} resources. Uncertain creates require manual review; repair remains disabled. Nothing will be deleted.</p>
            <p className="mt-2 text-sm text-pink-100/80">Setup may create or map approved panel destination channels; it never posts panel messages. Protected onboarding settings and existing mappings stay unchanged.</p>
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
                {pendingCustomChannels.map((name, index) => <li key={`custom-channel-${index}`}>custom channel: <strong>{name}</strong></li>)}
                {setupCategoriesToCreate.map((category) => <li key={`category-${category.group}`}>category: <strong>{categoryNames[category.group] || category.name}</strong></li>)}
                {previewSnapshot.mappings.map((row) => <li key={`map-${row.id}`}>Connect {row.engine}.{row.field} to <strong>{row.resourceName}</strong></li>)}
              </ul>
            </details>
            <p className="mt-3 text-xs text-amber-100/80">Heist resources remain suggestion-only. Protected-flow switches change only when explicitly selected above and approved; other runtime feature flags are left unchanged.</p>
            {previewSnapshot.plan.actions.some((action) =>
              action.type === "create_resource" && action.permissionStatus !== "verified"
            ) ? (
              <p className="mt-3 rounded-lg border border-amber-700/50 bg-amber-950/30 p-3 text-sm text-amber-100">
                The bot&apos;s required permissions are not verified for every planned resource. Grant the listed permissions and refresh the preview before approval.
              </p>
            ) : null}
            <label className="mt-3 flex items-start gap-3 rounded-lg border border-pink-900/40 p-3 text-sm">
              <input
                type="checkbox"
                checked={autopilotEnabled}
                onChange={(event) => setAutopilotEnabled(event.target.checked)}
                className="mt-1 accent-pink-500"
              />
              <span>
                <strong className="block">Enable Infrastructure Autopilot after setup</strong>
                <span className="mt-1 block text-xs text-pink-100/70">It can reroute a broken channel/category mapping only to one clear, unused existing match. Channel repair is disabled; unclear cases stay for owner review.</span>
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
                <span className="mt-1 block text-xs text-pink-100/70">When enabled, infrastructure may create missing non-panel roles, channels, and categories for tracked systems. Uncertain creates require manual review.</span>
              </span>
            </label>
            {previewSnapshot.report.setupTuning?.length ? <p className="mt-2 text-xs text-pink-100/70">Approved game and reward values are saved only after confirmation; existing customized settings are not overwritten.</p> : null}
            <div className="mt-4 flex flex-wrap justify-end gap-2">
              <button type="button" disabled={busy} onClick={() => setPreviewOpen(false)} className="min-h-11 rounded-lg border possum-divider px-4 py-2 text-sm font-bold">Cancel</button>
              <button
                type="button"
                disabled={busy || previewDirty || previewSnapshot.plan.actions.some((action) =>
                  action.type === "create_resource" && action.permissionStatus !== "verified"
                )}
                onClick={() => void approveSetup()}
                className="possum-btn min-h-11 rounded-lg px-4 py-2 text-sm font-black uppercase disabled:cursor-not-allowed disabled:opacity-50"
              >
                Yes, build selected setup
              </button>
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
