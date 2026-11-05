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
    premiumLabel: "Premium Feature",
    includedIn: ["Pro", "Business", "Enterprise"],
    pricingNote: "Included through paid guild plans."
  },
  {
    id: "persona-ai",
    label: "Persona AI",
    route: "/dashboard/ai/persona",
    summary: "Hosted generative persona replies, prompt shaping, access rules, and persona photos on a path that stays separate from Possum AI and Bot Personalizer.",
    premiumLabel: "Premium Feature",
    includedIn: ["Pro", "Business", "Enterprise"],
    pricingNote: "Separate from Possum AI and Bot Personalizer."
  },
  {
    id: "heist",
    label: "Heist Engine",
    route: "/dashboard/heist",
    summary: "Heist signup rotations, channel routing, logging, and event-session controls.",
    premiumLabel: "Premium Feature",
    includedIn: ["Pro", "Business", "Enterprise"],
    pricingNote: "Guild signup engine only."
  },
  {
    id: "second-token-bot",
    label: "Second Token Bot",
    route: "/dashboard/bot-personalizer",
    summary: "A second dedicated Discord bot with its own token, name, avatar and routing, so heavy features can run on a separate bot.",
    premiumLabel: "Premium Feature",
    includedIn: ["Pro", "Business", "Enterprise"],
    pricingNote: "Separate from the Custom Token Bot and the shared webhook identity."
  },
  {
    id: "advanced-security",
    label: "Advanced Security + Governance Suite",
    route: "/dashboard/premium-features#advanced-security",
    summary: "Threat intel, link intelligence, behavioral drift, trust weighting, risk escalation, and auto-containment tuning layered on top of the free safety baseline.",
    premiumLabel: "Premium Suite",
    includedIn: ["Business", "Enterprise"],
    pricingNote: "Basic safety stays free. Premium unlocks intelligence, automation, and advanced operator control."
  },
  {
    id: "automation-suite",
    label: "Automation + Custom Commands Suite",
    route: "/dashboard/premium-features#automation-suite",
    summary: "Advanced automation rules, higher execution limits, and elevated custom-command capacity without paywalling the basic operating baseline.",
    premiumLabel: "Premium Suite",
    includedIn: ["Business", "Enterprise"],
    pricingNote: "Free tier keeps a smaller cap. Premium expands rule depth and scale."
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

export const PREMIUM_PLANS: SubscriptionPlan[] = [
  {
    id: "pro",
    label: "Pro",
    monthlyUsd: 4.99,
    yearlyUsd: 40.0,
    lifetimeUsd: 75.0,
    headline: "Premium engagement and threat protection for growing communities.",
    included: [
      "TTS Engine",
      "Persona AI",
      "Heist Engine",
      "Second Token Bot",
      "Included monthly AI usage credit",
    ],
    note: PRICING_FOOTNOTE,
  },
  {
    id: "business",
    label: "Business",
    monthlyUsd: 9.99,
    yearlyUsd: 80.0,
    lifetimeUsd: 150.0,
    headline: "Adds governance automation and higher included usage for active servers.",
    included: [
      "Everything in Pro",
      "Advanced Security + Governance Suite",
      "Automation + Custom Commands Suite",
      "Higher included monthly AI usage credit",
      "Expanded concurrency limits",
    ],
    note: PRICING_FOOTNOTE,
  },
  {
    id: "enterprise",
    label: "Enterprise",
    monthlyUsd: 19.99,
    yearlyUsd: 160.0,
    lifetimeUsd: 300.0,
    headline: "Priority control for serious communities with custom support and pooled usage.",
    included: [
      "Everything in Business",
      "Priority support",
      "Higher pooled monthly AI usage credit",
      "Custom operational limits",
    ],
    note: `${PRICING_FOOTNOTE} Contact for custom limits and annual contracts.`,
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
