import { ENGINE_REGISTRY } from "@/lib/dashboard/engineRegistry";

export type FeatureCatalogEntry = {
  id: string;
  label: string;
  route: string;
  summary: string;
};

export type PremiumFeature = FeatureCatalogEntry & {
  premiumLabel: string;
  includedIn: string[];
  pricingNote: string;
  creatorOnly?: boolean;
};

export type SubscriptionPlan = {
  id: string;
  label: string;
  monthlyUsd: number | null;
  yearlyUsd: number | null;
  lifetimeUsd: number | null;
  headline: string;
  included: string[];
  note: string;
};

export const PRICING_FOOTNOTE =
  "Prices are subject to change based on availability, operating cost, and service load. Paid plans are enforced per guild. Master-owner global trials are for internal admin testing only.";

export const PREMIUM_FEATURES: PremiumFeature[] = [
  {
    id: "tts",
    label: "TTS Engine",
    route: "/dashboard/tts",
    summary: "Voice playback channels, speech routing, queue rules, and live text-to-speech controls.",
    premiumLabel: "Plan Details To Be Finalized",
    includedIn: ["Monthly / Yearly / Lifetime plan assignment pending"],
    pricingNote: "Included through paid guild plans."
  },
  {
    id: "persona-ai",
    label: "Persona AI",
    route: "/dashboard/ai/persona",
    summary: "Hosted generative persona replies, prompt shaping, access rules, and persona photos on a path that stays separate from Possum AI and Bot Personalizer.",
    premiumLabel: "Plan Details To Be Finalized",
    includedIn: ["Monthly / Yearly / Lifetime plan assignment pending"],
    pricingNote: "Separate from Possum AI and Bot Personalizer."
  },
  {
    id: "heist",
    label: "Heist Engine",
    route: "/dashboard/heist",
    summary: "Heist signup rotations, channel routing, logging, and event-session controls.",
    premiumLabel: "Plan Details To Be Finalized",
    includedIn: ["Monthly / Yearly / Lifetime plan assignment pending"],
    pricingNote: "Guild signup engine only."
  },
  {
    id: "second-token-bot",
    label: "Second Token Bot",
    route: "/dashboard/bot-personalizer",
    summary: "A second dedicated Discord bot with its own token, name, avatar and routing, so heavy features can run on a separate bot.",
    premiumLabel: "Premium Feature",
    includedIn: ["Yearly", "Lifetime"],
    pricingNote: "Yearly subscribers. Lifetime subscribers have this bot too. Separate from the free Custom Token Bot."
  },
  {
    id: "third-token-bot",
    label: "Third Token Bot",
    route: "/dashboard/bot-personalizer#third-token-bot",
    summary: "A third dedicated Discord bot with its own token, name, avatar and routing.",
    premiumLabel: "Lifetime Feature",
    includedIn: ["Lifetime"],
    pricingNote: "Lifetime subscribers only."
  },
  {
    id: "advanced-security",
    label: "Advanced Security + Governance Suite",
    route: "/dashboard/premium-features#advanced-security",
    summary: "Threat intel, link intelligence, behavioral drift, trust weighting, risk escalation, and auto-containment tuning layered on top of the free safety baseline.",
    premiumLabel: "Plan Details To Be Finalized",
    includedIn: ["Monthly / Yearly / Lifetime plan assignment pending"],
    pricingNote: "Basic safety stays free. Premium unlocks intelligence, automation, and advanced operator control."
  },
  {
    id: "automation-suite",
    label: "Automation + Custom Commands Suite",
    route: "/dashboard/premium-features#automation-suite",
    summary: "Advanced automation rules, higher execution limits, and elevated custom-command capacity without paywalling the basic operating baseline.",
    premiumLabel: "Plan Details To Be Finalized",
    includedIn: ["Monthly / Yearly / Lifetime plan assignment pending"],
    pricingNote: "Free tier keeps a smaller cap. Premium expands rule depth and scale."
  },
  {
    id: "alert-inbox",
    label: "Pro Alert Inbox",
    route: "/dashboard/alert-inbox",
    summary: "One list for health findings, process health, and Event Reactor failures.",
    premiumLabel: "Plan Details To Be Finalized",
    includedIn: ["Monthly / Yearly / Lifetime plan assignment pending"],
    pricingNote: "Included with Pro."
  },
  {
    id: "config-history",
    label: "Configuration History",
    route: "/dashboard/config-history",
    summary: "A change record for engine config writes, with section restore.",
    premiumLabel: "Plan Details To Be Finalized",
    includedIn: ["Monthly / Yearly / Lifetime plan assignment pending"],
    pricingNote: "Included with Pro."
  },
  {
    id: "scheduled-reports",
    label: "Scheduled Reports",
    route: "/dashboard/scheduled-reports",
    summary: "Daily, weekly, and monthly server reports. Missing data stays missing.",
    premiumLabel: "Plan Details To Be Finalized",
    includedIn: ["Monthly / Yearly / Lifetime plan assignment pending"],
    pricingNote: "Included with Pro."
  },
  {
    id: "analytics",
    label: "Analytics",
    route: "/dashboard/analytics",
    summary: "Growth, activity, retention and moderation-action reports for your server.",
    premiumLabel: "Plan Details To Be Finalized",
    includedIn: ["Monthly / Yearly / Lifetime plan assignment pending"],
    pricingNote: "Included with Pro."
  },
  {
    id: "config-backup",
    label: "Config Backup + Restore",
    route: "/dashboard/system-health/backups",
    summary: "Export your full server configuration and restore it any time.",
    premiumLabel: "Plan Details To Be Finalized",
    includedIn: ["Monthly / Yearly / Lifetime plan assignment pending"],
    pricingNote: "Protects your setup work."
  },
  {
    id: "tcg",
    label: "Possum Underworld TCG",
    route: "/tcg",
    summary: "Private collectible card game with city cards and creature cards sourced from the former Wilds catalog.",
    premiumLabel: "Plan Details To Be Finalized",
    includedIn: ["Monthly / Yearly / Lifetime plan assignment pending"],
    pricingNote: "Included through paid guild plans."
  },
  {
    id: "openai-platform",
    label: "Creator AI Platform",
    route: "/dashboard/ai/openai-platform",
    summary: "Internal provider routing, model control, and quota tuning for bot creators only.",
    premiumLabel: "Creator Only",
    includedIn: ["Internal"],
    pricingNote: "Not shown in the public customer-facing premium catalog.",
    creatorOnly: true,
  }
];

export type PlanTierKey = "monthly" | "yearly" | "lifetime";

export type PlanTier = {
  key: PlanTierKey;
  label: string;
  priceUsd: number | null;
  cadence: string;
  tagline: string;
  badge?: string;
  extras: string[];
};

// Every paid tier includes these. Tier extras below are what makes the longer plans worth it.
export const PLAN_COMMON_FEATURES: string[] = [];

export const PLAN_TIERS: PlanTier[] = [
  {
    key: "monthly",
    label: "Monthly",
    priceUsd: null,
    cadence: "/ month",
    tagline: "Plan features and pricing will be announced.",
    extras: [],
  },
  {
    key: "yearly",
    label: "Yearly",
    priceUsd: null,
    cadence: "/ year",
    tagline: "Plan features and pricing will be announced.",
    extras: [],
  },
  {
    key: "lifetime",
    label: "Lifetime",
    priceUsd: null,
    cadence: "one time",
    tagline: "Plan features and pricing will be announced.",
    extras: [],
  },
];

export const PREMIUM_PLANS: SubscriptionPlan[] = [
  {
    id: "pro",
    label: "Possum Plans",
    monthlyUsd: null,
    yearlyUsd: null,
    lifetimeUsd: null,
    headline: "Monthly, yearly, and lifetime plan options. Pricing and included features are being finalized.",
    included: PLAN_COMMON_FEATURES,
    note: PRICING_FOOTNOTE,
  },
];

const PREMIUM_ROUTE_SET = new Set(PREMIUM_FEATURES.map((feature) => feature.route));
const PRIVATE_ROUTE_SET = new Set([
  "/dashboard/pokemon-catching",
  "/dashboard/pokemon-battle",
  "/dashboard/pokemon-trade",
]);
const EXCLUDED_PUBLIC_ROUTE_SET = new Set([
  "/dashboard/premium-features",
  "/dashboard/ai",
  "/dashboard/system-health",
]);

export const STANDARD_FEATURES: FeatureCatalogEntry[] = [
  ...ENGINE_REGISTRY
    .filter((engine) => !PREMIUM_ROUTE_SET.has(engine.route))
    .filter((engine) => !PRIVATE_ROUTE_SET.has(engine.route))
    .filter((engine) => !EXCLUDED_PUBLIC_ROUTE_SET.has(engine.route))
    .map((engine) => ({
      id: engine.id,
      label: engine.label,
      route: engine.route,
      summary: engine.description,
    })),
];
