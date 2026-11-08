import fs from "node:fs";
import path from "node:path";
import { PREMIUM_FEATURES } from "@/lib/premiumCatalog";

export type PublicFeatureVisibility = Record<string, boolean>;

const STORE_PATH = path.join(process.cwd(), "data", "ui", "public-feature-visibility.json");
const MANAGEABLE_FEATURES = PREMIUM_FEATURES.filter((feature) => !feature.creatorOnly);

export const DEFAULT_PUBLIC_FEATURE_VISIBILITY = Object.fromEntries(
  MANAGEABLE_FEATURES.map((feature) => [feature.id, true])
) as PublicFeatureVisibility;

function normalize(input: unknown): PublicFeatureVisibility {
  const source = input && typeof input === "object" && !Array.isArray(input)
    ? input as Record<string, unknown>
    : {};
  return Object.fromEntries(
    MANAGEABLE_FEATURES.map((feature) => [
      feature.id,
      typeof source[feature.id] === "boolean"
        ? source[feature.id] as boolean
        : DEFAULT_PUBLIC_FEATURE_VISIBILITY[feature.id],
    ])
  );
}

export function readPublicFeatureVisibility(): PublicFeatureVisibility {
  try {
    const stored = JSON.parse(fs.readFileSync(STORE_PATH, "utf8")) as unknown;
    return normalize(stored);
  } catch (error) {
    if ((error as NodeJS.ErrnoException)?.code !== "ENOENT") {
      console.error("[public-feature-visibility] Failed to read settings:", error);
    }
    return normalize(DEFAULT_PUBLIC_FEATURE_VISIBILITY);
  }
}

export function writePublicFeatureVisibility(input: unknown): PublicFeatureVisibility {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new TypeError("Feature visibility must be an object.");
  }
  const source = input as Record<string, unknown>;
  const invalid = Object.entries(source).find(([key, value]) =>
    !Object.prototype.hasOwnProperty.call(DEFAULT_PUBLIC_FEATURE_VISIBILITY, key) ||
    typeof value !== "boolean"
  );
  if (invalid) {
    throw new TypeError(`Invalid feature visibility setting: ${invalid[0]}.`);
  }
  const next = normalize({ ...readPublicFeatureVisibility(), ...source });
  fs.mkdirSync(path.dirname(STORE_PATH), { recursive: true });
  fs.writeFileSync(STORE_PATH, `${JSON.stringify(next, null, 2)}\n`, "utf8");
  return next;
}

export const PUBLIC_FEATURE_VISIBILITY_OPTIONS = MANAGEABLE_FEATURES;
