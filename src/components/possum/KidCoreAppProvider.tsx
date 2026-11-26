"use client";

import { KidCoreProvider } from "@k-id/core-react";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type KidBrowserConfig = {
  publishableKey: string;
  baseUrl: string;
  supportEmail: string;
  dashboardUrl: string;
  iconUrl: string;
  mode: "test" | "live";
};

type KidBrowserConfigState = {
  config: KidBrowserConfig | null;
  loading: boolean;
  error: string;
};

const KidBrowserConfigContext = createContext<KidBrowserConfigState>({
  config: null,
  loading: true,
  error: "",
});

const DECLARED_PERMISSIONS = [
  "join-groups",
  "text-chat-public",
  "text-chat-private",
  "public-profile",
  "send-accept-friend-requests",
  "photo-video-sharing",
  "online-status",
  "multiplayer",
  "send-gifts",
  "mature-language",
  "mods",
  "voice-chat",
] as const;

export function useKidBrowserConfig() {
  return useContext(KidBrowserConfigContext);
}

export default function KidCoreAppProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<KidBrowserConfigState>({ config: null, loading: true, error: "" });

  const [configRevision, setConfigRevision] = useState(0);

  useEffect(() => {
    let active = true;
    async function loadConfig(refresh = false) {
      try {
        const response = await fetch("/api/age-assurance/client-config", { cache: "no-store" });
        const result = await response.json().catch(() => ({}));
        if (!response.ok || result?.success !== true || !result?.config) {
          throw new Error(String(result?.error || "k-ID browser settings are unavailable."));
        }
        const config = result.config as KidBrowserConfig;
        if (!config.publishableKey || !config.baseUrl || !config.supportEmail || !config.dashboardUrl) {
          throw new Error("Save the active k-ID publishable key, browser URL, dashboard URL, and support email first.");
        }
        if (!active) return;
        setState({ config, loading: false, error: "" });
        if (refresh) setConfigRevision((revision) => revision + 1);
      } catch (error: unknown) {
        if (!active) return;
        setState({
          config: null,
          loading: false,
          error: error instanceof Error ? error.message : "k-ID browser settings are unavailable.",
        });
      }
    }
    const reloadConfig = () => { void loadConfig(true); };
    void loadConfig();
    window.addEventListener("kid-provider-config-updated", reloadConfig);
    return () => {
      active = false;
      window.removeEventListener("kid-provider-config-updated", reloadConfig);
    };
  }, []);

  const config = state.config;
  // Kai accepts SDK declarations in Test mode. Live permissions and legal
  // details must already be published on the matching Kai product.
  const provider = config ? (
    <KidCoreProvider
      key={`${config.mode}:${config.publishableKey}:${config.baseUrl}:${configRevision}`}
      publishableKey={config.publishableKey}
      baseUrl={config.baseUrl}
      declare={config.mode === "test" ? {
        permissions: DECLARED_PERMISSIONS.map((name) => ({ name })),
        privacyPolicyUrl: `${config.dashboardUrl.replace(/\/+$/, "")}/privacy`,
        termsOfServiceUrl: `${config.dashboardUrl.replace(/\/+$/, "")}/terms`,
        iconUrl: config.iconUrl || "/kid-app-icon.png",
        supportEmail: config.supportEmail,
      } : undefined}
    >
      {children}
    </KidCoreProvider>
  ) : children;

  return (
    <KidBrowserConfigContext.Provider value={state}>
      {provider}
    </KidBrowserConfigContext.Provider>
  );
}
