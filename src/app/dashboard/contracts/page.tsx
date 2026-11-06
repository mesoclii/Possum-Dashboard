"use client";

import EngineContractPanel from "@/components/possum/EngineContractPanel";
import EngineInsights from "@/components/possum/EngineInsights";
import { useGuildEngineEditor } from "@/components/possum/useGuildEngineEditor";

type ContractsCfg = {
  enabled: boolean;
  dailyCount: number;
  weeklyCount: number;
  dailyBonusCoins: number;
  weeklyBonusCoins: number;
  rerollCostCoins: number;
  messageCooldownSeconds: number;
};

const DEFAULT_CONTRACTS: ContractsCfg = {
  enabled: true,
  dailyCount: 3,
  weeklyCount: 2,
  dailyBonusCoins: 150,
  weeklyBonusCoins: 400,
  rerollCostCoins: 0,
  messageCooldownSeconds: 30,
};

function clampNum(raw: string, min: number, max: number) {
  const n = Math.floor(Number(raw));
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : min;
}

const shell: React.CSSProperties = { color: "#ffd0d0", padding: 18, maxWidth: 1280 };
const card: React.CSSProperties = { border: "1px solid #6a0000", borderRadius: 12, background: "rgba(120,0,0,0.10)", padding: 14, marginBottom: 12 };
const input: React.CSSProperties = { width: "100%", padding: "10px 12px", background: "#0b0b0b", color: "#ffd8d8", border: "1px solid #7a0000", borderRadius: 8 };

export default function ContractsEnginePage() {
  const {
    guildId,
    guildName,
    config: cfg,
    setConfig: setCfg,
    summary,
    details,
    loading,
    saving,
    message,
    save,
  } = useGuildEngineEditor<ContractsCfg>("contracts", DEFAULT_CONTRACTS);

  if (!guildId) return <div style={{ ...shell, color: "#ff8a8a" }}>Missing guildId. Open from /guilds first.</div>;

  return (
    <div style={shell}>
      <h1 style={{ margin: 0, color: "#ff4444", letterSpacing: "0.12em", textTransform: "uppercase" }}>Contracts Engine</h1>
      <div style={{ color: "#ff9c9c", marginTop: 6 }}>Guild: {guildName || guildId}</div>
      <div style={{ color: "#ffb0b0", fontSize: 12, marginTop: 4 }}>
        Real contract payout tuning and live contract completion summaries from the bot&apos;s runtime store.
      </div>
      {message ? <div style={{ color: "#ffb3f0", marginTop: 8 }}>{message}</div> : null}

      {loading ? (
        <div style={card}>Loading contracts...</div>
      ) : (
        <>
          <EngineContractPanel
            engineKey="contracts"
            intro="Contracts sit between progression and economy. This page controls how many objectives are generated, how often users can reroll or ping the system, and what the payout shape looks like when objectives complete."
            related={[
              { label: "Progression", route: "/dashboard/economy/progression", reason: "progression events are what most contract templates listen to" },
              { label: "Profile", route: "/dashboard/profile", reason: "contract completion and payout visibility should be reflected in user-facing profile surfaces" },
              { label: "Store", route: "/dashboard/economy/store", reason: "coin rewards and reroll cost policy should stay aligned with the store economy" },
            ]}
          />
          <EngineInsights summary={summary} details={details} />

          <section style={{ ...card, marginTop: 12 }}>
            <label><input type="checkbox" checked={cfg.enabled} onChange={(e) => setCfg((p) => ({ ...p, enabled: e.target.checked }))} /> Contracts Enabled</label>
          </section>

          <section style={card}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))", gap: 12 }}>
              <div>
                <div style={{ marginBottom: 6, color: "#ff9c9c", textTransform: "uppercase", letterSpacing: "0.08em", fontSize: 12 }}>Objective Generation</div>
                <div style={{ color: "#ffd0d0", lineHeight: 1.7 }}>
                  Daily templates should stay short-cycle and channel-driven. Weekly templates should carry the heavier payout and be tied to the longer progression loops that matter for prestige, economy, and loyalty.
                </div>
              </div>
              <div>
                <div style={{ marginBottom: 6, color: "#ff9c9c", textTransform: "uppercase", letterSpacing: "0.08em", fontSize: 12 }}>Economy Guardrails</div>
                <div style={{ color: "#ffd0d0", lineHeight: 1.7 }}>
                  If rerolls are free and cooldown is low, contracts become a balance faucet. This surface should be tuned alongside progression XP and store pricing, not treated as a standalone reward printer.
                </div>
              </div>
            </div>
          </section>

          <section style={card}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 12 }}>
              <div><div style={{ marginBottom: 6 }}>Daily Contract Count</div><input style={input} type="number" min={0} max={4} value={cfg.dailyCount} onChange={(e) => setCfg((p) => ({ ...p, dailyCount: clampNum(e.target.value, 0, 4) }))} /></div>
              <div><div style={{ marginBottom: 6 }}>Weekly Contract Count</div><input style={input} type="number" min={0} max={4} value={cfg.weeklyCount} onChange={(e) => setCfg((p) => ({ ...p, weeklyCount: clampNum(e.target.value, 0, 4) }))} /></div>
              <div><div style={{ marginBottom: 6 }}>Daily Bonus Coins</div><input style={input} type="number" min={0} max={1000000} value={cfg.dailyBonusCoins} onChange={(e) => setCfg((p) => ({ ...p, dailyBonusCoins: clampNum(e.target.value, 0, 1000000) }))} /></div>
              <div><div style={{ marginBottom: 6 }}>Weekly Bonus Coins</div><input style={input} type="number" min={0} max={1000000} value={cfg.weeklyBonusCoins} onChange={(e) => setCfg((p) => ({ ...p, weeklyBonusCoins: clampNum(e.target.value, 0, 1000000) }))} /></div>
              <div><div style={{ marginBottom: 6 }}>Reroll Cost</div><input style={input} type="number" min={0} max={1000000} value={cfg.rerollCostCoins} onChange={(e) => setCfg((p) => ({ ...p, rerollCostCoins: clampNum(e.target.value, 0, 1000000) }))} /></div>
              <div><div style={{ marginBottom: 6 }}>Message Cooldown (seconds)</div><input style={input} type="number" min={0} max={3600} value={cfg.messageCooldownSeconds} onChange={(e) => setCfg((p) => ({ ...p, messageCooldownSeconds: clampNum(e.target.value, 0, 3600) }))} /></div>
            </div>
          </section>

          <div style={{ ...card, display: "flex", justifyContent: "flex-end" }}>
            <button onClick={() => save()} disabled={saving} style={{ ...input, width: "auto", cursor: "pointer", fontWeight: 900 }}>
              {saving ? "Saving..." : "Save Contracts"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
