"use client";

import ConfigJsonEditor from "@/components/possum/ConfigJsonEditor";
import EngineInsights from "@/components/possum/EngineInsights";
import { useGuildEngineEditor } from "@/components/possum/useGuildEngineEditor";

type EconomyRewardsConfig = {
  enabled: boolean;
  daily: { coins: number; cooldownHours: number };
  work: { coinsMin: number; coinsMax: number; cooldownMinutes: number; xpMin: number; xpMax: number };
};

const DEFAULTS: EconomyRewardsConfig = {
  enabled: true,
  daily: { coins: 250, cooldownHours: 24 },
  work: { coinsMin: 25, coinsMax: 75, cooldownMinutes: 30, xpMin: 0, xpMax: 0 },
};

const styles = {
  page: { color: "#ffb3b3", padding: 14, maxWidth: 1200 },
  card: {
    border: "1px solid #5f0000",
    borderRadius: 12,
    padding: 14,
    background: "rgba(120,0,0,0.10)",
    marginBottom: 12,
  },
  input: {
    width: "100%",
    padding: 10,
    borderRadius: 8,
    border: "1px solid #6f0000",
    background: "#0a0a0a",
    color: "#ffd7d7",
  },
};

function clampInt(value: any, fallback: number, min: number, max: number) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(n)));
}

export default function EconomyRewardsClient() {
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
  } = useGuildEngineEditor<EconomyRewardsConfig>("economyRewards", DEFAULTS);

  if (!guildId) return <div style={{ color: "#ff8a8a", padding: 20 }}>Missing guildId. Open from /guilds.</div>;
  if (loading) return <div style={{ color: "#ff8a8a", padding: 20 }}>Loading daily/work rewards...</div>;

  const safeCfg: EconomyRewardsConfig = {
    enabled: cfg?.enabled !== false,
    daily: {
      coins: clampInt(cfg?.daily?.coins, DEFAULTS.daily.coins, 0, 1_000_000),
      cooldownHours: clampInt(cfg?.daily?.cooldownHours, DEFAULTS.daily.cooldownHours, 1, 72),
    },
    work: {
      coinsMin: clampInt(cfg?.work?.coinsMin, DEFAULTS.work.coinsMin, 0, 1_000_000),
      coinsMax: clampInt(cfg?.work?.coinsMax, DEFAULTS.work.coinsMax, 0, 1_000_000),
      cooldownMinutes: clampInt(cfg?.work?.cooldownMinutes, DEFAULTS.work.cooldownMinutes, 1, 720),
      xpMin: clampInt(cfg?.work?.xpMin, DEFAULTS.work.xpMin, 0, 10_000),
      xpMax: clampInt(cfg?.work?.xpMax, DEFAULTS.work.xpMax, 0, 10_000),
    },
  };

  return (
    <div style={styles.page}>
      <h1 style={{ marginTop: 0, color: "#ff3b3b", letterSpacing: "0.08em", textTransform: "uppercase" }}>
        Daily + Work Rewards
      </h1>
      <p style={{ marginTop: 0 }}>Guild: {guildName || guildId}</p>
      {message ? <div style={{ color: "#ffd27a", marginBottom: 8 }}>{message}</div> : null}

      <EngineInsights summary={summary} details={details} />

      <div style={styles.card}>
        <label>
          <input
            type="checkbox"
            checked={!!safeCfg.enabled}
            onChange={(e) => setCfg({ ...safeCfg, enabled: e.target.checked })}
          />{" "}
          Rewards enabled
        </label>
      </div>

      <div style={styles.card}>
        <h3 style={{ marginTop: 0, color: "#ff4444" }}>/daily</h3>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <div>
            <label>Coins</label>
            <input
              style={styles.input}
              type="number"
              value={safeCfg.daily.coins}
              onChange={(e) => setCfg({ ...safeCfg, daily: { ...safeCfg.daily, coins: clampInt(e.target.value, safeCfg.daily.coins, 0, 1_000_000) } })}
            />
          </div>
          <div>
            <label>Cooldown (hours)</label>
            <input
              style={styles.input}
              type="number"
              value={safeCfg.daily.cooldownHours}
              onChange={(e) => setCfg({ ...safeCfg, daily: { ...safeCfg.daily, cooldownHours: clampInt(e.target.value, safeCfg.daily.cooldownHours, 1, 72) } })}
            />
          </div>
        </div>
      </div>

      <div style={styles.card}>
        <h3 style={{ marginTop: 0, color: "#ff4444" }}>/work</h3>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <div>
            <label>Coins min</label>
            <input
              style={styles.input}
              type="number"
              value={safeCfg.work.coinsMin}
              onChange={(e) => setCfg({ ...safeCfg, work: { ...safeCfg.work, coinsMin: clampInt(e.target.value, safeCfg.work.coinsMin, 0, 1_000_000) } })}
            />
          </div>
          <div>
            <label>Coins max</label>
            <input
              style={styles.input}
              type="number"
              value={safeCfg.work.coinsMax}
              onChange={(e) => setCfg({ ...safeCfg, work: { ...safeCfg.work, coinsMax: clampInt(e.target.value, safeCfg.work.coinsMax, 0, 1_000_000) } })}
            />
          </div>
          <div>
            <label>Cooldown (minutes)</label>
            <input
              style={styles.input}
              type="number"
              value={safeCfg.work.cooldownMinutes}
              onChange={(e) => setCfg({ ...safeCfg, work: { ...safeCfg.work, cooldownMinutes: clampInt(e.target.value, safeCfg.work.cooldownMinutes, 1, 720) } })}
            />
          </div>
          <div />
          <div>
            <label>XP min (optional)</label>
            <input
              style={styles.input}
              type="number"
              value={safeCfg.work.xpMin}
              onChange={(e) => setCfg({ ...safeCfg, work: { ...safeCfg.work, xpMin: clampInt(e.target.value, safeCfg.work.xpMin, 0, 10_000) } })}
            />
          </div>
          <div>
            <label>XP max (optional)</label>
            <input
              style={styles.input}
              type="number"
              value={safeCfg.work.xpMax}
              onChange={(e) => setCfg({ ...safeCfg, work: { ...safeCfg.work, xpMax: clampInt(e.target.value, safeCfg.work.xpMax, 0, 10_000) } })}
            />
          </div>
        </div>
      </div>

      <ConfigJsonEditor
        title="Advanced Rewards Config"
        value={safeCfg}
        disabled={saving}
        onApply={(next) => setCfg({ ...DEFAULTS, ...(next as EconomyRewardsConfig) })}
      />

      <button
        onClick={() => void save({
          ...safeCfg,
          work: {
            ...safeCfg.work,
            coinsMax: Math.max(safeCfg.work.coinsMin, safeCfg.work.coinsMax),
            xpMax: Math.max(safeCfg.work.xpMin, safeCfg.work.xpMax),
          },
        })}
        disabled={saving}
        style={{ ...styles.input, width: "auto", cursor: "pointer", fontWeight: 900 }}
      >
        {saving ? "Saving..." : "Save Rewards"}
      </button>
    </div>
  );
}

