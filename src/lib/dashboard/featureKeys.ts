export const CANONICAL_FEATURE_KEYS = [
  "onboardingEnabled",
  "verificationEnabled",
  "heistEnabled",
  "rareDropEnabled",
  "catDropEnabled",
  "musicEnabled",
  "pokemonEnabled",
  "aiEnabled",
  "ttsEnabled",
  "birthdayEnabled",
  "economyEnabled",
  "governanceEnabled",
] as const;

export type CanonicalFeatureKey = (typeof CANONICAL_FEATURE_KEYS)[number];
export type FeaturePatch = Partial<Record<CanonicalFeatureKey, boolean>>;

type LegacyFlags = {
  lockdownEnabled?: boolean;
  raidEnabled?: boolean;
  ticketsEnabled?: boolean;
  giveawaysEnabled?: boolean;
  pokemonPrivateOnly?: boolean;
};

const CANONICAL_SET = new Set<string>(CANONICAL_FEATURE_KEYS as readonly string[]);

const FEATURE_ALIAS_TO_CANONICAL: Record<string, CanonicalFeatureKey | null> = {
  onboardingEnabled: "onboardingEnabled",
  verificationEnabled: "verificationEnabled",
  heistEnabled: "heistEnabled",
  rareDropEnabled: "rareDropEnabled",
  musicEnabled: "musicEnabled",
  pokemonEnabled: "pokemonEnabled",
  aiEnabled: "aiEnabled",
  ttsEnabled: "ttsEnabled",
  birthdayEnabled: "birthdayEnabled",
  economyEnabled: "economyEnabled",
  governanceEnabled: "governanceEnabled",

  securityEnabled: "governanceEnabled",

  lockdownEnabled: null,
  raidEnabled: null,
  ticketsEnabled: null,
  giveawaysEnabled: null,
  pokemonPrivateOnly: null,
  coreEnabled: null,
  crewEnabled: null,
  contractsEnabled: null,
  progressionEnabled: null,
};

function toRecord(input: unknown): Record<string, unknown> {
  if (!input || typeof input !== "object" || Array.isArray(input)) return {};
  return input as Record<string, unknown>;
}

export function asBoolean(value: unknown, fallback = false): boolean {
  return typeof value === "boolean" ? value : fallback;
}

export function resolveCanonicalFeatureKey(key: string): CanonicalFeatureKey | null {
  const trimmed = String(key || "").trim();
  if (!trimmed) return null;
  if (CANONICAL_SET.has(trimmed)) return trimmed as CanonicalFeatureKey;
  if (Object.prototype.hasOwnProperty.call(FEATURE_ALIAS_TO_CANONICAL, trimmed)) {
    return FEATURE_ALIAS_TO_CANONICAL[trimmed];
  }
  return null;
}

export function normalizeFeaturePatch(input: unknown): { patch: FeaturePatch; ignoredKeys: string[] } {
  const src = toRecord(input);
  const patch: FeaturePatch = {};
  const ignoredKeys: string[] = [];

  for (const [rawKey, rawValue] of Object.entries(src)) {
    const key = resolveCanonicalFeatureKey(rawKey);
    if (!key) {
      ignoredKeys.push(rawKey);
      continue;
    }
    if (typeof rawValue !== "boolean") {
      ignoredKeys.push(rawKey);
      continue;
    }
    patch[key] = rawValue;
  }

  return { patch, ignoredKeys };
}

export function withLegacyFeatureAliases(featuresInput: unknown, legacy: LegacyFlags = {}): Record<string, boolean> {
  const base = toRecord(featuresInput);
  const canonical = normalizeFeaturePatch(base).patch;

  const result: Record<string, boolean> = {
    onboardingEnabled: asBoolean(canonical.onboardingEnabled, false),
    verificationEnabled: asBoolean(canonical.verificationEnabled, false),
    heistEnabled: asBoolean(canonical.heistEnabled, false),
    rareDropEnabled: asBoolean(canonical.rareDropEnabled, false),
    catDropEnabled: asBoolean(canonical.catDropEnabled, false),
    musicEnabled: asBoolean(canonical.musicEnabled, false),
    pokemonEnabled: asBoolean(canonical.pokemonEnabled, false),
    aiEnabled: asBoolean(canonical.aiEnabled, false),
    ttsEnabled: asBoolean(canonical.ttsEnabled, false),
    birthdayEnabled: asBoolean(canonical.birthdayEnabled, false),
    economyEnabled: asBoolean(canonical.economyEnabled, false),
    governanceEnabled: asBoolean(canonical.governanceEnabled, false),
  };

  result.securityEnabled = result.governanceEnabled;
  result.lockdownEnabled = asBoolean(legacy.lockdownEnabled, false);
  result.raidEnabled = asBoolean(legacy.raidEnabled, false);
  result.ticketsEnabled = asBoolean(legacy.ticketsEnabled, false);
  result.giveawaysEnabled = asBoolean(legacy.giveawaysEnabled, false);
  result.pokemonPrivateOnly = asBoolean(legacy.pokemonPrivateOnly, true);

  return result;
}
