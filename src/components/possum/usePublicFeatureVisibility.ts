"use client";

import { useEffect, useState } from "react";

export type PublicFeatureVisibility = Record<string, boolean>;

export function usePublicFeatureVisibility() {
  const [visibility, setVisibility] = useState<PublicFeatureVisibility | null>(null);

  useEffect(() => {
    let active = true;
    fetch("/api/public-feature-visibility", { cache: "no-store" })
      .then(async (response) => {
        const data = await response.json().catch(() => ({}));
        if (!response.ok || data?.success === false) {
          throw new Error(data?.error || "Could not load public feature visibility.");
        }
        if (active && data.visibility && typeof data.visibility === "object") {
          setVisibility(data.visibility as PublicFeatureVisibility);
        }
      })
      .catch(() => {
        if (active) setVisibility({});
      });
    return () => {
      active = false;
    };
  }, []);

  return visibility;
}
