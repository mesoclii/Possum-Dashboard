"use client";

import { clampNumber } from "@/lib/dashboard/numberInput";

import Link from "next/link";
import { useMemo } from "react";
import EngineInsights from "@/components/possum/EngineInsights";
import { useGuildEngineEditor } from "@/components/possum/useGuildEngineEditor";
import {
  compactPokemonChannels,
  DEFAULT_POKEMON_CONFIG,
  normalizePokemonChannels,
  normalizePokemonConfig,
  POKEMON_TIER_KEYS,
  type PokemonChannelWeight,
  type PokemonConfig,
  type PokemonTierKey,
  isTextLikeChannel,
  titleizePokemonTier,
} from "@/lib/dashboard/pokemonConfig";


const shell: React.CSSProperties = { color: "#ffd0d0", padding: 18, maxWidth: 1320 };
const card: React.CSSProperties = { border: "1px solid #5f0000", borderRadius: 12, padding: 14, background: "rgba(120,0,0,0.10)", marginBottom: 12 };
const input: React.CSSProperties = { width: "100%", background: "#0a0a0a", color: "#ffd0d0", border: "1px solid #7f0000", borderRadius: 8, padding: "10px 12px" };
const navCard: React.CSSProperties = { border: "1px solid #5f0000", borderRadius: 10, padding: 12, color: "#ffd0d0", textDecoration: "none", background: "#110000" };

function NavLinkCard({
  href,
  title,
  body,
}: {
  href: string;
  title: string;
  body: string;
}) {
  return (
    <Link href={href} style={navCard}>
      <div style={{ color: "#ff5a5a", fontWeight: 900, textTransform: "uppercase", letterSpacing: "0.08em" }}>{title}</div>
      <div style={{ color: "#ffb0b0", fontSize: 12, marginTop: 6 }}>{body}</div>
    </Link>
  );
}

export default function PokemonCatchingPage() {
  const {
    guildId,
    guildName,
    config: rawCfg,
    setConfig: setCfg,
    channels,
    summary,
    details,
    loading,
    saving,
    message,
    save,
    runAction,
  } = useGuildEngineEditor<PokemonConfig>("pokemon", DEFAULT_POKEMON_CONFIG);

  const cfg = useMemo(() => normalizePokemonConfig(rawCfg), [rawCfg]);
  const channelRows = useMemo(
    () => normalizePokemonChannels(cfg.channels, { keepEmpty: true }),
    [cfg.channels]
  );
  const textChannels = useMemo(
    () => channels.filter((channel) => isTextLikeChannel(channel?.type)),
    [channels]
  );

  function updateChannel(index: number, patch: Partial<PokemonChannelWeight>) {
    const next = normalizePokemonChannels(cfg.channels, { keepEmpty: true });
    next[index] = { ...next[index], ...patch };
    setCfg((prev) => ({ ...normalizePokemonConfig(prev), channels: next }));
  }

  function addChannel() {
    setCfg((prev) => ({
      ...normalizePokemonConfig(prev),
      channels: [...normalizePokemonChannels(normalizePokemonConfig(prev).channels, { keepEmpty: true }), { id: "", weight: 1 }],
    }));
  }

  function removeChannel(index: number) {
    const next = normalizePokemonChannels(cfg.channels, { keepEmpty: true }).filter((_, currentIndex) => currentIndex !== index);
    setCfg((prev) => ({ ...normalizePokemonConfig(prev), channels: next }));
  }

  function updateTierMetric(group: "tierWeights" | "catchRates" | "rewards", key: PokemonTierKey, value: number) {
    setCfg((prev) => {
      const next = normalizePokemonConfig(prev);
      return {
        ...next,
        [group]: {
          ...next[group],
          [key]: value,
        },
      };
    });
  }

  async function spawnPokemonNow() {
    await runAction("spawnNow");
  }

  if (!guildId) return <div style={{ ...shell, color: "#ff8080" }}>Missing guildId. Open from /guilds first.</div>;

  const battleHref = `/dashboard/pokemon-battle?guildId=${encodeURIComponent(guildId)}`;
  const tradeHref = `/dashboard/pokemon-trade?guildId=${encodeURIComponent(guildId)}`;

  return (
    <div style={shell}>
      <h1 style={{ margin: 0, color: "#ff4444", letterSpacing: "0.12em", textTransform: "uppercase" }}>Pokemon Catching</h1>
      <div style={{ color: "#ff9999", marginTop: 6 }}>Guild: {guildName || guildId}</div>
      <div style={{ color: "#ffb0b0", fontSize: 12, marginTop: 4 }}>
        Catching is the shared Pokemon core. Wild spawns feed the same trainer inventory that battle and trade use.
      </div>
      {message ? <div style={{ marginTop: 8, color: "#ffd27a" }}>{message}</div> : null}

      {loading ? (
        <div style={{ ...card, marginTop: 12 }}>Loading pokemon catching...</div>
      ) : (
        <>
          <EngineInsights summary={summary} details={details} />

          <section style={{ ...card, marginTop: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
              <div>
                <div style={{ color: "#ffb3b3", fontSize: 12, letterSpacing: "0.08em", textTransform: "uppercase" }}>Shared Pokemon System</div>
                <div style={{ color: "#ff9c9c", fontSize: 12, marginTop: 6 }}>
                  These gates control whether the guild can catch Pokemon at all and whether the trainer panel is live.
                </div>
              </div>
              <button onClick={spawnPokemonNow} disabled={saving} style={{ ...input, width: "auto", cursor: "pointer", fontWeight: 900 }}>
                Spawn Pokemon Now
              </button>
            </div>
            <div style={{ display: "flex", gap: 14, flexWrap: "wrap", alignItems: "center", marginTop: 12 }}>
              <label><input type="checkbox" checked={cfg.enabled} onChange={(e) => setCfg((prev) => ({ ...normalizePokemonConfig(prev), enabled: e.target.checked }))} /> Catching Enabled</label>
              <label><input type="checkbox" checked={cfg.guildAllowed} onChange={(e) => setCfg((prev) => ({ ...normalizePokemonConfig(prev), guildAllowed: e.target.checked }))} /> Guild Allowed</label>
              <label><input type="checkbox" checked={cfg.privateOnly} onChange={(e) => setCfg((prev) => ({ ...normalizePokemonConfig(prev), privateOnly: e.target.checked }))} /> Private Only</label>
              <label><input type="checkbox" checked={cfg.stage2Enabled} onChange={(e) => setCfg((prev) => ({ ...normalizePokemonConfig(prev), stage2Enabled: e.target.checked }))} /> Trainer Panel Enabled</label>
            </div>
          </section>

          <section style={card}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <div>
                <div style={{ color: "#ffb3b3", fontSize: 12, letterSpacing: "0.08em", textTransform: "uppercase" }}>Weighted Spawn Lanes</div>
                <div style={{ color: "#ff9c9c", fontSize: 12 }}>Higher weight means that channel is picked more often for wild spawns.</div>
              </div>
              <button onClick={addChannel} style={{ ...input, width: "auto", cursor: "pointer", fontWeight: 800 }}>+ Add Lane</button>
            </div>

            {channelRows.length ? (
              <div style={{ display: "grid", gap: 10, marginTop: 10 }}>
                {channelRows.map((row, index) => (
                  <div key={`${row.id}_${index}`} style={{ display: "grid", gridTemplateColumns: "minmax(240px,1fr) 140px 120px", gap: 10, alignItems: "end" }}>
                    <div>
                      <div style={{ marginBottom: 6 }}>Channel</div>
                      <select style={input} value={row.id} onChange={(e) => updateChannel(index, { id: e.target.value })}>
                        <option value="">Select channel</option>
                        {textChannels.map((channel) => <option key={channel.id} value={channel.id}>#{channel.name}</option>)}
                      </select>
                    </div>
                    <div>
                      <div style={{ marginBottom: 6 }}>Weight</div>
                      <input style={input} type="number" min={1} max={1000} value={row.weight} onChange={(e) => updateChannel(index, { weight: clampNumber(e.target.value, 1, 1000) })} />
                    </div>
                    <button onClick={() => removeChannel(index)} style={{ ...input, cursor: "pointer", borderColor: "#a00000", color: "#ffb6b6" }}>
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ color: "#ffaaaa", fontSize: 12, marginTop: 10 }}>No catch lanes configured yet. Saviors can still use legacy fallback lanes; other guilds should set channels here.</div>
            )}
          </section>

          <section style={card}>
            <div style={{ color: "#ffb3b3", fontSize: 12, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 10 }}>Catch Routing & Timing</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 12 }}>
              <div>
                <div style={{ marginBottom: 6 }}>Catch Log Channel</div>
                <select style={input} value={cfg.catchLogChannelId || ""} onChange={(e) => setCfg((prev) => ({ ...normalizePokemonConfig(prev), catchLogChannelId: e.target.value }))}>
                  <option value="">Select channel</option>
                  {textChannels.map((channel) => <option key={channel.id} value={channel.id}>#{channel.name}</option>)}
                </select>
              </div>
              <div>
                <div style={{ marginBottom: 6 }}>Spawn Interval (minutes)</div>
                <input style={input} type="number" min={1} max={10080} value={cfg.spawnIntervalMinutes} onChange={(e) => setCfg((prev) => ({ ...normalizePokemonConfig(prev), spawnIntervalMinutes: clampNumber(e.target.value, 1, 10080) }))} />
              </div>
              <div>
                <div style={{ marginBottom: 6 }}>Minimum Minutes</div>
                <input style={input} type="number" min={1} max={10080} value={cfg.minMinutes} onChange={(e) => setCfg((prev) => ({ ...normalizePokemonConfig(prev), minMinutes: clampNumber(e.target.value, 1, 10080) }))} />
              </div>
              <div>
                <div style={{ marginBottom: 6 }}>Maximum Minutes</div>
                <input style={input} type="number" min={1} max={10080} value={cfg.maxMinutes} onChange={(e) => setCfg((prev) => ({ ...normalizePokemonConfig(prev), maxMinutes: clampNumber(e.target.value, 1, 10080) }))} />
              </div>
              <div>
                <div style={{ marginBottom: 6 }}>Max Active Wild Spawns</div>
                <input style={input} type="number" min={1} max={25} value={cfg.maxActiveSpawns} onChange={(e) => setCfg((prev) => ({ ...normalizePokemonConfig(prev), maxActiveSpawns: clampNumber(e.target.value, 1, 25) }))} />
              </div>
              <div>
                <div style={{ marginBottom: 6 }}>Despawn Window (minutes)</div>
                <input style={input} type="number" min={1} max={10080} value={cfg.despawnMinutes} onChange={(e) => setCfg((prev) => ({ ...normalizePokemonConfig(prev), despawnMinutes: clampNumber(e.target.value, 1, 10080) }))} />
              </div>
              <div>
                <div style={{ marginBottom: 6 }}>Minimum Catch Delay (ms)</div>
                <input style={input} type="number" min={0} max={600000} value={cfg.minCatchAgeMs} onChange={(e) => setCfg((prev) => ({ ...normalizePokemonConfig(prev), minCatchAgeMs: clampNumber(e.target.value, 0, 600000) }))} />
              </div>
            </div>
          </section>

          <section style={card}>
            <div style={{ color: "#ffb3b3", fontSize: 12, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 10 }}>Catch Economy Model</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 12 }}>
              {POKEMON_TIER_KEYS.map((key) => (
                <div key={key} style={{ border: "1px solid #4f0000", borderRadius: 10, padding: 12, background: "#120000" }}>
                  <div style={{ color: "#ff6666", fontSize: 13, fontWeight: 900, letterSpacing: "0.08em", textTransform: "uppercase" }}>{titleizePokemonTier(key)}</div>
                  <div style={{ display: "grid", gap: 8, marginTop: 10 }}>
                    <div>
                      <div style={{ marginBottom: 4 }}>Tier Weight</div>
                      <input style={input} type="number" min={0} max={10000} value={cfg.tierWeights[key]} onChange={(e) => updateTierMetric("tierWeights", key, clampNumber(e.target.value, 0, 10000))} />
                    </div>
                    <div>
                      <div style={{ marginBottom: 4 }}>Catch Rate</div>
                      <input style={input} type="number" min={0} max={1} step={0.01} value={cfg.catchRates[key]} onChange={(e) => updateTierMetric("catchRates", key, clampNumber(e.target.value, 0, 1, false))} />
                    </div>
                    <div>
                      <div style={{ marginBottom: 4 }}>Reward Coins</div>
                      <input style={input} type="number" min={0} max={1000000} value={cfg.rewards[key]} onChange={(e) => updateTierMetric("rewards", key, clampNumber(e.target.value, 0, 1000000))} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section style={{ ...card, display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))", gap: 12 }}>
            <NavLinkCard href={battleHref} title="Pokemon Battle" body="Battle uses the same trainer inventory. Configure duel availability, challenge lane, and battle logging here." />
            <NavLinkCard href={tradeHref} title="Pokemon Trade" body="Trade uses the same caught collection. Configure trade availability and audit logging here." />
          </section>

          <div style={{ ...card, display: "flex", justifyContent: "flex-end" }}>
            <button
              onClick={() => save({ ...cfg, channels: compactPokemonChannels(cfg.channels) })}
              disabled={saving}
              style={{ ...input, width: "auto", cursor: "pointer", fontWeight: 900 }}
            >
              {saving ? "Saving..." : "Save Catching"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
