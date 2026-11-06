"use client";

import Link from "next/link";
import { useMemo } from "react";
import EngineInsights from "@/components/possum/EngineInsights";
import { useGuildEngineEditor } from "@/components/possum/useGuildEngineEditor";
import {
  DEFAULT_POKEMON_CONFIG,
  normalizePokemonConfig,
  type PokemonConfig,
  isTextLikeChannel,
} from "@/lib/dashboard/pokemonConfig";


const shell: React.CSSProperties = { color: "#ffd0d0", padding: 18, maxWidth: 1240 };
const card: React.CSSProperties = { border: "1px solid #5f0000", borderRadius: 12, padding: 14, background: "rgba(120,0,0,0.10)", marginBottom: 12 };
const input: React.CSSProperties = { width: "100%", background: "#0a0a0a", color: "#ffd0d0", border: "1px solid #7f0000", borderRadius: 8, padding: "10px 12px" };
const navCard: React.CSSProperties = { border: "1px solid #5f0000", borderRadius: 10, padding: 12, color: "#ffd0d0", textDecoration: "none", background: "#110000" };

export default function PokemonBattlePage() {
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
  } = useGuildEngineEditor<PokemonConfig>("pokemon", DEFAULT_POKEMON_CONFIG);

  const cfg = useMemo(() => normalizePokemonConfig(rawCfg), [rawCfg]);
  const textChannels = useMemo(
    () => channels.filter((channel) => isTextLikeChannel(channel?.type)),
    [channels]
  );

  if (!guildId) return <div style={{ ...shell, color: "#ff8080" }}>Missing guildId. Open from /guilds first.</div>;

  const catchingHref = `/dashboard/pokemon-catching?guildId=${encodeURIComponent(guildId)}`;
  const tradeHref = `/dashboard/pokemon-trade?guildId=${encodeURIComponent(guildId)}`;

  return (
    <div style={shell}>
      <h1 style={{ margin: 0, color: "#ff4444", letterSpacing: "0.12em", textTransform: "uppercase" }}>Pokemon Battle</h1>
      <div style={{ color: "#ff9999", marginTop: 6 }}>Guild: {guildName || guildId}</div>
      <div style={{ color: "#ffb0b0", fontSize: 12, marginTop: 4 }}>
        Battle is tied to the shared trainer inventory. Trainers can only duel with Pokemon they already caught.
      </div>
      {message ? <div style={{ marginTop: 8, color: "#ffb3f0" }}>{message}</div> : null}

      {loading ? (
        <div style={{ ...card, marginTop: 12 }}>Loading pokemon battle...</div>
      ) : (
        <>
          <EngineInsights summary={summary} details={details} />

          <section style={{ ...card, marginTop: 12 }}>
            <div style={{ color: "#ffb3b3", fontSize: 12, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 10 }}>Shared System Gates</div>
            <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
              <label><input type="checkbox" checked={cfg.enabled} onChange={(e) => setCfg((prev) => ({ ...normalizePokemonConfig(prev), enabled: e.target.checked }))} /> Pokemon Enabled</label>
              <label><input type="checkbox" checked={cfg.guildAllowed} onChange={(e) => setCfg((prev) => ({ ...normalizePokemonConfig(prev), guildAllowed: e.target.checked }))} /> Guild Allowed</label>
              <label><input type="checkbox" checked={cfg.privateOnly} onChange={(e) => setCfg((prev) => ({ ...normalizePokemonConfig(prev), privateOnly: e.target.checked }))} /> Private Only</label>
              <label><input type="checkbox" checked={cfg.stage2Enabled} onChange={(e) => setCfg((prev) => ({ ...normalizePokemonConfig(prev), stage2Enabled: e.target.checked }))} /> Trainer Panel Enabled</label>
              <label><input type="checkbox" checked={cfg.battleEnabled} onChange={(e) => setCfg((prev) => ({ ...normalizePokemonConfig(prev), battleEnabled: e.target.checked }))} /> Battle Enabled</label>
            </div>
          </section>

          <section style={card}>
            <div style={{ color: "#ffb3b3", fontSize: 12, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 10 }}>Battle Routing</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))", gap: 12 }}>
              <div>
                <div style={{ marginBottom: 6 }}>Battle Channel</div>
                <select style={input} value={cfg.battleChannelId || ""} onChange={(e) => setCfg((prev) => ({ ...normalizePokemonConfig(prev), battleChannelId: e.target.value }))}>
                  <option value="">Select channel</option>
                  {textChannels.map((channel) => <option key={channel.id} value={channel.id}>#{channel.name}</option>)}
                </select>
              </div>
              <div>
                <div style={{ marginBottom: 6 }}>Battle Log Channel</div>
                <select style={input} value={cfg.battleLogChannelId || ""} onChange={(e) => setCfg((prev) => ({ ...normalizePokemonConfig(prev), battleLogChannelId: e.target.value }))}>
                  <option value="">Select channel</option>
                  {textChannels.map((channel) => <option key={channel.id} value={channel.id}>#{channel.name}</option>)}
                </select>
              </div>
            </div>
          </section>

          <section style={card}>
            <div style={{ color: "#ffb3b3", fontSize: 12, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 10 }}>Operator Notes</div>
            <div style={{ color: "#ffb0b0", fontSize: 13, lineHeight: 1.55 }}>
              Battle availability is tied to the same guild-level Pokemon gate as catching and trading. If battle is on but the shared system is off, no duel panel will be reachable.
            </div>
            <div style={{ color: "#ff9c9c", fontSize: 12, marginTop: 8 }}>
              Use the catching page to control spawn lanes and catch economy. Use the trade page to control exchange logging separately.
            </div>
          </section>

          <section style={{ ...card, display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))", gap: 12 }}>
            <Link href={catchingHref} style={navCard}>
              <div style={{ color: "#ff5a5a", fontWeight: 900, textTransform: "uppercase", letterSpacing: "0.08em" }}>Pokemon Catching</div>
              <div style={{ color: "#ffb0b0", fontSize: 12, marginTop: 6 }}>Manage wild spawn lanes, catch rates, reward tuning, and catch logs.</div>
            </Link>
            <Link href={tradeHref} style={navCard}>
              <div style={{ color: "#ff5a5a", fontWeight: 900, textTransform: "uppercase", letterSpacing: "0.08em" }}>Pokemon Trade</div>
              <div style={{ color: "#ffb0b0", fontSize: 12, marginTop: 6 }}>Configure trade availability and audit logging separately from duel routing.</div>
            </Link>
          </section>

          <div style={{ ...card, display: "flex", justifyContent: "flex-end" }}>
            <button onClick={() => save(cfg)} disabled={saving} style={{ ...input, width: "auto", cursor: "pointer", fontWeight: 900 }}>
              {saving ? "Saving..." : "Save Battle"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
