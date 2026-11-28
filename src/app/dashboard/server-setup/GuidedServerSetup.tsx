"use client";

// Guided Server Setup: one flow for a brand-new server and for a server that
// is switching from other bots. Every step works on a draft. Nothing changes
// in Discord or in live settings until the owner approves the final plan; the
// bot then builds it through durable, individually verified checkpoints.

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { readDashboardGuildId, readDashboardUserId } from "@/lib/dashboardContext";
import type { SetupPlan, SetupPlanAction } from "../infrastructure/setupPlan";

type Resource = { id: string; name: string; kind?: string; parentId?: string; managed?: boolean; position?: number };

type Feature = {
  id: string;
  name: string;
  group: string;
  protected?: boolean;
  selectable?: boolean;
  dependencies?: string[];
  resources?: { setupManaged?: boolean; panelDestination?: boolean }[];
};

type EntryFlowSummary = { enabled: boolean | null; parts: { id: string; label: string; enabled: boolean }[] };

type Proposal = {
  id: string;
  engine: string;
  engineLabel?: string;
  field: string;
  key?: string;
  status: string;
  reason?: string;
  resourceType?: string;
  many?: boolean;
  protectedFlow?: boolean;
  intendedName?: string;
  proposedName?: string;
  suggestedId?: string;
  suggestedName?: string;
  matchKind?: string;
  matches?: { id: string; name: string; parentName?: string }[];
  currentValue?: unknown;
};

type FeatureDestination = {
  engine: string;
  label: string;
  mode: "own" | "existing" | "none";
  status: "create" | "reuse" | "review" | "top-level";
  name?: string;
  categoryId?: string;
  categoryName?: string;
  reason?: string;
  candidateId?: string;
  accessRole?: boolean;
  accessRoleName?: string;
  channelIds: string[];
};

type GroupDestination = {
  group: string;
  name: string;
  status: "create" | "reuse" | "review";
  categoryId?: string;
  categoryName?: string;
  candidates?: { id: string; name: string }[];
};

type PanelGuide = { id: string; engine?: string; kind?: "posted" | "command"; opensWith?: string; label: string; href: string; page: string; destination: string; configured: boolean };

type RewardOption = { id: string; kind: string; engine: string; label: string; proposedName: string };

type Report = {
  guildId?: string;
  ready?: boolean;
  reason?: string;
  featureCatalog?: Feature[];
  proposals?: Proposal[];
  panelGuides?: PanelGuide[];
  entryFlows?: Partial<Record<Flow, EntryFlowSummary>>;
  rewardRoleOptions?: RewardOption[];
  categoryDestinations?: GroupDestination[];
  featureCategoryDestinations?: FeatureDestination[];
  loggingRoute?: { mode: string; mainChannelId?: string; mainChannelName?: string; source?: string; routedIds?: string[]; issue?: string };
  adoption?: { totals?: Record<string, number> };
  setupProfiles?: { id: string; name: string; description?: string; featureIds: string[] }[];
  directory?: { categories?: Resource[]; channels?: Resource[]; roles?: Resource[] };
  settings?: {
    trackedEngines?: string[];
    trackedEnginesConfigured?: boolean;
    selectedRoleMappings?: string[];
    rewardRoleSelections?: string[];
    resourceNameOverrides?: Record<string, string>;
    categoryNameOverrides?: Record<string, string>;
    featureCategories?: Record<string, Placement>;
    loggingRoute?: { mode: string; channelId?: string };
  };
};

type ActivePlan = { plan: SetupPlan; canResume?: boolean; canCancel?: boolean } | null;

type Placement = { mode: "own"; name: string; accessRole: boolean; accessRoleName?: string }
  | { mode: "existing"; categoryId: string }
  | { mode: "none" };

type FlowChoice = "keep" | "enable" | "disable";
type Flow = "preOnboarding" | "onboarding" | "verification";

type ApiBody = {
  success?: boolean;
  error?: string;
  report?: Report;
  plan?: SetupPlan;
  activePlan?: ActivePlan;
  preview?: { planned?: { id: string; resourceName: string }[]; skipped?: { id: string; reason: string }[]; unresolved?: string[] };
  adaptiveDiscovery?: { addedFeatureIds?: string[] } | null;
  addedDependencies?: string[];
  result?: { ok?: boolean; plan?: SetupPlan; completed?: boolean; error?: string; resumable?: boolean };
};

const STEPS = ["Start", "Systems", "Member entry", "Layout", "Review & build"] as const;

const GROUP_LABELS: Record<string, string> = {
  community: "Community",
  onboarding: "Onboarding & Age Assurance",
  moderation: "Moderation & Security",
  economy: "Economy",
  fun: "Fun & Games",
  gaming: "Gaming Hub",
  social: "Social Alerts",
  automation: "Automation",
  support: "Support & Administration",
  logging: "Logging",
  "community-panels": "Panels",
};

const FLOWS: { id: Flow; label: string; help: string; href: string }[] = [
  { id: "preOnboarding", label: "Pre-onboarding security", help: "Screens people before they reach your server: blacklist rejoins, refusal role and risky profiles.", href: "/dashboard/security/pre-onboarding" },
  { id: "onboarding", label: "Onboarding", help: "Welcomes members, and can add an ID ticket and an age check before they are let in.", href: "/dashboard/security/onboarding" },
  { id: "verification", label: "Verification", help: "Members accept your rules and verify before they can see the rest of the server.", href: "/dashboard/security/verification" },
];

type FlowParts = Partial<Record<Flow, Record<string, boolean>>>;

// Starting points for how members get in. Each one only sets switches; the
// owner can change any part afterwards, and nothing applies until approval.
const ENTRY_BASELINES: { id: string; name: string; description: string; choices: Record<Flow, FlowChoice>; parts: FlowParts }[] = [
  {
    id: "full",
    name: "Full gate",
    description: "Pre-screening, welcome, ID ticket, adults-only age check and verification. The full Lotus Realm style flow.",
    choices: { preOnboarding: "enable", onboarding: "enable", verification: "enable" },
    parts: {
      preOnboarding: { autoBanOnBlacklistRejoin: true, autoBanOnRefusalRole: true, profileThreatGuardEnabled: true, sendRemovalDm: true },
      onboarding: { sendJoinWelcome: true, joinWelcomeCarriesGate: true, idFlowEnabled: true, sendTicketTranscript: true, sendPostVerifyMessage: true, ageCheck: true, adultsOnly: true },
      verification: { requireRulesRead: true, sendWelcomePanel: true, sendWelcomeDm: true, sendGateAnnouncement: true, grantVerifiedRole: true },
    },
  },
  {
    id: "verify-welcome",
    name: "Verification + welcome",
    description: "A welcome message and rules verification. No ID ticket, no age check. The Alexandria style flow.",
    choices: { preOnboarding: "disable", onboarding: "enable", verification: "enable" },
    parts: {
      onboarding: { sendJoinWelcome: true, joinWelcomeCarriesGate: false, idFlowEnabled: false, sendTicketTranscript: false, sendPostVerifyMessage: true, ageCheck: false, adultsOnly: false },
      verification: { requireRulesRead: true, sendWelcomePanel: true, sendWelcomeDm: true, sendGateAnnouncement: true, grantVerifiedRole: true },
    },
  },
  {
    id: "welcome",
    name: "Welcome only",
    description: "Members get a welcome message and walk straight in.",
    choices: { preOnboarding: "disable", onboarding: "enable", verification: "disable" },
    parts: {
      onboarding: { sendJoinWelcome: true, joinWelcomeCarriesGate: false, idFlowEnabled: false, sendTicketTranscript: false, ageCheck: false, adultsOnly: false },
    },
  },
  {
    id: "open",
    name: "Open door",
    description: "No entry flow. Possum leaves new members alone.",
    choices: { preOnboarding: "disable", onboarding: "disable", verification: "disable" },
    parts: {},
  },
];

const LOG_PATTERN = /(^|\.|[A-Z_])(log|logs|logging|audit|transcript)/i;

function sorted(values: string[]) {
  return [...new Set(values)].sort();
}

function humanize(value: string) {
  return String(value || "")
    .replace(/\[\]/g, "")
    .split(".").pop()!
    .replace(/(ChannelIds?|CategoryIds?|RoleIds?|Id)$/i, "")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .trim()
    .replace(/^\w/, (part) => part.toUpperCase()) || "Destination";
}

function isLogProposal(proposal: Proposal) {
  return proposal.resourceType === "channel" && LOG_PATTERN.test(`${proposal.key || ""} ${proposal.field}`);
}

function isPanelProposal(proposal: Proposal) {
  return proposal.resourceType === "channel" && /panel|selfroles:defaultChannelId/i.test(`${proposal.engine}:${proposal.field}`);
}

function idsOf(value: unknown): string[] {
  const list = Array.isArray(value) ? value : [value];
  return list.map((entry) => entry && typeof entry === "object" ? String((entry as { id?: string }).id || "") : String(entry || ""))
    .filter((entry) => /^\d{16,20}$/.test(entry));
}

function currentPartValue(report: Report | null, flow: Flow, partId: string) {
  return report?.entryFlows?.[flow]?.parts.find((part) => part.id === partId)?.enabled === true;
}

async function readJson(response: Response): Promise<ApiBody> {
  let data: ApiBody;
  try {
    data = (await response.json()) as ApiBody;
  } catch {
    throw new Error(`The bot returned an unreadable response (${response.status}).`);
  }
  if (!response.ok || data.success === false) throw new Error(data.error || data.result?.error || `The request failed (${response.status}).`);
  return data;
}

function StatusChip({ tone, children }: { tone: "ok" | "info" | "warn" | "muted"; children: ReactNode }) {
  const tones = {
    ok: "border-emerald-700/50 bg-emerald-950/40 text-emerald-100",
    info: "border-sky-700/50 bg-sky-950/40 text-sky-100",
    warn: "border-amber-700/60 bg-amber-950/40 text-amber-100",
    muted: "border-white/10 bg-white/5 text-pink-100/70",
  };
  return <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-bold ${tones[tone]}`}>{children}</span>;
}

function ResourcePicker({ label, value, onChange, resources, categories, placeholder, disabled }: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  resources: Resource[];
  categories: Resource[];
  placeholder: string;
  disabled?: boolean;
}) {
  const grouped = useMemo(() => {
    const byParent = new Map<string, Resource[]>();
    for (const resource of resources) {
      const parent = String(resource.parentId || "");
      byParent.set(parent, [...(byParent.get(parent) || []), resource]);
    }
    return [...byParent.entries()].map(([parentId, rows]) => ({
      parentId,
      label: parentId ? categories.find((category) => category.id === parentId)?.name || "Other category" : "No category",
      rows: rows.sort((left, right) => left.name.localeCompare(right.name)),
    })).sort((left, right) => left.label.localeCompare(right.label));
  }, [resources, categories]);
  return (
    <select aria-label={label} value={value} disabled={disabled} onChange={(event) => onChange(event.target.value)}
      className="min-h-10 w-full rounded-md border border-pink-900/50 bg-black px-2 text-sm text-pink-50 disabled:opacity-60">
      <option value="">{placeholder}</option>
      {grouped.map((group) => (
        <optgroup key={group.parentId || "root"} label={group.label}>
          {group.rows.map((resource) => <option key={resource.id} value={resource.id}>{resource.kind === "category" ? resource.name : `#${resource.name}`}</option>)}
        </optgroup>
      ))}
    </select>
  );
}

export default function GuidedServerSetup() {
  const [guildId, setGuildId] = useState("");
  const [userId, setUserId] = useState("");
  const [step, setStep] = useState(0);
  const [mode, setMode] = useState<"fresh" | "existing" | "">("");
  const [baseReport, setBaseReport] = useState<Report | null>(null);
  const [draftReport, setDraftReport] = useState<Report | null>(null);
  const [plan, setPlan] = useState<SetupPlan | null>(null);
  const [skipped, setSkipped] = useState<{ id: string; reason: string }[]>([]);
  const [activePlan, setActivePlan] = useState<ActivePlan>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [flowChoices, setFlowChoices] = useState<Record<Flow, FlowChoice>>({ preOnboarding: "keep", onboarding: "keep", verification: "keep" });
  const [flowParts, setFlowParts] = useState<FlowParts>({});
  const [entryBaseline, setEntryBaseline] = useState("");
  const [names, setNames] = useState<Record<string, string>>({});
  const [categoryNames, setCategoryNames] = useState<Record<string, string>>({});
  const [categorySelections, setCategorySelections] = useState<Record<string, string>>({});
  const [placements, setPlacements] = useState<Record<string, Placement>>({});
  const [mappings, setMappings] = useState<Record<string, string>>({});
  const [roleSelections, setRoleSelections] = useState<string[]>([]);
  const [rewardSelections, setRewardSelections] = useState<string[]>([]);
  const [logMode, setLogMode] = useState<"main" | "separate">("main");
  const [logChannelId, setLogChannelId] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [progress, setProgress] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [finished, setFinished] = useState<SetupPlan | null>(null);

  // Only parts that differ from the live settings are sent; the bot plans
  // nothing for a flow whose switches are unchanged.
  const changedFlowParts = useMemo(() => {
    const out: FlowParts = {};
    for (const flow of FLOWS.map((entry) => entry.id)) {
      if (flowChoices[flow] === "disable") continue;
      for (const [partId, enabled] of Object.entries(flowParts[flow] || {})) {
        if (enabled !== currentPartValue(baseReport, flow, partId)) out[flow] = { ...(out[flow] || {}), [partId]: enabled };
      }
    }
    return out;
  }, [flowChoices, flowParts, baseReport]);

  const report = draftReport || baseReport;
  const directory = report?.directory || {};
  const categories = useMemo(() => (directory.categories || []).map((row) => ({ ...row, kind: "category" })), [directory.categories]);
  const textChannels = useMemo(() => (directory.channels || []).filter((row) => ["text", "announcement"].includes(String(row.kind || "text"))), [directory.channels]);
  const roles = useMemo(() => (directory.roles || []).filter((role) => !role.managed && role.name !== "@everyone"), [directory.roles]);

  const loadBase = useCallback(async (nextGuild: string, nextUser: string) => {
    const params = new URLSearchParams({ guildId: nextGuild, userId: nextUser });
    const data = await readJson(await fetch(`/api/bot/infrastructure?${params.toString()}`, { cache: "no-store" }));
    const next = data.report || null;
    setBaseReport(next);
    setActivePlan(data.activePlan || null);
    if (next) {
      const configured = next.settings?.trackedEnginesConfigured ? next.settings?.trackedEngines || [] : [];
      setSelected(sorted(configured));
      setNames(next.settings?.resourceNameOverrides || {});
      setCategoryNames(next.settings?.categoryNameOverrides || {});
      setPlacements(next.settings?.featureCategories || {});
      setRoleSelections(sorted(next.settings?.selectedRoleMappings || []));
      setRewardSelections(sorted(next.settings?.rewardRoleSelections || []));
      const savedRoute = next.settings?.loggingRoute;
      if (savedRoute?.mode === "separate") setLogMode("separate");
      if (savedRoute?.channelId) setLogChannelId(savedRoute.channelId);
      const existingChannels = (next.directory?.channels || []).length;
      setMode((current) => current || (existingChannels > 6 ? "existing" : "fresh"));
    }
    return next;
  }, []);

  useEffect(() => {
    const nextGuild = readDashboardGuildId();
    const nextUser = readDashboardUserId();
    setGuildId(nextGuild);
    setUserId(nextUser);
    if (!nextGuild) {
      setLoading(false);
      return;
    }
    loadBase(nextGuild, nextUser)
      .catch((cause: unknown) => setError(cause instanceof Error ? cause.message : "Could not read this server."))
      .finally(() => setLoading(false));
  }, [loadBase]);

  const callApi = useCallback(async (body: Record<string, unknown>) => {
    const data = await readJson(await fetch("/api/bot/infrastructure", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...body, guildId, userId }),
      cache: "no-store",
    }));
    if (readDashboardGuildId() !== guildId) throw new Error("The selected server changed. Reload this page before continuing.");
    if (data.report?.guildId && data.report.guildId !== guildId) throw new Error("The bot answered for a different server; nothing was applied.");
    return data;
  }, [guildId, userId]);

  const selectableFeatures = useMemo(() => (report?.featureCatalog || baseReport?.featureCatalog || [])
    .filter((feature) => feature.selectable !== false && !feature.protected), [report?.featureCatalog, baseReport?.featureCatalog]);
  const features = useMemo(() => {
    // Internal runtime systems with no Discord resources stay out of the way,
    // unless another listed system needs them (Contracts runs with Crew).
    const listed = selectableFeatures.filter((feature) =>
      (feature.resources || []).some((resource) => resource.setupManaged || resource.panelDestination));
    const needed = new Set(listed.flatMap((feature) => feature.dependencies || []));
    return selectableFeatures.filter((feature) => listed.includes(feature) || needed.has(feature.id));
  }, [selectableFeatures]);
  const featureById = useMemo(() => new Map(features.map((feature) => [feature.id, feature])), [features]);

  function withDependencies(ids: Set<string>) {
    const queue = [...ids];
    while (queue.length) {
      for (const dependency of featureById.get(queue.shift() || "")?.dependencies || []) {
        if (!featureById.has(dependency) || ids.has(dependency)) continue;
        ids.add(dependency);
        queue.push(dependency);
      }
    }
    return ids;
  }

  function setFeatures(ids: string[], enabled: boolean) {
    let next = new Set(selected);
    if (enabled) {
      ids.forEach((id) => next.add(id));
      next = withDependencies(next);
    } else {
      // Turning off a system another one needs turns that one off too, so the
      // selection never ends half-built.
      const removed = new Set(ids);
      let changed = true;
      while (changed) {
        changed = false;
        for (const feature of features) {
          if (!removed.has(feature.id) && next.has(feature.id) && (feature.dependencies || []).some((dependency) => removed.has(dependency))) {
            removed.add(feature.id);
            changed = true;
          }
        }
      }
      removed.forEach((id) => next.delete(id));
    }
    const list = sorted([...next]);
    setSelected(list);
    setRoleSelections((current) => list.includes("rareSpawn")
      ? sorted([...current, "rareSpawn:accessRoleId"])
      : current.filter((entry) => entry !== "rareSpawn:accessRoleId"));
    setDirty(true);
  }

  function toggleFeature(id: string, enabled: boolean) {
    setFeatures([id], enabled);
  }

  function applyProfile(featureIds: string[]) {
    const next = sorted([...withDependencies(new Set(featureIds.filter((id) => featureById.has(id))))]);
    setSelected(next);
    setRoleSelections((current) => next.includes("rareSpawn") ? sorted([...current, "rareSpawn:accessRoleId"]) : current.filter((entry) => entry !== "rareSpawn:accessRoleId"));
    setDirty(true);
  }

  const buildPreview = useCallback(async (options: { adaptive?: boolean } = {}) => {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const data = await callApi({
        action: "plan-preview",
        adaptive: options.adaptive === true,
        settings: {
          trackedEngines: selected,
          resourceNameOverrides: names,
          categoryNameOverrides: categoryNames,
          featureCategories: placements,
          loggingRoute: logMode === "main" ? (logChannelId ? { mode: "main", channelId: logChannelId } : { mode: "main" }) : { mode: "separate" },
          selectedRoleMappings: roleSelections,
          rewardRoleSelections: rewardSelections,
        },
        flowChoices,
        flowParts: changedFlowParts,
        resourceMappings: mappings,
        allowSharedResourceIds: Object.entries(mappings)
          .filter(([, resourceId], _index, all) => all.filter(([, other]) => other === resourceId).length > 1)
          .map(([proposalId]) => proposalId),
        categorySelections,
      });
      if (!data.plan || !data.report) throw new Error("The bot did not return a setup plan.");
      setDraftReport(data.report);
      setPlan(data.plan);
      setSkipped(data.preview?.skipped || []);
      const addedDependencies = data.addedDependencies || [];
      if (addedDependencies.length) {
        setSelected(sorted(data.report.settings?.trackedEngines || selected));
        setNotice(`${addedDependencies.map((id) => featureById.get(id)?.name || id).join(" and ")} switched on too: the systems you picked need ${addedDependencies.length === 1 ? "it" : "them"} to work.`);
      }
      if (options.adaptive) {
        const tracked = data.report.settings?.trackedEngines || [];
        if (tracked.length) setSelected(sorted(tracked));
        const added = data.adaptiveDiscovery?.addedFeatureIds || [];
        if (added.length) setNotice(`Possum recognised ${added.length} system${added.length === 1 ? "" : "s"} already in use here and switched ${added.length === 1 ? "it" : "them"} on: ${added.map((id) => featureById.get(id)?.name || id).join(", ")}.`);
      }
      setDirty(false);
      return data;
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : "Could not prepare the setup plan.");
      return null;
    } finally {
      setBusy(false);
    }
  }, [callApi, selected, names, categoryNames, placements, logMode, logChannelId, roleSelections, rewardSelections, flowChoices, changedFlowParts, mappings, categorySelections, featureById]);

  function partValue(flow: Flow, partId: string) {
    const draft = flowParts[flow]?.[partId];
    return typeof draft === "boolean" ? draft : currentPartValue(baseReport, flow, partId);
  }

  function applyEntryBaseline(baselineId: string) {
    const baseline = ENTRY_BASELINES.find((entry) => entry.id === baselineId);
    if (!baseline) return;
    setEntryBaseline(baseline.id);
    setFlowChoices(baseline.choices);
    setFlowParts(baseline.parts);
    setDirty(true);
  }

  function setPart(flow: Flow, partId: string, enabled: boolean) {
    setEntryBaseline("");
    setFlowParts((current) => ({ ...current, [flow]: { ...(current[flow] || {}), [partId]: enabled } }));
    setDirty(true);
  }

  const proposals = useMemo(() => (draftReport?.proposals || []).filter((proposal) => !proposal.protectedFlow), [draftReport?.proposals]);
  const routed = useMemo(() => new Set(draftReport?.loggingRoute?.routedIds || []), [draftReport?.loggingRoute?.routedIds]);
  const createIds = useMemo(() => new Set((plan?.actions || []).filter((action) => action.type === "create_resource")
    .map((action) => action.id.slice("resource:".length).split("#")[0])), [plan?.actions]);
  const mapIds = useMemo(() => new Set((plan?.actions || []).filter((action) => action.type === "map_existing_resource")
    .map((action) => action.id.slice("mapping:".length))), [plan?.actions]);
  const featureDestinations = useMemo(() => new Map((draftReport?.featureCategoryDestinations || []).map((destination) => [destination.engine, destination])), [draftReport?.featureCategoryDestinations]);
  const explicitCategoryEngines = useMemo(() => new Set(proposals.filter((proposal) => proposal.resourceType === "category" && !proposal.many).map((proposal) => proposal.engine)), [proposals]);

  function proposalState(proposal: Proposal): { tone: "ok" | "info" | "warn" | "muted"; label: string } {
    if (proposal.status === "populated") {
      const id = idsOf(proposal.currentValue)[0];
      const all = [...(directory.channels || []), ...categories, ...(directory.roles || [])];
      const name = all.find((row) => row.id === id)?.name;
      return { tone: "ok", label: name ? `Connected · ${proposal.resourceType === "role" ? "@" : proposal.resourceType === "category" ? "" : "#"}${name}` : "Connected" };
    }
    if (routed.has(proposal.id)) return { tone: "info", label: "Sent to the main log channel" };
    if (mapIds.has(proposal.id)) {
      const pickedId = mappings[proposal.id] || proposal.suggestedId || "";
      const all = [...(directory.channels || []), ...categories, ...(directory.roles || [])];
      return { tone: "info", label: `Will connect · ${all.find((row) => row.id === pickedId)?.name || proposal.suggestedName || "existing"}` };
    }
    if (createIds.has(proposal.id)) return { tone: "info", label: "Will create" };
    if (["ambiguous", "duplicate"].includes(proposal.status)) return { tone: "warn", label: "Choose one" };
    if (proposal.resourceType === "role" && !roleSelections.includes(proposal.id)) return { tone: "muted", label: "Optional" };
    return { tone: "warn", label: "Needs attention" };
  }

  function setMapping(proposalId: string, resourceId: string) {
    setMappings((current) => {
      const next = { ...current };
      if (resourceId) next[proposalId] = resourceId;
      else delete next[proposalId];
      return next;
    });
    setDirty(true);
  }

  function setPlacement(engine: string, placement: Placement | null) {
    setPlacements((current) => {
      const next = { ...current };
      if (placement) next[engine] = placement;
      else delete next[engine];
      return next;
    });
    setDirty(true);
  }

  async function goTo(nextStep: number) {
    setError("");
    if (nextStep >= 3 && step < 3) {
      if (!selected.length) {
        setError("Pick at least one system to set up.");
        return;
      }
      const data = await buildPreview({ adaptive: mode === "existing" && !draftReport });
      if (!data) return;
    }
    setStep(nextStep);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function runPlan(startPlan: SetupPlan) {
    let current = startPlan;
    for (let index = 0; index <= current.actions.length + 2; index += 1) {
      const done = current.actions.filter((action) => ["completed", "skipped"].includes(action.status)).length;
      setProgress(`Building · ${done} of ${current.actions.length} steps verified`);
      const step = await callApi({ action: "plan-run", planId: current.id });
      if (!step.result?.plan) throw new Error(step.result?.error || "The bot did not return the next checkpoint.");
      current = step.result.plan;
      setPlan(current);
      if (step.result.error || ["partial", "failed", "recovery_required"].includes(current.state)) {
        throw Object.assign(new Error(step.result.error || "Setup paused before finishing."), { resumable: step.result.resumable === true });
      }
      if (step.result.completed || current.state === "succeeded") return current;
    }
    throw new Error("Setup paused before the final checkpoint.");
  }

  async function approveAndBuild() {
    if (!plan || dirty) return;
    setConfirmOpen(false);
    setBusy(true);
    setError("");
    setNotice("");
    try {
      setProgress("Approving your plan…");
      const approved = await callApi({ action: "plan-approve", planId: plan.id, digest: plan.digest });
      const approvedPlan = approved.result?.plan;
      if (!approvedPlan) throw new Error("The bot did not confirm the approval.");
      const complete = await runPlan(approvedPlan);
      setFinished(complete);
      setNotice("Your server is built. Everything was verified and recorded in your log channel.");
      await loadBase(guildId, userId);
    } catch (cause: unknown) {
      const message = cause instanceof Error ? cause.message : "Setup paused.";
      setError(`${message} Your progress is saved; nothing will be created twice.`);
      await loadBase(guildId, userId).catch(() => null);
    } finally {
      setProgress("");
      setBusy(false);
    }
  }

  async function resumeActive() {
    if (!activePlan?.plan) return;
    setBusy(true);
    setError("");
    try {
      let current = activePlan.plan;
      if (["partial", "failed", "recovery_required"].includes(current.state)) {
        const resumed = await callApi({ action: "plan-resume", planId: current.id });
        if (!resumed.result?.plan) throw new Error("The plan could not be resumed.");
        current = resumed.result.plan;
      }
      const complete = await runPlan(current);
      setFinished(complete);
      setNotice("Setup finished.");
      await loadBase(guildId, userId);
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : "Setup could not continue.");
      await loadBase(guildId, userId).catch(() => null);
    } finally {
      setProgress("");
      setBusy(false);
    }
  }

  async function cancelActive() {
    if (!activePlan?.plan) return;
    setBusy(true);
    try {
      await callApi({ action: "plan-cancel", planId: activePlan.plan.id });
      await loadBase(guildId, userId);
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : "Could not cancel the saved plan.");
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <main className="rounded-xl border possum-divider bg-black/50 p-5 text-pink-100">Reading your server…</main>;
  if (!guildId) {
    return (
      <main className="space-y-3 rounded-xl border possum-divider bg-black/50 p-5 text-pink-100">
        <h1 className="text-2xl font-black uppercase">Server Setup</h1>
        <p>Choose a server first.</p>
        <a href="/guilds" className="inline-flex min-h-11 items-center rounded-lg border possum-divider px-4 font-bold">Choose a server</a>
      </main>
    );
  }

  const activeRunning = activePlan?.plan && !["draft", "succeeded", "cancelled", "stale", "rolled_back"].includes(activePlan.plan.state);
  const enginesInPlan = sorted([...new Set(proposals.map((proposal) => proposal.engine))]);
  const logProposals = proposals.filter((proposal) => isLogProposal(proposal));
  const panelProposals = proposals.filter((proposal) => isPanelProposal(proposal) && !isLogProposal(proposal));
  const planActions = plan?.actions || [];
  const creates = planActions.filter((action) => action.type === "create_resource");
  const connects = planActions.filter((action) => action.type === "map_existing_resource");
  const routeAction = planActions.find((action) => action.type === "route_logging");
  const flowActions = planActions.filter((action) => action.type === "configure_protected_flow");
  const blocked = creates.filter((action) => action.permissionStatus && action.permissionStatus !== "verified");
  const reviewNeeded = [
    ...(draftReport?.categoryDestinations || []).filter((destination) => destination.status === "review")
      .map((destination) => `Choose a category for ${GROUP_LABELS[destination.group] || destination.group}.`),
    ...(draftReport?.featureCategoryDestinations || []).filter((destination) => destination.status === "review")
      .map((destination) => `${destination.label}: ${destination.reason || "choose a category."}`),
    ...(draftReport?.loggingRoute?.issue ? [draftReport.loggingRoute.issue] : []),
  ];
  const totals = draftReport?.adoption?.totals || baseReport?.adoption?.totals || {};

  const stepper = (
    <ol className="flex flex-wrap gap-2" aria-label="Setup steps">
      {STEPS.map((label, index) => (
        <li key={label}>
          <button type="button" disabled={busy || (index > step && index >= 3 && !selected.length)}
            onClick={() => void goTo(index)}
            aria-current={step === index ? "step" : undefined}
            className={`min-h-10 rounded-full border px-3 text-xs font-black uppercase tracking-wider ${step === index ? "border-pink-400 bg-pink-500/20 text-white" : index < step ? "border-emerald-700/60 text-emerald-100" : "border-white/10 text-pink-100/60"}`}>
            {index + 1}. {label}
          </button>
        </li>
      ))}
    </ol>
  );

  return (
    <main className="space-y-4 text-pink-50">
      <section className="relative overflow-hidden rounded-2xl border border-pink-700/40 bg-gradient-to-br from-[#260b16] via-[#12070d] to-black p-5 sm:p-7">
        <p className="text-[11px] font-black uppercase tracking-[0.28em] text-pink-200/80">Possum · Server Setup</p>
        <h1 className="mt-2 text-3xl font-black uppercase leading-tight text-white sm:text-4xl">Your whole server, set up in one pass.</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-rose-100/80">Pick what you want. Possum reads your server, reuses what you already have, names and places everything the way you choose, and builds the rest. Your log channel is set up first, so every step is recorded. Nothing changes until you approve.</p>
        <div className="mt-4">{stepper}</div>
      </section>

      {activeRunning && activePlan ? (
        <section role="status" className="rounded-xl border border-amber-600/50 bg-amber-950/30 p-4 text-sm text-amber-50">
          <p className="font-bold">A setup plan is {activePlan.plan.state.replace(/_/g, " ")}.</p>
          <p className="mt-1 text-amber-100/80">{activePlan.plan.actions.filter((action) => action.status === "completed").length} of {activePlan.plan.actions.length} steps are done. Finished steps are never repeated.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {activePlan.canResume ? <button type="button" disabled={busy} onClick={() => void resumeActive()} className="possum-btn min-h-10 rounded-lg px-4 text-xs font-black uppercase">Continue setup</button> : null}
            {activePlan.canCancel ? <button type="button" disabled={busy} onClick={() => void cancelActive()} className="min-h-10 rounded-lg border border-white/15 px-4 text-xs font-bold">Cancel saved plan</button> : null}
            <a href="/dashboard/infrastructure" className="inline-flex min-h-10 items-center rounded-lg border border-white/15 px-4 text-xs font-bold">Review in Infrastructure</a>
          </div>
        </section>
      ) : null}

      {error ? <div role="alert" className="rounded-lg border border-red-700/60 bg-red-950/50 p-3 text-sm text-red-100">{error}</div> : null}
      {notice ? <div role="status" className="rounded-lg border border-emerald-700/50 bg-emerald-950/30 p-3 text-sm text-emerald-100">{notice}</div> : null}
      {progress ? <div role="status" aria-live="polite" className="rounded-lg border possum-divider bg-black/60 p-3 text-sm">{progress}</div> : null}

      {finished ? (
        <section className="space-y-3 rounded-xl border border-emerald-700/50 bg-black/50 p-5">
          <h2 className="text-xl font-black uppercase">Built and verified</h2>
          <p className="text-sm text-pink-100/80">{finished.actions.filter((action) => action.type === "create_resource" && action.status === "completed").length} resources created · {finished.actions.filter((action) => action.type === "map_existing_resource" && action.status === "completed").length} existing resources connected. Every dashboard page now uses these channels and roles.</p>
          {(baseReport?.panelGuides || []).length ? (
            <div>
              <h3 className="text-sm font-black uppercase">Next: calibrate and publish your panels</h3>
              <p className="mt-1 text-xs text-pink-100/70">Setup made the panel channels but never posts a panel. Set each one up, then publish it from its page.</p>
              <ul className="mt-2 grid gap-2 md:grid-cols-2">
                {(baseReport?.panelGuides || []).filter((guide) => selected.includes(guide.engine || "")).map((guide) => (
                  <li key={guide.id} className="flex items-center justify-between gap-2 rounded-lg border border-white/10 p-3 text-sm">
                    <span><strong>{guide.label}</strong><span className="block text-xs text-pink-100/60">{guide.destination}{guide.kind === "command" && guide.opensWith ? ` · ${guide.opensWith}` : ""}</span></span>
                    <a href={guide.href} className="shrink-0 font-bold text-pink-200 underline">Open {guide.page}</a>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </section>
      ) : null}

      {step === 0 ? (
        <section className="space-y-4 rounded-xl border possum-divider bg-black/50 p-5">
          <h2 className="text-lg font-black uppercase">How are you starting?</h2>
          <div className="grid gap-3 md:grid-cols-2">
            {([
              ["fresh", "Build a new server", "Possum creates your categories, channels and roles from scratch, exactly as you name them."],
              ["existing", "Switch my server to Possum", "Possum reads your existing channels, categories and roles (from MEE6, Dyno, Carl or anything else), connects what fits, and shows what is still needed."],
            ] as const).map(([value, title, text]) => (
              <button key={value} type="button" onClick={() => { setMode(value); setDirty(true); }}
                aria-pressed={mode === value}
                className={`rounded-xl border p-4 text-left ${mode === value ? "border-pink-400 bg-pink-500/10" : "border-white/10 hover:border-pink-700/60"}`}>
                <span className="block text-base font-black">{title}</span>
                <span className="mt-1 block text-sm text-pink-100/70">{text}</span>
              </button>
            ))}
          </div>
          <div className="grid gap-2 text-sm sm:grid-cols-3">
            <div className="rounded-lg border border-white/10 p-3"><strong className="block text-2xl">{(directory.categories || []).length}</strong>categories found</div>
            <div className="rounded-lg border border-white/10 p-3"><strong className="block text-2xl">{(directory.channels || []).length}</strong>channels found</div>
            <div className="rounded-lg border border-white/10 p-3"><strong className="block text-2xl">{roles.length}</strong>roles found</div>
          </div>
          {mode === "existing" && (totals.connected || totals.found) ? (
            <p className="text-sm text-pink-100/75">Already connected: {totals.connected || 0}. Possum found {totals.found || 0} more it can connect for the systems you track.</p>
          ) : null}
          {(baseReport?.setupProfiles || []).filter((profile) => profile.featureIds.length).length ? (
            <div>
              <h3 className="text-sm font-black uppercase">Quick start</h3>
              <div className="mt-2 flex flex-wrap gap-2">
                {(baseReport?.setupProfiles || []).filter((profile) => profile.featureIds.length).map((profile) => (
                  <button key={profile.id} type="button" onClick={() => applyProfile(profile.featureIds)} title={profile.description}
                    className="min-h-10 rounded-lg border border-white/15 px-3 text-xs font-bold hover:border-pink-500">{profile.name}</button>
                ))}
              </div>
              <p className="mt-1 text-xs text-pink-100/60">A quick start only pre-selects systems. You can change everything in the next step.</p>
            </div>
          ) : null}
          <div className="flex justify-end">
            <button type="button" disabled={!mode} onClick={() => void goTo(1)} className="possum-btn min-h-11 rounded-lg px-5 text-sm font-black uppercase disabled:opacity-50">Next: choose systems</button>
          </div>
        </section>
      ) : null}

      {step === 1 ? (
        <section className="space-y-4 rounded-xl border possum-divider bg-black/50 p-5">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-lg font-black uppercase">What should this server run?</h2>
              <p className="text-sm text-pink-100/70">Turn on the systems you want. Only systems that need channels, categories or roles are listed here.</p>
            </div>
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search systems" aria-label="Search systems"
              className="min-h-10 w-full rounded-md border border-pink-900/50 bg-black px-3 text-sm sm:w-64" />
          </div>
          {Object.keys(GROUP_LABELS).map((group) => {
            const rows = features.filter((feature) => feature.group === group &&
              (!search || feature.name.toLowerCase().includes(search.toLowerCase())));
            if (!rows.length) return null;
            const allOn = rows.every((feature) => selected.includes(feature.id));
            return (
              <fieldset key={group} className="rounded-lg border border-white/10 p-3">
                <div className="flex items-center justify-between gap-2">
                  <legend className="text-sm font-black uppercase text-pink-100">{GROUP_LABELS[group]}</legend>
                  <button type="button" onClick={() => setFeatures(rows.map((feature) => feature.id), !allOn)}
                    className="text-xs font-bold text-pink-200 underline">{allOn ? "Turn all off" : "Turn all on"}</button>
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {rows.map((feature) => {
                    const on = selected.includes(feature.id);
                    const needs = (feature.dependencies || []).filter((dependency) => featureById.has(dependency));
                    return (
                      <button key={feature.id} type="button" role="switch" aria-checked={on} onClick={() => toggleFeature(feature.id, !on)}
                        title={needs.length ? `Runs together with ${needs.map((dependency) => featureById.get(dependency)?.name || dependency).join(" and ")}` : undefined}
                        className={`min-h-10 rounded-full border px-3 text-sm font-bold ${on ? "border-pink-400 bg-pink-500/20 text-white" : "border-white/10 text-pink-100/70 hover:border-pink-700"}`}>
                        {on ? "✓ " : ""}{feature.name}{needs.length ? <span className="ml-1 text-[11px] font-semibold text-pink-200/70">+ {needs.map((dependency) => featureById.get(dependency)?.name || dependency).join(", ")}</span> : null}
                      </button>
                    );
                  })}
                </div>
                {rows.some((feature) => (feature.dependencies || []).some((dependency) => featureById.has(dependency))) ? (
                  <p className="mt-2 text-xs text-pink-100/60">Systems marked with + only work together. Turning one on turns on the others; turning one off turns off the ones that need it.</p>
                ) : null}
              </fieldset>
            );
          })}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-sm text-pink-100/70">{selected.length} system{selected.length === 1 ? "" : "s"} on</span>
            <div className="flex gap-2">
              <button type="button" onClick={() => void goTo(0)} className="min-h-11 rounded-lg border border-white/15 px-4 text-sm font-bold">Back</button>
              <button type="button" disabled={!selected.length} onClick={() => void goTo(2)} className="possum-btn min-h-11 rounded-lg px-5 text-sm font-black uppercase disabled:opacity-50">Next: member entry</button>
            </div>
          </div>
        </section>
      ) : null}

      {step === 2 ? (
        <section className="space-y-4 rounded-xl border possum-divider bg-black/50 p-5">
          <div>
            <h2 className="text-lg font-black uppercase">How do new members get in?</h2>
            <p className="text-sm text-pink-100/70">Pick a starting point, then switch any part on or off. Messages, questions and rules are written on each flow&apos;s own page. Nothing changes until you approve the plan.</p>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4" role="radiogroup" aria-label="Member entry starting point">
            {ENTRY_BASELINES.map((baseline) => (
              <button key={baseline.id} type="button" role="radio" aria-checked={entryBaseline === baseline.id} onClick={() => applyEntryBaseline(baseline.id)}
                className={`rounded-xl border p-3 text-left ${entryBaseline === baseline.id ? "border-pink-400 bg-pink-500/10" : "border-white/10 hover:border-pink-700/60"}`}>
                <span className="block text-sm font-black">{baseline.name}</span>
                <span className="mt-1 block text-xs text-pink-100/65">{baseline.description}</span>
              </button>
            ))}
          </div>
          <div className="grid gap-3 lg:grid-cols-3">
            {FLOWS.map((flow) => {
              const summary = baseReport?.entryFlows?.[flow.id];
              const choice = flowChoices[flow.id];
              const willBeOn = choice === "enable" || (choice === "keep" && summary?.enabled === true);
              return (
                <div key={flow.id} className="space-y-3 rounded-lg border border-white/10 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <strong className="block">{flow.label}</strong>
                    <StatusChip tone={summary?.enabled ? "ok" : "muted"}>{summary?.enabled ? "On now" : "Off now"}</StatusChip>
                  </div>
                  <p className="text-xs text-pink-100/65">{flow.help}</p>
                  <div role="radiogroup" aria-label={flow.label} className="flex flex-wrap gap-1">
                    {(["keep", "enable", "disable"] as FlowChoice[]).map((option) => (
                      <button key={option} type="button" role="radio" aria-checked={choice === option}
                        onClick={() => { setEntryBaseline(""); setFlowChoices((current) => ({ ...current, [flow.id]: option })); setDirty(true); }}
                        className={`min-h-9 rounded-md border px-2 text-xs font-bold ${choice === option ? "border-pink-400 bg-pink-500/20" : "border-white/10 text-pink-100/70"}`}>
                        {option === "keep" ? "Leave as is" : option === "enable" ? "Turn on" : "Turn off"}
                      </button>
                    ))}
                  </div>
                  {summary?.parts?.length ? (
                    <ul className={`space-y-1 ${willBeOn ? "" : "opacity-50"}`} aria-label={`${flow.label} parts`}>
                      {summary.parts.map((part) => {
                        const on = partValue(flow.id, part.id);
                        const changed = on !== part.enabled;
                        return (
                          <li key={part.id}>
                            <label className="flex min-h-9 cursor-pointer items-center justify-between gap-2 rounded-md px-1 text-sm hover:bg-white/5">
                              <span>{part.label}{changed && willBeOn ? <span className="ml-1 text-[11px] font-bold text-amber-200">changes</span> : null}</span>
                              <input type="checkbox" className="h-4 w-4 accent-pink-500" checked={on} disabled={!willBeOn}
                                onChange={(event) => setPart(flow.id, part.id, event.target.checked)} />
                            </label>
                          </li>
                        );
                      })}
                    </ul>
                  ) : null}
                  {!willBeOn ? <p className="text-xs text-pink-100/55">Turn this flow on to choose its parts.</p> : null}
                  <a href={flow.href} className="text-xs font-bold text-pink-200 underline">Write the {flow.label.toLowerCase()} messages</a>
                </div>
              );
            })}
          </div>
          {flowChoices.onboarding !== "disable" && partValue("onboarding", "idFlowEnabled") ? (
            <p className="text-xs text-pink-100/65">The ID check uses your ticket system. Calibrate the ID ticket on the Onboarding page before members start joining.</p>
          ) : null}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => void goTo(1)} className="min-h-11 rounded-lg border border-white/15 px-4 text-sm font-bold">Back</button>
            <button type="button" disabled={busy} onClick={() => void goTo(3)} className="possum-btn min-h-11 rounded-lg px-5 text-sm font-black uppercase disabled:opacity-50">{busy ? "Reading your server…" : "Next: layout"}</button>
          </div>
        </section>
      ) : null}

      {step === 3 && draftReport ? (
        <section className="space-y-4">
          <div className="rounded-xl border possum-divider bg-black/50 p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-black uppercase">Your layout</h2>
                <p className="text-sm text-pink-100/70">Every channel, category and role your systems use. Rename anything, choose an existing one, or let Possum create it. Anything already connected is never overwritten.</p>
              </div>
              <div className="flex flex-wrap gap-1">
                <StatusChip tone="ok">{totals.connected || 0} connected</StatusChip>
                <StatusChip tone="info">{connects.length} to connect</StatusChip>
                <StatusChip tone="info">{creates.length} to create</StatusChip>
                {totals.needsChoice ? <StatusChip tone="warn">{totals.needsChoice} need a choice</StatusChip> : null}
              </div>
            </div>
          </div>

          <div className="rounded-xl border possum-divider bg-black/50 p-5">
            <h3 className="text-base font-black uppercase">1 · Logs and audit trail</h3>
            <p className="text-sm text-pink-100/70">Set up first, so every setup step is recorded as it happens.</p>
            <div className="mt-3 grid gap-2 md:grid-cols-2">
              <label className={`rounded-lg border p-3 text-sm ${logMode === "main" ? "border-pink-400 bg-pink-500/10" : "border-white/10"}`}>
                <input type="radio" name="log-mode" className="mr-2 accent-pink-500" checked={logMode === "main"} onChange={() => { setLogMode("main"); setDirty(true); }} />
                <strong>One main log channel</strong>
                <span className="block text-xs text-pink-100/65">Every system logs to the same channel. Simple and tidy.</span>
              </label>
              <label className={`rounded-lg border p-3 text-sm ${logMode === "separate" ? "border-pink-400 bg-pink-500/10" : "border-white/10"}`}>
                <input type="radio" name="log-mode" className="mr-2 accent-pink-500" checked={logMode === "separate"} onChange={() => { setLogMode("separate"); setDirty(true); }} />
                <strong>A log channel per system</strong>
                <span className="block text-xs text-pink-100/65">Each system gets its own log channel in the Logging category.</span>
              </label>
            </div>
            {logMode === "main" ? (
              <div className="mt-3 grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(12rem,22rem)] sm:items-center">
                <span className="text-sm">Main log channel</span>
                <ResourcePicker label="Main log channel" value={logChannelId} onChange={(value) => { setLogChannelId(value); setDirty(true); }}
                  resources={textChannels} categories={categories} placeholder="Create a new moderator log channel" />
                {draftReport.loggingRoute?.issue ? <p className="text-xs text-amber-200 sm:col-span-2">{draftReport.loggingRoute.issue}</p> : null}
                {draftReport.loggingRoute?.routedIds?.length ? <p className="text-xs text-pink-100/65 sm:col-span-2">{draftReport.loggingRoute.routedIds.length} log feed{draftReport.loggingRoute.routedIds.length === 1 ? "" : "s"} will post here.</p> : null}
              </div>
            ) : null}
            {logProposals.length ? (
              <details className="mt-3 rounded-lg border border-white/10 p-3">
                <summary className="cursor-pointer text-sm font-bold">Log feeds ({logProposals.length})</summary>
                <ul className="mt-2 space-y-2">
                  {logProposals.map((proposal) => renderProposalRow(proposal))}
                </ul>
              </details>
            ) : null}
          </div>

          {(draftReport.categoryDestinations || []).length ? (
            <div className="rounded-xl border possum-divider bg-black/50 p-5">
              <h3 className="text-base font-black uppercase">2 · Shared categories</h3>
              <p className="text-sm text-pink-100/70">Systems without their own category share one category per area. Rename it, or put those channels in a category you already have.</p>
              <div className="mt-3 space-y-2">
                {(draftReport.categoryDestinations || []).map((destination) => (
                  <div key={destination.group} className="grid gap-2 rounded-lg border border-white/10 p-3 sm:grid-cols-[minmax(0,10rem)_minmax(0,1fr)_minmax(0,1fr)] sm:items-center">
                    <strong className="text-sm">{GROUP_LABELS[destination.group] || destination.group}</strong>
                    <select aria-label={`Where ${GROUP_LABELS[destination.group]} channels go`} value={categorySelections[destination.group] ?? (destination.status === "reuse" ? destination.categoryId || "" : destination.status === "create" ? "create" : "")}
                      onChange={(event) => { setCategorySelections((current) => ({ ...current, [destination.group]: event.target.value })); setDirty(true); }}
                      className="min-h-10 rounded-md border border-pink-900/50 bg-black px-2 text-sm">
                      <option value="" disabled>Choose…</option>
                      <option value="create">Create a new category</option>
                      {categories.map((category) => <option key={category.id} value={category.id}>Use {category.name}</option>)}
                    </select>
                    {(categorySelections[destination.group] ?? (destination.status === "create" ? "create" : "")) === "create" ? (
                      <input aria-label={`Name for the ${GROUP_LABELS[destination.group]} category`} maxLength={100}
                        value={categoryNames[destination.group] ?? destination.name}
                        onChange={(event) => { setCategoryNames((current) => ({ ...current, [destination.group]: event.target.value })); setDirty(true); }}
                        className="min-h-10 rounded-md border border-pink-900/50 bg-black px-3 text-sm" />
                    ) : <span className="text-xs text-pink-100/60">{destination.status === "review" ? "Several categories could fit. Pick one." : `Channels go in ${destination.categoryName || "the chosen category"}.`}</span>}
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          <div className="rounded-xl border possum-divider bg-black/50 p-5">
            <h3 className="text-base font-black uppercase">3 · Systems</h3>
            <p className="text-sm text-pink-100/70">Choose where each system lives and what it uses.</p>
            <div className="mt-3 space-y-3">
              {enginesInPlan.map((engine) => {
                const rows = proposals.filter((proposal) => proposal.engine === engine && !isLogProposal(proposal) && !isPanelProposal(proposal));
                if (!rows.length) return null;
                const label = rows[0].engineLabel || featureById.get(engine)?.name || engine;
                const placement = placements[engine];
                const destination = featureDestinations.get(engine);
                const hasNewChannels = rows.some((proposal) => proposal.resourceType === "channel" && proposal.status !== "populated" && !mapIds.has(proposal.id));
                return (
                  <details key={engine} open className="rounded-lg border border-white/10 p-3">
                    <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-2">
                      <strong>{label}</strong>
                      <span className="flex flex-wrap gap-1">
                        {rows.filter((proposal) => proposal.status === "populated").length ? <StatusChip tone="ok">{rows.filter((proposal) => proposal.status === "populated").length} connected</StatusChip> : null}
                        {rows.filter((proposal) => createIds.has(proposal.id)).length ? <StatusChip tone="info">{rows.filter((proposal) => createIds.has(proposal.id)).length} new</StatusChip> : null}
                        {rows.filter((proposal) => ["ambiguous", "duplicate"].includes(proposal.status) && !mappings[proposal.id]).length ? <StatusChip tone="warn">choose</StatusChip> : null}
                      </span>
                    </summary>
                    {hasNewChannels && !explicitCategoryEngines.has(engine) ? (
                      <div className="mt-3 grid gap-2 rounded-md bg-white/5 p-3 text-sm sm:grid-cols-[minmax(0,12rem)_minmax(0,1fr)] sm:items-start">
                        <span className="font-bold">Place new channels in</span>
                        <div className="space-y-2">
                          <select aria-label={`Placement for ${label}`} value={placement?.mode || "group"}
                            onChange={(event) => {
                              const value = event.target.value;
                              if (value === "group") setPlacement(engine, null);
                              else if (value === "own") setPlacement(engine, { mode: "own", name: label, accessRole: false });
                              else if (value === "existing") setPlacement(engine, { mode: "existing", categoryId: categories[0]?.id || "" });
                              else setPlacement(engine, { mode: "none" });
                            }}
                            className="min-h-10 w-full rounded-md border border-pink-900/50 bg-black px-2 text-sm">
                            <option value="group">The shared {GROUP_LABELS[featureById.get(engine)?.group || ""] || "area"} category</option>
                            <option value="own">Its own new category</option>
                            {categories.length ? <option value="existing">A category I already have</option> : null}
                            <option value="none">No category (top of the channel list)</option>
                          </select>
                          {placement?.mode === "own" ? (
                            <div className="grid gap-2 sm:grid-cols-2">
                              <input aria-label={`Category name for ${label}`} maxLength={100} value={placement.name}
                                onChange={(event) => setPlacement(engine, { ...placement, name: event.target.value })}
                                className="min-h-10 rounded-md border border-pink-900/50 bg-black px-3 text-sm" />
                              <label className="flex items-center gap-2 text-xs">
                                <input type="checkbox" className="accent-pink-500" checked={placement.accessRole}
                                  onChange={(event) => setPlacement(engine, { ...placement, accessRole: event.target.checked, accessRoleName: placement.accessRoleName || `${label} Access` })} />
                                Only members with an access role can see it
                              </label>
                              {placement.accessRole ? (
                                <input aria-label={`Access role name for ${label}`} maxLength={100} value={placement.accessRoleName || ""}
                                  onChange={(event) => setPlacement(engine, { ...placement, accessRoleName: event.target.value })}
                                  className="min-h-10 rounded-md border border-pink-900/50 bg-black px-3 text-sm sm:col-span-2" placeholder="Access role name" />
                              ) : null}
                            </div>
                          ) : null}
                          {placement?.mode === "existing" ? (
                            <ResourcePicker label={`Existing category for ${label}`} value={placement.categoryId}
                              onChange={(value) => setPlacement(engine, { mode: "existing", categoryId: value })}
                              resources={categories} categories={[]} placeholder="Choose a category" />
                          ) : null}
                          {destination?.status === "review" ? (
                            <p className="text-xs text-amber-200">{destination.reason}{destination.candidateId ? (
                              <button type="button" className="ml-2 underline" onClick={() => setPlacement(engine, { mode: "existing", categoryId: destination.candidateId || "" })}>Use that category</button>
                            ) : null}</p>
                          ) : null}
                        </div>
                      </div>
                    ) : null}
                    {explicitCategoryEngines.has(engine) ? <p className="mt-2 text-xs text-pink-100/65">This system has its own category below{engine === "rareSpawn" ? ", private to its access role" : ""}.</p> : null}
                    <ul className="mt-3 space-y-2">
                      {rows.map((proposal) => renderProposalRow(proposal))}
                    </ul>
                  </details>
                );
              })}
            </div>
          </div>

          {panelProposals.length ? (
            <div className="rounded-xl border possum-divider bg-black/50 p-5">
              <h3 className="text-base font-black uppercase">4 · Panel channels</h3>
              <p className="text-sm text-pink-100/70">Each panel gets its own channel, in a Panels category by default. Setup only makes the channel. You calibrate and publish each panel from its page afterwards.</p>
              <ul className="mt-3 space-y-2">
                {panelProposals.map((proposal) => renderProposalRow(proposal))}
              </ul>
            </div>
          ) : null}

          {(draftReport.rewardRoleOptions || []).some((option) => selected.includes(option.engine)) ? (
            <details className="rounded-xl border possum-divider bg-black/50 p-5">
              <summary className="cursor-pointer text-base font-black uppercase">Optional reward roles ({rewardSelections.length} chosen)</summary>
              <p className="mt-1 text-sm text-pink-100/70">Only create roles for the rewards you actually give out. None are created unless you pick them.</p>
              <div className="mt-2 flex gap-3 text-xs">
                <button type="button" className="underline" onClick={() => { setRewardSelections([]); setDirty(true); }}>Clear all</button>
              </div>
              <div className="mt-2 grid max-h-80 gap-1 overflow-y-auto md:grid-cols-2">
                {(draftReport.rewardRoleOptions || []).filter((option) => selected.includes(option.engine)).map((option) => (
                  <label key={option.id} className="flex items-center gap-2 rounded-md px-2 py-1 text-sm hover:bg-white/5">
                    <input type="checkbox" className="accent-pink-500" checked={rewardSelections.includes(option.id)}
                      onChange={(event) => { setRewardSelections((current) => event.target.checked ? sorted([...current, option.id]) : current.filter((entry) => entry !== option.id)); setDirty(true); }} />
                    {option.label}
                  </label>
                ))}
              </div>
            </details>
          ) : null}

          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border possum-divider bg-black/50 p-4">
            <span className="text-sm text-pink-100/75">{dirty ? "You changed something. Update the plan to see the result." : "The plan matches your choices."}</span>
            <div className="flex gap-2">
              <button type="button" onClick={() => void goTo(2)} className="min-h-11 rounded-lg border border-white/15 px-4 text-sm font-bold">Back</button>
              <button type="button" disabled={busy} onClick={() => void buildPreview()} className="min-h-11 rounded-lg border border-pink-500/60 px-4 text-sm font-bold disabled:opacity-50">{busy ? "Updating…" : "Update plan"}</button>
              <button type="button" disabled={busy || dirty} onClick={() => void goTo(4)} className="possum-btn min-h-11 rounded-lg px-5 text-sm font-black uppercase disabled:opacity-50">Next: review</button>
            </div>
          </div>
        </section>
      ) : null}

      {step === 4 && plan ? (
        <section className="space-y-4 rounded-xl border possum-divider bg-black/50 p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-black uppercase">Review and build</h2>
              <p className="text-sm text-pink-100/70">This is exactly what Possum will do, in this order. Each step is checked after it runs. If anything stops, you can continue later and nothing is made twice.</p>
            </div>
            <div className="flex flex-wrap gap-1">
              <StatusChip tone="info">{creates.filter((action) => action.resourceType === "category").length} categories</StatusChip>
              <StatusChip tone="info">{creates.filter((action) => action.resourceType === "channel").length} channels</StatusChip>
              <StatusChip tone="info">{creates.filter((action) => action.resourceType === "role").length} roles</StatusChip>
              <StatusChip tone="ok">{connects.length} connected</StatusChip>
            </div>
          </div>
          <ol className="max-h-[28rem] space-y-1 overflow-y-auto rounded-lg border border-white/10 p-3 text-sm">
            {planActions.filter((action) => action.type !== "configure_autopilot" && !(action.type === "apply_setup_settings" && !(action.changes || []).length)).map((action) => (
              renderPlanRow(action)
            ))}
          </ol>
          {flowActions.length ? <p className="text-sm">Member entry: {flowActions.map((action) => `${action.flow} → ${action.choice === "enable" ? "on" : "off"}`).join(", ")}.</p> : null}
          {routeAction ? <p className="text-sm">{routeAction.name}.</p> : null}
          {reviewNeeded.length || skipped.length ? (
            <div className="rounded-lg border border-amber-700/50 bg-amber-950/20 p-3 text-sm text-amber-50">
              <strong>Left for you to decide ({reviewNeeded.length + skipped.length})</strong>
              <ul className="mt-1 list-disc space-y-1 pl-5 text-xs">
                {reviewNeeded.map((line) => <li key={line}>{line}</li>)}
                {skipped.map((row) => <li key={row.id}>{proposals.find((proposal) => proposal.id === row.id)?.engineLabel || row.id}: {row.reason}</li>)}
              </ul>
              <p className="mt-1 text-xs text-amber-100/75">These are skipped. Go back to Layout to resolve them, or build now and finish them later.</p>
            </div>
          ) : null}
          {blocked.length ? <p className="rounded-lg border border-red-700/50 bg-red-950/30 p-3 text-sm">The bot is missing Discord permissions for {blocked.length} step{blocked.length === 1 ? "" : "s"}: {[...new Set(blocked.flatMap((action) => action.missingPermissions || []))].join(", ") || "see details"}. Give the bot those permissions (and move its role above the roles it manages), then update the plan.</p> : null}
          <p className="text-xs text-pink-100/60">Only the server owner can approve. Panels are never posted by setup. Existing channels, roles and settings are never deleted or overwritten.</p>
          <div className="flex flex-wrap justify-end gap-2">
            <button type="button" disabled={busy} onClick={() => void goTo(3)} className="min-h-11 rounded-lg border border-white/15 px-4 text-sm font-bold">Back to layout</button>
            <button type="button" disabled={busy || dirty || blocked.length > 0 || planActions.length === 0}
              onClick={() => setConfirmOpen(true)} className="possum-btn min-h-11 rounded-lg px-5 text-sm font-black uppercase disabled:opacity-50">Build my server</button>
          </div>
        </section>
      ) : null}

      {confirmOpen && plan ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-3" role="presentation"
          onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) setConfirmOpen(false); }}>
          <section role="dialog" aria-modal="true" aria-labelledby="guided-confirm" className="w-full max-w-lg rounded-xl border possum-divider bg-black p-5">
            <h2 id="guided-confirm" className="text-xl font-black uppercase">Build it?</h2>
            <p className="mt-2 text-sm text-pink-100/80">Possum will create {creates.length} resource{creates.length === 1 ? "" : "s"} and connect {connects.length} existing one{connects.length === 1 ? "" : "s"} in this server, logging each step as it goes.</p>
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" disabled={busy} onClick={() => setConfirmOpen(false)} className="min-h-11 rounded-lg border border-white/15 px-4 text-sm font-bold">Not yet</button>
              <button type="button" disabled={busy} onClick={() => void approveAndBuild()} className="possum-btn min-h-11 rounded-lg px-5 text-sm font-black uppercase">Yes, build it</button>
            </div>
          </section>
        </div>
      ) : null}
    </main>
  );

  function renderProposalRow(proposal: Proposal) {
    const state = proposalState(proposal);
    const kind = proposal.resourceType || "channel";
    const pool = kind === "role" ? roles : kind === "category" ? categories : textChannels;
    const locked = proposal.status === "populated";
    const isRole = kind === "role";
    const optionalRole = isRole && proposal.id !== "rareSpawn:accessRoleId";
    const roleOn = !isRole || roleSelections.includes(proposal.id) || Boolean(mappings[proposal.id]);
    const isRouted = routed.has(proposal.id);
    const label = proposal.engine === "rareSpawn" && proposal.field === "categoryId"
      ? "Private Rare Spawn category"
      : proposal.engine === "rareSpawn" && proposal.field === "accessRoleId"
        ? "Rare Spawn access role (required to see the category)"
        : humanize(proposal.field);
    return (
      <li key={proposal.id} className="grid gap-2 rounded-md border border-white/5 bg-black/30 p-2 sm:grid-cols-[minmax(0,14rem)_minmax(0,1fr)_minmax(0,1fr)] sm:items-center">
        <span className="min-w-0">
          <span className="block text-sm font-bold">{label}</span>
          <span className="mt-0.5 flex flex-wrap items-center gap-1 text-[11px] text-pink-100/55">
            <span className="uppercase">{kind}</span>
            <StatusChip tone={state.tone}>{state.label}</StatusChip>
          </span>
        </span>
        {locked ? (
          <span className="text-xs text-pink-100/60 sm:col-span-2">Already set. Change it on the system&apos;s own page if you need to.</span>
        ) : isRouted ? (
          <span className="text-xs text-pink-100/60 sm:col-span-2">Posts to the main log channel.</span>
        ) : (
          <>
            {optionalRole && !mappings[proposal.id] ? (
              <label className="flex items-center gap-2 text-xs">
                <input type="checkbox" className="accent-pink-500" checked={roleSelections.includes(proposal.id)}
                  onChange={(event) => { setRoleSelections((current) => event.target.checked ? sorted([...current, proposal.id]) : current.filter((entry) => entry !== proposal.id)); setDirty(true); }} />
                Create this role
              </label>
            ) : (
              <input aria-label={`Name for ${label}`} maxLength={100} disabled={Boolean(mappings[proposal.id]) || (!roleOn && isRole)}
                value={names[proposal.id] ?? proposal.intendedName ?? ""}
                onChange={(event) => { setNames((current) => ({ ...current, [proposal.id]: event.target.value })); setDirty(true); }}
                className="min-h-10 rounded-md border border-pink-900/50 bg-black px-3 text-sm disabled:opacity-40" />
            )}
            <ResourcePicker label={`Use an existing ${kind} for ${label}`}
              value={mappings[proposal.id] || ""}
              onChange={(value) => setMapping(proposal.id, value)}
              resources={pool} categories={categories}
              placeholder={proposal.status === "ready" && proposal.suggestedName
                ? `Connect found match: ${kind === "role" ? "@" : kind === "category" ? "" : "#"}${proposal.suggestedName}`
                : ["ambiguous", "duplicate"].includes(proposal.status) ? "Choose which one to use" : `Create new ${kind}`} />
            {optionalRole && roleSelections.includes(proposal.id) && !mappings[proposal.id] ? (
              <input aria-label={`Role name for ${label}`} maxLength={100} value={names[proposal.id] ?? proposal.intendedName ?? ""}
                onChange={(event) => { setNames((current) => ({ ...current, [proposal.id]: event.target.value })); setDirty(true); }}
                className="min-h-10 rounded-md border border-pink-900/50 bg-black px-3 text-sm sm:col-start-2" />
            ) : null}
            {["ambiguous", "duplicate"].includes(proposal.status) && proposal.matches?.length && !mappings[proposal.id] ? (
              <span className="text-[11px] text-amber-200 sm:col-span-3">Possible matches: {proposal.matches.slice(0, 5).map((match) => match.name).join(", ")}</span>
            ) : null}
          </>
        )}
      </li>
    );
  }

  function renderPlanRow(action: SetupPlanAction) {
    const verb = action.type === "create_resource" ? `Create ${action.resourceType}`
      : action.type === "map_existing_resource" ? "Connect"
        : action.type === "route_logging" ? "Route logs"
          : action.type === "configure_protected_flow" ? "Member entry"
            : action.type === "apply_setup_settings" ? "Save setup choices" : action.type.replace(/_/g, " ");
    const status = action.status === "completed" ? "✓" : action.status === "failed" ? "!" : action.status === "running" ? "…" : "";
    const where = action.type === "create_resource" && action.resourceType === "channel"
      ? action.groupCategoryName ? ` in ${action.groupCategoryName}` : action.featurePlacement === "top-level" ? " (no category)" : ""
      : "";
    return (
      <li key={action.id} className={`flex items-start gap-2 ${action.status === "failed" ? "text-amber-200" : ""}`}>
        <span className="w-4 shrink-0 text-center font-black">{status}</span>
        <span><strong>{verb}</strong> · {action.name || action.resourceName || `${action.engine}.${action.field}` || action.flow}{where}
          {action.result?.error ? <span className="block text-xs">{action.result.error}</span> : null}</span>
      </li>
    );
  }
}
