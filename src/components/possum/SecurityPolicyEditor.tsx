"use client";

import { useCallback, useEffect, useState } from "react";
import { PossumCard } from "@/components/possum/PossumCard";
import { possum } from "@/styles/possumTheme";

type FeaturesPayload = {
  features: Record<string, boolean>;
  keys: string[];
  privateGuild?: boolean;
};

const LABELS: Record<string, string> = {
  onboardingEnabled: "Onboarding Engine",
  verificationEnabled: "Verification Engine",
  governanceEnabled: "Governance Engine",
  heistEnabled: "Heist Engine",
  rareDropEnabled: "Rare Spawn",
  catDropEnabled: "Cat Drop",
  pokemonEnabled: "Pokemon Engine (Private Only)",
  economyEnabled: "Economy Engine",
  aiEnabled: "AI Engine",
  birthdayEnabled: "Radio Birthday Engine",
};

export default function SecurityPolicyEditor() {
  const [guildId, setGuildId] = useState("");
  const [data, setData] = useState<FeaturesPayload>({ features: {}, keys: [] });
  const [status, setStatus] = useState("Loading...");
  const [savingKey, setSavingKey] = useState("");

  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("guildId") || "";
    setGuildId(String(id).trim());
  }, []);

  const load = useCallback(async () => {
    try {
      setStatus("Loading feature policy...");
      const res = await fetch(`/api/bot/guild-features?guildId=${encodeURIComponent(guildId)}`);
      const json = await res.json();
      if (!json?.success) throw new Error(json?.error || "Failed to load feature policy");
      setData({
        features: json.features || {},
        keys: Array.isArray(json.keys) ? json.keys : Object.keys(json.features || {}),
        privateGuild: !!json.privateGuild,
      });
      setStatus("");
    } catch (err: any) {
      setStatus(String(err?.message || err));
    }
  }, [guildId]);

  useEffect(() => {
    if (!guildId) return;
    void load();
  }, [guildId, load]);

  async function toggleFeature(key: string) {
    const current = !!data.features[key];
    const next = !current;
    setSavingKey(key);
    setStatus("");

    try {
      const res = await fetch("/api/bot/guild-features", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          guildId,
          features: { [key]: next },
        }),
      });

      const json = await res.json();
      if (!res.ok || !json?.success) throw new Error(json?.error || "Save failed");

      setData((prev) => ({
        ...prev,
        features: json.features || prev.features,
      }));
      setStatus(`${LABELS[key] || key} updated`);
    } catch (err: any) {
      setStatus(String(err?.message || err));
    } finally {
      setSavingKey("");
    }
  }

  if (!guildId) {
    return <div style={{ color: possum.soft }}>Missing guildId. Open from /guilds first.</div>;
  }

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div
        className="possum-red possum-glow"
        style={{ fontSize: 30, fontWeight: 950, letterSpacing: "0.22em", textTransform: "uppercase" }}
      >
        Security Policy Matrix
      </div>

      {status ? <div style={{ color: possum.soft }}>{status}</div> : null}

      <PossumCard title="Feature Toggles" description="Per-guild activation without deleting engine logic.">
        <div style={{ display: "grid", gap: 10 }}>
          {data.keys.map((key) => {
            const isPokemonLocked = key === "pokemonEnabled" && !data.privateGuild;
            const on = !!data.features[key];
            const disabled = !!savingKey || isPokemonLocked;

            return (
              <div
                key={key}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 12,
                  border: `1px solid rgba(255,0,0,0.18)`,
                  borderRadius: 12,
                  padding: "10px 12px",
                }}
              >
                <div style={{ color: "#fff", letterSpacing: "0.12em", textTransform: "uppercase", fontSize: 12 }}>
                  {LABELS[key] || key}
                  {isPokemonLocked ? (
                    <span style={{ marginLeft: 8, color: possum.soft, opacity: 0.85 }}>(private-guild only)</span>
                  ) : null}
                </div>

                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => toggleFeature(key)}
                  style={{
                    padding: "8px 12px",
                    borderRadius: 10,
                    border: `1px solid ${on ? "rgba(255,0,0,0.55)" : "rgba(255,0,0,0.22)"}`,
                    background: on ? "rgba(255,0,0,0.18)" : "rgba(0,0,0,0.25)",
                    color: on ? "#fff" : possum.soft,
                    fontWeight: 900,
                    letterSpacing: "0.16em",
                    textTransform: "uppercase",
                    fontSize: 11,
                    cursor: disabled ? "not-allowed" : "pointer",
                    opacity: disabled ? 0.65 : 1,
                  }}
                >
                  {on ? "Active" : "Off"}
                </button>
              </div>
            );
          })}
        </div>
      </PossumCard>
    </div>
  );
}
